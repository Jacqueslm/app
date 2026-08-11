# Tomorrow — 11 Aug 2026

Where things stand at the end of 10 Aug. Top section is what to do; below it is
what changed, so nothing has to be worked out twice.

**Files that hold state, trust these over anyone's memory:**
`TurnSomeDayIntoOneday/store-listing/00-STATUS.md` (Play Store),
`SCHOOLS.md`, `COMPANIES.md` and `INFLUENCERS.md` (outreach),
`KEYWORDS.md` (search).

---

## THE DIRECTION, DECIDED 11 AUG

Three decisions, and everything below bends to them:

1. **Shorts only, 7 to 15 seconds. No more long-form video.**
2. **The app is advertised as free, with a paid upgrade.** Free is the door;
   the upgrade is extra. Every card, every email and the store listing say so.
3. **Employers are a target** — via the lists employers already read, not by
   cold-emailing HR. See `COMPANIES.md`.

**The three Elias episodes are finished and are 41 to 49 seconds each.** They
were made before this decision. They are not wasted — post them as they are on
YouTube and Facebook where longer still works, and cut the strongest 12 seconds
of each for TikTok. Don't make a fourth.

---

## DO THESE, IN THIS ORDER

### 1. Episode 3 — DONE. The series is finished.

All three episodes complete as of 10 Aug 2026. Nothing left to make.

**What that changes:** the influencer pitches in `INFLUENCERS.md` were written
to be sent once there was a body of work behind them. There is now.

### 2. Production access — around 13 Aug

The form. Answers ready with a copy button on each:
**https://claude.ai/code/artifact/27923b2f-74c7-4e92-a283-0c1e6dd7d2c9**

Do not use the sheet the testing provider sent — two of its answers describe
work that does not exist.

### 3. Start the cards — one a day

**Sixteen now, and each one is two frames plus a shared end frame** —
a 13-second short, not a still. `reference/partner-cards/`, how-to and captions
in `reference/PARTNER-CARDS.md`. Cards 13-16 say "free" out loud; post them
after the first twelve. Card 12 goes last. **Watch saves and shares, not
likes** — shares are currently zero across every platform, and that is the
number that grows a small account.

### 3a. The launch talking heads — `LAUNCH-SCRIPTS.md`

Thirteen scripts, 7-15 seconds, every title a verbatim search phrase with real
volume beside it. Shoot five in an hour: **1, 3, 12, 9, 11.** Word counts are on
each one — 45 words is 15 seconds, don't go over. Never say "link in bio" out
loud; the end card does it.

### 3b. Employers — four drafts are in Gmail

`COMPANIES.md`. The RFW Institute one is the big lever: 1,500+ employers in
35+ states, and one listing beats fifty cold emails to HR. Three more are
contact forms, five minutes each.

### 4. Facebook — three small things

Pin a post in the empty Featured slot, add `turnsomedayintodayone@gmail.com`
under About, and put both links in **About → Links** (they did not fit in the
255-character bio). Skip address and phone.

### 5. Influencers — the gate is open

Ten finished pitches in `INFLUENCERS.md`, none sent. The reason to wait has
gone: three finished episodes exist, so this is no longer a man with an idea
writing to a podcast, it is a man with a body of work. Send one or two, not
ten. This Naked Mind last.

They are all "contact page" rather than email addresses, which is friction that
stops piles getting sent. Ask me to find direct emails, the same way the schools
got done.

### 6. Schools follow-up — 16 Aug

One each, once, then let it go. Only the ones that never replied. Text is in
`SCHOOLS.md`. **Watch for bounces on Ladue and Mehlville** — those two addresses
were built from each district's email pattern, not seen published. A bounce
there is a typo, not a refusal.

---

## STILL OPEN, NO DEADLINE

- **The Shorts recut.** Offered, not built. Same footage reordered so the best
  line is frame one instead of forty seconds in. That is the seven-second
  problem — 2,271 YouTube views in 28 days and an average view of about seven
  seconds.
