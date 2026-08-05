# Research — API prices, margins, and auto-posting (5 Aug 2026)

Requested by Jacques. **Nothing here has been built.** This is the report he
asked for before any decision. Prices are from vendor/comparison pages dated
July–August 2026 and will drift — re-check before committing money.

---

## 1. Friendly's brain — LLM API prices

Per **1 million tokens** (input / output). Input = what we send (system prompt +
her message + history), output = what Friendly says back.

| Provider · model | Input | Output | Notes |
|---|---|---|---|
| **Google Gemini 3.1 Flash-Lite** | $0.25 | $1.50 | Cheapest credible tier |
| **OpenAI GPT-5** | $0.625 | $5.00 | |
| **Anthropic Claude Haiku 4.5** | $1.00 | $5.00 | |
| **Google Gemini 3.6 Flash** | $1.50 | $7.50 | |
| **Anthropic Claude Sonnet 5** | $2.00 | $10.00 | Intro rate to 31 Aug 2026, then $3/$15 |
| **Anthropic Claude Sonnet 4.6** | $3.00 | $15.00 | |
| **Anthropic Claude Opus 4.8** | $5.00 | $25.00 | Overkill here |

Cost cutters that apply to all of them: **batch = 50% off** (useless for live
chat), **prompt caching = up to 90% off repeated input** (very useful — our
system prompt is identical every turn).

Aggregators (Fireworks, Together, DeepInfra, Groq, OpenRouter) resell open
models cheaper still, but they serve open-weight models, not Claude/GPT/Gemini.

### What Friendly actually costs

Assume a chat turn ≈ 1,000 input tokens (system prompt + history + her message)
and 200 output tokens.

| Scenario | Haiku 4.5 | Gemini Flash-Lite |
|---|---|---|
| Free user, 3 chats/day, every day | $0.18/mo | $0.05/mo |
| Pro user at the full 30/day cap | $1.80/mo | $0.50/mo |
| Pro user, realistic 6/day | $0.36/mo | $0.10/mo |
| 1,000 Pro users, realistic use | ~$360/mo | ~$100/mo |

With prompt caching on the system prompt, knock roughly a third off the input
side of every number above.

**Read:** even at the worst case, Friendly costs under 20% of one Pro
subscription. This is not a line item to optimise at current scale. The reason
to pick a model here is quality of crisis handling, not price — cheap models
mishandle the 2am conversation, which is the one that matters. Revisit cost at
1,000+ paying users.

---

## 2. Studio's generation — fal.ai and its competitors

| Platform | Model of same class | Price | Note |
|---|---|---|---|
| **fal.ai** (current) | Kling 2.5 Turbo Pro, 5s | **$0.35** | $0.07/s beyond 5s |
| **Replicate** | Kling 2.5, per video | ~$0.30 | Flat per video; bills cold-start on unpopular models |
| **Kling direct** | 2.5 Turbo, 5s 1080p | $0.25–$0.50 | Subscription credits, not pure per-use |
| **Runware** | video | from $0.14/s | Claims ~62% cheaper; images from $0.0006 |
| **fal.ai** | images | $0.003–$0.12 | Ours run $0.035–$0.15 |

Broad comparisons put fal 30–50% under Replicate overall, with Runware the
budget floor and Replicate the best-documented.

**Read:** the only credible saving is Runware, and the gap on our volume is
pennies — at 5 videos a month we spend $13–26 total. Switching costs a rebuild
of the animate path plus re-hosting the face-lock LoRA. Not worth it under
~6 minutes of animated video a month. Replicate at ~$0.30 vs fal at $0.35 is a
$0.05 difference per shot; noise.

---

## 3. Margins — what actually reaches the bank

Our prices: **Pro $9.99/mo · $59.99/yr · Founding Lifetime $149.99** (50 cap).

**The takes:**
- **Stripe:** 2.9% + $0.30 per charge, plus Stripe Billing 0.5% of subscription
  volume (Starter tier).
