# Handoff — Turn Someday Into Day One

## Where things stand, 4 Oct 2026 (read this first)

**The app is three pages and nothing else — and it is called The Truth.**
Jacques named it on 4 Oct 2026 ("name the app the truth"); that is the name on
the phone (the home-screen name), the browser tab, the shell heading and
`manifest.json`. `/app` serves `hub.html`, a small
shell holding three cards: the Zodiacs (`/key`), the Herbs (`/herbs`) and the
Player (`/music`).

**The Fight is deleted — 10 Oct 2026.** Jacques: "delete the fight from
everywhere." The door, the pages, the 3D ring, its art and sound, its routes,
its lines in the gate, the worker and the build, its spec and its tests were all
removed the same day, and its own record here was stripped with them. The shell
went to four doors with it and the cache name moved to `tsid-shell-v2.5`,
or an installed phone keeps a door that is not there. **Do not rebuild it.**

**The Trainer is back — 11 Oct 2026.** It was deleted on 10 Oct ("Ddelete the
trainer": the door, the page, its two routes, its lines in the gate, the worker,
the Vercel rewrites and the build's file list all went, with its tests), and it
returned the next day, smaller: "then create the trainer we will be slowly so
start off with just basic input information that's it." So the page
(`trainer.html`) asks for the basic information — name, age, height and weight,
days a week, what time of day, what is in the house, what you want out of it,
anything that hurts, anything a doctor has ruled out, and day one — keeps it on
the phone (`localStorage`, key `tsid_trainer_intake_v1`), sends nothing
anywhere and **planned nothing at all** when it came back. The door is
back on the shell, so the shell is **four doors** again and the cache name moved
to `tsid-shell-v2.7` with it, for the same reason as every bump before it.

**The by-10 programme is on the Trainer — 14 Oct 2026.** Jacques: "on the trainer
add the by 10 program thats it I'll give you more details what it is later even
though its based on p90x". So the page carries the programme now, written out as
the Certification's trainer track already described it — the same weekly shape,
the same ten seconds of rest between moves, the same two levels with the same
numbers, the same kit, the three lifting days (A, B, C, eight moves each), the
five cardio choices and the stretch day. `server/test/trainer.test.js` reads
those numbers **out of `certify.html`** and requires them on the Trainer, so the
two halves of the app cannot drift apart about the programme. Their information
still comes first on the page and the safety card still outranks the programme.
The Trainer's card in the shell changed with it (it said the plan came next), so
the cache name moved to `tsid-shell-v3.2`.

**The by-10 came off the Trainer and P90X's rotation went on — 17 Oct 2026.**
Jacques: "p90x workout", then "Remove the workout you made up in the trainer only
p90x is relativity and the by 10 is weaven into those exercise as far as rest
peiod". `trainer.html` now holds P90X's classic ninety-day rotation - thirteen
weeks, three phases, a recovery week after each (weeks 4, 8 and 13), six days on
and one off, and a tick for every day kept on the phone - and nothing else. The
by-10's own sections (the three lifting days, the two levels, the five cardio
choices, the stretch day) were mine rather than his and are gone; the one part he
kept, the ten-second rest, is written into the rotation. The Trainer's card in
the shell changed with it, so the cache name went to `tsid-shell-v3.5`, and
`server/test/trainer.test.js` was inverted: it now holds the by-10 **out** rather
than checking its numbers in.

**The by-10 is the rule, and P90X is the exercises — 18 Oct 2026.** Jacques,
correcting the Certification: "P90x is just the exercises I'm using by 10 is the
theory behind how I train because when I actually train I reorganize p90x you
dont need to do that", and then the rule itself: "The by 10 is 3-5 sets max reps
nomre than 20 and 10 seconds rest that's the gist of it." The trainer track had
grown a programme of its own out of the by-10 and called it the app's - rounds
and rotations, two levels with fixed rep counts, a timed last move, twenty
minutes of cardio, five cardio choices - none of which he ever gave. The track
now teaches the rule as he states it: **three to five sets, every set to as many
good repetitions as the person has and never more than twenty, ten seconds
between one move and the next** (the set range was corrected to two to five the
next day - see below), with P90X named as the exercise source and a
session described as P90X rearranged rather than followed to the letter. The
invented numbers are out of the lessons, the quizzes, the track card and all
ninety "Going deeper" paragraphs (which had been describing a Trainer page that
no longer exists), and `certify.test.js` now requires the rule in the page and
the inventions out of it.

**Why the by-10 works, in his words — 19 Oct 2026.** Jacques: "traditional
workouts rest between 30 seconds to 2 minutes yes it allows you to get more reps
in but it keeps you in the working out longer my by 10 cuts down workout duration
so and 1 hour workout becomes 30 minutes and so on you do less reps in each set
but it guarantees that you burn out and each move is not done in full extension
its at about 3/4 both ways to keep the intensity throughout building strength
cardiovascular system and promotes muscle growth". So the theory is a trade:
thirty seconds to two minutes of rest buys repetitions and a longer session, and
ten seconds buys a session half the length, fewer reps a set, and a set that ends
in failure anyway. The other half is range - about three-quarters in each
direction rather than full extension, so no rep hands the muscle a rest - and the
outcome is strength, cardiovascular work through the whole session, and muscle
growth. That is written into the by-10 lessons (days 3, 13, 31, 32, 36, 40), and
two sentences were **reversed** to make room for it: the track had called the
by-10 "moderate intensity" and had said training to failure was "not the by-10's
choice", which is the opposite of the burnout being the point.

**What the by-10 is based on, and the shape of its week — 19 Oct 2026, same
day.** Jacques again: "By 10 is not based on how much weight you can lift its
finding that comfort to pump ot reps with dumbell sets depend on individual
starting point 2 to 5 sets no matter your level for a beginners 1 weeknof
stretching first to condition the body to restrict injuries by 10 can be done
everyday as long as workout or rotated and do 2 workouts a day resistance and
cardio p90 has a couple of cardio workouts but sometimes I replace those with
jump rope step walking and dancing or I mix them up the week 4 8 12 rest I dont
do I go right intonthenbext rotatation or a full week of cardio and a little
stretching just depends on the mood this is suppose to be able to be explained
to a 2nd grader not with all the complexes of big scientific words keep it
simple because the mind body and spirit are simple".

That corrected six things, and all six are in now:

- **The weight is not the measure.** The rule asks for a dumbbell light enough
to pump reps out with, not the heaviest the person can lift. Day 3 says so
first, and its third quiz question now asks it.
- **Sets are two to five, by starting point rather than by level.** The whole
track said three to five; days 31, 34, 35, 72, 87, 88, 89 and the class-format
day all moved to two to five, and day 35's title with them.
- **Every day, if the workout rotates.** Day 31's FITT-VP answer, day 33's
periodisation and day 88's sample week say the by-10 can run daily; P90X's own
six-on-one-off is named as P90X's week, not the method's.
- **Two sessions a day, resistance and cardio.** Day 3 and days 31 and 88. The
cardio can be P90X's, or jump rope, a step session, walking, dancing, or a mix
(days 42 and 88).
- **A beginner's first week is stretching**, before any dumbbell, to condition
the body and keep the injuries away: day 3, day 48 (the stretch day) and day 88.
- **The recovery weeks are optional.** Weeks 4, 8 and 13 are P90X's. The by-10
does not require them: straight into the next rotation, or a full week of cardio
and a little stretching, depending on the mood. Days 33, 52, 87 and the bridge
lines on days 28, 32 and 52 say it; so does the Trainer's rotation card.

The writing instruction is honoured where the theory lives. Day 3 is now short
sentences a second grader could follow - "pick up a dumbbell you can pump out
reps with, do two to five sets, keep every set under twenty reps, and rest ten
seconds between one move and the next" - and the plain-words version sits
beside the theory rather than replacing the physiology lessons around it.

`trainer.html` now carries the rule on the rotation card: pump-rep weight,
two to five sets, twenty at most, ten seconds, two sessions a day, every day if
the days rotate, the cardio swaps, the beginner's stretch week, and the recovery
weeks marked optional. `certify.test.js` requires the corrected rule in the page
and requires the superseded claims out of it (`three to five sets`, the
"Three sets to five" title, the six-days frequency and the old recovery-week
bridge); `trainer.test.js` requires the rule on the rotation card. 442 tests,
442 pass.

**Sixty-two more herbs, researched, and the certificate teaches them — 19 Oct
2026.** Jacques: "research more herbs that are not in the app and correlate new
findings where they need to be lessons certificate", then "Next step: Research
more herbs", then "Next step: Research a third batch", then "Next step: Research
a fourth batch", then "Next step: Research a fifth batch". Five batches went onto
the shelf the same day, **266 to 328 cards**.
The first fourteen: dulse, bitter leaf, baobab, rooibos, cleavers, self-heal,
usnea, oak bark, arjuna, guduchi, danshen, notoginseng, maitake, sutherlandia.
The second twelve: ivy leaf, primula root, sweet wormwood, nutmeg, miswak,
bergamot, griffonia, rye pollen, tart cherry, soy, white peony, chrysanthemum.
The third twelve, the shelf's hard edge: ephedra, aristolochia, germander,
frangula bark, chanca piedra, mastic, birch leaf, hoodia, pippali, haritaki,
vasaka, African potato.
The fourth twelve, the counter shelf - what people actually buy: berberine,
glucomannan, guar gum, diosmin, goji, jamun, black currant seed oil, Artemisia
afra, lovage root, avens, Agaricus blazei, kanna.
The fifth twelve, the pharmacopoeia's edge: Iceland moss, sundew, orthosiphon,
restharrow, greater celandine, thuja, calamus, camphor, He Shou Wu, white
mulberry leaf, coleus, bromelain. Its first four are the European monograph's
own ground, the next four are there for a file against them, and the last four
are sold extracts whose trials are small or null. Several of those cards print
**no amount at all**, and say why: the monograph PDF could not be read, or no
regulator has set a dose - the page does not fill that gap from a shop label.

