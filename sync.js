/* Vivi cross-device sync — last-write-wins whole-blob sync against a
   Cloudflare Worker + KV (never pauses, free tier). Plain fetch only.
   Store (localStorage) stays the source of truth; sync is additive. */

var Sync = (() => {
  var WORKER_URL = 'https://vivi-sync.billenright.workers.dev/';
  var LS_SYNC_CODE = 'vivi-sync-code';
  var SYNC_ID = null; // set from localStorage or the pairing dialog; never in source

  function loadSyncCode() {
    try { SYNC_ID = localStorage.getItem(LS_SYNC_CODE); } catch { SYNC_ID = null; }
    return SYNC_ID;
  }

  function saveSyncCode(code) {
    SYNC_ID = code;
    try { localStorage.setItem(LS_SYNC_CODE, code); } catch {}
  }

  function askForCode() {
    if (document.getElementById('sync-code-dialog')) return;
    var dlg = document.createElement('dialog');
    dlg.id = 'sync-code-dialog';
    dlg.className = 'event-dialog';

    var form = document.createElement('form');
    form.method = 'dialog';
    form.className = 'event-form';

    var h = document.createElement('h3');
    h.className = 'dialog-title';
    h.textContent = 'Connect your devices';

    var p = document.createElement('p');
    p.textContent = 'Enter your family code to keep this device in sync. The same code goes on every device.';

    var field = document.createElement('div');
    field.className = 'field';
    var label = document.createElement('label');
    label.textContent = 'Family code';
    label.setAttribute('for', 'sync-code-input');
    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'sync-code-input';
    input.autocomplete = 'off';
    input.required = true;
    field.append(label, input);

    var actions = document.createElement('div');
    actions.className = 'dialog-actions';
    var later = document.createElement('button');
    later.type = 'button';
    later.textContent = 'Not now';
    later.addEventListener('click', function () { dlg.close(); });
    var save = document.createElement('button');
    save.type = 'submit';
    save.className = 'btn-primary';
    save.textContent = 'Connect';
    actions.append(later, save);

    form.append(h, p, field, actions);
    form.addEventListener('submit', function () {
      var code = (input.value || '').trim();
      if (/^vivi-[A-Za-z0-9_-]{24,}$/.test(code)) {
        saveSyncCode(code);
        pullNow();
        startLoops();
      }
    });

    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.showModal();
  }

  var LS_LAST_PUSH = 'vivi-sync-last-push';
  var LS_SERVER_TS = 'vivi-sync-server-ts';

  var POLL_MS = 20000;
  var DEBOUNCE_MS = 1500;

  var applying = false;
  var pulling = false;
  var pushTimer = null;
  var pendingPull = false;
  var initialized = false;
  var dotEl = null;

  function endpoint() {
    return WORKER_URL + '?id=' + encodeURIComponent(SYNC_ID);
  }

  function getServerTs() {
    try { return localStorage.getItem(LS_SERVER_TS); } catch { return null; }
  }
  function setServerTs(ts) {
    try { localStorage.setItem(LS_SERVER_TS, ts); } catch {}
  }
  function setLastPush(ts) {
    try { localStorage.setItem(LS_LAST_PUSH, ts); } catch {}
  }

  var lastKeyAt = 0;
  document.addEventListener('keydown', function () { lastKeyAt = Date.now(); }, true);

  function isTypingFocus() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    var editable = tag === 'input' || tag === 'textarea' || el.isContentEditable === true;
    if (!editable) return false;
    // only defer a pull if there is an unsent draft or very recent typing
    var hasDraft = (tag === 'input' || tag === 'textarea') && (el.value || '').trim() !== '';
    var recentKeys = Date.now() - lastKeyAt < 3000;
    return hasDraft || recentKeys;
  }

  function ensureDot() {
    if (dotEl && document.body.contains(dotEl)) return dotEl;
    var footer = document.querySelector('.footer');
    if (!footer) return null;
    var existing = document.getElementById('sync-dot');
    if (existing) { dotEl = existing; return dotEl; }
    var span = document.createElement('span');
    span.id = 'sync-dot';
    span.className = 'sync-status';
    footer.appendChild(span);
    dotEl = span;
    return dotEl;
  }

  function setStatus(state) {
    var el = ensureDot();
    if (!el) return;
    var text = state === 'synced' ? 'Synced'
      : state === 'syncing' ? 'Syncing…'
      : 'Offline';
    el.textContent = text;
    el.className = 'sync-status sync-status--' + state;
  }

  function workerGet() {
    return fetch(endpoint(), { method: 'GET' }).then(function (res) {
      if (!res.ok) throw new Error('sync get failed: ' + res.status);
      return res.json(); // null, or { data, updated_at }
    });
  }

  function workerPut(payload) {
    return fetch(endpoint(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) throw new Error('sync put failed: ' + res.status);
      return res.json(); // { updated_at }
    });
  }

  function pushNow() {
    if (!SYNC_ID) return Promise.resolve();
    setStatus('syncing');
    var payload = Store.get();
    return workerPut(payload)
      .then(function (result) {
        var ts = result && result.updated_at;
        if (ts) {
          setLastPush(ts);
          setServerTs(ts);
        }
        setStatus('synced');
      })
      .catch(function () {
        setStatus('offline');
      });
  }

  function applyServerData(serverData) {
    applying = true;
    try {
      Store.importJSON(JSON.stringify(serverData));
    } catch {
      /* invalid payload from server, skip */
    } finally {
      applying = false;
    }
  }

  function pullNow() {
    if (!SYNC_ID || pulling) return Promise.resolve();
    pulling = true;
    setStatus('syncing');
    return workerGet()
      .then(function (row) {
        if (!row || !row.data) {
          // no server row yet — push local up to seed it
          pulling = false;
          return pushNow();
        }
        var serverTs = row.updated_at;
        var serverData = row.data;
        var knownTs = getServerTs();

        if (serverTs && serverTs === knownTs) {
          pulling = false;
          setStatus('synced');
          return;
        }

        var localJSON = JSON.stringify(Store.get());
        var serverJSON = JSON.stringify(serverData);

        if (localJSON === serverJSON) {
          if (serverTs) setServerTs(serverTs);
          pulling = false;
          setStatus('synced');
          return;
        }

        if (isTypingFocus()) {
          pendingPull = true;
          pulling = false;
          setStatus('synced');
          return;
        }

        applyServerData(serverData);
        if (serverTs) setServerTs(serverTs);
        pendingPull = false;
        pulling = false;
        setStatus('synced');
      })
      .catch(function () {
        pulling = false;
        setStatus('offline');
      });
  }

  function schedulePush() {
    if (applying) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      pushNow();
    }, DEBOUNCE_MS);
  }

  function pollTick() {
    if (pendingPull && isTypingFocus()) return; // still typing, wait
    pullNow();
  }

  var loopsStarted = false;

  function startLoops() {
    if (loopsStarted) return;
    loopsStarted = true;

    Store.subscribe(function () {
      if (applying) return;
      schedulePush();
    });

    setInterval(pollTick, POLL_MS);

    window.addEventListener('focus', function () { pollTick(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') pollTick();
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;

    ensureDot();

    if (!loadSyncCode()) {
      setStatus('offline');
      askForCode();
      return; // app works locally; sync starts once a code is entered
    }

    setStatus('syncing');
    pullNow();
    startLoops();
  }

  return { init: init, pushNow: pushNow, pullNow: pullNow };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      Sync.init();
    });
  } else {
    Sync.init();
  }
}
