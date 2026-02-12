/**
 * Generate Client Memos API
 * Generates customized memos for selected clients using Haiku
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/db';
import { generateBaseMemo, generateClientMemo } from '@/lib/memo-generator';
import { generateMemoPDF } from '@/lib/pdf-generator';
import { saveUpload } from '@/lib/storage';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        organization: true,
      },
    });

    if (!user || !user.organization) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { client_ids } = body;

    if (!Array.isArray(client_ids) || client_ids.length === 0) {
      return Response.json({ error: 'client_ids array required' }, { status: 400 });
    }

    // Get regulatory document
    const document = await prisma.regulatoryDocument.findUnique({
      where: { id: params.id },
    });

    if (!document) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get base output
    const baseOutput = await prisma.documentOutput.findUnique({
      where: {
        regulatoryDocumentId_organizationId_isBaseOutput: {
          regulatoryDocumentId: document.id,
          organizationId: user.organization.id,
          isBaseOutput: true,
        },
      },
    });

    if (!baseOutput || baseOutput.status !== 'complete') {
      return Response.json(
        { error: 'Base memo must be generated first' },
        { status: 400 }
      );
    }

    // Get or regenerate base memo markdown
    // For now, we'll regenerate it - TODO: store markdown in database
    console.log(`[Generate Clients] Regenerating base memo for customization`);
    const baseMemoResult = await generateBaseMemo({
      document: {
        title: document.title,
        publicationDate: document.publicationDate || new Date(),
        documentType: document.documentType || undefined,
        citation: document.citation || undefined,
        abstract: document.abstract || undefined,
        pdfUrl: document.pdfUrl!,
      },
      organization: {
        name: user.organization.name,
        branding: user.organization.branding as any,
        modelConfig: user.organization.modelConfig as any,
      },
    });

    const baseMemoMarkdown = baseMemoResult.markdown;

    // Get selected clients
    const clients = await prisma.client.findMany({
      where: {
        id: { in: client_ids },
        organizationId: user.organization.id,
        isActive: true,
      },
    });

    if (clients.length === 0) {
      return Response.json({ error: 'No valid clients found' }, { status: 404 });
    }

    // Generate for each client
    const results = [];

    for (const client of clients) {
      try {
        console.log(`[Generate Clients] Generating memo for ${client.name}`);

        // Get or create client output
        let clientOutput = await prisma.clientOutput.findUnique({
          where: {
            documentOutputId_clientId: {
              documentOutputId: baseOutput.id,
              clientId: client.id,
            },
          },
        });

        if (!clientOutput) {
          clientOutput = await prisma.clientOutput.create({
            data: {
              documentOutputId: baseOutput.id,
              clientId: client.id,
              status: 'pending',
            },
          });
        }

        // Update to processing
        await prisma.clientOutput.update({
          where: { id: clientOutput.id },
          data: {
            status: 'processing',
            selectedForGeneration: true,
            selectedBy: user.id,
            selectedAt: new Date(),
            processingStartedAt: new Date(),
          },
        });

        // Generate customized memo using Haiku
        const clientMemoResult = await generateClientMemo({
          baseMemo: baseMemoMarkdown,
          document: {
            title: document.title,
            publicationDate: document.publicationDate || new Date(),
            documentType: document.documentType || undefined,
            citation: document.citation || undefined,
            abstract: document.abstract || undefined,
            pdfUrl: document.pdfUrl!,
          },
          organization: {
            name: user.organization.name,
            branding: user.organization.branding as any,
            modelConfig: user.organization.modelConfig as any,
          },
          client: {
            name: client.name,
            context: client.context,
            industry: client.industry || undefined,
            focusAreas: client.focusAreas || undefined,
          },
        });

        // Generate PDF
        const pdfBuffer = await generateMemoPDF({
          markdown: clientMemoResult.markdown,
          document: {
            title: document.title,
            publicationDate: document.publicationDate || new Date(),
            citation: document.citation || undefined,
            documentType: document.documentType || undefined,
          },
          branding: user.organization.branding as any,
          client: {
            name: client.name,
          },
        });

        // Save PDF
        const filename = `${document.externalId}_${client.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const outputPath = await saveUpload(user.id, filename, pdfBuffer);

        // Update client output
        await prisma.clientOutput.update({
          where: { id: clientOutput.id },
          data: {
            status: 'complete',
            outputPath,
            modelUsed: clientMemoResult.modelUsed,
            tokensInput: clientMemoResult.tokensInput,
            tokensOutput: clientMemoResult.tokensOutput,
            processingCompletedAt: new Date(),
          },
        });

        results.push({
          clientId: client.id,
          clientName: client.name,
          status: 'success',
          outputPath,
        });

      } catch (error: any) {
        console.error(`[Generate Clients] Error for ${client.name}:`, error);

        // Update to failed
        await prisma.clientOutput.updateMany({
          where: {
            documentOutputId: baseOutput.id,
            clientId: client.id,
          },
          data: {
            status: 'failed',
            errorMessage: error.message,
          },
        });

        results.push({
          clientId: client.id,
          clientName: client.name,
          status: 'error',
          error: error.message,
        });
      }
    }

    return Response.json({
      message: `Generated memos for ${results.filter(r => r.status === 'success').length} of ${clients.length} clients`,
      results,
    });

  } catch (error: any) {
    console.error('[Generate Clients API] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
