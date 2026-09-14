# Branch cleanup — 17 Aug 2026

**STATUS: not deleted yet.** A Claude session cannot delete a remote branch here
— GitHub returns 403 on `git push --delete` (the session's git credential is
push-only) and the GitHub connector has no delete-branch tool. Jacques deletes
these in the browser: **GitHub → the repo → Branches → the bin icon** on each
row below. One minute, nine clicks.

The nine below are verified safe: each was checked file-by-file and holds **no
file that `main` does not already have**. Even after deletion every one is
recoverable — a branch is only a pointer, the commits survive. To bring one
back:
```
git push origin <sha>:refs/heads/<branch-name>
```

Each was verified to hold NO file that main does not already have.

| branch to delete | sha (for recovery) | last commit |
|---|---|---|
| `claude/app-qc-competitive-analysis-lehsn9` | `c3c2ba12ce3054dc1184158f70cfe78a73935577` | 2026-08-09 |
| `claude/dayone-launch-fixes` | `5ab81b830dfbfd916439f37230817f062f5c5293` | 2026-07-21 |
| `claude/new-session-i3sdmi` | `10882257757f0be97abbf5ab37dba6e0754142df` | 2026-07-02 |
| `claude/sos-talk-screen-cutoff-dfhjw4` | `b07e90337afd8010d470d7c8325e838fb86d2cfc` | 2026-08-06 |
| `claude/start-here-n39dzp` | `3e1f8639e14566b525e819f238061f17827247ff` | 2026-08-06 |
| `claude/web-app-play-billing-crash-vz102g` | `4406b6539621f83f6c13296dfe31747256146426` | 2026-07-29 |
| `claude/studio-pull-up-48xckn` | `b78b765a22a443a065591319432f37f9919d7084` | 2026-08-12 |
| `claude/qc-testing-checklist-kud0fy` | `e3731ec7f660b069ab37f1a0c2c34c8d7b804620` | 2026-07-15 |
| `claude/new-session-v5j88o` | `af511dd5757ec4106411929db5eef8b51140839a` | 2026-07-07 |

## RESCUED — their work is now on `main`, so the branches are safe to delete

Each of these was the ONLY copy of a whole project. The folders were lifted onto
`main` as-is (no code changed, scanned clean for secrets) on 17 Aug, so deleting
the branch now costs nothing.

| branch | sha (for recovery) | rescued into |
|---|---|---|
| `claude/trading-bot-improvements-756gua` | `4215d483c954606f2e20e71b51656522872be56e` | `Trading/` (22 files) + `.claude/agents/trade-checker.md` |
| `claude/day-trading-market-structure-8kzz7w` | `f59fd1fc16bf03daaf8b7f75fb5bb955a6d22d18` | superseded — its `Trading/` is an older copy of the above |
| `claude/new-session-undhzr` | `65a5f58fcc65f5db0e91bea52c3fee3bb8f75941` | `TradeDesk/` (42 files) |
| `claude/lead-generation-app-dbxl0w` | `ea4591b943235955a3317a62181986d7e42d1999` | `LeadCatch/` (18 files) |

## STILL THE ONLY COPY — do not delete this one

| branch | sha | unique to it |
|---|---|---|
| `claude/new-session-r8s2fg` | `a199faed48c5828328d7028de8caf04ce4ba789a` | `TurnSomeDayIntoDayOne/` — the old-spelling app folder, 10 Jul |

**Left undone deliberately, and here is the blocker:** that folder is a stale
July copy of the recovery app under the old misspelling. Copying it onto `main`
would put two near-identical app folders side by side — `TurnSomeDayIntoDayOne/`
and the live `TurnSomeDayIntoOneday/` — and the next session (or the next AI)
edits the wrong one. That is a real hazard, not a tidiness preference, so it
needs Jacques's call: rescue it under a clearly-dead name like
`archive/TurnSomeDayIntoDayOne-2026-07/`, or leave the branch alone as the
archive it already is. **Until he decides, the branch stays.**

## The old trading system — deleted 14 Sep 2026

Jacques asked for the whole old trading system gone, playbook included. Eight
branches carried a copy of it (`Trading/`, `TradeDesk/`, `trading-bot/`) and all
eight were deleted from the remote in one `git push --delete` from a Freebuff
session. That session *can* delete refs — the 403 above was that session's own
credential, not a GitHub limit.

| deleted branch | sha (for recovery) | what it held |
|---|---|---|
| `claude/trading-bot-improvements-756gua` | `4215d483c954606f2e20e71b51656522872be56e` | `Trading/` (22 files) + `.claude/agents/trade-checker.md` |
| `claude/day-trading-market-structure-8kzz7w` | `f59fd1fc16bf03daaf8b7f75fb5bb955a6d22d18` | `Trading/` (22 files) — older copy of the above |
| `claude/new-session-undhzr` | `65a5f58fcc65f5db0e91bea52c3fee3bb8f75941` | `TradeDesk/` (42 files) |
| `claude/document-scan-ocr-convert-n2jofh` | `31094938863db9392d239399f54480ef3cf8a4a8` | `TradeDesk/` + `Trading/` (78 files) |
| `claude/start-here-2ujk0y` | `c50422bd7fde12f0efacc4cf0c69db2d438edaf4` | `TradeDesk/` + `Trading/` (64 files) |
| `claude/status-update-rwf7zx` | `07343b400fc0a107a2004e57811458694584ab7b` | `TradeDesk/` + `Trading/` (64 files) |
| `claude/video-creation-6rh8la` | `261179bd81e98e544b7775718d206e21eeaa8a7f` | `TradeDesk/` + `Trading/` (77 files) |
| `freebuff-marketing` | `db5b30749abc942694b5785c4f3a03b439d3e84a` | `TradeDesk/` + `Trading/` + `trading-bot/` (81 files) |

Restore any of them with `git push origin <sha>:refs/heads/<branch>`.

Also removed at the same time: `.claude/agents/trade-checker.md` on `main` — it
graded trades against `Trading/PLAYBOOK.md`, which no longer exists anywhere.

**Tags:** five tags from 6 Sep 2026 — `characters`, `crowd`, `fightermoves`,
`suzie`, `trainers` — pointed at game/3D handoff commits whose trees included
`Trading/` and `TradeDesk/`. Jacques wanted the fighters kept, so the tags were
kept and the trading folders taken out of them: each tag now points at the same
snapshot minus `Trading/`, `TradeDesk/`, `trading-bot/` and
`.claude/agents/trade-checker.md`, and every fighter file is untouched (69 and
77 files in `img/fight` on the two snapshots, unchanged).

They were replaced by deleting each tag and pushing a new one — a force update
is refused for this credential, a delete and a create are not. Old tag commits,
for recovery: `characters` `fightermoves` `suzie` `a88d7e7a4392186d8b2e76d10efb59a43220525d`,
`crowd` `trainers` `77a02d067104c3a56c9f7b16ffbc4750d213f963`.

Note that only the *tips* were cleaned. The trading folders still sit in those
snapshots' parent commits, and on GitHub unreachable commits survive until
support purges them, so this is "gone from everything you can open", not
"gone from the server's disk".
