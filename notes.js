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

    contacts.forEach(function (contact) {
      var li = document.createElement('li');
      li.className = 'contact-row';
      li.dataset.id = contact.id;

      var nameSpan = document.createElement('span');
      nameSpan.className = 'contact-name';
      nameSpan.textContent = contact.name;
      li.appendChild(nameSpan);

      if (contact.role) {
        var roleSpan = document.createElement('span');
        roleSpan.className = 'contact-role';
        roleSpan.textContent = contact.role;
        li.appendChild(roleSpan);
      }

      if (contact.phone) {
        var href = telHref(contact.phone);
        if (href) {
          var phoneLink = document.createElement('a');
          phoneLink.className = 'contact-phone';
          phoneLink.href = 'tel:' + href;
          phoneLink.textContent = contact.phone;
          li.appendChild(phoneLink);
        }
      }

      if (contact.email) {
        var emailLink = document.createElement('a');
        emailLink.className = 'contact-email';
        emailLink.href = 'mailto:' + contact.email;
        emailLink.textContent = contact.email;
        li.appendChild(emailLink);
      }

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
