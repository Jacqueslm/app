# After the release goes to review — what is left

## Immediately
- [ ] Confirm `https://www.turnsomedayintodayone.com/.well-known/assetlinks.json`
      is live and shows the real fingerprint (not the placeholder). Railway
      deploy has to finish first.
- [ ] Confirm `/privacy` and `/delete-account` load signed out.

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
- [ ] Google Cloud → service account with the Android Publisher role, download
      the JSON key, grant it access in Play Console → Users and permissions.
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

## Env vars this app now expects
| Name | Purpose | Set? |
|---|---|---|
| `COMP_PRO_EMAILS` | Free Pro for the Play review account and testers | yes |
| `PLAY_SERVICE_ACCOUNT_JSON` | Verifies Play purchases | **not yet** |
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
- [ ] `pro_monthly` 7-day free trial offer
- [ ] `pro_yearly` + base plan + trial offer
- [ ] `pro_lifetime` one-time product
- [ ] `PLAY_SERVICE_ACCOUNT_JSON` in Railway — until this is set the app refuses
      to open the payment sheet, so none of the above can be bought yet
