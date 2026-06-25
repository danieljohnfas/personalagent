import { webFetch, webSearch } from './fetcher.js';

export interface WebTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export const WEB_TOOLS: WebTool[] = [
  {
    name: 'web_fetch',
    description: 'Fetch and read the content of any URL on the internet. Returns the page text. Use this to read articles, documentation, websites, APIs, or any public webpage.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The full URL to fetch (must include https:// or http://)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the internet using DuckDuckGo. Returns a list of relevant results with titles, URLs, and snippets. Use this when you need to find current information, news, or any topic on the web.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        max_results: { type: 'string', description: 'Maximum number of results to return (default: 8)' },
      },
      required: ['query'],
    },
  },
];

export async function callWebTool(tool: string, args: Record<string, unknown>): Promise<unknown> {
  if (tool === 'web_fetch') {
    const url = args.url as string;
    if (!url) throw new Error('url is required');
    const content = await webFetch(url);
    return { content: [{ type: 'text', text: content }] };
  }

  if (tool === 'web_search') {
    const query = args.query as string;
    if (!query) throw new Error('query is required');
    const maxResults = args.max_results ? parseInt(args.max_results as string, 10) : 8;
    const results = await webSearch(query, maxResults);
    return { content: [{ type: 'text', text: results }] };
  }

  throw new Error(`Unknown web tool: ${tool}`);
}
