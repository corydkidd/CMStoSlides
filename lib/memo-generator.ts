/**
 * Memo Generation System - Two-Model Architecture
 *
 * Base memos: Claude Opus 4.5 (~$0.22 per doc)
 * Client customization: Claude Haiku 4.5 (~$0.02 per client)
 */

import Anthropic from '@anthropic-ai/sdk';
import { extractPDFText, cleanExtractedText } from './pdf-extract';
import { downloadFederalRegisterPDF } from './federal-register';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface MemoGenerationOptions {
  document: {
    title: string;
    publicationDate: Date | string;
    documentType?: string;
    citation?: string;
    abstract?: string;
    pdfUrl: string;
    sourceUrl?: string;
  };
  organization: {
    name: string;
    branding?: {
      company_name?: string;
      tagline?: string;
    };
    modelConfig?: {
      base_model?: string;
      customization_model?: string;
    };
  };
}

interface ClientCustomizationOptions extends MemoGenerationOptions {
  baseMemo: string;
  client: {
    name: string;
    context: string;
    industry?: string;
    focusAreas?: string[];
  };
}

interface MemoGenerationResult {
  markdown: string;
  tokensInput: number;
  tokensOutput: number;
  modelUsed: string;
}

/**
 * Generate base regulatory memo using Claude Opus
 * This creates a comprehensive analysis for the organization
 */
