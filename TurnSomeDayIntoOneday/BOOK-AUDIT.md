# Book audit — *The Secret Language of Birthdays*

**9 Nov 2026.** `key.html` (4,588,226 bytes at the audit; 4,682,521 after the 26 repairs and the additional spreads) audited against the book text
`727171169-The-Secret-Language-of-Birthdays.txt` (5,098,309 bytes, 65,303 lines).
Every one of the 366 birthdays was checked. The per-day scores are in
[BOOK-AUDIT.csv](BOOK-AUDIT.csv).

## The short version

The app is not built from one book. At the audit, **the description on most days
was the book's text** — 340 of 366 — and all 26 fabricated pages have
since been replaced, bringing the current count to 366. Almost everything the
page presents around the description is the app's own writing: **340 of the 366 meditation lines do not appear in the book at all**, 343
advice lines and 365 health lines are summaries, and the twelve "Where it shows"
boxes (4,392 lines) have no source in the book at all.

**Twenty-six days were wholly app-written at the audit**: their descriptions did
not appear in the book, and 20 of them also carried a title the book does not
print. All 26 have since been replaced with the book's pages; none remain.
These are the real "made up" pages, and May 14 was not one of them — May 14 had
the book's essay cut short and its sections replaced.

The invented **Destiny** layer is a separate case: 48 entries (36 periods and 12
cusps) written by the app, presented as the day's path. **No entry is a
quotation**; the best overlap with the book is 5% of short
character runs, which is incidental phrase overlap, not a source. It was taken
out of the visible reading on 9 Nov 2026, but the table is still in the file and
`pairThird` still reads it.

## How the check was done

The book was split into its 366 pages and each app field was compared with its
own day's page after removing case, punctuation and whitespace (the OCR puts
spaces inside words — `fo r`, `SUPERFI CI AL` — so letters are compared, not
words). "Overlap" is the share of 14-character runs in the app's text that also
occur on the book's page.

A true quotation from this scan scores **0.7–0.9**, not 1.0, because the OCR
misreads letters. A score near **0** means the app wrote it. That is the line
used here: **≥0.5 book text, <0.1 app-written.**

## What is faithful, and what is not

| Part of the page | What the book has | What the app has | Verdict |
|---|---|---|---|
| Day title | one per day | 366 | **344 found in the book; 22 not found** |
| Description | an essay per day | 366 | **340 from the book; 26 app-written** |
| Period, element, number, card | header of every page | one generated line | period found in **331 of 344** checked headers; card name found on **296 of 344** pages |
| Strengths | printed list | 366 | **181 match, 157 partial, 28 app-written** |
| Weaknesses | printed list | 366 | **58 match, 229 partial, 79 app-written** |
| Meditation | one line per day | 366 | **26 now from the book; 340 not in the book** |
| Advice | a paragraph per day | 366 | **2 quoted, 21 partial, 343 app summaries** |
| Health | a section per day | 366 | **1 quoted (May 14), 365 app summaries** |
| Tarot paragraph | a paragraph per day (352 pages legible) | only the card's name | **missing** |
| Born on this day | a list per day (320 pages legible) | nothing | **missing** |
| Numbers and planets | prose per day (262 pages legible) | generated line only | **missing** |
| Twelve "Where it shows" boxes | nothing | 4,392 lines | **all app-written** |
| Destiny | nothing | 48 entries | **all app-written, 0 quoted** |
| Woman and man | nothing | removed 9 Nov 2026 | gone |

The legible counts for Tarot, Born, Health and Numbers are lower than 366
because the OCR dropped or mangled headings; they are a floor, not the book's
real count. The period and card counts are floors for the same reason: the scan
interleaves the page's two columns, so a card can be present but not contiguous
in the text.

## The twenty-six days that were not from the book at the audit

| Date | Title in the app | Title in book? | Description overlap |
|---|---|---|---|
| 1-6 | The Day of Substantiation | **no** | 0.00 |
| 1-7 | The Day of Unusual Interests | **no** | 0.00 |
| 1-8 | The Day of the Big Bang | **no** | 0.00 |
| 1-14 | The Day of the Integrator | **no** | 0.00 |
| 2-3 | The Day of Exacting Realism | **no** | 0.00 |
| 2-24 | The Day of Sacrifice | **no** | 0.00 |
| 3-12 | The Day of the Great Leap | **no** | 0.00 |
| 4-1 | The Day of Dignity | yes | 0.02 |
| 4-2 | The Day of the Idealist | yes | 0.00 |
| 4-3 | The Day of the Fulcrum | yes | 0.00 |
| 4-4 | The Day of Initiative | yes | 0.00 |
| 4-5 | The Day of Consequence | yes | 0.02 |
| 4-6 | The Day of the Given Word | **no** | 0.00 |
| 4-7 | The Day of Enthusiastic Belief | yes | 0.00 |
| 5-27 | The Day of the Road Alone | **no** | 0.00 |
| 5-30 | The Day of the Second Thought | **no** | 0.00 |
| 7-26 | The Day of the Held Authority | **no** | 0.00 |
| 8-15 | The Day of the Held Crown | **no** | 0.00 |
| 8-16 | The Day of the Fallen Position | **no** | 0.00 |
| 8-18 | The Day of the Quiet Authority | **no** | 0.00 |
| 8-19 | The Day of the Full View | **no** | 0.00 |
| 8-20 | The Day of the Public Ledger | **no** | 0.00 |
| 8-21 | The Day of the Whole Record | **no** | 0.00 |
| 9-15 | The Day of the Held Standard | **no** | 0.00 |
| 10-14 | The Day of the Right Register | **no** | 0.00 |
| 11-9 | The Day of the Sealed Chapter | **no** | 0.00 |

