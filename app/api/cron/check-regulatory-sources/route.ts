/**
 * Unified Regulatory Sources Monitor - Multi-Tenant
 *
 * Checks all active agencies and routes to subscribed organizations:
 * - Federal Register API
 * - Agency Newsroom RSS feeds
 */

import { prisma } from '@/lib/db';
import { fetchFederalRegisterDocuments } from '@/lib/federal-register';

export async function POST(request: Request) {
  try {
    // 1. Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Regulatory Monitor] Poll started');

    // 2. Get all active agencies
    const agencies = await prisma.agency.findMany({
      where: { isActive: true },
      include: {
        organizationAgencies: {
          include: {
            organization: true,
          },
        },
      },
    });

    console.log(`[Regulatory Monitor] Found ${agencies.length} active agencies`);

    const stats = {
      agencies_checked: agencies.length,
      documents_detected: 0,
      organizations_notified: 0,
      errors: [] as string[],
    };

    // 3. For each agency, check both Federal Register and newsroom feeds
    for (const agency of agencies) {
      try {
        console.log(`[Regulatory Monitor] Checking ${agency.name} (${agency.id})`);

        // Check Federal Register
        const frDocuments = await checkFederalRegister(agency);
        console.log(`[Regulatory Monitor] ${agency.id}: Found ${frDocuments.length} FR documents`);
        stats.documents_detected += frDocuments.length;

        // TODO: Check newsroom feeds (task #2)
        // const newsroomDocuments = await checkNewsroomFeeds(agency);
        // stats.documents_detected += newsroomDocuments.length;

        // Route documents to subscribed organizations
        const orgsNotified = await routeDocumentsToOrganizations(agency, frDocuments);
        stats.organizations_notified += orgsNotified;

      } catch (error: any) {
        const errorMsg = `Error checking ${agency.id}: ${error.message}`;
        console.error(`[Regulatory Monitor] ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    console.log(`[Regulatory Monitor] Poll complete:`, stats);

    return Response.json({
      success: true,
      ...stats,
    });

  } catch (error: any) {
    console.error('[Regulatory Monitor] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Check Federal Register for a specific agency
 */
async function checkFederalRegister(agency: any): Promise<any[]> {
  try {
    // Fetch documents from Federal Register API
    const response = await fetchFederalRegisterDocuments({
      agencySlugs: [agency.federalRegisterSlug],
      documentTypes: agency.documentTypes,
      perPage: 20,
    });

    const documents = response.results || [];
    const newDocuments = [];

    // Process each document
    for (const doc of documents) {
      // Check if we already have this document
      const existing = await prisma.regulatoryDocument.findUnique({
        where: {
          source_externalId: {
            source: 'federal_register',
            externalId: doc.document_number,
          },
        },
      });

      if (existing) {
        continue; // Skip existing documents
      }

      // Create new regulatory document
      const newDoc = await prisma.regulatoryDocument.create({
        data: {
          source: 'federal_register',
          agencyId: agency.id,
          externalId: doc.document_number,
          title: doc.title,
          abstract: doc.abstract,
          publicationDate: new Date(doc.publication_date),
          sourceUrl: doc.html_url,
          pdfUrl: doc.pdf_url,
          citation: doc.citation,
          documentType: doc.type,
          isSignificant: doc.significant || false,
          detectedAt: new Date(),
        },
      });

      console.log(`[FR Check] New document: ${doc.document_number} - ${doc.title.substring(0, 60)}...`);
      newDocuments.push(newDoc);
    }

    return newDocuments;

  } catch (error: any) {
    console.error(`[FR Check] Error for ${agency.id}:`, error);
    throw error;
  }
}

/**
 * Route new documents to all subscribed organizations
 */
async function routeDocumentsToOrganizations(
  agency: any,
  documents: any[]
): Promise<number> {
  if (documents.length === 0) {
    return 0;
  }

  let orgCount = 0;

  // Get organizations subscribed to this agency
  const subscriptions = await prisma.organizationAgency.findMany({
    where: {
      agencyId: agency.id,
      federalRegisterEnabled: true,
    },
    include: {
      organization: {
        include: {
          clients: {
            where: { isActive: true },
          },
        },
      },
    },
  });

  console.log(`[Routing] ${documents.length} documents → ${subscriptions.length} organizations`);

  for (const subscription of subscriptions) {
    const org = subscription.organization;

    for (const doc of documents) {
      try {
        // Check if output already exists for this org+doc
        const existingOutput = await prisma.documentOutput.findUnique({
          where: {
            regulatoryDocumentId_organizationId_isBaseOutput: {
              regulatoryDocumentId: doc.id,
              organizationId: org.id,
              isBaseOutput: true,
            },
          },
        });

        if (existingOutput) {
          continue; // Already created
        }

        // Create base document output
        const output = await prisma.documentOutput.create({
          data: {
            regulatoryDocumentId: doc.id,
            organizationId: org.id,
            outputType: org.outputType,
            status: org.autoProcess ? 'pending' : 'awaiting_approval',
            isBaseOutput: true,
          },
        });

        console.log(`[Routing] Created output for ${org.name}: ${doc.title.substring(0, 40)}...`);

        // For organizations with client customization, create client output placeholders
        if (org.hasClients && org.clients && org.clients.length > 0) {
          const clientOutputs = org.clients.map((client: any) => ({
            documentOutputId: output.id,
            clientId: client.id,
            status: 'pending', // Awaiting user selection
          }));

          await prisma.clientOutput.createMany({
            data: clientOutputs,
            skipDuplicates: true,
          });

          console.log(`[Routing] Created ${clientOutputs.length} client output placeholders`);
        }

        orgCount++;

      } catch (error: any) {
        console.error(`[Routing] Error creating output for ${org.name}:`, error);
      }
    }
  }

  return orgCount;
}
