# Songs

> **RULE: never mix music with the app.** Not a file, not a folder, not a link,
> not a build step, not a page. The app is `TurnSomeDayIntoOneday/` and it knows
> nothing about this folder; this folder knows nothing about the app except that
> it is not here. Nothing gets imported either way, and no song is ever shipped
> inside the app or served from it.
>
> **RULE: every song gets a sheet here the same session it is written.**
> Nothing stays chat-only. Before writing anything new, read the register below
> and pick a lane, tempo and key that no existing song already owns.

Songs are not the app. The app is `TurnSomeDayIntoOneday/`, this folder is the
songs, and neither one reads the other: no page, no route and no test in the app
opens anything in here, and nothing in here imports the app. Two separate
things, kept in one repo.

Each file is a complete paste-in block for Suno, in the same shape:

- **STYLE OF MUSIC** — the long style field, with a character count so it fits
  the box.
- **SHORT STYLE** — the fallback for when the long version is rejected.
- **LYRICS** — tagged, with the structure named in brackets.
- **EXCLUDE STYLES** — what the song must not turn into.

## What is here

| File | Song |
|---|---|
| `I-Can-Change-You-Can-Change-Suno-Prompt.txt` | I Can Change, You Can Change — two tracks, one song: 6 rappers, 8 bars each, 5 singers and 8 choruses, 92 then 104 BPM |
| `I-Can-Change-One-Track-Suno-Prompt.txt` | I Can Change, You Can Change - single-generation version: same six verses and six rappers at 96 BPM, 4 full choruses and 2 half choruses, one Suno run |
| `You-Are-Not-A-Sewer-Suno-Prompt.txt` | You Are Not a Sewer - the speech as a spoken-word soul-rap record: 6 spoken verses, 3 choruses, final chorus, bridge, outro, 88 BPM |
| `Day-One-Suno-Prompt.txt` | Day One — Jersey-club rap anthem, 138 BPM, C minor |
| `Days-Are-Numbered-Suno-Prompt.txt` | Days Are Numbered |
| `Days-Are-Numbered-RnB-Trap-Suno-Prompt.txt` | Days Are Numbered — R&B/trap version, pairs with the lyrics above |
| `Jersey-Club-Suno-Prompt.txt` | Jersey club |
| `Live-It-Now-Suno-Prompt.txt` | Live It Now |
| `Past-The-Shine-Suno-Prompt.txt` | Past The Shine |
| `Ring-And-A-Crown-Suno-Prompt.txt` | Ring And A Crown — Afrobeats/R&B "Ladies' Night", 104 BPM, A major |
| `Same-Light-Suno-Prompt.txt` | Same Light |
| `Same-Light-HipHop-Suno-Prompt.txt` | Same Light — hip-hop version |
| `Cant-Look-Away-Suno-Prompt.txt` | Can't Look Away — R&B into hip-hop, 74 BPM, B-flat minor: female lead and wide soul choir, melodic rap with one double-time break, spoken bridge |
| `Two-Step-Suno-Prompt.txt` | Two Step |
| `Stop-It-Suno-Prompt.txt` | Stop It — hardcore Down South protest rap, stop/they-killing-us chant, 76 BPM, F minor |

## The register — read this before writing anything new

Every song that exists, with the lane it already occupies. A new song picks a
lane, tempo and key that no row here already holds, and a hook idea that is not
already spent.

| Song | Lane | Tempo / key | Sheet |
|---|---|---|---|
| Can't Look Away | R&B into hip-hop: female lead, wide soul choir, one double-time rap break, spoken bridge | 74, B-flat minor | saved |
| Egyptian Symbol | Hip-hop Egyptian dance craze: chant hook, claps-only breakdown, dance challenge | 90 into 120, E Phrygian dominant, last chorus to F-sharp minor | saved |
| Day One | Jersey-club rap anthem | 138, C minor | saved |
| Days Are Numbered | Soul R&B ballad, slow 6/8 shuffle | 74, B-flat major | saved |
| Days Are Numbered (R&B/trap) | R&B trap, half-time | 140, B-flat minor | saved |
| I Can Change, You Can Change | Hip-hop, six rappers and eight choruses | 92 then 104, A minor | saved |
| I Can Change, You Can Change (one track) | Same song, single generation | 96, A minor | saved |
| Jersey Club | Jersey-club rap cypher | 136, no key named | saved |
| Live It Now | Soca | 135, D major | saved |
| Past The Shine | Slow, spacious hip-hop | 82, minor | saved |
| Ring And A Crown | Afrobeats/R&B, ladies' night | 104, A major | saved |
| Same Light | Soul ballad | 70, D major | saved |
| Same Light (hip-hop) | Mid-90s Chicago soul boom-bap | 90, C minor | saved |
| Two Step | Early-'90s West Coast pop-rap | 102, G major | saved |
| Stop It | Hardcore Down South protest rap, slow half-time 808, stop/they-killing-us chant | 76, F minor | saved |
| You Are Not a Sewer | Spoken-word soul-rap | 88, D minor | saved |
| Living It Up (Putting It Down) | — | — | chat only |
| Freedom LLC | — | 90 (beat exists in `artifacts/`), no key named | chat only |
| U R Loved | — | — | chat only |
| Say It Back | — | — | chat only |
| How Many Wanna Die for the Revolution | Also a 174 BPM jungle remix | 174 (remix) | chat only |
| Willing to Die for the Revolution | — | — | chat only |
| Selling Your Crown | Soul version and trap version | — | chat only |
| Turn A Blind Eye | — | — | chat only |
| I Love You (Better Place) | — | — | chat only |
| Are You Really Ready | — | — | chat only |
| Wrong Hands | — | — | chat only |

Note: Can't Look Away and Days Are Numbered share 74 BPM but not a key and not a
groove (minor, hip-hop turn and full choir against a major-key 6/8 soul ballad).
If a future song wants 74, take a different key and a different backbeat.

## Not in here yet

These were written and delivered in the chat, and were never saved as files:
Living It Up (Putting It Down), Freedom LLC, U R Loved, Say It Back, How Many
Wanna Die for the Revolution (and its 174 BPM jungle remix), Willing to Die for
the Revolution, Selling Your Crown (soul and trap versions), Turn A Blind Eye,
I Love You (Better Place), Are You Really Ready, Wrong Hands.

They go here as files when they are pasted back in, not into the app.

## The one rule this folder keeps

The app's house rule holds here too: where a reference track was named, the song
is written for that lane and never claims to reproduce it. Every style field
says "original lyrics, melody, vocal cadence and drum pattern" for that reason.
