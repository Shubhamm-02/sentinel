# Sentinel demo video script (about 4 minutes)

Judges score the video on **clarity and quality of explanation** (40 points). The organizers asked for five things, and each section below covers one or more of them:

| Required by the organizers | Section |
|---|---|
| The problem and who it's for | 1 |
| The product working, end to end | 2, 3 |
| The ArmorIQ console and how we used it | 4 |
| Our Policy Studio rules and what they blocked or allowed | 5 |
| Takeaways and what we'd build next | 6, 7 |

Target length: **3:45–4:30**. The hard limit is 3 to 5 minutes. Upload it as **unlisted** on YouTube, Loom or Vimeo.

## Before you record

- **App:** the live demo link (`https://…`). Open it in **Chrome**, go full screen (`⌘ + Ctrl + F`), keep zoom at 100%, and hide the bookmarks bar. If the walkthrough pops up, press **Esc**, then click **Reset sandbox**.
- **ArmorIQ console:** log in at **tools.armoriq.ai**, the ArmorIQ Console, as the account that owns the workspace. If `sentinel-agent` doesn't show up there, use **platform.armoriq.ai**, where it was registered. Open these tabs before you start:
  1. **Agents → sentinel-agent**
  2. **Inventory** (MCP servers `inbox` and `payments`)
  3. **Policies → sentinel-inbox-guard** and **sentinel-payments-guard**, in Policy Studio
  4. **Activity → Audit Log**
  5. **Observability → Sessions**
- Each run takes 10 to 30 seconds while the AI thinks. **Speed the waiting parts up 2×** in editing, but never cut or speed up the moment a verdict appears.
- Record the voiceover calmly and slowly. Clarity is what's being scored.

---

## 1 · The problem, and who it's for (0:00–0:30)

**Screen:** the app, idle. Slowly hover over the "Every action Sentinel tries has to pass through this gate" panel.

> "AI agents are starting to act for us: paying bills, answering email, moving money. To do that, they read untrusted content all day. And they can be fooled.
>
> Sentinel is for anyone who wants an AI assistant to handle their bills and inbox, like a busy professional, or an older parent who's a target for scams, without handing the AI a blank cheque."

## 2 · How it works (0:30–0:55)

**Screen:** hover over the three steps: Plan → Seal → Check every call.

> "The idea is simple. Before Sentinel reads anything, it writes down a plan: the exact tools it will need for your request. ArmorIQ signs that plan as an intent token. From then on, every action the agent tries is checked against that signed plan, and against your policies, *before* it runs.
>
> A scam email can change what the AI *wants* to do. It can't change what ArmorIQ authorized."

## 3 · The product, end to end (0:55–2:15)

### 3a · A normal request (0:55–1:15)

**Screen:** click **"1 · Pay my electricity bill"**. Show the contract card stamping in, then the green rows, then the right column.

> "First, a normal request: pay my electricity bill. ArmorIQ signs a five-tool plan: read the inbox, check payees and balance, pay a bill. Every call is allowed, and forty-two dollars is paid. You can see the real balance change on the right."

**Screen:** click **Reset sandbox**.

### 3b · The fraud (1:15–1:55), the main shot

**Screen:** click **"2 · Pay whatever is due"**. Optionally, tap the **mic** and *say* the request instead; that shows off the voice input.

> "Now something broader: pay whatever is due."

- When the contract card stamps in:

  > "Same signed plan: read my email, pay my *saved* bills."

- As the green rows come in:

  > "It pays the electricity bill. But the inbox also has an email from a fake landlord: 'our bank details have changed, send nine hundred dollars rent to this new account.'"

- When the red **BLOCKED** row hits for `pay_external_account`, **hold on it for 2 to 3 seconds**:

  > "The AI believes it and tries to send the money. ArmorIQ blocks it: sending money to a new account was never in the signed plan. And Sentinel stops right there. It doesn't look for another way around the block."

- Point to the right column and the answer on the left:

  > "My balance only moved by forty-two dollars, and Sentinel tells me the email looks like a scam."

### 3c · The data leak (1:55–2:15)

**Screen:** click **Reset sandbox**, then **"3 · Send my statement to my accountant"**. Hold on the red BLOCKED row showing *Policy · sentinel-inbox-guard*.

> "Last one. This time *I'm* the one who's fooled: I ask it to forward my bank statement to a fake accountant. Forwarding is in the plan, because I asked for it. But my policy says bank data never leaves the inbox. Blocked by policy, and the outbox on the right stays empty."

## 4 · The ArmorIQ console (2:15–2:55)

**Screen:** switch to the ArmorIQ console tabs, one after another.

- **Agents → sentinel-agent:**

  > "Everything you just saw is real. Here's the ArmorIQ console. Sentinel is registered as an agent,"

- **Inventory:**

  > "and its two MCP servers, the inbox and the payments ledger, are registered too, with their tools discovered by ArmorIQ."

- **Activity → Audit Log.** Scroll slowly so `forward_email · Blocked` and `pay_bill · allowed` are visible:

  > "Every tool call lands in the audit log: here's the bill payment allowed, and the forward blocked."

- **Observability → Sessions:**

  > "And every run is traced as a session, end to end."

## 5 · Our Policy Studio rules (2:55–3:25)

**Screen:** open **sentinel-inbox-guard** in Policy Studio, then **sentinel-payments-guard**.

> "These are our rules in Policy Studio. The inbox guard allows listing and reading email, and blocks forwarding, which is what stopped the data leak. The payments guard allows checking payees and balance and paying saved bills, and blocks everything else by default.
>
> So there are two layers. The signed plan stops anything the request didn't ask for. That's what caught the fraud. The policy stops anything the organization never allows, even when the user asks. That's what caught the leak."

## 6 · Takeaways (3:25–3:55)

**Screen:** back to the app on the finished scenario 2, or the README's "Takeaways" section.

> "What we learned. One: the models we tested ignored obvious 'ignore your instructions' attacks, but fell for a believable scam email every time. So the safety check has to live *outside* the model.
>
> Two: blocking isn't enough. In one test, after the transfer was blocked, the AI tried to pay the same nine hundred dollars to a different payee. So when ArmorIQ blocks something, Sentinel now stops and asks you.
>
> Three: a plan signs *which* tools can run, not *how much* money they can move. Amount limits need argument-level policies."

## 7 · What's next, and close (3:55–4:20)

**Screen:** the app, idle, or the README's "What's next" section.

> "Next, we want argument-level intent, so the plan says 'pay forty-two dollars to City Power', not just 'pay bills'. We'd add human approval for big payments, with ArmorIQ holds confirmed by voice. We'd connect to real sandboxes like Stripe test mode and Gmail. And we'd split the agent into sub-agents with narrower delegated permissions.
>
> Sentinel. The model can be tricked. The plan can't."

---

## Checklist before you upload

- [ ] The length is between 3 and 5 minutes.
- [ ] Each BLOCKED moment is on screen for at least 2 seconds, not sped up.
- [ ] The console section shows the agent, the MCP servers, the Audit Log, Observability, and both policies in Policy Studio.
- [ ] No API keys or `.env` contents are visible anywhere on screen.
- [ ] The video is uploaded as **unlisted**, and the link is in the submission form.