- **Google Play:** 15% on the first $1M/year under the reduced tier. From
  30 June 2026 the structure moves to **10% subscription fee + 5% billing fee =
  15% effective** for subscriptions, rolling out US/UK/EEA first.

| Sale | Gross | Stripe nets | Play nets | Difference |
|---|---|---|---|---|
| Monthly | $9.99 | **$9.35** | $8.49 | Stripe +$0.86 |
| Yearly | $59.99 | **$57.65** | $50.99 | Stripe +$6.66 |
| Lifetime | $149.99 | **$145.34** | $127.49 | Stripe +$17.85 |

**Stripe beats Play at every price point we sell.** Worth watching: the 2026
Epic settlement / Play policy change opens out-of-app payment links. If that
applies to us after launch, steering buyers to web checkout is worth ~9% of
revenue — confirm the exact policy wording before acting, and not during
closed testing.

### Net profit by scale (Stripe monthly, Haiku Friendly)

Fixed: Railway ~$5–8/mo now, $20–30 once it holds ~1GB RAM continuously,
$80–150 at real load. Domain ~$1.50/mo.

| Paying users | Revenue | Payment fees | Friendly | Hosting | **Net** | Margin |
|---|---|---|---|---|---|---|
| 10 | $99.90 | $6.40 | ~$4 | ~$20 | **~$70** | 70% |
| 100 | $999 | $64 | ~$40 | ~$30 | **~$865** | 87% |
| 1,000 | $9,990 | $640 | ~$400 | ~$120 | **~$8,830** | 88% |

**Read:** unit economics are already healthy and stop being the question after
about 20 subscribers. Every serious decision from here is about getting
customers, not about shaving costs. Nothing on this page changes that.

---

## 4. Auto-posting — can a machine put a Studio video into Buffer?

**Yes, and Buffer itself is the answer.**

- Buffer shipped a **GraphQL Public API in May 2026** with an **official MCP
  server**, a CLI, and managed OAuth.
- **API access is included on every Buffer plan**, free tier included. What
  changes by plan is how many keys you get and the request limits.
