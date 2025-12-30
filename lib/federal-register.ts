/**
 * Federal Register API Client Utilities
 *
 * Documentation: https://www.federalregister.gov/developers/api/v1
 */

const FEDERAL_REGISTER_API = 'https://www.federalregister.gov/api/v1';

export interface FederalRegisterDocument {
  document_number: string;
  citation: string;
  title: string;
  type: 'RULE' | 'PRORULE' | 'NOTICE' | 'PRESDOCU';
  abstract: string;
  publication_date: string;
  pdf_url: string;
  html_url: string;
  significant: boolean;
  agencies: Array<{
    name: string;
    slug: string;
    parent_id: number;
  }>;
}

export interface FederalRegisterResponse {
  count: number;
  results: FederalRegisterDocument[];
  next_page_url: string | null;
  previous_page_url: string | null;
}

export interface FetchDocumentsOptions {
  agencySlugs?: string[];
  documentTypes?: string[];
  onlySignificant?: boolean;
  perPage?: number;
  page?: number;
  publicationDateGte?: string;
  publicationDateLte?: string;
}

/**
 * Fetch documents from the Federal Register API
 */
export async function fetchFederalRegisterDocuments(
  options: FetchDocumentsOptions = {}
): Promise<FederalRegisterResponse> {
  const {
    agencySlugs = ['centers-for-medicare-medicaid-services'],
    documentTypes = ['RULE', 'PRORULE', 'NOTICE'],
    onlySignificant = false,
    perPage = 20,
    page = 1,
    publicationDateGte,
    publicationDateLte,
  } = options;

  // Build query parameters
  const params = new URLSearchParams();

  // Agency filters
  for (const agency of agencySlugs) {
    params.append('conditions[agencies][]', agency);
  }

  // Document type filters
  for (const docType of documentTypes) {
    params.append('conditions[type][]', docType);
  }

  // Significance filter
  if (onlySignificant) {
    params.append('conditions[significant]', '1');
  }

  // Date range filters
  if (publicationDateGte) {
    params.append('conditions[publication_date][gte]', publicationDateGte);
  }
  if (publicationDateLte) {
    params.append('conditions[publication_date][lte]', publicationDateLte);
  }

  // Pagination
  params.append('order', 'newest');
  params.append('per_page', perPage.toString());
  params.append('page', page.toString());

  // Fields to return
  const fields = [
    'document_number',
    'title',
    'type',
    'abstract',
    'publication_date',
    'pdf_url',
    'html_url',
    'citation',
    'significant',
    'agencies',
  ];
  for (const field of fields) {
    params.append('fields[]', field);
  }

  // Fetch from API
  const response = await fetch(`${FEDERAL_REGISTER_API}/documents.json?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Federal Register API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Download a PDF from the Federal Register
 */
export async function downloadFederalRegisterPDF(pdfUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(pdfUrl);

  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
  }

  return response.arrayBuffer();
}

/**
 * Get the most recent CMS documents for initial backfill
 */
export async function getRecentCMSDocuments(count: number = 5): Promise<FederalRegisterDocument[]> {
  const response = await fetchFederalRegisterDocuments({
    agencySlugs: ['centers-for-medicare-medicaid-services'],
    documentTypes: ['RULE', 'PRORULE', 'NOTICE'],
    perPage: count,
  });

  return response.results;
}

/**
 * Check for new CMS documents since a given date
 */
export async function getNewCMSDocumentsSince(
  sinceDate: string,
  documentTypes: string[] = ['RULE', 'PRORULE', 'NOTICE']
): Promise<FederalRegisterDocument[]> {
  const response = await fetchFederalRegisterDocuments({
    agencySlugs: ['centers-for-medicare-medicaid-services'],
    documentTypes,
    publicationDateGte: sinceDate,
    perPage: 100, // Fetch more to ensure we get all new ones
  });

  return response.results;
}
