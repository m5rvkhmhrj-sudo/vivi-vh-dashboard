# Vivi Memory — evolves every prompt

## 2026-07-13 — Vicki's review round
- Client = Vicki Heise. Change pink → Hermes orange (keep navy, keep classy). Add: weather for both homes (Amy Lane = Wheaton IL, Villa/Valle Vista = Indian Wells CA), Jeff's to-do list (she tracks it), Travel plans module (CA↔IL winters), Mark's care notes + contacts, Dad's hospice updates + contacts.
- She spelled it "Valle Vista" this time; original brief said "Villa Vista". Kept Villa Vista — flag to Bill to confirm.
- Bill: no API budget spend for her → weather via Open-Meteo (free, keyless). Build with sonnet/opus subagents, Fable minimal. Goal: on her computer (site is live at github.io/vivi, she installs from there).

## 2026-07-11 — kickoff
- Client wants 3-module dashboard: Home (Villa Vista + Amy Lane notepad todos + day calendar), Monthly Calendar (repeating events, yearly routines, synced to day view), Projects (button per project → own notepad todo list).
- Style: pink with navy accent, very feminine, very classy. Site name "Vivi" in cursive. ONLY cursive + Times New Roman fonts.
- Bill: use subagents to save usage, use his skills where useful, work autonomously ~4 hours, goal = ready to install on her computer.
- Decisions: vanilla JS PWA, localStorage, single event store so day/month calendars auto-sync. Folder ~/Desktop/vivi.

## Build log
- Core built via 3 parallel subagents (todos.js, calendar.js, styles.css) against contracts in store.js/index.html. All e2e flows verified headless: todos both pads, weekly + yearly recurrence (checked July 2027), day/month sync, project CRUD, reload persistence, no mobile overflow, no JS errors.
- Fixed: em-dash in agenda empty state (banned), [hidden] overridden by .field flex, uncolored swatches, giant native all-day checkbox, dialog overflow (max-height 88vh).
- Fonts: Great Vibes self-hosted (fonts/great-vibes.woff2) + Times New Roman only. Icons generated with PIL from GreatVibes ttf.
- Serve locally: python3 -m http.server (running on :8123 during dev). Install = Chrome address-bar install button.
- Test harness: /tmp/vivi-test/drive.js (playwright).
- Added: styled project-name dialog (replaced prompt()), footer backup export/import buttons, "Start Vivi.command" double-click launcher (port 8477).
- Verified: event edit + delete-all-occurrences, backup download, SW registered, manifest + icons fetch OK, mobile calendar clean.
- Cycle 2: chip title now in .cal-event-title span (ellipsis works); mobile chips hide time + dot, use 3px left color bar. Import restore verified, inline edit verified.
- Cycle 3: audit subagent found 10 issues; fixed all: AA contrast (new --rose-strong #b04a6a button bg, --rose-text #a84463 small text), importJSON list-merge guard, service worker network-first for html/js/css + cache bump v2, project cards restructured (div role=button, real menu button, stopPropagation), dialogs close on backdrop click, tabs get arrow keys + aria-controls + tabpanel roles, calendar cells keyboard-accessible, 44px hit-area expansion on check/delete/swatches. Regression green after all fixes.
- Cycle 4 (final): keyboard verified end to end (arrow-key tabs, Enter on calendar cell opens editor with date preset, Escape + backdrop-click close dialogs). Projects menu works. Loop stopped; app READY.
- Not done (needs Bill's call): hosting online (GitHub Pages/Vercel) so it can be installed on her PHONE. Local install on a computer works today via "Start Vivi.command". Cross-device sync would need Supabase later.
