#!/usr/bin/env python3
"""Build the three search pages that had a video and no home.

Each of these is a question people type at 2am and a video Jacques already
made. The page is the thing Google can rank; the video is what keeps somebody
on it. Same shell as the other landing pages so nothing looks bolted on.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHELL = (ROOT / 'tools' / '_page_shell.txt').read_text()

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://www.turnsomedayintodayone.com/{slug}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Turn Someday Into Day One">
<meta property="og:url" content="https://www.turnsomedayintodayone.com/{slug}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://www.turnsomedayintodayone.com/og/og-partner.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="https://www.turnsomedayintodayone.com/og/og-partner.jpg">
<meta name="theme-color" content="#0f0c29">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<link rel="icon" href="icons/icon-192.png">
{shell}
</head>
<body>
<div class="wrap">
  <div class="brand">Turn Someday Into Day One</div>

  <section class="hero">
    <div class="eyebrow">{eyebrow}</div>
    <h1>{h1}</h1>
    <p class="sub">{sub}</p>
    <a class="btn" href="/quiz">Take the private 2-minute check-in</a>
    <a class="btn-link" href="#help">Skip to what helps &rarr;</a>
    <div class="trust">Free, no signup, nobody sees your answers.</div>
  </section>

{body}
  <section class="crisis">
    <h2>If you need someone now</h2>
    <p>In the US, call or text <a href="tel:988">988</a> &mdash; free, confidential, 24/7.
    {crisis_extra}</p>
  </section>

  <section class="partner">
    <h2>What this app actually is</h2>
    <p>Free. No card, no ads, and it works with no account and no name &mdash; nothing you write leaves your phone. A day counter that doesn't shame a slip, tools for the worst ten minutes, and a 90-day program written in plain language by somebody who was addicted for 38 years and got free at 50.</p>
    <p>There's a whole side built for the person who loves you, too. Almost nothing else has that.</p>
    <a class="btn" href="/app">Open the free app</a>
    <p class="italic">Or read <a href="/reviews">what people who use it say</a>.</p>
  </section>

  <div class="foot">Turn Someday Into Day One &middot; St. Louis, MO</div>
</div>
</body>
</html>
"""


def sec(h2, paras, lead_idx=None, bullets=None, anchor=None):
    a = f' id="{anchor}"' if anchor else ''
    out = [f'  <section class="partner"{a}>', f'    <h2>{h2}</h2>']
    for i, p in enumerate(paras):
        cls = ' class="lead"' if i == lead_idx else ''
        out.append(f'    <p{cls}>{p}</p>')
    if bullets:
        out.append('    <ul>')
        out += [f'      <li>{b}</li>' for b in bullets]
        out.append('    </ul>')
    out.append('  </section>\n')
    return '\n'.join(out)


PAGES = {}

# ---------------------------------------------------------------- withdrawal
PAGES['alcohol-withdrawal-timeline'] = dict(
    title='Alcohol Withdrawal Timeline: Hour by Hour, and When It Is Dangerous',
    desc='What actually happens in the hours and days after your last drink, hour by hour '
         '- and the specific signs that mean you need a doctor, not a plan.',
    eyebrow='Alcohol withdrawal',
    h1='What happens after the last drink, hour by hour.',
    sub='You want to know how bad it gets and when it stops. Here it is straight, '
        'including the part most articles bury: for some people this is genuinely '
        'dangerous, and stopping alone is the wrong call.',
    crisis_extra='If you are shaking badly, seeing or hearing things that are not there, '
                 'confused about where you are, or you have ever had a withdrawal seizure, '
                 'call <a href="tel:911">911</a> or get to an emergency room. That is not '
                 'an overreaction.',
    body=(
        sec('Read this part first',
            ['Most people come off alcohol uncomfortable and fine. A smaller group does not, '
             'and alcohol is one of the few drugs where withdrawal itself can kill you. That '
             'is not a scare line to keep you drinking &mdash; it is the reason to have a '
             'doctor involved rather than white-knuckling it in a spare room.',
             'Talk to a doctor before you stop if any of these are true:'],
            lead_idx=1,
            bullets=['You drink daily, or nearly daily, and have for months',
                     'You have ever had a seizure, from withdrawal or otherwise',
                     'You have shaken, sweated or vomited on a previous attempt to stop',
                     'You drink first thing in the morning to steady yourself',
                     'You have a heart condition, liver disease, or you are pregnant',
                     'You will be completely alone for the first three days'],
            anchor='safety'),
        sec('6 to 12 hours: the shakes start',
            ['The first thing most people notice is their hands. Then sweating, a headache '
             'that paracetamol does not touch, a stomach that will not settle, and a jumpy, '
             'wired feeling like too much coffee on no sleep.',
             'Sleep goes early and goes badly. Anxiety usually arrives before anything '
             'physical does &mdash; a lot of people describe the first night as dread with '
             'no subject.']),
        sec('12 to 24 hours: it gets louder',
            ['Everything above, turned up. Heart going faster, blood pressure up, light and '
             'sound feeling too sharp. Some people get brief hallucinations at this stage '
             'and stay fully aware that they are not real, which is unsettling but is not '
             'the same thing as delirium tremens.',
             'This is the window where withdrawal seizures are most likely in people who '
             'have been drinking heavily for a long time. It is the single strongest reason '
             'not to do the first day alone.']),
        sec('24 to 72 hours: the peak',
            ['Hour 24 to hour 48 is the worst of it for most people. That is worth knowing '
             'in advance, because at hour 30 it genuinely feels like it is going to keep '
             'getting worse forever, and it is not.',
             'Delirium tremens &mdash; severe confusion, a racing heart, heavy sweating, '
             'hallucinations you believe are real &mdash; usually shows up in this window if '
             'it shows up at all. It is uncommon, and it is a medical emergency every time. '
             'Do not wait it out.'],
            lead_idx=1),
        sec('Days 4 to 7: the fog',
            ['The physical storm eases and something flatter takes its place. Tiredness that '
             'sleep does not fix, no appetite or too much of one, and a mood that swings for '
             'no reason you can point at.',
             'Most people expect to feel better by now and do not, then decide they have '
             'failed. You have not. This stretch is normal and it is temporary.']),
        sec('Weeks 2 to 8: the part nobody warns you about',
            ['Sleep stays broken for a while. Cravings arrive out of nowhere, often attached '
             'to a time of day rather than a feeling &mdash; six o\'clock, the drive home, '
             'the first quiet moment after the kids are down.',
             'This is where most people go back, and almost never because of the shaking. '
             'They go back because the days got long and nothing filled the hole the drink '
             'was filling. That is a completely different problem from withdrawal, and it '
             'needs a completely different answer.'],
            lead_idx=2, anchor='help'),
        sec('What actually helps',
            ['A doctor first, if any line in the list at the top applies to you. Then:'],
            bullets=['Water and food, even when you do not want either. Small and often beats '
                     'nothing.',
                     'Somebody who knows what you are doing and will pick up the phone at 3am.',
                     'Something to do with the specific hour you would have been drinking. '
                     'Not the whole evening &mdash; that one hour.',
                     'A day counter you can look at, because on day five the only evidence '
                     'you are getting anywhere is the number.',
                     'A plan for the ten minutes when it peaks, decided in advance while you '
                     'are calm rather than invented while you are not.']),
    ),
)

