# Manual test checklist

Things the automated tests cannot cover: the real sites, real email, and real devices.
Work through it top to bottom; each step says what you should see.

Setup: the server is running (`python -m app.main serve`) and the site opens at
`http://localhost:8765`.

## 1. Sources

- [ ] Run `python -m app.main run-once`. Expect one line per source (`barby`, `reading3`,
      `zappa`, `kupat`, `comy`), each with an event count above zero and no traceback.
- [ ] Open `http://localhost:8765/health`. Every source has a recent `last_synced_at`.
- [ ] Pick one show from each venue on the site and compare it with the venue's own site:
      title, date, time, and that the card opens the right page.

## 2. Sign-up and subscriptions

- [ ] The sign-in screen says there is no password or verification email, so the address
      must be typed exactly.
- [ ] Sign in with an address that has no profile yet. You are asked "לא מצאנו את המייל הזה.
      ליצור פרופיל חדש?" with the address shown large. "תיקון הכתובת" takes you back to the
      field with the address selected; nothing was created (`python -m app.main list` does not
      show it). "יצירת פרופיל" signs you in and you land back on the events page.
- [ ] Sign out and sign in again with the same email. No question this time, and your settings
      are still there.
- [ ] Try an invalid email (`abc`). You get an error and stay signed out.
- [ ] In "האמנים שלי", the "i" beside "אמן או להקה" explains that the name is not checked and
      must appear as whole words in the event title or guest list (hover on desktop, tap on a
      phone).
- [ ] Type `אביתר בנאי` slowly. After a short pause a preview lists the matching events on the
      board ("אביתר בנאי והלהקה" counts). Type a name with no shows: the note says there are no
      events yet without calling the name wrong.
- [ ] Add an artist with "כל המקומות". Their existing shows appear right away.
- [ ] Add the same artist again. No duplicate appears.
- [ ] Add another artist at two venues (open "מקום", search, tick two). The list shows one row
      for the artist with both venue badges, and only shows at those venues are listed.
- [ ] Add that artist again with "כל המקומות". The row now says "כל המקומות"; the two
      venue-specific subscriptions are gone (`python -m app.main list`).
- [ ] Delete an artist, then undo. It comes back with the same venues.
- [ ] On the events page, open "סינון" and turn on "רק האמנים שלי". Only followed shows remain.
- [ ] Follow an artist from a card (the star). The form opens pre-filled with the title, the
      card's venue is first in the venue list, and the preview shows the card's event. After
      saving, the card is marked as followed.

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
- [ ] With no filter set the page shows only the "סינון" button next to the categories; there
      is no row of venues that runs off the side of the screen.
- [ ] Open "סינון": a popover under the button on iPad and desktop, a sheet on a phone. Pick two
      venues (the search inside the list narrows it). The list updates behind the panel, and
      the venues show as chips beside the button with their colour dots; the badge counts 1.
- [ ] Pick a third venue: the chips fold into "3 מקומות". Reopen the panel: the picked venues
      are at the top of the list, checked.
- [ ] Date: "היום", "סוף השבוע" (Thursday to Saturday), "השבוע" (to Saturday), "החודש", a month,
      a single day (only "מתאריך") and a range (both fields). Each keeps only events on those
      days in Israel time, and shows as one chip.
- [ ] The × on a chip removes only that filter; "ניקוי הכל" removes all of them but keeps the
      search; the panel's "ניקוי" does the same.
- [ ] Set filters and a search, reload the page: they are all still there. Go to "האמנים שלי"
      and come back with the tab bar or the logo: still there. Change the category: still there.
- [ ] Pick filters that match nothing (e.g. "סטנד אפ" + בארבי + "סוף השבוע"). The message names
      what is in the way and offers "ניקוי הסינון", which clears the filters only.
- [ ] Popover: Escape closes it and returns focus to the button; a click outside closes it.
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

- [ ] iPhone: cards are two per row, nothing scrolls sideways.
- [ ] iPhone: the filter sheet's "הצגת N אירועים" button stays at the bottom while the sheet
      scrolls, and the date fields open the native date picker.
- [ ] iPad: the filter popover fits on screen in both orientations, its venue list scrolls by
      touch, and the active filter chips wrap onto a second line instead of running off.
- [ ] Desktop with a mouse: the venue list inside the popover scrolls with the wheel.
- [ ] iPhone: tapping the search or email field does not zoom the page.
- [ ] iPhone: the bottom tab bar sits above the home indicator, not under it.
- [ ] iPhone: the filter sheet opens, scrolls and closes.
- [ ] iPhone: the info "i" and the follow star respond to a tap; tapping elsewhere on a
      card opens the venue's site.
- [ ] iPad portrait and landscape: the grid reflows (3 and 4 columns) and the header fits.
- [ ] Both themes look right on each device.
- [ ] On mobile data over Tailscale, the first screen loads in a reasonable time.

## 6. Venue names and old events

- [ ] Open `/api/venues`. Each place is listed once: for example "אודיטוריום ספיר - כפר סבא"
      appears once (not also as "אודיטוריום ספיר-כפר סבא"), and no name carries "סילבסטר".
- [ ] The same names appear on the cards and in the filter's venue list, with one colour each.
- [ ] A subscription made before this change with an old spelling (e.g. via
      `python -m app.main subscribe you@example.com "בדיקה" --venue "בית החייל תל אביב-סילבסטר"`,
      then restart `serve`) shows the clean name in "האמנים שלי", and an injected event at
      "בית החייל - תל אביב" alerts it.
- [ ] After a run, `data/thumbs/` holds no more files than there are distinct images in the
      events table, and no event older than yesterday is left:
      `sqlite3 data/event_seeker.db "select count(*) from events where coalesce(ends_at, starts_at) < date('now','-1 day')"`
      prints 0.
- [ ] A show that just took place and that a site still lists does not come back on the next
      run (its id stays gone) and no alert goes out for it.

## 7. Leave it running

- [ ] Keep `serve` running for a few hours. `/health` shows `last_synced_at` advancing about
      once an hour for every source, and the log has no repeating errors.
