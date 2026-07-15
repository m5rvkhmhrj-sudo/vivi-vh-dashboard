# Vivi Memory — evolves every prompt

## 2026-07-15 — cross-device sync, install day
- Vicki approved; Bill installing on her Dell + phone today. Needs synced data both devices.
- Bill worried about Supabase free-tier pausing → switched to Cloudflare Worker + KV (never pauses). Worker "vivi-sync" at https://vivi-sync.billenright.workers.dev, code at ~/Desktop/vivi-sync-worker, KV namespace VIVI (89c4e1a3912c4b9f9b478a5d8169ad08), account 5ae33cb572f3511d40b10b4ab37b7594, workers.dev subdomain "billenright" registered. Supabase path abandoned (sql file deleted, no table created).
- Sync design: whole-blob last-write-wins keyed by secret id vivi-wkk2hKE73YmvDVmNf3pUJDdSbf3vPWtl (in sync.js). Push debounced 1.5s; pull on load/focus/20s poll. Pull deferred only while unsent draft or keystroke <3s (first version deferred on any focused input — blocked forever because notepad add-box keeps focus; fixed). Offline = app keeps working locally.
- Verified two separate browser contexts: todos both directions + calendar event sync. Server KV wiped to clean defaults before install. sw v11. LIVE.

## 2026-07-14 — final tweaks
- Care contacts now have Email field (mailto link in row); "Dad's Hospice" renamed "Dad's Care". sw v8, live. Verified add/persist/reload + mailto href.
- Added Jeff's Care section (Notes + Contacts, same format) between Mark and Dad. store care.jeff + mergeCare updated so existing saves migrate cleanly. notes.js needed no changes (generic over .care-section). sw v9, live. Verified: old data intact, jeff notes + contact persist.

## 2026-07-14 — exact orange
- Wordmark: Bill asked for "Memphis bold". Memphis = paid Linotype font, not embeddable on public site + not installed locally. Shipped Rokkitt Bold (free geometric slab, closest match) self-hosted, with 'Memphis','Memphis LT Std' first in the stack so real Memphis renders wherever installed. Wordmark no longer cursive; pad titles/headings still Great Vibes. sw v7.
- Round 2: Bill wants #ed7933 on ALL elements incl buttons. Buttons + active tab now bg #ed7933 with NAVY text (4.96:1 AA; white on it fails at 2.8). Hover = lift + shadow, not color change. --rose-strong no longer used on surfaces. sw cache v6, live.
- Bill supplied a swatch; sampled #ed7933 as THE Hermes orange. --rose #ed7933, --rose-deep #d05f15; kept --rose-strong #b3540d / --rose-text #9c4a0d where white/small text needs AA (#ed7933 itself is only 2.8:1). Icons regenerated, sw cache v5, pushed.

## 2026-07-13 — Vicki's review round
- Client = Vicki Heise. Change pink → Hermes orange (keep navy, keep classy). Add: weather for both homes (Amy Lane = Wheaton IL, Villa/Valle Vista = Indian Wells CA), Jeff's to-do list (she tracks it), Travel plans module (CA↔IL winters), Mark's care notes + contacts, Dad's hospice updates + contacts.
- Bill confirmed: it is "Valle Vista". Renamed everywhere 2026-07-13 (display strings + weather label; list id stays 'villa-vista' for saved-data compat; load() migration forces the new name onto existing saves). sw cache → vivi-v4.
- Bill: no API budget spend for her → weather via Open-Meteo (free, keyless). Build with sonnet/opus subagents, Fable minimal. Goal: on her computer (site is live at github.io/vivi, she installs from there).
- Shipped 2026-07-13: 4 sonnet builders (palette #e8641b Hermes orange AA-checked, store v2 w/ care/travel/jeff + deep merges, weather.js Open-Meteo 30-min cache, notes.js debounced autosave + contacts) + opus verifier (28/28 pass, both viewports). Fable only did: index.html shell, 2 Notepad.mount lines, mobile tab-overflow CSS fix. Fixed mobile tab clipping (.tabs overflow-x auto). Screenshot lesson: wait for document.fonts.ready before judging typography.
- sw cache now vivi-v3; pushed to GitHub Pages same day.

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
