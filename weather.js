// Vivi weather strip. Vanilla JS. No libs, no keys. Open-Meteo.
var Weather = (function () {
  var LOCATIONS = [
    { key: 'villa-vista', place: 'Valle Vista · Indian Wells, CA', lat: 33.7176, lon: -116.3409 },
    { key: 'amy-lane', place: 'Amy Lane · Wheaton, IL', lat: 41.8661, lon: -88.1070 }
  ];

  var CACHE_KEY = 'vivi-weather';
  var MAX_AGE_MS = 30 * 60 * 1000;
  var initialized = false;
  var timerId = null;

  function codeToText(code) {
    if (code === 0) return 'Clear';
    if (code === 1 || code === 2) return code === 1 ? 'Mostly sunny' : 'Partly cloudy';
    if (code === 3) return 'Cloudy';
    if (code === 45 || code === 48) return 'Foggy';
    if (code >= 51 && code <= 57) return 'Drizzle';
    if (code >= 61 && code <= 67) return 'Rain';
    if (code >= 71 && code <= 77) return 'Snow';
    if (code >= 80 && code <= 82) return 'Showers';
    if (code >= 95 && code <= 99) return 'Thunderstorms';
    return 'Mild';
  }

  function readCache() {
    try {
      var raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeCache(cache) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      // ignore storage failures (private mode, quota, etc)
    }
  }

  function buildUrl(loc) {
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat +
      '&longitude=' + loc.lon +
      '&current=temperature_2m,weather_code' +
      '&daily=temperature_2m_max,temperature_2m_min' +
      '&temperature_unit=fahrenheit&timezone=auto';
  }

  function extractPayload(json) {
    var current = json && json.current ? json.current : {};
    var daily = json && json.daily ? json.daily : {};
    var hi = daily.temperature_2m_max && daily.temperature_2m_max.length ? daily.temperature_2m_max[0] : null;
    var lo = daily.temperature_2m_min && daily.temperature_2m_min.length ? daily.temperature_2m_min[0] : null;
    return {
      temp: typeof current.temperature_2m === 'number' ? Math.round(current.temperature_2m) : null,
      code: typeof current.weather_code === 'number' ? current.weather_code : null,
      hi: typeof hi === 'number' ? Math.round(hi) : null,
      lo: typeof lo === 'number' ? Math.round(lo) : null
    };
  }

  function makeCard(loc, data) {
    var card = document.createElement('div');
    card.className = 'weather-card';

    var placeEl = document.createElement('span');
    placeEl.className = 'weather-place';
    placeEl.textContent = loc.place;
    card.appendChild(placeEl);

    if (!data || data.temp === null) {
      var desc = document.createElement('span');
      desc.className = 'weather-desc';
      desc.textContent = 'Weather unavailable';
      card.appendChild(desc);
      return card;
    }

    var tempEl = document.createElement('span');
    tempEl.className = 'weather-temp';
    tempEl.textContent = data.temp + '°';
    card.appendChild(tempEl);

    var descEl = document.createElement('span');
    descEl.className = 'weather-desc';
    descEl.textContent = codeToText(data.code);
    card.appendChild(descEl);

    if (data.hi !== null && data.lo !== null) {
      var hilo = document.createElement('span');
      hilo.className = 'weather-hilo';
      hilo.textContent = 'H ' + data.hi + '° · L ' + data.lo + '°';
      card.appendChild(hilo);
    }

    return card;
  }

  function render(strip, cache) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < LOCATIONS.length; i++) {
      var loc = LOCATIONS[i];
      var entry = cache[loc.key];
      var data = entry ? entry.data : null;
      frag.appendChild(makeCard(loc, data));
    }
    strip.textContent = '';
    strip.appendChild(frag);
  }

  function fetchLocation(loc) {
    return fetch(buildUrl(loc))
      .then(function (resp) {
        if (!resp.ok) throw new Error('bad response');
        return resp.json();
      })
      .then(function (json) {
        return { key: loc.key, data: extractPayload(json) };
      })
      .catch(function () {
        return null;
      });
  }

  function refresh(strip) {
    var results = [];
    for (var i = 0; i < LOCATIONS.length; i++) {
      results.push(fetchLocation(LOCATIONS[i]));
    }
    Promise.all(results).then(function (list) {
      var cache = readCache();
      var now = Date.now();
      var changed = false;
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (item && item.data && item.data.temp !== null) {
          cache[item.key] = { data: item.data, ts: now };
          changed = true;
        }
      }
      if (changed) writeCache(cache);
      render(strip, cache);
    }).catch(function () {
      // never throw; leave whatever is currently rendered
    });
  }

  function init() {
    var strip = document.getElementById('weather-strip');
    if (!strip) return;
    if (initialized) return;
    initialized = true;

    var cache = readCache();
    var now = Date.now();
    var hasFreshCache = false;
    var hasAnyCache = false;

    for (var i = 0; i < LOCATIONS.length; i++) {
      var entry = cache[LOCATIONS[i].key];
      if (entry) {
        hasAnyCache = true;
        if (now - entry.ts < MAX_AGE_MS) hasFreshCache = true;
      }
    }

    if (hasAnyCache) {
      render(strip, cache);
    }

    if (!hasFreshCache) {
      refresh(strip);
    }

    if (timerId === null) {
      timerId = setInterval(function () {
        refresh(strip);
      }, MAX_AGE_MS);
    }
  }

  return { init: init };
})();

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('weather-strip')) {
      Weather.init();
    }
  });
}
