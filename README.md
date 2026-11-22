# Fontaine Control Center

Family wall tablet (Android, Fully Kiosk Browser). Plain HTML/CSS/JS on GitHub Pages.
**No family data lives in this public repository**: names, events, contacts and settings come from a private Google Apps Script that is not stored here. `?demo` shows a made-up family.

- **See it now with sample data:** https://sachafontaine-cell.github.io/fontaine-control-center/?demo
- **Version / update:** the small `v1.3.0 ↻` at the bottom right checks for an update right away. The tablet also checks by itself when someone walks up and every 30 minutes, and applies new versions on the home screen.

## One-time setup

### 1. Turn on GitHub Pages (1 min)
Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)` → Save**.
The app is then at `https://sachafontaine-cell.github.io/fontaine-control-center/`.

### 2. Google script (10 min) — signed in with the account that sees the family calendars
1. Go to <https://script.google.com> → **New project**. Name it "Fontaine Control Center".
2. Replace the editor's content with the **loader** ("Fontaine Control Center — Chargeur (à coller une fois).txt") and put the newest **"Fontaine Control Center — Code.gs vX.Y.Z.txt"** in the same Drive folder as the project (both private, kept out of this repository on purpose). Run **checkLoader** once: the log must say *OK : la version … tourne*.
3. **Project Settings** (gear) → time zone **(GMT-08:00) Los Angeles**.
4. Back in the editor, pick **setup** in the function list and click **Run**. Approve the permissions (Calendar, Sheets, Slides, Drive, Gmail send, external requests, Maps).
5. Open **Execution log**: copy the **KEY** line. setup() also created a Sheet "Fontaine Control Center — données" in your Drive.
6. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy and copy the **Web app URL** (ends in `/exec`).

### 2b. Cozi groceries (optional, 2 min)
In the Apps Script editor: **Project Settings → Script Properties → Add**: `COZI_USER` = your Cozi login email, `COZI_PASS` = your Cozi password. They stay in Google, never in this repository. Then pick **coziTest** in the function list and **Run** (approve the new permissions): the log lists your Cozi shopping lists.
Three Cozi shopping lists: **Aldi**, **Costco**, **Balboa/99Ranch/TJ** (the names must match). "Auto" sends specialty ingredients to Balboa/99Ranch/TJ and everything else to Aldi. Kids' items get their name in brackets. Cozi has no official API: if Cozi changes its service, adding stops working until the script is updated (the app then says "Pas envoyé"; Cozi itself still works).

The script also gives Chef Luc the coming two weeks of dinners and keeps an "Envoyés" tab (dinners already sent to Cozi, from either app). The tab is created by itself the first time.

