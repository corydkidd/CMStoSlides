import PptxGenJS from 'pptxgenjs';
import type { SlideData, Slide, SlideContent } from './claude-processor';

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const COLORS = {
  navy: '1B3A5C',
  teal: '0D7C8C',
  darkGray: '333333',
  lightGray: '666666',
  white: 'FFFFFF',
  background: 'FFFFFF',
} as const;

const FONTS = {
  heading: 'Calibri',
  body: 'Calibri',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addFooter(slide: PptxGenJS.Slide, citation?: string) {
  const footerText = citation
    ? `Source: CMS Federal Register ${citation}`
    : 'Source: CMS Federal Register';

  slide.addText(footerText, {
    x: 0.5,
    y: 7.0,
    w: 8.0,
    h: 0.3,
    fontSize: 8,
    fontFace: FONTS.body,
    color: COLORS.lightGray,
    align: 'left',
  });
}

function addSlideNumber(slide: PptxGenJS.Slide) {
  slide.addText(
    [{ text: '', options: { field: 'slidenum' } }],
    {
      x: 9.0,
      y: 7.0,
      w: 0.5,
      h: 0.3,
      fontSize: 8,
      fontFace: FONTS.body,
      color: COLORS.lightGray,
      align: 'right',
    }
  );
}

function getSpeakerNotes(content: SlideContent[]): string {
  return content
    .filter((c) => c.type === 'note')
    .map((c) => c.text)
    .join('\n');
}

function getBullets(content: SlideContent[]): SlideContent[] {
  return content.filter((c) => c.type === 'bullet' || c.type === 'paragraph');
}

function formatBulletsAsTextProps(
  items: SlideContent[]
): PptxGenJS.TextProps[] {
  return items.map((item) => {
    const level = item.level ?? 0;
    return {
      text: item.text,
      options: {
        fontSize: level === 0 ? 16 : 14,
        fontFace: FONTS.body,
        color: COLORS.darkGray,
        bullet: item.type === 'bullet' ? { indent: 14 } : false,
        indentLevel: level,
        paraSpaceAfter: 6,
        breakType: 'none' as const,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Slide builders
// ---------------------------------------------------------------------------

function buildTitleSlide(
  pptx: PptxGenJS,
  slideInfo: Slide,
  citation?: string
) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.navy };

  // Title
  slide.addText(slideInfo.title, {
    x: 0.8,
    y: 2.0,
    w: 8.4,
    h: 1.5,
    fontSize: 32,
    fontFace: FONTS.heading,
    color: COLORS.white,
    align: 'center',
    bold: true,
  });

  // Subtitle
  const subtitleParts: string[] = [];
  if (slideInfo.subtitle) subtitleParts.push(slideInfo.subtitle);
  // Also pull paragraph content items as subtitle lines
  const paragraphs = (slideInfo.content || []).filter(
    (c) => c.type === 'paragraph'
  );
  paragraphs.forEach((p) => subtitleParts.push(p.text));

  if (subtitleParts.length > 0) {
    slide.addText(subtitleParts.join('\n'), {
      x: 0.8,
      y: 3.6,
      w: 8.4,
      h: 1.2,
      fontSize: 18,
      fontFace: FONTS.body,
      color: COLORS.teal,
      align: 'center',
    });
  }

  // Accent line
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5,
    y: 3.35,
    w: 3.0,
    h: 0.04,
    fill: { color: COLORS.teal },
  });

  // Speaker notes
  const notes = getSpeakerNotes(slideInfo.content || []);
  if (notes) slide.addNotes(notes);

  return slide;
}

function buildSectionSlide(
  pptx: PptxGenJS,
  slideInfo: Slide,
  citation?: string
) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.navy };

  slide.addText(slideInfo.title, {
    x: 0.8,
    y: 2.5,
    w: 8.4,
    h: 1.5,
    fontSize: 28,
    fontFace: FONTS.heading,
    color: COLORS.white,
    align: 'center',
    bold: true,
  });

  // Accent line below title
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5,
    y: 4.1,
    w: 3.0,
    h: 0.04,
    fill: { color: COLORS.teal },
  });

  const notes = getSpeakerNotes(slideInfo.content || []);
  if (notes) slide.addNotes(notes);

  addSlideNumber(slide);
  return slide;
}

