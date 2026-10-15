// Minimal client for any OpenAI-compatible chat endpoint (Groq, Gemini, Ollama, …)
// so the LLM can be swapped for whichever free tier is available.
import { config } from '../config.ts';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type Message =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ToolDef {
  type: 'function';
  function: { name: string; description?: string; parameters: Record<string, unknown> };
}

interface ChatRequest {
  messages: Message[];
  tools?: ToolDef[];
  json?: boolean;
  temperature?: number;
  /** 'none' forces a plain-text answer even though tools are listed. */
  toolChoice?: 'auto' | 'none';
}

export async function chat(req: ChatRequest): Promise<Extract<Message, { role: 'assistant' }>> {
  const body: Record<string, unknown> = {
    model: config.llm.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.2,
  };
  if (req.tools?.length) {
    body.tools = req.tools;
    body.tool_choice = req.toolChoice ?? 'auto';
  }
  if (req.json) body.response_format = { type: 'json_object' };

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llm.apiKey}` },
      body: JSON.stringify(body),
    });
    // Free tiers rate-limit aggressively; back off and retry a few times.
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = Number(res.headers.get('retry-after')) || 2 ** attempt * 2;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`LLM request failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
    const data = (await res.json()) as { choices: { message: Extract<Message, { role: 'assistant' }> }[] };
    const msg = data.choices[0].message;
    return { role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls?.length ? msg.tool_calls : undefined };
  }
}
