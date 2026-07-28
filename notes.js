// notes.js — Travel + Care modules (vanilla JS, global Notes)
(function () {
  'use strict';

  var DEBOUNCE_MS = 400;
  var initialized = false;

  function digitsOnly(str) {
    return (str || '').replace(/\D/g, '');
  }

  function telHref(phone) {
    var digits = digitsOnly(phone);
    if (!digits) return '';
    if (digits.length === 10) digits = '1' + digits;
    return '+' + digits;
  }

  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, ms);
    };
  }

  function setupTravelNotes() {
    var textarea = document.getElementById('travel-notes');
    if (!textarea) return null;

    textarea.value = Store.get().travelNotes || '';

    var commit = debounce(function () {
      Store.setTravelNotes(textarea.value);
    }, DEBOUNCE_MS);

    textarea.addEventListener('input', commit);

    return function syncFromStore() {
      var current = Store.get().travelNotes || '';
      if (document.activeElement === textarea) return;
      if (textarea.value === current) return;
      textarea.value = current;
    };
  }

  /* ---- contact edit dialog (shared by all care sections) ---- */
  var editTarget = null; // { person, id }

  function setupContactDialog() {
    var dialog = document.getElementById('contact-dialog');
    var form = document.getElementById('contact-form');
    if (!dialog || !form) return;

    var cancelBtn = document.getElementById('contact-edit-cancel');
    cancelBtn.addEventListener('click', function () {
      editTarget = null;
      dialog.close();
    });

    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) {
        editTarget = null;
        dialog.close();
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (editTarget) {
        Store.updateContact(editTarget.person, editTarget.id, {
          name: document.getElementById('contact-edit-name').value,
          role: document.getElementById('contact-edit-role').value,
          phone: document.getElementById('contact-edit-phone').value,
          email: document.getElementById('contact-edit-email').value
        });
        editTarget = null;
      }
      dialog.close();
    });
  }

  function openEditDialog(person, contact) {
    var dialog = document.getElementById('contact-dialog');
    if (!dialog) return;
    editTarget = { person: person, id: contact.id };
    document.getElementById('contact-edit-name').value = contact.name || '';
    document.getElementById('contact-edit-role').value = contact.role || '';
    document.getElementById('contact-edit-phone').value = contact.phone || '';
    document.getElementById('contact-edit-email').value = contact.email || '';
    dialog.showModal();
  }

  function renderContacts(section, person) {
    var list = section.querySelector('.contacts-list');
    if (!list) return;

    var data = Store.get().care[person] || { contacts: [] };
    var contacts = data.contacts || [];

    list.textContent = '';

    if (contacts.length === 0) {
      var emptyLi = document.createElement('li');
      emptyLi.className = 'contact-row is-empty';
      var emptyRole = document.createElement('span');
      emptyRole.className = 'contact-role';
      emptyRole.textContent = 'No contacts yet';
      emptyLi.appendChild(emptyRole);
      list.appendChild(emptyLi);
      return;
    }

    // tel: links only make sense on devices that can place calls
    var canCall = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    contacts.forEach(function (contact) {
      var li = document.createElement('li');
      li.className = 'contact-row';
      li.dataset.id = contact.id;

      function startEdit() {
        openEditDialog(person, contact);
      }

      // info block: name + role + phone + email, wraps freely, tap to edit
      var info = document.createElement('div');
      info.className = 'contact-info';
      info.title = 'Click to edit';
      info.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('a')) return; // let tel/mailto work
        startEdit();
      });

      var nameSpan = document.createElement('span');
      nameSpan.className = 'contact-name';
      nameSpan.textContent = contact.name;
      info.appendChild(nameSpan);

      if (contact.role) {
        var roleSpan = document.createElement('span');
        roleSpan.className = 'contact-role';
        roleSpan.textContent = contact.role;
        info.appendChild(roleSpan);
      }

      if (contact.phone) {
        var href = telHref(contact.phone);
        if (canCall && href) {
          var phoneLink = document.createElement('a');
          phoneLink.className = 'contact-phone';
          phoneLink.href = 'tel:' + href;
          phoneLink.textContent = contact.phone;
          info.appendChild(phoneLink);
        } else {
          var phoneSpan = document.createElement('span');
          phoneSpan.className = 'contact-phone contact-phone-static';
          phoneSpan.textContent = contact.phone;
          info.appendChild(phoneSpan);
        }
      }

      if (contact.email) {
        var emailLink = document.createElement('a');
        emailLink.className = 'contact-email';
        emailLink.href = 'mailto:' + contact.email;
        emailLink.textContent = contact.email;
        info.appendChild(emailLink);
      }

      li.appendChild(info);

      var actions = document.createElement('div');
      actions.className = 'contact-actions';

      var editBtn = document.createElement('button');
      editBtn.className = 'contact-edit';
      editBtn.type = 'button';
      editBtn.setAttribute('aria-label', 'Edit ' + contact.name);
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', startEdit);
      actions.appendChild(editBtn);

      var delBtn = document.createElement('button');
      delBtn.className = 'contact-del';
      delBtn.setAttribute('aria-label', 'Delete contact');
      delBtn.type = 'button';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', function () {
        if (confirm('Remove ' + contact.name + '?')) {
          Store.deleteContact(person, contact.id);
        }
      });
      actions.appendChild(delBtn);

      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function setupCareSection(section) {
    var person = section.dataset.person;
    if (!person) return null;

    var textarea = section.querySelector('.care-notes');
    var syncNotes = null;

    if (textarea) {
      var careData = Store.get().care[person] || {};
      textarea.value = careData.notes || '';

      var commit = debounce(function () {
        Store.setCareNotes(person, textarea.value);
      }, DEBOUNCE_MS);

      textarea.addEventListener('input', commit);

      syncNotes = function () {
        var current = (Store.get().care[person] || {}).notes || '';
        if (document.activeElement === textarea) return;
        if (textarea.value === current) return;
        textarea.value = current;
      };
    }

    renderContacts(section, person);

    var form = section.querySelector('.contact-add-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var nameInput = form.querySelector('.contact-name');
        var roleInput = form.querySelector('.contact-role');
        var phoneInput = form.querySelector('.contact-phone');
        var emailInput = form.querySelector('.contact-email');

        var name = (nameInput.value || '').trim();
        if (!name) return;

        Store.addContact(person, {
          name: name,
          role: (roleInput.value || '').trim(),
          phone: (phoneInput.value || '').trim(),
          email: emailInput ? (emailInput.value || '').trim() : ''
        });

        form.reset();
        nameInput.focus();
      });
    }

    return {
      syncNotes: syncNotes,
      renderContacts: function () {
        renderContacts(section, person);
      }
    };
  }

  function init() {
    if (initialized) return;
    if (typeof Store === 'undefined') return;
    initialized = true;

    var syncTravel = setupTravelNotes();
    setupContactDialog();

    var careSections = document.querySelectorAll('.care-section');
    var careHandlers = [];
    careSections.forEach(function (section) {
      var handler = setupCareSection(section);
      if (handler) careHandlers.push(handler);
    });

    Store.subscribe(function () {
      if (syncTravel) syncTravel();
      careHandlers.forEach(function (handler) {
        if (handler.syncNotes) handler.syncNotes();
        handler.renderContacts();
      });
    });
  }

  window.Notes = { init: init };

  document.addEventListener('DOMContentLoaded', function () {
    init();
  });
})();
