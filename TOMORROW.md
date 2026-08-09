# Tomorrow — 10 Aug 2026

Where everything stands at the end of 9 Aug. Top section is what to actually
do; the rest is what changed, so nothing has to be re-derived.

**Two live files hold state and are worth trusting over memory:**
`TurnSomeDayIntoOneday/store-listing/00-STATUS.md` for the Play Store, and
`SCHOOLS.md` for outreach.

---

## DO THESE, IN THIS ORDER

### 1. Update Studio (2 minutes)

Settings → **Update my app** → close the black window → **Start Studio** →
**Ctrl+Shift+R**. Stamp top-left must read **b0831**.

**If the stamp won't move, it's a branch problem, not a cache problem.** Studio
updates itself from `claude/vibe-code-uwxxlk`. Session work goes to whatever
branch that session was assigned. Any Studio change has to be cherry-picked
across or it never reaches the machine. This cost an hour on 9 Aug.

### 2. Render Episode 2

All eight panels are chosen (see below). Rename, paste the shot list from
`EPISODE-2.md`, add the end card as shot 9 — **Still, 3s, fade to black, no
words** — and render. 49 seconds.

### 3. Add the end card to Episode 1

Episode 1 is finished, so it doesn't get rebuilt. Load the MP4 into Quick Video
as shot 1 with **then: fade to black**, add `02-ep1-next-2x.png` as shot 2
(**Still, 3s, no words**), **no song**, **untick "Cut on the beat"**. Out at
1:21 with the original music intact.

### 4. Start the partner cards — one a day

Twelve cards in `reference/partner-cards/`, captions and hashtags in
`reference/PARTNER-CARDS.md`. **One a day for twelve days.** Card 12 goes last.

### 5. Episode 3 into Manus

`EPISODE-3-PROMPTS.md`. Manus gets four panels. **Three are notebook shots you
photograph yourself** — ten minutes, a real pen, one lamp. Shot 8 is you on
camera.

### 6. Production access — around 13 Aug

Answers ready with a copy button on each:
**https://claude.ai/code/artifact/27923b2f-74c7-4e92-a283-0c1e6dd7d2c9**

Do not use the sheet the testing provider sent — two of its answers describe
work that doesn't exist.

---

## STILL OPEN

- **Facebook:** pin a post in the Featured slot (it's empty and it's the first
  thing a visitor sees), add `turnsomedayintodayone@gmail.com` under About, and
  put both links in **About → Links** — they didn't fit in the 255-character
  bio. Skip address and phone.
- **The Shorts recut.** Offered, not done. Same footage reordered so the best
  line is frame one instead of forty seconds in. Say the word.
- **The two voices.** Still unanswered since 7 Aug: an African American woman's
  and man's voice in Studio. I can't pick a voice by race from the free models —
  none of them say who the speaker is. Two real routes: record a real person for
  15 seconds (Studio clones from a clip; I'd add a save-as-narrator button), or
  a paid library where the actors describe themselves.
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
