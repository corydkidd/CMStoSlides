import { prisma } from './db';
import { getFileBuffer, saveOutput } from './storage';
import { extractPDFText, cleanExtractedText } from './pdf-extract';
import { processWithClaude, DEFAULT_DESCRIPTION } from './claude-processor';
import { generatePPTX } from './pptx-generator';

// ---------------------------------------------------------------------------
// Main job processor
// ---------------------------------------------------------------------------

export async function processJob(jobId: string): Promise<void> {
  // 1. Claim job — set status to processing
  const job = await prisma.conversionJob.update({
    where: { id: jobId },
    data: {
      status: 'processing',
      processingStartedAt: new Date(),
    },
  });

  if (!job) {
    throw new Error(`Failed to claim job ${jobId}: not found`);
  }

  try {
    // 2. Read PDF from local storage
    console.log(`[job ${jobId}] Reading PDF from: ${job.inputPath}`);
    const pdfBuffer = await getFileBuffer(job.inputPath);

    // 3. Extract text from PDF
    console.log(`[job ${jobId}] Extracting text...`);
    const { text: rawText, numPages } = await extractPDFText(pdfBuffer);
    const cleanedText = cleanExtractedText(rawText);

    console.log(`[job ${jobId}] Extracted ${cleanedText.length} chars from ${numPages} pages`);

    // Store extracted text for debugging / reprocessing
    await prisma.conversionJob.update({
      where: { id: jobId },
      data: { extractedText: cleanedText },
    });

    // 4. Get description document for this user
    let descriptionContent = DEFAULT_DESCRIPTION;

    if (job.descriptionDocId) {
      const descDoc = await prisma.descriptionDocument.findUnique({
        where: { id: job.descriptionDocId },
      });
      if (descDoc?.content) {
        descriptionContent = descDoc.content;
      }
    } else {
      // Try to find the user's current description document
      const descDoc = await prisma.descriptionDocument.findFirst({
        where: {
          userId: job.userId,
          isCurrent: true,
        },
        orderBy: { version: 'desc' },
      });
      if (descDoc?.content) {
        descriptionContent = descDoc.content;
      }
    }

    // 5. Send to Claude for processing
    console.log(`[job ${jobId}] Sending to Claude...`);
    const slideData = await processWithClaude(cleanedText, descriptionContent);

    console.log(
      `[job ${jobId}] Claude returned ${slideData.slides.length} slides`
    );

    // 6. Generate PPTX
    console.log(`[job ${jobId}] Generating PPTX...`);
    const pptxBuffer = await generatePPTX(slideData);

    // 7. Save PPTX to local storage
    const baseName = job.inputFilename.replace(/\.pdf$/i, '');
    const outputFilename = `${baseName}_presentation.pptx`;

    console.log(`[job ${jobId}] Saving PPTX...`);
    const outputPath = await saveOutput(job.userId, outputFilename, pptxBuffer);

    // 8. Mark job as complete
    await prisma.conversionJob.update({
      where: { id: jobId },
      data: {
        status: 'complete',
        outputFilename,
        outputPath,
        outputSizeBytes: BigInt(pptxBuffer.length),
        processingCompletedAt: new Date(),
      },
    });

    console.log(`[job ${jobId}] Complete!`);
  } catch (err) {
    // Mark job as failed
    const message =
      err instanceof Error ? err.message : 'Unknown processing error';
    console.error(`[job ${jobId}] Failed:`, message);

    await prisma.conversionJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: message.slice(0, 2000),
        processingCompletedAt: new Date(),
      },
    });

    throw err;
  }
}
