/* Vivi app glue — tabs, home pads, projects module, PWA registration. */

(() => {
  /* ---- tabs ---- */
  const tabs = document.querySelectorAll('.tab');
  const modules = document.querySelectorAll('.module');
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-controls', 'module-' + tab.dataset.module);
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      next.click();
    });
  });
  modules.forEach(m => m.setAttribute('role', 'tabpanel'));
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    });
    modules.forEach(m => m.classList.toggle('is-active', m.id === 'module-' + tab.dataset.module));
  }));

  /* ---- home pads ---- */
  Notepad.mount(document.getElementById('pad-villa-vista'), 'villa-vista');
  Notepad.mount(document.getElementById('pad-amy-lane'), 'amy-lane');
  Notepad.mount(document.getElementById('pad-jeff'), 'jeff');
  Notepad.mount(document.getElementById('pad-travel'), 'travel');

  /* ---- calendar ---- */
  Calendar.init();

  /* ---- projects ---- */
  const grid = document.getElementById('projects-grid');
  const indexView = document.getElementById('projects-index');
  const detailView = document.getElementById('project-detail');
  const padSlot = document.getElementById('project-pad');
  let openMenu = null;

  function closeMenu() {
    if (openMenu) { openMenu.remove(); openMenu = null; }
  }
  document.addEventListener('click', e => {
    if (openMenu && !openMenu.contains(e.target)) closeMenu();
  });

  function openProject(id) {
    Notepad.mount(padSlot, id);
    indexView.hidden = true;
    detailView.hidden = false;
  }
  document.getElementById('project-back').addEventListener('click', () => {
    detailView.hidden = true;
    indexView.hidden = false;
  });

  function renderProjects() {
    closeMenu();
    grid.innerHTML = '';
    const { projects, lists } = Store.get();
    if (!projects.length) {
      const p = document.createElement('p');
      p.className = 'agenda-empty';
      p.textContent = 'No projects yet. Start one with the button above.';
      grid.appendChild(p);
      return;
    }
    projects.forEach(proj => {
      const card = document.createElement('div');
      card.className = 'project-card';
      card.dataset.id = proj.id;
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.setAttribute('aria-label', 'Open project ' + proj.name);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProject(proj.id); }
      });

      const name = document.createElement('span');
      name.className = 'project-name';
      name.textContent = proj.name;

      const items = (lists[proj.id] || { items: [] }).items;
      const done = items.filter(i => i.done).length;
      const count = document.createElement('span');
      count.className = 'project-count';
      count.textContent = items.length
        ? `${items.length} task${items.length === 1 ? '' : 's'} · ${done} done`
        : 'No tasks yet';

      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'project-menu';
      menuBtn.setAttribute('aria-label', 'Project options');
      menuBtn.textContent = '···';
      menuBtn.addEventListener('click', e => {
        e.stopPropagation();
        showMenu(card, proj);
      });

      card.append(name, count, menuBtn);
      card.addEventListener('click', () => openProject(proj.id));
      grid.appendChild(card);
    });
  }

  function showMenu(card, proj) {
    closeMenu();
    const menu = document.createElement('div');
    menu.className = 'card-menu';
    menu.addEventListener('click', e => e.stopPropagation());
    menu.addEventListener('keydown', e => e.stopPropagation());

    const rename = document.createElement('button');
    rename.textContent = 'Rename';
    rename.addEventListener('click', e => {
      e.stopPropagation();
      closeMenu();
      askProjectName('Rename project', proj.name, name => Store.renameProject(proj.id, name));
    });

    const del = document.createElement('button');
    del.className = 'is-danger';
    del.textContent = 'Delete';
    del.addEventListener('click', e => {
      e.stopPropagation();
      closeMenu();
      if (confirm(`Delete "${proj.name}" and its list?`)) Store.deleteProject(proj.id);
    });

    menu.append(rename, del);
    card.appendChild(menu);
    openMenu = menu;
  }

  /* project name dialog */
  const projDialog = document.getElementById('project-dialog');
  const projForm = document.getElementById('project-form');
  const projInput = document.getElementById('project-name-input');
  let projSubmit = null;

  function askProjectName(title, initial, onSubmit) {
    document.getElementById('project-dialog-title').textContent = title;
    projInput.value = initial || '';
    projSubmit = onSubmit;
    projDialog.showModal();
    projInput.focus();
  }
  projForm.addEventListener('submit', () => {
    const name = projInput.value.trim();
    if (name && projSubmit) projSubmit(name);
    projSubmit = null;
  });
  document.getElementById('project-cancel').addEventListener('click', () => {
    projSubmit = null;
    projDialog.close();
  });

  document.getElementById('project-add').addEventListener('click', () => {
    askProjectName('New project', '', name => {
      const id = Store.addProject(name);
      if (id) openProject(id);
    });
  });

  /* ---- backup ---- */
  document.getElementById('data-export').addEventListener('click', () => {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vivi-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  const importFile = document.getElementById('data-import-file');
  document.getElementById('data-import').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const f = importFile.files[0];
    if (!f) return;
    f.text().then(text => {
      try { Store.importJSON(text); } catch { alert('That file is not a Vivi backup.'); }
      importFile.value = '';
    });
  });

  Store.subscribe(renderProjects);
  renderProjects();

  /* ---- close dialogs on backdrop click ---- */
  document.querySelectorAll('dialog').forEach(dlg => {
    dlg.addEventListener('click', e => {
      if (e.target === dlg) dlg.close();
    });
  });

  /* ---- service worker ---- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
