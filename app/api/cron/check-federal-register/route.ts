/**
 * Federal Register Auto-Monitor Cron Endpoint
 *
 * This endpoint is triggered by Vercel Cron every 15 minutes to:
 * 1. Check Federal Register API for new CMS documents
 * 2. Track new documents in our database
 * 3. Download PDFs and queue for conversion
 */

import { createClient } from '@supabase/supabase-js';
import { fetchFederalRegisterDocuments, downloadFederalRegisterPDF } from '@/lib/federal-register';

export async function POST(request: Request) {
  try {
    // 1. Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('[FR Monitor] Poll started');

    // 2. Get settings
    const { data: settings, error: settingsError } = await supabase
      .from('federal_register_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      console.error('[FR Monitor] Failed to fetch settings:', settingsError);
      return Response.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    if (!settings.is_enabled) {
      console.log('[FR Monitor] Monitoring disabled');
      return Response.json({ message: 'Monitoring disabled' });
    }

    // 3. Determine how many documents to fetch
    const perPage = settings.initialized ? 20 : settings.initial_document_count;

    // 4. Fetch from Federal Register API
    console.log(`[FR Monitor] Fetching ${perPage} documents (initialized: ${settings.initialized})`);

    const response = await fetchFederalRegisterDocuments({
      agencySlugs: settings.agency_slugs,
      documentTypes: settings.document_types,
      onlySignificant: settings.only_significant,
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
        const { data: existing } = await supabase
          .from('federal_register_documents')
          .select('id')
          .eq('document_number', doc.document_number)
          .single();

        if (existing) {
          skippedCount++;
          continue;
        }

        // Insert new document
        const { data: newDoc, error: insertError } = await supabase
          .from('federal_register_documents')
          .insert({
            document_number: doc.document_number,
            citation: doc.citation,
            title: doc.title,
            document_type: doc.type,
            abstract: doc.abstract,
            publication_date: doc.publication_date,
            pdf_url: doc.pdf_url,
            html_url: doc.html_url,
            is_significant: doc.significant || false,
            agencies: doc.agencies,
            target_user_id: settings.default_target_user_id,
            auto_process: settings.auto_process_new,
            processing_status: settings.auto_process_new ? 'pending' : 'skipped',
          })
          .select()
          .single();

        if (insertError) {
          console.error('[FR Monitor] Error inserting document:', insertError);
          errors.push(`Failed to insert ${doc.document_number}: ${insertError.message}`);
          continue;
        }

        newCount++;
        console.log(`[FR Monitor] New document detected: ${doc.document_number}`);

        // If auto-processing, queue for download and conversion
        if (settings.auto_process_new && newDoc) {
          await queueDocumentForProcessing(supabase, newDoc, settings);
        }
      } catch (error: any) {
        console.error(`[FR Monitor] Error processing document ${doc.document_number}:`, error);
        errors.push(`Error processing ${doc.document_number}: ${error.message}`);
      }
    }

    // 6. Update settings
    await supabase
      .from('federal_register_settings')
      .update({
        last_poll_at: new Date().toISOString(),
        last_poll_status: errors.length > 0 ? `partial success (${errors.length} errors)` : 'success',
        last_poll_documents_found: documents.length,
        initialized: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id);

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
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: settings } = await supabase
        .from('federal_register_settings')
        .select('id')
        .single();

      if (settings) {
        await supabase
          .from('federal_register_settings')
          .update({
            last_poll_at: new Date().toISOString(),
            last_poll_status: `error: ${error.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settings.id);
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
  supabase: any,
  frDoc: any,
  settings: any
): Promise<void> {
  try {
    console.log(`[FR Monitor] Processing document: ${frDoc.document_number}`);

    // Update status to downloading
    await supabase
      .from('federal_register_documents')
      .update({ processing_status: 'downloading' })
      .eq('id', frDoc.id);

    // Download PDF from Federal Register
    console.log(`[FR Monitor] Downloading PDF for ${frDoc.document_number}`);
    const pdfBuffer = await downloadFederalRegisterPDF(frDoc.pdf_url);
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    // Generate filename
    const filename = `${frDoc.document_number}.pdf`;
    const storagePath = `${frDoc.target_user_id}/uploads/${Date.now()}_${filename}`;

    // Upload to Supabase Storage
    console.log(`[FR Monitor] Uploading PDF to storage: ${storagePath}`);
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(storagePath, pdfBlob, {
        contentType: 'application/pdf',
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Update FR doc with download timestamp
    await supabase
      .from('federal_register_documents')
      .update({
        pdf_downloaded_at: new Date().toISOString(),
        processing_status: 'queued',
      })
      .eq('id', frDoc.id);

    // Create conversion job (uses existing pipeline)
    console.log(`[FR Monitor] Creating conversion job for ${frDoc.document_number}`);
    const { data: job, error: jobError } = await supabase
      .from('conversion_jobs')
      .insert({
        user_id: frDoc.target_user_id,
        status: 'pending',
        input_filename: filename,
        input_path: storagePath,
        input_size_bytes: pdfBuffer.byteLength,
        // Add metadata to link back to FR document
        metadata: {
          source: 'federal_register',
          federal_register_id: frDoc.id,
          document_number: frDoc.document_number,
          citation: frDoc.citation,
        },
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Job creation failed: ${jobError.message}`);
    }

    // Link job to FR document
    await supabase
      .from('federal_register_documents')
      .update({
        conversion_job_id: job.id,
        processing_status: 'processing',
      })
      .eq('id', frDoc.id);

    console.log(`[FR Monitor] Created job ${job.id} for document ${frDoc.document_number}`);
  } catch (error: any) {
    console.error(`[FR Monitor] Error processing FR document ${frDoc.document_number}:`, error);

    await supabase
      .from('federal_register_documents')
      .update({
        processing_status: 'failed',
        error_message: error.message,
      })
      .eq('id', frDoc.id);

    throw error;
  }
}
