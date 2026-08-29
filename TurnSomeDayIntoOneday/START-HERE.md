
### Security audit — shared links (28 Aug)

Two things fixed in the paths a stranger can reach:

- **Together codes are now generated with a proper random source.** They used
  to come from `Math.random()`, whose generator can be worked out from a few
  codes you have already seen — meaning someone who made a handful of their own
  links could in principle guess other people's. Now `crypto.randomInt`.
- **Joining with a code is rate limited** — 20 attempts an hour per network.
  A six-character code is short enough to guess at if nothing stops you trying
  a million times; now something stops you.

Checked and found fine: letter links use a 128-bit random token (unguessable),
letter creation and letter-accept were already rate limited, and a letter that
is unknown, revoked, or expired all look identical to whoever opens it.

Two more, same sweep:

- **The error log can no longer be flooded.** It only keeps the last 200 lines,
  so an app stuck in a retry loop could have pushed the real failures out before
  you ever read them. Reporting is now capped at 30 an hour.
- **The session cookie is marked Secure based on the connection itself**, not on
  a `NODE_ENV` variable the host has to remember to set. If that variable ever
  went missing, sign-in cookies would have quietly started travelling without
  the flag that keeps them off plain http.

Also checked and clean: the admin pages and stats are owner-gated (and the admin
shell 404s for everyone else), reviews and room posts are escaped everywhere they
are shown, letters are printed as text and never as HTML, unsubscribe links are
signed, and `/go/` redirects only to a fixed list.

### Email audit (28 Aug)

Checked every promise a page makes about email against what actually sends.
All five sequences fire for the sources that feed them, prices are identical
across all 46 pages, every internal link resolves, and no page points at a
missing image or file.

One fix: **the free PDF email now carries an unsubscribe link.** Everything
else that goes to a lead already had one. The partner page (`/when-he-drinks`)
promises exactly one email and no sequence, and it kept that promise — but that
one email was the only thing you send with no way out of the list at the bottom.

### Lesson and pricing-claim audit (28 Aug) — app 6.9

Counted every lesson day in the app. **All 90 days are there on all 14 tracks**
— days 1–30 written per track, days 31–90 shared and personalised, no gaps, no
blank days. Supporting Someone runs its own 35 and Together its own 30, exactly
as the Pro card says.

One claim was wrong and it was on the screen where people decide to pay. The
plans screen said Pro gives you "days 16–90 of every track, **including the
Spiritual Path and Together**". Those two are 30-day programs, and the Pro card
directly below it already said so correctly. Fixed to "day 16 onward on every
track, all the way to day 90 on the recovery tracks", which is true of all of
them.

### Stories audit (28 Aug) — app 7.0

Downloaded all ten story recordings and timed them. Every one was labelled
**"~10 min" in the app and none of them is** — they run 6.9 to 8.5 minutes.
Each story now shows its own real length (7, 8 or 9), and the shelf blurb says
"seven to nine minutes each" instead of "about ten minutes each".

Also confirmed: all ten stories have a recording on the `lesson-audio` branch,
there are no orphan files, and no story in the app is missing audio.

Service worker cache bumped to v6.8 so the corrected lengths reach people who
already have the app open.

### The win-back email went to an active member (28 Aug) — FIXED

Jacques forwarded a screenshot: someone who has been using the app got the
"Day one is still there — you haven't been in for a couple of weeks" email.

**Why.** The win-back worked out whether you had been away by looking at the
activity log, and the activity log only records 33 specific actions — finishing
a lesson, logging a craving, playing a story. Open the app, read, close it, and
it writes nothing. To that email you had vanished.

**Fixed** by asking three questions instead of one, and taking the most recent
answer:

- did she do something the app counts (activity log, as before)
- did her app sync anything back to the server
- did any signed-in request arrive at all — a new `last_seen_at` stamp, written
  on every authenticated request, throttled to one write an hour

The third is the honest reading of "been in" and it did not exist before.

**Nobody gets it twice.** The send-once guard means anyone already emailed by
mistake will not be emailed again. `last_seen_at` starts empty and fills in as
people use the app, so the state-sync signal is what protects the next few days.

Five regression tests in `server/test/winback.test.js`, including the exact
shape of this false send.

Retention in /admin/stats still counts *actions*, not app opens, and that is
deliberate — retention should measure engagement. Only the win-back needed the
broader definition.

### Together rebuilt — 30 days → 90 (29 Aug) — app 7.1

Jacques read the couples track and said it looked repetitive, and that the
things he needs to repair a marriage were not in it. He was right. The old
30 days measured out like this:

- **24 of 30 daily actions were talking or writing.** It was a talking program.
- Physical affection: 3 days, and only one was really about it — and that one
  was a *conversation* about closeness, not touching.
- Fun, dates or play: 4 days. Two dates booked once, on day 14. Nothing recurring.
- Chores or doing something for the other: 3 days.
- Game night, eye contact, kissing, massage: **not in it at all.**
- Nobody was ever asked their schedule.

**The rebuild, on his direction:**

- **For any couple who needs repair**, not only couples touched by addiction.
- **90 days**, matching every other track.
- **One phone, both people, every day.** Nothing is done separately, ever.
  Linking two accounts is no longer the way in — it stays as an option.
- **Every day has two parts:** a TOGETHER action and a FOR THEM act of service.
  All 90 days have both.
- **Day 1 is the schedule.** The program is built on when they are actually in
  the same room, because anything not in the calendar loses to everything that is.
- Framed as training throughout — his own line: a relationship is a muscle, and
  you do not get the benefit if you do not do the work.

New coverage: touch on 12 days, kissing 5, holding 7, massage 4, dates 19,
game night 8, acts of service on all 90. Six phases of fifteen — Show Up,
Turn Toward, Clear The Air, Play Again, Closeness, Make It Permanent.

Together is now excluded from the shared recovery phases (it would have
addressed a couple as one person working on "the habit"). Every "Together is
30 days" claim in the app is updated to 90, including the Friendly system
prompt. Cache v6.9.
