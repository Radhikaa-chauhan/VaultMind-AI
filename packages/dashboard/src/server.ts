// =============================================================================
// @vaultmind/dashboard — Risk console API + SSE + optional Vite frontend
// =============================================================================

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { createReadStream, existsSync, statSync } from 'fs';
import { extname, join, normalize, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { timingSafeEqual } from 'crypto';
import type { EventBus, AgentId, DisputeStatus, PolicyAction, PolicyId, PolicyRule, SpendPolicy, SpendAlert, TimeWindow, TransactionId } from '@vaultmind/core';
import { generateId } from '@vaultmind/core';
import type { PolicyEngine } from '@vaultmind/control';
import type { SpendTracker, SpendAnalytics, FraudEvalReport } from '@vaultmind/observe';
import { getCachedFraudEval } from '@vaultmind/observe';
import type { TransactionProvenance, DisputeManager } from '@vaultmind/protect';
import type { AgentRegistry } from '@vaultmind/a2a';

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3100',
  'http://127.0.0.1:3100',
];

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

export interface DashboardConfig {
  readonly port?: number;
  readonly host?: string;
  readonly bearerToken?: string;
  readonly allowedOrigins?: string[];
  readonly maxSSEConnections?: number;
  readonly frontendDist?: string;
}

export interface DashboardDeps {
  readonly policyEngine: PolicyEngine;
  readonly tracker: SpendTracker;
  readonly analytics: SpendAnalytics;
  readonly provenance: TransactionProvenance;
  readonly disputes: DisputeManager;
  readonly events: EventBus;
  readonly registry?: AgentRegistry;
  readonly getAlertLog?: () => SpendAlert[];
  readonly getEvalMetrics?: () => FraudEvalReport;
}

function safeOrigins(configured?: string[]): string[] {
  const list = (configured ?? DEFAULT_ORIGINS).filter((o) => o !== '*');
  return list.length > 0 ? list : DEFAULT_ORIGINS;
}

function tokenOk(provided: string | undefined, expected: string): boolean {
  if (!provided || !provided.startsWith('Bearer ')) return false;
  const got = Buffer.from(provided.slice(7));
  const want = Buffer.from(expected);
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}

function hasDangerousKey(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === null || typeof value !== 'object') return false;
  for (const key of Object.keys(value as object)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return true;
    if (hasDangerousKey((value as Record<string, unknown>)[key], depth + 1)) return true;
  }
  return false;
}

async function readJsonBody(req: IncomingMessage, limit = 64_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > limit) throw new Error('payload_too_large');
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function calculateRiskScore(deps: DashboardDeps): { score: number; factors: Record<string, number> } {
  const txs = deps.tracker.query({ limit: 100 });
  const blocked = txs.filter((tx) => tx.status === 'rejected' || tx.status === 'failed').length;
  const blockedRatio = txs.length > 0 ? blocked / txs.length : 0;
  const blockedPts = Math.min(blockedRatio * 100, 25);

  const alerts = deps.getAlertLog?.() ?? [];
  const recentAlerts = alerts.filter((a) => Date.now() - new Date(a.timestamp).getTime() < 3_600_000);
  const alertPts = Math.min(recentAlerts.length * 5, 25);

  const flagged = txs.filter((tx) => tx.metadata?.riskAction === 'flag').length;
  const flagPts = Math.min(flagged * 3, 25);

  const highScore = txs.filter((tx) => typeof tx.metadata?.riskScore === 'number' && (tx.metadata.riskScore as number) >= 72).length;
  const spikePts = Math.min(highScore * 6, 25);

  const score = Math.min(100, Math.round(blockedPts + alertPts + flagPts + spikePts));
  return {
    score,
    factors: {
      blockedRatio: Number(blockedRatio.toFixed(3)),
      recentAlerts: recentAlerts.length,
      flagged,
      highRisk: highScore,
    },
  };
}