None of them is in the three books, so **none carries a From the books line** -
each is the page's own card, written after reading a monograph, a trial or a
regulator's page, and each says in its own words where the evidence is thin or
where the name is doing the promising. The cards that exist for their cautions
say so on their face: usnea is never taken inside (usnic acid and reported liver
injury), oak bark is three or four days and an hour from other medicines,
danshen is the warfarin card, sutherlandia keeps the HIV trial that changed
neither viral load nor CD4 count, ivy leaf is never for a child under two,
sweet wormwood may not stand in for malaria treatment, and nutmeg has no
medicinal dose at all. The third batch sharpens the same edge: ephedra keeps the
FDA's 2004 rule and the deaths, aristolochia has no safe amount and keeps the
Belgian substitution, germander has no dose and 26 hepatitis cases, frangula
bark is one week and over-twelve only, and African potato never replaces
antiretroviral therapy. The fourth keeps the trial rather than the claim:
berberine's 36-person metformin comparison is not equivalence and its CYP
inhibition is real, glucomannan needs its water, guar gum's claim is 10 grams a
day, diosmin's bleeding review is in, goji carries the warfarin reports, jamun's
99-person trial is one small study, black currant seed oil was no better than
placebo, Artemisia afra's malaria trial was retracted, avens has no trial at
all, Agaricus has no survival benefit and an arsenic signal, and kanna is not
clinical depression evidence. The fifth runs the same way: Iceland moss is
traditional use with a printed amount the card refuses to invent, sundew has no
monograph at all, restharrow's agency record says outright that no studies in
patients were done, greater celandine keeps the 62-year-old hepatitis case and
the 22 German reports, thuja keeps the seven-month-old's seizures and the
external-only rule, calamus keeps the rat leiomyosarcomas and the 1968 food ban,
camphor keeps the one-gram fatal ingestion and the 0.5-to-1-gram lethal
estimate, He Shou Wu keeps the 25-person liver series, white mulberry leaf keeps
the 20-person crossover and the committee's high-risk-of-bias rating, coleus
keeps two small weight trials that disagree, and bromelain keeps the 47-person
knee trial that was no better than placebo.

The herbalist track teaches them where their ground is. Days 14, 22, 31, 42, 43,
44, 45, 46, 47, 54, 58, 61, 62, 63, 65, 66, 67, 68, 69, 70, 71 and 72 each carry
a link onto the cards, and the days whose ground a batch belongs to say
the finding in a sentence of their own. No day count, quiz count or pass mark
changed.

`server/test/herbs-books.test.js` gained tests for each batch: all of them are in
the library with full fields and no book line, and the facts that have to travel
with them (the amount, the trial size, the interaction, the missing monograph)
are asserted by name - plus a card opened and read on screen. `certify.test.js`
pins every researched card to its day and requires the teaching sentences, and
requires the pages to render the card doors. While adding the third batch, a
**duplicate key in that test's `wanted` map** was found and fixed: day 43 had
been appended twice, so the later entry silently overrode the earlier one and
the second batch's bergamot and griffonia links were not actually being checked.
The map is now one key per day, in day order, with a comment saying why.
**479 tests, 479 pass.**

**Two parts open at once — 18 Oct 2026.** Jacques: "the fix: two parts open at
once." Every door on the shell (`/app`) replaces it with the part it opens, and
inside the installed app there is no tab bar to open a second part in — one tap
on a door and the first part is gone. So the shell carries both parts itself
now: a **Two at once** button above the doors turns the screen into two panes,
one above the other, each holding the very page its door leads to. Nothing here
reaches round the door — a pane asks for `/key` or `/herbs` exactly as a tap on
the card does, so the server checks the session and the list for it the same way,
and `sw.js` still keeps every one of those pages out of its cache.

Three things are deliberate. **A part is never loaded twice:** picking the part
already in the other pane swaps the two, which is what changing one into the
other means and spares the phone a second copy of the heaviest pages here. **The
two are remembered** (`localStorage`, `tsid-split`), so the app opens on the two
parts he was using, and closing the panes does not empty them — **signing out
is the only thing that does.** And a part's own way back ("← The app") is read
as what he meant — the doors — rather than drawing the shell inside its own pane.
Because no other shape fits a phone, the panes are stacked rather than side by
side: two half-width columns of a 412px screen are not readable, and every page
here was built full width (the Key was audited at 412x915). **Tall** gives the
pane being worked in the whole screen and leaves the other one loaded behind its
own bar, one tap from being the tall one.

`server/test/hub-split.test.js` — 9 tests. The table the panes are filled from
must match the doors exactly (in order, same addresses, same names, so a sixth
door cannot slip in unnoticed); nothing loads until he asks; asking loads
**both**; the second part never replaces the first; a swap never loads a page
twice; the choice survives a close and a reopen but not a sign-out; and a pane
landing on `/app` closes the panes instead of nesting the shell. Version moved
to `3.6` in `hub.html` and `tsid-shell-v3.6` in `sw.js` together — a new screen
on the shell is a changed shell, and an installed phone that never rebuilds has
no way to open a second part at all. Suite: 451 tests, 451 pass.

**The third book is on the herbs — 18 Oct 2026.** Jacques pasted the text of
*Melanin: What Makes Black People Black!* (Llaila Afrika, Seaburn, 2009) and
said: "put this in the herbs." It is on the Herb Library's **From the books**
tab now, as its own eleven shelves — the foreword's argument, what the book says
melanin is (the pineal, the molecule, the melanocytes), what it takes in, where
it is in the body, the two hormones, how it says to measure melanin, its six race
types, its comparison of the two races, its psychology chapter, its nutrition
chapter, and the two principles with the twelve clusters. It went there rather
than into the A–Z shelf for the reason that tab exists: most of a book about
melanin is not about one plant.

Two rules came with it from the tab it joined, and both are pinned by tests:
**every line is the book's claim, printed as the book's claim**, and where this
page has a line of its own it sits in the box at the foot of the section and says
so — so the pH and blood-pressure shelf says the self-test is the book's and not
this page's, and the safety tab still outranks the whole shelf. The three herbs
the book names for melanin (ginkgo, gotu kola, echinacea) are already on the
page's own shelf with their cautions on them, so the nutrition shelf points at
them instead of restating them.

**The sixty days are untouched.** The course was written out of the first two
books and its day one still names two of them; rather than rewrite ninety
lessons and the day-one quiz around a third book, the tab's own card says so.
`herbs-books.test.js` gained three tests: every shelf renders with real rows
rather than a title alone, every shelf says whose voice its box is, the intro
card now says three books and names the third, and every herb the nutrition
shelf names is a real entry carrying its caution. **No version bump:** `sw.js`
skips `/herbs` before any handler can answer it, so the shell did not move.
Suite: 454 tests, 454 pass.

**The herb course went to ninety days, and the third book went into both tracks —
18 Oct 2026.** Jacques: "Alignment: Expand it to 90 and correlate the melanin
book info into both the herbs course and the certification." So the library's
course is ninety days now, the same length as the Certification's herbalist
track, and the two can be read side by side.

**Days 60 to 89 are the melanin book, whole.** Every one of the thirty is built
out of the twelve shelves already transcribed on the From the books tab (18 Oct
2026), and nothing is invented to fill a day: the pineal as master gland, what
melanin does, what it is like, the molecule, where it is made, what it takes in,
resonance, where it is in the body, the gland itself, the nerves, where the
brain keeps it, what dulls it, the alkaloids, serotonin, melatonin, the drug
claim, free radicals, the saliva and urine reading, insufficiency, deficiency,
where the book stops, the six types, the standard-that-is-not-your-own, the two
melanins, the two brains, the senses and the body, two ways of thinking, what
melanin is built from, and the twelve clusters. Each day is three or four
paragraphs, a book line where the shelf gives one, this page's own note, and
five questions in the same plain style as the rest of the course. Day 90 is the
test, still thirty questions and twenty-four to pass; five of its questions now
ask about the third book (the master gland, serotonin, melatonin, the two
melanins, the three herbs), so the test covers both halves. The tab reads **90
days**, the progress line says "of 89 days done", and the bridge to the
Certification writes total 89.

**The Certification carries the same book.** Ten of its herbalist lessons now
say what the third book says and say whose it is: day 2 is "The three books, and
how they are quoted" and quotes it like the other two; day 21 and 22 carry its
vitamin and mineral lists; day 24 and 70 carry its pineal-as-master-gland claim;
day 35 sends its six race types, its two brains and its lab-values charge back
to the book; day 37 and 64 add its daylight serotonin and ten-at-night melatonin;
day 40 puts its drug claim beside the first safety rule without moving the rule;
and day 67 keeps its melanin-in-the-skin claim while leaving the red flags
unchanged for every skin. Its references to the library now say ninety days
throughout, and `libLabel` reads "Herb Library - the ninety days".

**Tests:** `herbs-course.test.js` is pinned to ninety days, eighty-nine teaching
days, day 90 as the test, and the bridge total of 89; the day-90 record
migration is checked the way day 60's used to be. Suite: 454 tests, 454 pass.
**No version bump:** `sw.js` still answers nothing for `/herbs`.

**The Read this first tab came off the herb library — 18 Oct 2026.** Jacques:
"Remove what: Remove the \"Read this first\" tab itself." So the tab went: the
chip in the strip, its seven boxes, its read-aloud (`SAFETY_BOXES` and
`safetySayText`), its render branch and its `#safety` address. The strip is
seven tabs now — A–Z, By need, From the books, 90 days, Meal plan, The deep
story, My notes — and nothing on the page points at the one that left.

**The lines themselves did not go with it.** They were already day 28 of the
course in the page's own words, and that day is the only place all seven now
sit together: its subtitle and its last paragraph were rewritten to point at
itself rather than at a tab, and its last question asks where the lines live
now (the day, and the card of every herb they touch). Every card still carries
its own caution, and the infection refusal is still written into the entries
where it matters, so the shelf is not left without the line that matters most.
The books and melanin shelves now say "the page's own lines are not softened by
any of it" instead of naming a tab, and the one line that lived only in the
tab's foot box — *the claims are made here plainly* — moved to the From the
books intro card as **The voice**, so the page's own statement about its own
voice was not lost with the furniture.