# -------------------------------------------------------------------- vaping
PAGES['quit-vaping'] = dict(
    title='What Vaping Is Actually Doing To You (And How To Stop)',
    desc='No scare stories and no "it is basically water" either. What nicotine vaping does, '
         'what is still unknown, why quitting is harder than cigarettes, and what works.',
    eyebrow='Vaping',
    h1='Somebody told you it is harmless. Somebody else said it will kill you by Thursday.',
    sub='Both are selling something. Here is the honest middle: what is actually known, '
        'what is not, and why the thing in your pocket is harder to put down than a pack '
        'of cigarettes ever was.',
    crisis_extra='',
    body=(
        sec('The honest summary',
            ['Vaping is very probably less harmful than smoking. That is the strongest claim '
             'anyone can make for it, and it is a comparison, not a clean bill of health. '
             '"Better than the worst thing" is not the same as "fine".',
             'The bigger problem for most people is not the vapour. It is the dose.'],
            lead_idx=1),
        sec('Why it hooks harder than cigarettes',
            ['A cigarette ends. It burns down, you put it out, and there is a natural stop '
             'built into it. A vape has no end. You can hold it all day, and most people do.',
             'That changes the whole shape of the habit. A pack-a-day smoker had twenty '
             'moments. A vaper has hundreds &mdash; a pull at every red light, every awkward '
             'pause, every time a thought gets uncomfortable. Nicotine stops being a habit '
             'with a time and becomes the thing you do instead of feeling anything.',
             'It is also invisible and nearly odourless, which means nothing in your life '
             'ever pushes back. Nobody makes you stand outside. Nobody says anything. Days '
             'go by with no friction at all, and friction is most of what makes people quit.'],
            lead_idx=2),
        sec('What is known, and what is not',
            ['Known: nicotine is strongly addictive, it raises heart rate and blood pressure, '
             'and it affects the developing brain &mdash; which is why the teenage numbers '
             'worry people who study this for a living.',
             'Known: the vapour is not water. It carries nicotine, flavouring compounds and '
             'fine particles into your lungs several hundred times a day.',
             'Not known: what twenty years of that does. These devices have not existed long '
             'enough for anyone to tell you honestly, and anybody who says otherwise in '
             'either direction is guessing.',
             'You are allowed to decide that unknown is not a bet you want to keep making.']),
        sec('Why quitting feels worse than you expected',
            ['Because you are not just removing nicotine. You are removing the thing you have '
             'been using to get through every small unpleasant moment for years, and you are '
             'removing it from all of those moments at once.',
             'The first three days are chemical &mdash; irritable, foggy, restless, sleeping '
             'badly. That part ends. What comes after is the real work: several hundred '
             'moments a day that used to have an answer and now do not.'],
            lead_idx=1),
        sec('What actually helps',
            ['Stop trying to quit the vape. Quit the moments, one at a time.'],
            bullets=['Find the three you reach for hardest &mdash; the car, the break, the '
                     'first minute after work &mdash; and give those three something else '
                     'first. Leave the rest alone for now.',
                     'Put it somewhere with friction. A drawer, a bag, another room. Not your '
                     'pocket. Most pulls are not cravings, they are proximity.',
                     'Count days somewhere you can see the number. Vaping leaves no evidence '
                     'behind &mdash; no ashtray, no smell, no empty packs &mdash; so quitting '
                     'leaves no evidence either unless you make some.',
                     'Nicotine replacement is not cheating and neither is tapering. The '
                     'measure is whether you are still holding it in six months.',
                     'Tell one person. Zero friction is the whole reason this one runs for '
                     'years, and one person who knows is friction.'],
            anchor='help'),
    ),
)

