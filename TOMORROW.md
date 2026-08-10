# Tomorrow — 11 Aug 2026

Where things stand at the end of 10 Aug. Top section is what to do; below it is
what changed, so nothing has to be worked out twice.

**Files that hold state, trust these over anyone's memory:**
`TurnSomeDayIntoOneday/store-listing/00-STATUS.md` (Play Store),
`SCHOOLS.md` and `INFLUENCERS.md` (outreach), `KEYWORDS.md` (search).

---

## DO THESE, IN THIS ORDER

### 1. Finish Episode 3 — one panel to redo

`06_home` came back with **a glass of whisky on the desk**, in the shot where he
comes home sober and writes the number. Ask Manus again: no alcohol anywhere in
frame, no tumbler, no amber liquid, no bottle. Water or nothing.

The other seven are done. Then: eight files into Quick Video, apply the
**Episode format** template, paste the seven captions, check the total reads
**41s**, add the song from `EPISODE-3.md`, render.

### 2. Production access — around 13 Aug

The form. Answers ready with a copy button on each:
**https://claude.ai/code/artifact/27923b2f-74c7-4e92-a283-0c1e6dd7d2c9**

Do not use the sheet the testing provider sent — two of its answers describe
work that does not exist.

### 3. Start the partner cards — one a day

Twelve in `reference/partner-cards/`, captions and hashtags in
`reference/PARTNER-CARDS.md`. Card 12 goes last. **Watch saves and shares, not
likes** — shares are currently zero across every platform, and that is the
number that grows a small account.

### 4. Facebook — three small things

Pin a post in the empty Featured slot, add `turnsomedayintodayone@gmail.com`
under About, and put both links in **About → Links** (they did not fit in the
255-character bio). Skip address and phone.

### 5. Influencers — after the episodes are out, not before

Ten finished pitches in `INFLUENCERS.md`, none sent. **Send them once all three
episodes are published**: right now it is a pitch, afterwards it is a pitch plus
a body of work, and that is a different email to receive. Send one or two, not
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
