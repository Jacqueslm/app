# Why iPhone can't install and your Android can

*You asked, 12 Aug 2026. Checked against your actual code, not from memory.*

> **4 Oct 2026 — what changed since.** The recovery app is deleted, and with it
every place the old page mentioned "Add to Home Screen". The install offer that
shipped in the end lives on the Zodiacs page (`/key`, the `rp-install` button and
the note it opens), and on Android the browser's own offer is still caught with
`beforeinstallprompt`. The reasoning below is unchanged; the two line references
are into a file that no longer exists.

**Short answer: Apple blocks it, and there is no code you can write to fix it.
But there is a lot you can do about it, and right now you are doing none of it.**

---

## Why your Android installs

Your `manifest.json` is a valid, complete PWA manifest:

```
"display": "standalone"      → runs without browser chrome
"start_url": "/app"          → opens straight into the app
"scope": "/"
icons: 192 and 512, any + maskable
```

…and `sw.js` is registered. **That combination is exactly what Chrome on Android
requires**, so Chrome offers "Install app" in its own menu with no code from you.
That is why it works on your phone.

## Why iPhone doesn't

Three separate Apple decisions stack up:

**1. Every browser on iPhone is Safari.** Chrome, Firefox, Edge and Brave on iOS
are all skins over Apple's WebKit engine. They cannot add capabilities Safari
doesn't have. (Apple technically opened this up for the EU in iOS 18.2, but the
process is so hostile that **no browser has taken it up as of 2026.**)

**2. Chrome and Edge on iPhone cannot install a PWA at all.** Not "it's
harder" — the option does not exist. Only Safari can do it.

**3. Apple has never implemented `beforeinstallprompt`.** That is the browser
event that lets a website show its own "Install" button. Chrome on Android fires
it. Safari does not, on any device, and there is an open request to Apple asking
for it that has gone nowhere.

**So: no website on Earth can put a working install button in front of an
iPhone user.** Not you, not Instagram, not Google. Every iPhone install is the
user manually doing:

> **Share button (the box with the arrow) → scroll down → Add to Home Screen**

## Why this actually matters commercially

**Every iPhone install is manual, so the instructions ARE the conversion
surface.** On Android the browser does the selling. On iPhone, you do — or
nobody does.

And right now nobody does. **Your site has no install prompt code at all** — no
`beforeinstallprompt` handler for Android, and no iPhone instructions anywhere a
new visitor would see them. The only two places "Add to Home Screen" appears are:

- buried inside notification settings (the recovery app's page, deleted 4 Oct
  2026; line 8061 of the committed copy)
- buried inside discretion mode (same file, line 9065)

Both are things you only reach **after** you're already using the app. A first
time iPhone visitor is told nothing.

**iPhone is roughly half the US phone market**, and it skews toward exactly the
audience `TARGET-MARKET.md` says is your biggest — the partner. So the half of
your market you serve worst is disproportionately the half you built the
unique thing for.

## Two other iPhone limits worth knowing before someone asks

- **Notifications only work if the app is on the Home Screen.** In a normal
  Safari tab an iPhone gets nothing. Your app already says this in settings, and
  it is correct. It is also another reason the Add to Home Screen step matters —
  without it the daily reminder simply does not exist for iPhone users.
- **iOS clears the storage of web apps not opened for a while.** Not usually a
  problem for a daily-use app, but it is why an account matters for anyone who
  drifts away and comes back.

---

## What I would build, if you want it

Small, self-contained, and it does not change how the app behaves — it only
tells people what to tap.

1. **iPhone Safari, not yet installed** → a dismissible strip at the bottom:
   *"Put this on your home screen — tap Share, then Add to Home Screen"*, with
   the actual Share icon drawn so people recognise it. Shows once, remembers
   the dismissal.
2. **iPhone but in Chrome/Firefox** → different message, because Add to Home
   Screen genuinely is not there: *"Open this page in Safari to keep it on your
   home screen."*
3. **Android** → catch `beforeinstallprompt` and put a real **Install** button
   in the app, instead of relying on people finding Chrome's ⋮ menu.
4. **Already installed** → show nothing, ever. (`display-mode: standalone`.)

**This touched the app's page, and your rule was no app changes until you were
through the Play Store.** That rule was yours. Item 3 shipped on the Zodiacs page
(`/key`), and hub.html and fight.html carry no install prompt of their own.

My read: it is not a feature, it is a fix for something already broken on half
your traffic — but it is still your rule and your decision.
