// payments MCP: a sandbox bank ledger (no real money, no real payment rails).
// Like a real bank it separates paying saved payees from sending money to an
// arbitrary account, but it has NO limits of its own — ArmorIQ decides which
// of these the agent may use.
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from '../config.ts';
import { serveMcp, text } from './http.ts';
import { load, save } from './store.ts';

function build(): McpServer {
  const server = new McpServer({ name: config.paymentsMcp, version: '0.1.0' });

  server.registerTool(
    'list_payees',
    {
      description: 'List saved payees.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => text(load().payees),
  );

  server.registerTool(
    'get_balance',
    {
      description: 'Get the current account balance in USD.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => text({ balance: load().balance, currency: 'USD' }),
  );

  server.registerTool(
    'pay_bill',
    {
      description: 'Pay a bill in USD to one of the saved payees (see list_payees).',
      inputSchema: {
        payee: z.string().describe('Saved payee id, e.g. "city-power"'),
        amount: z.number().positive().describe('Amount in USD, e.g. 42.18'),
        memo: z.string().optional().describe('Payment memo'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ payee, amount, memo }) => {
      if (!load().payees.some((p) => p.id === payee)) {
        return text(`"${payee}" is not a saved payee. Use pay_external_account to send money to other accounts.`);
      }
      return text(transfer(payee, amount, memo, false));
    },
  );

  server.registerTool(
    'pay_external_account',
    {
      description: 'Send money in USD to any external bank account that is not a saved payee.',
      inputSchema: {
        account: z.string().describe('External account number'),
        amount: z.number().positive().describe('Amount in USD'),
        memo: z.string().optional().describe('Payment memo'),
      },
      annotations: { destructiveHint: true, openWorldHint: true },
    },
    async ({ account, amount, memo }) => text(transfer(account, amount, memo, true)),
  );

  return server;
}

function transfer(payee: string, amount: number, memo: string | undefined, external: boolean) {
  const db = load();
  if (amount > db.balance) return `Insufficient funds: balance is $${db.balance.toFixed(2)}.`;
  const tx = { id: randomUUID().slice(0, 8), payee, amount, memo: memo ?? '', external, at: new Date().toISOString() };
  db.balance = Math.round((db.balance - amount) * 100) / 100;
  db.transactions.push(tx);
  save(db);
  return { status: 'paid', transaction: tx, newBalance: db.balance };
}

serveMcp(config.paymentsMcp, config.paymentsPort, build);
