# After the release goes to review — what is left

## Immediately
- [ ] Confirm `https://www.turnsomedayintodayone.com/.well-known/assetlinks.json`
      is live and shows the real fingerprint (not the placeholder). Railway
      deploy has to finish first.
- [ ] Confirm `/privacy` and `/delete-account` load signed out.

## Digital Asset Links — why both fingerprints are listed

`.well-known/assetlinks.json` lists **two** certificates:

- `99:D2:75...` — the Play **app signing key** (what Play re-signs installs with)
- `91:7B:4C...` — the **upload key** (what the .aab is signed with locally)

Listing only the app signing key left the TWA falling back to Custom Tabs with a
browser bar on two separate devices, while every other artifact checked out: the
app declared the right origin, the file was live, and Google's validator called
the statement valid. That validator only checks the file — it has no idea which
certificate is on the installed app, so a mismatch there looks like success.

If the key is ever rotated again, add the new fingerprint here **before** the
rotation reaches installs. Verification is evaluated at install time, so an
existing install keeps its cached result until it is reinstalled.

Check the whole chain from anywhere with:

    curl "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.turnsomedayintodayone.com&relation=delegate_permission/common.handle_all_urls"

Note the apex domain (no `www`) serves nothing — the TWA uses `www`, so this does
not matter, but a bare-domain link would not verify.

## Tester opt-in link

    https://play.google.com/apps/testing/com.turnsomedayintodayone.app

This is a **closed** test: the link only works for Gmail addresses already on
the Closed testers list in Play Console. Posting it publicly does nothing for
anyone not on that list. The order is always: get their Gmail address, add it
to the list, then send the link.

## Once the closed test is live
- [ ] Install from the Play link on a real Android phone.
- [ ] **No address bar at the top.** If there is one, assetlinks is not being
      read — check it is served as `application/json` and the fingerprint
      matches the Play App Signing key, not the upload key.
- [ ] Sign in and confirm Plans shows prices (the Play build detection works via
      `?src=play`).
- [ ] Get to 12 testers and keep them for 14 continuous days.

## In-app purchases — the one thing that cannot be tested from here
Play Billing needs a device and Google credentials, so none of this could be
verified in the build environment. It has to be done on a real phone.

- [ ] Create 3 products in Play Console → Monetize with Play → Products:
      - `pro_monthly`   (subscription)
      - `pro_yearly`    (subscription)
      - `pro_lifetime`  (one-time product)
      The IDs must match exactly — `PRODUCT_PLANS` in `server/store-billing.js`
      maps them, and an unknown ID is rejected rather than guessed at.
- [x] Google Cloud project `day-one-play`, Google Play Android Developer API enabled
- [x] Service account `day-one-play-billing@day-one-play.iam.gserviceaccount.com` + JSON key
- [x] Invited in Play Console with View app information, View financial data and
      **Manage orders and subscriptions**. That last one is what lets the server
      acknowledge purchases; without it acknowledgement 403s and Google refunds
      every sale after three days.
- [ ] Railway → env var `PLAY_SERVICE_ACCOUNT_JSON` = the whole JSON, one line.
      Until this is set the app **refuses to open the payment sheet at all** and
      says "Purchases are temporarily unavailable — nothing has been charged."
      That is deliberate: without the key the server cannot verify a purchase,
      so a customer would otherwise pay and receive nothing. Setting the
      variable is what switches purchases on; no code change or redeploy of the
      app is needed beyond Railway restarting.
- [ ] Add your tester accounts to Play Console → Settings → License testing so
      test purchases are free.
- [ ] Buy Pro on a real device and confirm the account flips to Pro.
- [ ] **Three days after that test purchase, check it was not refunded.** That is
      the only real proof acknowledgement is working. If it was refunded, look in
      the error log for `ACKNOWLEDGE FAILED` — the code logs it rather than
      refusing the customer.

## Env vars this app now expects
| Name | Purpose | Set? |
|---|---|---|
| `COMP_PRO_EMAILS` | Free Pro for the Play review account and testers | yes |
| `PLAY_SERVICE_ACCOUNT_JSON` | Verifies and acknowledges Play purchases | yes |
| `PLAY_PACKAGE_NAME` | Defaults to `com.turnsomedayintodayone.app` | optional |

## Rebuilding the .aab
Only needed for shell-level changes — package name, icon, splash colour, target
SDK. Everything inside the app updates from Railway with no new build and no
review, because the Android app loads the live site.

    cd C:\dayone\app-claude-vibe-code-uwxxlk\TurnSomeDayIntoOneday\twa
    bubblewrap build

Bump `appVersionCode` in `twa-manifest.json` first — Play rejects a re-upload
of the same version code.

## The keystore
`android-upload.keystore`, alias `upload`. It is the only way to ever ship an
update to this listing. It is backed up off the machine — keep it that way.

## Play product setup — record of what was created

| Product ID | Type | Base plan / offer | Price |
|---|---|---|---|
| `pro_monthly` | Subscription, auto-renewing | `monthly-autorenew`, monthly | $9.99 USD |
| `pro_yearly` | Subscription, auto-renewing | `yearly-autorenew`, yearly | $59.99 USD |
| `pro_lifetime` | One-time product | — | $149.99 USD |

Prices mirror `PLANS` in `server/billing.js` exactly. If one side changes and
the other does not, an Android user sees a different number in the app than at
checkout.

Both subscriptions need a **7-day free trial offer** added after the base plan
is created, to match `TRIAL_DAYS = 7` on the Stripe side. A base plan is not
purchasable until it is **activated**.

Grace period left at Google's recommended 7 days, account hold auto-calculated.

### Progress
- [x] `pro_monthly` created, base plan `monthly-autorenew` at $9.99, **Active**
- [x] `pro_monthly` offer `freetrial-7day` — new customer acquisition, 7-day free trial
- [x] `pro_yearly` — base plan `yearly-autorenew` + offer `freetrial-7day`, both **Active**
- [x] `pro_lifetime` — one-time product, purchase option `lifetime`, **Active**
- [ ] Verify the US price on each: $9.99 / $59.99 / $149.99. A wrong number here
      is invisible until someone is charged it.
- [x] `PLAY_SERVICE_ACCOUNT_JSON` set in Railway — purchases are now switched on