export async function generateBaseMemo(
  options: MemoGenerationOptions
): Promise<MemoGenerationResult> {
  const { document, organization } = options;

  console.log(`[Memo Gen] Downloading PDF: ${document.pdfUrl}`);

  // Download and extract PDF text
  const pdfBuffer = await downloadPDF(document.pdfUrl);
  const { text: rawText } = await extractPDFText(pdfBuffer);
  const documentText = cleanExtractedText(rawText);

  console.log(`[Memo Gen] Extracted ${documentText.length} characters from PDF`);

  // Use Opus for comprehensive analysis
  const model = organization.modelConfig?.base_model || 'claude-opus-4-5-20251101';
  const companyName = organization.branding?.company_name || organization.name;

  const systemPrompt = `You are a regulatory affairs expert creating executive briefing memos for ${companyName}.

Your memos should be:
- Clear and actionable for senior healthcare executives
- Focused on business implications and strategic considerations
- Written in professional but accessible language
- Structured with clear sections for easy scanning
- Comprehensive but concise (aim for 2-3 pages when printed)

Output format: Markdown that will be converted to a branded PDF.`;

  const publicationDate = typeof document.publicationDate === 'string'
    ? document.publicationDate
    : document.publicationDate.toISOString().split('T')[0];

  const userPrompt = `Analyze the following regulatory document and create an executive briefing memo.

DOCUMENT METADATA:
Title: ${document.title}
Publication Date: ${publicationDate}
${document.documentType ? `Document Type: ${document.documentType}` : ''}
${document.citation ? `Citation: ${document.citation}` : ''}
${document.abstract ? `\nAbstract:\n${document.abstract}\n` : ''}

FULL DOCUMENT TEXT:
${documentText}

---

Create a comprehensive regulatory briefing memo with the following sections:

## Executive Summary
2-3 sentences capturing the most critical information. What changed, who's affected, and what actions are needed.

## Key Changes and Announcements
Clear bullet points covering:
- What is new or different
- What is being proposed, finalized, or announced
- Key dates and deadlines

## Who Is Affected
Identify stakeholders and affected parties:
- Healthcare providers, payers, manufacturers, etc.
- Specific types of organizations or programs
- Geographic or operational scope

## Timeline and Effective Dates
Critical dates presented clearly:
- Comment periods
- Implementation deadlines
- Compliance dates
- Phase-in schedules

## Business Implications
Strategic analysis of:
- Operational impacts
- Financial considerations
- Competitive landscape changes
- Risk factors
- Opportunities

## Recommended Actions
Specific, actionable next steps:
- Immediate actions required
- Medium-term planning needs
- Stakeholders to engage
- Resources needed

## Questions to Consider
Thought-provoking questions for leadership discussion:
- Strategic decisions to make
- Areas requiring deeper analysis
- Potential scenarios to plan for

---

Important:
- Use clear headings (##) for each section
- Use bullet points for readability
- Bold key terms and dates
- Keep language professional but accessible
- Focus on "so what" not just "what"`;

  console.log(`[Memo Gen] Calling Claude ${model}...`);

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4000,
    temperature: 0.3, // Lower temperature for factual analysis
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const markdown = response.content[0].type === 'text' ? response.content[0].text : '';

  console.log(`[Memo Gen] Generated ${markdown.length} character memo`);
  console.log(`[Memo Gen] Tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);

  return {
    markdown,
    tokensInput: response.usage.input_tokens,
    tokensOutput: response.usage.output_tokens,
    modelUsed: model,
  };
}

/**
 * Customize a base memo for a specific client using Claude Haiku
 * This tailors the analysis to the client's specific situation
 */
export async function generateClientMemo(
  options: ClientCustomizationOptions
): Promise<MemoGenerationResult> {
  const { baseMemo, client, document, organization } = options;

  // Use Haiku for cost-effective customization
  const model = organization.modelConfig?.customization_model || 'claude-haiku-4-5-20251001';

  const systemPrompt = `You are customizing a regulatory briefing memo for a specific client.

Your task is to:
- Maintain the structure and all key information from the base memo
- Tailor the analysis and implications to this specific client's situation
- Highlight aspects most relevant to their business and concerns
- Adjust recommendations to be client-specific
- Keep the same professional tone and format

Do NOT:
- Remove important information from the base memo
- Change factual content or dates
- Make assumptions beyond what's provided in the client context`;

  const focusAreasText = client.focusAreas?.length
    ? `\nFocus Areas: ${client.focusAreas.join(', ')}`
    : '';

  const userPrompt = `Here is a regulatory briefing memo:

---
${baseMemo}
---

Customize this memo for the following client:

CLIENT: ${client.name}
${client.industry ? `INDUSTRY: ${client.industry}` : ''}${focusAreasText}

CLIENT CONTEXT:
${client.context}

---

Rewrite the memo to be specifically relevant to ${client.name}:

1. **Executive Summary**: Frame the key points through the lens of this client's situation

2. **Who Is Affected**: Explicitly call out how this client is affected (e.g., "As a biotech company focused on CAR-T therapies, ${client.name} is directly impacted by...")

3. **Business Implications**: Tailor each implication to this client's specific business model, development pipeline, or operational focus

4. **Recommended Actions**: Make recommendations specific to their situation, referencing their focus areas where relevant

5. **Questions to Consider**: Frame questions that are directly relevant to their strategic decisions

Throughout the memo:
- Use the client's name naturally where it makes sense
- Reference their specific focus areas when relevant
- Connect the regulatory changes to their known priorities
- Make it feel personalized, not generic

Maintain all structure, headings, and factual accuracy from the original.`;

  console.log(`[Client Memo] Customizing for ${client.name} using ${model}...`);

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4000,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const markdown = response.content[0].type === 'text' ? response.content[0].text : '';

  console.log(`[Client Memo] Generated ${markdown.length} character customized memo`);
  console.log(`[Client Memo] Tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);

  return {
    markdown,
    tokensInput: response.usage.input_tokens,
    tokensOutput: response.usage.output_tokens,
    modelUsed: model,
  };
}

/**
 * Download PDF from URL (handles both Federal Register and other sources)
 */
async function downloadPDF(url: string): Promise<Buffer> {
  // Check if it's a Federal Register PDF (use specialized downloader)
  if (url.includes('federalregister.gov')) {
    const arrayBuffer = await downloadFederalRegisterPDF(url);
    return Buffer.from(arrayBuffer);
  }

  // Generic PDF download
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Estimate cost for memo generation
 */
export function estimateMemoGenerationCost(
  clientCount: number = 0
): { baseCost: number; clientCost: number; total: number } {
  // Rough estimates based on typical usage
  // Base memo (Opus): ~50K input, ~1.5K output = ~$0.22
  const baseCost = 0.22;

  // Client customization (Haiku): ~4K input (memo), ~1.5K output = ~$0.02
  const clientCost = clientCount * 0.02;

  return {
    baseCost,
    clientCost,
    total: baseCost + clientCost,
  };
}
