/**
 * Federal Register Document Reprocess Endpoint
 *
 * Re-queue a failed or skipped document
 */

import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { downloadFederalRegisterPDF } from '@/lib/federal-register';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const documentId = params.id;

    // Get the document
    const { data: frDoc, error: fetchError } = await supabase
      .from('federal_register_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !frDoc) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    // Create service role client for processing
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get settings for target user
    const { data: settings } = await serviceSupabase
      .from('federal_register_settings')
      .select('*')
      .single();

    if (!settings) {
      return Response.json({ error: 'Settings not found' }, { status: 500 });
    }

    // Reset document status
    await serviceSupabase
      .from('federal_register_documents')
      .update({
        processing_status: 'pending',
        error_message: null,
        conversion_job_id: null,
      })
      .eq('id', documentId);

    // Process the document
    try {
      // Update status to downloading
      await serviceSupabase
        .from('federal_register_documents')
        .update({ processing_status: 'downloading' })
        .eq('id', frDoc.id);

      // Download PDF
      const pdfBuffer = await downloadFederalRegisterPDF(frDoc.pdf_url);
      const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

      // Generate filename
      const filename = `${frDoc.document_number}.pdf`;
      const storagePath = `${frDoc.target_user_id}/uploads/${Date.now()}_${filename}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await serviceSupabase.storage
        .from('uploads')
        .upload(storagePath, pdfBlob, {
          contentType: 'application/pdf',
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Update FR doc
      await serviceSupabase
        .from('federal_register_documents')
        .update({
          pdf_downloaded_at: new Date().toISOString(),
          processing_status: 'queued',
        })
        .eq('id', frDoc.id);

      // Create conversion job
      const { data: job, error: jobError } = await serviceSupabase
        .from('conversion_jobs')
        .insert({
          user_id: frDoc.target_user_id,
          status: 'pending',
          input_filename: filename,
          input_path: storagePath,
          input_size_bytes: pdfBuffer.byteLength,
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
      await serviceSupabase
        .from('federal_register_documents')
        .update({
          conversion_job_id: job.id,
          processing_status: 'processing',
        })
        .eq('id', frDoc.id);

      return Response.json({
        success: true,
        document: frDoc,
        job_id: job.id,
      });
    } catch (error: any) {
      await serviceSupabase
        .from('federal_register_documents')
        .update({
          processing_status: 'failed',
          error_message: error.message,
        })
        .eq('id', frDoc.id);

      throw error;
    }
  } catch (error: any) {
    console.error('[FR Reprocess] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