function spendByHour(deps: DashboardDeps) {
  const txs = deps.tracker.query({ limit: 1000 });
  const buckets = new Map<string, { allowed: number; blocked: number; allowedAmount: number; blockedAmount: number }>();
  const now = Date.now();
  for (let i = 23; i >= 0; i -= 1) {
    const start = new Date(now - i * 3600000);
    const key = `${start.getHours().toString().padStart(2, '0')}:00`;
    buckets.set(`${i}-${key}`, { allowed: 0, blocked: 0, allowedAmount: 0, blockedAmount: 0 });
  }
  const keys = [...buckets.keys()];
  for (const tx of txs) {
    const ageH = Math.floor((now - new Date(tx.createdAt).getTime()) / 3600000);
    if (ageH < 0 || ageH > 23) continue;
    const key = keys[23 - ageH];
    if (!key) continue;
    const bucket = buckets.get(key)!;
    const blocked = tx.status === 'rejected' || tx.status === 'failed';
    if (blocked) {
      bucket.blocked += 1;
      bucket.blockedAmount += tx.amount;
    } else {
      bucket.allowed += 1;
      bucket.allowedAmount += tx.amount;
    }
  }
  return [...buckets.entries()].map(([key, value]) => ({
    hour: key.split('-')[1],
    ...value,
  }));
}

export function createDashboardServer(deps: DashboardDeps, config?: DashboardConfig) {
  const port = config?.port ?? 3100;
  const host = config?.host ?? '127.0.0.1';
  const bearerToken = config?.bearerToken;
  const origins = safeOrigins(config?.allowedOrigins);
  const maxSSE = config?.maxSSEConnections ?? 100;
  const frontendDist = config?.frontendDist ?? resolve(dirname(fileURLToPath(import.meta.url)), '../frontend/dist');

  const sseClients = new Set<ServerResponse>();

  deps.events.onAny((event) => {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of sseClients) {
      try { client.write(data); } catch { sseClients.delete(client); }
    }
  });

  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const origin = req.headers.origin;

    if (origin && origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    if (path.startsWith('/api') || path === '/status' || path === '/events') {
      res.setHeader('Cache-Control', 'no-store');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const isMutation = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE';
    if (bearerToken) {
      if (!tokenOk(req.headers.authorization, bearerToken)) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
    } else if (isMutation) {
      json(res, 401, { error: 'Unauthorized', hint: 'Mutations require VAULTMIND_DASHBOARD_TOKEN' });
      return;
    }

    const apiPath = path.startsWith('/api') ? path.slice(4) || '/' : path;

    try {
      if (req.method === 'GET' && (apiPath === '/status')) return handleStatus(deps, res);
      if (req.method === 'GET' && (apiPath === '/transactions')) return handleTransactions(deps, url, res);
      if (req.method === 'GET' && apiPath.startsWith('/transactions/')) {
        return handleTransactionDetail(deps, apiPath.slice('/transactions/'.length), res);
      }
      if (req.method === 'GET' && apiPath === '/policies') return handlePolicies(deps, res);
      if (req.method === 'POST' && apiPath === '/policies') return handleCreatePolicy(deps, req, res);
      if (req.method === 'GET' && apiPath === '/alerts') return handleAlerts(deps, url, res);
      if (req.method === 'GET' && apiPath === '/disputes') return handleDisputes(deps, url, res);
      if (req.method === 'GET' && apiPath.startsWith('/disputes/')) {
        return handleDisputeDetail(deps, apiPath.slice('/disputes/'.length), res);
      }
      if (req.method === 'GET' && apiPath === '/agents') return handleAgents(deps, res);
      if (req.method === 'GET' && apiPath.startsWith('/agents/')) {
        return handleAgentDetail(deps, apiPath.slice('/agents/'.length), res);
      }
      if (req.method === 'GET' && apiPath === '/stats') return handleStats(deps, res);
      if (req.method === 'GET' && apiPath === '/stats/risk-score') return json(res, 200, calculateRiskScore(deps));
      if (req.method === 'GET' && apiPath === '/stats/spend-by-hour') return json(res, 200, { hours: spendByHour(deps) });
      if (req.method === 'GET' && apiPath === '/metrics') {
        return json(res, 200, deps.getEvalMetrics?.() ?? getCachedFraudEval());
      }
      if (req.method === 'GET' && (path === '/events' || path === '/api/events')) {
        return handleSSE(sseClients, maxSSE, req, res);
      }
      if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
        return handleHTML(frontendDist, res);
      }
      if (req.method === 'GET' && existsSync(frontendDist) && serveStatic(frontendDist, path, res)) {
        return;
      }
    } catch (err) {
      const message = err instanceof Error && err.message === 'payload_too_large' ? 'Payload too large' : 'Bad request';
      json(res, err instanceof SyntaxError || message === 'Bad request' ? 400 : 413, { error: message });
      return;
    }

    json(res, 404, {
      error: 'Not found',
      availableEndpoints: ['/status', '/transactions', '/policies', '/alerts', '/disputes', '/agents', '/stats', '/metrics', '/events'],
    });
  }

  server.listen(port, host);
  return server;
}

