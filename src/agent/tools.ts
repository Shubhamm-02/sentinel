// Connects to the MCP servers and exposes their tools to the LLM as
// `<mcp>__<tool>` — the naming convention ArmorIQ uses to map a call to an MCP.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { config } from '../config.ts';
import type { ToolDef } from './llm.ts';

interface Server {
  mcp: string;
  url: string;
}

export const servers: Server[] = [
  { mcp: config.inboxMcp, url: `http://localhost:${config.inboxPort}/mcp` },
  { mcp: config.paymentsMcp, url: `http://localhost:${config.paymentsPort}/mcp` },
];

export class ToolHub {
  private clients = new Map<string, Client>();
  readonly defs: ToolDef[] = [];
  /** Tools the MCP server marks as read-only (annotations.readOnlyHint). */
  readonly readOnly = new Set<string>();

  async connect(): Promise<void> {
    for (const { mcp, url } of servers) {
      const client = new Client({ name: 'sentinel-agent', version: '0.1.0' });
      try {
        await client.connect(new StreamableHTTPClientTransport(new URL(url)));
      } catch (err) {
        throw new Error(`Cannot reach MCP server "${mcp}" at ${url} — is \`npm run dev\` running? (${(err as Error).message})`);
      }
      this.clients.set(mcp, client);
      const { tools } = await client.listTools();
      for (const t of tools) {
        const { $schema: _ignored, ...parameters } = t.inputSchema as Record<string, unknown>;
        const name = `${mcp}__${t.name}`;
        this.defs.push({ type: 'function', function: { name, description: t.description, parameters } });
        if (t.annotations?.readOnlyHint) this.readOnly.add(name);
      }
    }
  }

  has(name: string): boolean {
    return this.defs.some((d) => d.function.name === name);
  }

  async call(name: string, args: Record<string, unknown>): Promise<string> {
    const idx = name.indexOf('__');
    const client = this.clients.get(name.slice(0, idx));
    if (idx === -1 || !client) return `Unknown tool ${name}`;
    const result = await client.callTool({ name: name.slice(idx + 2), arguments: args });
    const content = (result.content ?? []) as { type: string; text?: string }[];
    return content.map((c) => (c.type === 'text' ? c.text : `[${c.type}]`)).join('\n');
  }

  async close(): Promise<void> {
    await Promise.all([...this.clients.values()].map((c) => c.close()));
  }
}
