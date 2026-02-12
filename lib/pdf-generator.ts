/**
 * Branded PDF Memo Generator
 *
 * Converts markdown memos to branded PDFs using @react-pdf/renderer
 */

import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer';
import { marked } from 'marked';

interface PdfGenerationOptions {
  markdown: string;
  document: {
    title: string;
    publicationDate: Date | string;
    citation?: string;
    documentType?: string;
  };
  branding: {
    company_name: string;
    tagline?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
  };
  client?: {
    name: string;
  };
}

/**
 * Generate a branded PDF from a markdown memo
 */
export async function generateMemoPDF(options: PdfGenerationOptions): Promise<Buffer> {
  const { markdown, document, branding, client } = options;

  // Parse markdown to extract sections
  const sections = parseMarkdownSections(markdown);

  // Create PDF document
  const MyDocument = React.createElement(
    Document,
    {},
    React.createElement(MemoPage, { sections, document, branding, client })
  );

  const pdfStream = await pdf(MyDocument).toBuffer();
  return pdfStream;
}

/**
 * Memo page component
 */
function MemoPage({ sections, document, branding, client }: any) {
  const styles = createStyles(branding);
  const publicationDate = typeof document.publicationDate === 'string'
    ? document.publicationDate
    : document.publicationDate.toISOString().split('T')[0];

  return React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    // Header with logo and tagline
    React.createElement(
      View,
      { style: styles.header },
      branding.logo_url &&
        React.createElement(Image, {
          src: branding.logo_url,
          style: styles.logo,
        }),
      branding.tagline &&
        React.createElement(Text, { style: styles.tagline }, branding.tagline)
    ),

    // Document metadata
    React.createElement(
      View,
      { style: styles.metadata },
      React.createElement(Text, { style: styles.memoTitle }, 'Regulatory Briefing'),
      React.createElement(Text, { style: styles.documentTitle }, document.title),
      client &&
        React.createElement(
          Text,
          { style: styles.preparedFor },
          `Prepared for: ${client.name}`
        ),
      React.createElement(
        Text,
        { style: styles.date },
        `${publicationDate}${document.citation ? ` | ${document.citation}` : ''}${
          document.documentType ? ` | ${document.documentType}` : ''
        }`
      )
    ),

    // Memo content
    React.createElement(
      View,
      { style: styles.content },
      ...sections.map((section: any, idx: number) =>
        React.createElement(SectionComponent, { key: idx, section, styles })
      )
    ),

    // Footer
    React.createElement(
      View,
      { style: styles.footer, fixed: true },
      React.createElement(Text, { style: styles.footerText }, branding.company_name),
      React.createElement(Text, { style: styles.footerText }, 'Confidential')
    )
  );
}

/**
 * Section component - renders a section with heading and content
 */
function SectionComponent({ section, styles }: any) {
  return React.createElement(
    View,
    { style: styles.section },
    React.createElement(Text, { style: styles.sectionHeading }, section.heading),
    ...section.content.map((block: any, idx: number) =>
      React.createElement(ContentBlock, { key: idx, block, styles })
    )
  );
}

/**
 * Content block - renders paragraphs, bullets, etc.
 */
function ContentBlock({ block, styles }: any) {
  if (block.type === 'paragraph') {
    return React.createElement(Text, { style: styles.paragraph }, block.text);
  }

  if (block.type === 'bullet') {
    return React.createElement(
      View,
      { style: styles.bulletContainer },
      React.createElement(Text, { style: styles.bullet }, '•'),
      React.createElement(Text, { style: styles.bulletText }, block.text)
    );
  }

  if (block.type === 'strong') {
    return React.createElement(Text, { style: styles.strong }, block.text);
  }

  return null;
}

/**
 * Parse markdown into structured sections
 */
function parseMarkdownSections(markdown: string): any[] {
  const sections: any[] = [];
  const lines = markdown.split('\n');

  let currentSection: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // H2 heading (## Title)
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        heading: line.replace(/^## /, ''),
        content: [],
      };
      continue;
    }

    if (!currentSection) continue;

    // Skip empty lines
    if (!line) {
      continue;
    }

    // Bullet points (- item or * item)
    if (line.match(/^[-*]\s+/)) {
      const text = line.replace(/^[-*]\s+/, '');
      // Remove markdown bold markers for simplicity
      const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1');
      currentSection.content.push({
        type: 'bullet',
        text: cleanText,
      });
      continue;
    }

    // Bold text (**text**)
    if (line.match(/^\*\*(.*?)\*\*/)) {
      currentSection.content.push({
        type: 'strong',
        text: line.replace(/\*\*/g, ''),
      });
      continue;
    }

    // Regular paragraph
    // Clean up markdown formatting
    const cleanText = line
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/`(.*?)`/g, '$1'); // Remove code

    currentSection.content.push({
      type: 'paragraph',
      text: cleanText,
    });
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Create styles based on branding
 */
function createStyles(branding: any) {
  const primaryColor = branding.primary_color || '#1a1a2e';
  const secondaryColor = branding.secondary_color || '#e94560';

  return StyleSheet.create({
    page: {
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      padding: 40,
      fontSize: 10,
      fontFamily: 'Helvetica',
    },
    header: {
      marginBottom: 20,
      borderBottom: `2 solid ${primaryColor}`,
      paddingBottom: 10,
    },
    logo: {
      width: 120,
      height: 40,
      objectFit: 'contain',
      marginBottom: 5,
    },
    tagline: {
      fontSize: 9,
      color: '#666666',
      fontStyle: 'italic',
    },
    metadata: {
      marginBottom: 20,
      paddingBottom: 15,
      borderBottom: '1 solid #cccccc',
    },
    memoTitle: {
      fontSize: 11,
      color: primaryColor,
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    documentTitle: {
      fontSize: 14,
      fontFamily: 'Helvetica-Bold',
      color: '#000000',
      marginBottom: 8,
      lineHeight: 1.3,
    },
    preparedFor: {
      fontSize: 10,
      color: secondaryColor,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 5,
    },
    date: {
      fontSize: 9,
      color: '#666666',
    },
    content: {
      flex: 1,
    },
    section: {
      marginBottom: 15,
    },
    sectionHeading: {
      fontSize: 12,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      marginBottom: 8,
      marginTop: 5,
    },
    paragraph: {
      fontSize: 10,
      lineHeight: 1.5,
      marginBottom: 8,
      color: '#333333',
    },
    bulletContainer: {
      flexDirection: 'row',
      marginBottom: 5,
      marginLeft: 10,
    },
    bullet: {
      width: 15,
      fontSize: 10,
      color: secondaryColor,
    },
    bulletText: {
      flex: 1,
      fontSize: 10,
      lineHeight: 1.4,
      color: '#333333',
    },
    strong: {
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 5,
    },
    footer: {
      position: 'absolute',
      bottom: 30,
      left: 40,
      right: 40,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTop: '1 solid #cccccc',
      paddingTop: 10,
    },
    footerText: {
      fontSize: 8,
      color: '#666666',
    },
  });
}

/**
 * Estimate PDF size (rough approximation)
 */
export function estimatePdfSize(markdown: string): number {
  // Very rough estimate: ~1KB per 100 characters of markdown
  return Math.ceil(markdown.length / 100) * 1024;
}
