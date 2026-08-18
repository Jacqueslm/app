# Send outreach emails

This folder is the sending mechanism for the outreach emails in
`OUTREACH-NEW-2026-08-18.md`. It uses **Resend** (the email API).

## What blocks an actual send right now (3 things)

1. **`RESEND_API_KEY`** — not set yet. Create a Resend account, copy your API
   key, and paste it into the workspace **Keys / API keys** tab as
   `RESEND_API_KEY`.
2. **A verified from-address.** Resend only lets you send from a domain (or
   address) you verify. Until then you can only send to your own inbox in test
   mode. Put your real sending address in `recipients.json` → `from`.
3. **Confirmed recipient emails.** The outreach list routes are mostly
   `form` / `verify` / `DM` — meaning there is no confirmed email address in
   the file yet. Each entry in `recipients.json` needs a real, confirmed
   address. Contact-form-only targets (Sobertown, Dopey, Celebrate Recovery,
   etc.) **cannot be emailed** — those have to go through their contact form or
   a DM.

## To send

```bash
cd send-outreach
npm install
# paste your key in the Keys / API keys tab (RESEND_API_KEY)
# fill recipients.json with real addresses + bodies
node send.mjs
```

Each line prints `OK` or `FAIL` with the reason. Nothing is sent until
`recipients.json` has real addresses and the key is set.