function buildContentSlide(
  pptx: PptxGenJS,
  slideInfo: Slide,
  citation?: string
) {
  const slide = pptx.addSlide();

  // Title
  slide.addText(slideInfo.title, {
    x: 0.5,
    y: 0.3,
    w: 9.0,
    h: 0.8,
    fontSize: 24,
    fontFace: FONTS.heading,
    color: COLORS.navy,
    bold: true,
  });

  // Accent line under title
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 1.05,
    w: 9.0,
    h: 0.03,
    fill: { color: COLORS.teal },
  });

  // Bullets
  const bullets = getBullets(slideInfo.content || []);
  if (bullets.length > 0) {
    slide.addText(formatBulletsAsTextProps(bullets), {
      x: 0.5,
      y: 1.3,
      w: 9.0,
      h: 5.5,
      valign: 'top',
    });
  }

  const notes = getSpeakerNotes(slideInfo.content || []);
  if (notes) slide.addNotes(notes);

  addFooter(slide, citation);
  addSlideNumber(slide);
  return slide;
}

function buildTwoColumnSlide(
  pptx: PptxGenJS,
  slideInfo: Slide,
  citation?: string
) {
  const slide = pptx.addSlide();

  // Title
  slide.addText(slideInfo.title, {
    x: 0.5,
    y: 0.3,
    w: 9.0,
    h: 0.8,
    fontSize: 24,
    fontFace: FONTS.heading,
    color: COLORS.navy,
    bold: true,
  });

  // Accent line
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 1.05,
    w: 9.0,
    h: 0.03,
    fill: { color: COLORS.teal },
  });

  // Left column
  const leftItems = slideInfo.left_column || getBullets((slideInfo.content || []).slice(0, Math.ceil((slideInfo.content || []).length / 2)));
  if (leftItems.length > 0) {
    slide.addText(formatBulletsAsTextProps(leftItems), {
      x: 0.5,
      y: 1.3,
      w: 4.2,
      h: 5.5,
      valign: 'top',
    });
  }

  // Vertical divider
  slide.addShape(pptx.ShapeType.rect, {
    x: 4.9,
    y: 1.5,
    w: 0.02,
    h: 4.5,
    fill: { color: COLORS.lightGray },
  });

  // Right column
  const rightItems = slideInfo.right_column || getBullets((slideInfo.content || []).slice(Math.ceil((slideInfo.content || []).length / 2)));
  if (rightItems.length > 0) {
    slide.addText(formatBulletsAsTextProps(rightItems), {
      x: 5.2,
      y: 1.3,
      w: 4.2,
      h: 5.5,
      valign: 'top',
    });
  }

  const notes = getSpeakerNotes(slideInfo.content || []);
  if (notes) slide.addNotes(notes);

  addFooter(slide, citation);
  addSlideNumber(slide);
  return slide;
}

function buildSummarySlide(
  pptx: PptxGenJS,
  slideInfo: Slide,
  citation?: string
) {
  const slide = pptx.addSlide();

  // Title with teal accent background strip at top
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 1.3,
    fill: { color: COLORS.navy },
  });

  slide.addText(slideInfo.title, {
    x: 0.5,
    y: 0.25,
    w: 9.0,
    h: 0.8,
    fontSize: 24,
    fontFace: FONTS.heading,
    color: COLORS.white,
    bold: true,
  });

  // Bullets
  const bullets = getBullets(slideInfo.content || []);
  if (bullets.length > 0) {
    slide.addText(formatBulletsAsTextProps(bullets), {
      x: 0.5,
      y: 1.6,
      w: 9.0,
      h: 5.0,
      valign: 'top',
    });
  }

  const notes = getSpeakerNotes(slideInfo.content || []);
  if (notes) slide.addNotes(notes);

  addFooter(slide, citation);
  addSlideNumber(slide);
  return slide;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export async function generatePPTX(slideData: SlideData): Promise<Buffer> {
  const pptx = new PptxGenJS();

  // Presentation metadata
  pptx.author = 'CMS Converter';
  pptx.title = slideData.metadata.document_title || 'CMS Document Presentation';
  pptx.subject = 'CMS Federal Register Analysis';
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 — standard widescreen

  const citation = slideData.metadata.citation;

  for (const slideInfo of slideData.slides) {
    switch (slideInfo.slide_type) {
      case 'title':
        buildTitleSlide(pptx, slideInfo, citation);
        break;
      case 'section':
        buildSectionSlide(pptx, slideInfo, citation);
        break;
      case 'content':
        buildContentSlide(pptx, slideInfo, citation);
        break;
      case 'two_column':
        buildTwoColumnSlide(pptx, slideInfo, citation);
        break;
      case 'summary':
        buildSummarySlide(pptx, slideInfo, citation);
        break;
      default:
        // Fallback to content slide for unknown types
        buildContentSlide(pptx, slideInfo, citation);
        break;
    }
  }

  // Generate as Node Buffer
  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}