**Everything that pointed at it now points at day 28.** The Certification's
`GO_DEEPER` doors that landed on `/herbs#safety` land on `/herbs#d28` (the
label comes out as "Herb Library - day 28"), the doors whose real subject was a
plant card go to the cards, `libLabel`'s dead `#safety` branch came off, and the
Certification's own teaching says "the library's day 28" where it said "the
safety tab". A phone still holding `#safety` in its history opens the library
on its ordinary A–Z tab rather than a blank page; a test pins that, and the
voice and course tests now check the lines on day 28 instead of on the tab.
**No version bump:** `sw.js` still returns before any handler can answer
`/herbs`, so the shell did not move. Suite: 454 tests, 454 pass.

**The cards on the Key are a reading, not a draw — 14 Oct 2026.** Jacques:
"why the cards don't read like a tarot reading it's short and it should be read
like a professional tarot reader and they should only be chosen based on
birthday relationships and destiny by asking a few key questions and what a
person is going through or what they are seeking." Both halves of that were
true. The tab dealt three cards at random for nobody in particular with one line
under each — about 120 words in total, one line less than the card's own entry
in the birthday table, and answerable by pressing the button again. It is a
session now. **Five questions** come first (whose reading, what it is about,
what you are going through, what you are seeking, and a second birthday when the
reading is about two people), every one of them a dropdown, because this page
has never read what somebody typed. The birthday gives the **personality and
soul card** by the method Mary K. Greer publishes (day + month + the full year
as numbers, reduced by digit sum, with 19 keeping its whole chain 19-10-1), the
**personal year number**, and — for two people — the **card the two birthdays
make between them** (both birth cards added, cut back by twenty-two). The spread
is dealt from a shuffle **seeded by the birthday and the answers**, so the same
question deals the same reading, a changed answer changes the cards, and the
significator is always on the table; the old `Math.random()` draw is gone. A
reading is an opening that names the question in the querent's own words, a full
paragraph on each of the three positions, a synthesis that reads the three
together, the destiny layer read against the question, and a close that hands
the question back — around 800 to 950 words. Each answer in the four `ASK_*`
tables carries four things (its label, its opening line, a sentence said against
each card, and the question it hands back), because an answer that changes
nothing is decoration. **The month and the day start unchosen** — a dropdown
defaulting to the first of January would deal a reading for a birthday nobody
gave, and there is a test for it. `server/test/key-tarot.test.js` runs the
page's own `renderCards()` against a stand-in screen, so a reading missing a
part of itself, or gone short again, fails the suite. Nothing is stored, nothing
is sent, no card predicts, no card says a person is finished, and no reading
uses a pronoun for somebody who is not in the room. **No version bump:**
`key.html` is never cached — `sw.js` skips `/key` before any handler can answer
it — so the shell did not move.

**The Player reads audiobooks, PDFs and text files — 15 Oct 2026.** Jacques:
"make my player able to read audio books and pdf and text files." Three kinds of
file, one ask, and only some of them are sound.

**The audiobook half is on the player card itself.** An audio file always played
here, so what a book needed was the three things a three-minute song never
needed: **a place it remembers, a way back and on, and a speed**. The card now
carries −15s / +30s, a hidden **Start it again** that appears only when a place
was picked up, and 0.8× to 2× chips. The place is kept per track every few
seconds while it plays and again on pause and on the page going away, under
`tsid-music-pos`; within ten seconds of the end (or the first five) it is cleared
rather than saved. The rate lives under `tsid-music-rate` and is applied to
**both** `<audio>` elements, because the cross-fade plays the next song on the
other one and a speed that only touched the first would be lost at every join;
a track already playing is corrected where it plays, so a rate chosen mid-book
is heard from that moment. **`music.html` now leaves one window open —
`window.PLAYER = { key, name, audio }`** — because a place is only meaningful
against the track it belongs to, and the reading half must not guess that from
the file name printed on the card. The cross-fade's next song is left exactly
where it starts (`el !== playerEl()`), or the bookmark of one chapter would be
written onto the next.

**The reading half is a fifth tab, Read**, after Cover — and the last tab since
the Discover tab came off on 17 Oct 2026. Choose a
PDF, a text or a Markdown file, and the words are lifted out **on the phone** and
read aloud a paragraph at a time by the phone's own voice. The paragraph is the
bookmark, so a book opens where it stopped and says so in words. Markdown loses
its hashes, asterisks, link brackets and pipes before it is spoken — a renderer's
punctuation is not something a voice should read. Books are kept in their own
database (`tsid-books`, store `books`) rather than the player's, because adding a
store to the player's needs a version bump and the connection the player already
holds open would block it.

**Two things were found by running it rather than reading it, and both matter.**
(1) **The PDFs in this repo are ASCII85 on top of Flate** — ReportLab writes
`/Filter [ /ASCII85Decode /FlateDecode ]` on every stream it makes. The first
version of the extractor knew only Flate, and it read **0 words** out of
`START-HERE.pdf`, `Studio/Studio-Guide.pdf` and `SESSION-SUMMARY-25AUG.pdf`; with
the ASCII85 decoder in, the same files give **15,552 / 8,116 / 1,091 words** as
real paragraphs. Streams are also skipped **by name** when the filter says
`DCTDecode` or `JPXDecode` — a photograph is not words, whatever its bytes
decompress to. (2) A **document-wide floor on letters** is what tells a scan
apart from a letter, and set high it refuses a short honest page and calls it a
picture. It sits at 60 letters with a letter-to-character ratio, and a page of
gibberish still fails it. When a PDF yields nothing, the page says which of the
three it was: a scan with no words in it, a file that would not open, or a
browser too old to unzip — never the wrong one confidently.

**The book is not read twice.** The reading speaks through the page's existing
voice (`window.SAY.speak`, added the same day as a way to have something spoken
that is not on the screen), so there is still exactly one
`SpeechSynthesisUtterance` on the page; `voice-all-pages.test.js` fails if a
second one appears. The open-book card is `noSay`, or pressing **Read it to me**
would read several hundred paragraphs back at him, and asking the screen to read
itself stops the book first. **The page's Stop stops the book too.** A cancelled
utterance can still report itself finished — `speechSynthesis.cancel()` and a
real ending look the same from the callback — so a reader that only listened to
the callback would speak the next paragraph after every Stop: the sound stops
and the book carries on anyway. It is guarded, and there is a test that fires the
end event after a Stop to prove it.

**`server/test/music-reader.test.js` — 27 tests.** PDFs are built in the file
with Node's own deflater and a small ASCII85 encoder, in both the shapes a real
generator writes, and the whole tab is **driven as a person would drive it**
(a stand-in page, a file chosen, Read aloud pressed, a paragraph on, the book
reopened) so "opens where it stopped" is proven, not asserted. The repo's own
`START-HERE.pdf` is read in the suite as well — the file he would actually
choose. **No version bump:** `music.html` is never cached — `sw.js` skips
`/music` before any handler can answer it — so the shell did not move.

**Both herb courses ask five plain questions a lesson — 15 Oct 2026.** Jacques:
"As I'm doing to herb certification i dont its confusing rewrite it on the level
a 2nd grader would understand in the quiz give 5 questions," and then, on how
much of it and where: "Both herb tracks' quizzes (Certify + Herb Library)",
"5 questions after every lesson", "All 90 days now." So the two herb tracks of
this app were rewritten whole — not the plant prose, the quizzes after the
lessons.

**`certify.html`, the herbalist track: all ninety lessons, three questions to
five.** Every question is a short sentence read straight off the lesson (nothing
over **14 words**, and the reason under each answer nothing over 18), and the
right answer is not parked in one position: the checks count each position across
all 450 questions and fail if any one of them holds 300 or more. The trainer
track was **left at three**, because the ask was the herb tracks and its own
three-question quiz is the by-10 ground it always was.

**`herbs.html`, the library's course: all fifty-nine teaching days, to five.**
Its questions carry the same **14-word roof** as the herbalist track, so the two
herb courses read alike (the five longest were trimmed to fit). Day 60 is the
test rather than a lesson, so it keeps its thirty questions, and both counts are
pinned in the suite so no later edit can drop them back.

**Two things the rewrite exposed, both fixed rather than left.** (1) **The pass
mark was fixed at two, of a quiz that might ask five.** `PASS_DAY = 2` scored a
five-question day at two right — a quiz nobody can fail — while the page's own
copy said "of 3" under it. The mark is **per track** now (`PASS_DAY_HERB = 4` for
the herbalist track, 4 of 5, the same four-in-five the block tests ask; `PASS_DAY
= 2` for the trainer), the day's pass is decided in one function,
`passOk(id,right)`, and the copy reads the mark and the count off the track
instead of repeating a number. (2) **`herbs.html` labelled the day-60 test
"twenty questions"** over a test of thirty. It reads the count off the day now.

**The tests came with it.** `server/test/certify.test.js` pins five a lesson on
the herbalist track and three on the trainer, keeps the plain-and-short roof on
the questions, and drives the new pass rule through the page's own surface
(four of five passes, three of five does not, the trainer unchanged).
`server/test/herbs-course.test.js` pins five on every teaching day. **No version
bump:** `sw.js` skips `/certify` and `/herbs` before any handler can answer them,
so the shell did not move.

**A quiz that changed means the score goes with it — 15 Oct 2026.** Jacques, on
the Certification's day list still reading **3/3 ✓** down ninety rows: "Why is it
still showing 3 its should just start completely over." He was right, and the
reason is worth writing down, because the two pages had the same fault in two
different shapes.