- **The two voices.** Open since 7 Aug. An African American woman's and man's
  voice in Studio. I will not pick a voice by race from free models that say
  nothing about who is speaking. Two real routes: record a real person for
  fifteen seconds (Studio clones from a clip; I would add a save-as-narrator
  button), or a paid library where the actors describe themselves.
- **Back up Studio's work.** `Studio/server/media/` and its `data.sqlite` are
  deliberately not in git — that is what makes "Update my app" safe. It also
  means every video, project and template exists on one computer only. The code
  would survive that machine dying. The work would not.
- **Buffer send** — parked. Manual posting works.
- Script 39 narration; origin-story photo fixes.

---

## WHAT SHIPPED TODAY

### Play Store — finished except the 13th

Captioned screenshots **published**. All ten App content declarations were
already done on 28 July — that got hunted for from scratch today through three
wrong menu sections before turning up under **Monitor and improve → Policy and
programs → App content → Actioned**. Data safety verified line by line: twelve
data types ticked, nothing under-declared. Diagnostics unticked (it means load
time and battery, none of which is recorded). Health category confirmed clear of
the Medical group, so the Personal account stands.

**The "8 data types collected or shared" line on the summary page is not a count
of ticks** — Play excludes ephemerally processed data. Reading it as a tick
count started a false alarm. Don't repeat it.

### Studio b0831

**Quick Video was silencing your own footage.** Drop a finished video in and it
came out with no sound. The renderer could always keep a clip's audio; Quick
Video rebuilds the timeline every assemble and nothing repopulated the flag. So
the picture survived and the music didn't. Fixed.

**A Still move**, in the Ken Burns picker and Quick Video. Every other move
resamples the frame each frame, which softens flat type, so a title or end card
had nothing right to pick. Zoom in stays the default. A pasted shot list now
understands still, none, static, hold, no movement and locked off.

Kept clip audio no longer gets a blanket 1.5x lift when there's no song to sit
under. Measured first — it doesn't clip or pump, it was just louder than you
made it.

### Outreach — the whole schools pile has addresses now

**All twelve St. Louis districts sent.** Ten more out-of-state districts drafted
in Gmail. Eight of the twenty-two said "ring them for the address"; search found
every one, so there are no phone calls left in this pile.

Two addresses are built from a district's published email pattern rather than
seen — **Ladue and Mehlville** — and both carry a named fallback in `SCHOOLS.md`.
Everything else appeared verbatim in search results.

### The episodes

**Episode 2 panels are picked.** Shot 3 came back with your actual app copy on
the phone screen — "This craving is a wave" — which is better than the brief
asked for. Use the misty porch version for shot 4, the dusk store not the night
one, and **the original Day 2 notebook, not the second version, where the writing
is upside down.**

**Episode 3 hand-over written.** Four panels to Manus, three notebook shots you
shoot yourself, shot 8 is you. Handwriting is what generators get wrong — "Day 2"
is two characters and one version still came back inverted.

**End cards made.** `reference/end-cards/`, two sizes each. Episode 1's names
Episode Two by title; Episode 2's says EPISODE THREE and stops, because "That
Was Me" is the reveal and printing it early gives the ending away.

### Social — what the numbers actually say

Three platforms, one story, and it isn't suppression.

- **YouTube:** 2,271 views in 28 days, 4.3 hours watch time — about **7 seconds
  a view** — and zero net subscribers. Reach happened. Nobody stayed.
- **Facebook:** 3,780 views, 46 engagements, 8 followers. Same shape.
- **TikTok:** the opposite — 26 to 128 views a post, but **89 likes**, which is a
  high rate. There the content lands and distribution never starts.

The channel is also mostly Shorts, which is why a TV shows fewer videos than a
computer: TVs split Videos, Shorts and Live into separate tabs.

Names now match across the app, Facebook and TikTok — they were spelled "Turn
Some Day" in two places. Bios rewritten on both.

---

## THE RULE THAT KEEPS GETTING RELEARNED

Anything worked out in a conversation is gone by the next one. If it matters,
it goes in a file — `00-STATUS.md`, `SCHOOLS.md`, or here. On 9 Aug the same
finished work was re-done twice because it only existed in chat.
