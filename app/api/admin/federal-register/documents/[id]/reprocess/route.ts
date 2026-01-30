/**
 * Federal Register Document Reprocess Endpoint
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { saveUpload } from '@/lib/storage';
import { downloadFederalRegisterPDF } from '@/lib/federal-register';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authentikId = (session.user as any).authentikId;
    const dbUser = await prisma.user.findUnique({ where: { authentikId } });

    if (!dbUser?.isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the document
    const frDoc = await prisma.federalRegisterDocument.findUnique({
      where: { id: documentId },
    });

    if (!frDoc) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get settings for target user
    const settings = await prisma.federalRegisterSettings.findFirst();
    if (!settings) {
      return Response.json({ error: 'Settings not found' }, { status: 500 });
    }

    // Reset document status
    await prisma.federalRegisterDocument.update({
      where: { id: documentId },
      data: {
        processingStatus: 'pending',
        errorMessage: null,
        conversionJobId: null,
      },
    });

    // Process the document
    try {
      // Update status to downloading
      await prisma.federalRegisterDocument.update({
        where: { id: frDoc.id },
        data: { processingStatus: 'downloading' },
      });

      // Download PDF
      const pdfArrayBuffer = await downloadFederalRegisterPDF(frDoc.pdfUrl);
      const pdfBuffer = Buffer.from(pdfArrayBuffer);

      // Save to local storage
      const filename = `${frDoc.documentNumber}.pdf`;
      const targetUserId = frDoc.targetUserId || settings.defaultTargetUserId;

      if (!targetUserId) {
        throw new Error('No target user configured');
      }

      const storagePath = await saveUpload(targetUserId, filename, pdfBuffer);

      // Update FR doc
      await prisma.federalRegisterDocument.update({
        where: { id: frDoc.id },
        data: {
          pdfDownloadedAt: new Date(),
          processingStatus: 'queued',
        },
      });

      // Create conversion job
      const job = await prisma.conversionJob.create({
        data: {
          userId: targetUserId,
          status: 'pending',
          inputFilename: filename,
          inputPath: storagePath,
          inputSizeBytes: BigInt(pdfBuffer.byteLength),
          metadata: {
            source: 'federal_register',
            federal_register_id: frDoc.id,
            document_number: frDoc.documentNumber,
            citation: frDoc.citation,
          },
        },
      });

      // Link job to FR document
      await prisma.federalRegisterDocument.update({
        where: { id: frDoc.id },
        data: {
          conversionJobId: job.id,
          processingStatus: 'processing',
        },
      });

      return Response.json({
        success: true,
        document: frDoc,
        job_id: job.id,
      });
    } catch (error: any) {
      await prisma.federalRegisterDocument.update({
        where: { id: frDoc.id },
        data: {
          processingStatus: 'failed',
          errorMessage: error.message,
        },
      });
      throw error;
    }
  } catch (error: any) {
    console.error('[FR Reprocess] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
