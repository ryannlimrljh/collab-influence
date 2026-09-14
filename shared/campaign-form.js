/* Campaign form — the stepped Add / Edit sheet, shared by the list and
   the campaign page. One module so both open the identical form; it
   injects its own markup and styles and hands the caller a clean record.

   Three steps, in order of importance: Basics (what it is, who runs it,
   when), The ask (what we need from the client, per channel and tier —
   pax and platforms derive from this and are never typed), Commercials
   (IO, money, the split). A lead is a switch on step 1, not a stage to
   find in a dropdown; leads skip Commercials.

   Contract, unchanged from the flat form: open({rec, draft, onSave, step});
   onSave(fields, editingId). `fields` carries `requirement`, and `pax` and
   `platforms` derived from it, so callers save with a plain add/update. */
(function () {
  'use strict';

  var S = window.campaignStore;
  var M = window.campaignModel;
  var T = window.tiers;
  if (!S || !M || !T) return;

  var PLAT_LABEL = {tiktok: 'TikTok', instagram: 'Instagram', xhs: 'Xiaohongshu'};
  var PLAT_ICON = {
    tiktok: '<i class="ph-fill ph-tiktok-logo"></i>',
    instagram: '<i class="ph-fill ph-instagram-logo"></i>',
    xhs: '<i class="ph-fill ph-book-open"></i>'
  };

  var CSS = '\
.cf-sheet{width:min(760px, calc(100vw - var(--spacing-32))); padding:0; gap:0; overflow:hidden;}\
.cf-head{padding:var(--spacing-24) var(--spacing-24) var(--spacing-16); border-bottom:1px solid var(--color-neutral-3);}\
.cf-head h3{margin:0; font-size:var(--text-h4-size); line-height:var(--text-h4-lh); font-weight:var(--text-h4-weight);}\
.cf-head .c-cbrief-source{margin:4px 0 0;}\
.cf-steps{display:flex; align-items:center; margin-top:var(--spacing-16);}\
.cf-stepbtn{display:inline-flex; align-items:center; gap:var(--spacing-8); border:0; background:transparent; font:inherit; cursor:pointer; padding:4px 8px; border-radius:var(--radius-pill); color:var(--color-neutral-5); font-size:var(--text-caption-size); font-weight:700; white-space:nowrap;}\
.cf-stepbtn:hover{background:var(--color-neutral-2); color:var(--color-neutral-9);}\
.cf-stepbtn:focus-visible{outline:2px solid var(--color-obsidian); outline-offset:2px;}\
.cf-stepbtn.is-on{color:var(--color-neutral-9);}\
.cf-stepbtn.is-done{color:var(--color-neutral-9);}\
.cf-stepbtn .c-step-indicator{width:22px; height:22px; font-size:11px;}\
.cf-stepbtn.is-on .c-step-indicator{box-shadow:0 0 0 4px var(--color-neutral-2);}\
.cf-stepbtn[hidden]{display:none;}\
.cf-stepline{flex:1; height:2px; min-width:16px; background:var(--color-neutral-3); margin:0 4px; border-radius:1px;}\
.cf-stepline.is-done{background:var(--color-neutral-9);}\
.cf-stepline[hidden]{display:none;}\
.cf-body{padding:var(--spacing-24); overflow-y:auto; max-height:calc(100dvh - var(--spacing-60) - 200px);}\
.cf-step{display:none; animation:cf-fade var(--duration-fast) var(--ease-standard) both;}\
.cf-step.is-on{display:block;}\
@keyframes cf-fade{from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:none;}}\
.cf-grid{display:grid; grid-template-columns:1fr 1fr; gap:var(--spacing-16) var(--spacing-12);}\
.cf-grid .span2{grid-column:1 / -1;}\
.cf-sheet .c-field{width:100%;}\
.cf-sheet .c-field select, .cf-sheet .c-field input[type=date]{height:40px; border-radius:var(--radius-sm); border:1px solid var(--color-neutral-3); padding:0 var(--spacing-12); font-size:var(--text-body2-size); font-family:inherit; color:var(--color-neutral-9); background:var(--color-neutral-1);}\
.cf-sheet .c-field select:focus, .cf-sheet .c-field input[type=date]:focus{outline:none; border:2px solid var(--color-obsidian); padding:0 11px;}\
.cf-sheet .c-field textarea{min-height:64px;}\
.cf-sheet .c-field input:disabled{background:var(--color-neutral-2); color:var(--color-neutral-5);}\
.cf-sheet .c-field label .opt{font-weight:400; color:var(--color-neutral-5); font-size:var(--text-caption-size); margin-left:4px;}\
.cf-checks{display:flex; flex-wrap:wrap; gap:var(--spacing-8) var(--spacing-16); min-height:40px; align-items:center;}\
.cf-check{display:inline-flex; align-items:center; gap:var(--spacing-8); cursor:pointer; font-size:var(--text-body2-size); color:var(--color-neutral-9); user-select:none;}\
.cf-check .c-checkbox-box{margin-top:0; font-size:12px;}\
.cf-lead{grid-column:1 / -1; display:flex; align-items:flex-start; gap:var(--spacing-12); padding:var(--spacing-12) var(--spacing-16); border:1px solid var(--color-neutral-3); border-radius:var(--radius-md); background:var(--color-neutral-1); cursor:pointer; transition:border-color var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard);}\
.cf-lead:hover{border-color:var(--color-neutral-5);}\
.cf-lead.is-on{border-color:var(--color-obsidian); background:var(--color-neutral-2);}\
.cf-lead .c-switch-track{margin-top:2px;}\
.cf-lead .t{font-size:var(--text-body2-size); font-weight:700; color:var(--color-neutral-9);}\
.cf-lead .s{display:block; font-size:var(--text-caption-size); color:var(--color-neutral-5); margin-top:2px;}\
.cf-intro{margin:0 0 var(--spacing-16); font-size:var(--text-body2-size); color:var(--color-neutral-5);}\
.cf-plats{display:flex; flex-wrap:wrap; gap:var(--spacing-8); margin-bottom:var(--spacing-16);}\
.cf-plats .c-chip-filter{gap:6px;}\
.cf-plats .c-chip-filter i{font-size:var(--icon-sm);}\
.cf-askrow{display:grid; grid-template-columns:120px 1fr; gap:var(--spacing-12); align-items:center; padding:var(--spacing-12) 0; border-top:1px solid var(--color-neutral-2);}\
.cf-askrow:first-of-type{border-top:0;}\
.cf-askrow .pl{display:inline-flex; align-items:center; gap:8px; font-size:var(--text-body2-size); font-weight:700; color:var(--color-neutral-9);}\
.cf-askrow .pl i{font-size:var(--icon-sm);}\
.cf-tiers{display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:6px;}\
.cf-stp{display:flex; flex-direction:column; align-items:center; gap:4px;}\
.cf-stp .k{display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:var(--tracking-eyebrow); color:var(--color-neutral-5); white-space:nowrap;}\
.cf-stp .k .cmp-dot{width:5px; height:5px; border-radius:99px;}\
.cf-stp .c{display:inline-flex; align-items:center; border:1px solid var(--color-neutral-3); border-radius:var(--radius-pill); overflow:hidden; background:var(--color-neutral-1);}\
.cf-stp .c.is-set{border-color:var(--color-obsidian);}\
.cf-stp button{width:26px; height:30px; border:0; background:transparent; font:inherit; font-size:14px; color:var(--color-neutral-5); cursor:pointer;}\
.cf-stp button:hover{background:var(--color-neutral-2); color:var(--color-neutral-9);}\
.cf-stp button:focus-visible{outline:2px solid var(--color-obsidian); outline-offset:-2px;}\
.cf-stp input{width:28px; height:30px; border:0; text-align:center; font:inherit; font-size:var(--text-caption-size); font-weight:700; color:var(--color-neutral-9); background:transparent; -moz-appearance:textfield;}\
.cf-stp input::-webkit-outer-spin-button, .cf-stp input::-webkit-inner-spin-button{-webkit-appearance:none; margin:0;}\
.cf-stp input:focus{outline:none;}\
.cf-asksum{display:flex; align-items:baseline; justify-content:space-between; gap:var(--spacing-12); margin-top:var(--spacing-16); padding-top:var(--spacing-12); border-top:1px solid var(--color-neutral-3); font-size:var(--text-body2-size); color:var(--color-neutral-5);}\
.cf-asksum b{color:var(--color-neutral-9); font-weight:800; font-size:var(--text-h5-size);}\
.cf-askempty{padding:var(--spacing-24); text-align:center; font-size:var(--text-body2-size); color:var(--color-neutral-5); border:1px dashed var(--color-neutral-3); border-radius:var(--radius-md);}\
.cf-foot{display:flex; align-items:center; gap:var(--spacing-8); padding:var(--spacing-16) var(--spacing-24); border-top:1px solid var(--color-neutral-3); background:var(--color-neutral-1);}\
.cf-foot .grow{flex:1;}\
.cf-foot .cf-skip{font-size:var(--text-caption-size); color:var(--color-neutral-5); background:transparent; border:0; font-family:inherit; cursor:pointer; text-decoration:underline; text-underline-offset:3px;}\
.cf-foot .cf-skip:hover{color:var(--color-neutral-9);}\
.cf-brandwrap{position:relative; display:block; width:100%;}\
.cf-brandwrap input{width:100%; box-sizing:border-box; padding-right:44px;}\
.cf-brandmark{position:absolute; right:6px; top:50%; transform:translateY(-50%); width:30px; height:30px; border-radius:var(--radius-sm);\
  background:var(--color-neutral-1); border:1px solid var(--color-neutral-3); display:flex; align-items:center; justify-content:center; overflow:hidden;\
  animation:cf-pop 240ms var(--ease-settle) both;}\
.cf-brandmark[hidden]{display:none;}\
.cf-brandmark img{width:20px; height:20px; object-fit:contain;}\
@keyframes cf-pop{from{opacity:0; transform:translateY(-50%) scale(.8);} to{opacity:1; transform:translateY(-50%) scale(1);}}\
@media (max-width:640px){ .cf-grid{grid-template-columns:1fr;} .cf-askrow{grid-template-columns:1fr;} .cf-tiers{grid-template-columns:repeat(4, minmax(0, 1fr));} .cf-stepbtn .lbl{display:none;} .cf-stepbtn.is-on .lbl{display:inline;} }';

  var HTML = '\
<div class="c-cbrief-scrim" id="cfScrim">\
  <div class="c-cbrief cf-sheet" role="dialog" aria-modal="true" aria-labelledby="cfTitle">\
    <div class="cf-head">\
      <button class="c-cbrief-close" type="button" id="cfClose" aria-label="Close form"><i class="ph ph-x"></i></button>\
      <span class="c-herocard-eyebrow" id="cfEyebrow">New campaign</span>\
      <h3 id="cfTitle">Add new campaign</h3>\
      <p class="c-cbrief-source" id="cfSub">Start with the basics; the ask and the numbers can follow.</p>\
      <div class="cf-steps" id="cfSteps" role="tablist" aria-label="Form steps"></div>\
    </div>\
    <div class="cf-body">\
      <section class="cf-step is-on" data-step="1" role="tabpanel">\
        <div class="cf-grid">\
          <div class="c-field span2" id="cfFieldName"><label for="cf-name">Campaign name<span class="required-mark">*</span></label>\
            <input id="cf-name" placeholder="e.g. Raya 2026 Influencer Push" /><span class="c-helper" hidden id="cfNameHelp">A name is required.</span></div>\
          <div class="c-field"><label for="cf-brand">Brand<span class="opt">(optional)</span></label>\
            <div class="cf-brandwrap"><input id="cf-brand" placeholder="e.g. Nestlé MY" autocomplete="organization" />\
              <span class="cf-brandmark" id="cfBrandMark" hidden title="Logo resolved from the brand name"><img id="cfBrandImg" alt="" /></span></div></div>\
          <div class="c-field"><label for="cf-agency">Agency<span class="opt">(optional)</span></label>\
            <input id="cf-agency" placeholder="e.g. Wavemaker" /></div>\
          <div class="c-field"><label for="cf-pic">PIC</label>\
            <select id="cf-pic"></select></div>\
          <div class="c-field"><label>Campaign type</label>\
            <div class="cf-checks" id="cfTypes"></div></div>\
          <div class="c-field" id="cfFieldStart"><label for="cf-start">Start date</label>\
            <input id="cf-start" type="date" /></div>\
          <div class="c-field" id="cfFieldEnd"><label for="cf-end">End date</label>\
            <input id="cf-end" type="date" /><span class="c-helper" hidden id="cfEndHelp">The end date is before the start.</span></div>\
          <div class="c-field span2"><label for="cf-desc">Description<span class="opt">(optional)</span></label>\
            <textarea id="cf-desc" rows="2" placeholder="What the campaign is for, in a line or two"></textarea></div>\
          <label class="cf-lead" id="cfLead">\
            <span class="c-switch-track" id="cfLeadSwitch" role="switch" aria-checked="false" tabindex="0"><span class="c-switch-thumb"></span></span>\
            <span><span class="t">This is a lead — not won yet</span><span class="s">It sits ahead of the pipeline and stays out of active counts until you mark it won.</span></span>\
          </label>\
        </div>\
      </section>\
      <section class="cf-step" data-step="2" role="tabpanel">\
        <p class="cf-intro">What do you need from the client? Turn on the channels, then set how many creators of each tier. Pax and platforms follow from this.</p>\
        <div class="cf-plats" id="cfPlats" role="group" aria-label="Channels"></div>\
        <div id="cfAsk"></div>\
        <div class="cf-asksum" id="cfAskSum"></div>\
      </section>\
      <section class="cf-step" data-step="3" role="tabpanel">\
        <p class="cf-intro">The commercial side. Leave anything you do not have yet.</p>\
        <div class="cf-grid">\
          <div class="c-field"><label for="cf-io">Campaign IO</label>\
            <input id="cf-io" placeholder="KULT-2026-00031" /></div>\
          <div class="c-field"><label for="cf-stage">Stage</label>\
            <select id="cf-stage"></select></div>\
          <div class="c-field"><label for="cf-quote">Quote (RM)</label>\
            <input id="cf-quote" inputmode="numeric" placeholder="e.g. 12,000" /></div>\
          <div class="c-field"><label for="cf-cost">Cost (RM)</label>\
            <input id="cf-cost" inputmode="numeric" placeholder="e.g. 7,500" /></div>\
          <div class="c-field"><label for="cf-sales">Salesperson<span class="opt">(optional)</span></label>\
            <input id="cf-sales" placeholder="e.g. Amir Rahman" /></div>\
          <div class="c-field"><label for="cf-overseer">Overseer</label>\
            <select id="cf-overseer"></select></div>\
          <div class="c-field"><label for="cf-picpct">PIC %</label>\
            <input id="cf-picpct" inputmode="numeric" placeholder="e.g. 70" /></div>\
          <div class="c-field"><label for="cf-ovpct">Overseer %</label>\
            <input id="cf-ovpct" inputmode="numeric" placeholder="Pick an overseer first" disabled /></div>\
          <div class="c-field span2"><label for="cf-remarks">Remarks</label>\
            <input id="cf-remarks" placeholder="" /></div>\
        </div>\
      </section>\
    </div>\
    <div class="cf-foot">\
      <button class="c-btn c-btn-ghost c-btn-md" type="button" id="cfBack"><i class="ph ph-arrow-left"></i> Back</button>\
      <span class="grow"></span>\
      <button class="cf-skip" type="button" id="cfSkip" hidden>Skip for now</button>\
      <button class="c-btn c-btn-ghost c-btn-md" type="button" id="cfCancel">Cancel</button>\
      <button class="c-btn c-btn-primary c-btn-md" type="button" id="cfNext">Next: the ask <i class="ph ph-arrow-right"></i></button>\
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
  var onSave = null, editing = null, wasLead = false;
  var step = 1, isLead = false, color = 'obsidian';
  var plats = [];            /* channels turned on, in order */
  var ask = {};              /* platform -> tier -> count */

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
  function checks(hostEl, list, on) {
    hostEl.innerHTML = list.map(function (o) {
      var v = typeof o === 'string' ? o : o.key, l = typeof o === 'string' ? o : o.label;
      var is = on.indexOf(v) > -1;
      return '<label class="cf-check" data-v="' + esc(v) + '"><span class="c-checkbox-box' + (is ? ' on' : '') + '">' +
        (is ? '<i class="ph ph-check"></i>' : '') + '</span>' + esc(l) + '</label>';
    }).join('');
  }
  function checked(hostEl) {
    return Array.prototype.map.call(hostEl.querySelectorAll('.cf-check'), function (l) {
      return l.querySelector('.c-checkbox-box').classList.contains('on') ? l.dataset.v : null;
    }).filter(Boolean);
  }

  /* ── Steps. A lead has two; everything else three. */
  function stepCount() { return isLead ? 2 : 3; }
  var STEP_META = [
    {n: 1, label: 'Basics', next: 'Next: the ask'},
    {n: 2, label: 'The ask', next: 'Next: commercials'},
    {n: 3, label: 'Commercials', next: ''}
  ];
  function renderSteps() {
    var count = stepCount();
    F('cfSteps').innerHTML = STEP_META.slice(0, count).map(function (m, i) {
      var cls = m.n < step ? 'is-done' : m.n === step ? 'is-on' : '';
      var ind = m.n < step ? '<span class="c-step-indicator completed"><i class="ph ph-check"></i></span>'
        : m.n === step ? '<span class="c-step-indicator active">' + m.n + '</span>'
        : '<span class="c-step-indicator upcoming">' + m.n + '</span>';
      return (i ? '<span class="cf-stepline' + (m.n <= step ? ' is-done' : '') + '"></span>' : '') +
        '<button type="button" class="cf-stepbtn ' + cls + '" data-go="' + m.n + '" role="tab" aria-selected="' + (m.n === step) + '">' + ind + '<span class="lbl">' + m.label + '</span></button>';
    }).join('');
    document.querySelectorAll('.cf-step').forEach(function (p) { p.classList.toggle('is-on', Number(p.dataset.step) === step); });
    F('cfBack').style.visibility = step > 1 ? '' : 'hidden';
    var last = step === count;
    F('cfNext').innerHTML = last
      ? (editing ? 'Save changes' : '<i class="ph ph-check"></i> Create ' + (isLead ? 'lead' : 'campaign'))
      : STEP_META[step - 1].next + ' <i class="ph ph-arrow-right"></i>';
    F('cfSkip').hidden = !(step === 2 && !last && !M.slotsOf({requirement: ask}).length);
    F('cfSub').textContent = step === 1
      ? (editing ? 'Update the basics, the ask or the numbers.' : 'Start with the basics; the ask and the numbers can follow.')
      : step === 2 ? 'This is what the client picks against. It drives pax and platforms.'
      : 'Leave anything you do not have yet.';
    var body = scrim.querySelector('.cf-body'); if (body) body.scrollTop = 0;
  }
  function goto(n) {
    if (n > step && !validateStep(step)) return;
    step = Math.max(1, Math.min(stepCount(), n));
    renderSteps();
    if (step === 1) setTimeout(function () { F('cf-name').focus(); }, 60);
  }

  /* ── Step 2: the ask. */
  function renderAsk() {
    F('cfPlats').innerHTML = S.PLATFORMS.map(function (p) {
      var on = plats.indexOf(p.key) > -1;
      return '<button type="button" class="c-chip c-chip-filter' + (on ? ' is-active' : '') + '" data-plat="' + p.key + '" aria-pressed="' + on + '">' + PLAT_ICON[p.key] + p.label + '</button>';
    }).join('');
    F('cfAsk').innerHTML = plats.length ? plats.map(function (pk) {
      var row = ask[pk] || {};
      return '<div class="cf-askrow"><span class="pl">' + PLAT_ICON[pk] + PLAT_LABEL[pk] + '</span><div class="cf-tiers">' +
        T.TIERS.map(function (t) {
          var v = Number(row[t.key]) || 0;
          return '<div class="cf-stp"><span class="k"><span class="cmp-dot" style="background:' + t.dot + '"></span>' + t.name + '</span>' +
            '<span class="c' + (v ? ' is-set' : '') + '"><button type="button" data-dec="' + pk + '/' + t.key + '" aria-label="Fewer ' + t.name + ' on ' + PLAT_LABEL[pk] + '">−</button>' +
            '<input type="number" min="0" inputmode="numeric" value="' + v + '" data-ask="' + pk + '/' + t.key + '" aria-label="' + t.name + ' on ' + PLAT_LABEL[pk] + '" />' +
            '<button type="button" data-inc="' + pk + '/' + t.key + '" aria-label="More ' + t.name + ' on ' + PLAT_LABEL[pk] + '">+</button></span></div>';
        }).join('') + '</div></div>';
    }).join('') : '<div class="cf-askempty">Turn on a channel above to set the ask. You can also skip this and set it later from the campaign page.</div>';
    var slots = M.slotsOf({requirement: cleanAsk()});
    var total = slots.reduce(function (a, s) { return a + s.want; }, 0);
    var chans = {}; slots.forEach(function (s) { chans[s.platform] = 1; });
    var n = Object.keys(chans).length;
    F('cfAskSum').innerHTML = total
      ? '<span><b>' + total + '</b> ' + (total === 1 ? 'slot' : 'slots') + ' across <b>' + n + '</b> ' + (n === 1 ? 'channel' : 'channels') + '</span><span>' +
        slots.map(function (s) { return PLAT_LABEL[s.platform] + ' ' + T.tierByKey(s.tier).name + ' ×' + s.want; }).join(' · ') + '</span>'
      : '<span>No slots yet</span><span>Pax will read as — until you set the ask.</span>';
    F('cfSkip').hidden = !(step === 2 && step !== stepCount() && !total);
  }
  /* Only channels that are on, only tiers above zero. */
  function cleanAsk() {
    var out = {};
    plats.forEach(function (pk) {
      var row = ask[pk] || {};
      T.TIERS.forEach(function (t) {
        var v = Math.max(0, Math.floor(Number(row[t.key]) || 0));
        if (v) { out[pk] = out[pk] || {}; out[pk][t.key] = v; }
      });
    });
    return out;
  }
  function bump(key, delta) {
    var parts = key.split('/'), pk = parts[0], tk = parts[1];
    ask[pk] = ask[pk] || {};
    ask[pk][tk] = Math.max(0, (Number(ask[pk][tk]) || 0) + delta);
    renderAsk();
  }

  /* ── Lead switch. */
  function setLead(on) {
    isLead = on;
    F('cfLead').classList.toggle('is-on', on);
    F('cfLeadSwitch').classList.toggle('on', on);
    F('cfLeadSwitch').setAttribute('aria-checked', String(on));
    if (step > stepCount()) step = stepCount();
    renderSteps();
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
    updateBrandMark(F('cf-brand').value);
    F('cf-agency').value = r.agency || '';
    F('cf-desc').value = r.description || '';
    F('cf-pic').value = r.pic || S.TEAM[0];
    F('cf-sales').value = r.salesperson || '';
    F('cf-start').value = r.start || '';
    F('cf-end').value = r.end || '';
    F('cf-io').value = r.io || '';
    checks(F('cfTypes'), S.TYPES, r.types || ['Influencers']);
    F('cf-stage').value = (r.stage && r.stage !== 'lead') ? r.stage : 'sourcing';
    F('cf-overseer').value = r.overseer || '';
    F('cf-quote').value = r.quote == null ? '' : r.quote;
    F('cf-cost').value = r.cost == null ? '' : r.cost;
    F('cf-picpct').value = r.picPct == null ? '' : r.picPct;
    var ov = F('cf-ovpct');
    delete ov.dataset.touched;
    ov.value = r.overseerPct == null ? '' : r.overseerPct;
    if (r.overseerPct != null) ov.dataset.touched = '1';
    F('cf-remarks').value = r.remarks || '';
    color = r.color || 'obsidian';
    /* The ask: channels come from the requirement, or from the legacy
       platforms list so an old record still shows its channels turned on. */
    ask = JSON.parse(JSON.stringify(r.requirement || {}));
    plats = Object.keys(ask);
    (r.platforms || []).forEach(function (p) { if (plats.indexOf(p) < 0 && PLAT_LABEL[p]) plats.push(p); });
    wasLead = r.stage === 'lead';
    setLead(wasLead);
    syncOverseer();
    F('cfFieldName').classList.remove('c-field-error'); F('cfNameHelp').hidden = true;
    F('cfFieldEnd').classList.remove('c-field-error'); F('cfEndHelp').hidden = true;
    renderAsk();
  }
  function read() {
    var pp = S.num(F('cf-picpct').value);
    var overseer = F('cf-overseer').value;
    var requirement = cleanAsk();
    var slots = M.slotsOf({requirement: requirement});
    var stage = isLead ? 'lead' : (F('cf-stage').value || 'sourcing');
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
      stage: stage,
      types: checked(F('cfTypes')),
      requirement: requirement,
      platforms: Object.keys(requirement).length ? Object.keys(requirement) : plats.slice(),
      pax: slots.length ? M.derivedPax({requirement: requirement}) : null,
      overseer: overseer,
      quote: S.num(String(F('cf-quote').value).replace(/,/g, '')),
      cost: S.num(String(F('cf-cost').value).replace(/,/g, '')),
      picPct: pp == null ? 100 : pp,
      overseerPct: overseer ? S.num(F('cf-ovpct').value) : null,
      remarks: F('cf-remarks').value.trim()
    };
  }
  function validateStep(n) {
    if (n !== 1) return true;
    var name = F('cf-name').value.trim();
    var start = F('cf-start').value, end = F('cf-end').value;
    var bad = !name;
    F('cfFieldName').classList.toggle('c-field-error', bad); F('cfNameHelp').hidden = !bad;
    var badEnd = !!(start && end && end < start);
    F('cfFieldEnd').classList.toggle('c-field-error', badEnd); F('cfEndHelp').hidden = !badEnd;
    if (bad) { F('cf-name').focus(); return false; }
    if (badEnd) { F('cf-end').focus(); return false; }
    return true;
  }
  function close() {
    scrim.classList.remove('is-open');
    onSave = null; editing = null;
  }
  function submit() {
    if (!validateStep(1)) { goto(1); return; }
    var rec = read();
    var cb = onSave, id = editing;
    close();
    if (cb) cb(rec, id);
  }

  opts(F('cf-pic'), S.TEAM);
  opts(F('cf-overseer'), S.TEAM, '—');
  opts(F('cf-stage'), S.STAGES.filter(function (s) { return s.key !== 'lead'; }));

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
    var go = e.target.closest('[data-go]');
    if (go) { goto(Number(go.dataset.go)); return; }
    var pl = e.target.closest('[data-plat]');
    if (pl) {
      var k = pl.dataset.plat, i = plats.indexOf(k);
      if (i > -1) plats.splice(i, 1); else plats.push(k);
      renderAsk(); return;
    }
    var inc = e.target.closest('[data-inc]'); if (inc) { bump(inc.dataset.inc, 1); return; }
    var dec = e.target.closest('[data-dec]'); if (dec) { bump(dec.dataset.dec, -1); return; }
  });
  /* The lead switch is a label wrapping a switch; stop the label's default
     so one click does not toggle twice. */
  F('cfLead').addEventListener('click', function (e) { e.preventDefault(); setLead(!isLead); });
  F('cfLeadSwitch').addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setLead(!isLead); }
  });
  F('cfAsk').addEventListener('input', function (e) {
    var inp = e.target.closest('[data-ask]'); if (!inp) return;
    var parts = inp.dataset.ask.split('/');
    ask[parts[0]] = ask[parts[0]] || {};
    ask[parts[0]][parts[1]] = Math.max(0, Math.floor(Number(inp.value) || 0));
    var slots = M.slotsOf({requirement: cleanAsk()});
    var total = slots.reduce(function (a, s) { return a + s.want; }, 0);
    inp.closest('.c').classList.toggle('is-set', !!(Number(inp.value) || 0));
    F('cfSkip').hidden = !(step === 2 && step !== stepCount() && !total);
  });
  F('cfAsk').addEventListener('change', renderAsk);
  F('cf-overseer').addEventListener('change', syncOverseer);
  F('cf-picpct').addEventListener('input', function () { delete F('cf-ovpct').dataset.touched; syncOverseer(); });
  F('cf-ovpct').addEventListener('input', function () { F('cf-ovpct').dataset.touched = '1'; });
  /* Brand logo chip — debounced so typing does not spray requests; the
     img's own load/error events decide visibility, via the shell's
     collabBrand chain. Same recipe as the media planner. */
  var brandMarkTimer = null;
  function updateBrandMark(brand) {
    clearTimeout(brandMarkTimer);
    var mark = F('cfBrandMark'), img = F('cfBrandImg');
    if (!mark || !img || !window.collabBrand) return;
    brand = String(brand || '').trim();
    if (!brand) { mark.hidden = true; img.dataset.brand = ''; return; }
    brandMarkTimer = setTimeout(function () {
      if (img.dataset.brand === brand) return;
      img.dataset.brand = brand; mark.hidden = true;
      window.collabBrand.attach(img, brand, function (ok) {
        if (img.dataset.brand === brand) mark.hidden = !ok;
      });
    }, 400);
  }
  F('cf-brand').addEventListener('input', function () { updateBrandMark(this.value); });
  F('cf-name').addEventListener('input', function () {
    if (F('cf-name').value.trim()) { F('cfFieldName').classList.remove('c-field-error'); F('cfNameHelp').hidden = true; }
  });
  F('cfBack').addEventListener('click', function () { goto(step - 1); });
  F('cfSkip').addEventListener('click', function () { goto(step + 1); });
  F('cfNext').addEventListener('click', function () {
    if (step === stepCount()) submit(); else goto(step + 1);
  });

  window.campaignForm = {
    /* open({rec, draft, onSave, step}) — rec is null for a new campaign;
       step opens on a given step (2 = the ask). onSave(fields, editingId). */
    open: function (o) {
      o = o || {};
      editing = o.rec ? o.rec.id : null;
      onSave = o.onSave || null;
      F('cfEyebrow').textContent = editing ? 'Edit campaign' : 'New influencer campaign';
      F('cfTitle').textContent = editing ? o.rec.name : 'Add new campaign';
      fill(o.rec || o.draft || null);
      step = 1;
      if (o.step) step = Math.max(1, Math.min(stepCount(), o.step));
      renderSteps();
      scrim.classList.add('is-open');
      if (step === 1) setTimeout(function () { F('cf-name').focus(); }, 260);
    },
    close: close,
    isOpen: function () { return scrim.classList.contains('is-open'); }
  };
})();
