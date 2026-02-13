/**
 * Download Document Output API
 * Serves generated PDFs and PPTX files
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the document output
    const output = await prisma.documentOutput.findUnique({
      where: { id },
      include: {
        organization: true,
        regulatoryDocument: true,
      },
    });

    if (!output) {
      return Response.json({ error: 'Output not found' }, { status: 404 });
    }

    if (!output.outputPath) {
      return Response.json({ error: 'Output file not generated yet' }, { status: 404 });
    }

    // Construct the full file path
    const filePath = path.join('/app/data', output.outputPath);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return Response.json({ error: 'Output file not found on disk' }, { status: 404 });
    }

    // Read the file
    const fileBuffer = await fs.readFile(filePath);

    // Determine content type based on output type
    const contentType = output.outputType === 'memo_pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    // Determine filename
    const ext = output.outputType === 'memo_pdf' ? 'pdf' : 'pptx';
    const filename = `${output.regulatoryDocument.externalId}_base.${ext}`;

    // Return the file
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('[Download Output API] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
