# Manual test checklist

Things the automated tests cannot cover: the real sites, real email, and real devices.
Work through it top to bottom; each step says what you should see.

Setup: the server is running (`python -m app.main serve`) and the site opens at
`http://localhost:8765`.

## 1. Sources

- [ ] Run `python -m app.main run-once`. Expect one line per source (`barby`, `reading3`,
      `zappa`), each with an event count above zero and no traceback.
- [ ] Open `http://localhost:8765/health`. Every source has a recent `last_synced_at`.
- [ ] Pick one show from each venue on the site and compare it with the venue's own site:
      title, date, time, and that the card opens the right page.

## 2. Sign-up and subscriptions

- [ ] Sign in with your email. You land back on the events page, signed in.
- [ ] Sign out and sign in again with the same email. Your settings are still there.
- [ ] Try an invalid email (`abc`). You get an error and stay signed out.
- [ ] In "האמנים שלי", add an artist with "כל המקומות". Their existing shows appear right away.
- [ ] Add the same artist again. No duplicate appears.
- [ ] Add another artist limited to one venue. Only shows at that venue are listed for them.
- [ ] Delete a subscription, then undo. It comes back.
- [ ] On the events page, turn on "רק האמנים שלי". Only followed shows remain.
- [ ] Follow an artist from a card (the star). The form opens pre-filled; after saving, the
      card is marked as followed.

## 3. Email alerts (real email to yourself)

Prepare:

- [ ] `.env` has `SMTP_USER`, `SMTP_PASSWORD` (Gmail App Password) and `EMAIL_ENABLED=true`.
- [ ] Restart the server so it reads `.env`.
- [ ] You are subscribed to an artist name you will use below, for example `בדיקה`
      (add it in "האמנים שלי").

Test:

- [ ] Run `python -m app.main inject-fake "בדיקה - הופעה חדשה"`.
      Expect `sent 1 event(s) to <your email>` in the output.
- [ ] The email arrives (check spam too). Subject, show name, venue, date and the ticket
      button look right, and the Hebrew reads right-to-left.
- [ ] Run `python -m app.main inject-fake "מישהו אחר"`. No email: it matches no subscription.
- [ ] Run `python -m app.main inject-fake "בדיקה - עוד הופעה"` and then
      `python -m app.main run-once`. Exactly one email for it, not two.
- [ ] Venue filter: subscribe to `בדיקה2` limited to "בארבי", then run
      `python -m app.main inject-fake "בדיקה2" --venue "רידינג 3"` (no email) and
      `python -m app.main inject-fake "בדיקה2" --venue "בארבי"` (email).
- [ ] Pause: turn on "השהיית התראות", inject another `בדיקה` event. No email, and none
      arrives later when you turn the pause off.
- [ ] Global switch: set `EMAIL_ENABLED=false`, inject a `בדיקה` event. The output says the
      alert is waiting. Set it back to `true` and run `run-once`. The email arrives.
- [ ] Wrong password: put a wrong `SMTP_PASSWORD`, inject a `בדיקה` event. The output shows
      a failure. Fix the password and run `run-once`. The email arrives.

Clean up:

- [ ] Run `python -m app.main remove-fake`. The fake events disappear from the site.
- [ ] Delete the `בדיקה` subscriptions.

## 4. Events page

- [ ] Search finds a show while you type part of a name.
- [ ] Each venue chip filters to that venue; "כל המקומות" clears it.
- [ ] "הופעות" and "סטנד אפ" filter by category; "כל האירועים" shows everything.
- [ ] A sold-out Barby show is marked "אזלו הכרטיסים"; check it against Barby's site.
- [ ] A Zappa show marked "לא זמין" is also not purchasable on Zappa's site.
- [ ] The info "i" explains the status.
- [ ] "הסתר לא זמינים" hides both kinds.
- [ ] A Barby show with few tickets shows the count.
- [ ] Switch to the light theme, reload: it stays light. Sign in on another browser: the
      theme follows your account.

## 5. Phone and iPad

Open `http://<this computer's IP>:8765` from the same Wi-Fi (allow it in Windows Firewall
if asked). These were only checked in Chrome's device emulation, so real Safari matters.

- [ ] iPhone: cards are two per row, nothing scrolls sideways except the venue chips.
- [ ] iPhone: tapping the search or email field does not zoom the page.
- [ ] iPhone: the bottom tab bar sits above the home indicator, not under it.
- [ ] iPhone: the filter sheet opens, scrolls and closes.
- [ ] iPhone: the info "i" and the follow star respond to a tap; tapping elsewhere on a
      card opens the venue's site.
- [ ] iPad portrait and landscape: the grid reflows (3 and 4 columns) and the header fits.
- [ ] Both themes look right on each device.
- [ ] On mobile data over Tailscale, the first screen loads in a reasonable time.

## 6. Leave it running

- [ ] Keep `serve` running for a few hours. `/health` shows `last_synced_at` advancing about
      once an hour for every source, and the log has no repeating errors.
