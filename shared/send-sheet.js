/* shared/send-sheet.js — the "send to campaign" sheet.

   The prototype grew two of these: infSendScrim on the roster page and
   openPicker('batch') on the campaign page, each knowing a little about
   batches and neither knowing about the ask. This is the one copy.

   The decisions are pure functions on the exported object so they can be
   tested without a DOM; open() builds the markup and calls back with a
   result rather than writing to the store itself. */
(function () {
  'use strict';

  var M = null;
  function model() { return M || (M = window.campaignModel); }

  /* Candidates rolled up against an ask. Thin wrapper over coverageOf so
     the sheet has one thing to call and the tests one thing to pin. */
  function coverage(ask, infIds, people) {
    return model().coverageOf(ask, infIds, people);
  }

  /* Every band worth showing a row for: the ones the ask names, plus the ones
     the ticked profiles actually occupy. Without the second half, a campaign
     with no ask yet renders no rows at all — and then there is nowhere to type
     the numbers, which is how the ask ends up bounded by something other than
     what you want to ask for. `want` is 0 for a band you have not asked for. */
  function bandRows(ask, infIds, people) {
    var rows = {}, order = [];
    function put(platform, tier) {
      var k = platform + '/' + tier;
      if (!rows[k]) { rows[k] = {platform: platform, tier: tier, want: 0, have: 0}; order.push(k); }
      return rows[k];
    }
    model().slotsOf({requirement: ask || {}}).forEach(function (s) {
      put(s.platform, s.tier).want = s.want;
    });
    (infIds || []).forEach(function (id) {
      model().channelsOf(people[id]).forEach(function (ch) {
        var t = window.tiers.tierOf(ch.followers);
        if (t) put(ch.platform, t.key).have += 1;
      });
    });
    return order.map(function (k) {
      var r = rows[k];
      r.gap = Math.max(0, r.want - r.have);
      return r;
    });
  }

  function summary(ask, infIds, people) {
    var rows = coverage(ask, infIds, people);
    var channels = 0;
    (infIds || []).forEach(function (id) {
      channels += model().channelsOf(people[id]).length;
    });
    return {
      candidates: (infIds || []).length,
      channels: channels,
      asked: rows.reduce(function (a, r) { return a + r.want; }, 0),
      shortBands: rows.filter(function (r) { return r.gap > 0; }).length
    };
  }

  /* Strict about where it goes, advisory about what it covers. A list with
     nowhere to land is the only thing worth refusing. */
  function validate(state) {
    if (!(state.infIds || []).length) {
      return {ok: false, field: 'infIds', message: 'Pick at least one profile first.'};
    }
    if (state.mode === 'lead') {
      if (!String(state.leadName || '').trim()) {
        return {ok: false, field: 'leadName', message: 'Give the lead a name.'};
      }
      return {ok: true};
    }
    if (!state.campaignId) {
      return {ok: false, field: 'campaignId', message: 'Choose a campaign to send this to.'};
    }
    return {ok: true};
  }

  /* 0 days means no expiry. Kept as a plain date string, the way every
     other date in the store is held. */
  function expiryFrom(fromISO, days) {
    if (!days) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fromISO);
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    d.setUTCDate(d.getUTCDate() + Number(days));
    return d.toISOString().slice(0, 10);
  }

  var PLAT_LABEL = {tiktok: 'TikTok', instagram: 'Instagram', xhs: 'Xiaohongshu'};
  var EXPIRY_OPTIONS = [
    {days: 14, label: '14 days'}, {days: 30, label: '30 days'},
    {days: 60, label: '60 days'}, {days: 0,  label: 'Never'}
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  var CSS = [
    '.ss-scrim{position:fixed; inset:0; z-index:400; background:var(--shadow-overlay);',
    '  display:flex; align-items:center; justify-content:center;}',

    /* Chrome mirrors the campaign form's sheet exactly: a bordered head, a
       scrolling body, a bordered foot. The two screens are the same job seen
       from two directions and should not look like different products. */
    '.ss-sheet{width:min(680px, calc(100vw - var(--spacing-32))); max-height:86vh;',
    '  display:flex; flex-direction:column; background:var(--color-neutral-1);',
    '  border-radius:var(--radius-lg); box-shadow:var(--shadow-4); overflow:hidden;}',
    '.ss-head{position:relative; padding:var(--spacing-24) var(--spacing-24) var(--spacing-16);',
    '  border-bottom:1px solid var(--color-neutral-3);}',
    '.ss-head h4{margin:0; padding-right:var(--spacing-32); font-size:var(--text-h4-size); font-weight:800;}',
    '.ss-head .sub{margin:4px 0 0; font-size:var(--text-caption-size); color:var(--color-neutral-5);}',
    '.ss-close{position:absolute; top:var(--spacing-16); right:var(--spacing-16); width:32px; height:32px;',
    '  border:0; background:transparent; border-radius:var(--radius-sm); color:var(--color-neutral-6);',
    '  cursor:pointer; display:inline-flex; align-items:center; justify-content:center;}',
    '.ss-close:hover{background:var(--color-neutral-2); color:var(--color-neutral-9);}',
    '.ss-close:focus-visible{outline:none; box-shadow:var(--shadow-focus);}',
    '.ss-body{padding:0 var(--spacing-24); overflow-y:auto;}',
    '.ss-foot{display:flex; align-items:center; gap:var(--spacing-8); padding:var(--spacing-16) var(--spacing-24);',
    '  border-top:1px solid var(--color-neutral-3); background:var(--color-neutral-1);}',
    '.ss-foot .grow{flex:1;}',

    /* A rule between sections, never a box around them - the campaign form
       settled on the same thing for its ask summary. */
    '.ss-sec{padding:var(--spacing-20) 0; border-top:1px solid var(--color-neutral-3);}',
    '.ss-sec:first-child{border-top:0;}',
    '.ss-sec-h{display:flex; align-items:baseline; gap:8px; margin:0 0 var(--spacing-12);',
    '  font-size:11px; font-weight:700; text-transform:uppercase;',
    '  letter-spacing:var(--tracking-eyebrow); color:var(--color-neutral-5);}',
    '.ss-sec-h .opt{text-transform:none; letter-spacing:0; font-weight:400;}',

    /* Destination: the two choices side by side, left and right. */
    '.ss-dest{display:grid; grid-template-columns:1fr 1fr; gap:var(--spacing-12);}',
    '.ss-dest label{display:flex; align-items:flex-start; gap:8px; box-sizing:border-box;',
    '  padding:var(--spacing-12); min-height:44px; cursor:pointer;',
    '  border:1px solid var(--color-neutral-3); border-radius:var(--radius-md);',
    '  background:var(--color-neutral-1); transition:border-color 160ms var(--ease-standard);}',
    '.ss-dest label:hover{border-color:var(--color-neutral-5);}',
    '.ss-dest label.is-on{border-color:var(--color-obsidian); box-shadow:inset 0 0 0 1px var(--color-obsidian);}',
    '.ss-dest label:focus-within{box-shadow:var(--shadow-focus);}',
    '.ss-dest input{margin-top:3px; flex:none;}',
    '.ss-dest .t{display:block; font-size:var(--text-body2-size); font-weight:700; color:var(--color-neutral-9);}',
    '.ss-dest .s{display:block; margin-top:2px; font-size:var(--text-footnote-size); color:var(--color-neutral-5);}',
    '.ss-destbody{margin-top:var(--spacing-12);}',

    /* Fields two up, on the campaign form's grid. */
    '.ss-grid{display:grid; grid-template-columns:1fr 1fr; gap:var(--spacing-16) var(--spacing-12);}',
    '.ss-grid .span2{grid-column:1 / -1;}',
    '.ss-sheet .c-field{width:100%;}',
    '.ss-sheet .c-field label{display:block; margin-bottom:4px; font-size:var(--text-caption-size);',
    '  font-weight:700; color:var(--color-neutral-9);}',
    '.ss-sheet .c-field input, .ss-sheet .c-field select{width:100%; height:40px; box-sizing:border-box;',
    '  border:1px solid var(--color-neutral-3); border-radius:var(--radius-sm);',
    '  padding:0 var(--spacing-12); font:inherit; font-size:var(--text-body2-size);',
    '  color:var(--color-neutral-9); background:var(--color-neutral-1);}',
    '.ss-sheet .c-field input:focus, .ss-sheet .c-field select:focus{outline:none;',
    '  border-color:var(--color-obsidian); box-shadow:var(--shadow-focus);}',
    '.ss-opt{font-weight:400; color:var(--color-neutral-5);}',
    '.ss-hint{margin:6px 0 0; font-size:var(--text-footnote-size); color:var(--color-neutral-6);}',

    /* The pax table, same skeleton as the campaign form's ask lines: bordered
       box, uppercase header strip, one hairline between rows. */
    '.ss-lines{border:1px solid var(--color-neutral-3); border-radius:var(--radius-md); overflow:hidden;}',
    '.ss-line-h, .ss-line{display:grid; grid-template-columns:1fr 104px 104px 112px;',
    '  gap:var(--spacing-8); align-items:center; padding:8px var(--spacing-12);}',
    '.ss-line-h{font-size:11px; font-weight:700; text-transform:uppercase;',
    '  letter-spacing:var(--tracking-eyebrow); color:var(--color-neutral-5);',
    '  background:var(--color-neutral-2); border-bottom:1px solid var(--color-neutral-3);}',
    '.ss-line{border-bottom:1px solid var(--color-neutral-2); font-size:var(--text-body2-size);}',
    '.ss-line:last-child{border-bottom:0;}',
    '.ss-line .band{display:inline-flex; align-items:center; gap:6px; font-weight:700; color:var(--color-neutral-9);}',
    '.ss-line .band .cmp-dot{width:6px; height:6px; border-radius:99px; flex:none;}',
    '.ss-line input{height:36px; width:100%; box-sizing:border-box; text-align:center;',
    '  font:inherit; font-weight:800; border:1px solid var(--color-neutral-3);',
    '  border-radius:var(--radius-sm); background:var(--color-neutral-1); -moz-appearance:textfield;}',
    '.ss-line input::-webkit-outer-spin-button, .ss-line input::-webkit-inner-spin-button{-webkit-appearance:none; margin:0;}',
    '.ss-line input:focus{outline:none; border-color:var(--color-obsidian); box-shadow:var(--shadow-focus);}',
    '.ss-line .have{text-align:center; font-weight:800; font-variant-numeric:tabular-nums; color:var(--color-neutral-7);}',
    '.ss-line .note{text-align:right; font-size:var(--text-caption-size); color:var(--color-neutral-5);}',
    '.ss-line.is-ok .note{color:var(--color-green);}',
    '.ss-line.is-short .note{color:#8A5A00;}',
    '.ss-line.is-none .note{color:var(--color-red);}',
    '.ss-th-n{text-align:center;}',

    '.ss-warn{display:flex; gap:6px; align-items:flex-start; margin:var(--spacing-12) 0 0;',
    '  font-size:var(--text-footnote-size); color:#8A5A00;}',
    '.ss-check{display:flex; align-items:center; gap:8px; min-height:44px; cursor:pointer;',
    '  font-size:var(--text-caption-size); color:var(--color-neutral-9);}',
    '.ss-err{margin:var(--spacing-12) 0 0; color:var(--color-red); font-size:var(--text-caption-size);}',
    '@media (max-width:600px){ .ss-dest, .ss-grid{grid-template-columns:1fr;}',
    '  .ss-line-h, .ss-line{grid-template-columns:1fr 64px 64px 84px;} }'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('ss-css')) return;
    var s = document.createElement('style');
    s.id = 'ss-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* opts: {infIds, people, campaigns, defaultCampaignId, lockCampaign, onSend}
     onSend receives the resolved state; the caller writes to the store, so
     this module never has to know which page it is on. With `lockCampaign`
     the destination is fixed — the campaign page opening the sheet for its
     own next batch — so the destination choice is not offered. */
  function open(opts) {
    injectCSS();
    var S = window.campaignStore;
    var state = {
      mode: 'existing',
      campaignId: opts.defaultCampaignId || (opts.campaigns[0] && opts.campaigns[0].id) || '',
      leadName: '', leadBrand: '',
      ask: {}, name: '', recipient: '', expiryDays: 30, requireName: false,
      infIds: opts.infIds || []
    };

    var host = document.createElement('div');
    /* The sheet owns its own scrim. It used to borrow `inf-scrim`, which is
       declared in influencers-v2.html's page-local CSS and starts at
       opacity 0 until something adds `is-open` — so the sheet rendered
       invisible there, and on campaign.html, where the class does not exist
       at all, it would have had no overlay whatsoever. A shared module
       cannot depend on one page's stylesheet. */
    host.className = 'ss-scrim';
    document.body.appendChild(host);

    function destinationCampaign() {
      return state.mode === 'existing' && state.campaignId ? S.get(state.campaignId) : null;
    }

    /* The ask defaults to what the destination still owes. Choosing a
       different destination re-seeds it, unless the user has edited it. */
    var askTouched = false;
    function seedAsk() {
      if (askTouched) return;
      var c = destinationCampaign();
      state.ask = c ? model().askFor(c) : {};
      var n = ((c && c.batches) || []).length + 1;
      state.name = 'Batch ' + n;
    }

    function askRows() {
      var out = [];
      Object.keys(state.ask).forEach(function (p) {
        Object.keys(state.ask[p]).forEach(function (t) {
          out.push({platform: p, tier: t, want: state.ask[p][t]});
        });
      });
      return out;
    }

    function render() {
      seedAsk();
      var cov = bandRows(state.ask, state.infIds, opts.people);
      var sum = summary(state.ask, state.infIds, opts.people);
      var c = destinationCampaign();

      function stillNeeds() {
        if (!c) return '';
        if (!model().derivedPax(c)) {
          return 'No pax set on this campaign yet — set them below and they save to it.';
        }
        var rows = askRows();
        return rows.length
          ? 'Still needs to fill: ' + rows.map(function (r) {
              return esc(PLAT_LABEL[r.platform] || r.platform) + ' ' +
                esc(window.tiers.tierByKey(r.tier).name) + ' ×' + r.want;
            }).join(', ')
          : 'Every slot on this campaign is already filled.';
      }

      function lineHtml(r) {
        /* A band you have asked nothing of says so, rather than claiming to
           be covered — you are simply not asking for it. */
        var cls = !r.want ? '' : (r.have === 0 ? 'is-none' : (r.gap > 0 ? 'is-short' : 'is-ok'));
        var note = !r.want ? 'not asked for'
                 : (r.have === 0 ? 'none to pick from'
                 : (r.gap > 0 ? 'short ' + r.gap : 'enough'));
        var tier = window.tiers.tierByKey(r.tier);
        return '<div class="ss-line ' + cls + '">' +
          '<span class="band"><span class="cmp-dot" style="background:' + tier.dot + '"></span>' +
            esc(PLAT_LABEL[r.platform] || r.platform) + ' · ' + esc(tier.name) + '</span>' +
          '<input type="number" min="0" inputmode="numeric" value="' + r.want +
            '" data-ss="ask" data-plat="' + esc(r.platform) + '" data-tier="' + esc(r.tier) +
            '" aria-label="Pax to pick, ' + esc(PLAT_LABEL[r.platform] + ' ' + tier.name) + '" />' +
          '<span class="have">' + r.have + '</span>' +
          '<span class="note">' + note + '</span></div>';
      }

      host.innerHTML =
        '<div class="ss-sheet" role="dialog" aria-modal="true" aria-labelledby="ssTitle">' +

        '<div class="ss-head">' +
          '<button class="ss-close" type="button" data-ss="close" aria-label="Close"><i class="ph ph-x"></i></button>' +
          '<h4 id="ssTitle">Create selection list</h4>' +
          '<p class="sub">' + sum.candidates + (sum.candidates === 1 ? ' profile' : ' profiles') +
            ' · ' + sum.channels + ' channel accounts' +
            (opts.lockCampaign && c ? ' · for ' + esc(c.name) : '') + '</p>' +
        '</div>' +

        '<div class="ss-body">' +

          (opts.lockCampaign ? '' :
            '<section class="ss-sec">' +
              '<h5 class="ss-sec-h">Send to</h5>' +
              '<div class="ss-dest">' +
                '<label class="' + (state.mode === 'existing' ? 'is-on' : '') + '">' +
                  '<input type="radio" name="ssMode" value="existing"' +
                    (state.mode === 'existing' ? ' checked' : '') + ' />' +
                  '<span><span class="t">Existing campaign</span>' +
                  '<span class="s">Adds a list to a campaign you already have.</span></span></label>' +
                '<label class="' + (state.mode === 'lead' ? 'is-on' : '') + '">' +
                  '<input type="radio" name="ssMode" value="lead"' +
                    (state.mode === 'lead' ? ' checked' : '') + ' />' +
                  '<span><span class="t">New campaign (lead)</span>' +
                  '<span class="s">For work you have not won yet.</span></span></label>' +
              '</div>' +
              '<div class="ss-destbody">' + (state.mode === 'existing'
                ? '<div class="c-field"><label for="ssCampaign">Campaign</label>' +
                  '<select id="ssCampaign" data-ss="campaign">' + opts.campaigns.map(function (x) {
                    return '<option value="' + esc(x.id) + '"' +
                      (x.id === state.campaignId ? ' selected' : '') + '>' + esc(x.name) +
                      (x.brand ? ' · ' + esc(x.brand) : '') +
                      (x.stage === 'lead' ? ' (lead)' : '') + '</option>';
                  }).join('') + '</select>' +
                  '<p class="ss-hint">' + stillNeeds() + '</p></div>'
                : '<div class="ss-grid">' +
                  '<div class="c-field"><label for="ssLeadName">Campaign name</label>' +
                    '<input id="ssLeadName" data-ss="leadName" value="' + esc(state.leadName) +
                    '" placeholder="e.g. Raya 2027 pitch" /></div>' +
                  '<div class="c-field"><label for="ssLeadBrand">Brand <span class="ss-opt">(optional)</span></label>' +
                    '<input id="ssLeadBrand" data-ss="leadBrand" value="' + esc(state.leadBrand) +
                    '" placeholder="e.g. Shopee" /></div>' +
                  '<p class="ss-hint span2">Starts at stage Lead and stays out of the active counts ' +
                  'until you mark it won.</p></div>') +
              '</div>' +
            '</section>') +

          '<section class="ss-sec">' +
            '<h5 class="ss-sec-h">Pax to select <span class="opt">per platform and tier</span></h5>' +
            (cov.length
              ? '<div class="ss-lines">' +
                  '<div class="ss-line-h"><span>Channel · Tier</span>' +
                    '<span class="ss-th-n">Pax to pick</span>' +
                    '<span class="ss-th-n">Profiles sent</span><span></span></div>' +
                  cov.map(lineHtml).join('') +
                '</div>' +
                (sum.shortBands
                  ? '<p class="ss-warn"><i class="ph-fill ph-warning"></i> ' + sum.shortBands +
                    (sum.shortBands === 1 ? ' band has' : ' bands have') +
                    ' fewer profiles than you are asking the client to pick. You can still send — ' +
                    'they will see the number and not be able to reach it.</p>'
                  : '')
              : '<p class="ss-hint">Tick some profiles first and their channels and tiers appear here.</p>') +
          '</section>' +

          '<section class="ss-sec">' +
            '<h5 class="ss-sec-h">The link</h5>' +
            '<div class="ss-grid">' +
              '<div class="c-field"><label for="ssName">List name</label>' +
                '<input id="ssName" data-ss="name" value="' + esc(state.name) + '" /></div>' +
              '<div class="c-field"><label for="ssExpiry">Expires</label>' +
                '<select id="ssExpiry" data-ss="expiryDays">' + EXPIRY_OPTIONS.map(function (o) {
                  return '<option value="' + o.days + '"' +
                    (o.days === state.expiryDays ? ' selected' : '') + '>' + o.label + '</option>';
                }).join('') + '</select></div>' +
              '<div class="c-field span2"><label for="ssRecipient">Client contact ' +
                '<span class="ss-opt">(optional)</span></label>' +
                '<input id="ssRecipient" data-ss="recipient" value="' + esc(state.recipient) +
                '" placeholder="Name or email — recorded against their answers" /></div>' +
            '</div>' +
            '<label class="ss-check"><input type="checkbox" data-ss="requireName"' +
              (state.requireName ? ' checked' : '') + ' /> Ask for a name before responding</label>' +
            '<p class="ss-err" data-ss="err" hidden></p>' +
          '</section>' +

        '</div>' +

        '<div class="ss-foot"><span class="grow"></span>' +
          '<button class="c-btn c-btn-ghost c-btn-md" type="button" data-ss="cancel">Cancel</button>' +
          '<button class="c-btn c-btn-primary c-btn-md" type="button" data-ss="send">' +
            '<i class="ph ph-paper-plane-tilt"></i> Create selection list</button>' +
        '</div></div>';
    }

    function close() { host.remove(); }

    host.addEventListener('click', function (e) {
      if (e.target === host || e.target.closest('[data-ss="close"], [data-ss="cancel"]')) return close();
      if (!e.target.closest('[data-ss="send"]')) return;
      var v = validate(state);
      if (!v.ok) {
        var err = host.querySelector('[data-ss="err"]');
        err.textContent = v.message; err.hidden = false;
        return;
      }
      close();
      opts.onSend({
        mode: state.mode, campaignId: state.campaignId,
        leadName: state.leadName.trim(), leadBrand: state.leadBrand.trim(),
        ask: state.ask, name: state.name.trim(), recipient: state.recipient.trim(),
        expiresAt: expiryFrom(S.today(), Number(state.expiryDays)),
        requireName: state.requireName, infIds: state.infIds
      });
    });

    host.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'ssMode') { state.mode = t.value; askTouched = false; return render(); }
      if (t.dataset.ss === 'campaign') { state.campaignId = t.value; askTouched = false; return render(); }
      if (t.dataset.ss === 'ask') {
        askTouched = true;
        var n = Math.max(0, Number(t.value) || 0);
        state.ask[t.dataset.plat] = state.ask[t.dataset.plat] || {};
        if (n) state.ask[t.dataset.plat][t.dataset.tier] = n;
        else delete state.ask[t.dataset.plat][t.dataset.tier];
        return render();
      }
      if (t.dataset.ss === 'requireName') { state.requireName = t.checked; return; }
      if (t.dataset.ss === 'expiryDays') { state.expiryDays = Number(t.value); return; }
    });

    /* Text inputs update state without a re-render, so the caret stays put. */
    host.addEventListener('input', function (e) {
      var k = e.target.dataset.ss;
      if (k === 'leadName' || k === 'leadBrand' || k === 'name' || k === 'recipient') {
        state[k] = e.target.value;
      }
    });

    document.addEventListener('keydown', function esc2(e) {
      if (e.key === 'Escape' && document.body.contains(host)) { close(); document.removeEventListener('keydown', esc2); }
    });

    render();
    setTimeout(function () {
      var f = host.querySelector('select, input');
      if (f) f.focus();
    }, 60);
  }

  window.sendSheet = {
    coverage: coverage, bandRows: bandRows, summary: summary,
    validate: validate, expiryFrom: expiryFrom,
    open: open
  };
})();
