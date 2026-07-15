/* Vivi cross-device sync — last-write-wins whole-blob sync against Supabase
   via PostgREST rpc endpoints. No supabase-js, plain fetch only.
   Store (localStorage) stays the source of truth; sync is additive. */

var Sync = (() => {
  var SUPABASE_URL = 'https://dtdrnrklarwtplfsbskp.supabase.co';
  var SUPABASE_KEY = 'sb_publishable__VwLgxHY7HvH1k8aiG_Uig_Sr-Os1c7';
  var SYNC_ID = 'vivi-wkk2hKE73YmvDVmNf3pUJDdSbf3vPWtl';

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

  function headers() {
    return {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
    };
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

  function isTypingFocus() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    return tag === 'input' || tag === 'textarea' || el.isContentEditable === true;
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

  function rpc(fn, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    }).then(function (res) {
      if (!res.ok) throw new Error('rpc ' + fn + ' failed: ' + res.status);
      return res.json();
    });
  }

  function pushNow() {
    setStatus('syncing');
    var payload = Store.get();
    return rpc('vivi_put', { sync_id: SYNC_ID, payload: payload })
      .then(function (updatedAt) {
        var ts = typeof updatedAt === 'string' ? updatedAt : (updatedAt && updatedAt.updated_at);
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
    if (pulling) return Promise.resolve();
    pulling = true;
    setStatus('syncing');
    return rpc('vivi_get', { sync_id: SYNC_ID })
      .then(function (rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
          // no server row yet — push local up to seed it
          pulling = false;
          return pushNow();
        }
        var row = rows[0];
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

  function init() {
    if (initialized) return;
    initialized = true;

    ensureDot();
    setStatus('syncing');

    Store.subscribe(function () {
      if (applying) return;
      schedulePush();
    });

    pullNow();

    setInterval(pollTick, POLL_MS);

    window.addEventListener('focus', function () { pollTick(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') pollTick();
    });
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
