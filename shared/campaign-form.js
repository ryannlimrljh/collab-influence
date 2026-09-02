/* Campaign form — the Add / Edit sheet, shared by the list (Add
   campaign) and the detail page (Edit). One module so both pages open
   the identical form; it injects its own markup and the few styles it
   needs, and hands the caller a clean record on save.

   Two sections, the live app's own split: Campaign details (what it
   is, who runs it, when) and Campaign tracker (the operational fields
   the list columns and the Overview tab read). */
(function () {
  'use strict';

  var S = window.campaignStore;
  if (!S) return;

  var CSS = '\
.cf-sheet{width:min(760px, calc(100vw - var(--spacing-32)));}\
.cf-grid{display:grid; grid-template-columns:1fr 1fr; gap:var(--spacing-12);}\
.cf-grid .span2{grid-column:1 / -1;}\
.cf-sheet .c-field{width:100%;}\
.cf-sheet .c-field select, .cf-sheet .c-field input[type=date]{height:40px; border-radius:var(--radius-sm); border:1px solid var(--color-neutral-3); padding:0 var(--spacing-12); font-size:var(--text-body2-size); font-family:inherit; color:var(--color-neutral-9); background:var(--color-neutral-1);}\
.cf-sheet .c-field select:focus, .cf-sheet .c-field input[type=date]:focus{outline:none; border:2px solid var(--color-obsidian); padding:0 11px;}\
.cf-sheet .c-field textarea{min-height:64px;}\
.cf-sheet .c-field input:disabled{background:var(--color-neutral-2); color:var(--color-neutral-5);}\
.cf-sheet .c-field label .opt{font-weight:400; color:var(--color-neutral-5); font-size:var(--text-caption-size); margin-left:4px;}\
.cf-eyebrow{grid-column:1 / -1; margin:var(--spacing-8) 0 0; font-size:var(--text-caption-size); font-weight:700; text-transform:uppercase; letter-spacing:var(--tracking-eyebrow); color:var(--color-neutral-5);}\
.cf-eyebrow:first-child{margin-top:0;}\
.cf-checks{display:flex; flex-wrap:wrap; gap:var(--spacing-8) var(--spacing-16); min-height:40px; align-items:center;}\
.cf-check{display:inline-flex; align-items:center; gap:var(--spacing-8); cursor:pointer; font-size:var(--text-body2-size); color:var(--color-neutral-9); user-select:none;}\
.cf-check .c-checkbox-box{margin-top:0; font-size:12px;}\
.cf-swatches{display:flex; gap:var(--spacing-8); align-items:center; min-height:40px;}\
.cf-swatch{width:26px; height:26px; border-radius:var(--radius-pill); border:2px solid transparent; cursor:pointer; padding:0; box-shadow:inset 0 0 0 1px rgba(0,0,0,.06); transition:transform var(--duration-fast) var(--ease-standard);}\
.cf-swatch:hover{transform:scale(1.08);}\
.cf-swatch.is-on{border-color:var(--color-obsidian); box-shadow:0 0 0 2px var(--color-neutral-1) inset;}\
.cf-foot{display:flex; justify-content:flex-end; gap:var(--spacing-8);}\
@media (max-width:640px){ .cf-grid{grid-template-columns:1fr;} }';

  var HTML = '\
<div class="c-cbrief-scrim" id="cfScrim">\
  <div class="c-cbrief cf-sheet" role="dialog" aria-modal="true" aria-labelledby="cfTitle">\
    <button class="c-cbrief-close" type="button" id="cfClose" aria-label="Close form"><i class="ph ph-x"></i></button>\
    <span class="c-herocard-eyebrow" id="cfEyebrow">New campaign</span>\
    <h3 style="margin:0; font-size:var(--text-h4-size); line-height:var(--text-h4-lh); font-weight:var(--text-h4-weight);" id="cfTitle">Add campaign</h3>\
    <p class="c-cbrief-source" style="margin:-8px 0 0;">Plan deliverables across your influencer roster.</p>\
    <div class="cf-grid">\
      <p class="cf-eyebrow">Campaign details</p>\
      <div class="c-field span2" id="cfFieldName"><label for="cf-name">Campaign name<span class="required-mark">*</span></label>\
        <input id="cf-name" placeholder="e.g. Raya 2026 Influencer Push" /><span class="c-helper" hidden id="cfNameHelp">A name is required.</span></div>\
      <div class="c-field"><label for="cf-brand">Brand<span class="opt">(optional)</span></label>\
        <input id="cf-brand" placeholder="e.g. Nestlé MY" /></div>\
      <div class="c-field"><label for="cf-agency">Agency<span class="opt">(optional)</span></label>\
        <input id="cf-agency" placeholder="e.g. Wavemaker" /></div>\
      <div class="c-field span2"><label for="cf-desc">Description<span class="opt">(optional)</span></label>\
        <textarea id="cf-desc" rows="2" placeholder="Short campaign description…"></textarea></div>\
      <div class="c-field"><label for="cf-pic">PIC</label>\
        <select id="cf-pic"></select></div>\
      <div class="c-field"><label for="cf-sales">Salesperson<span class="opt">(optional)</span></label>\
        <input id="cf-sales" placeholder="e.g. Amir Rahman" /></div>\
      <div class="c-field" id="cfFieldStart"><label for="cf-start">Start date</label>\
        <input id="cf-start" type="date" /></div>\
      <div class="c-field" id="cfFieldEnd"><label for="cf-end">End date</label>\
        <input id="cf-end" type="date" /><span class="c-helper" hidden id="cfEndHelp">The end date is before the start.</span></div>\
      <div class="c-field span2"><label>Colour</label>\
        <div class="cf-swatches" id="cfSwatches" role="radiogroup" aria-label="Campaign colour"></div></div>\
\
      <p class="cf-eyebrow">Campaign tracker</p>\
      <div class="c-field"><label for="cf-io">Campaign IO</label>\
        <input id="cf-io" placeholder="KULT-2026-00031" /></div>\
      <div class="c-field"><label for="cf-stage">Stage</label>\
        <select id="cf-stage"></select></div>\
      <div class="c-field"><label>Campaign type</label>\
        <div class="cf-checks" id="cfTypes"></div></div>\
      <div class="c-field"><label>Platform</label>\
        <div class="cf-checks" id="cfPlatforms"></div></div>\
      <div class="c-field"><label for="cf-overseer">Overseer</label>\
        <select id="cf-overseer"></select></div>\
      <div class="c-field"><label for="cf-pax">Pax</label>\
        <input id="cf-pax" inputmode="numeric" placeholder="e.g. 12" /></div>\
      <div class="c-field"><label for="cf-quote">Quote (RM)</label>\
        <input id="cf-quote" inputmode="numeric" placeholder="e.g. 12,000" /></div>\
      <div class="c-field"><label for="cf-cost">Cost (RM)</label>\
        <input id="cf-cost" inputmode="numeric" placeholder="e.g. 7,500" /></div>\
      <div class="c-field"><label for="cf-picpct">PIC %</label>\
        <input id="cf-picpct" inputmode="numeric" placeholder="e.g. 70" /></div>\
      <div class="c-field"><label for="cf-ovpct">Overseer %</label>\
        <input id="cf-ovpct" inputmode="numeric" placeholder="Pick an overseer first" disabled /></div>\
      <div class="c-field span2"><label for="cf-remarks">Remarks</label>\
        <input id="cf-remarks" placeholder="" /></div>\
    </div>\
    <div class="cf-foot">\
      <button class="c-btn c-btn-ghost c-btn-md" type="button" id="cfCancel">Cancel</button>\
      <button class="c-btn c-btn-primary c-btn-md" type="button" id="cfSave">Create campaign</button>\
    </div>\
  </div>\
</div>';

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  var host = document.createElement('div');
  host.innerHTML = HTML;
  document.body.appendChild(host.firstElementChild);

  var F = function (id) { return document.getElementById(id); };
  var scrim = F('cfScrim');
  var onSave = null, editing = null, color = 'obsidian';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  }
  function opts(sel, list, blank) {
    sel.innerHTML = (blank ? '<option value="">' + blank + '</option>' : '') +
      list.map(function (o) {
        var v = typeof o === 'string' ? o : o.key, l = typeof o === 'string' ? o : o.label;
        return '<option value="' + esc(v) + '">' + esc(l) + '</option>';
      }).join('');
  }
  function checks(host, list, on) {
    host.innerHTML = list.map(function (o) {
      var v = typeof o === 'string' ? o : o.key, l = typeof o === 'string' ? o : o.label;
      var is = on.indexOf(v) > -1;
      return '<label class="cf-check" data-v="' + esc(v) + '"><span class="c-checkbox-box' + (is ? ' on' : '') + '">' +
        (is ? '<i class="ph ph-check"></i>' : '') + '</span>' + esc(l) + '</label>';
    }).join('');
  }
  function checked(host) {
    return Array.prototype.map.call(host.querySelectorAll('.cf-check'), function (l) {
      return l.querySelector('.c-checkbox-box').classList.contains('on') ? l.dataset.v : null;
    }).filter(Boolean);
  }
  function swatches() {
    F('cfSwatches').innerHTML = S.COLORS.map(function (c) {
      return '<button type="button" class="cf-swatch' + (c.key === color ? ' is-on' : '') + '" data-c="' + c.key +
        '" role="radio" aria-checked="' + (c.key === color) + '" aria-label="' + c.key + '" style="background:' + c.css + '"></button>';
    }).join('');
  }
  function syncOverseer() {
    var has = !!F('cf-overseer').value;
    var ov = F('cf-ovpct');
    ov.disabled = !has;
    if (!has) { ov.value = ''; ov.placeholder = 'Pick an overseer first'; return; }
    ov.placeholder = 'e.g. 30';
    var pp = S.num(F('cf-picpct').value);
    if (pp != null && !ov.dataset.touched) ov.value = Math.max(0, 100 - pp);
  }

  function fill(r) {
    r = r || {};
    F('cf-name').value = r.name || '';
    F('cf-brand').value = r.brand || '';
    F('cf-agency').value = r.agency || '';
    F('cf-desc').value = r.description || '';
    F('cf-pic').value = r.pic || S.TEAM[0];
    F('cf-sales').value = r.salesperson || '';
    F('cf-start').value = r.start || '';
    F('cf-end').value = r.end || '';
    F('cf-io').value = r.io || '';
    F('cf-stage').value = r.stage || 'sourcing';
    checks(F('cfTypes'), S.TYPES, r.types || ['Influencers']);
    checks(F('cfPlatforms'), S.PLATFORMS, r.platforms || []);
    F('cf-overseer').value = r.overseer || '';
    F('cf-pax').value = r.pax == null ? '' : r.pax;
    F('cf-quote').value = r.quote == null ? '' : r.quote;
    F('cf-cost').value = r.cost == null ? '' : r.cost;
    F('cf-picpct').value = r.picPct == null ? '' : r.picPct;
    var ov = F('cf-ovpct');
    delete ov.dataset.touched;
    ov.value = r.overseerPct == null ? '' : r.overseerPct;
    if (r.overseerPct != null) ov.dataset.touched = '1';
    F('cf-remarks').value = r.remarks || '';
    color = r.color || 'obsidian';
    swatches();
    syncOverseer();
    F('cfFieldName').classList.remove('c-field-error'); F('cfNameHelp').hidden = true;
    F('cfFieldEnd').classList.remove('c-field-error'); F('cfEndHelp').hidden = true;
  }
  function read() {
    var pp = S.num(F('cf-picpct').value);
    var overseer = F('cf-overseer').value;
    return {
      name: F('cf-name').value.trim(),
      brand: F('cf-brand').value.trim(),
      agency: F('cf-agency').value.trim(),
      description: F('cf-desc').value.trim(),
      pic: F('cf-pic').value,
      salesperson: F('cf-sales').value.trim(),
      start: F('cf-start').value,
      end: F('cf-end').value,
      color: color,
      io: F('cf-io').value.trim(),
      stage: F('cf-stage').value,
      types: checked(F('cfTypes')),
      platforms: checked(F('cfPlatforms')),
      overseer: overseer,
      pax: S.num(F('cf-pax').value),
      quote: S.num(String(F('cf-quote').value).replace(/,/g, '')),
      cost: S.num(String(F('cf-cost').value).replace(/,/g, '')),
      picPct: pp,
      overseerPct: overseer ? S.num(F('cf-ovpct').value) : null,
      remarks: F('cf-remarks').value.trim()
    };
  }
  function validate(rec) {
    var ok = true;
    var bad = !rec.name;
    F('cfFieldName').classList.toggle('c-field-error', bad); F('cfNameHelp').hidden = !bad;
    if (bad) ok = false;
    var badEnd = !!(rec.start && rec.end && rec.end < rec.start);
    F('cfFieldEnd').classList.toggle('c-field-error', badEnd); F('cfEndHelp').hidden = !badEnd;
    if (badEnd) ok = false;
    return ok;
  }
  function close() {
    scrim.classList.remove('is-open');
    onSave = null; editing = null;
  }

  opts(F('cf-pic'), S.TEAM);
  opts(F('cf-overseer'), S.TEAM, '—');
  opts(F('cf-stage'), S.STAGES);

  F('cfClose').addEventListener('click', close);
  F('cfCancel').addEventListener('click', close);
  scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && scrim.classList.contains('is-open')) close();
  });
  scrim.addEventListener('click', function (e) {
    var chk = e.target.closest('.cf-check');
    if (chk) {
      var box = chk.querySelector('.c-checkbox-box');
      var on = !box.classList.contains('on');
      box.classList.toggle('on', on);
      box.innerHTML = on ? '<i class="ph ph-check"></i>' : '';
      return;
    }
    var sw = e.target.closest('.cf-swatch');
    if (sw) { color = sw.dataset.c; swatches(); }
  });
  F('cf-overseer').addEventListener('change', syncOverseer);
  F('cf-picpct').addEventListener('input', function () {
    delete F('cf-ovpct').dataset.touched;
    syncOverseer();
  });
  F('cf-ovpct').addEventListener('input', function () { F('cf-ovpct').dataset.touched = '1'; });
  F('cf-name').addEventListener('input', function () {
    if (F('cf-name').value.trim()) { F('cfFieldName').classList.remove('c-field-error'); F('cfNameHelp').hidden = true; }
  });
  F('cfSave').addEventListener('click', function () {
    var rec = read();
    if (!validate(rec)) { F(rec.name ? 'cf-end' : 'cf-name').focus(); return; }
    var cb = onSave, id = editing;
    close();
    if (cb) cb(rec, id);
  });

  window.campaignForm = {
    /* open({rec, onSave}) — rec is null for a new campaign. onSave
       receives (fields, editingId). */
    open: function (o) {
      o = o || {};
      editing = o.rec ? o.rec.id : null;
      onSave = o.onSave || null;
      F('cfEyebrow').textContent = editing ? 'Edit campaign' : 'New influencer campaign';
      F('cfTitle').textContent = editing ? o.rec.name : 'Add campaign';
      F('cfSave').textContent = editing ? 'Save changes' : 'Create campaign';
      fill(o.rec || o.draft || null);
      scrim.classList.add('is-open');
      setTimeout(function () { F('cf-name').focus(); }, 260);
    },
    close: close,
    isOpen: function () { return scrim.classList.contains('is-open'); }
  };
})();