**The Certification kept the number.** A day was stored as
`{ right, total, passed, on }`, so a day answered at three questions went on
saying three of three after its quiz became five — and the block tests and the
ultimate examination are drawn from those same rewritten quizzes. `load()` now
drops any day whose `total` is not the number of questions that day asks now,
and a track that lost one drops its block tests and its examination with it: the
day opens again and the tests are owed again. It is written straight back to the
phone, so it happens once, and the Herb Library — which reads that store to
report where the ninety days have got to — reads the cleaned state rather than
the old 3/3s. **The trainer track is untouched**, because its quizzes are the
three they always were; there is a test that seeds both tracks and proves it.
The track screen says the rule out loud: *"If a lesson's quiz is rewritten, that
day opens again: a score against a different quiz is not a score."*

**The Library kept the position.** An answer there is stored against the question
it was given at (`a: [0,1,2]`), so the old answers did not merely sit there —
they would have been **painted onto the new questions**, marked right or wrong
against words nobody had read, and counted in the score. A day now remembers how
many questions it asked (`r.n`), and on open any record written for a different
number is dropped rather than repainted. The day-60 test kept its thirty
questions through the rewrite, so a record of it stands. That cleaning runs
**after** `save()` rather than at the top of the script, and calls it, because
the Certification's line about these sixty days is written by `save()` — a
cleaned store with a stale summary beside it would have the two halves of the app
disagreeing about the same progress.

**No button and no instructions.** Both pages notice for themselves on the next
open, which matters because the progress is on his phone and not on any server we
could reach. **Two new tests** cover it (a stale store pruned and written back,
and the Library's answers dropped while the test's thirty survive), and two
existing fixtures that still described a three-question herbalist day were
corrected to the five it asks now — a fixture written for a quiz the page no
longer has would have been testing the prune rather than what it was written for.
Suite: 454 pass, 0 fail.

**The check runs on every open, and the test day is no exception — 17 Oct 2026.**
The Library's prune above cleaned a phone **once** and then switched itself off:
it was gated behind `store.quizN !== QUIZ_N`, so a second rewrite of the questions
would have repainted the old answers after the first open, and its day-60 branch
compared the test's length with itself (`day.test ? day.q.length : 0`), so no
test record was ever dropped however few questions it held. Both are one
promise — *does this answer belong to the quiz that is here now* — so the check
now measures every `day:` record against the day in front of it on **every**
open, and writes back only when it actually dropped something, the way
`certify.html`'s `dropStaleDays()` already did. `QUIZ_N` stays as the marker for
stores written before answers carried a count: a record with `r.n` is judged by
its own number, and one without is judged by how many answers it holds (three or
four on an old teaching day, so it goes; the test kept its thirty, so an old test
record stands at any depth). A teaching day can no longer keep answers to a quiz
it no longer asks even if nobody remembers to touch `QUIZ_N` — and that constant
is now pinned to the days themselves in `herbs-course.test.js`, which had held
the quiz lengths but never the number the page compares against. Suite: 456 pass.

**The music and movie search is gone — 17 Oct 2026.** Jacques: "Remove the music
and movie scraper." The Player's fifth tab, **Discover**, was a catalog search:
it sent a title to Apple's iTunes API for songs or to TMDb for films and series,
showed the poster and metadata, offered a "Where to watch" lookup through
JustWatch, and kept a watchlist in `localStorage` (`tsid-watchlist`). Nothing
was ever downloaded — it only linked to official listings — but it was the one
part of the Player that spoke to another company, and it is off the app.

**What went:** the Discover tab and its whole panel, the `catalog` block of the
page's script (search, popular browse, providers, pagination, the saved list),
the 446 lines of catalog CSS that the panel had accumulated, and the footer
sentence that promised the search. On the server: the `/api/catalog/*` routes,
their limiter and mount in both `server.js` and `vercel-app.js`, and
`server/catalog.js` with `server/catalog-routes.js`. Their two test files
(`catalog.test.js`, `catalog-routes.test.js`) and the catalog block inside
`vercel-app.test.js` went with them; two guards stay: a signed-in request to
`/api/catalog/music` is a 404 rather than an unlinked-but-live route, and
`music.html` is checked for the tab and for any catalog address. Suite: 442 pass
(456 before: sixteen catalog tests went and two guards took their place — the
count that went is tests, not tests going quiet).

**Kept, untouched:** the local player, playlists, the meditation room, the
ringtone cutter, the cover maker and the Read tab. Nothing the page did with the
person's own files depended on the catalog. `TMDB_READ_ACCESS_TOKEN` is no longer
read by anything, and none is set in this workspace; if one is ever put in
Settings → Environment it will do nothing.

**The herb library has no Friendly on it.** The ask box came off `/herbs` on
4 Oct 2026 ("take a friendly off the herbs"). An open herb carries a **Read it
to me** button instead, which reads the entry out loud with the phone's own
voice (`speechSynthesis`) — no key, no server, no cost and nothing sent
anywhere. Its safety lines are unchanged and still on the page's own safety tab;
the tax page's ask box is untouched. Everything else is a reference page (`/tax`, `/privacy`,
`/delete-account`, `/letter.html`, `/admin/stats`), or an asset.

**The recovery app is deleted.** Its page — the one 15,000-line file that held
the entire client, every entry below's "the app's page" — was removed on 4 Oct
2026, along with the server routes that served it and the eighteen test files
that read it. Anything below this note that describes editing that page is a
dated record of work done while it existed. **Nothing edits it now, and no rule
about it applies.** Where an entry says to change a version, a screen or a
helper, the file to change today is almost always `hub.html` (the shell) or the
page the feature lives on.

**What is live and what is not.** The day counter, the lesson programs, the
journal, the SOS tools, the weeklies and Friendly were all part of that app and
went with it. `/app` is free and private: the door is the `FRIENDLY_EMAILS`
allowlist plus the owner address. Nothing is sold, so ignore every entry below
about payments, Stripe, rooms or the store listing billing.

**Where it is served, 4 Oct 2026.** The app runs on **Vercel**, not Railway.
The live address is **https://thetruth-theta.vercel.app** (a second alias,
`https://app-thetruth.vercel.app`, resolves to the same build and behaves
identically — both gate every private page). Vercel checks the filesystem
before it runs any rewrite, so the private pages are deliberately **not**
static files there: `vercel.json` builds into `webroot/`, `vercel-build.js`
copies only assets into it and refuses to finish if a `.html` ever lands
there, and the pages travel inside the `api/index.js` function
(`includeFiles` is one brace-expansion glob — Vercel rejects a list). The door
is `APP_PASSWORD` plus the `FRIENDLY_EMAILS` allowlist; the AI routes proxy
Gemini with `GEMINI_API_KEY` held server-side. The Railway host below is kept
as the record of how it was built, not as the current host.

**The spare word, 5 Oct 2026.** Jacques could not get in — the password box
answered "that password is not right" — and there was no way back: one word,
kept nowhere but the host's own settings screen, on a host he had to find on a
phone. So there are now two settings beside `APP_PASSWORD`:
`APP_RECOVERY_PASSWORD` (a second word that opens the same door) and
`APP_OWNER_EMAIL` (the one address it opens for — the same address Friendly
already uses for diagnostics, and it must be on `FRIENDLY_EMAILS` as well).
Either word signs the owner in; the list still decides who belongs. Set both
and keep the spare written down somewhere away from the phone. With
`APP_OWNER_EMAIL` unset the spare opens nothing, on purpose: a word that opens
the door for whoever guesses it is a back door, not a way back. The tests in
`server/test/vercel-app.test.js` hold all of this, including that the spare is
refused for the wife's address.

**The meditation room, 5 Oct 2026.** The eleven tracks in `audio/meditation/`
(rain, ocean, night, night fade, cozy storm, deep focus, himalayan still,
still waters, midnight lullaby, fading into the night, whispers in the forest)
belonged to the recovery app and were referenced by nothing at all after it
went — they were not even reachable: the build copied only the folders the app
still needed, so every one of them answered 404 on the live host. They now sit in the Music
page's Player as a card of their own, one tap each, stepping with the same
prev/next as the person's own songs. They are deliberately **not** in the
`songs` list: they are not the person's files, so they carry no ✕, "remove all"
leaves them alone, and nothing is copied into the phone's storage for them.
`vercel-build.js` gained `audio/meditation` in `DIRS`, which makes those files
public URLs on Vercel (about 32 MB of deployment weight) — that is the trade for
them playing at all, since a gated route cannot stream range requests the way
the static file can.

**The Player's scan, and its manual — 14 Oct 2026.** Jacques: "in the player put
the manual on a drop down menu and scan folder doesnt work scan set up only to
scan only music folder or download and make sure it doesnt pick up the song
twice". Three changes on `music.html`, and the reasons are the interesting part:

- **The manual is a `<details>` now**, closed by default, above the songs instead
  of between the player and them. It opens with no script: the browser's own
  disclosure.
- **The scan looks in two folders and two only** — Music and Download (and
  "My Music"/"Downloads", which are the same folders under other names). A
  folder that is neither is refused by name rather than walked. On a computer the
  directory picker is still used and is started in Music; **on a phone it never
  could work**, because `showDirectoryPicker` does not exist in any Android
  browser, Safari or Firefox — that is the "doesnt work" he was looking at. A
  phone now gets the folder chooser on a hidden `<input type="file"
  webkitdirectory>` instead, which it does have, so the scan reaches the Music
  folder on the handset.
- **The same song can no longer land twice.** A file was already kept by its
  name, its size and the moment it was last changed; a second copy of the same
  track — the Music one and the Download one, with two dates on them — is now
  recognised by its name as well, and counted as already here rather than added
  as another row.

`server/test/music-scan.test.js` drives all of it: the walk over a fake folder,
both halves of the location rule, the phone path, and two copies of one track
against the page's own `addFiles`.