All 26 rows above are the audit's original state. Since the audit,
6, 7, 8 and 14 January, 3 and 24 February, 12 March, 1, 2, 3, 4, 5, 6 and 7
April, 27 and 30 May, 26 July, 15, 16, 18, 19, 20 and 21 August, 15 September
and 14 October have had their descriptions replaced with the book's text; 6, 7,
8 and 14 January, 3 and 24 February, 12 March, 6 April, 27 May, 26 July, 15,
16, 18, 19, 20 and 21 August, 15 September, 14 October and 9 November also now
carry the book's titles. Their
0.00 overlap is the score before that repair.

By month: January 4 (6, 7, 8, 14), February 2 (3, 24), March 1 (12),
**April 7 (1–7)**, May 2 (27, 30), July 1 (26), **August 6 (15, 16, 18–21)**,
September 1 (15), October 1 (14), November 1 (9).

At the audit, 20 of these also had a title the book does not contain. The other 6
— 1 April to 5 April and 7 April — keep the book's title ("Dignity", "Idealist",
"Fulcrum", "Initiative", "Consequence", "Enthusiastic Belief") and replace the page underneath it.

Two days sit the other way round: **28 May, "The Day of the Innovative
Trailblazer"**, and **13 August, "The Day of Long Odds"**, have titles that were
not found but descriptions that are the book's. Those are titles to check, not
fabricated pages.

## The meditation line, which is what was heard on May 14

At the audit, the app had a one-line meditation for every day, and **only May
14's was the book's**:

- May 14, before 9 Nov: *"Be modern, and be moderate."* — not in the book.
- May 14, now: *"Study the past, live the present, prepare for the future."* —
  the book's line, word for word.

Three showed a partial match at the audit: **24 February** (*"Many tragedies are done in the
name of love."*), **9 March** (*"Reach for the stars, and know the way
home."*) and **10 July** (*"Retreat, and then emerge in strength."*). The
remaining 340 are still the app's own; the 26 transcribed pages now use the
book's line. Examples of what is still stored for the other days:

- 1 January: *"Make the plan, and then say what you feel."*
- 1 February: *"Prove it to yourself once, and then stop proving it."*
- 1 June: *"Stay to the end, and keep the self."*
- 1 December: *"Make it beautiful, and do not tell them what beauty is."*

None of those sentences is in the book.

## Length is its own warning

The description lengths are not uniform: **25 days are under 1,000
characters, 105 are under 1,800**, and the median is 2,675 (the longest is
3,158). The 26 fabricated pages are short by nature; the 80 days
between 1,000 and 1,800 characters are the ones most likely to be **cut
extracts** of the book's essay rather than the whole page. May 14 was one of
those cuts before 9 Nov: 1,355 characters of a 2,966-character page.

## What the app never shows from the book

- **The Tarot paragraph.** Every page has a reading of the day's card; the app
  prints the card's name and nothing else.
- **Born on this day.** The book lists the day's people; the app has no such
  list.
- **Numbers and planets, in prose.** The app generates "Taurus III · Earth ·
  Fixed · 5 Mercury · Temperance", which is the header, not the page's
  explanation.
- **The book's own Advice and Health wording**, except on May 14.

## What this means for the fix

1. **The 26 fabricated pages were the first repair.** All 26 are done. They are the pages where
   the app is not a condensation of the book but a replacement for it.
2. **The 340 missing meditations are next, and they are small.** A line a day is
   about 15 KB — it fits in the remaining 36 KB without the per-day data file.
3. **Advice and Health need a decision:** quote the book's sections, or keep the
   summaries and label them as summaries. What they must not do is sit under a
   heading that says "the book's page" without saying they are the app's.
4. **The twelve boxes are the app's reading**, not the book's. They can stay, but
   the page should say so once, plainly.
5. **Tarot paragraphs and the Born lists need the per-day data file**, because
   the book's pages are ~5 MB and the page has 36,071 bytes of headroom.

## What changed on 9 Nov 2026

- May 14 carries the book's page word for word.
- All 26 days above are transcribed from the book's pages and no longer carry
  the app-written notice.
- The eleven "Where it shows" boxes are labelled the app's reading, not the
  book's.
- The Destiny paragraph is no longer rendered in the pair reading. The 48-entry
  table is still in the file, unused.
- The twelve clean spreads carry the book's meditation, Tarot, Numbers and
  Born on this day list. Ten more transcribed pages now carry the same full
  sections, and October 14 now carries its Numbers, Tarot and Born list. Four
  more carry the book's meditation. On days without a transcribed meditation,
  the book's page no longer shows the app's invented practice line as if it
  were the book's.
- August 21 and September 15 carry the book's meditation, Numbers and Tarot,
  but their left-hand Born lists are missing from the scan. August 20 has only
  the book's meditation; its right-hand page is missing from the scan.
- **Not done:** word-for-word transcription of the other 340 meditations. The
  scan interleaves its two columns and drops page titles; an automated pass
  returned the wrong page for some days (January 3 for January 7, January 25
  for August 19), so it was not shipped. Those need a clean text source or a
  page-by-page transcription. All 26 transcribed pages now carry the book's
  meditation; 23 carry the full extra sections.

## Limits

The OCR is a two-column scan with dropped headings and split words. The scores
measure provenance, not perfect transcription; a 0.8 is a quotation with OCR
noise, not an edit. Nothing was opened in a browser for this audit — it is a
text comparison, the same file the app ships. The pair library was not audited
here: it comes from *The Secret Language of Relationships*, a different book.

The app's tests: **498 pass, 0 fail**. Nothing in this audit was pushed or
deployed.
