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

## KEPT — these carry projects that exist nowhere else

| branch | sha | unique to it |
|---|---|---|
| `claude/day-trading-market-structure-8kzz7w` | `f59fd1fc16bf03daaf8b7f75fb5bb955a6d22d18` | `Trading/` — pine, ninjatrader, relay |
| `claude/trading-bot-improvements-756gua` | `4215d483c954606f2e20e71b51656522872be56e` | `Trading/` — newer of the two |
| `claude/new-session-undhzr` | `65a5f58fcc65f5db0e91bea52c3fee3bb8f75941` | `TradeDesk/` — engine, pine, data |
| `claude/lead-generation-app-dbxl0w` | `ea4591b943235955a3317a62181986d7e42d1999` | `LeadCatch/` — server, public, test |
| `claude/new-session-r8s2fg` | `a199faed48c5828328d7028de8caf04ce4ba789a` | `TurnSomeDayIntoDayOne/` — old-spelling app folder |
