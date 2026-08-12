# Reddit without ads — and what the blog has to do with it

*Written 12 Aug 2026. You asked: "what about the blog, will that help Reddit."*

**Short answer: yes, and it is the only thing that will.**

Not because a blog gets you onto Reddit. Because a blog is what makes you
*allowed* on Reddit.

---

## The problem, stated plainly

You said no Reddit ads. Fine — that closes the paid door. The free door has a
lock on it too:

**r/stopdrinking prohibits self-promotion and is heavily moderated.** So do
most of the recovery subs. Post `turnsomedayintodayone.com` in a comment and
one of three things happens:

1. A mod removes it within the hour.
2. Automod removes it before a human sees it.
3. Nobody removes it, and eleven people tell you to get lost, which is worse —
   because that thread now ranks in Google with your app name next to the word
   "spam".

That is not a Reddit problem. That is what happens to **any** link that is
obviously a front door to a paid product. And it happens no matter how good
the product is or how real your 38 years are.

## What actually gets through

A link that answers the question **without needing the click.**

You already own about twenty of them:

`hangxiety.html` · `is-my-husband-an-alcoholic.html` · `how-to-stop-drinking.html`
`how-to-stop-binge-eating.html` · `partner-drinks.html` · `when-he-drinks.html`
`betrayal-trauma-recovery.html` · `partner-watches-porn.html` ·
`do-i-have-a-binge-eating-problem-quiz.html` · `brainreset.html` · `reset.html`
· plus the eleven `*-alternative.html` pages

**That is the blog. It already exists.** You have been thinking of it as SEO.
It is also the only Reddit-safe currency you have.

The difference between a link that survives and one that gets pulled is not the
domain. It is whether a moderator opening it finds **the answer at the top** or
**a signup**. Yours have the answer at the top. That is why they work.

## The chain, in order

```
reddit-watch.js  →  a question with 90 comments and no good answer
        ↓
that question becomes a page on your site (or you already have it)
        ↓
you answer the question IN the Reddit thread, in full, in the comment
        ↓
the page link goes at the end, as "I wrote this out longer here" — or not at all
        ↓
Google indexes both the thread and your page, and they hold each other up
```

**Step three is the one people skip and it is the whole thing.** The comment has
to be worth reading with the link deleted. If someone could remove your URL and
the comment is still the best reply in the thread, you are safe forever. If
removing the URL leaves nothing, you are an ad.

## Why this is worth more than it looks

**Google now surfaces Reddit threads at the top for almost every long-tail
recovery question.** "does hangxiety go away", "is my partner an alcoholic or am
I overreacting", "how long until the mornings stop" — the thing ranking first is
usually a Reddit thread, not a treatment center.

So there are two ways to own that search:
- Rank your own page above the thread. Slow, and you are outgunned.
- **Be the top comment inside the thread that already ranks.** Free, fast, and
  it puts you above every rehab in the country on that phrase.

The second one is available today.

## The rules, so you don't get burned

1. **Read each sub's sidebar rules before you post in it.** They differ and they
   are enforced. Some ban all links; some allow them from established accounts;
   some require you to disclose you built the thing.
2. **Disclose it.** "I built a free one, so take this with that in mind" costs
   you nothing and is the difference between a mod removing you and a mod
   leaving you alone. People on those subs have excellent radar and lying to
   them is both wrong and useless.
3. **Age the account.** A one-week-old account dropping links is removed on
   sight. Comment for two weeks with no links at all first. That is not a trick,
   it is the entry fee.
4. **Ten comments with no link for every one with a link.** At minimum.
5. **Never post the same page twice in a week.** That is the pattern automod
   looks for.
6. **Do not argue with a removal.** Ever. Move on.

## Where to be

From `reddit-watch.js`, and these are the four it defaults to:

`r/stopdrinking` · `r/AlAnon` · `r/loveafteraddiction` · `r/SupportforWaywardSpouses`

**r/AlAnon and r/loveafteraddiction are the ones to work first.** Not
r/stopdrinking. Two reasons:

- They are the partner audience, and **you are the only app with a section
  built for them.** You have something to say there that nobody else can say.
- They are smaller and less hammered by marketers, so the moderation is less
  twitchy and a good comment is more visible.

r/stopdrinking is the biggest and the most defended. Earn the account
elsewhere first.

## What is missing before this works

**One thing: the twenty pages have no hub.** They are twenty separate URLs with
no index tying them together. That costs you two ways — Google has no page
telling it these belong to one body of work, and a person who reads the
hangxiety page has nowhere to go next.

A single `/blog` or `/read` page listing all twenty by the question each one
answers fixes both. It is an afternoon of work on the site, not the app, so it
does not touch the Play Store freeze.

**Your call, not mine.** Say the word and I'll build it.

---

## Get the scraper running

`reddit-watch.js` still needs two codes from you, once:

1. https://www.reddit.com/prefs/apps → **create another app…**
2. Type: **script**. Redirect uri: `http://localhost:8080`
3. The **ID** is the short string under the app name. The **secret** is labeled.
4. Then: `node redditwatch.js YOUR_ID YOUR_SECRET`

It writes `reddit-report.md` — every question sorted by **comment count, not
upvotes**, because a question with ninety replies is one nobody has answered
well, and that is a page you have not written yet.