**The old system-wide sign-off rule is gone — 19 Oct 2026.** Jacques asked for
the audit's finding to be removed from the app and the tests. The last copies
went. `certify.html` days 24 and 70 no longer make a clinician's sign-off the
rule the rest of the system returns to; a measured gland is described as **not
an herb's ground**, and the quizzes ask that rather than who owns it.
`herbs.html`'s heart, thyroid and mineral lines say the same. The red-flag
lines stay exactly where they were — a symptom, a pregnancy, a prescription or
a child still stops the page and sends the person to care — but the old
hierarchy is no longer stated anywhere. The four tests that carried the old
wording (`certify.test.js`, `herbs-course.test.js`, `herbs-deep.test.js`,
`trainer.test.js`) were updated with it. Whole suite: **491 pass / 0 fail**.

**A mucus scale, a questionnaire, and a plan from Gemini — 19 Oct 2026.**
Jacques: "food categorize by how much mucus it can make scale 1-5 5 is
dangerous 1 is safe 3 is risky and everything in between falls in those ranges
then I want it to have questionnaire that ask questions based on a person goal
gain weight and muscle, lose weight and sculpted, live a healthier life with
lifestyle changings, be pain free, live longer, its based on age gender race
current health state healthy in between unhealthy then Ai gemini would summarize
everything and based on the questionnaire put a meal plan together but it would
only correlate with the Dr afika book".

`herbs.html` grew an eighth tab, **Mucus scale**, with two doors inside it:

- **The scale** holds 149 foods, each with a number and a band: 1.0–1.9 Safe,
  2.0–2.9 Low, 3.0–3.9 Risky, 4.0–4.9 High, 5.0 Dangerous. The food is grouped
  by band rather than by plant, because the band is the question the tab
  answers. The tab says in its own voice that the books do **not** print a 1–5
  table — the number is the page's reading of their principle, not a quotation.
- **My plan** asks the five goals (gain weight and muscle; lose weight and get
  sculpted; live a healthier life with lifestyle changes; be pain free; live
  longer), age, gender, race, current health state (Healthy / In between /
  Unhealthy), and one box for a condition, allergy, medicine or pregnancy.
  Gemini writes a seven-day plan from those answers, and the plan is kept on
  the phone beside the notes.

The prompt is `server/mucus-plan.js`, not the page. It reads the 149 foods out
of `herbs.html` so there is one list, names *African Holistic Health* and
*Nutricide* as the only sources, keeps the books' plate (fruit morning, raw
midday, steamed evening, the eighth-to-quarter teaspoon of seasoning), keeps the
two exclusions (no dairy, no fried food) and the three whites, and makes the
week plant-built. It permits no 4.0 or 5.0 food, at most one 3.0–3.9 a day, and
a rough daily average at or below 2.5. It also says plainly that food is not
medicine, that a pregnancy, a child or a condition goes to whoever manages it,
and that race is context and never a diagnosis. `server/mucus-plan-route.js`
mounts `POST /api/mucus-plan` above the global parsers on Railway with the same
signed-in + allowlist gate as The Key's route; `server/vercel-app.js` carries
the same route for the Vercel build. The Gemini key stays in a header, never in
a page, a URL or a response. The page tells the person the answers go to Gemini
once; it does not repeat the page's old "nothing is sent anywhere" line over
the plan.

**No cache bump.** `/herbs` is one of the pages `sw.js` never serves from the
cache, so the tab is picked up on the next load. The shell did not change.

**Tests:** `server/test/mucus-plan.test.js` checks the 149 foods (range, half
steps, no duplicates, every band populated), the band boundaries at 1.9/2,
2.9/3, 3.9/4, 4.9/5, the five goals and three health states on the form, a
saved plan drawn with seven days, the prompt's source and safety rules, the
answers' clipping, the request body's JSON mode, fenced-JSON parsing, and the
route's gate and key handling, and the page's own build call keeping a plan and
reporting a failed one. Whole suite: **491 pass / 0 fail**. Nothing was
opened in a browser — there is no browser in this environment, so the checks
are the suite and `node --check` on the four server files.

**The push rule (from CLAUDE.md, and it is the current one):** never push unless
Jacques says push. When he does: `claude/new-session-im7bzg`, then `main`, then
`claude/vibe-code-uwxxlk` — all three, same commit. The branch names in older
entries below are out of date.

---

## What this is

**Four doors and nothing else, free and private.** The Zodiacs (`/key`), the
Herb Library (`/herbs`), the Player (`/music`) and the Trainer (`/trainer`),
reached from the shell at `/app`, plus a reference page for tax, the policy
pages the store requires, a letter link and the owner's stats page. The day counter, the lesson
programs, the journal, the SOS tools, the weeklies, the live rooms and the AI
companion all belonged to the recovery app that was deleted on 4 Oct 2026.
Nothing is sold. One person built it and runs it.

## Shape of it

- `hub.html` — the shell at `/app`: three cards, the sign-in form and the door.
- `music.html` (the Player) — added 5 Oct 2026, behind the same door as the rest.
  (`trainer.html`, the gym, was added 9 Oct 2026 and deleted on 10 Oct 2026.)
- `key.html` (The Zodiacs), `herbs.html` (the Herb Library), `tax.html` — the
  private reference pages. `letter.html`, `admin-stats.html`, `privacy.html`,
  `delete-account.html` — the plumbing and the policy pages.
- `server/` — Node/Express, `node:sqlite`. `server.js` routes, `db.js` schema,
  `auth.js`, `private-app.js` (the door), `key-reading.js`, `push.js`,
  `backup.js`, `email.js`, `analytics.js`.
- **The lessons are deleted (6 Oct 2026).** `data/lessons/lesson1..13.json`,
  `data/lessons.json` and `data/build-lessons.js` are gone. No page served them
  after 4 Oct, when the app that read them was removed, so 390 lessons of text
  had no screen left to reach. `data/stories.json` and
  `data/audio-stories.json` are still here.
- **Lesson audio went with them.** `data/lesson-audio-manifest.json`,
  `tools/generate-lesson-audio.py`, `tools/generate-pack-audio.py` and the
  `preview/` lesson page are deleted, and the `/preview` gate in `server.js`
  went with it — nothing read the manifest once the lesson screen was gone. The
  recordings themselves are still on the repo's **`lesson-audio` branch**
  (never merged, served from `raw.githubusercontent.com`, so they add zero
  weight to Railway builds and home-install updates) and are untouched.
- `tools/generate-phase-audio.py` writes that same manifest path, for days
  31-90 out of `data/phases.json`. It now starts a fresh file when there is
  none, so it still runs — and running it brings
  `data/lesson-audio-manifest.json` back.
- `twa/` — the Android wrapper config (see Android, below).
- Hosted on **Railway**, auto-deploys on push. Domain `www.turnsomedayintodayone.com`.
  The apex domain without `www` serves nothing.

### Two branches, always both
Every commit gets pushed to `claude/app-qc-competitive-analysis-lehsn9` **and**
`claude/vibe-code-uwxxlk`. The second is what Railway deploys.

