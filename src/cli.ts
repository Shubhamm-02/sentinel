// Run the agent from the terminal (MCP servers must be running):
//   npm run agent -- "Check my inbox and pay my electricity bill"
import { runAgent, type AgentEvent } from './agent/agent.ts';

const prompt = process.argv.slice(2).join(' ') || 'Check my inbox and pay my electricity bill.';

const icons = { allow: '✅', block: '⛔', hold: '⏸️' } as const;

function print(e: AgentEvent): void {
  switch (e.type) {
    case 'status':
      console.log(`… ${e.text}`);
      break;
    case 'plan':
      console.log(`\n📜 Plan: ${e.goal}\n   tools: ${e.tools.join(', ')}`);
      console.log(`   ArmorIQ intent token ${e.receipt.tokenId} (plan ${e.receipt.planHash.slice(0, 12)}…)\n`);
      break;
    case 'tool':
      console.log(`${icons[e.verdict.action]} ${e.verdict.action.toUpperCase()} ${e.name} ${JSON.stringify(e.args)}`);
      if (!e.verdict.allowed) console.log(`   reason: ${e.verdict.reason}${e.verdict.matchedPolicy ? ` [${e.verdict.matchedPolicy}]` : ''}`);
      else if (e.failed) console.log(`   ⚠️  refused by the server: ${e.result}`);
      break;
    case 'answer':
      console.log(`\n🗣️  ${e.text}`);
      break;
    case 'error':
      console.error(`\n❌ ${e.message}`);
      process.exitCode = 1;
      break;
  }
}

await runAgent(prompt, print);
