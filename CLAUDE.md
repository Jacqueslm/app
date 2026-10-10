# Working rules — Jacques

Standing instructions. These override default behaviour and repo conventions.

## Git

- **Never push.** Commit locally and stop. Push only when Jacques says push.
- **Never open a pull request** unless he explicitly asks.
- When he does say push: `claude/new-session-im7bzg`, then `main`, then
  `claude/vibe-code-uwxxlk`. All three, same commit.
- Merge `origin/main` first if it has moved. It moves often — other sessions
  work in this repo.

## How to reply

- **Short.** He has said "too long" more than once. Lead with the answer.
- Plain language. He is not a developer — no jargon, no framework names.
- One step at a time. Do not stack five options.
- Never re-ask about something already settled.
- Post text in chat rather than files, unless he asks for a file.

## Never fabricate

- No invented numbers, search volumes, or metrics. If a tool returns nothing,
  say so and leave the column empty. Semrush is usually out of API units.
- Verify in a browser before claiming something works. Say plainly what was
  and was not tested.
- If a claim about the app is in a script or page, check it against what
  actually ships.

## The app — hard rules

- **Free tier (as of 1 Sep 2026):** everything except two things. Day counter,
  SOS set, breathing, "Talk me through it", journal, weekly reports, analytics,
  **every lesson day 1–90 on every track**, the Spiritual Path, and Together.
- **Pro is exactly two things: Friendly and the live rooms.** Friendly is the
  one feature with a real per-message bill, so free gets zero chats, not three.
  Never advertise a lesson day as paid — that was removed and the copy went
  with it.
- **No medical claims.** No "research shows", no brain chemistry, no
  mechanisms. Only what people report.
- **It can end a fight, a floor, a day. It can never tell somebody they are
  finished.** Tests enforce this.
- **Never blame** the person struggling to comfort the supporter, or the
  supporter to comfort the person struggling.
- **No pronouns** for a supporter's person. Jacques is a supporter himself.
  The app was swept for "her"/"she" on 31 Aug — do not reintroduce them.
- **No GA4, no pixels, no third-party trackers.** Deliberate privacy stance on
  a recovery app. Not up for revisiting.

## Settled — do not raise again

- **Hosting stays as it is.** 4 Oct 2026: "im not doing that google cloud." He was
  halfway through the Google Cloud free-trial signup and stopped. Do not price
  hosts at him again, do not re-open Google Cloud, Oracle, Render or the rest,
  and do not raise moving off Railway. The host table in
  `TurnSomeDayIntoOneday/START-HERE.md` is history, not a queue of options. Ask
  again only if HE asks.
- **The gmail address stays.** `turnsomedayintodayone@gmail.com` is the single
  inbound address, used in nine places including compliance pages Google has
  reviewed. Researched 31 Aug; changing it was the wrong call.
- **The boxing game is removed.** He rejected it three times. Recoverable at
  commit `5623c870` if he ever asks, but do not suggest it.
- **The Fight is deleted — 10 Oct 2026.** His words: "delete the fight from
  everywhere." It came off the app whole that day: the door on the shell, its
  page, the 3D ring, its art and sound, its routes, the gate and service-worker
  lines for it, its spec (`docs/GAME-SPEC.md`), the tools that built its cast,
  and its tests. The shell is **four doors** now, and the service-worker cache
  name moved to `tsid-shell-v2.5` with it. **Do not rebuild it.**
