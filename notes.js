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

  function renderEditRow(li, section, person, contact, state) {
    li.className = 'contact-row is-editing';

    var form = document.createElement('form');
    form.className = 'contact-edit-form';

    var fields = [
      { key: 'name', placeholder: 'Name', type: 'text' },
      { key: 'role', placeholder: 'Role', type: 'text' },
      { key: 'phone', placeholder: 'Phone', type: 'tel' },
      { key: 'email', placeholder: 'Email', type: 'email' }
    ];

    var firstInput = null;
    fields.forEach(function (f) {
      var input = document.createElement('input');
      input.type = f.type;
      input.placeholder = f.placeholder;
      input.setAttribute('aria-label', f.placeholder);
      input.value = state.draft[f.key] || '';
      if (f.key === 'name') input.required = true;
      input.addEventListener('input', function () {
        state.draft[f.key] = input.value;
      });
      if (!firstInput) firstInput = input;
      form.appendChild(input);
    });

    var saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = 'Save';
    form.appendChild(saveBtn);

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'contact-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
      state.editingId = null;
      state.draft = null;
      renderContacts(section, person, state);
    });
    form.appendChild(cancelBtn);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var draft = state.draft;
      state.editingId = null;
      state.draft = null;
      Store.updateContact(person, contact.id, draft);
    });

    form.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelBtn.click();
      }
    });

    li.appendChild(form);

    if (state.focusPending && firstInput) {
      state.focusPending = false;
      firstInput.focus();
    }
  }

  function renderContacts(section, person, state) {
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

      if (state && state.editingId === contact.id) {
        renderEditRow(li, section, person, contact, state);
        list.appendChild(li);
        return;
      }

      function startEdit() {
        state.editingId = contact.id;
        state.draft = {
          name: contact.name || '',
          role: contact.role || '',
          phone: contact.phone || '',
          email: contact.email || ''
        };
        state.focusPending = true;
        renderContacts(section, person, state);
      }

      var nameSpan = document.createElement('span');
      nameSpan.className = 'contact-name';
      nameSpan.textContent = contact.name;
      nameSpan.title = 'Click to edit';
      nameSpan.addEventListener('click', startEdit);
      li.appendChild(nameSpan);

      if (contact.role) {
        var roleSpan = document.createElement('span');
        roleSpan.className = 'contact-role';
        roleSpan.textContent = contact.role;
        li.appendChild(roleSpan);
      }

      if (contact.phone) {
        var href = telHref(contact.phone);
        if (canCall && href) {
          var phoneLink = document.createElement('a');
          phoneLink.className = 'contact-phone';
          phoneLink.href = 'tel:' + href;
          phoneLink.textContent = contact.phone;
          li.appendChild(phoneLink);
        } else {
          var phoneSpan = document.createElement('span');
          phoneSpan.className = 'contact-phone contact-phone-static';
          phoneSpan.textContent = contact.phone;
          phoneSpan.title = 'Click to edit';
          phoneSpan.addEventListener('click', startEdit);
          li.appendChild(phoneSpan);
        }
      }

      if (contact.email) {
        var emailLink = document.createElement('a');
        emailLink.className = 'contact-email';
        emailLink.href = 'mailto:' + contact.email;
        emailLink.textContent = contact.email;
        li.appendChild(emailLink);
      }

      var editBtn = document.createElement('button');
      editBtn.className = 'contact-edit';
      editBtn.type = 'button';
      editBtn.setAttribute('aria-label', 'Edit ' + contact.name);
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', startEdit);
      li.appendChild(editBtn);

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
      li.appendChild(delBtn);

      list.appendChild(li);
    });
  }

  function setupCareSection(section) {
    var person = section.dataset.person;
    if (!person) return null;

    var state = { editingId: null, draft: null, focusPending: false };
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

    renderContacts(section, person, state);

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
        renderContacts(section, person, state);
      }
    };
  }

  function init() {
    if (initialized) return;
    if (typeof Store === 'undefined') return;
    initialized = true;

    var syncTravel = setupTravelNotes();

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
