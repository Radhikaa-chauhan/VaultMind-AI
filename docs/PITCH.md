# VaultMind AI — 5-minute video script

Razorpay AI Buildathon · Track 02: AI Risk Manager

This script is deliberately narrow: one merchant-loss problem, a working
decision flow, measured results, AI judgment, and one engineering failure.

## Before recording

1. Use a 1920×1080 recording canvas and close notifications.
2. Keep these ready:
   - Browser: `http://127.0.0.1:5173`
   - Terminal: project root
   - Editor: `packages/observe/src/fraud-spike.ts`
3. Run `npm run dev:ui` before recording.
4. Stop any old demo on port 3100. Start `npm run demo` when prompted below.
5. Do not show installs, warnings, or setup work in the final video.

## 0:00–0:25 — Hook

**On screen:** Browser on the Overview page. Face camera is optional; keep the
product visible.

**Say:**

“At 2 AM, a café’s merchant ID sends six UPI collects to a beneficiary it has
never seen before. Is that a late-night rush, or a fraud spike?

If the merchant waits for the chargeback to find out, the money is already
gone.

I built VaultMind AI to make that decision before settlement.”

## 0:25–0:55 — Define the problem and scope

**On screen:** Keep Overview visible.

**Say:**

“For Razorpay’s AI Risk Manager track, I deliberately chose one class of loss:
fraud spikes in Indian merchant payments.

VaultMind evaluates synthetic UPI, card, and netbanking traffic in INR. It
detects velocity bursts, unfamiliar beneficiaries and devices, unusual
amounts, night-time UPI activity, card-not-present high tickets, and
credential-testing patterns.

This is strictly defense-only, and the demo uses no live payment keys.”

## 0:55–2:05 — Show the working detector

**On screen:** Briefly switch to the terminal and run:

```bash
npm run demo
```

Show several `ALLOWED`, `flag`, and `BLOCKED` lines arriving, then return to the
Overview page.

**Say:**

“I’ll replay a deterministic session across three merchants: a Bengaluru café,
an electronics merchant, and a D2C brand.

The first five payments establish normal behavior and settle. Then six rapid
UPI collects hit the same unknown VPA. Because each amount is small, VaultMind
flags the burst for review instead of blindly blocking customer traffic.

Next, a twenty-two-thousand-rupee payout to a known mule beneficiary is denied
by policy. A card-not-present laptop payment, following four failures, reaches
a risk score of eighty and is blocked by the scorer.

The session finishes with fifteen payments: twelve allowed, three blocked, and
one lakh two thousand nine hundred ninety-nine rupees kept off the rails.”

**On screen:** Point to “INR blocked this session,” the risk posture, and the
live event feed.

## 2:05–2:50 — Prove explainability and bounded decisions

**On screen:** Open **Payments** and expand the stolen-card row. Then open
**Rules**.

**Say:**

“Every decision is inspectable. Expanding a payment shows the score and the
specific contributing reasons; there is no unexplained ‘AI says fraud’ result.

The decision system has two bounded layers. PolicyEngine handles deterministic
controls such as blocked beneficiaries, amount caps, approvals, and budgets.
The explainable scorer handles uncertain behavior and maps it to allow, flag,
or block using thresholds at forty-two and seventy-two.

I did not use an LLM for payment authorization. A generative model would add
latency and non-determinism where reproducibility and auditability matter
more.”

## 2:50–3:50 — Show the metrics Razorpay asked for

**On screen:** Open **Model card**. Pause long enough for every number to be
read.

**Say:**

“A polished dashboard is not evidence, so I evaluated the detector on three
hundred labeled synthetic INR payments using a chronological eighty-twenty
split. The holdout contains sixty payments; earlier traffic only warms the
rolling history.

Detection precision is sixty-seven point four percent, recall is seventy-nine
point five percent, and F1 is point seven-two-nine.

I also report the cost of being wrong: five legitimate high-value payments
were blocked, creating a false-positive cost of three lakh thirty-three
thousand nine hundred twenty-five rupees. Stealth daytime fraud also remains a
known miss.

These are prototype numbers, not cherry-picked production claims. The next
iteration would tune thresholds by merchant category and optimize expected
loss: prevented fraud minus customer-friction cost.”

## 3:50–4:20 — Explain architecture and build quality

**On screen:** Show the architecture section in `README.md`, or the project
tree with `core`, `control`, `observe`, `protect`, `dashboard`, and `mcp`.

**Say:**

“The implementation is a TypeScript monorepo. Transactions pass through the
risk scorer and deterministic policy engine, then into tracking, alerts,
provenance, and disputes. The Node API streams state changes to the React
console over Server-Sent Events, and a local snapshot preserves demo state.

The scorer and dashboard are independently testable, and one command
reproduces the held-out evaluation.”

## 4:20–4:42 — Show failure recovery

**On screen:** Open `packages/mcp/src/stack.ts` at the custom-rail settlement
branch, or keep the architecture visible.

**Say:**

“One real failure shaped the design. The inherited x402 sandbox correctly
rejected UPI VPAs because x402 recipients must be HTTP URLs. I did not weaken
that validation. I added a separate synthetic merchant-rail path and left x402
behavior intact. That fixed the demo without creating a protocol bypass.”

## 4:42–5:00 — Close on business value

**On screen:** Open **Chargebacks**, then return to **Overview** for the final
line.

**Say:**

“The final soundbar payment settles but later becomes a chargeback, so VaultMind
opens a case with its audit trail. That makes misses visible instead of hiding
them.

VaultMind AI: hard controls for known risk, explainable scoring for grey
traffic, and honest measurement of both fraud caught and customers affected.”

## Recording rule

Do not tour every menu. The reviewer should leave remembering only:

1. One loss class: fraud spikes.
2. A working allow / flag / block flow.
3. Explainable decisions.
4. Held-out precision, recall, and false-positive cost.
5. One failure recovered without weakening security.
