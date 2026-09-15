/* Campaign form — the stepped Add / Edit form, shared by the list and
   the campaign page. One module so both open the identical form; it
   injects its own markup and styles and hands the caller a clean record.
   It lives inside the shared fold-out modal (swing-modal.js): the form
   flies out of the button that opened it and folds back on close, the
   way a profile does on the influencers page.

   Three steps, in order of importance: Basics (what it is, who runs it,
   when), The ask (what we need from the client, per channel and tier —
   pax and platforms derive from this and are never typed), Commercials
   (IO, money, the split). A lead is a switch on step 1, not a stage to
   find in a dropdown; leads skip Commercials.

   Contract: open({rec, draft, onSave, step, anchor}); onSave(fields,
   editingId). `anchor` is the element the form should fold out of. `fields` carries `requirement`, and `pax` and
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
.cf-sheet{display:flex; flex-direction:column; flex:1; min-height:0;}\
.cf-head{flex:none; padding:var(--spacing-24) var(--spacing-48) var(--spacing-16) var(--spacing-24); border-bottom:1px solid var(--color-neutral-3);}\
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
.cf-body{flex:1; min-height:0; padding:var(--spacing-24); overflow-y:auto;}\
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
.cf-foot{flex:none; display:flex; align-items:center; gap:var(--spacing-8); padding:var(--spacing-16) var(--spacing-24); border-top:1px solid var(--color-neutral-3); background:var(--color-neutral-1);}\
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
.cf-lines{border:1px solid var(--color-neutral-3); border-radius:var(--radius-md); background:var(--color-neutral-1);}\
.cf-line-h{border-radius:var(--radius-md) var(--radius-md) 0 0;}\
.cf-line-foot{border-radius:0 0 var(--radius-md) var(--radius-md);}\
.cf-line:has(.cf-dd.open){position:relative; z-index:8;}\
.cf-line-h, .cf-line{display:grid; grid-template-columns:1.1fr 1.5fr 112px 36px; gap:var(--spacing-8); align-items:center; padding:8px var(--spacing-12);}\
.cf-line-h{font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:var(--tracking-eyebrow); color:var(--color-neutral-5); background:var(--color-neutral-2); border-bottom:1px solid var(--color-neutral-3);}\
.cf-line{border-bottom:1px solid var(--color-neutral-2); animation:cf-row 220ms var(--ease-settle) both;}\
@keyframes cf-row{from{opacity:0; transform:translateY(-4px);} to{opacity:1; transform:none;}}\
.cf-line select, .cf-line input{height:36px; width:100%; box-sizing:border-box; border:1px solid var(--color-neutral-3); border-radius:var(--radius-sm); font:inherit; font-size:var(--text-body2-size); color:var(--color-neutral-9); padding:0 10px; background:var(--color-neutral-1);}\
.cf-line select{appearance:none; -webkit-appearance:none; padding-right:26px; background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'%3E%3Cpath d=\'M1 1l4 4 4-4\' fill=\'none\' stroke=\'%23777\' stroke-width=\'1.5\'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center;}\
.cf-line select.is-empty{color:var(--color-neutral-5);}\
.cf-line input{text-align:center; font-weight:800; -moz-appearance:textfield;}\
.cf-line input::-webkit-outer-spin-button, .cf-line input::-webkit-inner-spin-button{-webkit-appearance:none; margin:0;}\
.cf-line select:focus, .cf-line input:focus{outline:none; border-color:var(--color-obsidian); box-shadow:var(--shadow-focus);}\
.cf-line .rm{width:32px; height:32px; border:0; background:transparent; border-radius:var(--radius-sm); color:var(--color-neutral-5); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:15px;}\
.cf-line .rm:hover{background:rgba(253,51,67,.08); color:var(--color-red);}\
.cf-line-foot{display:flex; flex-wrap:wrap; align-items:center; gap:var(--spacing-8); padding:10px var(--spacing-12); background:var(--color-neutral-2); border-top:1px solid var(--color-neutral-3);}\
.cf-line-foot .hint{margin-left:auto; font-size:var(--text-caption-size); color:var(--color-neutral-5);}\
.cf-line-foot .hint kbd{font:inherit; padding:0 5px; border:1px solid var(--color-neutral-3); border-radius:4px; background:var(--color-neutral-1);}\
.cf-asksum{margin-top:var(--spacing-16); display:flex; flex-direction:column; gap:0;}\
.cf-asksum .tot{margin-bottom:var(--spacing-4);}\
.cf-asksum .tot{display:flex; align-items:baseline; gap:6px; font-size:var(--text-body2-size); color:var(--color-neutral-5);}\
.cf-asksum .tot b{font-size:var(--text-h4-size); font-weight:800; color:var(--color-neutral-9);}\
.cf-asksum .ch{display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; padding:8px 0; border-top:1px solid var(--color-neutral-2);}\
.cf-asksum .tot + .ch{border-top:1px solid var(--color-neutral-3); margin-top:4px;}\
.cf-asksum .ch .nm{display:inline-flex; align-items:center; gap:6px; font-weight:700; color:var(--color-neutral-9); min-width:118px;}\
.cf-asksum .ch .nm i{font-size:var(--icon-sm);}\
.cf-asksum .pill{display:inline-flex; align-items:center; gap:4px; height:22px; padding:0 8px; border-radius:var(--radius-pill); background:var(--color-neutral-2); font-size:var(--text-caption-size); font-weight:700; color:var(--color-neutral-9);}\
.cf-asksum .pill .cmp-dot{width:5px; height:5px; border-radius:99px;}\
.cf-asksum .ch .n{margin-left:auto; font-weight:800; color:var(--color-neutral-9); font-variant-numeric:tabular-nums;}\
.cf-asksum .none{font-size:var(--text-body2-size); color:var(--color-neutral-5);}\
.cf-dp{position:relative;}\
.cf-dp .c-dp-trigger{width:100%; cursor:pointer; text-align:left; transition:border-color var(--duration-fast) var(--ease-standard);}\
.cf-dp .c-dp-trigger:hover{border-color:var(--color-neutral-4);}\
.cf-dp .c-dp-trigger:focus-visible{outline:2px solid var(--color-obsidian); outline-offset:2px;}\
.cf-dp .c-dp-trigger [data-dp-label].is-placeholder{color:var(--color-neutral-5);}\
.cf-dp .c-dp-trigger [data-dp-label]{flex:1;}\
.cf-dp-native{position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; border:0; padding:0; margin:0;}\
.cf-dp-panel{position:absolute; left:0; top:calc(100% + 4px); z-index:6;}\
.cf-dp-panel.is-up{top:auto; bottom:calc(100% + 4px);}\
.cf-dp-panel[hidden]{display:none;}\
.cf-dp .c-icon-btn{width:32px; height:32px;}\
.cf-line .cf-dd .c-dropdown-input{height:36px;}\
.cf-line .cf-dd.is-empty .c-dropdown-input{color:var(--color-neutral-5);}\
.cf-io{display:flex; align-items:stretch;}\
.cf-io .pre{display:flex; align-items:center; padding:0 10px; height:40px; border:1px solid var(--color-neutral-3); border-right:0; border-radius:var(--radius-sm) 0 0 var(--radius-sm); background:var(--color-neutral-2); font-size:var(--text-body2-size); font-weight:700; color:var(--color-neutral-6); white-space:nowrap; font-variant-numeric:tabular-nums;}\
.cf-io input{flex:1; min-width:0; border-radius:0 var(--radius-sm) var(--radius-sm) 0 !important; font-variant-numeric:tabular-nums; font-weight:700;}\
.cf-io-hint{display:flex; align-items:center; gap:6px; margin-top:6px; font-size:var(--text-caption-size); color:var(--color-neutral-5);}\
.cf-io-hint button{border:0; background:transparent; padding:0; font:inherit; font-size:inherit; font-weight:700; color:var(--color-neutral-9); text-decoration:underline; text-underline-offset:2px; cursor:pointer;}\
.cf-money{font-variant-numeric:tabular-nums;}\
@media (max-width:640px){ .cf-grid{grid-template-columns:1fr;} .cf-line-h, .cf-line{grid-template-columns:1fr 1fr 80px 32px;} .cf-stepbtn .lbl{display:none;} .cf-stepbtn.is-on .lbl{display:inline;} }';

  var HTML = '\
  <div class="cf-sheet" id="cfSheet">\
    <div class="cf-head">\
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
          <div class="c-field cf-dp" id="cfFieldStart"><label for="dpTrig-cf-start">Start date</label>\
            <button type="button" class="c-dp-trigger" id="dpTrig-cf-start" aria-haspopup="dialog" aria-expanded="false"><i class="ph-fill ph-calendar"></i><span data-dp-label class="is-placeholder">Pick a date</span></button>\
            <input id="cf-start" type="date" class="cf-dp-native" tabindex="-1" aria-hidden="true" />\
            <div class="c-dp-panel cf-dp-panel" id="dpPanel-cf-start" hidden role="dialog" aria-label="Start date calendar"></div></div>\
          <div class="c-field cf-dp" id="cfFieldEnd"><label for="dpTrig-cf-end">End date</label>\
            <button type="button" class="c-dp-trigger" id="dpTrig-cf-end" aria-haspopup="dialog" aria-expanded="false"><i class="ph-fill ph-calendar"></i><span data-dp-label class="is-placeholder">Pick a date</span></button>\
            <input id="cf-end" type="date" class="cf-dp-native" tabindex="-1" aria-hidden="true" />\
            <div class="c-dp-panel cf-dp-panel" id="dpPanel-cf-end" hidden role="dialog" aria-label="End date calendar"></div>\
            <span class="c-helper" hidden id="cfEndHelp">The end date is before the start.</span></div>\
          <div class="c-field span2"><label for="cf-desc">Description<span class="opt">(optional)</span></label>\
            <textarea id="cf-desc" rows="2" placeholder="What the campaign is for, in a line or two"></textarea></div>\
          <label class="cf-lead" id="cfLead">\
            <span class="c-switch-track" id="cfLeadSwitch" role="switch" aria-checked="false" tabindex="0"><span class="c-switch-thumb"></span></span>\
            <span><span class="t">This is a lead — not won yet</span><span class="s">It sits ahead of the pipeline and stays out of active counts until you mark it won.</span></span>\
          </label>\
        </div>\
      </section>\
      <section class="cf-step" data-step="2" role="tabpanel">\
        <p class="cf-intro">What do you need from the client? One line per channel and tier, with how many creators. Pax and platforms follow from this.</p>\
        <div id="cfAsk"></div>\
        <div class="cf-asksum" id="cfAskSum"></div>\
      </section>\
      <section class="cf-step" data-step="3" role="tabpanel">\
        <p class="cf-intro">The commercial side. Leave anything you do not have yet.</p>\
        <div class="cf-grid">\
          <div class="c-field"><label for="cf-io">Campaign IO</label>\
            <div class="cf-io"><span class="pre" id="cfIoPre">KULT-2026-</span><input id="cf-io" inputmode="numeric" placeholder="0001" autocomplete="off" /></div>\
            <div class="cf-io-hint" id="cfIoHint" hidden></div></div>\
          <div class="c-field"><label for="cf-stage">Stage</label>\
            <select id="cf-stage"></select></div>\
          <div class="c-field"><label for="cf-quote">Quote (RM)</label>\
            <input id="cf-quote" class="cf-money" inputmode="numeric" placeholder="e.g. 12,000" /></div>\
          <div class="c-field"><label for="cf-cost">Cost (RM)</label>\
            <input id="cf-cost" class="cf-money" inputmode="numeric" placeholder="e.g. 7,500" /></div>\
          <div class="c-field"><label for="cf-sales">Salesperson<span class="opt">(optional)</span></label>\
            <select id="cf-sales"></select></div>\
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
  </div>';

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  /* The form is built once and kept off the page; open() drops it into
     the modal's body, close() leaves it there until the modal empties
     itself. Lookups go through the sheet so they work detached too. */
  var host = document.createElement('div');
  host.innerHTML = HTML;
  var sheet = host.firstElementChild;

  var F = function (id) { return sheet.querySelector('#' + id); };
  function modal() { return window.swingModal; }
  /* An open dropdown or date picker takes Escape and the backdrop first. */
  function popoverOpen() {
    return !!((window.collabDropdown && window.collabDropdown.isOpen && window.collabDropdown.isOpen()) ||
      sheet.querySelector('.cf-dp-panel:not([hidden])'));
  }
  var onSave = null, editing = null, wasLead = false;
  var step = 1, isLead = false, color = 'obsidian';
  var plats = [];            /* channels with an ask, derived from the lines */
  var lines = [];            /* the ask as typed: [{plat, tier, n}] */
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
  /* Money fields carry thousands separators as you type; read() strips
     them. Digits only — the decimals nobody enters here are not worth
     the caret gymnastics. */
  function fmtMoney(v) {
    var d = String(v == null ? '' : v).replace(/[^\d]/g, '');
    return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
  }
  function bindMoney(inp) {
    inp.addEventListener('input', function () {
      var atEnd = inp.selectionStart === inp.value.length;
      inp.value = fmtMoney(inp.value);
      if (atEnd) inp.setSelectionRange(inp.value.length, inp.value.length);
    });
  }

  /* Campaign IO is KULT-<year>-<running number>. The prefix is fixed from
     the start date's year (or this year); the box takes the number and
     pads it to four digits. An IO that does not fit the pattern is kept
     whole rather than mangled. */
  var IO_RE = /^KULT-(\d{4})-(.+)$/;
  var ioYear = null;
  function ioPrefix() {
    var y = ioYear || (F('cf-start').value || '').slice(0, 4) || String(new Date().getFullYear());
    return 'KULT-' + y + '-';
  }
  function ioNext(year) {
    var max = 0;
    S.merged().forEach(function (c) {
      var m = IO_RE.exec(c.io || ''); if (m && m[1] === year && /^\d+$/.test(m[2])) max = Math.max(max, Number(m[2]));
    });
    return String(max + 1).replace(/^(\d{1,3})$/, function (n) { return ('0000' + n).slice(-4); });
  }
  function ioRead() {
    var n = F('cf-io').value.trim();
    if (!n) return '';
    if (/^KULT-/i.test(n)) return n.toUpperCase();
    if (/^\d+$/.test(n)) return ioPrefix() + (n.length < 4 ? ('0000' + n).slice(-4) : n);
    return ioPrefix() + n;
  }
  function ioFill(io) {
    var m = IO_RE.exec(io || '');
    ioYear = m ? m[1] : null;
    F('cf-io').value = m ? m[2] : (io || '');
    paintIo();
  }
  function paintIo() {
    var pre = ioPrefix(), year = pre.slice(5, 9), next = ioNext(year);
    F('cfIoPre').textContent = pre;
    F('cf-io').placeholder = next;
    var hint = F('cfIoHint');
    if (F('cf-io').value.trim()) { hint.hidden = true; return; }
    hint.hidden = false;
    hint.innerHTML = 'Next in ' + year + ': <button type="button" data-io-next="' + next + '">' + pre + next + '</button>';
  }
  F('cfIoHint').addEventListener('click', function (e) {
    var b = e.target.closest('[data-io-next]'); if (!b) return;
    F('cf-io').value = b.dataset.ioNext; paintIo(); F('cf-io').focus();
  });
  F('cf-io').addEventListener('input', function () { if (!F('cf-io').value.trim()) ioYear = null; paintIo(); });
  F('cf-start').addEventListener('change', function () { if (!F('cf-io').value.trim()) ioYear = null; paintIo(); });
  bindMoney(F('cf-quote')); bindMoney(F('cf-cost'));

  /* ── DLS dropdown over a native select. The implementation moved to
     shared/dropdown.js when the send sheet needed the same control; this
     keeps the two call sites below reading the way they did. */
  function enhanceSelect(sel, o) { return window.collabDropdown.enhance(sel, o); }
  function closeDD() { window.collabDropdown.close(); }
  function ddSync(sel) { window.collabDropdown.sync(sel); }

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
    sheet.querySelectorAll('.cf-step').forEach(function (p) { p.classList.toggle('is-on', Number(p.dataset.step) === step); });
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
    var body = sheet.querySelector('.cf-body'); if (body) body.scrollTop = 0;
  }
  function goto(n) {
    if (n > step && !validateStep(step)) return;
    step = Math.max(1, Math.min(stepCount(), n));
    renderSteps();
    if (step === 1) setTimeout(function () { F('cf-name').focus(); }, 60);
  }

  /* ── Step 2: the ask, as lines. Each line is one channel × tier with a
     count; the requirement is the lines rolled up. Typing is the whole
     interaction, so a long ask is a column of numbers, not a grid. */
  function bracket(t) {
    var i = T.TIERS.indexOf(t);
    var lo = t.min != null ? t.min : (i > 0 ? T.TIERS[i - 1].max : null), hi = t.max;
    if (hi != null && !isFinite(hi)) hi = null;
    var f = function (n) { return n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n); };
    if (lo == null && hi == null) return '';
    if (lo == null) return 'under ' + f(hi);
    if (hi == null) return f(lo) + '+';
    return f(lo) + '–' + f(hi);
  }
  function usedTiers(plat, exceptIdx) {
    var out = {};
    lines.forEach(function (l, i) { if (i !== exceptIdx && l.plat === plat && l.tier) out[l.tier] = true; });
    return out;
  }
  function nextTier(plat) {
    var used = usedTiers(plat, -1);
    var t = T.TIERS.filter(function (x) { return !used[x.key]; })[0];
    return t ? t.key : '';
  }
  function lineHtml(l, i) {
    var used = usedTiers(l.plat, i);
    return '<div class="cf-line" data-i="' + i + '">' +
      '<select data-line="plat" aria-label="Channel">' + S.PLATFORMS.map(function (p) {
        return '<option value="' + p.key + '"' + (p.key === l.plat ? ' selected' : '') + '>' + p.label + '</option>'; }).join('') + '</select>' +
      '<select data-line="tier" class="' + (l.tier ? '' : 'is-empty') + '" aria-label="Tier"><option value=""' + (l.tier ? '' : ' selected') + '>Pick a tier</option>' + T.TIERS.map(function (t) {
        var b = bracket(t);
        return '<option value="' + t.key + '"' + (t.key === l.tier ? ' selected' : '') + (used[t.key] ? ' disabled' : '') + '>' + t.name + (b ? ' · ' + b : '') + (used[t.key] ? ' (added)' : '') + '</option>'; }).join('') + '</select>' +
      '<input type="number" min="0" inputmode="numeric" data-line="n" value="' + (l.n == null || l.n === '' ? '' : l.n) + '" placeholder="0" aria-label="How many creators" />' +
      '<button type="button" class="rm" data-line-rm aria-label="Remove line"><i class="ph ph-x"></i></button></div>';
  }
  function renderAsk() {
    if (!lines.length) lines.push({plat: S.PLATFORMS[0].key, tier: '', n: ''});
    var mirrorable = lines.filter(function (l) { return l.tier && Number(l.n) > 0; }).length > 0 && S.PLATFORMS.length > 1;
    F('cfAsk').innerHTML = '<div class="cf-lines"><div class="cf-line-h"><span>Channel</span><span>Tier</span><span>Creators</span><span></span></div>' +
      lines.map(lineHtml).join('') +
      '<div class="cf-line-foot"><button class="c-btn c-btn-secondary c-btn-sm" type="button" data-line-add><i class="ph ph-plus"></i> Add line</button>' +
      (mirrorable ? '<button class="c-btn c-btn-ghost c-btn-sm" type="button" data-line-mirror title="Copy the first channel\'s lines to the other channels"><i class="ph ph-copy"></i> Same ask on every channel</button>' : '') +
      '<span class="hint"><kbd>↵</kbd> in a count adds the next line</span></div></div>';
    F('cfAsk').querySelectorAll('select[data-line="plat"]').forEach(function (sl) { enhanceSelect(sl, {placeholder: 'Channel'}); });
    F('cfAsk').querySelectorAll('select[data-line="tier"]').forEach(function (sl) { enhanceSelect(sl, {placeholder: 'Pick a tier'}); });
    renderAskSum();
  }
  function renderAskSum() {
    var req = cleanAsk();
    var slots = M.slotsOf({requirement: req});
    var total = slots.reduce(function (a, s) { return a + s.want; }, 0);
    var chans = Object.keys(req);
    F('cfAskSum').innerHTML = total
      ? '<div class="tot"><b>' + total + '</b> ' + (total === 1 ? 'slot' : 'slots') + ' across <b>' + chans.length + '</b> ' + (chans.length === 1 ? 'channel' : 'channels') + '</div>' +
        chans.map(function (pk) {
          var n = 0, pills = T.TIERS.filter(function (t) { return req[pk][t.key]; }).map(function (t) {
            n += req[pk][t.key];
            return '<span class="pill"><span class="cmp-dot" style="background:' + t.dot + '"></span>' + t.name + ' ×' + req[pk][t.key] + '</span>';
          }).join('');
          return '<div class="ch"><span class="nm">' + PLAT_ICON[pk] + PLAT_LABEL[pk] + '</span>' + pills + '<span class="n">' + n + '</span></div>';
        }).join('')
      : '<div class="none">No slots yet — pax reads as — until you set the ask.</div>';
    F('cfSkip').hidden = !(step === 2 && step !== stepCount() && !total);
  }
  /* Lines rolled up: only rows with a tier and a count above zero. */
  function cleanAsk() {
    var out = {};
    lines.forEach(function (l) {
      var v = Math.max(0, Math.floor(Number(l.n) || 0));
      if (!l.plat || !l.tier || !v) return;
      out[l.plat] = out[l.plat] || {};
      out[l.plat][l.tier] = (out[l.plat][l.tier] || 0) + v;
    });
    plats = Object.keys(out);
    return out;
  }
  function addLine(afterIdx, plat) {
    var pk = plat || (lines[afterIdx] ? lines[afterIdx].plat : S.PLATFORMS[0].key);
    var l = {plat: pk, tier: nextTier(pk), n: ''};
    if (afterIdx == null || afterIdx >= lines.length - 1) lines.push(l); else lines.splice(afterIdx + 1, 0, l);
    renderAsk();
    var idx = lines.indexOf(l);
    var row = F('cfAsk').querySelector('.cf-line[data-i="' + idx + '"]');
    if (row) (row.querySelector(l.tier ? '[data-line="n"]' : '[data-line="tier"]')).focus();
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
    salesOptions(r.salesperson);
    F('cf-sales').value = r.salesperson || '';
    F('cf-start').value = r.start || '';
    F('cf-end').value = r.end || '';
    ioFill(r.io);
    checks(F('cfTypes'), S.TYPES, r.types || ['Influencers']);
    F('cf-stage').value = (r.stage && r.stage !== 'lead') ? r.stage : 'sourcing';
    F('cf-overseer').value = r.overseer || '';
    F('cf-quote').value = r.quote == null ? '' : fmtMoney(r.quote);
    F('cf-cost').value = r.cost == null ? '' : fmtMoney(r.cost);
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
    lines = M.slotsOf({requirement: ask}).map(function (s) { return {plat: s.platform, tier: s.tier, n: s.want}; });
    plats = Object.keys(ask);
    (r.platforms || []).forEach(function (p) { if (plats.indexOf(p) < 0 && PLAT_LABEL[p]) plats.push(p); });
    wasLead = r.stage === 'lead';
    setLead(wasLead);
    syncOverseer();
    F('cfFieldName').classList.remove('c-field-error'); F('cfNameHelp').hidden = true;
    F('cfFieldEnd').classList.remove('c-field-error'); F('cfEndHelp').hidden = true;
    dpSync();
    ['cf-pic', 'cf-stage', 'cf-overseer', 'cf-sales'].forEach(function (id) { ddSync(F(id)); });
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
      io: ioRead(),
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
  function isOpen() { return !!(modal() && modal().isOpen() && sheet.isConnected); }
  function close() {
    onSave = null; editing = null;
    if (isOpen()) modal().close();
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
  function salesOptions(keep) {
    var list = S.salespeople();
    if (keep && list.indexOf(keep) < 0) list.push(keep);
    opts(F('cf-sales'), list, '—');
  }
  salesOptions();
  enhanceSelect(F('cf-pic'), {placeholder: 'Who runs it'});
  enhanceSelect(F('cf-stage'), {placeholder: 'Stage'});
  enhanceSelect(F('cf-overseer'), {placeholder: 'Nobody'});
  enhanceSelect(F('cf-sales'), {placeholder: 'Nobody yet', addNew: 'Add a new salesperson', onAdd: function (n) { S.addSalesperson(n); }});

  F('cfCancel').addEventListener('click', close);
  sheet.addEventListener('click', function (e) {
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
    if (e.target.closest('[data-line-add]')) { addLine(lines.length - 1); return; }
    var rm = e.target.closest('[data-line-rm]');
    if (rm) { lines.splice(Number(rm.closest('.cf-line').dataset.i), 1); renderAsk(); return; }
    if (e.target.closest('[data-line-mirror]')) {
      var first = lines.filter(function (l) { return l.tier && Number(l.n) > 0; })[0];
      if (!first) return;
      var src = lines.filter(function (l) { return l.plat === first.plat && l.tier && Number(l.n) > 0; });
      S.PLATFORMS.forEach(function (p) {
        if (p.key === first.plat) return;
        src.forEach(function (l) {
          if (!lines.some(function (x) { return x.plat === p.key && x.tier === l.tier; })) lines.push({plat: p.key, tier: l.tier, n: l.n});
        });
      });
      renderAsk(); return;
    }
  });
  /* The lead switch is a label wrapping a switch; stop the label's default
     so one click does not toggle twice. */
  F('cfLead').addEventListener('click', function (e) { e.preventDefault(); setLead(!isLead); });
  F('cfLeadSwitch').addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setLead(!isLead); }
  });
  /* Counts update the summary as you type, without re-rendering the row
     you are typing in; a channel or tier change redraws so the disabled
     tier options stay honest. */
  F('cfAsk').addEventListener('input', function (e) {
    var t = e.target; if (t.dataset.line !== 'n') return;
    var l = lines[Number(t.closest('.cf-line').dataset.i)]; if (!l) return;
    l.n = t.value;
    renderAskSum();
  });
  F('cfAsk').addEventListener('change', function (e) {
    var t = e.target, row = t.closest('.cf-line'); if (!row || !t.dataset.line) return;
    var l = lines[Number(row.dataset.i)]; if (!l) return;
    if (t.dataset.line === 'plat') { l.plat = t.value; if (l.tier && usedTiers(l.plat, Number(row.dataset.i))[l.tier]) l.tier = nextTier(l.plat); renderAsk(); }
    else if (t.dataset.line === 'tier') { l.tier = t.value; renderAsk(); var n = F('cfAsk').querySelector('.cf-line[data-i="' + row.dataset.i + '"] [data-line="n"]'); if (n && !l.n) n.focus(); }
  });
  F('cfAsk').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.target.dataset.line !== 'n') return;
    e.preventDefault();
    addLine(Number(e.target.closest('.cf-line').dataset.i));
  });

  /* ── DLS date picker — the c-dp trigger/panel recipe wired to hidden
     native inputs, so every reader of F('cf-start').value keeps working.
     Both panels shade the start-to-end range. Same recipe as the media
     planner. */
  var dpSyncs = [];
  function dpSync() { dpSyncs.forEach(function (f) { f(); }); }
  function initDatePicker(fieldId, opts) {
    var input = F(fieldId), trig = F('dpTrig-' + fieldId), panel = F('dpPanel-' + fieldId);
    var labelSpan = trig.querySelector('[data-dp-label]');
    var view = null;
    function parseISO(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function fmtDay(d) { return d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}); }
    function sameDay(a, b) { return a && b && a.getTime() === b.getTime(); }
    function render() {
      var sel = parseISO(input.value);
      var base = view || sel || new Date();
      view = new Date(base.getFullYear(), base.getMonth(), 1);
      var start = parseISO(F('cf-start').value), end = parseISO(F('cf-end').value);
      var minD = opts && opts.minFrom ? parseISO(F(opts.minFrom).value) : null;
      var now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var html = '<div class="c-dp-header">' +
        '<button class="c-icon-btn" type="button" data-nav="-1" aria-label="Previous month"><i class="ph ph-caret-left"></i></button>' +
        '<h5>' + view.toLocaleDateString('en-GB', {month: 'long', year: 'numeric'}) + '</h5>' +
        '<button class="c-icon-btn" type="button" data-nav="1" aria-label="Next month"><i class="ph ph-caret-right"></i></button></div><div class="c-dp-grid">' +
        ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(function (w) { return '<span class="c-dp-weekday">' + w + '</span>'; }).join('');
      var lead = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
      var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (var i = 0; i < lead; i++) html += '<span></span>';
      for (var d = 1; d <= days; d++) {
        var cur = new Date(view.getFullYear(), view.getMonth(), d), cls = 'c-dp-day';
        var disabled = minD && cur < minD;
        if (disabled) cls += ' disabled';
        if (sameDay(cur, today)) cls += ' today';
        if (start && end && end > start) {
          if (sameDay(cur, start)) cls += ' range-start';
          else if (sameDay(cur, end)) cls += ' range-end';
          else if (cur > start && cur < end) cls += ' range';
        } else if (sameDay(cur, sel)) cls += ' selected';
        html += '<button type="button" class="' + cls + '"' + (disabled ? ' disabled' : ' data-iso="' + iso(cur) + '"') + '>' + d + '</button>';
      }
      panel.innerHTML = html + '</div>';
    }
    function open() {
      view = parseISO(input.value) || (opts && opts.minFrom ? parseISO(F(opts.minFrom).value) : null) || new Date();
      render();
      panel.hidden = false;
      /* Open upward when the sheet's scroll box has no room below. */
      var body = trig.closest('.cf-body'), tb = trig.getBoundingClientRect(), bb = body ? body.getBoundingClientRect() : {bottom: window.innerHeight};
      panel.classList.toggle('is-up', tb.bottom + 340 > bb.bottom && tb.top - bb.top > 340);
      trig.setAttribute('aria-expanded', 'true');
    }
    function close() { panel.hidden = true; trig.setAttribute('aria-expanded', 'false'); }
    trig.addEventListener('click', function () { if (panel.hidden) open(); else close(); });
    panel.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-nav]');
      if (nav) { view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.nav), 1); render(); return; }
      var day = e.target.closest('.c-dp-day[data-iso]'); if (!day) return;
      input.value = day.dataset.iso;
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
      close(); dpSync();
      /* Picking a start rolls into picking the end. */
      if (fieldId === 'cf-start' && !F('cf-end').value) setTimeout(function () { F('dpTrig-cf-end').click(); }, 80);
    });
    document.addEventListener('click', function (e) {
      if (!panel.hidden && !e.target.closest('#' + trig.id) && !e.target.closest('#' + panel.id)) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); close(); } });
    dpSyncs.push(function () {
      var d = parseISO(input.value);
      labelSpan.textContent = d ? fmtDay(d) : 'Pick a date';
      labelSpan.classList.toggle('is-placeholder', !d);
      if (!panel.hidden) render();
    });
  }
  initDatePicker('cf-start');
  initDatePicker('cf-end', {minFrom: 'cf-start'});
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
      if (!modal()) return;
      editing = o.rec ? o.rec.id : null;
      onSave = o.onSave || null;
      F('cfTitle').textContent = editing ? o.rec.name : 'Add new campaign';
      fill(o.rec || o.draft || null);
      step = 1;
      if (o.step) step = Math.max(1, Math.min(stepCount(), o.step));
      renderSteps();
      var body = modal().open({
        anchor: o.anchor || null, width: 760,
        label: editing ? 'Edit campaign' : 'Add new campaign',
        guard: function () { return !popoverOpen(); },
        onClose: function () { onSave = null; editing = null; }
      });
      body.appendChild(sheet);
      if (step === 1) setTimeout(function () { F('cf-name').focus(); }, 260);
    },
    close: close,
    isOpen: isOpen
  };
})();
