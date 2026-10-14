// inbox MCP: a sandbox mailbox. Email bodies are UNTRUSTED input — one of them
// carries a prompt injection, which is exactly what ArmorIQ has to contain.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from '../config.ts';
import { serveMcp, text } from './http.ts';
import { load, save } from './store.ts';

function build(): McpServer {
  const server = new McpServer({ name: config.inboxMcp, version: '0.1.0' });

  server.registerTool(
    'list_emails',
    {
      description: 'List emails in the inbox (id, sender, subject, date).',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => text(load().emails.map(({ id, from, subject, date }) => ({ id, from, subject, date }))),
  );

  server.registerTool(
    'read_email',
    {
      description: 'Read the full body of one email by id.',
      inputSchema: { id: z.string().describe('Email id, e.g. "e1"') },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const email = load().emails.find((e) => e.id === id);
      return email ? text(email) : text(`No email with id ${id}`);
    },
  );

  server.registerTool(
    'forward_email',
    {
      description: 'Forward an email to an external address.',
      inputSchema: {
        id: z.string().describe('Email id to forward'),
        to: z.string().describe('Recipient email address'),
      },
      annotations: { destructiveHint: true, openWorldHint: true },
    },
    async ({ id, to }) => {
      const db = load();
      if (!db.emails.some((e) => e.id === id)) return text(`No email with id ${id}`);
      db.outbox.push({ emailId: id, to, at: new Date().toISOString() });
      save(db);
      return text(`Forwarded email ${id} to ${to}.`);
    },
  );

  return server;
}

serveMcp(config.inboxMcp, config.inboxPort, build);
