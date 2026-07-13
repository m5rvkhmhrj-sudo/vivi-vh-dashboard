# Vivi — Productivity Dashboard

Client: coworker of Bill. Personal productivity dashboard, phone + computer (installable PWA).

## Memory rule (IMPORTANT)
Read `MEMORY.md` at start of every session. After EVERY user prompt in this project, update `MEMORY.md` with any decision, preference, or instruction Bill gives, and apply those going forward. MEMORY.md is the evolving source of truth for this project.

## Product
Three modules, single-page app:
1. **Home** — two notepad todo lists ("Valle Vista" CA, "Amy Lane" IL) + day calendar synced to monthly calendar.
2. **Calendar** — monthly calendar, repeating events (daily/weekly/monthly/yearly), full CRUD. Same event store as day calendar.
3. **Projects** — buttons per project, each opens its own notepad todo list.

## Style (locked)
- Pink primary, navy accent. Feminine, classy.
- Fonts: cursive script + Times New Roman ONLY. "Vivi" header in cursive.
- Notepad aesthetic for all todo lists (lined paper).

## Tech
- Vanilla HTML/CSS/JS, no build step. localStorage. PWA (manifest.json + sw.js).
- Open `index.html` in browser, or serve with `python3 -m http.server` for service worker testing.