### Versioning
Four files move together on every user-visible change: `sw.js` (`CACHE_NAME`),
`hub.html` (`APP_VERSION`), `package.json`, `server/package.json`. The service
worker cache name must change or clients keep the old shell. The number was
deliberately reset from 35 to 7 before launch; it is now 5.2 (5.0.0 was a reset from 7.0.3 at the owner's request, 6 Aug 2026 — the number only has to change, never increase).

### Two gates that are easy to confuse
- `isSupporterUI()` — `S.userType === 'partner'`. About the **person**.
- `isSupporterTrack()` — `S.currentAddiction === 'Supporting Someone'`. About the
  **term** shown. Grammar belongs to the track, not the person.

## Android

The `.aab` is a **shell**. It contains no app content — it opens
`https://www.turnsomedayintodayone.com/app?src=play` full screen. Every Railway
deploy updates the Android app instantly, with no rebuild and no review.

Rebuild only for shell-level changes (package name, icon, splash color, target
SDK): `cd twa && bubblewrap build`, after bumping `appVersionCode` in
`twa-manifest.json`.

- Package `com.turnsomedayintodayone.app` — permanent, matches `assetlinks.json`.
- Signing: `twa/android-upload.keystore`, alias `upload`. **This file is the only
  way to ever ship an update to this listing.** Correctly gitignored (a keystore
  in git history is a public keystore), so its absence from the repo is by
  design, not a loss. **Backup verified by Jacques 2026-08-07: it lives on his
  computer and on a USB drive.** Don't re-flag this.
- `?src=play` is how the client knows it is the Play build and must route
  purchases to Google rather than Stripe. Do not remove it from `startUrl`.
- The Play-mode latch is **Android-only** as of 12.0.1. Opening `?src=play` in
  a desktop browser used to latch Play mode into localStorage forever, which
  blocked Stripe checkout from that browser with "In-app purchases are not
  available on this device". `detectPlayBuild()` now refuses to latch on a
  non-Android UA and clears a stale latch on load, so affected browsers
  self-heal. Do not paste the start URL anywhere a person might click it, all
  the same.

## Money

Two payment paths behind one entitlement model. `getBillingStatus()` in
`billing.js` is the single choke point — everything else reads `isPro`.

| Where | Processor |
|---|---|
| Web | Stripe |
| Android | Google Play (Digital Goods + Payment Request) |

Prices must match on both sides: **$9.99/mo, $59.99/yr, $149.99 lifetime**,
7-day trial on both subscriptions. Play product IDs are mapped literally in
`PRODUCT_PLANS` (`store-billing.js`) — an unknown ID is refused, never guessed.

`store-billing.js` is deliberately store-agnostic. Adding Apple means writing
`verifyAppleReceipt` and one line in `VERIFIERS` — no route, schema or
entitlement changes.

### Three things that are load-bearing and non-obvious

1. **Purchases are acknowledged.** Google refunds anything not acknowledged
   within 3 days. This was missing and every Android sale would have silently
   reversed while the customer kept Pro. Requires the *Manage orders and
   subscriptions* permission on the service account.
2. **Every refusal happens before the payment sheet opens.** On a store purchase
   Google takes the money before the server is consulted, so `storeBillingReady`
   and `lifetimeSoldOut` ride on `/api/billing/status` and are checked first.
   Anything that could reject a purchase must be knowable up front.
3. **Founding Lifetime is capped at 50**, counted across Stripe *and* Play in one
   pool (`countLifetimeSold()`). Enforced at checkout and before the sheet.

### Environment variables
| Name | Purpose |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Web payments |
| `PLAY_SERVICE_ACCOUNT_JSON` | Verifies and acknowledges Play purchases |
| `COMP_PRO_EMAILS` | Free Pro for the Play review account and testers |
| `APP_OWNER_EMAIL` | Gates `/admin/stats` |
| `GEMINI_API_KEY` | Friendly and The Key — the only AI provider |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email |
| `SESSION_SECRET`, `DB_PATH`, `APP_URL` | Core |

## Where the Play launch actually is

**Done:** app created, review passed, closed testing live, all declarations,
content rating (Teen), data safety, target audience 18+, store listing with real
screenshots, three products with trials, payments profile, 15% service fee
enrolment, service account wired up.

**Not done — the only real blocker:**
- **12 testers, opted in for 14 continuous days.** Currently 2 (both the owner's
  own accounts). The clock has not started. Production access needs this *and* a
  written account of how testers were recruited and what feedback they gave.
- **No real *Play* purchase has ever been made.** Everything up to Google's
  servers is tested; the last mile is not. After the first test purchase,
  **check three days later that it was not refunded** — that is the only proof
  acknowledgement works. Look for `ACKNOWLEDGE FAILED` in the error log.

  Do not let the Stripe side confuse this. **Stripe is proven and works.**
  Confirmed against the live account (`acct_1TvjcJCDHXSEg3rL`) on 27 Aug 2026:
  two live subscriptions, `app_user_id` 11 and 18, both Jacques's own accounts,
  and one real settled charge — `ch_3U1RLwCDHXSEg3rL0Ju6KvMj`, $9.99, 6 Aug
  2026, Visa debit ...8776, `status: succeeded`, never refunded. Trial started
  30 Jul, converted 6 Aug, cancelled 18 Aug. So checkout, the webhook, and the
  entitlement flip all work end to end on the web path.

  That proves nothing about Play. The two paths do not share code past
  `becomePro()`: the web path posts to `/api/billing/create-checkout-session`
  (`billing.js`), the Play path calls `becomeProViaStore()` →
  `getDigitalGoodsService` (`store-billing.js`). A Stripe purchase cannot even
  be *made* from inside the Play app — `becomePro()` refuses it as the policy
  line. So the fact that Jacques bought Pro with a card means he was in a plain
  browser at the time, not in the installed app. The broken path is still
  untested by that purchase.

Opt-in link (closed test — only works for addresses already on the tester list):

    https://play.google.com/apps/testing/com.turnsomedayintodayone.app

### Play Billing Library 8 — CLOSED. Already updated, no extension.

**Jacques, 26 Aug 2026: "it's already updated, no extension."** The shell is on
a current Google Play Billing Library. Nothing to do here. Do not re-open it.

**The extension was for Android 16 target SDK, not for Billing.** Jacques
requested that one on 17 Aug and it moved 31 Aug → 1 Nov. Earlier versions of
this file attached that extension to Billing 8 and invented an "Oct 31 Billing
deadline" from it. There is no such deadline.

If Play Console still shows a Billing Library tile, treat it as stale console
text. Do NOT tell Jacques it is new, do NOT request an extension, and do NOT
schedule a bubblewrap rebuild for it.

**Still true about the shape of the thing:** the Billing Library lives only
inside the Android shell. The website and the server are unaffected by anything
in this section, and a Play upload is only ever needed for shell-level changes
(icon, package config, target SDK).


## Testing purchases: never use the owner account

`isComped()` in `server/billing.js` grants Pro to `APP_OWNER_EMAIL` — and to
every address in `COMP_PRO_EMAILS` — with no payment. So a Pro badge on
Jacques's own account proves nothing about billing, and on 28 Aug it very
nearly went into the log as "payment system proven end to end". He caught it:
*"i already got all time pro on my owner account."*

**Test on a fresh address that is neither.** If you must use his, read
Profile → the subscription line, which distinguishes the two cases because
`getBillingStatus` resolves `paid` before `comped`:

- `Pro plan — Monthly` / `Yearly` / `Lifetime` → a real `user.plan`, written
  only by the Stripe webhook. The chain worked.
- `Pro plan — Complimentary` → `plan: 'comp'`, no payment involved. Whatever
  you were testing is still untested.

## The Play latch: why it is sessionStorage, and do not "fix" it back

A Trusted Web Activity **is** Chrome, sharing one storage jar with the browser
for this origin. So the old `localStorage` flag written by the Android shell
was read back by every ordinary Chrome tab and every Chrome-installed shortcut
on that phone, permanently — the site believed it was the Play build, routed
Upgrade to Google billing, and `create-checkout-session` refused Stripe by
policy (403 on `X-TSID-Client: play`). Combined with the broken shell, **every
Android owner of the app was unable to pay by any route.** Stripe had created
no checkout session between 30 July and 28 Aug.

The flag now lives in `sessionStorage` (one browsing context), and the legacy
`localStorage` key is deleted wherever found.

**Both directions are covered, and both were tested in headless Chrome on an
Android user agent — rerun these before touching `detectPlayBuild`:**

| Context | `isPlayBuild()` | Why it must be that |
|---|---|---|
| Play app launch (`?src=play`) | `true` | Play policy: never Stripe in the shell |
| Play app after a reload with no query | `true` | sessionStorage carries it |
| Play app returning from a redirect | `true` | same |
| Chrome-installed shortcut / plain tab | `false` | not Play-distributed; Stripe is correct and is revenue |

**Do not add a `display-mode: standalone` test as a backstop.** It looks
tempting and it is wrong: a Chrome-installed shortcut reports `standalone` too
(Jacques's 27 Aug screenshots show exactly that), so it would re-break the very
case this fixed. The honest discriminator once the shell is healthy is
`getDigitalGoodsService()` actually resolving; it cannot be used while the
shell is broken, because it rejects there too.

## Open bug

**The Android app is not running as a verified Trusted Web Activity, and that
is why nobody can buy Pro.** Settled 27 Aug 2026 by the app's own error text.
Read this whole section before changing anything — the cause was correctly
identified weeks ago, then talked out of by me on the same day, then confirmed
again. Do not restart that loop.

### The proof, in Jacques's own screenshot

The failure dialog (app 5.8, which prints the real error) reads:

    failed while opening the store connection.
    OperationError: unsupported context
    bridge=present · playBuild=yes · display=standalone · engine=Chrome 151 · app=5.8

`unsupported context` is not a generic failure. It is Chromium's
`kUnsupportedContext` from `DigitalGoodsFactoryImpl`, surfaced as an
`OperationError`, and it has exactly one meaning: **the document calling
`getDigitalGoodsService()` is not inside a Trusted Web Activity.** The address
bar across the top of that same screenshot says the same thing visually.

### The trap that cost a day — do not fall in it

`bridge=present` does **not** mean the billing bridge works.
`storeBillingAvailable()` only tests `'getDigitalGoodsService' in window`, and
that function exists in ordinary Chrome on Android. It is there, it is
callable, and outside a TWA it rejects. So:

- The purchase sails past the `storeBillingAvailable()` guard and its message
  ("In-app purchases are not available on this device") never appears.
- It dies in the deepest catch instead, which used to print only "Could not
  complete that purchase."
- On 27 Aug I read that message as proof the bridge was working and **wrongly
  retired the Digital Asset Links diagnosis.** It was right. `display=standalone`
  misleads the same way — Chrome reports standalone here even with a visible
  address bar.

The 12:39 screenshots with no address bar were a **separate installed PWA**
(he had just used Chrome's "Install and create shortcut" at 12:38), not the
Play app. A Chrome-installed PWA is also not a TWA, so it fails identically.

### Where the fault is not

- **The served file is correct and reachable.** Google's own validator returns
  both statements cleanly for the host the TWA launches:

      curl "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.turnsomedayintodayone.com&relation=delegate_permission/common.handle_all_urls"

- **The host matches.** `twa/twa-manifest.json` has
  `host: www.turnsomedayintodayone.com`, `startUrl: /app?src=play`, and
  `.well-known/assetlinks.json` declares `com.turnsomedayintodayone.app`.
- **Not the apex.** `turnsomedayintodayone.com` does fail the validator with a
  redirect error, but nothing launches the apex. Ignore it.
- **Not Samsung Internet.** `engine=Chrome 151`.

### Signing is ruled out — do not look there again

Jacques read both SHA-256 values off Play Console → App signing (direct link:
`.../app/4972165923818128065/keymanagement`) on 27 Aug 2026. Both match
`.well-known/assetlinks.json` character for character:

    99:D2:75:… app signing key (classical)   — present in the file
    91:7B:4C:… upload key                     — present in the file

The "Quantum-ready (beta)" badge and the *Previous app signing keys* row dated
28 Jul 2026 look alarming and are a red herring; the classical fingerprint in
use is the one already listed. Ignore the post-quantum column entirely —
Chrome's asset-link check does not use it.

### What is actually still open

**Nothing in this repo proves what the shell in the Play Store contains.**
`twa/twa-manifest.json` was added on 24 Aug 2026 (commit `614864e`) as a
reconstruction. The `.aab` that is live was built on Jacques's PC well before
that, and `git ls-remote` shows **no `twa-build` branch**, so the CI workflow
that would build from this manifest has never produced an artifact. Two
settings that the live shell may therefore lack, either of which alone causes
what we see:

1. **`features.playBilling.enabled`** — the repo manifest has it true. Bubblewrap
   does **not** enable it by default. Without it the Android shell omits the
   Play Billing delegation and `getDigitalGoodsService()` rejects with exactly
   `unsupported context`, even inside a perfectly verified TWA.
2. **`host`** — the repo manifest says `www.turnsomedayintodayone.com`. If the
   live shell declares the **apex** instead, Chrome fetched
   `https://turnsomedayintodayone.com/.well-known/assetlinks.json`, got the
   301 to www, and failed: asset-link fetches do not follow redirects. Google's
   validator returns `ERROR_CODE_REDIRECT` for the apex and full statements for
   www. That would explain the address bar as well.

**Fixed here (27 Aug):** `server.js` now serves `/.well-known/assetlinks.json`
before the apex→www redirect, so both hosts return it with a 200. Verified by
replaying both middlewares in registration order against real `Host` headers —
apex and www both 200 `application/json`, and every other apex path still 301s
to www. This removes cause 2 without a Play upload.

**Cause 1 is also weaker than it looks.** `PLAY-CHECKLIST.md` records that the
live 1.0.1 / code 2 bundle was built on 17 Aug from this very manifest, with
"Play Billing on, notifications on, Android 16, Billing 8". So the live shell
probably does carry the billing feature and the `www` host. Do not order a
rebuild as the first move; it is a real cost to Jacques and may change nothing.

**What app 5.9 adds, and why it is the next step instead.** One thing has never
been established: whether the failing window is the Play shell at all. The
`playBuild` flag latches into `localStorage` and, on Android, is permanent — a
single visit to `/app?src=play` in ordinary Chrome latches it forever, after
which every Upgrade tap routes to Play billing and fails exactly like a broken
shell. Jacques also installed a PWA from Chrome's menu on 27 Aug, which is a
third context that looks like the app and is not.

So the latch now records **how** it was set — `referrer` (an `android-app://`
launch, which is proof the shell opened the page), `param` (a query string,
which proves nothing), or `unknown` (the legacy `'1'`, never upgraded to
`referrer` because that would invent evidence). The diagnostic line adds
`host=`, `launch=` and `latch=`.

**The answer came back at 14:06 on 27 Aug, and it is `launch=shell`:**

    bridge=present · host=www.turnsomedayintodayone.com ·
    launch=shell · latch=referrer@2026-08-27T19:05 ·
    display=standalone · engine=Chrome 151 · app=5.9

`launch=shell` means `document.referrer` was `android-app://com.turnsomedayintodayone.app`
— the Android shell itself opened this page. Not a stale flag, not the PWA, not
a browser tab. `host=` is the exact host the file is served under. And the
address bar is still across the top.

**So this is now established, not inferred: the Play app launches, on the right
host, and Chrome refuses to run it as a verified TWA.** Everything on the
server side checks out, so the fault is in the installed shell or in Chrome's
verification of it — the one component nothing in this repo can inspect.

Historical read of the field, kept because the reasoning still holds:
- `launch=shell` → the Android app really did open this page, the shell is at
  fault, and a rebuild is then justified.
- `launch=param` or `launch=none` with `latch=unknown` → this is not the Play
  app. Nothing about Play billing has been tested yet, and the rebuild would
  have been wasted.

**Still needs Jacques:** rebuild the shell from `twa/twa-manifest.json`, sign it
with the upload key, and upload it. That is the only way to settle cause 1.
Run the `Build the Play app (.aab)` workflow (`workflow_dispatch`), take the
unsigned bundle off the `twa-build` branch, sign, upload, then reinstall on the
phone. Bump `appVersionCode` past whatever is live before building.

Install, use, the 14-day tester clock and reviews all work. Purchases do not.
Do not call this cosmetic.


app, reopen.** That is a 30-second test and it costs nothing.

## Marketing pages (SEO surface)

Static pages served by explicit routes in `server.js`, all listed in
`sitemap.xml` (with `robots.txt` pointing at it) and linked from the homepage
footer so Google can crawl them:

- `/when-he-drinks` — partner landing, the drinking angle. Bio links
  `/go/tiktok|youtube|facebook` redirect here with UTM tags attached.
- `/for-her` — the broader partner page, PDF email gate.
- `/is-my-husband-an-alcoholic` — **added 5 Aug 2026.** Lowest-difficulty term in
  the keyword set. Refuses to diagnose anyone, reframes the question onto her own
  life, and routes to `/quiz` (primary CTA) and `/for-her` (secondary). Same
  voice, layout and crisis-resources block as `/when-he-drinks`.
- `/quiz` — clean URL for `quiz.html` ("The 2-Minute Check-In"), added so videos
  can say the address out loud.
- `/best-recovery-apps` — our own honest roundup, competitors included.
- 16 `*-alternative` pages — one per competitor app.
- `/brainreset`, `/privacy`.

**Rules for anything new here:** no medical claims, no "research shows", no brain
chemicals (see `reference/medical-claims-audit.md`). Crisis resources (988 and
the DV hotline) go *above* any signup button on pages that reach people living
with active drinking. Add the route in `server.js`, the entry in `sitemap.xml`,
and a footer link on `landing.html`.

**Keyword decisions live in `KEYWORDS.md` at the repo root** — it is the only
source of search data now that Semrush is disconnected. Only build for terms
marked "Build"; never for "Skip" or "Too hard", whatever the volume. Don't
re-run keyword research. The marketing agent
(`.claude/agents/recovery-app-marketer.md`) is bound to that rule and will stop
and ask if the file is missing rather than guess.

**Repo audit, 6 Aug 2026 (full sweep, nothing deleted):** no split, duplicate,
partial, or orphaned files anywhere — same-name files across `Studio/` and
`TurnSomeDayIntoOneday/` are two separate apps, never to be merged. All routes,
sitemap entries, and internal links verified against real files. Fixed then:
three `/quiz.html` links normalized to the canonical `/quiz` route
(the app's page, `landing.html` ×2), and two stale references to the renamed
`ai-shorts-scripts.md` now point at `AI-SCENES.md`. `KEYWORDS.md` was found to
have never been committed despite this file and the marketer agent depending on
it — **fixed same day**: built at the repo root from a live Semrush pull
(US, 6 Aug 2026) with every term tagged Build / Too hard / Skip.

**`COMPETITORS.md`** (repo root) is a monthly structural log of accounts serving
the partner angle — hook type, length, format only. It exists to inform
structure, never copy. Nothing there gets reworded into our content.

## How to work with the owner

- **One instruction at a time.** Not a numbered list — one step, wait, next.
- **Exact button labels**, exactly as they appear on screen.
- **Always state prices.** Free or a number, never vague.
- **He writes the marketing copy.** Never invent a tagline, headline or store
  description for him. In-app content he explicitly requests is fine.
- **Verify before asking him to retest.** Asking him to test something that was
  never actually deployed wastes his time, and he will say so.

## Testing

Playwright, headless Chromium at `/opt/pw-browsers/chromium`,
`NODE_PATH=/opt/node22/lib/node_modules`. Server on port 4300 from the
`TurnSomeDayIntoOneday/` directory.

Rate limits bite during test runs: signup is 5/hour/IP, chat 20/5min. Restart
the server between full runs.

Store-billing tests stand in a fake `androidpublisher` and assert on the actual
HTTP calls — that is how acknowledgement is verified without a device.

## 24 Sep 2026 — the two Afrika books go into the herb library (no version bump)

Jacques put two books in the repo and asked for them in the herb part: *"put
them in the herb part dont cre about medical claims organize the herb part more
make it more sufficient and more detailed"*. The two are **African Holistic
Health** (the copy in the repo is Bookey's **summary** of it, not the book) and
an OCR scan of **Nutricide**. Both were read in the same session.

`herbs.html` was 244 herbs, a search box, four tabs and an ask box. It now carries:

- **Eighteen herbs it did not have** — the kitchen seasonings Nutricide names
  that were missing (allspice, chervil, dill, marjoram, paprika, savory,
  vanilla), and the ones African Holistic Health names in its classifications
  and its remedy table (wheatgrass, grape seed, pine bark, chaparral, buchu,
  wild violet, spikenard root, blue cohosh, black haw, centaury, gymnema). Each
  has a new **`bk`** field — *From the books* — with the book's own line for it.
- **A new tab, From the books**, sixteen sections: how the books say to prepare a
  herb; the multi-vitamin method and the herbs in it; the seasoning amounts
  (Nutricide p339); which seasoning goes on which food; what each seasoning is
  for (p341); the blood cleansers (p342); the immune builders (p342-343); the
  book's short shelves for skin, yeast, sleep and digestive enzymes; the
  nutritional approach; **the twenty classes of herb**; the herbs-for-dis-eases
  table; the vitamin and mineral guides; the doctrine of signatures; the diet it
  argues for; and a section naming which book every part came from.
- **Three new shelves** under By need: blood cleansers, building the defences,
  kitchen seasonings.
- The tabs, the cards and the click handling are unchanged — a book section
  opens and shuts through the same `data-h` toggle a herb card uses.

**The books' own amounts are printed as the book's, and labelled as the book's**
in the tab before the reader reaches them. That is the whole of what makes
printing them honest, and a test holds it. Three things the books name are marked
rather than handed over, on the page and on their own entries: **blue cohosh**
(harmed babies), **lobelia** (measured in drops; has killed people who guessed)
and **chaparral** (liver damage; an FDA warning in the 1990s). The safety tab is
untouched, and the twenty classes carry the line that a class says what a plant
is for, not that it is safe.

Also: **the app's page no longer prints "244 herbs"** — a count that is wrong is
worse than no count — and the row says *herbs, seasonings and cleansers* instead.

**No version bump.** `sw.js:136` hands `/herbs` and `/herbs.html` straight to
the network, so that page is never served from the cache and nothing has to be
invalidated for it. Version stays 5.1.

**How it was changed:** `tools/apply-herbs-books.js` — re-runnable, one anchor per
edit, refuses to write unless every anchor appears exactly once, and checks what
landed afterwards.

**Tests:** `server/test/herbs-books.test.js`, 7 new — the eighteen named herbs
and their `bk` lines; no herb pointing at a shelf that does not exist (the way a
hand-typed list goes silently missing); no empty shelf; the tab rendering with
the book material in it; the figures staying labelled as the book's; search
reaching a herb by its book words; and no count printed in the app's page.
`npm test` 474 pass / 0 fail.

**Not verified:** there is no browser in this environment, so the tab was run
through the same stub DOM the other page tests use — the wiring and the markup,
not the pixels, and not on a phone.

## 24 Sep 2026 — the claims go in, and everything held back goes back (`tools/apply-herbs-books2.js`)

His words after the first pass: *"put medical claims in and whatever you left off"*.

**The page stopped saying it does not claim anything.** The line under the title,
the note at the top of the inline script, the field legend, the label on every
herb card (`What people have used it for` → `What it does`), the safety tab's
own box and the ask box's instructions all now state what a plant does. The old
box said *"Nothing here says it works"*; it now says the claims are made here.

**Every refusal came off the entries.** Gone: `this page will not hand you`,
`this page will not hand over`, `Its place here is history, not a
recommendation`, `this page will not send you to a root for it`, `It is not
recommended`, `Do not make this at home`, `Do not make tea from it`. Affected:
goldenseal, oregano oil, coltsfoot, pleurisy root, uva ursi, lobelia, pennyroyal,
periwinkle, wormwood, chaparral, blue cohosh. **The facts stayed** — a plant that
has killed people still says so, in the plant's own entry. The tab's hedges went
the same way, and the **beef row went back into the seasoning list**.

**What was left off went in**, eight new sections: the book's dis-ease chart (21
conditions and what it gives for each), its easy remedies, the food chapter (food
combining, white sugar as a drug, the microwave), the **food as medicine chart**
from Nutricide p337-338, how the book reads the body before treating it, colours
and the organ clock, the history chapter, and the book's own quotable lines.
**Four more herbs**: castor, henna, tormentil, stone seed. Zinc and selenium
added to the minerals.

**Still in, on purpose:** an infection, withdrawal (988), a new and sudden
headache, a chest that hurts to breathe, and anything on a prescription — the
`ASK_SYS` bullet list is untouched. Those are not claims, they are the
difference between a page and a person being hurt, and the ask box is built to
say them. He has not asked for those out; if he does, that is the one list to
change.

**Not added, deliberately:** the race-and-history polemic in the middle of
Nutricide (the `White Folks Thinking` chapter and the grease-and-candles
passage). It is not herb content and it is not health content; the herb part is
what he asked for. Said so to him rather than doing it quietly.

**Tests:** `server/test/herbs-books.test.js` updated — the refusals are now
asserted **absent**, the claim language asserted present, and the new sections
covered. `npm test` 476 pass / 0 fail. No version bump (the same reason as
above: /herbs never comes from the cache).

## 24 Sep 2026 — the trading goes, every last piece of it (5.2)

Jacques: "now remove the trading game the desk everything about trading im done."

**Deleted, not hidden:** `desk.html`, `desk-assistant.js`,
`market-maker.html`, `trading-school.html`, `tradingview/` (both .pine
scripts), `vendor/lightweight-charts/` (the charting library only the desk
loaded) and `server/market-data.js` (the candle feed). Their six test files
went with them: `desk`, `market-maker`, `trading-school`, `market-data`,
`tradingview-pine` and `chart-picture`. Twenty-two builder scripts under
`tools/` went too - the desk, market and school patchers and their block files
- because they could only ever build pages that no longer exist.

**Also deleted, at the repo root:** `tools/market-maker/` - the original
Market Maker Warfare: `mmw.html`, its manual PDF and its README. It was never
part of the shipped app, but it is trading, so it went with the rest. Git
history still has it, as it has everything else deleted here.

**Out of the server:** the routes `/market-maker.html`, `/school`,
`/school.html`, `/desk`, `/desk.html`, `/someday-strategy.pine`,
`/someday-frames.pine` and the candle feed `/api/candles`, all from
`server.js`; the market-maker, school and desk entries from `OPEN_PAGES` in
`server/private-app.js`; the three never-cache lines from `sw.js`; and the
chart-picture half of `server/ai-chat-body.js`.

That picture matters more than the rest of the deletion. It was the only image
on any route in this app and the desk was the only thing that could attach one,
so **no route accepts an image anywhere now**. The rule it was built to keep -
a picture is never silently dropped - has nothing left to apply to.
`server/test/ai-body.test.js` replaces `chart-picture.test.js` and asserts the
image path is gone as well as that the thinking knob still matches the model
generation.

**Out of the app:** the three Settings rows (Trading Game, Trading School,
Trading Desk) in the app's page, and the sentence in the in-app policy and in
`privacy.html` that named the trading questions and chart screenshots. Both
policies now say only the message is sent. That is the half a policy must not get
wrong, and there is a test for it. The desk's assistant prompt (`DESK_SYS`) is
gone with the page - four AI prompts are left: Friendly, The Key, and the herb
and tax ask boxes.

**Kept, and why:** the **Tax Centre stays**. It is a tax reference - 2026
figures, mileage, set-aside, records - and the only "trading" in it is one
deduction line about a first year of business. Not a trading page, so it was left
alone and he was told so. **The herb library stays** untouched.

**Version 5.2.** The four files moved together. Unlike /herbs, the app shell is
what changed here - the Settings rows and the in-app policy live in
the app's page, which is cached - so the bump was required, or phones would keep
the old shell with rows pointing at pages that are gone.

**Tests:** 285 pass / 0 fail across 33 files. It was 476 before: the trading
tests are the difference, not tests going quiet. The 476 written into the herb
entry above was the total before this removal.

**Not verified in a browser.** There is no browser in this environment. The
checks are the suite above and `node --check` on the server; nothing was opened
on a phone.

**The range is not a full range, and P90X owns only the format — 27 Oct 2026.**
Jacques: "in the by 10 method you dont do full range of motions you keep the
intensity throughout the movement and take out those p90x moves those are plain
exercises p90 didn't make up those exercises by 10 just uses p90 format
structure".

Two corrections, both in `certify.html`, and both were half-wrong before:

- **The range is now stated as a rule.** Day 3 said each move "is not taken to
  full extension" and the technique day (13) called the three-quarters "a range
  decision", but neither named it plainly. Both now open with **"no move is
  taken through its full range of motion"**, say why (a full rep hands the
  muscle a rest at both ends) and say what it buys: **the intensity stays on the
  muscle through the whole of the movement**, so the set is hard from the first
  inch to the last without adding weight or reps. The trainer's introduction,
  the track's own prospectus and the "what the by-10 is" list carry it too, so a
  reader meets it before day 3.
- **The movements are no longer credited to P90X.** The track had said in a
  dozen places that the exercises were P90X's - "the movements are P90X's",
  "P90X's own menu", "P90X, which supplies the exercises", "the movement content
  is P90X's", and a quiz whose right answer was "the movements are P90X's". None
  of them was true: a squat, a press, a row and a curl are plain movements and
  P90X did not invent them. What the by-10 borrows is the **format** - the
  rotation the Trainer page holds, its day names, its week - and that is all the
  page now credits it with. The day 3 quiz was rewritten with it (the right
  answer now runs "the sets, the twenty-rep cap, the ten seconds and the short
  range; the moves are plain").

`server/test/certify.test.js` was extended rather than relaxed: the test is now
"the by-10 as a rule and P90X as the format only", it requires the full-range
sentence and the "intensity ... through the whole of the movement" line, and it
fails if any of the eight P90X-owns-the-movements phrasings comes back. All 27
tests in that file pass; the wider suite was not run here (no `node_modules` in
the workspace).


**The thirty seconds between exercises — 29 Oct 2026.** Jacques: "Another rule to
the by 10 is 30 seconds rest moving to a new exercise". The by-10 had one rest;
it has two now. **Ten seconds between the sets of one movement**, unchanged, and
**thirty seconds when the list moves on to a new exercise** — the dumbbell
swapped, the station set up, the breath back, which the set's ten never counted.
The thirty is a second rest rather than a longer first one, and both are stated
that way wherever the rule is taught: `certify.html` day 3 (a new paragraph on
why the change of movement gets its own rest, and its quiz question folded into
one that answers both numbers), day 8 (energy systems), day 34 (the rule in
full), day 36 (the rest timer lesson) and day 37 (the full-body walk-through),
plus the page header and the Trainer card's note. On `trainer.html` the rotation
card says ten between sets and thirty before the next exercise, and the rest
countdown — which only ever started after an exercise was logged, i.e. on a
change of exercise — now runs thirty seconds and says "30-second rest".
`server/test/certify.test.js` requires the rule; `server/test/trainer.test.js`
drives the timer at thirty. The first full run was **505 tests, 504 pass, 1
fail** — the new fourth quiz question broke the three-questions-a-lesson rule —
and after folding both numbers into one question it is **505 pass, 0 fail**.

No version bump. `/certify` and `/trainer` are gated routes outside the shell,
the fetch handler is network-first for pages, and `hub.html` did not change.
`tools/apply-version-bump.js` refuses anyway: `package.json` and
`server/package.json` sit at 2.0 while `sw.js` and `hub.html` are at 3.9 —
pre-existing drift, left alone rather than papered over here.


**The twenty-rep cap belongs to the dumbbells — 29 Oct 2026.** Jacques: "The rule
dont do not recreate than 20 reps only applies to dumbells and straps bodyweight
exercises can do as many as you can fix". The cap had been stated as a limit on
every set. It is a limit on **loaded** sets only — a dumbbell or a strap — and a
bodyweight move has no ceiling at all: it runs to as many good reps as the person
has, and the set ends when the reps stop being good. Corrected in `certify.html`
wherever the cap was stated: the page header, day 3 (the gist, the paragraph on
when a set ends, and the quiz whose right answer names the cap), day 8's systems
summary, day 31's two-limits lesson and its quiz, the FITT-VP day's intensity line
and quiz, day 34 (the rule in full, the rest-and-cap paragraph and "what caps a
set", now "what caps a set of dumbbell or strap work"), day 35, and the "going
deeper" notes that repeat the rule. `trainer.html`'s rotation card says the same:
twenty at most on a dumbbell or a strap, and a bodyweight move to as many good
reps as they have. Nothing about the sets, the rests or the short range moved. The
full suite is **505 tests, 505 pass, 0 fail**.
