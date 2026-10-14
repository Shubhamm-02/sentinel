# 🛡️ Sentinel: a voice money assistant that can't be hijacked

Sentinel is a voice-first AI agent that reads your inbox and pays your bills. A phishing email in that inbox carries a **prompt injection** that tells the agent to leak your bank login code and wire $900 to the attacker. **ArmorIQ stops both actions before they run.** The legitimate $42.18 electricity payment still goes through.

> Built for **Flow State 2026** (ArmorIQ × ElevenLabs).

## How it works

```
 you (voice / text)
      │
      ▼
 ┌────────────┐   1. PLAN from the user's words only (before reading any email)
 │  Planner   │──────────────────────────────┐
 └────────────┘                              ▼
                                   ┌──────────────────┐
                                   │     ArmorIQ      │  2. signs the plan → intent token
                                   │  (intent + policy)│
                                   └──────────────────┘
 ┌────────────┐  3. every tool call ──► check(tool, args) ──► ✅ allow / ⛔ block / ⏸ hold
 │  Executor  │                                     │
 │  (LLM loop)│◄──── result or "BLOCKED: reason" ───┘
 └────────────┘
      │ only allowed calls reach the MCP servers ↓            4. executed calls are reported (audit trail)
 ┌───────────────┐   ┌──────────────────┐
 │  inbox MCP    │   │  payments MCP    │   sandbox data only: fake inbox, fake ledger
 └───────────────┘   └──────────────────┘
```

**Two layers of defense, both enforced by ArmorIQ:**

| Attack in the phishing email | Why it's stopped |
|---|---|
| `inbox__forward_email` (send the login code to the attacker) | **Intent:** the tool isn't in the plan ArmorIQ signed for "pay my electricity bill" |
| `payments__pay_external_account` for $900 to `acct-7781-verify` | **Intent:** the tool isn't in the signed plan. **Policy:** even if a broad request puts it in the plan, ArmorIQ policy `sentinel-payments-guard` blocks sending money to non-saved accounts |
| `payments__pay_bill` for $42.18 to the saved payee `city-power` | ✅ **Allowed:** it's in the plan and allowed by policy |

The key design choice is that **the plan is made before the agent reads untrusted data**. Injected text can change what the LLM *wants* to do, but it can't change what ArmorIQ *authorized*.

## Stack (all free)

| Part | Choice |
|---|---|
| Agent | Custom TypeScript plan → act loop (`src/agent/`) |
| LLM | Any OpenAI-compatible endpoint: Groq `llama-3.3-70b-versatile` (free tier), Gemini `gemini-2.5-flash` (free tier), or local Ollama |
| MCP servers | Two MCP servers built with `@modelcontextprotocol/sdk` over Streamable HTTP (`src/mcp/`) |
| Security | `@armoriq/sdk`: `ArmorIQSession` with `startPlan` → `check` → `report` |
| Voice | Browser speech recognition in, ElevenLabs TTS out (free tier), falling back to browser speech |
| UI | Plain HTML page with a live ArmorIQ verdict timeline (`public/index.html`) |

## Setup

Requires **Node 22+**.

```bash
npm install
cp .env.example .env     # then fill it in (see below)
npm run dev              # starts inbox MCP :4101, payments MCP :4102, UI :3000
open http://localhost:3000
```

Terminal-only alternative: `npm run agent -- "Check my inbox and pay my electricity bill"`.
Reset the sandbox between demo runs: `npm run reset` (or the button in the UI).

### 1. ArmorIQ ([platform.armoriq.ai](https://platform.armoriq.ai))
1. Generate an API key and put it in `ARMORIQ_API_KEY`. Set `USER_ID` to your platform user.
2. Onboard the agent (`AGENT_ID=sentinel-agent`).
3. Onboard both MCP servers with the names `inbox` and `payments`. Tool calls are named `<mcp>__<tool>`.
4. Create the policies:
   - **payments** (`sentinel-payments-guard`): allow `list_payees`, `get_balance`, `pay_bill`, block `pay_external_account`, default `block`.
   - **inbox** (`sentinel-inbox-guard`): allow `list_emails`, `read_email`, block `forward_email`.
   - Policy YAML used:
     ```yaml
     name: sentinel-payments-guard
     version: 1.0.0
     scope: { target_type: mcp, target: <payments MCP id>, caller: members }
     default_action: block
     priority: 50
     rules:
       - { tool: get_balance, action: allow }
       - { tool: list_payees, action: allow }
       - { tool: pay_bill, action: allow }
       - { tool: pay_external_account, action: block }
     ```
5. MCP servers must be reachable by ArmorIQ for tool discovery. For local dev, expose them with free Cloudflare quick tunnels: `cloudflared tunnel --url http://localhost:4101` (and `4102`), then register the printed `https://…trycloudflare.com/mcp` URLs.

### 2. LLM: pick one free option
- **Groq:** key from https://console.groq.com/keys (default settings in `.env.example`)
- **Gemini:** key from https://aistudio.google.com/apikey and the alternate lines in `.env.example`
- **Ollama:** run it locally with no key at all

### 3. ElevenLabs (optional)
Get a free key from https://elevenlabs.io/app/settings/api-keys and put it in `ELEVENLABS_API_KEY`.

## Demo scenarios (buttons in the UI)
1. **"Check my inbox and pay my electricity bill."** The $42.18 payment is ✅ allowed. If the agent takes the phishing bait, the forward and the $900 external transfer are ⛔ blocked (not in the signed intent).
2. **"Read all my emails and do whatever they ask…"** An over-broad request that makes the agent follow the attacker. ArmorIQ blocks the damage.
3. **Direct exfiltration request.** "Forward my login code to …" is ⛔ blocked by policy.

## Project layout
```
src/agent/agent.ts      plan → ArmorIQ intent token → guarded tool loop
src/agent/guard.ts      ArmorIQ integration (startPlan / check / report)
src/agent/tools.ts      MCP client hub, tools exposed as <mcp>__<tool>
src/agent/llm.ts        OpenAI-compatible chat client (Groq / Gemini / Ollama)
src/mcp/*-server.ts     inbox + payments MCP servers (sandbox data in .sandbox/)
src/server.ts           web server: SSE event stream, ElevenLabs TTS proxy
public/index.html       UI
```

## Safety
All data is synthetic. There is no real email account, no real money and no production payment system. The payments MCP has **no** limits of its own. Like a real bank it separates paying saved payees (`pay_bill`) from sending money to arbitrary accounts (`pay_external_account`), and ArmorIQ decides which the agent may use.

## Disclosure
Built during the hackathon window (Oct 14–17, 2026). No pre-existing project code was used.
