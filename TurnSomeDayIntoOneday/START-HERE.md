
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
