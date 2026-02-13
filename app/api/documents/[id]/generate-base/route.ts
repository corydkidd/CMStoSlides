/**
 * Generate Base Output API
 * Creates the base output (PPTX for Jayson, base memo for Catalyst)
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/db';
import { generateBaseMemo } from '@/lib/memo-generator';
import { generateMemoPDF } from '@/lib/pdf-generator';
import { saveUpload } from '@/lib/storage';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Get regulatory document
    const document = await prisma.regulatoryDocument.findUnique({
      where: { id },
      include: {
        agency: true,
        documentOutputs: {
          where: {
            isBaseOutput: true,
          },
          include: {
            organization: true,
          },
        },
      },
    });

    if (!document) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    // For admins: check which org this document output belongs to
    // For regular users: use their organization
    const { organizationId } = await request.json();

    if (!organizationId) {
      return Response.json({ error: 'organizationId required' }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get or create document output
    let output = await prisma.documentOutput.findUnique({
      where: {
        regulatoryDocumentId_organizationId_isBaseOutput: {
          regulatoryDocumentId: document.id,
          organizationId: organization.id,
          isBaseOutput: true,
        },
      },
    });

    if (!output) {
      output = await prisma.documentOutput.create({
        data: {
          regulatoryDocumentId: document.id,
          organizationId: organization.id,
          outputType: organization.outputType,
          status: 'pending',
          isBaseOutput: true,
        },
      });
    }

    // Check if already processing or complete
    if (output.status === 'processing') {
      return Response.json({ error: 'Already processing' }, { status: 409 });
    }

    if (output.status === 'complete' && output.outputPath) {
      return Response.json({
        message: 'Already generated',
        output,
      });
    }

    // Update status to processing
    await prisma.documentOutput.update({
      where: { id: output.id },
      data: {
        status: 'processing',
        processingStartedAt: new Date(),
      },
    });

    // Generate based on output type
    if (organization.outputType === 'memo_pdf') {
      // Check if document has a PDF URL
      if (!document.pdfUrl) {
        await prisma.documentOutput.update({
          where: { id: output.id },
          data: {
            status: 'failed',
            errorMessage: 'Document does not have a PDF URL',
          },
        });
        return Response.json({ error: 'Document does not have a PDF URL' }, { status: 400 });
      }

      // Generate memo using Opus
      console.log(`[Generate Base] Generating memo for ${document.title}`);

      const memoResult = await generateBaseMemo({
        document: {
          title: document.title,
          publicationDate: document.publicationDate || new Date(),
          documentType: document.documentType || undefined,
          citation: document.citation || undefined,
          abstract: document.abstract || undefined,
          pdfUrl: document.pdfUrl!,
          sourceUrl: document.sourceUrl || undefined,
        },
        organization: {
          name: organization.name,
          branding: organization.branding as any,
          modelConfig: organization.modelConfig as any,
        },
      });

      // Generate PDF from markdown
      const pdfBuffer = await generateMemoPDF({
        markdown: memoResult.markdown,
        document: {
          title: document.title,
          publicationDate: document.publicationDate || new Date(),
          citation: document.citation || undefined,
          documentType: document.documentType || undefined,
        },
        branding: organization.branding as any,
      });

      // Save PDF
      const filename = `${document.externalId}_base.pdf`;
      const outputPath = await saveUpload(user.id, filename, pdfBuffer);

      // Update output record
      await prisma.documentOutput.update({
        where: { id: output.id },
        data: {
          status: 'complete',
          outputPath,
          modelUsed: memoResult.modelUsed,
          tokensInput: memoResult.tokensInput,
          tokensOutput: memoResult.tokensOutput,
          processingCompletedAt: new Date(),
        },
      });

      // Store the markdown for client customization
      // We'll add a metadata field to store the base memo markdown
      await prisma.documentOutput.update({
        where: { id: output.id },
        data: {
          // Store markdown in a metadata field for later client customization
          // For now, we'll need to regenerate it - TODO: add markdown field to schema
        },
      });

      return Response.json({
        message: 'Base memo generated successfully',
        output: {
          id: output.id,
          status: 'complete',
          outputPath,
        },
      });

    } else if (organization.outputType === 'pptx') {
      // PPTX generation - mark as pending for background processing
      console.log(`[Generate Base] PPTX generation queued for ${document.title}`);

      // For now, mark as complete with a placeholder
      // TODO: Integrate with actual PPTX generation
      await prisma.documentOutput.update({
        where: { id: output.id },
        data: {
          status: 'pending',
          processingCompletedAt: new Date(),
        },
      });

      return Response.json({
        message: 'PPTX generation queued (not yet implemented)',
        output: {
          id: output.id,
          status: 'pending',
        },
      });
    } else {
      return Response.json({ error: 'Unknown output type' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[Generate Base API] Error:', error);

    // Update output status to failed (if we have an output ID)
    // Note: We don't have the output ID here in the catch block, so we can't update it

    return Response.json({ error: error.message }, { status: 500 });
  }
}