function handleStatus(deps: DashboardDeps, res: ServerResponse) {
  const policies = deps.policyEngine.getPolicies();
  const txs = deps.tracker.query({ limit: 1000 });
  const blockedInr = txs.filter((t) => t.status === 'rejected').reduce((s, t) => s + t.amount, 0);
  json(res, 200, {
    status: 'running',
    product: 'VaultMind AI',
    uptime: process.uptime(),
    transactions: deps.tracker.size,
    policies: policies.length,
    agents: deps.registry?.size ?? 0,
    blockedInr,
    activePolicies: policies.filter((p) => p.enabled).map((p) => ({ id: p.id, name: p.name })),
  });
}

function handleTransactions(deps: DashboardDeps, url: URL, res: ServerResponse) {
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 1000);
  const agentId = url.searchParams.get('agent_id');
  const status = url.searchParams.get('status');
  const filter: { limit: number; agentId?: AgentId; status?: AgentTransactionStatus } = { limit };
  if (agentId) filter.agentId = agentId as AgentId;
  if (status) filter.status = status as AgentTransactionStatus;
  const txs = deps.tracker.query(filter);
  json(res, 200, { transactions: txs, count: txs.length, total: deps.tracker.size });
}

type AgentTransactionStatus = Parameters<SpendTracker['query']>[0] extends { status?: infer S } ? S : never;

function handleTransactionDetail(deps: DashboardDeps, id: string, res: ServerResponse) {
  if (!id || id.includes('..')) {
    json(res, 400, { error: 'Invalid id' });
    return;
  }
  const tx = deps.tracker.get(id as TransactionId);
  if (!tx) {
    json(res, 404, { error: 'Not found' });
    return;
  }
  json(res, 200, { transaction: tx, provenance: deps.provenance.getChain(tx.id) });
}

function handlePolicies(deps: DashboardDeps, res: ServerResponse) {
  json(res, 200, { policies: deps.policyEngine.getPolicies() });
}

async function handleCreatePolicy(deps: DashboardDeps, req: IncomingMessage, res: ServerResponse) {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    json(res, err instanceof Error && err.message === 'payload_too_large' ? 413 : 400, { error: 'Invalid JSON' });
    return;
  }
  if (hasDangerousKey(body) || typeof body !== 'object' || body === null) {
    json(res, 400, { error: 'Invalid policy payload' });
    return;
  }
  const input = body as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 80) {
    json(res, 400, { error: 'Policy name is required (max 80 chars)' });
    return;
  }
  const policy: SpendPolicy = {
    id: (typeof input.id === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(input.id) ? input.id : generateId('pol')) as PolicyId,
    name,
    description: typeof input.description === 'string' ? input.description.slice(0, 400) : undefined,
    enabled: input.enabled !== false,
    rules: parseRules(input.rules),
    budgets: parseBudgets(input.budgets),
    cooldownMs: typeof input.cooldownMs === 'number' && Number.isFinite(input.cooldownMs) && input.cooldownMs >= 0 && input.cooldownMs <= 86_400_000
      ? input.cooldownMs
      : undefined,
  };
  deps.policyEngine.loadPolicy(policy);
  json(res, 201, { policy });
}

