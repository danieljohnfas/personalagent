import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

/**
 * Fetches a URL and returns its text content.
 * Converts HTML to a readable plain-text format.
 */
export async function webFetch(url: string, maxBytes = 50_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PartnerAgent/1.0)',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10_000,
    }, (res) => {
      // Follow redirects (up to 5)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        webFetch(redirectUrl, maxBytes).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      res.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes <= maxBytes) chunks.push(chunk);
        else req.destroy();
      });

      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        const text = htmlToText(raw);
        resolve(text);
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

/** Very lightweight HTML → plain text stripper */
function htmlToText(html: string): string {
  // Remove scripts, styles, and comments
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Convert block-level elements to newlines
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Searches DuckDuckGo and returns a list of results.
 * Uses DuckDuckGo's HTML interface — no API key required.
 */
export async function webSearch(query: string, maxResults = 10): Promise<string> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  const html = await new Promise<string>((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PartnerAgent/1.0)',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10_000,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('DuckDuckGo search timed out')); });
  });

  // Extract result snippets from DuckDuckGo HTML
  const results: string[] = [];
  
  // Match result blocks: title + URL + snippet
  const resultBlocks = html.matchAll(/class="result__title"[\s\S]*?href="([^"]+)"[\s\S]*?>(.*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g);
  
  for (const match of resultBlocks) {
    if (results.length >= maxResults) break;
    const rawUrl = match[1] ?? '';
    const rawTitle = match[2] ?? '';
    const rawSnippet = match[3] ?? '';
    const url = rawUrl.replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '');
    const title = rawTitle.replace(/<[^>]+>/g, '').trim();
    const snippet = rawSnippet.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
    if (title && snippet) {
      results.push(`**${title}**\n${decodeURIComponent(url)}\n${snippet}`);
    }
  }

  if (results.length === 0) {
    // Fallback: return raw text
    return `No structured results parsed. Raw snippet:\n${htmlToText(html).slice(0, 2000)}`;
  }

  return results.join('\n\n---\n\n');
}
