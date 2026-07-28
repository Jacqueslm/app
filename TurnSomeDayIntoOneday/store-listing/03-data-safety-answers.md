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
| **User IDs** | Yes | No | Account management | Required |

> **User IDs** covers the internal account ID rows are keyed on. It never leaves
> the server and is not an advertising or device identifier, but Play counts an
> account ID as a user ID, so it is declared.

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

### Photos and videos

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| **Photos** | Yes | No | App functionality | **Optional** |

> The profile photo. It is resized to 300px and stored as a data URL inside the
> user's own synced state (`S.profilePhoto` in `index.html`, written by `save()`
> and pushed by `pushStateToServer`), which means it does reach the server and
> must be declared. It is deleted with the account.

### Audio files

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| **Voice or sound recordings** | Yes — **processed ephemerally** | No | App functionality | **Optional** |

> Voice journaling uses the browser's Web Speech API. The app never receives,
> stores or transmits audio itself — only the finished transcript, which the
> user then saves as an ordinary journal entry. But the platform's speech
> service does take the audio off the device to produce that transcript, so
> declaring it is the honest answer. Tick **processed ephemerally**: no
> recording is ever retained anywhere in this system.

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

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| **Payment info** | **No** | No | — | — |
| **Purchase history** | Yes | No | App functionality, Account management | Required |

> **Payment info: No.** Card details are never handled by this app on any
> platform. In the Android build the purchase happens inside Google Play and the
> app only ever receives a purchase token; on the web, card details go straight
> to Stripe and never touch this server.
>
> **Purchase history: Yes.** The Android build sells Pro through Google Play, and
> `recordStorePurchase` in `server/db.js` stores the plan, the store product ID
> and the purchase token against the account. That is purchase history in Play's
> sense and must be declared — it is what keeps Pro unlocked across devices.

### Everything else — declare NO

Location, contacts, calendar, photos/videos, audio, files, web browsing history,
device IDs, and advertising data are **not** collected. There are no ads, no
third-party analytics SDKs, and no trackers.

---

## Section 3 — Data sharing

**Nothing is shared** in Play's sense of the word (transferred to a third party
for their own use). Two processors are worth stating plainly if asked:

- **The model provider** receives conversation text solely to generate a reply.
- **Stripe** processes payments on the website. In the Android app the purchase
  runs through **Google Play**, and the server only verifies the resulting token
  against Google's own API.

Play does not classify a service provider acting on your instructions as
"sharing", so both remain **Collected: yes / Shared: no**.

---

## Privacy policy URL — use this exact URL everywhere

```
https://www.turnsomedayintodayone.com/privacy
```

Same URL in Play Console, in the app, and on the website. Play checks that the
policy is reachable **without signing in** — this one is.
