// ArmorIQ integration. Each agent run:
//   1. declares its plan up front → ArmorIQ mints a signed intent token
//   2. every tool call is checked against that intent + org policies BEFORE it runs
//   3. executed calls are reported back for the audit trail
import { ArmorIQClient, PolicyBlockedException, PolicyHoldException, type ArmorIQSession } from '@armoriq/sdk';
import { config, requireEnv } from '../config.ts';

export interface Verdict {
  allowed: boolean;
  action: 'allow' | 'block' | 'hold';
  reason?: string;
  matchedPolicy?: string;
  delegationId?: string;
}

export interface PlanReceipt {
  tokenId: string;
  planId?: string;
  planHash: string;
  expiresAt: number;
}

let client: ArmorIQClient | undefined;

function getClient(): ArmorIQClient {
  if (!client) {
    requireEnv(['ARMORIQ_API_KEY', 'USER_ID', 'AGENT_ID']);
    client = new ArmorIQClient({
      apiKey: config.armoriq.apiKey,
      userId: config.armoriq.userId,
      agentId: config.armoriq.agentId,
    });
  }
  return client;
}

export class Guard {
  private session: ArmorIQSession;

  constructor() {
    this.session = getClient().startSession({
      mode: config.armoriq.mode,
      llm: config.llm.model,
      validitySeconds: 600,
    });
  }

  /** Register the plan with ArmorIQ. Throws PlanBlocked if policy rejects the plan itself. */
  async declarePlan(goal: string, tools: string[]): Promise<PlanReceipt> {
    try {
      const token = await this.session.startPlan(
        tools.map((name) => ({ name, args: {} })),
        goal,
      );
      return { tokenId: token.tokenId, planId: token.planId, planHash: token.planHash, expiresAt: token.expiresAt };
    } catch (err) {
      if (err instanceof PolicyBlockedException) throw new PlanBlocked(err.message);
      throw err;
    }
  }

  async check(tool: string, args: Record<string, unknown>): Promise<Verdict> {
    try {
      const d = await this.session.check(tool, args);
      return {
        allowed: d.allowed,
        action: d.action,
        reason: d.reason,
        matchedPolicy: d.matchedPolicy,
        delegationId: d.delegationId,
      };
    } catch (err) {
      if (err instanceof PolicyHoldException) return { allowed: false, action: 'hold', reason: err.message };
      if (err instanceof PolicyBlockedException) return { allowed: false, action: 'block', reason: err.message };
      // Fail closed: if ArmorIQ can't be reached, nothing runs.
      return { allowed: false, action: 'block', reason: `ArmorIQ check failed (fail-closed): ${(err as Error).message}` };
    }
  }

  async report(tool: string, args: Record<string, unknown>, result: unknown, durationMs: number, ok: boolean): Promise<void> {
    try {
      await this.session.report(tool, args, result, { status: ok ? 'success' : 'error', durationMs });
    } catch (err) {
      console.warn(`[armoriq] audit report failed: ${(err as Error).message}`);
    }
  }

  async close(ok: boolean): Promise<void> {
    await this.session.close(ok ? 'ok' : 'error');
  }
}

export class PlanBlocked extends Error {}
