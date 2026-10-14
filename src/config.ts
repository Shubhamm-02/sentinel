function num(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? Number(v) : fallback;
}

export const config = {
  port: num('PORT', 3000),
  inboxPort: num('INBOX_MCP_PORT', 4101),
  paymentsPort: num('PAYMENTS_MCP_PORT', 4102),

  inboxMcp: process.env.INBOX_MCP_NAME || 'inbox',
  paymentsMcp: process.env.PAYMENTS_MCP_NAME || 'payments',

  armoriq: {
    apiKey: process.env.ARMORIQ_API_KEY || '',
    userId: process.env.USER_ID || '',
    agentId: process.env.AGENT_ID || '',
    mode: (process.env.ARMORIQ_MODE || 'sdk') as 'sdk' | 'local' | 'proxy',
  },

  llm: {
    baseUrl: (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
  },

  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    voiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
    modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5',
  },
};

/** Throws a readable error listing every required env var that is missing. */
export function requireEnv(names: string[]): void {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')} — copy .env.example to .env and fill them in.`);
  }
}