const VALID_ACTIONS: readonly PolicyAction[] = ['allow', 'deny', 'require_approval', 'flag'];
const VALID_WINDOWS: readonly TimeWindow[] = ['per_transaction', 'hourly', 'daily', 'weekly', 'monthly'];

function parseRules(input: unknown): PolicyRule[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 20).flatMap((raw, index): PolicyRule[] => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 80) : '';
    if (!name) return [];
    const action = typeof row.action === 'string' && VALID_ACTIONS.includes(row.action as PolicyAction)
      ? row.action as PolicyAction
      : 'flag';
    const conditions = row.conditions && typeof row.conditions === 'object' && !Array.isArray(row.conditions)
      ? sanitizeConditions(row.conditions as Record<string, unknown>)
      : {};
    return [{
      id: typeof row.id === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(row.id) ? row.id : `rule_${index + 1}`,
      name,
      enabled: row.enabled !== false,
      priority: typeof row.priority === 'number' && Number.isFinite(row.priority) ? row.priority : index,
      conditions,
      action,
    }];
  });
}

function sanitizeConditions(input: Record<string, unknown>): PolicyRule['conditions'] {
  const strings = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 20) : undefined;
  const amount = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
  return {
    agents: strings(input.agents),
    recipients: strings(input.recipients),
    services: strings(input.services),
    minAmount: amount(input.minAmount),
    maxAmount: amount(input.maxAmount),
    currencies: strings(input.currencies),
  };
}

function parseBudgets(input: unknown): SpendPolicy['budgets'] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 8).flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    if (typeof row.window !== 'string' || !VALID_WINDOWS.includes(row.window as TimeWindow)) return [];
    if (typeof row.maxAmount !== 'number' || !Number.isFinite(row.maxAmount) || row.maxAmount < 0) return [];
    return [{
      window: row.window as TimeWindow,
      maxAmount: row.maxAmount,
      currency: typeof row.currency === 'string' ? row.currency.slice(0, 8) : undefined,
    }];
  });
}

function handleAlerts(deps: DashboardDeps, url: URL, res: ServerResponse) {
  const log = deps.getAlertLog?.() ?? [];
  const severity = url.searchParams.get('severity');
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '100', 10);
  const limit = Number.isNaN(rawLimit) ? 100 : Math.min(Math.max(rawLimit, 1), 500);
  const filtered = (severity ? log.filter((a) => a.severity === severity) : log).slice(-limit).reverse();
  json(res, 200, { alerts: filtered, count: filtered.length });
}

const VALID_DISPUTE_STATUSES: readonly DisputeStatus[] = [
  'open', 'investigating', 'resolved_refunded', 'resolved_denied', 'resolved_partial', 'escalated',
];

function handleDisputes(deps: DashboardDeps, url: URL, res: ServerResponse) {
  const status = url.searchParams.get('status');
  if (status && !VALID_DISPUTE_STATUSES.includes(status as DisputeStatus)) {
    json(res, 400, { error: `Invalid status. Valid values: ${VALID_DISPUTE_STATUSES.join(', ')}` });
    return;
  }
  const disputes = deps.disputes.query(status ? { status: status as DisputeStatus } : {});
  json(res, 200, { disputes, count: disputes.length });
}

function handleDisputeDetail(deps: DashboardDeps, id: string, res: ServerResponse) {
  const all = deps.disputes.query({});
  const dispute = all.find((d) => d.id === id);
  if (!dispute) {
    json(res, 404, { error: 'Not found' });
    return;
  }
  json(res, 200, { dispute, provenance: deps.provenance.getChain(dispute.transactionId) });
}

