# Data safety form — answers

Play Console → App content → Data safety. Every answer below was checked
against the code, not assumed. Where a claim was verified, the file is named so
you can defend the answer if Play ever asks.

---

## Section 1 — Data collection and security (applies to everything)

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only; the site is served over TLS) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — Profile → Danger zone → Delete my account, which removes the account and its stored state server-side |

---

## Section 2 — Data types

### Personal info

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| **Email address** | Yes | No | Account management | Required |
| **Name** | Yes | No | App functionality (the app greets you by first name) | Required |
| **Phone number** | Yes | No | Account management (account recovery) | **Optional** — the signup field is optional |

### Health and fitness

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| **Health info** | Yes | No | App functionality | Required |

> Covers self-reported wellbeing data: the day counter, mood entries, journal
> text, and logged difficult moments. Declare this. It is the honest answer and
> under-declaring here is the single most common cause of a data-safety
> enforcement action.

### Messages

| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| **Other in-app messages** | **No — processed ephemerally** | No | App functionality |

> Tick **"Data is processed ephemerally"**. This is verified, not a claim:
> `serializeState()` in `index.html` explicitly strips `chatHistory` before
> anything is written to storage, and `load()` clears it on every start. The
> server stores only a per-day integer count in the `chat_usage` table — there
> is no column anywhere that holds message text. Conversation text is sent to
> the model provider to generate a reply and is not retained by the app.

### App activity

| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| **App interactions** | Yes | No | App functionality |

> The in-app activity log (`logActivity` in `index.html`) records which features
> were used and when. It lives in the user's own synced state, not in an
> analytics product.

### App info and performance

| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| **Crash logs / diagnostics** | Yes | No | App functionality |

> The `error_log` table holds recent server-side errors, capped at 200 rows.

### Financial info

| Data type | Collected | Shared |
|---|---|---|
| **Payment info** | **No** | No |

> The Android build sells nothing — every purchase surface is removed and the
> server refuses a checkout request from it. No payment details are handled by
> the app on any platform: on the web, card details go directly to Stripe and
> never touch this server.

### Everything else — declare NO

Location, contacts, calendar, photos/videos, audio, files, web browsing history,
device IDs, and advertising data are **not** collected. There are no ads, no
third-party analytics SDKs, and no trackers.

---

## Section 3 — Data sharing

**Nothing is shared** in Play's sense of the word (transferred to a third party
for their own use). Two processors are worth stating plainly if asked:

- **The model provider** receives conversation text solely to generate a reply.
- **Stripe** processes payments — **on the website only**, never in the Android app.

Play does not classify a service provider acting on your instructions as
"sharing", so both remain **Collected: yes / Shared: no**.

---

## Privacy policy URL — use this exact URL everywhere

```
https://www.turnsomedayintodayone.com/privacy
```

Same URL in Play Console, in the app, and on the website. Play checks that the
policy is reachable **without signing in** — this one is.
