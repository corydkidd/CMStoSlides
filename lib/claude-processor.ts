import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlideContent {
  type: 'bullet' | 'paragraph' | 'note';
  text: string;
  level?: number; // 0 = top-level, 1 = sub-bullet, etc.
}

export interface Slide {
  slide_type: 'title' | 'content' | 'section' | 'two_column' | 'summary';
  title: string;
  subtitle?: string;
  content: SlideContent[];
  left_column?: SlideContent[];  // for two_column
  right_column?: SlideContent[]; // for two_column
}

export interface SlideMetadata {
  document_title: string;
  citation?: string;
  publication_date?: string;
  comment_deadline?: string;
  key_topics: string[];
}

export interface SlideData {
  slides: Slide[];
  metadata: SlideMetadata;
}

// ---------------------------------------------------------------------------
// Default description document (Jayson's transformation rules)
// ---------------------------------------------------------------------------

export const DEFAULT_DESCRIPTION = `# CMS Document Transformation Rules

## Overview
Transform CMS Federal Register publications into executive summary presentations
for healthcare provider clients. Focus on actionable impacts, compliance deadlines,
and financial implications.

## Slide Structure

### Title Slide
- Use the official rule name as title
- Include Federal Register citation (Vol/No)
- Add publication date

### Executive Summary (1-2 slides)
- 3-5 key takeaways for healthcare executives
- Focus on "what this means for your organization"

### Timeline & Deadlines
- Extract all dates mentioned in the document
- Create a visual timeline if 3+ dates
- Highlight compliance deadlines in red

### Financial Impact
- Pull any dollar figures, percentages, or payment changes
- Present in clear bullet format
- Include comparison to current state when available

### Required Actions
- List specific compliance steps required
- Prioritize by deadline
- Group by department (Clinical, Finance, IT, etc.)

### Questions for Discussion
- Generate 3-5 strategic questions for client discussion
- Focus on organizational impact and decision points

## Formatting Preferences
- Maximum 6 bullets per slide
- Avoid jargon - translate CMS terminology
- Use direct quotes sparingly, only for critical regulatory language
- Include slide numbers
- Add "Source: CMS Federal Register [citation]" as footnote`;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a regulatory document analyst and presentation specialist. Your task is to transform CMS (Centers for Medicare & Medicaid Services) Federal Register proposed rules and final rules into structured PowerPoint presentations.

You will receive:
1. The full extracted text of a Federal Register document
2. A "description document" with specific transformation rules and style preferences

Your output MUST be valid JSON with EXACTLY this structure — no markdown fences, no commentary, just the JSON object:

{
  "slides": [
    {
      "slide_type": "title" | "content" | "section" | "two_column" | "summary",
      "title": "Slide title",
      "subtitle": "Optional subtitle (for title slides)",
      "content": [
        {"type": "bullet", "text": "Bullet point text", "level": 0},
        {"type": "bullet", "text": "Sub-bullet text", "level": 1},
        {"type": "paragraph", "text": "Full paragraph text"},
        {"type": "note", "text": "Speaker note (not displayed on slide)"}
      ],
      "left_column": [...],   // Only for two_column slides
      "right_column": [...]   // Only for two_column slides
    }
  ],
  "metadata": {
    "document_title": "Official document title",
    "citation": "Federal Register citation (e.g., 90 FR 12345)",
    "publication_date": "Publication date",
    "comment_deadline": "Comment deadline if applicable",
    "key_topics": ["topic1", "topic2"]
  }
}

## Slide Type Guidelines

- **title**: First slide. Document name as title, citation + date as subtitle. Add speaker note with brief overview.
- **section**: Divider slide to separate major topic areas. Title only, no bullets.
- **content**: Standard slide with bullets. Max 6 bullets. Use level 0 for main points, level 1 for sub-points.
- **two_column**: Use for before/after comparisons (current vs proposed). Provide left_column and right_column arrays.
- **summary**: Final slide(s). Key takeaways, action items, or next steps.

## Quality Standards

- Be comprehensive but concise — aim for 15-40 slides depending on document length
- Every bullet should be actionable or informative, not filler
- Translate regulatory jargon into plain business language
- Preserve critical regulatory language in quotes when precision matters
- Include ALL dates, deadlines, and financial figures from the document
- Group related content logically with section dividers`;

// ---------------------------------------------------------------------------
// Main processing function
// ---------------------------------------------------------------------------

const anthropic = new Anthropic();

export async function processWithClaude(
  text: string,
  descriptionDoc: string
): Promise<SlideData> {
  // Truncate very large documents to fit within context window
  // Claude claude-sonnet-4-20250514 has 200k context; leave room for system prompt + output
  const maxTextLength = 180_000;
  const truncatedText =
    text.length > maxTextLength
      ? text.slice(0, maxTextLength) + '\n\n[Document truncated due to length]'
      : text;

  const userMessage = `## Transformation Instructions

${descriptionDoc}

---

## Document Text

${truncatedText}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  // Extract text content from response
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  // Parse JSON - strip markdown fences if present
  let jsonStr = textBlock.text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let slideData: SlideData;
  try {
    slideData = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(
      `Failed to parse Claude response as JSON: ${(e as Error).message}\n\nRaw response (first 500 chars): ${jsonStr.slice(0, 500)}`
    );
  }

  // Basic validation
  if (!slideData.slides || !Array.isArray(slideData.slides)) {
    throw new Error('Claude response missing slides array');
  }
  if (!slideData.metadata) {
    throw new Error('Claude response missing metadata');
  }

  return slideData;
}
