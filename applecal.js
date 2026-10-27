/* Vivi Apple Calendar feed — reads a PUBLIC iCloud calendar link (webcal://…)
   through the vivi-sync worker's /ics route (CORS). Read-only layer: events
   render on the calendar but are never written to the Store. The link itself
   lives in the Store (synced); the feed is fetched and cached per device. */

var AppleCal = (function () {
  'use strict';

  var ICS_ENDPOINT = 'https://vivi-sync.billenright.workers.dev/ics';
  var CACHE_KEY = 'vivi-applecal-v1';
  var STALE_MS = 30 * 60 * 1000; // refetch on open if older than 30 min

  var cache = loadCache();
  var status = '';        // '', 'loading', 'ok', 'error'
  var knownUrl = null;    // last Store.appleCalUrl we fetched for
  var listeners = [];

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || { events: [], fetchedAt: null }; }
    catch (e) { return { events: [], fetchedAt: null }; }
  }
  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
  }

  function notify() {
    listeners.forEach(function (fn) { fn(); });
  }

  /* ---------- ICS parsing (small, local-time, simple repeats) ---------- */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toDateStr(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  // 20261101 | 20261101T090000 | 20261101T090000Z -> {dt, allDay}
  function parseStamp(val) {
    var m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
    if (!m) return null;
    if (m[4] == null) return { dt: new Date(+m[1], m[2] - 1, +m[3]), allDay: true };
    if (m[7]) return { dt: new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])), allDay: false };
    return { dt: new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]), allDay: false }; // TZID: wall time
  }

  function expandOccurrences(ev, winStart, winEnd) {
    if (!ev.rrule) {
      return (ev.start >= winStart && ev.start < winEnd) ? [ev.start] : [];
    }
    var rule = {};
    ev.rrule.split(';').forEach(function (p) {
      var kv = p.split('=');
      rule[kv[0]] = kv[1];
    });
    var freq = rule.FREQ;
    var interval = Math.max(1, parseInt(rule.INTERVAL || '1', 10));
    var until = winEnd;
    if (rule.UNTIL) {
      var m = rule.UNTIL.match(/^(\d{4})(\d{2})(\d{2})/);
      if (m) {
        var u = new Date(+m[1], m[2] - 1, +m[3], 23, 59);
        if (u < until) until = u;
      }
    }
    var count = rule.COUNT ? parseInt(rule.COUNT, 10) : Infinity;
    var occs = [];
    var dt = new Date(ev.start);
    var n = 0, guard = 0;
    while (dt <= until && n < count && guard++ < 20000) {
      if (dt >= winStart && dt < winEnd) occs.push(new Date(dt));
      n++;
      if (freq === 'DAILY') dt = addDays(dt, interval);
      else if (freq === 'WEEKLY') dt = addDays(dt, 7 * interval);
      else if (freq === 'MONTHLY') dt = new Date(dt.getFullYear(), dt.getMonth() + interval, dt.getDate(), dt.getHours(), dt.getMinutes());
      else if (freq === 'YEARLY') dt = new Date(dt.getFullYear() + interval, dt.getMonth(), dt.getDate(), dt.getHours(), dt.getMinutes());
      else break;
      if (occs.length > 500) break;
    }
    return occs;
  }

  function parseICS(text) {
    var lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
    var today = new Date();
    var winStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    var winEnd = new Date(today.getFullYear(), today.getMonth() + 18, 1);
    var out = [];
    var ev = null;

    function cleanText(v) {
      return v.replace(/\\([,;nN])/g, function (_, c) {
        return c.toLowerCase() === 'n' ? ' ' : c;
      }).trim();
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line === 'BEGIN:VEVENT') { ev = { exdates: {} }; continue; }
      if (line === 'END:VEVENT') {
        if (ev && ev.start && ev.title) {
          var durMs = (ev.end && !ev.allDay) ? (ev.end - ev.start) : 0;
          expandOccurrences(ev, winStart, winEnd).forEach(function (dt) {
            var ds = toDateStr(dt);
            if (ev.exdates[ds]) return;
            var endHHMM = null;
            if (durMs > 0 && durMs < 24 * 3600 * 1000) {
              var endDt = new Date(dt.getTime() + durMs);
              if (toDateStr(endDt) === ds) endHHMM = pad2(endDt.getHours()) + ':' + pad2(endDt.getMinutes());
            }
            out.push({
              date: ds,
              time: ev.allDay ? null : pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()),
              endTime: endHHMM,
              title: ev.title,
            });
          });
        }
        ev = null; continue;
      }
      if (!ev) continue;
      var ci = line.indexOf(':');
      if (ci < 0) continue;
      var left = line.slice(0, ci);
      var val = line.slice(ci + 1);
      var name = left.split(';')[0].replace(/^item\d+\./i, '').toUpperCase();
      if (name === 'SUMMARY') ev.title = cleanText(val);
      else if (name === 'DTSTART') {
        var p = parseStamp(val);
        if (p) { ev.start = p.dt; ev.allDay = p.allDay; }
      } else if (name === 'DTEND') {
        var pe = parseStamp(val);
        if (pe) ev.end = pe.dt;
      } else if (name === 'RRULE') ev.rrule = val;
      else if (name === 'EXDATE') {
        val.split(',').forEach(function (v) {
          var px = parseStamp(v);
          if (px) ev.exdates[toDateStr(px.dt)] = true;
        });
      }
    }
    return out;
  }

  /* ---------- fetching ---------- */

  function currentUrl() {
    return (typeof Store !== 'undefined' && Store.get().appleCalUrl) || null;
  }

  function refresh() {
    var url = currentUrl();
    if (!url) return Promise.resolve();
    status = 'loading';
    notify();
    return fetch(ICS_ENDPOINT + '?url=' + encodeURIComponent(url))
      .then(function (res) {
        if (!res.ok) throw new Error('ics ' + res.status);
        return res.text();
      })
      .then(function (text) {
        cache = { events: parseICS(text), fetchedAt: Date.now() };
        saveCache();
        status = 'ok';
        notify();
      })
      .catch(function () {
        status = 'error';
        notify();
      });
  }

  function disconnect() {
    Store.setAppleCalUrl(null);
    cache = { events: [], fetchedAt: null };
    saveCache();
    status = '';
    notify();
  }

  /* ---------- public ---------- */

  function eventsOn(dateStr) {
    if (!currentUrl()) return [];
    return cache.events.filter(function (e) { return e.date === dateStr; });
  }

  function init() {
    knownUrl = currentUrl();
    if (knownUrl && (!cache.fetchedAt || Date.now() - cache.fetchedAt > STALE_MS)) {
      refresh();
    }
    // the link syncs between her devices through the Store: when it appears
    // or changes on this device, fetch the feed here too
    if (typeof Store !== 'undefined') {
      Store.subscribe(function () {
        var url = currentUrl();
        if (url !== knownUrl) {
          knownUrl = url;
          if (url) refresh(); else { cache = { events: [], fetchedAt: null }; saveCache(); notify(); }
        }
      });
    }
  }

  return {
    init: init,
    refresh: refresh,
    disconnect: disconnect,
    eventsOn: eventsOn,
    onChange: function (fn) { listeners.push(fn); },
    getStatus: function () { return status; },
    getInfo: function () {
      return { connected: !!currentUrl(), count: cache.events.length, fetchedAt: cache.fetchedAt };
    },
  };
})();
