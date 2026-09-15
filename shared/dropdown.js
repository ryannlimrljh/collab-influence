/* shared/dropdown.js — the DLS dropdown, over a native select.

   Lifted out of campaign-form.js, which had the only copy. The send sheet
   needed the same control and influencers-v2.html does not load the form,
   so a second copy was the alternative — and two copies of a control is
   how the two "send to campaign" flows drifted apart in the first place.

   The select stays the value holder: every `.value` read and every change
   listener on the original element keeps working, and the trigger/panel is
   the c-dropdown-field recipe from the design system.

   The `cf-dd` class name is kept rather than renamed, so the campaign
   form's existing rules go on matching untouched. */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  var CSS = [
    '.cf-dd{position:relative; width:100%; min-width:0; display:block; gap:0;}',
    '.cf-dd select{display:none;}',
    '.cf-dd .input-wrap{position:relative; display:flex; align-items:center;}',
    '.cf-dd .c-dropdown-input{width:100%; min-width:0; height:40px; border-radius:var(--radius-sm);',
    '  border:1px solid var(--color-neutral-3); padding:0 36px 0 var(--spacing-12);',
    '  font-size:var(--text-body2-size); font-family:inherit; color:var(--color-neutral-9);',
    '  background:var(--color-neutral-1); text-overflow:ellipsis; cursor:pointer;}',
    '.cf-dd .c-dropdown-input:focus{outline:none; border:2px solid var(--color-obsidian); padding:0 35px 0 11px;}',
    '.cf-dd.open .c-dropdown-input{padding:0 35px 0 11px;}',
    '.cf-dd .icon-trailing{position:absolute; right:var(--spacing-12); display:flex;',
    '  pointer-events:none; color:var(--color-neutral-5); font-size:var(--icon-sm);}',
    '.cf-dd .c-dropdown-panel[hidden]{display:none;}',
    '.cf-dd-portal .c-dropdown-list{max-height:var(--dd-max, 320px);}',
    '.cf-dd .c-dropdown-row.hover{background:var(--color-neutral-2);}',
    '.cf-dd .c-dropdown-row-label .d{display:block; font-size:var(--text-caption-size); color:var(--color-neutral-5);}',
    '.cf-dd .c-dropdown-add{border-top:1px solid var(--color-neutral-2); margin-top:4px; padding-top:10px;}',
    '.cf-dd .c-dropdown-add .c-dropdown-row-label{font-weight:700; display:inline-flex; align-items:center; gap:6px;}',
    '.cf-dd .c-dropdown-new{display:flex; gap:var(--spacing-8); padding:var(--spacing-8) var(--spacing-12); border-top:1px solid var(--color-neutral-2);}',
    '.cf-dd .c-dropdown-new input{flex:1; min-width:0; height:36px; border:1px solid var(--color-neutral-3); border-radius:var(--radius-sm); padding:0 10px; font:inherit; font-size:var(--text-body2-size);}',
    '.cf-dd .c-dropdown-new input:focus{outline:none; border-color:var(--color-obsidian);}',
    '.cf-dd-portal{position:fixed; margin:0; z-index:1000; width:auto;}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('collab-dd-css')) return;
    var s = document.createElement('style');
    s.id = 'collab-dd-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

/* ── DLS dropdown over a native select. The select stays the value
   holder — every F('cf-…').value read and every change listener keeps
   working — and the trigger/panel is the c-dropdown-field recipe. Rows
   are read off the select's options on open, so options disabled or
   added later show as such. `addNew` puts a last row that turns into
   an inline name box. */
var DD_OPEN = null, DD_PANEL = null;
function closeDD() {
  if (!DD_OPEN) return;
  DD_OPEN.classList.remove('open');
  DD_OPEN.querySelector('.c-dropdown-input').setAttribute('aria-expanded', 'false');
  if (DD_PANEL) {
    /* Back home from the portal, styles cleared. */
    DD_PANEL.hidden = true; DD_PANEL.classList.remove('cf-dd-portal'); DD_PANEL.removeAttribute('style');
    DD_OPEN.querySelector('.input-wrap').appendChild(DD_PANEL);
  }
  DD_OPEN = null; DD_PANEL = null;
}
/* The sheet body scrolls and clips; a panel that lives inside it gets
   cut off at the fold. So the open panel is lifted onto the body and
   fixed under its trigger, and any scroll or resize closes it. */
function placeDD(field, panel) {
  var input = field.querySelector('.c-dropdown-input'), tb = input.getBoundingClientRect();
  panel.classList.add('cf-dd-portal'); document.body.appendChild(panel); panel.hidden = false;
  panel.style.left = tb.left + 'px'; panel.style.width = tb.width + 'px';
  var below = window.innerHeight - tb.bottom - 12, above = tb.top - 12;
  var want = Math.min(panel.offsetHeight, 340);
  if (want <= below || below >= above) {
    panel.style.top = (tb.bottom + 4) + 'px'; panel.style.setProperty('--dd-max', Math.max(120, Math.min(320, below - 4)) + 'px');
  } else {
    var h = Math.min(want, above - 4);
    panel.style.setProperty('--dd-max', Math.max(120, h - 16) + 'px');
    panel.style.top = Math.max(8, tb.top - 4 - Math.min(panel.offsetHeight, h)) + 'px';
    panel.style.bottom = 'auto';
  }
}
function ddSync(sel) {
  var field = sel.closest('.cf-dd'); if (!field) return;
  var input = field.querySelector('.c-dropdown-input');
  var o = sel.options[sel.selectedIndex];
  var empty = !sel.value;
  input.value = empty ? '' : (o ? o.text.replace(/ \(added\)$/, '') : '');
  field.classList.toggle('has-value', !empty);
  field.classList.toggle('is-empty', empty);
}
function enhanceSelect(sel, o) {
  o = o || {};
  if (sel.closest('.cf-dd')) { ddSync(sel); return; }
  var field = document.createElement('div');
  field.className = 'c-field c-dropdown-field cf-dd';
  field.innerHTML = '<div class="input-wrap has-trailing-icon">' +
    '<input type="text" class="c-dropdown-input" readonly placeholder="' + esc(o.placeholder || 'Pick one') + '" aria-haspopup="listbox" aria-expanded="false"' + (sel.getAttribute('aria-label') ? ' aria-label="' + esc(sel.getAttribute('aria-label')) + '"' : '') + ' />' +
    '<span class="icon-trailing" aria-hidden="true"><i class="ph ph-caret-down c-dropdown-chevron"></i></span>' +
    '<div class="c-dropdown-panel" hidden><div class="c-dropdown-list" role="listbox"></div></div></div>';
  sel.parentNode.insertBefore(field, sel);
  field.appendChild(sel);
  if (sel.id) { var lab = document.querySelector('label[for="' + sel.id + '"]'); if (lab) { field.querySelector('.c-dropdown-input').id = 'dd-' + sel.id; lab.setAttribute('for', 'dd-' + sel.id); } }
  var input = field.querySelector('.c-dropdown-input'), panel = field.querySelector('.c-dropdown-panel'), list = field.querySelector('.c-dropdown-list');
  function rows() {
    list.innerHTML = Array.prototype.map.call(sel.options, function (op) {
      var seld = op.value === sel.value;
      var txt = esc(op.text.replace(/ \(added\)$/, ''));
      return '<div class="c-dropdown-row' + (seld ? ' selected' : '') + (op.disabled ? ' disabled' : '') + '" data-v="' + esc(op.value) + '" role="option" aria-selected="' + seld + '">' +
        '<span class="c-dropdown-row-label">' + txt + (op.dataset.desc ? '<span class="d">' + esc(op.dataset.desc) + '</span>' : '') + '</span><i class="ph ph-check c-dropdown-row-check"></i></div>';
    }).join('') + (o.addNew ? '<div class="c-dropdown-row c-dropdown-add" data-add><span class="c-dropdown-row-label"><i class="ph ph-plus"></i>' + esc(o.addNew) + '</span></div>' : '');
  }
  function open() {
    closeDD();
    rows();
    field.classList.add('open'); input.setAttribute('aria-expanded', 'true');
    DD_OPEN = field; DD_PANEL = panel;
    placeDD(field, panel);
    /* Scroll the list only — scrollIntoView would drag the sheet body
       along with it. */
    var cur = list.querySelector('.selected'); if (cur) list.scrollTop = Math.max(0, cur.offsetTop - list.clientHeight / 2 + cur.offsetHeight / 2);
  }
  function pick(v) {
    sel.value = v; ddSync(sel); closeDD();
    sel.dispatchEvent(new Event('change', {bubbles: true}));
  }
  function showAdd() {
    list.innerHTML = '<div class="c-dropdown-new"><input placeholder="Name" aria-label="New name" /><button class="c-btn c-btn-primary c-btn-sm" type="button" data-add-ok>Add</button></div>';
    var box = list.querySelector('input');
    box.focus();
    function commit() {
      var name = box.value.trim(); if (!name) { box.focus(); return; }
      if (o.onAdd) o.onAdd(name);
      var exists = Array.prototype.some.call(sel.options, function (op) { return op.value === name; });
      if (!exists) { var op = document.createElement('option'); op.value = name; op.textContent = name; sel.appendChild(op); }
      pick(name);
    }
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(); } if (e.key === 'Escape') { e.stopPropagation(); closeDD(); } });
    list.querySelector('[data-add-ok]').addEventListener('click', function (e) { e.stopPropagation(); commit(); });
  }
  input.addEventListener('click', function (e) { e.stopPropagation(); if (DD_OPEN === field) closeDD(); else open(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      if (DD_OPEN !== field) { e.preventDefault(); open(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
      if (e.key === 'Enter') { e.preventDefault(); var h = list.querySelector('.hover, .selected'); if (h) { if (h.hasAttribute('data-add')) showAdd(); else pick(h.dataset.v); } return; }
    }
    if (e.key === 'ArrowUp' && DD_OPEN === field) { e.preventDefault(); move(-1); }
    if (e.key === 'Escape' && DD_OPEN === field) { e.stopPropagation(); closeDD(); }
  });
  function move(d) {
    var all = Array.prototype.filter.call(list.querySelectorAll('.c-dropdown-row'), function (r) { return !r.classList.contains('disabled'); });
    if (!all.length) return;
    var i = all.findIndex(function (r) { return r.classList.contains('hover'); });
    if (i < 0) i = all.findIndex(function (r) { return r.classList.contains('selected'); });
    all.forEach(function (r) { r.classList.remove('hover'); });
    var n = all[Math.max(0, Math.min(all.length - 1, i + d))];
    n.classList.add('hover');
    if (n.offsetTop < list.scrollTop) list.scrollTop = n.offsetTop;
    else if (n.offsetTop + n.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = n.offsetTop + n.offsetHeight - list.clientHeight;
  }
  list.addEventListener('click', function (e) {
    e.stopPropagation();
    if (e.target.closest('.c-dropdown-new')) return;
    var row = e.target.closest('.c-dropdown-row'); if (!row || row.classList.contains('disabled')) return;
    if (row.hasAttribute('data-add')) { showAdd(); return; }
    pick(row.dataset.v);
  });
  panel.addEventListener('click', function (e) { e.stopPropagation(); });
  ddSync(sel);
}
document.addEventListener('click', function (e) { if (DD_OPEN && !e.target.closest('.cf-dd') && !e.target.closest('.cf-dd-portal')) closeDD(); });
window.addEventListener('resize', closeDD);
document.addEventListener('scroll', function (e) { if (DD_OPEN && !(DD_PANEL && DD_PANEL.contains(e.target))) closeDD(); }, true);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && DD_OPEN) { e.stopPropagation(); closeDD(); } }, true);
  window.collabDropdown = {
    /* enhance(selectEl, {placeholder, addNew, onAdd}) — idempotent: calling
       it again on an already-enhanced select just re-syncs the label. */
    enhance: function (sel, o) { injectCSS(); return enhanceSelect(sel, o); },
    close: closeDD,
    sync: ddSync,
    isOpen: function () { return !!DD_OPEN; }
  };
})();
