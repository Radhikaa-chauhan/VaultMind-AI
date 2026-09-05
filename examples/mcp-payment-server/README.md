# PaySentry MCP Payment Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that demonstrates how PaySentry protects AI agent payments with spending limits, policy enforcement, and audit trails.

This is a **reference implementation** for MCP server builders who want to add payment controls to their AI agent tooling.

## What It Does

When an AI agent (Claude, GPT, etc.) calls the `pay` tool, every payment goes through the PaySentry pipeline:

```
Agent calls "pay" → PolicyEngine evaluates → MockX402 executes → SpendTracker records → SpendAlerts monitors
```

- **Allowed?** Payment executes, balance updates, transaction recorded.
- **Blocked?** Agent receives a clear explanation (e.g., "exceeds $100 per-transaction limit").
- **Requires approval?** Payment queued, agent told to wait for human operator.

## Quick Start

### 1. Install dependencies

```bash
cd examples/mcp-payment-server
npm install
```

### 2. Run the server

```bash
npx tsx src/index.ts
```

The server uses **stdio transport** — it reads JSON-RPC from stdin and writes to stdout. Startup info goes to stderr.

### 3. Connect to Claude Desktop

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "paysentry-payments": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/examples/mcp-payment-server/src/index.ts"],
      "env": {
        "PAYSENTRY_MAX_PER_TX": "100",
        "PAYSENTRY_MAX_DAILY": "500",
        "PAYSENTRY_INITIAL_BALANCE": "10000"
      }
    }
  }
}
```

### 4. Connect to VS Code (Copilot)

In `.vscode/mcp.json`:

```json
{
  "servers": {
    "paysentry-payments": {
      "command": "npx",
      "args": ["tsx", "${workspaceFolder}/examples/mcp-payment-server/src/index.ts"]
    }
  }
}
```

## Tools

### `pay`

Initiate a payment. Every payment is evaluated against spending policies before execution.

| Parameter   | Type     | Required | Description |
|-------------|----------|----------|-------------|
| `recipient` | string   | yes      | URL, service name, or wallet address |
| `amount`    | number   | yes      | Payment amount (positive number) |
| `currency`  | string   | no       | Currency code (default: "USD") |
| `reason`    | string   | yes      | Human-readable purpose |

**Example conversation:**

```
User: Pay $25 to api.openai.com for GPT-4 tokens

Agent calls: pay(recipient="https://api.openai.com/v1/chat", amount=25, currency="USD", reason="GPT-4 API tokens for market research")

Response: Payment completed successfully.
  Amount: $25.00 USD
  Recipient: https://api.openai.com/v1/chat
  Transaction ID: ps_19478a3f_7k2m
  Remaining balance: $9975.00
```

**Blocked example:**

```
User: Pay $150 to expensive-service.com

Response: Payment BLOCKED.
  Amount: $150.00 USD
  Reason: Payment blocked: Rule "Block transactions above 100 USD" matched: action=deny
  Policy action: deny
  Triggered rule: Block transactions above 100 USD
```

### `check_balance`

Query current wallet balance and budget utilization.

| Parameter  | Type   | Required | Description |
|------------|--------|----------|-------------|
| `currency` | string | no       | Currency to check |

**Example output:**

```
Wallet Balance: $9975.00 USD

Spending Summary:
  Total spent: $25.00
  Transactions: 1

Budget Utilization:
  Hourly: $25.00 / $200.00 (remaining: $175.00)
  Daily:  $25.00 / $500.00 (remaining: $475.00)

Policy Limits:
  Max per transaction: $100
  Approval required above: $50
```

### `payment_history`

Retrieve transaction audit trail.

| Parameter  | Type   | Required | Description |
|------------|--------|----------|-------------|
| `limit`    | number | no       | Max results (default: 10, max: 100) |
| `agent_id` | string | no       | Filter by agent ID |

## Spending Policies (Default)

| Rule | Limit | Action |
|------|-------|--------|
| Per-transaction cap | $100 | **Block** |
| Human approval threshold | $50 | **Require approval** |
| Hourly budget | $200 | **Block** when exceeded |
| Daily budget | $500 | **Block** when exceeded |

## Alert Rules (Default)

| Alert | Trigger | Severity |
|-------|---------|----------|
| Large transaction | > $50 | Warning |
| Rate spike | > 5 tx/min | Critical |
| New recipient | First payment to a recipient | Info |

## Customizing Policies

Override defaults with environment variables:

```bash
# Tighter limits for production
PAYSENTRY_MAX_PER_TX=50 \
PAYSENTRY_MAX_DAILY=200 \
PAYSENTRY_MAX_HOURLY=100 \
PAYSENTRY_APPROVAL_ABOVE=25 \
PAYSENTRY_INITIAL_BALANCE=5000 \
PAYSENTRY_CURRENCY=USDC \
npx tsx src/index.ts
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  AI Agent (Claude)               │
│           "Pay $25 to api.openai.com"            │
└────────────────────┬────────────────────────────┘
                     │ MCP (stdio)
┌────────────────────▼────────────────────────────┐
│            MCP Payment Server                    │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │   pay     │  │ balance  │  │   history     │  │
│  │   tool    │  │  tool    │  │    tool       │  │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │              │               │           │
│  ┌────▼──────────────▼───────────────▼────────┐  │
│  │           PaySentry Stack                   │  │
│  │                                             │  │
│  │  ┌─────────────┐  ┌──────────────────────┐  │  │
│  │  │ PolicyEngine │  │    SpendTracker      │  │  │
│  │  │  (Control)   │  │    (Observe)         │  │  │
│  │  └──────┬──────┘  └──────────┬───────────┘  │  │
│  │         │                    │              │  │
│  │  ┌──────▼──────┐  ┌─────────▼────────────┐  │  │
│  │  │  MockX402   │  │   SpendAlerts        │  │  │
│  │  │  (Sandbox)  │  │   (Observe)          │  │  │
│  │  └─────────────┘  └──────────────────────┘  │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

## For MCP Server Builders

This example shows the pattern for adding PaySentry to any MCP server that handles payments:

1. **Create a `PaySentryStack`** with your policy configuration
2. **Call `stack.processPayment()`** before executing any real payment
3. **Check the result**: `blocked`, `requires_approval`, or `completed`
4. **Use `stack.getBalanceInfo()`** to show budget utilization
5. **Use `stack.getPaymentHistory()`** for audit trails

Replace `MockX402` with a real payment backend (Stripe, x402, ACP) for production use.

## License

MIT
