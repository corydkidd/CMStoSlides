import { createClient } from '@supabase/supabase-js';
import { extractPDFText, cleanExtractedText } from './pdf-extract';
import { processWithClaude, DEFAULT_DESCRIPTION } from './claude-processor';
import { generatePPTX } from './pptx-generator';

// ---------------------------------------------------------------------------
// Supabase admin client (service role — bypasses RLS)
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Main job processor
// ---------------------------------------------------------------------------

export async function processJob(jobId: string): Promise<void> {
  const supabase = getAdminClient();

  // 1. Claim job — set status to processing
  const { data: job, error: claimError } = await supabase
    .from('conversion_jobs')
    .update({
      status: 'processing',
      processing_started_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select('*')
    .single();

  if (claimError || !job) {
    throw new Error(`Failed to claim job ${jobId}: ${claimError?.message ?? 'not found'}`);
  }

  try {
    // 2. Download PDF from Supabase Storage
    console.log(`[job ${jobId}] Downloading PDF from: ${job.input_path}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(job.input_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download PDF: ${downloadError?.message ?? 'empty file'}`);
    }

    const pdfBuffer = Buffer.from(await fileData.arrayBuffer());

    // 3. Extract text from PDF
    console.log(`[job ${jobId}] Extracting text...`);
    const { text: rawText, numPages, metadata: pdfMeta } = await extractPDFText(pdfBuffer);
    const cleanedText = cleanExtractedText(rawText);

    console.log(`[job ${jobId}] Extracted ${cleanedText.length} chars from ${numPages} pages`);

    // Store extracted text for debugging / reprocessing
    await supabase
      .from('conversion_jobs')
      .update({ extracted_text: cleanedText })
      .eq('id', jobId);

    // 4. Get description document for this user
    let descriptionContent = DEFAULT_DESCRIPTION;

    if (job.description_doc_id) {
      const { data: descDoc } = await supabase
        .from('description_documents')
        .select('content')
        .eq('id', job.description_doc_id)
        .single();

      if (descDoc?.content) {
        descriptionContent = descDoc.content;
      }
    } else {
      // Try to find the user's current description document
      const { data: descDoc } = await supabase
        .from('description_documents')
        .select('content')
        .eq('user_id', job.user_id)
        .eq('is_current', true)
        .order('version', { ascending: false })
        .limit(1)
        .single();

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

    // 7. Upload PPTX to Supabase Storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = job.input_filename.replace(/\.pdf$/i, '');
    const outputFilename = `${baseName}_presentation.pptx`;
    const outputPath = `${job.user_id}/${timestamp}_${outputFilename}`;

    console.log(`[job ${jobId}] Uploading PPTX to: ${outputPath}`);
    const { error: uploadError } = await supabase.storage
      .from('outputs')
      .upload(outputPath, pptxBuffer, {
        contentType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload PPTX: ${uploadError.message}`);
    }

    // 8. Mark job as complete
    await supabase
      .from('conversion_jobs')
      .update({
        status: 'complete',
        output_filename: outputFilename,
        output_path: outputPath,
        output_size_bytes: pptxBuffer.length,
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log(`[job ${jobId}] Complete!`);
  } catch (err) {
    // Mark job as failed
    const message =
      err instanceof Error ? err.message : 'Unknown processing error';
    console.error(`[job ${jobId}] Failed:`, message);

    await supabase
      .from('conversion_jobs')
      .update({
        status: 'failed',
        error_message: message.slice(0, 2000), // truncate very long errors
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    throw err; // re-throw so caller knows it failed
  }
}