- Auth is a **personal API key** tied to the user account — which is exactly our
  case (posting to our own Buffer, not onboarding other people's accounts).
- Rate limit on the MCP server: **100 requests / 15 minutes**. We'd use maybe 20
  a week.
- **The one real constraint: media is URL-only.** There is no file-upload
  endpoint — you attach a video by giving Buffer a public URL to pull from. So a
  render sitting on the home computer has to be published somewhere reachable
  first.
- The legacy REST API is retiring 1 Feb 2027 with brownouts in Nov and Dec 2026.
  Anything built must use the new GraphQL API, not the old one.

**Groundwork already exists:** `Studio/server/studio.js` campaign export writes
`campaign.json` with a `buffer: { uploaded: false, profileIds: [] }` placeholder
and a README that currently tells him to upload by hand. That file was
deliberately shaped for this.

### Buffer alternatives (only if Buffer becomes a problem)

| Tool | Price | API | Verdict for us |
|---|---|---|---|
| **Buffer** | Free–$6/channel/mo | GraphQL + MCP, all plans | **Already paid for, already the safety rail** |
| **Postiz** | Self-host free · hosted $29/mo (5 ch) | REST + MCP, every plan | Best free option; open source; we'd run it |
| **Blotato** | $29/mo flat, 20 accounts | REST + MCP | Simple flat rate, AI features built in |
| **Late** (getlate.dev) | Free 20 posts/mo · from $13/mo | API-first | Cheapest paid API |
| **Mixpost** | One-time $299 Pro | Self-hosted, unlimited accounts | Buy-once, no subscription |
| **Publer** | Free 3 accounts / 10 queued | API on higher tiers | Fine, no advantage over Buffer |
| **Metricool** | — | API + Looker | Analytics-led, overkill |
| **Ayrshare** | **$149/mo** minimum | Strong API | Priced for agencies. No. |

**Read:** switching tools buys nothing. Buffer's API is free on the plan already
being paid for, it's the tool the routine is built around, and it's the one
chosen deliberately for recovery safety. Recommendation: build against Buffer.

---

## 5. Agents that could be built (NOT built — for discussion)

Each of these removes a real chunk of manual work. Listed cheapest-to-build first.

1. **Send to Buffer (Studio button).** On a finished render: publish the file to
   a public URL, then call Buffer's GraphQL API to queue it with its caption at
   the right slot. Turns "download, open Buffer, drag, paste, set time" into one
   tap. *Needs: a public file host + a Buffer personal API key.*
2. **Week-filler agent.** Reads `SCRIPTS.md` for the next unposted numbers and
   the banked renders, then fills Monday's whole Buffer week — Morning HIM,
   Midday HER, Night PROOF — and reports what it queued.
3. **Outreach tracker.** Reads Gmail for replies to the outreach emails, ticks
   the boxes in `OUTREACH.md`, flags anyone who answered so he replies same-day,
   and queues the one follow-up 7–10 days out.
4. **Monday numbers agent.** Pulls `/admin/stats`, compares to last week, and
   writes one line: what grew, what to do more of. No dashboard reading.
5. **Script writer on tap.** The existing marketing agent, extended to append new
   numbered scripts to `SCRIPTS.md` on request — bound to `KEYWORDS.md` Build
   terms only.

**Honest note on all five:** these save time, they don't create customers. #1 and
#3 are the ones that remove friction from work he's actually doing today. #2
depends on having banked renders. Build the ones that pay for themselves in his
calendar, not the whole list.

---

## 6. Semrush

The connected Semrush account's current plan does not include MCP access, so no
Semrush data could be pulled for this research. Available plans are listed at
https://www.semrush.com/mcp-access (for traffic analytics specifically,
https://www.semrush.com/analytics/traffic/trends-api).

Note this is also why `KEYWORDS.md` is the only search-data source of truth.

---

## Sources

LLM pricing: [BenchLM Anthropic](https://benchlm.ai/anthropic/api-pricing) ·
[AI Pricing Guru](https://www.aipricing.guru/anthropic-pricing/) ·
[BenchLM Google](https://benchlm.ai/google/api-pricing) ·
[CloudZero Gemini](https://www.cloudzero.com/blog/gemini-pricing/) ·
[PricePerToken GPT-5](https://pricepertoken.com/pricing-page/model/openai-gpt-5)

Generation: [fal Kling 2.5 model page](https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video) ·
[TeamDay API price comparison](https://www.teamday.ai/blog/ai-api-pricing-comparison-2026) ·
[fal vs Replicate](https://www.teamday.ai/blog/fal-ai-vs-replicate-comparison) ·
[Renderful Kling pricing](https://renderful.ai/blog/kling-api-pricing)

Fees & hosting: [Play Console service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en) ·
[Play 2026 fee math](https://pricepush.app/blog/google-play-subscription-fees-2026-real-math) ·
[Android "new era for choice and openness"](https://android-developers.googleblog.com/2026/03/a-new-era-for-choice-and-openness.html) ·
[Stripe Billing pricing](https://stripe.com/billing/pricing) ·
[Railway pricing explained](https://livemy.app/blog/railway-pricing)

Posting: [Buffer API](https://buffer.com/api) ·
[Buffer rate limits](https://developers.buffer.com/guides/api-limits.html) ·
[Buffer legacy REST retirement](https://buffer.com/resources/legacy-rest-api-retired/) ·
[Postiz](https://postiz.com/blog/mixpost-alternative) ·
[Blotato vs Ayrshare](https://www.blotato.com/blog/blotato-vs-ayrshare) ·
[Mixpost review](https://bestsocialmediascheduler.com/reviews/mixpost)
