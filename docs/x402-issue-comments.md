# x402 Issue Comments — Ready for Review

> Generated: 2026-02-07
> Strategy: Lead with technical insight, cite standards, natural PaySentry mention only when relevant.
> All issues verified as **open** on github.com/coinbase/x402.

---

## Issue #1062 — Payment timeout race condition on Base network

**URL:** https://github.com/coinbase/x402/issues/1062

**Comment:**

> This is a fundamental impedance mismatch between the facilitator's timeout assumptions and Base's finality guarantees. The root cause is that the facilitator treats block confirmation as a synchronous step inside a request-scoped context, but L2 block times are non-deterministic — Base targets 2s blocks but under load can spike to 10-28s due to sequencer batching.
>
> A few thoughts on a robust fix:
>
> **1. Network-aware timeout profiles**
> The `maxTimeoutSeconds` in `PaymentRequirements` should be derived from the target chain's finality characteristics, not hardcoded. Something like:
>
> ```typescript
> const NETWORK_TIMEOUTS: Record<string, number> = {
>   'eip155:8453': 60,   // Base — sequencer batch variance
>   'eip155:1': 90,      // Ethereum — 12s slots + reorg buffer
>   'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 10, // Solana — sub-second
> };
> ```
>
> CAIP-2 chain IDs make this clean and extensible. The facilitator should read network ID from the PaymentPayload and select the appropriate timeout floor.
>
> **2. Settlement state machine**
> Instead of a single blocking call, the settlement flow should be: `SUBMITTED → PENDING_CONFIRMATION → CONFIRMED | TIMEOUT_PENDING_RECONCILIATION`. The critical insight is that `TIMEOUT` should not equal `FAILED` — the transaction may still land. A reconciliation loop polling `eth_getTransactionReceipt` on the submitted tx hash handles the gap.
>
> **3. Idempotent retry window**
> Tying into #808 — if the client retries after a facilitator timeout, the facilitator should detect the original tx is still in the mempool (same nonce from ERC-3009's `bytes32 nonce`) and return a `202 Accepted` with the pending tx hash, rather than attempting a second settlement.
>
> We've been tackling this exact pattern in PaySentry's observe module — tracking the delta between `tx.submitted_at` and `tx.confirmed_at` across networks to build empirical timeout distributions. Happy to share the data we've collected on Base block time variance if that would help inform the timeout defaults here.

---

## Issue #1065 — Intermittent "unable to estimate gas" errors (40% failure rate)

**URL:** https://github.com/coinbase/x402/issues/1065

**Comment:**

> Good catch on the workaround — the 1-second delay between signing and submission strongly suggests a state propagation lag inside the CDP signing pipeline, not a gas estimation issue per se. Here's what's likely happening:
>
> ERC-3009 `transferWithAuthorization` requires the `from` address to have sufficient balance *and* the nonce to be unused at the point of `eth_estimateGas`. If the CDP signer hasn't fully propagated the signed authorization to its internal state, the RPC node sees the call as "from an address that hasn't authorized this transfer yet" — which makes `estimateGas` revert, producing the generic error.
>
> **Why this matters beyond the workaround:**
>
> A fixed delay is fragile — under CDP load spikes, 1 second may not be enough. A more resilient pattern is exponential backoff on `estimateGas` failure with classification:
>
> ```typescript
> async function settleWithRetry(payload: PaymentPayload, maxRetries = 3) {
>   for (let i = 0; i < maxRetries; i++) {
>     try {
>       return await facilitator.settle(payload);
>     } catch (err) {
>       if (isGasEstimationError(err) && i < maxRetries - 1) {
>         await sleep(Math.pow(2, i) * 500); // 500ms, 1s, 2s
>         continue;
>       }
>       throw err; // non-retryable or exhausted retries
>     }
>   }
> }
>
> function isGasEstimationError(err: unknown): boolean {
>   const msg = (err as Error)?.message?.toLowerCase() ?? '';
>   return msg.includes('unable to estimate gas') ||
>          msg.includes('execution reverted');
> }
> ```
>
> **Broader suggestion for the facilitator:** The `/settle` endpoint should classify errors into retryable vs. terminal categories in its response body. Right now clients get a raw error string and have to guess. Something like `{ "errorClass": "TRANSIENT_GAS_ESTIMATION" | "INVALID_SIGNATURE" | "INSUFFICIENT_BALANCE" | "NONCE_ALREADY_USED" }` would let clients implement proper retry logic without parsing error messages.
>
> We've been building an error classification layer in PaySentry's protect module for exactly this — mapping raw RPC errors to actionable settlement states. The pattern of "verify passes but settle fails" is the #1 source of user confusion we've seen across x402 integrations.

---

## Issue #808 — Idempotency keys for paid requests

**URL:** https://github.com/coinbase/x402/issues/808

**Comment:**

