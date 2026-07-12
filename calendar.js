/* Vivi calendar module. Loaded after store.js. Exposes global `Calendar`. */
(function () {
  'use strict';

  var COLORS = ['#d96d8a', '#1f2a4a', '#c9a24b', '#7a9e7e', '#9a7aa0', '#b8653f'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ---------- date helpers (all LOCAL time, never new Date(string)) ----------

  function parseDate(str) {
    var p = str.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function toDateStr(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayStr() { return toDateStr(new Date()); }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(hhmm) {
    if (!hhmm) return '';
    var p = hhmm.split(':');
    var h = Number(p[0]);
    var m = Number(p[1]);
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + pad2(m) + ' ' + ampm;
  }

  // ---------- recurrence ----------

  function occursOn(event, dateStr) {
    if (!event || !event.date || !dateStr) return false;
    if (event.repeat === 'none' || !event.repeat) return event.date === dateStr;

    var start = parseDate(event.date);
    var day = parseDate(dateStr);
    if (day < start) return false;
    if (event.repeatUntil) {
      var until = parseDate(event.repeatUntil);
      if (day > until) return false;
    }

    switch (event.repeat) {
      case 'daily':
        return true;
      case 'weekly':
        return day.getDay() === start.getDay();
      case 'monthly':
        return day.getDate() === start.getDate();
      case 'yearly':
        return day.getMonth() === start.getMonth() && day.getDate() === start.getDate();
      default:
        return event.date === dateStr;
    }
  }

  function eventsOn(dateStr) {
    var events = (Store.get().events || []).filter(function (ev) {
      return occursOn(ev, dateStr);
    });
    events.sort(function (a, b) {
      var at = a.time, bt = b.time;
      if (!at && !bt) return (a.title || '').localeCompare(b.title || '');
      if (!at) return -1; // all-day first
      if (!bt) return 1;
      if (at !== bt) return at < bt ? -1 : 1;
      return (a.title || '').localeCompare(b.title || '');
    });
    return events;
  }

  // ---------- state ----------

  var viewYear, viewMonth;      // month view
  var selectedDay;              // day agenda, 'YYYY-MM-DD'
  var editingId = null;         // event id being edited, or null

  // ---------- month view ----------

  function renderMonth() {
    var grid = document.getElementById('cal-grid');
    var title = document.getElementById('cal-title');
    if (!grid) return;

    if (title) title.textContent = MONTHS[viewMonth] + ' ' + viewYear;

    var html = '';
    for (var i = 0; i < 7; i++) {
      html += '<div class="cal-dow">' + DOW[i] + '</div>';
    }

    var first = new Date(viewYear, viewMonth, 1);
    var gridStart = addDays(first, -first.getDay());
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    var weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
    var today = todayStr();

    for (var d = 0; d < weeks * 7; d++) {
      var cur = addDays(gridStart, d);
      var ds = toDateStr(cur);
      var cls = 'cal-cell';
      if (cur.getMonth() !== viewMonth) cls += ' is-other-month';
      if (ds === today) cls += ' is-today';

      var evs = eventsOn(ds);
      var cell = '<div class="' + cls + '" data-date="' + ds +
        '" tabindex="0" role="button" aria-label="Add event on ' + ds + '">' +
        '<span class="cal-daynum">' + cur.getDate() + '</span>';

      var overflow = evs.length > 3;
      for (var e = 0; e < evs.length; e++) {
        var ev = evs[e];
        var hidden = overflow && e >= 2;
        cell += '<button type="button" class="cal-event' + (hidden ? ' is-overflow' : '') +
          '" data-id="' + escapeHtml(ev.id) +
          '" style="--ev:' + escapeHtml(ev.color || COLORS[0]) + '">' +
          (ev.time ? '<span class="cal-event-time">' + formatTime(ev.time) + '</span> ' : '') +
          '<span class="cal-event-title">' + escapeHtml(ev.title) + '</span></button>';
      }
      if (overflow) {
        cell += '<button type="button" class="cal-more">+' + (evs.length - 2) + ' more</button>';
      }
      cell += '</div>';
      html += cell;
    }
    grid.innerHTML = html;
  }

  // ---------- day agenda ----------

  function renderDay() {
    var agenda = document.getElementById('day-agenda');
    var title = document.getElementById('day-title');
    if (!agenda) return;

    var d = parseDate(selectedDay);
    var label = WEEKDAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
    if (title) {
      title.textContent = selectedDay === todayStr() ? 'Today · ' + label : label;
    }

    var evs = eventsOn(selectedDay);
    if (evs.length === 0) {
      agenda.innerHTML = '<p class="agenda-empty">Nothing planned. Enjoy the quiet.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      var allday = !ev.time;
      var timeLabel = allday ? 'All day'
        : formatTime(ev.time) + (ev.endTime ? ' – ' + formatTime(ev.endTime) : '');
      html += '<button type="button" class="agenda-event' + (allday ? ' is-allday' : '') +
        '" data-id="' + escapeHtml(ev.id) +
        '" style="--ev:' + escapeHtml(ev.color || COLORS[0]) + '">' +
        '<span class="agenda-time">' + escapeHtml(timeLabel) + '</span>' +
        '<span class="agenda-title">' + escapeHtml(ev.title) + '</span>' +
        '</button>';
    }
    agenda.innerHTML = html;
  }

  function renderAll() {
    renderMonth();
    renderDay();
  }

  // ---------- editor dialog ----------

  function buildDialog() {
    var dlg = document.getElementById('event-dialog');
    if (!dlg) return;

    var swatches = '';
    for (var i = 0; i < COLORS.length; i++) {
      swatches += '<button type="button" class="color-swatch" data-color="' + COLORS[i] +
        '" style="--ev:' + COLORS[i] + '" aria-label="Color ' + COLORS[i] + '"></button>';
    }

    dlg.innerHTML =
      '<form method="dialog" class="event-form" id="event-form">' +
        '<h3 class="dialog-title" id="ed-heading">New event</h3>' +
        '<div class="field"><label for="ed-title">Title</label>' +
          '<input type="text" id="ed-title" required autocomplete="off"></div>' +
        '<div class="field"><label for="ed-date">Date</label>' +
          '<input type="date" id="ed-date" required></div>' +
        '<div class="field field-allday"><label>' +
          '<input type="checkbox" id="ed-allday"> All day</label></div>' +
        '<div class="field"><label for="ed-start">Start time</label>' +
          '<input type="time" id="ed-start"></div>' +
        '<div class="field"><label for="ed-end">End time</label>' +
          '<input type="time" id="ed-end"></div>' +
        '<div class="field"><label for="ed-repeat">Repeat</label>' +
          '<select id="ed-repeat">' +
            '<option value="none">Does not repeat</option>' +
            '<option value="daily">Daily</option>' +
            '<option value="weekly">Weekly</option>' +
            '<option value="monthly">Monthly</option>' +
            '<option value="yearly">Yearly</option>' +
          '</select></div>' +
        '<div class="field" id="ed-until-field" hidden><label for="ed-until">Repeat until</label>' +
          '<input type="date" id="ed-until"></div>' +
        '<div class="field"><label>Color</label>' +
          '<div class="color-swatches" id="ed-swatches">' + swatches + '</div></div>' +
        '<div class="field"><label for="ed-notes">Notes</label>' +
          '<textarea id="ed-notes" rows="3"></textarea></div>' +
        '<div class="dialog-actions">' +
          '<button type="button" class="btn-danger" id="ed-delete" hidden>Delete</button>' +
          '<button type="button" id="ed-cancel">Cancel</button>' +
          '<button type="submit" class="btn-primary" id="ed-save">Save</button>' +
        '</div>' +
      '</form>';

    // all-day toggle disables time inputs
    dlg.querySelector('#ed-allday').addEventListener('change', function () {
      var off = this.checked;
      dlg.querySelector('#ed-start').disabled = off;
      dlg.querySelector('#ed-end').disabled = off;
    });

    // repeat toggle shows until field
    dlg.querySelector('#ed-repeat').addEventListener('change', function () {
      dlg.querySelector('#ed-until-field').hidden = this.value === 'none';
    });

    // swatch picking
    dlg.querySelector('#ed-swatches').addEventListener('click', function (e) {
      var btn = e.target.closest('.color-swatch');
      if (!btn) return;
      selectSwatch(btn.getAttribute('data-color'));
    });

    dlg.querySelector('#ed-cancel').addEventListener('click', function () {
      dlg.close();
    });

    dlg.querySelector('#ed-delete').addEventListener('click', function () {
      if (editingId != null) Store.deleteEvent(editingId);
      dlg.close();
    });

    dlg.querySelector('#event-form').addEventListener('submit', function (e) {
      e.preventDefault();
      saveFromForm();
      dlg.close();
    });
  }

  function selectSwatch(color) {
    var sw = document.querySelectorAll('#event-dialog .color-swatch');
    for (var i = 0; i < sw.length; i++) {
      sw[i].classList.toggle('is-selected', sw[i].getAttribute('data-color') === color);
    }
  }

  function selectedColor() {
    var el = document.querySelector('#event-dialog .color-swatch.is-selected');
    return el ? el.getAttribute('data-color') : COLORS[0];
  }

  function openEditor(event, presetDateStr) {
    var dlg = document.getElementById('event-dialog');
    if (!dlg) return;

    editingId = event ? event.id : null;
    dlg.querySelector('#ed-heading').textContent = event ? 'Edit event' : 'New event';
    dlg.querySelector('#ed-delete').hidden = !event;

    var allday = event ? !event.time : true;
    dlg.querySelector('#ed-title').value = event ? (event.title || '') : '';
    dlg.querySelector('#ed-date').value = event ? event.date : (presetDateStr || todayStr());
    dlg.querySelector('#ed-allday').checked = allday;
    dlg.querySelector('#ed-start').value = event && event.time ? event.time : '';
    dlg.querySelector('#ed-end').value = event && event.endTime ? event.endTime : '';
    dlg.querySelector('#ed-start').disabled = allday;
    dlg.querySelector('#ed-end').disabled = allday;
    var repeat = event && event.repeat ? event.repeat : 'none';
    dlg.querySelector('#ed-repeat').value = repeat;
    dlg.querySelector('#ed-until-field').hidden = repeat === 'none';
    dlg.querySelector('#ed-until').value = event && event.repeatUntil ? event.repeatUntil : '';
    dlg.querySelector('#ed-notes').value = event ? (event.notes || '') : '';
    selectSwatch(event && event.color ? event.color : COLORS[0]);

    dlg.showModal();
    dlg.querySelector('#ed-title').focus();
  }

  function saveFromForm() {
    var dlg = document.getElementById('event-dialog');
    var allday = dlg.querySelector('#ed-allday').checked;
    var repeat = dlg.querySelector('#ed-repeat').value;
    var data = {
      title: dlg.querySelector('#ed-title').value.trim(),
      date: dlg.querySelector('#ed-date').value,
      time: allday ? null : (dlg.querySelector('#ed-start').value || null),
      endTime: allday ? null : (dlg.querySelector('#ed-end').value || null),
      repeat: repeat,
      repeatUntil: repeat === 'none' ? null : (dlg.querySelector('#ed-until').value || null),
      color: selectedColor(),
      notes: dlg.querySelector('#ed-notes').value.trim()
    };
    if (!data.title || !data.date) return;
    if (editingId != null) {
      Store.updateEvent(editingId, data);
    } else {
      Store.addEvent(data);
    }
  }

  // ---------- wiring ----------

  function findEvent(id) {
    var events = Store.get().events || [];
    for (var i = 0; i < events.length; i++) {
      if (String(events[i].id) === String(id)) return events[i];
    }
    return null;
  }

  function wireControls() {
    var on = function (id, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    on('cal-prev', function () {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      renderMonth();
    });
    on('cal-next', function () {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      renderMonth();
    });
    on('cal-today', function () {
      var now = new Date();
      viewYear = now.getFullYear();
      viewMonth = now.getMonth();
      renderMonth();
    });
    on('cal-add', function () {
      openEditor(null, todayStr());
    });

    on('day-prev', function () {
      selectedDay = toDateStr(addDays(parseDate(selectedDay), -1));
      renderDay();
    });
    on('day-next', function () {
      selectedDay = toDateStr(addDays(parseDate(selectedDay), 1));
      renderDay();
    });
    on('day-today', function () {
      selectedDay = todayStr();
      renderDay();
    });

    var grid = document.getElementById('cal-grid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var chip = e.target.closest('.cal-event');
        if (chip) {
          var ev = findEvent(chip.getAttribute('data-id'));
          if (ev) openEditor(ev);
          return;
        }
        var more = e.target.closest('.cal-more');
        if (more) {
          more.closest('.cal-cell').classList.toggle('is-expanded');
          return;
        }
        var cell = e.target.closest('.cal-cell');
        if (cell) openEditor(null, cell.getAttribute('data-date'));
      });
      grid.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var cell = e.target.closest('.cal-cell');
        if (cell && e.target === cell) {
          e.preventDefault();
          openEditor(null, cell.getAttribute('data-date'));
        }
      });
    }

    var agenda = document.getElementById('day-agenda');
    if (agenda) {
      agenda.addEventListener('click', function (e) {
        var row = e.target.closest('.agenda-event');
        if (!row) return;
        var ev = findEvent(row.getAttribute('data-id'));
        if (ev) openEditor(ev);
      });
    }
  }

  function init() {
    var now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selectedDay = todayStr();

    buildDialog();
    wireControls();
    Store.subscribe(renderAll);
    renderAll();
  }

  window.Calendar = {
    init: init,
    occursOn: occursOn,
    openEditor: openEditor
  };
})();
