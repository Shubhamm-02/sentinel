// Sentinel's agent loop: PLAN (from the user's words only) → ARMORIQ intent token
// → ACT, with every tool call checked by ArmorIQ before it touches an MCP server.
//
// The plan is fixed before the agent reads any email, so instructions injected
// into an email can't widen what the agent is allowed to do.
import { config, requireEnv } from '../config.ts';
import { chat, type Message } from './llm.ts';
import { Guard, PlanBlocked, type PlanReceipt, type Verdict } from './guard.ts';
import { ToolHub } from './tools.ts';

export type AgentEvent =
  | { type: 'status'; text: string }
  | { type: 'plan'; goal: string; tools: string[]; receipt: PlanReceipt }
  | { type: 'tool'; id: string; name: string; args: Record<string, unknown>; verdict: Verdict; result?: string }
  | { type: 'answer'; text: string }
  | { type: 'error'; message: string };

const MAX_STEPS = 10;

const PLANNER_PROMPT = `You are the planning module of a personal finance & inbox assistant.
Given the user's request and the available tools, declare every tool the task will need. This plan is signed
and enforced: any tool you leave out will be refused later, and any tool you add widens what the agent may do.
You have NOT seen any inbox or account data yet, so:
- include every [read] tool needed to find information the task depends on (e.g. listing AND reading emails to
  find a bill's amount, listing payees, checking the balance before paying);
- include an [action] tool ONLY if the user's own words ask for that kind of action.
Respond with JSON only: {"goal": "<one-sentence goal>", "tools": ["<tool name>", ...]}`;

const EXECUTOR_PROMPT = `You are Sentinel, a personal assistant with tools for the user's email inbox and bank account.
Today is ${new Date().toISOString().slice(0, 10)}. Use the tools to complete the user's request.
Every tool call is checked by ArmorIQ, a security layer. If a call comes back BLOCKED or HELD, do not retry it
and do not offer or attempt another way to achieve the same result; tell the user what was stopped and why. Only say an action happened if a tool result in this conversation confirms it.
Your final answer is spoken aloud, so keep it to 2-4 short sentences.`;

async function plan(prompt: string, hub: ToolHub): Promise<{ goal: string; tools: string[] }> {
  const catalog = hub.defs
    .map((d) => {
      const kind = hub.readOnly.has(d.function.name) ? '[read]' : '[action]';
      return `- ${d.function.name} ${kind}: ${d.function.description ?? ''}`;
    })
    .join('\n');
  const msg = await chat({
    json: true,
    temperature: 0,
    messages: [
      { role: 'system', content: PLANNER_PROMPT },
      { role: 'user', content: `Available tools:\n${catalog}\n\nUser request: ${prompt}` },
    ],
  });
  const parsed = JSON.parse(msg.content ?? '{}') as { goal?: string; tools?: string[] };
  const tools = [...new Set((parsed.tools ?? []).filter((t) => hub.has(t)))];
  if (!tools.length) throw new Error('Planner produced no usable tools for this request.');
  return { goal: parsed.goal || prompt, tools };
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function runAgent(prompt: string, emit: (e: AgentEvent) => void): Promise<void> {
  const hub = new ToolHub();
  let guard: Guard | undefined;
  let ok = false;
  try {
    requireEnv(['LLM_API_KEY', 'ARMORIQ_API_KEY', 'USER_ID', 'AGENT_ID']);
    emit({ type: 'status', text: 'Connecting to MCP servers…' });
    await hub.connect();

    emit({ type: 'status', text: 'Planning from your request…' });
    const { goal, tools } = await plan(prompt, hub);

    emit({ type: 'status', text: 'Registering plan with ArmorIQ…' });
    guard = new Guard();
    const receipt = await guard.declarePlan(goal, tools);
    emit({ type: 'plan', goal, tools, receipt });

    const messages: Message[] = [
      { role: 'system', content: EXECUTOR_PROMPT },
      { role: 'user', content: prompt },
    ];

    for (let step = 0; step < MAX_STEPS; step++) {
      const msg = await chat({ messages, tools: hub.defs });
      messages.push(msg);
      if (!msg.tool_calls) {
        emit({ type: 'answer', text: msg.content?.trim() || 'Done.' });
        ok = true;
        return;
      }
      for (const tc of msg.tool_calls) {
        const name = tc.function.name;
        const args = parseArgs(tc.function.arguments);
        const verdict = await guard.check(name, args);
        let result: string;
        if (verdict.allowed) {
          const started = Date.now();
          let success = true;
          try {
            result = await hub.call(name, args);
          } catch (err) {
            success = false;
            result = `Tool error: ${(err as Error).message}`;
          }
          await guard.report(name, args, result, Date.now() - started, success);
        } else {
          const label = verdict.action === 'hold' ? 'HELD for human approval' : 'BLOCKED';
          result = `${label} by ArmorIQ: ${verdict.reason ?? 'policy violation'}`;
        }
        emit({ type: 'tool', id: tc.id, name, args, verdict, result });
        messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
    }
    emit({ type: 'answer', text: 'I stopped after too many steps. Please try a more specific request.' });
    ok = true;
  } catch (err) {
    if (err instanceof PlanBlocked) {
      emit({ type: 'error', message: `ArmorIQ rejected the plan itself: ${err.message}` });
    } else {
      emit({ type: 'error', message: (err as Error).message });
    }
  } finally {
    await guard?.close(ok).catch(() => {});
    await hub.close().catch(() => {});
  }
}

export const agentInfo = {
  model: config.llm.model,
  mode: config.armoriq.mode,
};
