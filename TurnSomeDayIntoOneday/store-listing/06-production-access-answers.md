# Production access questionnaire — answers

For the form Play shows when the 14-day closed test completes (about 13 Aug).

**Read this first.** Testers Community sent a document of pre-written answers.
Do not paste theirs. Several of them describe work that has not been done —
they say you added a new-user walkthrough and Google Sign-in. You haven't. If
Google installs the app and looks, the form is the wrong place to have been
caught out, because this form is the whole decision.

Everything below is true as of today. Where only you can answer, it says so.

---

**1) How did you recruit users for your closed test? For example, did you ask
friends and family, or use a paid testing provider?**

> A paid testing provider, Testers Community. I'm a solo developer and I don't
> have twelve people close to me who use Android and would test properly, and I
> wanted feedback from people who had no reason to be kind about it.

---

**2) How easy was it to recruit testers for your app?**

Pick the honest option. If it took a paid provider to get twelve people, that
is not "very easy" — **Neutral** or **Difficult** is the truthful answer and
neither one counts against you.

---

**3) Describe the engagement you received from testers during your closed test.**

> Testers ran the app across a range of devices and Android versions over the
> full test period and sent back a written report. They exercised the whole app
> — the day counter, the daily lessons, the journal, the progress screen, the
> chat companion and the SOS tools — rather than only opening it. Their report
> found no crashes and no functional bugs, and instead concentrated on how the
> app presents itself to someone who has never seen it before.

---

**4) Provide a summary of the feedback that you received from testers. Include
how you collected the feedback.**

> Feedback came as a written report from the testing provider at the end of the
> test period, covering device compatibility, functionality and usability.
>
> On stability the result was clean: no crashes, and every feature behaved as
> intended on every device and SDK configuration tested.
>
> The substantive feedback was about first impressions and onboarding. Four
> points: (1) the Play Store screenshots were plain captures that did not
> explain what any screen does; (2) there is no guided walkthrough for a
> first-time user; (3) some of the interface is rendered in a WebView rather
> than native components; (4) sign-in is email and password only, with no
> Google Sign-in.
>
> They also suggested user testimonials on the store page, an in-app feedback
> route, and optional reminder notifications.

---

**5) Who is the intended audience for your app?**

> Adults who are trying to stop drinking or to stop another habit that has got
> away from them, and the partners and family members living alongside them —
> the app has a separate section written for the person supporting someone,
> because they are usually given nothing.
>
> It is aimed at people who are not ready to walk into a room and say it out
> loud, and want something private to start with.

---

**6) Describe how your app provides value to the users.**

> It does four things. It counts the days, hours and money since you stopped,
> so progress is visible on a bad day. It gives one short lesson a day, which
> can be listened to instead of read. It keeps a private journal with a mood
> on each entry, so patterns become visible over weeks. And it has an SOS
> screen for the moment a craving hits — a breathing exercise, a calm voice
> that talks you through it hands-free, a chat companion, and a one-tap route
> to the 988 Suicide & Crisis Lifeline.
>
> Lifetime progress never resets. If someone relapses, the days they already
> did are still counted, because the version that zeroes you out is the version
> people delete.
>
> It does not replace treatment and says so in the app.

---

**7) How many installs do you expect your app to have in your first year?**

Yours to pick. Do not put 10k–100k because a template said so. There is no
credit for a big number and no penalty for a small one.

---

**8) What changes did you make to your app based on what you learned during
your closed test?**

**Answer this one last, after you decide what you're actually shipping first.**
As it stands today, only the screenshots are done:

> The store screenshots were rebuilt. Each one now carries a caption saying
> what that screen does — the day counter, the craving/SOS tools, the chat
> companion, the daily lesson, the journal and the lifetime progress view —
> and they were reordered so the day counter leads rather than the crisis
> screen. That was the testers' first recommendation and the one that most
> affected whether anyone would install at all.
>
> Separately, during the test period I ran a full pass over the app myself and
> fixed what I found: a placeholder support address that had shipped in the
> privacy text, an old internal name still showing on one screen, and a server
> header that disclosed the stack unnecessarily. I also replaced the SOS voice
> audio after auditing the licences behind it.

If you add anything else before you submit — even a small onboarding tip on
first open — add a sentence for it here. Do not describe anything you have not
shipped.

---

**9) How did you decide that your app is ready for production?**

> The closed test came back with no crashes and no functional bugs across the
> devices and Android versions tested, which was the bar I set. The remaining
> feedback was about presentation and convenience rather than anything broken,
> and I've acted on the store-listing part of it. The rest — a guided
> walkthrough, Google Sign-in, moving more of the interface to native
> components — is real and it's on my list, but none of it stops the app doing
> what it's for today.

---

**10) What did you do differently this time?**

This question only appears if you have been rejected for production before. If
you have not, you will not see it. If you do see it, answer it about what you
changed since the rejection — not about the test.

---

## The three you have not done

Keeping these written down so nothing gets quietly dropped. None of them block
production access. All of them are app features, so under your own rule they
wait until you are through the Play Store.

| | What | My read |
|---|---|---|
| Guided walkthrough for new users | A first-open tour of the four tabs, skippable | Worth doing. Cheap, and the app has more in it than a first-time user finds. |
| Google Sign-in | One-tap sign-in with a Google account | Worth doing, and it removes a password from a recovery app — which is a privacy argument as much as a convenience one. |
| Native components instead of WebView | Rebuild the interface natively | Not worth doing. Your app *is* a web app in a Play wrapper; this is a rewrite, not a fix. Google accepts TWAs — the provider is describing a general preference, not a rule you are failing. |
