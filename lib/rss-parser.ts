/**
 * RSS Feed Parser for Agency Newsrooms
 *
 * Parses RSS feeds from FDA and other agency newsrooms
 */

import { XMLParser } from 'fast-xml-parser';

export interface RSSItem {
  guid: string;
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  content?: string;
}

export interface RSSFeed {
  title?: string;
  link?: string;
  description?: string;
  items: RSSItem[];
}

/**
 * Parse RSS feed from XML text
 */
export async function parseRSSFeed(xmlText: string): Promise<RSSFeed> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  const result = parser.parse(xmlText);

  // Handle both RSS 2.0 and Atom feeds
  if (result.rss && result.rss.channel) {
    return parseRSS2Feed(result.rss.channel);
  } else if (result.feed) {
    return parseAtomFeed(result.feed);
  }

  throw new Error('Unsupported feed format');
}

/**
 * Parse RSS 2.0 format
 */
function parseRSS2Feed(channel: any): RSSFeed {
  const items = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean);

  return {
    title: channel.title,
    link: channel.link,
    description: channel.description,
    items: items.map((item: any) => ({
      guid: item.guid?.['#text'] || item.guid || item.link,
      title: item.title,
      link: item.link,
      description: item.description || item.summary,
      pubDate: item.pubDate,
      content: item['content:encoded'] || item.content,
    })),
  };
}

/**
 * Parse Atom format
 */
function parseAtomFeed(feed: any): RSSFeed {
  const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry].filter(Boolean);

  return {
    title: feed.title,
    link: feed.link?.['@_href'] || feed.link,
    description: feed.subtitle,
    items: entries.map((entry: any) => ({
      guid: entry.id,
      title: entry.title,
      link: entry.link?.['@_href'] || entry.link,
      description: entry.summary || entry.content,
      pubDate: entry.updated || entry.published,
      content: entry.content?.['#text'] || entry.content,
    })),
  };
}

/**
 * Fetch and parse RSS feed from URL
 */
export async function fetchRSSFeed(url: string): Promise<RSSFeed> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Regulatory Monitor/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
  }

  const xmlText = await response.text();
  return parseRSSFeed(xmlText);
}

/**
 * Extract PDF URL from RSS item content or description
 */
export function extractPdfUrl(item: RSSItem): string | null {
  // Check description and content for PDF links
  const text = `${item.description || ''} ${item.content || ''}`;

  // Match PDF URLs
  const pdfMatch = text.match(/https?:\/\/[^\s<>"]+\.pdf/i);
  if (pdfMatch) {
    return pdfMatch[0];
  }

  // Check if the main link is a PDF
  if (item.link && item.link.toLowerCase().endsWith('.pdf')) {
    return item.link;
  }

  return null;
}

/**
 * Parse date from various formats
 */
export function parseRSSDate(dateString: string): Date {
  try {
    return new Date(dateString);
  } catch (error) {
    console.error(`Failed to parse date: ${dateString}`);
    return new Date();
  }
}
