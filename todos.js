/* Notepad — lined todo pad component for Vivi.
   Requires global Store (store.js loaded first).
   Usage: Notepad.mount(slotEl, listId) */
(function () {
  "use strict";

  // Track mounts per slot so remounting replaces cleanly.
  var MOUNT_KEY = "__notepadMount";

  function el(tag, className, attrs) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    return node;
  }

  function mount(slotEl, listId) {
    if (!slotEl) return;

    // Clean up any previous mount on this slot.
    var prev = slotEl[MOUNT_KEY];
    if (prev && typeof prev.destroy === "function") prev.destroy();

    // ---- Build static shell (built once; only the list re-renders) ----
    var root = el("div", "notepad");

    var clip = el("div", "notepad-clip");
    clip.setAttribute("aria-hidden", "true");

    var head = el("div", "notepad-head");
    var title = el("h3", "notepad-title");
    var clearBtn = el("button", "notepad-clear", { type: "button" });
    clearBtn.textContent = "Clear done";
    head.appendChild(title);
    head.appendChild(clearBtn);

    var list = el("ul", "notepad-lines");

    var addRow = el("div", "notepad-addrow");
    var addInput = el("input", "notepad-add", {
      type: "text",
      placeholder: "Add a task…",
      "aria-label": "Add a task"
    });
    addRow.appendChild(addInput);

    root.appendChild(clip);
    root.appendChild(head);
    root.appendChild(list);
    root.appendChild(addRow);

    slotEl.innerHTML = "";
    slotEl.appendChild(root);

    // ---- State ----
    var editingId = null;      // item id currently in inline edit
    var dragFromIdx = null;    // index being dragged

    // ---- Render ----
    function render() {
      var data = Store.getList(listId);
      if (!data) return;

      title.textContent = data.name || "";

      var items = data.items || [];
      var anyDone = false;
      for (var d = 0; d < items.length; d++) {
        if (items[d].done) { anyDone = true; break; }
      }
      clearBtn.style.display = anyDone ? "" : "none";

      // Preserve add-input focus/draft: it lives outside the list, so
      // re-rendering only the <ul> never touches it. Just guard editing state.
      list.innerHTML = "";

      items.forEach(function (item, idx) {
        list.appendChild(renderItem(item, idx));
      });
    }

    function renderItem(item, idx) {
      var li = el("li", "notepad-item" + (item.done ? " is-done" : ""), {
        draggable: "true",
        "data-id": String(item.id)
      });

      var check = el("button", "notepad-check", {
        type: "button",
        role: "checkbox",
        "aria-checked": item.done ? "true" : "false",
        "aria-label": "Toggle task"
      });
      check.addEventListener("click", function () {
        Store.toggleItem(listId, item.id);
      });

      var text = el("span", "notepad-text");
      text.textContent = item.text; // textContent = safe, no injection
      text.addEventListener("click", function () {
        if (!li.querySelector("input.notepad-edit")) startEdit(li, item);
      });

      var del = el("button", "notepad-del", {
        type: "button",
        "aria-label": "Delete task"
      });
      del.textContent = "×";
      del.addEventListener("click", function () {
        Store.deleteItem(listId, item.id);
      });

      li.appendChild(check);
      li.appendChild(text);
      li.appendChild(del);

      // ---- Drag to reorder ----
      li.addEventListener("dragstart", function (e) {
        dragFromIdx = idx;
        li.classList.add("is-dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          try { e.dataTransfer.setData("text/plain", String(item.id)); } catch (err) {}
        }
      });
      li.addEventListener("dragend", function () {
        li.classList.remove("is-dragging");
        dragFromIdx = null;
      });
      li.addEventListener("dragover", function (e) {
        if (dragFromIdx === null) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      });
      li.addEventListener("drop", function (e) {
        if (dragFromIdx === null) return;
        e.preventDefault();
        var toIdx = idx;
        if (dragFromIdx !== toIdx) {
          Store.reorderItem(listId, dragFromIdx, toIdx);
        }
        dragFromIdx = null;
      });

      // Restore in-progress edit across Store-triggered re-renders.
      if (editingId === item.id) startEdit(li, item, true);

      return li;
    }

    // ---- Inline editing ----
    function startEdit(li, item, restoring) {
      editingId = item.id;
      var textEl = li.querySelector(".notepad-text");
      if (!textEl) return;

      var input = el("input", "notepad-text notepad-edit", {
        type: "text",
        "aria-label": "Edit task"
      });
      input.value = item.text;
      li.replaceChild(input, textEl);
      li.setAttribute("draggable", "false");

      var finished = false;

      function commit() {
        if (finished) return;
        finished = true;
        editingId = null;
        var val = input.value.trim();
        if (val === "") {
          Store.deleteItem(listId, item.id);
        } else if (val !== item.text) {
          Store.editItem(listId, item.id, val);
        } else {
          render(); // no change; restore span
        }
      }

      function cancel() {
        if (finished) return;
        finished = true;
        editingId = null;
        render();
      }

      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur(); // blur handler commits
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      });
      input.addEventListener("blur", commit);

      input.focus();
      // Cursor at end.
      var len = input.value.length;
      try { input.setSelectionRange(len, len); } catch (err) {}
      if (restoring) return;
    }

    // ---- Add line ----
    addInput.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      var val = addInput.value.trim();
      if (val === "") return;
      Store.addItem(listId, val);
      addInput.value = "";
      addInput.focus(); // keep focus for rapid entry
    });

    // ---- Clear done ----
    clearBtn.addEventListener("click", function () {
      Store.clearDone(listId);
    });

    // ---- Live updates ----
    var unsubscribe = Store.subscribe(function () {
      var hadFocus = document.activeElement === addInput;
      render();
      if (hadFocus) addInput.focus();
    });

    slotEl[MOUNT_KEY] = {
      destroy: function () {
        if (unsubscribe) unsubscribe();
        unsubscribe = null;
        if (root.parentNode === slotEl) slotEl.removeChild(root);
        slotEl[MOUNT_KEY] = null;
      }
    };

    render();
  }

  window.Notepad = { mount: mount };
})();
