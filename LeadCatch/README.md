# LeadCatch

Lead capture and follow-up for small businesses.

A business signs up, gets a contact form they can paste onto their website with
one line, and every enquiry lands in their inbox and in a dashboard where they
track who they've called back. Multi-tenant: each account sees only its own
forms and leads.

## Run it

```bash
cd LeadCatch
npm install          # also installs server/ dependencies
npm start            # http://localhost:3100
npm test             # 39 end-to-end checks against a throwaway database
```

Node 22.5+ (it uses the built-in `node:sqlite`). No build step, no framework on
the front end.

Copy `.env.example` to `.env` for real deployments. The two settings that matter:

- `SESSION_SECRET` — required in production; the server refuses to start without it.
- `RESEND_API_KEY` — turns on new-lead emails. Without it leads are still captured
  and listed, just not emailed. The dashboard says so on the Settings page.

## How a customer uses it

1. Sign up. An account starts with a working form already pointed at the signup email.
2. **Forms** → copy the snippet, paste it into their website before `</body>`:

   ```html
   <script src="https://your-host/embed.js" data-form="PUBLIC_KEY" async></script>
   ```

   Options on that tag:

   | Attribute | Meaning |
   | --- | --- |
   | `data-form` | required — the form's public key |
   | `data-mode` | `inline` (default) renders where the tag sits; `button` adds a floating tab that opens the form in a dialog |
   | `data-target` | CSS selector to render into instead of next to the tag |
   | `data-label` | text on the floating button in `button` mode |

   No website? Every form also has a shareable link (`/f/PUBLIC_KEY`) for a bio,
   a Google Business profile, or a WhatsApp message.
3. Enquiries arrive by email and appear under **Leads**, where each one moves
   through New → Contacted → Quoted → Won/Lost, takes a note, and (once won)
   records a job value. **Export CSV** takes the lot.

## Layout

```
LeadCatch/
  server/
    server.js   routes, validation, spam filtering
    db.js       SQLite schema and queries - every form/lead query is scoped by account_id
    auth.js     bcrypt + JWT session cookie
    notify.js   new-lead email via Resend
  public/
    index.html  marketing page + sign up / sign in
    app.html    dashboard shell
    app.js      dashboard logic
    embed.js    the widget that runs on customers' websites
    form.html   hosted form page behind /f/:key
    styles.css  shared styles, light and dark
  test/smoke.js end-to-end tests
```

## Design notes

**Tenant isolation.** Every query that touches forms or leads takes an
`account_id` and puts it in the `WHERE` clause — there is no "get lead by id"
without the owner. The test suite asserts this from the outside: a second
account gets a 404, not a 403, for every one of another account's records.

**The widget renders in a shadow root.** Without it, the host site's CSS reaches
in and the form looks broken on exactly the sites that can't be tested first.

**Nothing is rendered with `innerHTML`.** Lead content is typed by strangers, so
the dashboard and the widget build DOM nodes and set `textContent`. A lead named
`<script>…` shows those characters.

**CSV exports quote leading `=`, `+`, `-` and `@`.** Otherwise a lead named
`=HYPERLINK(...)` executes when the owner opens the export in Excel. The file
also carries a UTF-8 BOM so accented names survive.

**Spam is dropped silently.** A honeypot field and a minimum time-on-form both
answer `200 OK` when they trip — telling a bot it was caught only teaches
whoever wrote it to fix that part. Repeat submissions of the same email or phone
within ten minutes collapse into one lead, so a double-click isn't two customers.

**CORS is deliberately narrow.** Only `/embed.js` and `/api/public/*` are
cross-origin readable, and they carry no credentials — the form key in the URL
is the whole authorization story. That middleware is registered with `app.use`,
not per route: a JSON POST from another domain sends an `OPTIONS` preflight
first, and `app.post()` never matches `OPTIONS`.

## Not built yet

Worth knowing before this goes in front of paying customers:

- **No password reset.** A locked-out owner needs manual help. This is the first
  thing to add.
- **No billing.** Every account has the same unmetered access (capped at 25 forms).
- **No email verification** on signup, and no per-account sending domain — lead
  notifications go out from whatever `EMAIL_FROM` is set to.
- **SQLite on one box.** Fine into the thousands of leads; it is not a cluster.
