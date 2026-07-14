/* Vivi data layer — single source of truth in localStorage.
   All modules read/write through Store; subscribers re-render on change. */

const Store = (() => {
  const KEY = 'vivi-data-v1';

  const defaults = () => ({
    lists: {
      'villa-vista': { id: 'villa-vista', name: 'Valle Vista', items: [] },
      'amy-lane':    { id: 'amy-lane',    name: 'Amy Lane',    items: [] },
      'jeff':        { id: 'jeff',        name: "Jeff's List", items: [] },
      'travel':      { id: 'travel',      name: 'Travel Plans', items: [] },
    },
    projects: [],   // [{id, name}] — each project's todos live in lists[id]
    events: [],     // [{id, title, date:'YYYY-MM-DD', time:'HH:MM'|null, endTime, color,
                    //   notes, repeat:'none'|'daily'|'weekly'|'monthly'|'yearly', repeatUntil:'YYYY-MM-DD'|null}]
    travelNotes: '',
    care: {
      mark: { notes: '', contacts: [] },
      dad:  { notes: '', contacts: [] },
    },
  });

  const mergeCare = (defCare, parsedCare) => ({
    mark: { ...defCare.mark, ...(parsedCare && parsedCare.mark) },
    dad:  { ...defCare.dad,  ...(parsedCare && parsedCare.dad)  },
  });

  let data = load();
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      const def = defaults();
      const merged = {
        ...def,
        ...parsed,
        lists: { ...def.lists, ...parsed.lists },
        care: mergeCare(def.care, parsed.care),
      };
      // migration: home renamed Villa Vista -> Valle Vista (2026-07-13)
      if (merged.lists['villa-vista']) merged.lists['villa-vista'].name = 'Valle Vista';
      return merged;
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

    /* ---- travel notes ---- */
    setTravelNotes(text) { data.travelNotes = text; save(); },

    /* ---- care (Mark / Dad) ---- */
    setCareNotes(person, text) { data.care[person].notes = text; save(); },
    addContact(person, { name, role, phone, email } = {}) {
      const n = (name || '').trim();
      if (!n) return;
      data.care[person].contacts.push({
        id: uid(),
        name: n,
        role: (role || '').trim(),
        phone: (phone || '').trim(),
        email: (email || '').trim(),
      });
      save();
    },
    deleteContact(person, id) {
      const c = data.care[person];
      c.contacts = c.contacts.filter(x => x.id !== id);
      save();
    },

    /* ---- backup ---- */
    exportJSON: () => JSON.stringify(data, null, 2),
    importJSON(json) {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || !parsed.lists) {
        throw new Error('not a Vivi backup');
      }
      const def = defaults();
      data = {
        ...def,
        ...parsed,
        lists: { ...def.lists, ...parsed.lists },
        care: mergeCare(def.care, parsed.care),
      };
      save();
    },
  };
})();
