# PLAY-STORE — how the app gets found on Google Play

Researched 24 Aug 2026, live web. The ranking-factors research is from App
Radar's April 2026 analysis of what Apple and Google actually weigh
([appradar.com/academy/app-store-ranking-factors](https://appradar.com/academy/app-store-ranking-factors)),
plus the standard Play Console surfaces. The checklist below is written for
this app's listing — The 90-Day Bootcamp / Turn Someday Into Day One, currently
1.0.1 in review.

**The headline:** about 65% of app downloads come through search, and both
stores rebalanced between 2024 and 2026 *away* from raw installs and *toward*
retention, conversion rate, and review velocity. For a small app that is good
news: a small app with above-category retention and fresh reviews can
outrank a bigger app with better metadata. That is the whole strategy below.

---

## How Google Play ranks in 2026 — the factors, in weight order

**What you write (on-metadata):**

1. **Title — 30 characters, the single strongest keyword surface.** One
   high-value keyword phrase plus the brand. Changing it requires a new
   release (review), so it is the most expensive field to change and the most
   valuable to get right.
2. **Short Description — 80 characters, near-equal to the Title.** Industry
   analysis found **84.2% of successful Google Play ranking improvements
   correlated with adding the target keyword to the Short Description, even
   when the Title was unchanged.** This is where the next ranking gain hides.
3. **Long Description — 4,000 characters, fully indexed, front-loaded.** The
   first 250–300 characters carry the most weight. Best practice is 2–3
   natural mentions of the primary keyword — Google now penalizes stuffing.
4. **Category + up to 5 custom tags.** No direct keyword weight, but they
   decide which charts, collections and editorial placements the app is
   eligible for.
5. **Data Safety section — completeness affects discoverability.** Mandatory
   since 2022; incomplete or rejected entries get ranking suppression in some
   categories. Treat it like the privacy policy: audited, done right once.
6. **Promo content cards.** Timed cards on the listing; the text is indexed
   and contributes to ranking.
7. **Store Listing Experiments** (Play Console's built-in A/B testing). The
   winning variant lifts conversion rate, which feeds ranking. Now a ranking
   lever, not just a CRO tool.

**What you earn (off-metadata, the 2026 rebalance):**

8. **Download velocity** — installs per *day* relative to category baseline.
   Recounted frequently; the fastest lever in the list.
9. **Conversion rate** — share of people who tap the listing, then install.
10. **Ratings and reviews — velocity beats absolute rating.** An app with
    4.2★ and 100 fresh reviews a week outranks 4.5★ with 5 a week. Recency,
    count and sentiment all feed it.
11. **Retention and Android Vitals** — Day 1, 7 and 30 retention (healthy
    benchmarks: D1 above 35%, D7 above 15%), crash-free sessions, ANR rate,
    startup time. Google moved "from ranking by install volume to ranking by
    retention and engagement" — apps with rough Vitals lose visibility no
    matter how good the listing is.
12. **Update cadence** — frequency of meaningful updates. Medium weight, easy
    to earn.

---

## The checklist — what to do, in order

### Before the next release (1.0.1 is in review — do these so the *next* build carries them)

**1. Title (30 chars).** Current brand is "The 90-Day Bootcamp" — the brand
alone spends the whole field with no keyword. Options that keep the brand and
add the primary phrase:

- `90-Day Bootcamp: Recovery App` (29) — primary keyword = "recovery app"
- `90-Day Bootcamp: Sobriety App` (29) — if "sobriety" is the term to chase
- `90-Day Bootcamp: Quit Drinking` (28) — the highest-volume single behavior

Pick **one**. The title is the most expensive field — do not test it in a
release you are not sure about. Confirm the exact current title in Play
Console before changing anything.

**2. Short Description (80 chars).** Where the 84.2% gain lives. Draft:

> Free recovery app: day counter, SOS, daily lessons. Quit drinking, porn &
> more

(77 characters — count it in the Console, which enforces the limit anyway.)
The keyword in the Short Description should be the *same* one as the Title if
it fits, or its closest variant — never a repeat of the brand name.

**3. Long Description — front-load the first 250 characters.** Draft opening
paragraph:

> Turn Someday Into Day One is a free 90-day recovery program for anyone
> quitting drinking, porn, gambling, food, social media, gaming or any other
> habit. Built by a man who was addicted for 38 years and got free at 50.
> Start free: a private day counter, SOS tools for the worst ten minutes, a
> daily lesson, a private journal, and a companion for the person who loves
> you.

Then the body, in plain language: what the free tier includes, what PRO adds,
the privacy story (nobody sees anyone's data — no account needed to start),
the crisis/SOS reality (never a paywall on a bad night), and the 38-years-
free-at-50 founder line. 2–3 natural mentions of the primary keyword total,
none stuffed.

**4. Data Safety — complete every field, honestly.** Privacy-first is the
brand's structural advantage and it is the one story the Data Safety section
can actually tell: no account required to start, nothing sold, no location
tracking. A complete, accurate form is both a ranking signal and a conversion
factor — the visible warnings on incomplete forms depress installs.

**5. Category and tags.** Primary: **Health & Fitness**. Up to five custom
tags, chosen from what real searchers type: `addiction recovery`, `sobriety
tracker`, `quit drinking`, `quit porn`, `mental health`. (Tag options are a
fixed list in the Console — pick the five closest.)

### In the first 30 days after approval

**6. Android Vitals — the silent killer.** The app is a TWA wrapper; keep the
crash-free session rate as close to 100% as possible and watch ANR rate in
Play Console's Android Vitals page. A single bad release resets weeks of
velocity. Test the TWA on a real phone (the test-purchase pass on his phone —
MASTER-STATUS — doubles as the vitals pass).

**7. Reviews — engineer the velocity, never fake it.** Ask for a review at
the moment a user has *earned it* (day-7 milestone, or right after the first
SOS tool works), never at install. Respond to every review — a reply is a
conversion factor and a ranking signal. Play removes fake review velocity and
penalizes the app; the honest version is the only version that compounds.

**8. Velocity — the launch push.** Installs per day is the strongest
off-metadata signal, and every pile in this repo feeds it: the video end
cards (link in bio → Play), the Buffer queue, the outreach "yes"es, the
community shelf listings (SUPPORT-GROUPS.md). The paid accelerant is gated —
Meta/Google require LegitScript for alcohol/porn ads (ADS.md), but the
ad-safe lanes (binge eating, doomscrolling) are not, and Reddit's Lane R may
not be either. Do the free push first; the first week's velocity curve is
what the algorithm remembers.

**9. Update cadence.** One meaningful update every 1–2 weeks (new track
content, a fix, a small feature). Google rewards it, and the app already
ships fast — make the version bump visible in the "What's new" field each
time.

### Once there is traffic (month 2+)

**10. Store Listing Experiments.** Run icon / screenshot / short-description
variants, 30–60 days each. The winning variant feeds conversion rate, which
feeds ranking. This is the cheapest ranking lever left for a solo founder —
Play Console's tool is free and built in.

**11. Promo content.** Publish timed promo cards (e.g., "New track: quitting
gambling" or a 90-day challenge). The card text is indexed.

**12. Localization.** The listing is worldwide; Spanish is the biggest
second-language market and there is already a Spanish creator lane
(INFLUENCERS.md #20). At minimum translate Title, Short Description and the
first paragraph of the Long Description into Spanish — Google Play ranks
localized listings per-language.

---

## What NOT to do

- **Keyword stuffing.** Google penalizes it in 2026. 2–3 natural mentions.
- **Fake reviews or incentivized ratings.** Removed and penalized; also the
  opposite of the brand.
- **A title that is all brand.** "The 90-Day Bootcamp" alone ranks for
  nothing anyone types.
- **Changing the title in a rushed release.** It is the most expensive field
  and requires review — get it right once, then leave it.
- **Buying installs / incentivized downloads.** Velocity that collapses the
  week the campaign stops reads as exactly what it is.
- **Ignoring Android Vitals because the app is a TWA.** The wrapper still
  reports crashes and ANRs to Play.

---

## The honest expectation

ASO gets you *found* when someone searches — it does not create the search.
~65% of downloads come through search, so this file is worth doing carefully
and once. But the searches exist because of every other pile in this repo
(the videos, the outreach, the community presence). The listing converts the
attention those piles create; it does not replace them.

**The 30-second summary:** fix the Title + Short Description + Long
Description front-load in the next release, complete Data Safety, keep
Vitals clean, ask for reviews at day 7, respond to every one, ship a
meaningful update every 1–2 weeks, and run Store Listing Experiments once
traffic exists. That is the entire plan — none of it costs money.