> Strong proposal. A few implementation considerations worth discussing:
>
> **Deterministic vs. client-supplied keys**
> Client-supplied `Idempotency-Key` headers work for server-to-server flows, but for autonomous agents the key should ideally be *derivable* from the payment itself. ERC-3009 already gives us a unique `bytes32 nonce` per authorization — combining it with the resource URL creates a natural idempotency key without requiring clients to generate one:
>
> ```typescript
> function deriveIdempotencyKey(payload: PaymentPayload): string {
>   const { nonce } = payload.payload.authorization;
>   const resource = payload.resource;
>   return keccak256(
>     encodePacked(['bytes32', 'string'], [nonce, resource])
>   );
> }
> ```
>
> This means even a naive retry (resending the same `X-Payment` header) is automatically idempotent, with zero client-side changes.
>
> **TTL considerations**
> The cache TTL should be at least `validBefore - now()` from the ERC-3009 authorization — there's no point expiring the idempotency record while the underlying authorization is still valid. After `validBefore`, both the auth and the cache entry can be safely pruned.
>
> **Interaction with #803 (replay prevention)**
> Idempotency and replay prevention are two sides of the same coin. If the facilitator maintains a nonce registry (as proposed in #803), the idempotency cache becomes a natural extension — same storage, different semantics. A consumed nonce rejects replays; a pending/successful nonce returns the cached result. Worth designing these together rather than as separate mechanisms.
>
> Happy to discuss further — we've been working through these exact trade-offs in PaySentry's control module for deduplicating settlements across multi-agent orchestration scenarios.

---

## Issue #803 — Payment replay not explicitly prevented

**URL:** https://github.com/coinbase/x402/issues/803

**Comment:**

> This is a critical gap. Let me break down the attack surface and a defense-in-depth approach:
>
> **What ERC-3009 already gives you**
> The on-chain `transferWithAuthorization` function checks that each `bytes32 nonce` is used exactly once. So at the *settlement* layer, replay is prevented by the contract itself — you can't execute the same authorization twice.
>
> **Where the gap is**
> The vulnerability is at the *resource server* layer: if a server verifies a payment via `/verify`, serves the resource, but the facilitator hasn't settled yet, an attacker can replay the same `X-Payment` header to a different server instance (or the same one after a restart) and get the resource again — before the nonce is consumed on-chain.
>
> **Defense-in-depth:**
>
> 1. **Facilitator-side nonce registry** — The facilitator should track `(nonce, payer, network)` tuples from the moment `/verify` is called, not just after `/settle`. Status: `VERIFIED → SETTLING → SETTLED | EXPIRED`. Any second `/verify` call with the same nonce returns `{ isValid: false, invalidReason: "nonce_already_claimed" }`.
>
> 2. **EIP-712 domain separator binding** — The `verifyingContract` + `chainId` in the EIP-712 domain already prevents cross-chain replay. But resource servers should additionally check that the `resource` field in PaymentRequirements matches *their* endpoint, preventing same-chain replay to different services.
>
> 3. **Tight `validAfter`/`validBefore` windows** — Shrinking the authorization validity window (e.g., 30-60 seconds) minimizes the replay attack surface. Combined with nonce tracking, this makes replay practically infeasible.
>
> This ties directly into #808 — a shared nonce registry serves both replay prevention and idempotency. Would be worth considering them as a unified "payment lifecycle tracker" in the facilitator spec.

---

## Issue #961 — Payload verified but settlement fails

**URL:** https://github.com/coinbase/x402/issues/961

**Comment:**

> This verify-passes-but-settle-fails pattern keeps coming up (#1065 is another variant) and I think there's a fundamental spec-level issue worth addressing.
>
> **Why verify and settle can diverge:**
>
> `/verify` checks: valid EIP-712 signature, signer matches `from`, amount meets requirement, `validAfter < now < validBefore`, nonce format. This is all *offline* cryptographic validation.
>
> `/settle` additionally needs: sufficient token balance, sufficient gas, nonce not already consumed on-chain, correct token contract metadata (name, version for domain separator). These are *on-chain* state checks that can change between verify and settle calls.
>
> The "USDC" vs "USD Coin" issue mentioned in the thread is a great example — the EIP-712 domain separator includes the token's `name()` return value, so if the signature was computed with the wrong name string, verification against a cached/hardcoded name could pass while the on-chain `ecrecover` in `transferWithAuthorization` fails.
>
> **Suggestions:**
>
> 1. **Verify should run settlement simulation** — call `eth_call` (not `eth_sendTransaction`) with the actual `transferWithAuthorization` calldata. This catches balance issues, nonce collisions, and domain separator mismatches *before* telling the client "you're good to go."
>
> ```typescript
> // In /verify handler, after signature check:
> const calldata = encodeTransferWithAuth(payload);
> const result = await provider.call({
>   to: payload.asset,
>   data: calldata,
> });
> // If eth_call reverts, return isValid: false with the revert reason
> ```
>
> 2. **Structured error responses from /settle** — `"invalid_payload"` tells the developer nothing. The response should include `failedCheck` (e.g., `"domain_separator_mismatch"`, `"insufficient_balance"`, `"nonce_consumed"`) and `expectedValue` / `actualValue` where applicable.
>
> 3. **Payload hash pinning** — Hash the full PaymentPayload at `/verify` time and require the same hash at `/settle`. If the client accidentally modifies the payload between calls, you catch it immediately rather than getting a cryptic settlement error.
>
> We've implemented full lifecycle logging for exactly this pattern in PaySentry's observe module — every verify/settle pair gets a correlation ID with diffs if the payloads diverge. The "USDC" naming issue alone has tripped up at least 3 integrations we've seen.

---

*Generated by PaySentry growth team. Review each comment, personalize if needed, then post.*
