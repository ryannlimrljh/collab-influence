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
    '.ss-modal{margin:var(--spacing-16); max-width:560px; max-height:86vh; display:flex; flex-direction:column;}',
    '.ss-modal .c-modal-body{overflow:auto;}',
    '.ss-count{margin:0 0 var(--spacing-16); font-size:var(--text-caption-size); color:var(--color-neutral-6);}',
    '.ss-h{margin:var(--spacing-20) 0 var(--spacing-8); font-size:var(--text-caption-size); font-weight:800; color:var(--color-neutral-9);}',
    '.ss-h:first-of-type{margin-top:0;}',
    '.ss-radio{display:flex; align-items:center; gap:8px; min-height:36px; font-size:var(--text-body2-size); cursor:pointer;}',
    '.ss-indent{margin:var(--spacing-4) 0 var(--spacing-12) 24px;}',
    '.ss-row{display:flex; gap:var(--spacing-12); flex-wrap:wrap;}',
    '.ss-row .c-field{flex:1; min-width:160px;}',
    '.ss-hint{margin:6px 0 0; font-size:var(--text-footnote-size); color:var(--color-neutral-6);}',
    '.ss-opt{font-weight:400; color:var(--color-neutral-5);}',
    '.ss-ask-row{display:flex; align-items:center; gap:var(--spacing-12); min-height:44px; font-size:var(--text-caption-size);}',
    '.ss-ask-row span{flex:1;}',
    '.ss-ask-row input{width:72px; height:36px; text-align:center; border:1px solid var(--color-neutral-3); border-radius:var(--radius-sm); font-family:inherit;}',
    '.ss-cov{width:100%; border-collapse:collapse; font-size:var(--text-caption-size);}',
    '.ss-cov td{padding:6px 0; border-bottom:1px solid var(--color-neutral-2);}',
    '.ss-cov td.n{text-align:right; font-weight:700; width:72px;}',
    '.ss-cov td.note{text-align:right; width:110px; color:var(--color-neutral-6);}',
    '.ss-cov tr.is-ok td.note{color:var(--color-green);}',
    '.ss-cov tr.is-short td.note{color:#8A5A00;}',
    '.ss-cov tr.is-none td.note{color:var(--color-red);}',
    '.ss-warn{display:flex; gap:6px; align-items:flex-start; margin:var(--spacing-8) 0 0; font-size:var(--text-footnote-size); color:#8A5A00;}',
    '.ss-check{display:flex; align-items:center; gap:8px; min-height:44px; font-size:var(--text-caption-size); cursor:pointer;}',
    '.ss-err{margin:var(--spacing-12) 0 0; color:var(--color-red); font-size:var(--text-caption-size);}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('ss-css')) return;
    var s = document.createElement('style');
    s.id = 'ss-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* opts: {infIds, people, campaigns, defaultCampaignId, onSend}
     onSend receives the resolved state; the caller writes to the store, so
     this module never has to know which page it is on. */
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
      var cov = coverage(state.ask, state.infIds, opts.people);
      var sum = summary(state.ask, state.infIds, opts.people);
      var c = destinationCampaign();

      host.innerHTML =
        '<div class="c-modal ss-modal" role="dialog" aria-modal="true" aria-labelledby="ssTitle">' +
        '<div class="c-modal-head"><h4 id="ssTitle">Create selection list for:</h4>' +
          '<button class="c-icon-btn" type="button" data-ss="close" aria-label="Close"><i class="ph ph-x"></i></button></div>' +
        '<div class="c-modal-body">' +

          '<p class="ss-count">' + sum.candidates +
            (sum.candidates === 1 ? ' profile' : ' profiles') + ' · ' +
            sum.channels + ' channel accounts</p>' +

                    '<label class="ss-radio"><input type="radio" name="ssMode" value="existing"' +
            (state.mode === 'existing' ? ' checked' : '') + ' /> Existing campaign</label>' +
          (state.mode === 'existing'
            ? '<div class="c-field ss-indent"><select data-ss="campaign">' +
              opts.campaigns.map(function (x) {
                return '<option value="' + esc(x.id) + '"' +
                  (x.id === state.campaignId ? ' selected' : '') + '>' + esc(x.name) +
                  (x.brand ? ' · ' + esc(x.brand) : '') +
                  (x.stage === 'lead' ? ' (lead)' : '') + '</option>';
              }).join('') + '</select>' +
              (c && model().derivedPax(c)
                ? '<p class="ss-hint">Still needs to fill: ' + (askRows().length
                    ? askRows().map(function (r) {
                        return esc(PLAT_LABEL[r.platform] || r.platform) + ' ' +
                          esc(window.tiers.tierByKey(r.tier).name) + ' ×' + r.want;
                      }).join(', ')
                    : 'nothing — this campaign is already filled') + '</p>'
                : '<p class="ss-hint">This campaign has no pax set yet — type the numbers below.</p>') +
              '</div>'
            : '') +

          '<label class="ss-radio"><input type="radio" name="ssMode" value="lead"' +
            (state.mode === 'lead' ? ' checked' : '') + ' /> New campaign (lead)</label>' +
          (state.mode === 'lead'
            ? '<div class="ss-indent ss-row">' +
              '<div class="c-field"><label for="ssLeadName">Name</label>' +
                '<input id="ssLeadName" data-ss="leadName" value="' + esc(state.leadName) +
                '" placeholder="e.g. Raya 2027 pitch" /></div>' +
              '<div class="c-field"><label for="ssLeadBrand">Brand</label>' +
                '<input id="ssLeadBrand" data-ss="leadBrand" value="' + esc(state.leadBrand) +
                '" placeholder="e.g. Shopee" /></div>' +
              '</div><p class="ss-hint ss-indent">Creates a campaign at stage Lead. It stays out of the active counts until you move it to Sourcing.</p>'
            : '') +

          '<h5 class="ss-h">Pax to select <span class="ss-opt">per platform and tier</span></h5>' +
          '<div class="ss-ask">' + (askRows().length
            ? askRows().map(function (r) {
                return '<div class="ss-ask-row"><span>' +
                  esc(PLAT_LABEL[r.platform] || r.platform) + ' · ' +
                  esc(window.tiers.tierByKey(r.tier).name) + '</span>' +
                  '<input type="number" min="0" inputmode="numeric" value="' + r.want +
                  '" data-ss="ask" data-plat="' + esc(r.platform) + '" data-tier="' +
                  esc(r.tier) + '" aria-label="' + esc(PLAT_LABEL[r.platform] + ' ' +
                  window.tiers.tierByKey(r.tier).name + ' wanted') + '" /></div>';
              }).join('')
            : '<p class="ss-hint">No pax set, so the client sees the list with no number to hit. Add a campaign ask, or type numbers above.</p>') +
          '</div>' +

          '<h5 class="ss-h">Profiles you are sending <span class="ss-opt">against those numbers</span></h5>' +
          (cov.length
            ? '<table class="ss-cov"><tbody>' + cov.map(function (r) {
                var cls = r.have === 0 ? 'is-none' : (r.gap > 0 ? 'is-short' : 'is-ok');
                var note = r.have === 0 ? 'none to pick from'
                         : (r.gap > 0 ? 'short ' + r.gap : 'enough');
                return '<tr class="' + cls + '"><td>' +
                  esc(PLAT_LABEL[r.platform] || r.platform) + ' · ' +
                  esc(window.tiers.tierByKey(r.tier).name) + '</td>' +
                  '<td class="n">' + r.have + ' / ' + r.want + '</td>' +
                  '<td class="note">' + note + '</td></tr>';
              }).join('') + '</tbody></table>' +
              (sum.shortBands
                ? '<p class="ss-warn"><i class="ph-fill ph-warning"></i> ' + sum.shortBands +
                  (sum.shortBands === 1 ? ' band has' : ' bands have') +
                  ' fewer profiles than the pax you asked for. You can still send — ' +
                  'the client will see the number and not be able to reach it.</p>'
                : '')
            : '<p class="ss-hint">Set the pax above and this checks whether your picks can cover them.</p>') +

          '<h5 class="ss-h">Link</h5>' +
          '<div class="ss-row">' +
            '<div class="c-field"><label for="ssName">Batch name</label>' +
              '<input id="ssName" data-ss="name" value="' + esc(state.name) + '" /></div>' +
            '<div class="c-field"><label for="ssExpiry">Expires</label>' +
              '<select id="ssExpiry" data-ss="expiryDays">' + EXPIRY_OPTIONS.map(function (o) {
                return '<option value="' + o.days + '"' +
                  (o.days === state.expiryDays ? ' selected' : '') + '>' + o.label + '</option>';
              }).join('') + '</select></div>' +
          '</div>' +
          '<div class="c-field"><label for="ssRecipient">Client contact <span class="ss-opt">(optional)</span></label>' +
            '<input id="ssRecipient" data-ss="recipient" value="' + esc(state.recipient) +
            '" placeholder="Name or email — recorded against their answers" /></div>' +
          '<label class="ss-check"><input type="checkbox" data-ss="requireName"' +
            (state.requireName ? ' checked' : '') + ' /> Ask for a name before responding</label>' +

          '<p class="ss-err" data-ss="err" hidden></p>' +
        '</div>' +
        '<div class="c-modal-foot">' +
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
    coverage: coverage, summary: summary,
    validate: validate, expiryFrom: expiryFrom,
    open: open
  };
})();
