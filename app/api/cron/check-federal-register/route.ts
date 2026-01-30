/**
 * Federal Register Auto-Monitor Cron Endpoint
 *
 * This endpoint is triggered periodically to:
 * 1. Check Federal Register API for new CMS documents
 * 2. Track new documents in our database
 * 3. Download PDFs and queue for conversion
 */

import { prisma } from '@/lib/db';
import { saveUpload } from '@/lib/storage';
import { fetchFederalRegisterDocuments, downloadFederalRegisterPDF } from '@/lib/federal-register';

export async function POST(request: Request) {
  try {
    // 1. Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[FR Monitor] Poll started');

    // 2. Get settings
    const settings = await prisma.federalRegisterSettings.findFirst();

    if (!settings) {
      console.error('[FR Monitor] No settings found');
      return Response.json({ error: 'Settings not found' }, { status: 500 });
    }

    if (!settings.isEnabled) {
      console.log('[FR Monitor] Monitoring disabled');
      return Response.json({ message: 'Monitoring disabled' });
    }

    // 3. Determine how many documents to fetch
    const perPage = settings.initialized ? 20 : settings.initialDocumentCount;

    // 4. Fetch from Federal Register API
    console.log(`[FR Monitor] Fetching ${perPage} documents (initialized: ${settings.initialized})`);

    const response = await fetchFederalRegisterDocuments({
      agencySlugs: settings.agencySlugs,
      documentTypes: settings.documentTypes,
      onlySignificant: settings.onlySignificant,
      perPage,
    });

    const documents = response.results || [];
    console.log(`[FR Monitor] Found ${documents.length} documents`);

    // 5. Process each document
    let newCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        // Check if we already have this document
        const existing = await prisma.federalRegisterDocument.findUnique({
          where: { documentNumber: doc.document_number },
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        // Insert new document
        const newDoc = await prisma.federalRegisterDocument.create({
          data: {
            documentNumber: doc.document_number,
            citation: doc.citation,
            title: doc.title,
            documentType: doc.type,
            abstract: doc.abstract,
            publicationDate: new Date(doc.publication_date),
            pdfUrl: doc.pdf_url,
            htmlUrl: doc.html_url,
            isSignificant: doc.significant || false,
            agencies: doc.agencies as any,
            targetUserId: settings.defaultTargetUserId,
            autoProcess: settings.autoProcessNew,
            processingStatus: settings.autoProcessNew ? 'pending' : 'skipped',
          },
        });

        newCount++;
        console.log(`[FR Monitor] New document detected: ${doc.document_number}`);

        // If auto-processing, queue for download and conversion
        if (settings.autoProcessNew && newDoc) {
          await queueDocumentForProcessing(newDoc, settings);
        }
      } catch (error: any) {
        console.error(`[FR Monitor] Error processing document ${doc.document_number}:`, error);
        errors.push(`Error processing ${doc.document_number}: ${error.message}`);
      }
    }

    // 6. Update settings
    await prisma.federalRegisterSettings.update({
      where: { id: settings.id },
      data: {
        lastPollAt: new Date(),
        lastPollStatus: errors.length > 0 ? `partial success (${errors.length} errors)` : 'success',
        lastPollDocumentsFound: documents.length,
        initialized: true,
      },
    });

    console.log(`[FR Monitor] Poll complete: ${newCount} new, ${skippedCount} skipped, ${errors.length} errors`);

    return Response.json({
      success: true,
      documents_checked: documents.length,
      new_documents: newCount,
      skipped_existing: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[FR Monitor] Error:', error);

    // Try to update settings with error
    try {
      const settings = await prisma.federalRegisterSettings.findFirst();
      if (settings) {
        await prisma.federalRegisterSettings.update({
          where: { id: settings.id },
          data: {
            lastPollAt: new Date(),
            lastPollStatus: `error: ${error.message}`,
          },
        });
      }
    } catch (updateError) {
      console.error('[FR Monitor] Failed to update error status:', updateError);
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Queue a Federal Register document for processing
 */
async function queueDocumentForProcessing(
  frDoc: any,
  settings: any
): Promise<void> {
  try {
    console.log(`[FR Monitor] Processing document: ${frDoc.documentNumber}`);

    // Update status to downloading
    await prisma.federalRegisterDocument.update({
      where: { id: frDoc.id },
      data: { processingStatus: 'downloading' },
    });

    // Download PDF from Federal Register
    console.log(`[FR Monitor] Downloading PDF for ${frDoc.documentNumber}`);
    const pdfArrayBuffer = await downloadFederalRegisterPDF(frDoc.pdfUrl);
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    // Save to local storage
    const filename = `${frDoc.documentNumber}.pdf`;
    const targetUserId = frDoc.targetUserId || settings.defaultTargetUserId;

    console.log(`[FR Monitor] Saving PDF to local storage`);
    const storagePath = await saveUpload(targetUserId, filename, pdfBuffer);

    // Update FR doc with download timestamp
    await prisma.federalRegisterDocument.update({
      where: { id: frDoc.id },
      data: {
        pdfDownloadedAt: new Date(),
        processingStatus: 'queued',
      },
    });

    // Create conversion job
    console.log(`[FR Monitor] Creating conversion job for ${frDoc.documentNumber}`);
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

    console.log(`[FR Monitor] Created job ${job.id} for document ${frDoc.documentNumber}`);
  } catch (error: any) {
    console.error(`[FR Monitor] Error processing FR document ${frDoc.documentNumber}:`, error);

    await prisma.federalRegisterDocument.update({
      where: { id: frDoc.id },
      data: {
        processingStatus: 'failed',
        errorMessage: error.message,
      },
    });

    throw error;
  }
}