# --------------------------------------------------------------------- porn
PAGES['how-to-stop-watching-porn'] = dict(
    title='How to Stop Watching Porn: What Actually Works',
    desc='No shame, no religion, no blocker that you will uninstall by Tuesday. Why the '
         'promise keeps breaking, what the gap between meaning it and doing it again is, '
         'and what actually changes it.',
    eyebrow='Stopping',
    h1='You meant it last time. You have meant it a lot of times.',
    sub='The gap between promising yourself completely and doing it again days later is '
        'the part that grinds people down &mdash; not the habit itself. This is about '
        'closing that gap, without shame and without a lecture.',
    crisis_extra='',
    body=(
        sec('Why the promise keeps breaking',
            ['You are not weak and you are not broken. You made the promise in one state and '
             'you break it in a completely different one, and the version of you who made it '
             'is not in the room when it counts.',
             'At 11pm, tired, bored, alone, a bit low &mdash; that person has never agreed to '
             'anything. Every plan that depends on him deciding well in the moment is going '
             'to fail, and it will keep failing no matter how much you meant it.',
             'So stop making plans that need willpower at 11pm. Make plans that mean 11pm '
             'never gets to ask.'],
            lead_idx=2),
        sec('The thing shame is doing to you',
            ['The cycle almost everybody describes is the same shape: do it, feel disgusting, '
             'promise it is the last time, hold for a while, feel bad about something '
             'unrelated, and reach for the thing that reliably makes feeling bad stop for '
             'twenty minutes.',
             'Read that again. The shame is not the brake. The shame is the fuel. It is the '
             'unpleasant feeling that the habit exists to switch off, and every round of it '
             'loads the next one.',
             'Which is why "hate yourself harder" has never worked for anybody, and why the '
             'first real move is boring: stop making it mean something about who you are. '
             'It is a habit with a trigger and a payoff. Habits can be dismantled. Character '
             'defects cannot.'],
            lead_idx=1),
        sec('What it is actually replacing',
            ['For most people it is not desire. Ask honestly what the twenty minutes before '
             'looked like and it is usually one of four things: bored, lonely, wired and '
             'unable to sleep, or avoiding something you do not want to do.',
             'That is useful, because those are four different problems with four different '
             'answers, and none of the answers is "try harder not to".']),
        sec('What actually works',
            ['In rough order of how much difference it makes:'],
            bullets=['<strong>Change the environment, not the intention.</strong> Phone '
                     'charges in another room. Not tonight &mdash; every night, until it is '
                     'just where the charger lives.',
                     '<strong>Name your window.</strong> Nearly everyone has one: a time of '
                     'day and a set of conditions. Find yours and put something in it that '
                     'was already going to happen anyway.',
                     '<strong>Blockers help and they are not the plan.</strong> They buy you '
                     'ninety seconds. Ninety seconds is often enough. But a blocker with no '
                     'plan behind it gets uninstalled, and you know that.',
                     '<strong>Count the days where you can see them.</strong> This habit '
                     'leaves no trace, so progress is invisible unless you make it visible.',
                     '<strong>Do not restart the count at zero in your head.</strong> A slip '
                     'on day forty does not undo forty days. Treating it like it does is what '
                     'turns one night into three weeks.',
                     '<strong>Tell one person.</strong> This is the hardest one and the one '
                     'that moves it most. Secrecy is not a side effect of the habit, it is a '
                     'load-bearing wall.'],
            anchor='help'),
        sec('If it is hurting somebody else too',
            ['If a partner has found out, both of you are in it now, and the two of you need '
             'different things &mdash; you need a way to stop, and they need somewhere to put '
             'what this did to them.',
             'There is a page for their side of it: <a href="/partner-watches-porn" '
             'style="color:var(--green);font-weight:600;text-decoration:none">my partner is '
             'addicted to porn &mdash; what now?</a> The app has a whole section built for '
             'them as well, which is the part almost nothing else does.']),
    ),
)


def main():
    for slug, p in PAGES.items():
        html = TEMPLATE.format(slug=slug, shell=SHELL, **p)
        (ROOT / f'{slug}.html').write_text(html)
        print(f'  wrote {slug}.html  ({len(html):,} bytes)')


if __name__ == '__main__':
    main()
