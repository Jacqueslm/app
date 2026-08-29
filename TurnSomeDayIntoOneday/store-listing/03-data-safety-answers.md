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
| **Other in-app messages** | **Yes — DONE 29 Aug, not ephemeral** | No | App functionality |

> ### ✅ FIXED 29 Aug 2026, 3:15 PM — submitted for review.
>
> The data type was ALREADY ticked; the wrong answer was one step further in.
> Play asks *"Is this data processed ephemerally?"* and it was set to **Yes**.
> Changed to **No**. Collected/not-shared, required, and App functionality were
> all already correct and were left alone. Publishing overview: "App content →
> Data safety → Complete Data safety questionnaire", 1 change sent for review.
>
> Note for next time: the repo said "change it to Yes, collected". It was
> already collected. Look at the actual console before acting on these notes.
>
> ### The reasoning (28 Aug) — why it had to change:
>
> The reasoning below is correct **about Friendly** and stays true: chat text is
> never stored. But the answer was written as if Friendly were the only place a
> member writes something, and it is not. Two other places persist user-written
> text on the server, and neither was considered when this form was filled in:
>
> - **`room_posts.body`** — every live room post, stored server-side and shown
>   to other members (`createRoomPost` in `server/db.js`).
> - **`letters.body`** — a letter written to a partner, stored against a token
>   so the recipient can open it by link (`createLetter` in `server/db.js`).
>
> A letter written to one named person and delivered by link is an in-app
> message by any reading. So **Other in-app messages must be Yes, collected,
> not ephemeral**, purpose App functionality. Sharing stays **No**: showing a
> post to other members of the app is not "sharing" in Play's sense, which
> means transfer to a third party.
>
> This file's own warning applies to itself - under-declaring is the single
> most common cause of a data-safety enforcement action. Jacques must change
> this one in the console; nothing in the repo can do it for him.
>
> The note below remains accurate for Friendly and is worth keeping as the
> defence of the "not stored" half:
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
| **Crash logs** | Yes | No | App functionality |
| **Diagnostics** | **No** | — | — |

> The `error_log` table holds recent server-side errors, capped at 200 rows —
> that is crash logs. **Diagnostics is a separate tick and the answer is no:**
> Play means performance data (load time, latency, framerate, battery), and
> none of that is recorded anywhere.

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

### ⚠ Also check while you are in there (28 Aug 2026)

The **Data sharing** section below named two processors. There are more, and an
audit on 28 Aug found the privacy policy had the same gap — it named Anthropic
and Stripe only, described the app as "self-hosted", and stated there was no
analytics tracker. All three were wrong; `privacy.html` is corrected. The real
list, read from the code:

| Processor | What it receives | Where |
|---|---|---|
| **Google (Gemini)** | Friendly messages, and every room post for moderation | `server/server.js`, `server/rooms.js` |
| **Anthropic** | Friendly messages — only if no Gemini key is set | `server/server.js` (fallback path) |
| **Stripe** | Card details and email, web purchases only | `server/billing.js` |
| **Google Play** | Android purchases | `server/store-billing.js` |
| **Resend** | Email address and message body | `server/email.js` |
| **Plausible** | Page URL, plus IP and user agent so a visit counts once | `server/analytics.js` |

Push notifications use self-issued VAPID keys and no third party.

**Plausible is the one that changes an answer.** It is cookieless and does not
track across sites, but it is analytics and it receives an IP address, so do
not tell Play there is no analytics at all. It does not add a *data type* to
declare — no name, email or account id is ever sent — but the privacy policy
must disclose it, and now does.

### Everything else — declare NO

Location, contacts, calendar, files and docs, web browsing history, device or
other IDs, and advertising data are **not** collected. There are no ads, no
third-party analytics SDKs, and no trackers.

**Videos: no. Music and other audio: no.** Only the two things named above are
ticked in those two categories — the profile **photo**, and **voice or sound
recordings** for voice journaling. Everything else in Photos and videos, and in
Audio files, stays unticked.

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
