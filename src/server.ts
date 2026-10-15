import path from 'node:path';
import express from 'express';
import { config } from './config.ts';
import { agentInfo, runAgent, type AgentEvent } from './agent/agent.ts';
import { load, reset } from './mcp/store.ts';

const app = express();
app.use(express.json());
app.use(
  express.static(path.resolve(process.cwd(), 'public'), {
    setHeaders: (res, filePath) => {
      // Font file names carry a content hash (scripts/fetch-fonts.mjs), so browsers can keep them for good.
      if (filePath.endsWith('.woff2')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }),
);

app.get('/api/info', (_req, res) => {
  res.json({
    model: agentInfo.model,
    armoriqMode: agentInfo.mode,
    armoriqConfigured: Boolean(config.armoriq.apiKey && config.armoriq.userId && config.armoriq.agentId),
    llmConfigured: Boolean(config.llm.apiKey),
    elevenlabs: Boolean(config.elevenlabs.apiKey),
  });
});

// Read-only view of the sandbox, so the UI can show what actually happened.
app.get('/api/state', (_req, res) => {
  const db = load();
  res.json({
    emails: db.emails.map(({ id, from, subject }) => ({ id, from, subject })),
    outbox: db.outbox,
    balance: db.balance,
    transactions: db.transactions,
  });
});

app.post('/api/reset', (_req, res) => {
  reset();
  res.json({ ok: true });
});

let busy = false;

// Streams agent events as Server-Sent Events.
app.post('/api/run', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }
  if (busy) {
    res.status(409).json({ error: 'The agent is already running. Wait for it to finish.' });
    return;
  }
  busy = true;
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const emit = (e: AgentEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  try {
    await runAgent(prompt, emit);
  } finally {
    busy = false;
    res.write('data: {"type":"done"}\n\n');
    res.end();
  }
});

// ElevenLabs text-to-speech. Returns 204 when no key is set so the UI falls back to browser speech.
app.post('/api/tts', async (req, res) => {
  const text = String(req.body?.text ?? '').slice(0, 600);
  if (!config.elevenlabs.apiKey || !text) {
    res.status(204).end();
    return;
  }
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenlabs.voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': config.elevenlabs.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: config.elevenlabs.modelId }),
    },
  );
  if (!r.ok) {
    console.warn(`[tts] ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
    res.status(204).end();
    return;
  }
  res.setHeader('Content-Type', 'audio/mpeg');
  res.send(Buffer.from(await r.arrayBuffer()));
});

app.listen(config.port, () => console.log(`[web] Sentinel UI on http://localhost:${config.port}`));