function handleAgents(deps: DashboardDeps, res: ServerResponse) {
  if (!deps.registry) {
    json(res, 200, { agents: [], message: 'No AgentRegistry configured' });
    return;
  }
  json(res, 200, { agents: deps.registry.list() });
}

function handleAgentDetail(deps: DashboardDeps, id: string, res: ServerResponse) {
  if (!deps.registry) {
    json(res, 404, { error: 'No registry' });
    return;
  }
  const agent = deps.registry.get(id as AgentId);
  if (!agent) {
    json(res, 404, { error: 'Not found' });
    return;
  }
  const txs = deps.tracker.query({ agentId: id as AgentId, limit: 50 });
  const report = deps.analytics.getAgentAnalytics(id as AgentId, 'daily');
  json(res, 200, {
    agent,
    transactions: txs,
    topRecipients: report.topRecipients,
    timeSeries: report.timeSeries,
  });
}

function handleStats(deps: DashboardDeps, res: ServerResponse) {
  const txs = deps.tracker.query({ limit: 1000 });
  const completed = txs.filter((t) => t.status === 'completed');
  const blocked = txs.filter((t) => t.status === 'rejected' || t.status === 'failed');
  const flagged = txs.filter((t) => t.metadata?.riskAction === 'flag');
  const risk = calculateRiskScore(deps);
  json(res, 200, {
    totalTransactions: deps.tracker.size,
    completed: completed.length,
    blocked: blocked.length,
    flagged: flagged.length,
    completedInr: completed.reduce((s, t) => s + t.amount, 0),
    blockedInr: blocked.reduce((s, t) => s + t.amount, 0),
    flaggedInr: flagged.reduce((s, t) => s + t.amount, 0),
    merchants: deps.registry?.size ?? deps.tracker.agents.length,
    openDisputes: deps.disputes.query({ status: 'open' }).length,
    risk,
    hours: spendByHour(deps),
  });
}

function handleSSE(clients: Set<ServerResponse>, maxConnections: number, req: IncomingMessage, res: ServerResponse) {
  if (clients.size >= maxConnections) {
    json(res, 429, { error: 'Too many SSE connections', max: maxConnections });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('data: {"type":"connected"}\n\n');
  clients.add(res);
  req.on('close', () => { clients.delete(res); });
}

function serveStatic(root: string, requestPath: string, res: ServerResponse): boolean {
  const relative = requestPath.replace(/^\/+/, '');
  const dest = resolve(root, normalize(relative));
  if (!dest.startsWith(root)) return false;
  if (!existsSync(dest) || !statSync(dest).isFile()) return false;
  const type = MIME[extname(dest)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  createReadStream(dest).pipe(res);
  return true;
}

function handleHTML(frontendDist: string, res: ServerResponse) {
  const index = join(frontendDist, 'index.html');
  if (existsSync(index)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    createReadStream(index).pipe(res);
    return;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>VaultMind Dashboard</title>
<style>
body{font-family:monospace;background:#0d1117;color:#c9d1d9;max-width:80ch;margin:0 auto;padding:2rem;font-size:14px}
h1{font-size:1.2em;color:#f0f6fc}
pre{background:#161b22;border:1px solid #21262d;padding:1em;overflow-x:auto;font-size:13px}
.endpoint{color:#58a6ff;cursor:pointer}
</style></head><body>
<h1>VaultMind Dashboard</h1>
<p>Risk API. Build the React console with <code>npm run dev -w packages/dashboard/frontend</code>.</p>
<p><span class="endpoint" onclick="load('/api/status')">/api/status</span> |
<span class="endpoint" onclick="load('/api/metrics')">/api/metrics</span> |
<span class="endpoint" onclick="load('/api/transactions')">/api/transactions</span></p>
<pre id="output">Click an endpoint above.</pre>
<script>
async function load(path){
  const r=await fetch(path);
  document.getElementById('output').textContent=JSON.stringify(await r.json(),null,2);
}
</script></body></html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}