**Script updates are automatic (loader).** The Apps Script project holds only a small *loader* (private, pasted once: "Fontaine Control Center — Chargeur (à coller une fois).txt" in the script's Drive folder). It runs the newest **"Fontaine Control Center — Code.gs vX.Y.Z.txt"** in that same folder.
- **To release a new script version:** upload the new file to that folder with a higher version number. It is live within 5 minutes, with no pasting and no redeploying. Never paste a new `Code.gs` into the editor.
- Only files owned by the family account that nobody else can edit are run. A version that does not load is skipped and the previous one keeps running.
- **To roll back:** trash the newest file.
- **To see what runs:** in the editor, pick **checkLoader** → **Run**, or tap `v… ↻` in the app (it shows « script vX.Y.Z »), or look at Chef Luc → Réglages → *Script Google*.
- A script change that needs a **new Google permission** or a **new trigger function** needs the loader updated once (rare): add the service to `permissions_()` or a one-line entry point, paste the loader, run **checkLoader**, then **Deploy → Manage deployments → ✎ → New version**.

**Installing the loader (once):** open the loader file in Drive, copy everything, paste it over `Code.gs` in the editor, save. Pick **checkLoader** → **Run** (approve if asked). The log must say *OK : la version … tourne*. Only then **Deploy → Manage deployments → ✎ (edit) → Version: New version → Deploy**. The address stays the same, so nothing changes on the tablet or phones. If the log shows an error, don't deploy: press undo (or paste the newest `Code.gs` file back) and nothing has changed.

### 3. The family link
Build this link (keep it private — it opens the family data):

```
https://sachafontaine-cell.github.io/fontaine-control-center/?k=KEY
```

(The script address is already in `config.js`.) Open it once on the tablet and on each parent's phone; it's remembered after that.

### 4. Tablet (Fully Kiosk Browser, PLUS license)
- **Start URL:** the family link above.
- **Kiosk mode:** on, with a **Kiosk Exit PIN**. To get out: swipe from the left edge (or tap the top-left corner) and enter the PIN.
- **Full screen:** turn off **Show Status Bar** and **Show Navigation Bar** (Toolbars and Appearance). Use the search in Fully's settings if a name differs.
- **Screen off timer:** 60 s.
- **Motion detection** (front camera): on — the app turns it off 20:30–7:00 by itself.
- **Scheduled sleep / wake up:** sleep 22:00, wake 5:45 (one rule per day, or "every day"). After 22:00 the power button wakes it.
- **Web content settings:** enable microphone access (voice notes).
- **Kiosk mode → Kiosk app whitelist:** add `com.cozi.androidfree`, so the **Épicerie** button can open the Cozi app (Android's back button returns to the wall).
- **Advanced web settings:** enable the JavaScript interface (lets the app switch motion detection at night).
- **Screen brightness:** low (less heat).
- **House rules screensaver:** after 40 s without a touch on the home screen, all the house rules fill the screen. Keep the screen-off timer above 40 s so the kids get to see them; when the screen wakes, they stay 8 s, or until someone touches the screen.
- **Night (20:30–7:00):** the wall is black; a tap brings the normal home screen back, which goes black again 90 s after the last touch. By day, any page returns to the home screen after 90 s.
- Only the wall tablet does this (it is recognized by Fully Kiosk, or by the `&wall` link). Phones and computers never do. To try the wall behavior in a normal browser, add `&wall` to the link once (`&wall=0` turns it off). Phones are never treated as the wall.
- Android Settings → Display → **Display size: smallest**, so the wall gets the room it is designed for (a compact layout covers smaller screens).
- Settings → Battery: turn on a charge limit if the tablet offers one.

### 5. Phone app + shortcuts (2 min per phone, Android + Chrome)
Open the family link once → on Accueil tap **Ajouter** (or Chrome ⋮ → *Installer l'application*). The **Fontaine** icon opens full screen.
Shortcuts: long-press the icon → **Agenda / Repas / Tâches / Épicerie**. Drag one to the home screen to get its own icon (**Épicerie** opens straight into the Cozi list).

If an icon ever shows the made-up family ("Famille d'exemple" card), open the family link again in that browser.

## Where to change what (one place each)
| Thing | Change it in |
|---|---|
| Events | Family Google Calendar (Maman's invitations to Papa show up too: "Courriel Maman" in Réglages) |
| Chores, points, rewards | "Tâches & Récompenses" sheet |
| House rules | "Règles de la maison" slides |
| Contacts, recipes, settings, school days off | "Fontaine Control Center — données" sheet |
| Dish filters (protein, cuisine, style) | Recettes tab: columns Protéine, Cuisine, Style (styles separated by commas) |
| Who gets the wall's voice notes | Réglages → "Courriels parents" (comma-separated) |
| School names on the weather tiles | Réglages → the two "Météo …" rows (the first part is the name shown) |
| Dinner | Repas screen (votes for next week; the cook swaps this week's dish, or types any dinner by hand in the dish search; a parent's phone can change who cooks a day) |
| Messages to the kids | the family link on a parent's phone |
| Groceries | Cozi — added from the Épicerie button, a dinner's Ingrédients button, or Chef Luc's weekly list (ingredients come from the newest Chef Luc recipe file in Drive). A dinner already sent from either app shows **Ingrédients ✓** and asks before sending again |
| Cooking a dinner | **Cuisiner** on a dinner (Repas) or **Cuisiner ce soir** (phone) opens the recipe in [Chef Luc](https://sachafontaine-cell.github.io/Chef-Luc/) |

Weeks run **Sunday to Saturday** everywhere (calendar, chores, dinners). Votes close every **Thursday at 19:00**: the top dishes become next week's dinners and the following week's options appear. A dinner already chosen for a day is never replaced by the vote.

## Files
- `index.html`, `app.css`, `app.js` — the app (no build step).
- `sw.js` — keeps the app on the tablet so it opens instantly and offline. **Release with `./bump.sh X.Y.Z`** (sets the version in `app.js`, `sw.js` and here, and checks no file got emptied).
- `demo.js` — sample data for `?demo`.
- `tests/run.js` — end-to-end tests: wall tablet (several screen sizes, day and night, idle timers, screensaver), phones (light and dark), computer, the family link against a fake Google script (wrong key, offline, old data), and the release files. Run `node tests/run.js` (needs Node and Playwright); `node tests/run.js phone` runs only the phone tests. Run them before every release.
- `Code.gs` (private, not in this repository) — Google side: calendars, sheets, votes, messages, voice notes by email, Cozi, Chef Luc. Released as versioned files in the script's Drive folder and run by the loader (see step 2). Its own tests ("script tests (gs.test.js).txt") are kept privately in the same folder: they hold family details.
