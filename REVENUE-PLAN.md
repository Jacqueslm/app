# REVENUE PLAN — what this app actually sells

**Why this file exists.** A plan landed (MIKE's, Aug 2026): six streams, one
conservative number each, $45,000/mo total — course, sponsors, consulting, ads,
affiliate, membership. The discipline is right. The business is wrong. That
plan monetizes an audience (1.2M views/mo); this app monetizes a subscription.
The plan's own binding constraint — *1.2M monthly views* — is the one thing it
never explains how to get. For us that constraint is the whole problem, not
the given.

Nothing below is invented. Every price is what the landing page sells today.
Every step of the funnel already exists in the app. The numbers marked
**ASSUMPTION** are placeholders to be replaced by `/admin/stats` the moment
there's data — until then the rates stay "—", like the stats page already does.

---

## 1. THE MONEY — one screen, rebuilt

**What the app actually sells (from landing.html, checked):**

| Offer | Price | Notes |
|---|---|---|
| Free plan | $0 | the whole door |
| Pro monthly | $9.99/mo | 7-day free trial, day-5 reminder email |
| Pro yearly | $59.99/yr | "same thing, half price" |
| Lifetime | $149.99 once | the one-time stream |

**The streams that exist for this business:**

1. **Pro subscriptions** (monthly + yearly, blended) — the only stream that
   scales. This is 90% of the model.
2. **Lifetime** ($149.99 once) — a real stream, sized for the superfan, never
   the main number.
3. **Affiliate (later)** — books/therapy referrals, only after product-market
   fit. It monetizes trust, so it must never precede it.

**The streams that don't exist here:** $199 courses, $4k sponsor deals, $2k
consulting, $5 RPM ads. That audience doesn't buy courses from a recovery app,
and selling it would poison the trust that *is* the product. Leave all four at
zero forever until there's a real reason.

**Honest year-one math (every line is an ASSUMPTION, replace with data):**

```
1,000 test completions/mo    ← SEO + content, the whole job is feeding this
   × 35% email opt-in        ← the test captures leads into the sequence
   = 350 leads/mo
   × 20% open the app        ← sequence does the selling, not the ad
   = 70 app signups/mo
   × 30% start the 7-day trial
   = 21 trials/mo
   × 20% convert to paid
   = ~4 paid/mo  →  ≈ $40/mo blended (mix of $9.99 and $59.99)
```

That's roughly **$500/yr at year one**. It's meant to look small — that's the
point of the exercise. MIKE's plan hid its constraint behind a headline
number; this one shows the whole chain. The conversation you should be having
is not "what's the revenue" — it's **which step do I move first, and by how
much.** Every +10% at one step is worth roughly $5/mo today; a 2× at the top
of the funnel is worth more than a 2× anywhere else, because it multiplies
everything downstream.

---

## 2. THE BINDING CONSTRAINT — one line

For MIKE: **1.2M monthly views.** The plan has no answer for how you get
there.

For this app: **trust + the test funnel.** The funnel is already built —
content → `/codependency-test` → email sequence → app signup → 7-day trial →
paid. Every piece of content, every ad, every page ends at the same CTA: the
free test. The test *is* the lead magnet (MIKE's "free practice-set download"
mapped onto something that already exists and already captures emails).

The question the plan answered for MIKE ("where do 1.2M views come from?")
becomes ours: **where do the first 1,000 test-takers come from?** The answer
is not one channel — it's SEO (the low-KD doors already researched, e.g.
`/codependency-test` at 390/mo KD 15), the daily content mix, and the trust
engine in section 4. Spend your Tuesday sales slot feeding this funnel, not
chasing audiences.

---

## 3. THE FORMATS LADDER — rebuilt for this funnel

MIKE's ladder: walkthrough → takedown → commentary → live debugging. Rebuilt
format by format, each one ending at the test:

| # | Format | Rebuilt for recovery | Job | CTA |
|---|---|---|---|---|
| 1 | **Walkthrough** | "What your codependency score actually means" / how the app works | list growth, SEO | the test |
| 2 | **Takedown** | "Why you keep picking the same kind of partner" — 3-min breakdown | mid-funnel, strong watch time | the test |
| 3 | **Commentary → Interview** | Recovery story interviews — anonymized, with permission | list growth + social proof at once | the app |
| 4 | **Live debugging** | ❌ does not exist for this business. You cannot debug someone's relationship on stream. | — | — |
| 4′ | **The morning after** | "The hard part isn't the night you drink. It's the morning after." (see DAY-ONE-PLAN.md) | the moat — nobody makes this | the app |

Two swaps that matter:

- **Live → The morning after.** The plan's "highest-trust format" has a
  compliance wall in front of it (section 5). The Day One Plan is the honest
  replacement — content about the moment after the fall, which *no one* else
  makes. It's also the best video on the list and it's not shot yet.
- **Every format ends at the test.** A takedown about picking the same partner
  ends with "see how much of this is you" → test. A walkthrough ends at the
  test. The interview ends at the app. The test is the one CTA on repeat.

---

## 4. THE TRUST PILLAR — the gap every audit flags

Recovery apps convert on proof + authority. This is the missing third pillar
and it is the actual bottleneck — more than views, more than formats.

**Already built (empty on purpose — fill with real lines):**
- `data/reviews.json` + the `/reviews` page. When a real tester/member says a
  line, it drops into the JSON and renders everywhere. No invented quotes,
  no fake star counts — the page says "There aren't any published reviews
  yet" until there are.

**The asks that fill it:**
- **Day-30 in-app ask** — lives in `email.js` (sequence file, not this one).
  Point it at the `/reviews` mailto. This is the single most important
  conversion-surface you own and it is not wired yet.
- **One expert co-sign** — a therapist or recovery coach who has looked at the
  app and says one honest sentence. Highest-leverage single ask in the whole
  marketing stack; costs one outreach email.
- **One honest before/after** — the founder story is real social proof (38
  years, came back at 50). Use it where other apps fake a member count.

**The rule:** never state a number that isn't real. No "2,479+ businesses", no
invented member counts, no stock testimonials. The moment the first real
reviews exist, the landing hero gets the same social-proof row Outrank has —
with real stars, not borrowed ones.

---

## 5. WHAT THE LANDING PAGES ACTUALLY TEACH (from the screenshots)

- **Outrank** — one headline, one promise, one CTA, one proof row. Steal the
  *simplicity*, not the "750m+ Organic Views" (a number they earned; you
  haven't). Your honest version: the founder line up top, the test CTA, real
  reviews when they exist.
- **AutoSEO** — the 1-2-3 step breakdown is the strongest part of that page,
  not the gradient. Map it directly: **1)** take the free test → **2)** get
  your Day One Plan → **3)** start counting from today. Their proof bullets
  ("2,479+ businesses growing") are only usable with real numbers — same rule
  as section 4.
- **Apollo** — wrong market, wrong tone. But note the discipline: one line per
  idea, no decoration. That's a writing rule for every page and every caption.

---

## 6. WHAT TO TEST LATER (not now)

- **A $7 blended tier** — the one genuinely good pricing idea in the plan.
  Lower friction, still real money at volume. But it's a pricing experiment:
  only after Play Store production access and the first ~100 paid users, and
  only as an A/B against the current $9.99 — never on a guess.
- **Affiliate** for books/therapy referrals — after trust exists, not before.
- **The long-form YouTube video** — the "morning after" piece from section 3,
  or one honest recovery-story interview. Parked until the daily rhythm is a
  habit (matches DO-THIS-NEXT.md's "LATER").

---

## 7. THE GUARDRAILS THAT OVERRULE ANY PLAN

1. **Play Store testing first.** No new app features until production access
   lands — content and pricing experiments are fine, features aren't.
2. **No medical claims.** No "research shows", no brain chemicals, no
   diagnoses (DO-THIS-NEXT.md rule 3). Recovery-adjacent content includes a
   care plan for distressed viewers, and 988 goes before everything in the
   After flow (DAY-ONE-PLAN.md).
3. **Never fake proof.** No invented testimonials, no borrowed metrics, no
   "trusted by" without a real person behind it. This is the whole brand.
4. **One CTA on repeat.** Content → test → sequence → app → trial. If a piece
   of content doesn't end at that loop, it's building an audience that
   wouldn't buy the product.
