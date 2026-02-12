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

    // Get regulatory document
    const document = await prisma.regulatoryDocument.findUnique({
      where: { id: params.id },
      include: {
        agency: true,
      },
    });

    if (!document) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get or create document output
    let output = await prisma.documentOutput.findUnique({
      where: {
        regulatoryDocumentId_organizationId_isBaseOutput: {
          regulatoryDocumentId: document.id,
          organizationId: user.organization.id,
          isBaseOutput: true,
        },
      },
    });

    if (!output) {
      output = await prisma.documentOutput.create({
        data: {
          regulatoryDocumentId: document.id,
          organizationId: user.organization.id,
          outputType: user.organization.outputType,
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
    if (user.organization.outputType === 'memo_pdf') {
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
          name: user.organization.name,
          branding: user.organization.branding as any,
          modelConfig: user.organization.modelConfig as any,
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
        branding: user.organization.branding as any,
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

    } else {
      // PPTX generation - use existing conversion logic
      // TODO: Integrate with existing PPTX generation
      return Response.json({ error: 'PPTX generation not yet implemented in multi-tenant mode' }, { status: 501 });
    }

  } catch (error: any) {
    console.error('[Generate Base API] Error:', error);

    // Update output status to failed
    try {
      await prisma.documentOutput.update({
        where: { id: params.id },
        data: {
          status: 'failed',
          errorMessage: error.message,
        },
      });
    } catch (updateError) {
      console.error('[Generate Base API] Failed to update error status:', updateError);
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
}
