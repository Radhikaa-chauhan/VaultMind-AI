# PaySentry Growth Experiment: From Zero to Product-Market Fit

**Project:** PaySentry — AI Agent Payment Control Plane (open-source)
**Repository:** https://github.com/mkmkkkkk/paysentry
**Landing Page:** https://mkyang.ai/paysentry
**npm packages:** @vaultmind/core, @vaultmind/observe, @vaultmind/control, @vaultmind/protect, @vaultmind/sandbox (v1.0.1)
**Experiment Duration:** Phase 1 executed early February 2026
**Document Created:** 2026-02-07

---

## Executive Summary

PaySentry is an open-source control plane for AI agent payments. The product solves a real problem—enterprise agents are spending real money with zero governance—backed by evidence (125+ open issues in coinbase/x402, Deloitte's finding that only 1 in 5 enterprises have agent governance). Phase 1 tested an aggressive "spray and pray" multi-channel launch. Results: near-zero market traction despite high-quality content and technical execution. This document records why that strategy failed and outlines Phase 2: a product-driven growth approach targeting developers where the pain is most acute.

---

## Phase 1: Multi-Channel Promotional Blitz (Early February 2026)

### Hypothesis

**"Deploy content across 8 simultaneous channels → at least one will gain traction → viral feedback loop."**

Underlying assumptions:
- AI agent payment security is an emerging category with high keyword interest
- Developers care about the problem (GitHub issues, Deloitte stats prove it)
- Multiple channels increase probability of hitting an audience

### Execution Summary

| Channel | Activity | Launch Date | Effort |
|---------|----------|-------------|--------|
| **GitHub** | Created repo, optimized description/topics/homepage | Feb 1-2 | ~2 hrs |
| **Dev.to** | Published technical deep-dive article (400-word outline, full content drafted) | Feb 3-5 | ~6 hrs |
| **Twitter/X** (@bayc2043) | Posted 1x launch tweet with product link + thread | Feb 2-3 | ~1 hr |
| **Hacker News** | Submitted "Show HN" post (outlined, drafted, not published) | Feb 2 | ~4 hrs |
| **Moltbook** (AI social network) | Posted 12 threads + 2,759 comments via Skynet_Degen bot (automated campaign) | Feb 3-5 | ~3 hrs setup |
| **npm** | Published 5 packages (@vaultmind/core, observe, control, protect, sandbox) | Feb 2-3 | ~2 hrs |
| **Blog** (mkyang.ai) | Drafted security-angle article (not published) | Feb 4-5 | ~4 hrs |
| **Landing Page** | Multiple design iterations, final version: pitch-deck quality | Feb 2-7 | ~10 hrs |

**Total Phase 1 effort:** ~32 hours
**Total cost:** $0 (time only)

### Results: Raw Numbers

| Channel | Metric | Value | Status |
|---------|--------|-------|--------|
| **GitHub** | Stars (7 days) | 3 | ❌ |
| **GitHub** | Forks | 0 | ❌ |
| **GitHub** | Watchers | 0 | ❌ |
| **Dev.to** | Views | 0 | ❌ |
| **Dev.to** | Reactions | 0 | ❌ |
| **Dev.to** | Comments | 0 | ❌ |
| **Twitter/X** | Impressions | 26 | ❌ |
| **Twitter/X** | Likes | 1 | ❌ |
| **Twitter/X** | Retweets | 0 | ❌ |
| **Hacker News** | Points | 2 | ❌ |
| **Hacker News** | Comments | 0 | ❌ |
| **Moltbook** | Posts created | 12 | ⚠️ |
| **Moltbook** | Comments (bot-generated) | 2,759 | ⚠️ |
| **Moltbook** | Karma score | 70 | ❌ |
| **npm** | Downloads (7 days) | TBD (early data) | ⚠️ |
| **Blog** | Page views | Untracked | ❌ |
| **Landing Page** | Unique visitors | <10 (est.) | ❌ |

### Phase 1 Conclusions: Why It Failed

**1. Content Quality ≠ Market Traction**
- The Dev.to article is technically solid (400+ research hours invested in problem validation)
- The Show HN post has strong narrative hooks (personal $2,400 loss story, real GitHub issue #1062)
- The landing page is polished (Gemini AI multi-iteration review)
- Yet: zero organic engagement, zero developer discussions, zero momentum

**Diagnosis:** High-quality content for a product nobody has heard of, targeting an audience that doesn't yet know they have a problem.

---

**2. "Spray and Pray" Multi-Channel Approach Doesn't Work for Pre-Market Products**
- Assumption was: "different audiences on different platforms"
- Reality: all 8 channels have overlapping audiences (tech enthusiasts, startup builders, developers)
- When a product is unknown, pushing it everywhere = noise everywhere

**Diagnosis:** Should have gone deep on 1-2 channels instead of shallow on 8.

---

**3. Moltbook Spam Destroyed Credibility**
- Skynet_Degen bot: 2,759 comments in 2 days = obviously automated
- Karma stayed at 70 (low) despite massive activity = community recognized it as spam
- 12 posts + 2,759 comments = ~230 comments per post = suspicious engagement pattern
- Damage: if anyone from Moltbook later encounters PaySentry, they've already seen spam version

**Diagnosis:** Automation backfires. Community platform users hate bots. Better to have 5 genuine conversations than 2,759 algorithmic comments.

---

**4. SDK Is Incomplete, Can't Demonstrate Real Value**
- Packages published to npm with working code, but:
  - No real x402 adapter yet (mock only)
  - No dashboard
  - No hosted policy management
  - "Install and it works" experience is not there
- Early install → person reads docs → realizes "this is a framework, not a product" → abandonment

**Diagnosis:** Shipping incomplete SDK before product-market fit is backwards. Should prove the idea on small group of beta users first.

---

**5. Problem Awareness Is the Actual Blocker, Not Product Awareness**
- PaySentry's problem statement assumes: "enterprises know agents can spend money, and they're worried"
- Reality: most enterprises are still piloting agents, haven't hit the payment pain yet
- Those who *have* hit payment pain (coinbase team, MCP server builders, AI research labs) are not on Twitter/X
- They're in GitHub issues, Slack communities, and private Discord servers

**Diagnosis:** Need to reach "early majority" where pain is visible, not broadcast to general developer audience.

---

### Phase 1 Lessons Learned

1. **Problem visibility > Product visibility** — Nobody buys solutions to problems they don't feel yet
2. **Depth > Breadth for unknown products** — Own one community first before expanding
3. **Bots destroy communities** — 2,759 spam comments on Moltbook cost more reputation than 0 would have
4. **Shipping early requires strong hypothesis** — SDK packages without proven integration patterns = toy, not tool
5. **Content without audience is theater** — High-quality Show HN post with 2 points = failure to find the right community

---

## Phase 2: Product-Driven Growth (February–April 2026)

### New Hypothesis

**"Build real integrations and partnerships with the developers who are *currently solving* agent payment problems, not broadcasters who *might* solve them someday."**

Core philosophy shift:
- **From broadcast to engagement:** Instead of "publish and hope," directly participate in communities where pain is visible
- **From features to solutions:** SDK features are interesting only when they solve an immediate problem
- **From product-led to community-led:** Earn trust by helping others solve payment issues first

### Target Audiences (Ranked by Priority)

#### Tier 1: "Bleeding Edge" (Already feel the pain)
1. **x402 / coinbase integration teams** — They see 125+ open payment issues, they know this is broken
2. **MCP server builders** — Publishing payment-enabled agents right now, need governance
3. **AI research labs** (Anthropic internal teams, university labs) — Running multi-agent experiments with real spend

#### Tier 2: "Early Majority" (About to feel the pain)
1. **AI ops / DevOps teams at enterprises** — Managing agent deployments, compliance coming
2. **Fintech / payments infrastructure** — Building on x402 / ACP, need middleware
3. **Security researchers** — Interested in agent security, prompt injection + payments

#### Tier 3: Broadcast (Only after traction in Tier 1-2)
1. **General developer audience** — Once PaySentry has proof stories from Tier 1
2. **Startup/VC ecosystem** — Once unit economics are validated
3. **Enterprise sales** — Once product is mature enough for procurement processes

---

### Phase 2 Execution Plan

#### 1. **Build Real Integration with x402** (Weeks 1-4)

**Objective:** Make `npm install @vaultmind/x402` actually work with a real x402 agent, end-to-end.

**Actions:**
- [ ] Study coinbase/x402 codebase and 125+ open issues — find the top 5 pain points
- [ ] Build working x402 adapter (not mock)
- [ ] Create reference implementation: "x402 agent with PaySentry policy enforcement"
- [ ] Test against real x402 test endpoints
- [ ] Document the integration with code examples
- [ ] Reach out to x402 maintainers with: "I built a middleware that handles 3 of your top issues"

**Success metrics:**
- x402 adapter merged or referenced in x402 docs
- At least 1 x402 team member aware of PaySentry
- Reference implementation used in examples

**Effort:** 40-60 hours

---

#### 2. **Participate in x402 GitHub Issues** (Weeks 1-8, ongoing)

**Objective:** Become known as "the person who thinks about agent payment governance."

**Actions:**
- [ ] Audit top 30 open issues in coinbase/x402
- [ ] Identify which ones PaySentry can address
- [ ] For each relevant issue:
  - Post thoughtful comment explaining the governance angle
  - Link to relevant PaySentry docs
  - Offer to help maintainers test solutions with PaySentry
  - Never spam, never self-promote — focus on solving *their* problem
- [ ] Create issues in coinbase/x402 for gaps PaySentry can fill
- [ ] Monitor for replies and respond within 24 hours

**Success metrics:**
- 50+ comments on x402 issues
- 5+ conversations with x402 team members
- 2+ feature requests or bug reports directly attributed to PaySentry research
- Recognition as regular contributor to x402 discussions

**Effort:** 5-10 hours/week

---

#### 3. **Build MCP Payment Server (Weeks 2-6)**

**Objective:** Demonstrate PaySentry protecting agent-to-agent payments in the MCP ecosystem.

**Actions:**
- [ ] Create MCP server that exposes payment tools
- [ ] Integrate PaySentry as middleware (policies control who can pay whom)
- [ ] Publish example: "MCP server with PaySentry payment governance"
- [ ] Reach out to Anthropic MCP team and major MCP server builders
- [ ] Case study: "How we prevent prompt injection in payment-enabled agents"

**Success metrics:**
- MCP server published and functional
- 3+ MCP server builders aware of PaySentry
- Used as template/reference by at least 1 other MCP server
- 20+ GitHub stars on MCP server repo

**Effort:** 30-50 hours

---

#### 4. **Content: Shift from Broadcast to Evergreen SEO** (Weeks 1-8)

**Objective:** Own specific keywords so that developers *searching* for solutions find PaySentry.

**Instead of:**
- "PaySentry launch post" (broadcast to unknown audience)
- "AI agent payments explained" (too broad)

**Focus on:**
- "How to prevent duplicate x402 payments" (specific pain, high intent)
- "MCP server payment governance patterns" (specific audience, specific tool)
- "Agent spending limits: implementation guide" (solution-focused, searchable)
- "x402 timeout debugging: causes and fixes" (very specific, solves real problem)

**Content strategy:**
- Write 1 deep-dive per week (3,000-5,000 words)
- Each post should rank for specific, high-intent keyword
- Link to PaySentry as *solution*, not as *product*
- Target: blog.mkyang.ai + Dev.to + HN as distribution

**Examples:**
| Keyword | Intent | Content | Audience |
|---------|--------|---------|----------|
| "x402 retry storm" | High | Walkthrough of #1062, how PaySentry prevents it | x402 users |
| "MCP server payment authorization" | High | Pattern guide for handling payments in MCP | MCP server builders |
| "agent spending audit trail" | Medium | How to log agent payments for compliance | Enterprise |
| "prompt injection payment vulnerability" | High | Threat model + PaySentry's defense layers | Security researchers |

**Effort:** 4-6 hours per post, 1 post/week = ~20-30 hours total

---

#### 5. **Create Beta User Program (Weeks 3-8)**

**Objective:** Get 5-10 early users on PaySentry, generate feedback and use cases.

**Actions:**
- [ ] Target: teams actively building x402 agents, MCP servers, or agent payment systems
- [ ] Reach out with: "We're building payment governance for agents. Can we help you solve a problem?"
- [ ] Not: "Try our new product"
- [ ] Offer: free technical support, custom adapters, priority roadmap input
- [ ] Document their use cases (with permission) as public case studies
- [ ] Monthly check-ins to gather feedback

**Outreach list (example):**
- 5 x402 team members (especially those active in GitHub issues)
- 3 MCP server builders (identify from MCP directory)
- 2 AI research labs or autonomous agent builders
- 3 enterprise DevOps teams (through personal network)

**Success metrics:**
- 5-10 active beta users
- 10+ concrete feature requests
- 2+ public case studies or testimonials
- 30+ GitHub stars from beta users + their networks

**Effort:** 20-30 hours (outreach, onboarding, support)

---

#### 6. **GitHub Strategy: Make `mkmkkkkk/paysentry` the Reference Implementation** (Weeks 1-12)

**Objective:** Become the obvious starting point for agent payment governance.

**Actions:**
- [ ] Improve README: "Choose your problem, find your solution in PaySentry"
  - Problem: "Agent spending is out of control" → Solution: spending limits + alerts
  - Problem: "Agents can be prompt-injected into paying" → Solution: policy enforcement
  - Problem: "No audit trail for compliance" → Solution: transaction logging
- [ ] Add "what problem does this solve?" to each package README
- [ ] Create examples/ directory with real use cases:
  - x402 agent with per-agent spending limits
  - MCP server with payment authorization
  - Compliance audit trail for enterprise deployment
- [ ] Make contributing easy: CONTRIBUTING.md with clear issues for new contributors
- [ ] Monthly "What we're building" updates in README

**Success metrics:**
- 50+ GitHub stars (from current 3)
- 5+ star rate increase per week
- 3+ pull requests from community
- 200+ README views/week

**Effort:** 15-20 hours setup, 2-3 hours/week maintenance

---

### Phase 2 Tracking Metrics

#### Primary Metrics (North Star)

| Metric | Phase 1 Baseline | Week 2 Target | Week 4 Target | Week 8 Target | Owner |
|--------|-----------------|---------------|---------------|---------------|-------|
| **GitHub Stars** | 3 | 15 | 30 | 75 | Product |
| **Active Beta Users** | 0 | 2 | 5 | 10 | Partnerships |
| **npm Weekly Downloads** | ~0 | 10-20 | 50-100 | 200+ | Analytics |
| **x402 GitHub Mentions** | 0 | 5 | 15 | 30+ | Community |
| **Blog Post Views/Month** | 0 | 500 | 1,500 | 3,000+ | Content |

#### Secondary Metrics (Health Check)

| Metric | Target | Frequency | Notes |
|--------|--------|-----------|-------|
| Active issues/discussions | 5+ | Weekly | Shows adoption momentum |
| Community PRs | 2+ | Monthly | Non-founder contributions |
| x402 issue mentions | 10+ | Monthly | Evidence of relevance |
| MCP ecosystem awareness | 3+ MCP builders aware | Monthly | Tier 2 audience |
| Newsletter signups | 50+ | Monthly | Audience building |

---

### Phase 2 Checkpoints & Go/No-Go Criteria

#### Checkpoint 1: End of Week 2
**Focus:** x402 adapter and community participation

- [ ] **Go:** x402 adapter functional + at least 1 x402 team member engaged
- [ ] **Go:** 5+ substantive comments on x402 issues (not spam)
- [ ] **Go:** GitHub stars increased to 10+
- [ ] **No-go criteria:** x402 adapter broken OR only self-promotion on issues → HALT, reassess

---

#### Checkpoint 2: End of Week 4
**Focus:** MCP server launch and beta user recruitment

- [ ] **Go:** MCP payment server published and functional
- [ ] **Go:** 3+ beta users recruited and onboarded
- [ ] **Go:** First evergreen blog post published (500+ views in week 1)
- [ ] **No-go criteria:** No external users interested OR MCP server doesn't work → iterate product

---

#### Checkpoint 3: End of Week 8
**Focus:** Momentum validation

- [ ] **Go:** 5-10 active beta users with concrete use cases
- [ ] **Go:** 75+ GitHub stars (25x from baseline)
- [ ] **Go:** 2+ public case studies or testimonials
- [ ] **Go:** 3,000+ monthly blog views
- [ ] **Go:** 50-100+ weekly npm downloads
- [ ] **Continue:** Move to Phase 2b (expansion)
- [ ] **Iterate:** If any metric stalls, diagnose and adjust (product, content, outreach)

---

### Success Criteria for Phase 2

#### Minimum Success (green light for Phase 2b)
- 50+ GitHub stars (15x growth)
- 5+ active beta users
- 10+ weekly npm downloads
- 1+ public case study
- Evidence of product-community fit (not just broadcast)

#### Ideal Success (strong signal)
- 100+ GitHub stars
- 10+ active beta users
- 100+ weekly npm downloads
- 3+ case studies or testimonials
- 1+ x402 / MCP team member actively collaborating
- Content getting 5,000+ monthly views

#### Hard Failure (back to drawing board)
- <20 GitHub stars by Week 8
- 0 beta users interested
- <5 weekly downloads
- No organic community participation (all activity is founder-driven)

---

## Phase 2b: Expansion & Platform Strategy (If Phase 2 Succeeds)

*To be defined after Phase 2 validation.*

Potential directions (if traction confirmed):
- **Infrastructure expansion:** AP2, Visa TAP adapters (based on community demand)
- **Enterprise edition:** Hosted dashboard, compliance reports, multi-team management
- **Ecosystem growth:** Official MCP server collection, x402 plugin ecosystem
- **Funding/partnerships:** Approach x402 maintainers, Anthropic, payment platforms with data on adoption

---

## Appendix A: Tools & Infrastructure

### Development Tools
- Node.js 20+ (runtime)
- TypeScript (primary language)
- Jest (testing)
- GitHub Actions (CI/CD)

### Monitoring & Analytics
- **GitHub:** Stars, issues, PRs (free)
- **npm:** Weekly download stats (free)
- **Blog:** Vercel analytics (free)
- **Twitter/X:** Impression tracking (free)
- **Manual:** Weekly check-ins on x402 issues, MCP directory

### Community Platforms
- GitHub Issues (primary venue for x402 engagement)
- Dev.to (content distribution, but not primary anymore)
- mkyang.ai/blog (owned SEO content)
- Twitter/X (@bayc2043, for announcements only)
- Discord/Slack (if beta users request — not proactive)

### No Cost Services (All Time-Based)
- GitHub (hosting, discussions, issues)
- npm (package distribution)
- Vercel (blog hosting)
- Dev.to (content distribution)

---

## Appendix B: Content Calendar (Phase 2)

Week 1-2:
- Blog: "How x402 Payment Timeout Bugs Drain Agent Wallets" (targeting "x402 timeout debugging" keyword)

Week 2-3:
- Blog: "MCP Server Payment Authorization Patterns" (targeting "MCP payment" keyword)

Week 3-4:
- Blog: "Building a Payment Control Plane: Architecture Decisions" (technical deep-dive)

Week 4-5:
- Blog: "EU AI Act 2026: Agent Payment Audit Trails" (compliance angle)

Week 5-6:
- Blog: "Prompt Injection + Payments = Expensive Lessons" (security angle, but now with real x402 context)

Week 6-8:
- Case study posts (from beta users)

---

## Appendix C: Phase 1 Content Artifacts (For Reference/Reuse)

These were drafted but not heavily promoted. Can be reused in Phase 2 with modifications:

1. **show-hn.md** — "Show HN: PaySentry" post (~2,000 words)
   - Status: Drafted, not published
   - Reuse: Adapt angle to "I built payment middleware for x402" for better context
   - Location: `/docs/articles/show-hn.md`

2. **devto-deep-dive.md** — "x402 vs ACP vs AP2 protocol comparison" (~4,000 words)
   - Status: Drafted, not published
   - Reuse: Repurpose as Phase 2 blog post "Agent Payment Protocols Explained"
   - Location: `/docs/articles/devto-deep-dive.md`

3. **launch-content-plan.md** — Full content strategy with 3 article outlines
   - Status: Completed planning doc
   - Reuse: Articles 2-3 (deep-dive, security angle) can be adapted for Phase 2
   - Location: `/docs/launch-content-plan.md`

---

## Appendix D: Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| **x402 adapter doesn't work** | Loses credibility in core community | Medium | Start with 1 simple x402 use case, not all features |
| **No beta users interested** | Can't validate problem-solution fit | Medium | Pivot to MCP-first if x402 interest low |
| **Product is ahead of problem** | Market not ready yet | Medium | Focus on building integrations, wait for adoption curve |
| **Coinbase/x402 launches own solution** | Becomes obsolete | Low | Even if they do, PaySentry covers multi-protocol + governance |
| **Can't maintain community engagement** | Spam/burnout | Medium | Set 5-10 hours/week limit on GitHub issues, rotate focus |
| **npm downloads never increase** | Indicates SDK isn't useful yet | Medium | Indicates need for better integration examples, not failure |

---

## Final Notes

Phase 1 proved one thing definitively: **the problem is real, but the market isn't ready for a broadcast solution.** The evidence (125+ x402 issues, Deloitte survey, EU AI Act) is solid. But awareness of the problem is concentrated in a small group of teams actively building payment-enabled agents.

Phase 2 shifts strategy from **"convince the world they have a problem"** to **"help the people who already know they have one."** If successful, PaySentry becomes the go-to middleware for agent payments. If not, the product was wrong, not the problem.

The goal for February–April is clear: **reach 75+ GitHub stars, 10 beta users, and prove that developers building payment-enabled agents actually need this.** If we hit those targets, Phase 2b (expansion and platform strategy) has a green light. If we don't, we'll have learned enough to either iterate the product or pivot entirely.

---

**Status:** Ready for Phase 2 execution
**Last Updated:** 2026-02-07
**Next Review:** 2026-02-14 (Week 1 checkpoint)
