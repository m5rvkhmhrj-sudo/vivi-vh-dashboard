/* Vivi data layer — single source of truth in localStorage.
   All modules read/write through Store; subscribers re-render on change. */

const Store = (() => {
  const KEY = 'vivi-data-v1';

  const defaults = () => ({
    lists: {
      'villa-vista': { id: 'villa-vista', name: 'Villa Vista', items: [] },
      'amy-lane':    { id: 'amy-lane',    name: 'Amy Lane',    items: [] },
    },
    projects: [],   // [{id, name}] — each project's todos live in lists[id]
    events: [],     // [{id, title, date:'YYYY-MM-DD', time:'HH:MM'|null, endTime, color,
                    //   notes, repeat:'none'|'daily'|'weekly'|'monthly'|'yearly', repeatUntil:'YYYY-MM-DD'|null}]
  });

  let data = load();
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      return { ...defaults(), ...parsed, lists: { ...defaults().lists, ...parsed.lists } };
    } catch { return defaults(); }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
    listeners.forEach(fn => fn(data));
  }

  const uid = () => 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  return {
    get: () => data,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    uid,

    /* ---- todo lists (homes + projects share this) ---- */
    getList: id => data.lists[id],
    addItem(listId, text) {
      if (!text.trim()) return;
      data.lists[listId].items.push({ id: uid(), text: text.trim(), done: false });
      save();
    },
    toggleItem(listId, itemId) {
      const it = data.lists[listId].items.find(i => i.id === itemId);
      if (it) { it.done = !it.done; save(); }
    },
    editItem(listId, itemId, text) {
      const it = data.lists[listId].items.find(i => i.id === itemId);
      if (it) { it.text = text.trim(); save(); }
    },
    deleteItem(listId, itemId) {
      const l = data.lists[listId];
      l.items = l.items.filter(i => i.id !== itemId);
      save();
    },
    clearDone(listId) {
      const l = data.lists[listId];
      l.items = l.items.filter(i => !i.done);
      save();
    },
    reorderItem(listId, fromIdx, toIdx) {
      const items = data.lists[listId].items;
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      save();
    },

    /* ---- projects ---- */
    addProject(name) {
      if (!name.trim()) return null;
      const id = uid();
      data.projects.push({ id, name: name.trim() });
      data.lists[id] = { id, name: name.trim(), items: [] };
      save();
      return id;
    },
    renameProject(id, name) {
      const p = data.projects.find(p => p.id === id);
      if (p) { p.name = name.trim(); data.lists[id].name = name.trim(); save(); }
    },
    deleteProject(id) {
      data.projects = data.projects.filter(p => p.id !== id);
      delete data.lists[id];
      save();
    },

    /* ---- events ---- */
    addEvent(ev) { data.events.push({ id: uid(), ...ev }); save(); },
    updateEvent(id, patch) {
      const ev = data.events.find(e => e.id === id);
      if (ev) { Object.assign(ev, patch); save(); }
    },
    deleteEvent(id) { data.events = data.events.filter(e => e.id !== id); save(); },

    /* ---- backup ---- */
    exportJSON: () => JSON.stringify(data, null, 2),
    importJSON(json) {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || !parsed.lists) {
        throw new Error('not a Vivi backup');
      }
      data = { ...defaults(), ...parsed, lists: { ...defaults().lists, ...parsed.lists } };
      save();
    },
  };
})();
