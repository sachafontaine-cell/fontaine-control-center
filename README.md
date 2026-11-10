# Fontaine Control Center

Family wall tablet (Android, Fully Kiosk Browser). Plain HTML/CSS/JS on GitHub Pages.
**No family data lives in this public repository**: names, events, contacts and settings come from a private Google Apps Script that is not stored here. `?demo` shows a made-up family.

- **See it now with sample data:** https://sachafontaine-cell.github.io/fontaine-control-center/?demo
- **Version / update:** the small `v0.1.1 ↻` at the bottom right checks for an update right away. The tablet also checks by itself when someone walks up and every 30 minutes, and applies new versions on the home screen.

## One-time setup

### 1. Turn on GitHub Pages (1 min)
Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)` → Save**.
The app is then at `https://sachafontaine-cell.github.io/fontaine-control-center/`.

### 2. Google script (10 min) — signed in with the account that sees the family calendars
1. Go to <https://script.google.com> → **New project**. Name it "Fontaine Control Center".
2. Replace the editor's content with the private `Code.gs` file (kept out of this repository on purpose).
3. **Project Settings** (gear) → time zone **(GMT-08:00) Los Angeles**.
4. Back in the editor, pick **setup** in the function list and click **Run**. Approve the permissions (Calendar, Sheets, Slides, Gmail send, Maps).
5. Open **Execution log**: copy the **KEY** line. setup() also created a Sheet "Fontaine Control Center — données" in your Drive.
6. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy and copy the **Web app URL** (ends in `/exec`).

### 3. The family link
Build this link (keep it private — it opens the family data):

```
https://sachafontaine-cell.github.io/fontaine-control-center/?k=KEY
```

(The script address is already in `config.js`.) Open it once on the tablet and on each parent's phone; it's remembered after that.

### 4. Tablet (Fully Kiosk Browser, PLUS license)
- **Start URL:** the family link above.
- **Kiosk mode:** on.
- **Screen off timer:** 60 s.
- **Motion detection** (front camera): on — the app turns it off 20:30–7:00 by itself.
- **Scheduled sleep / wake up:** sleep 22:00, wake 5:45.
- **Web content settings:** enable microphone access (voice notes).
- **Advanced web settings:** enable the JavaScript interface (lets the app switch motion detection at night).
- **Screen brightness:** low (less heat).
- Settings → Battery: turn on a charge limit if the tablet offers one.

## Where to change what (one place each)
| Thing | Change it in |
|---|---|
| Events | Family Google Calendar |
| Chores, points, rewards | "Tâches & Récompenses" sheet |
| House rules | "Règles de la maison" slides |
| Contacts, recipes, settings, school days off | "Fontaine Control Center — données" sheet |
| Dinner | Repas screen (votes for next week; the cook swaps this week's dish) |
| Messages to the kids | the family link on a parent's phone |

Votes close every **Thursday at 19:00**: the top dishes become next week's menu and next week's options appear.

## Files
- `index.html`, `app.css`, `app.js` — the app (no build step).
- `sw.js` — keeps the app on the tablet so it opens instantly and offline. **Bump `VERSION` in both `sw.js` and `app.js` on every release.**
- `demo.js` — sample data for `?demo`.
- `Code.gs` (private, not in this repository) — Google side: calendars, sheets, votes, messages, voice notes by email.
