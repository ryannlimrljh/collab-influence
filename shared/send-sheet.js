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

  /* Everything here either positions a DLS component or overrides one of its
     documented defaults. The components themselves — c-modal, c-choice,
     c-radio-circle, c-checkbox-box, c-field, c-table, c-banner, c-btn — are
     used as the system ships them, not rebuilt. */
  var CSS = [
    '.ss-scrim{position:fixed; inset:0; z-index:400; background:var(--shadow-overlay);',
    '  display:flex; align-items:center; justify-content:center; padding:var(--spacing-16);}',

    /* c-modal ships max-width:400px for a confirm dialog; this one carries a
       table, so it is widened and its body made the scrolling part. */
    '.ss-modal{max-width:680px; max-height:86vh; display:flex; flex-direction:column;}',
    '.ss-modal .c-modal-head{padding:var(--spacing-20) var(--spacing-20) var(--spacing-12);',
    '  align-items:flex-start; border-bottom:1px solid var(--color-neutral-3);}',
    '.ss-modal .c-modal-head .sub{margin:4px 0 0; font-size:var(--text-caption-size);',
    '  font-weight:400; color:var(--color-neutral-5);}',
    '.ss-modal .c-modal-body{padding:0 var(--spacing-20); overflow-y:auto; flex:1;}',
    '.ss-modal .c-modal-foot{padding:var(--spacing-16) var(--spacing-20);}',

    /* A rule between sections, never a box — where the campaign form landed. */
    '.ss-sec{padding:var(--spacing-20) 0; border-top:1px solid var(--color-neutral-3);}',
    '.ss-sec:first-child{border-top:0;}',
    '.ss-sec-h{display:flex; align-items:baseline; gap:8px; margin:0 0 var(--spacing-12);',
    '  font-size:11px; font-weight:700; text-transform:uppercase;',
    '  letter-spacing:var(--tracking-eyebrow); color:var(--color-neutral-5);}',
    '.ss-sec-h .opt{text-transform:none; letter-spacing:0; font-weight:400;}',

    /* Destination: two c-choice radios, left and right, each in its own
       bordered tile so the pair reads as a choice rather than a list. */
    '.ss-dest{display:grid; grid-template-columns:1fr 1fr; gap:var(--spacing-12);}',
    '.ss-dest .c-choice{padding:var(--spacing-12); box-sizing:border-box; min-height:44px;',
    '  border:1px solid var(--color-neutral-3); border-radius:var(--radius-md);',
    '  background:var(--color-neutral-1); transition:border-color var(--duration-fast) var(--ease-standard);}',
    '.ss-dest .c-choice:hover{border-color:var(--color-neutral-5);}',
    '.ss-dest .c-choice.is-on{border-color:var(--color-obsidian); box-shadow:inset 0 0 0 1px var(--color-obsidian);}',
    '.ss-dest .c-choice:focus-within{box-shadow:var(--shadow-focus);}',
    '.ss-destbody{margin-top:var(--spacing-12);}',

    /* c-field defaults to a fixed 220px column; inside a sheet it fills. */
    '.ss-grid{display:grid; grid-template-columns:1fr 1fr; gap:var(--spacing-16) var(--spacing-12);}',
    '.ss-grid .span2{grid-column:1 / -1;}',
    '.ss-modal .c-field{width:100%;}',
    '.ss-modal .c-field select{height:40px; border-radius:var(--radius-sm);',
    '  border:1px solid var(--color-neutral-3); padding:0 var(--spacing-12);',
    '  font-size:var(--text-body2-size); font-family:inherit; color:var(--color-neutral-9);',
    '  background:var(--color-neutral-1);}',
    '.ss-modal .c-field select:focus{outline:none; border:2px solid var(--color-obsidian); padding:0 11px;}',
    '.ss-opt{font-weight:400; color:var(--color-neutral-5);}',

    /* c-table in a standalone wrap, as the campaign page uses it. Only the
       numeric cells and the in-cell input need saying. */
    '.ss-modal .c-table th, .ss-modal .c-table td{padding:var(--spacing-8) var(--spacing-12);}',
    '.ss-modal .c-table th{font-size:11px; font-weight:700; text-transform:uppercase;',
    '  letter-spacing:var(--tracking-eyebrow); color:var(--color-neutral-5);}',
    '.ss-modal .c-table th{white-space:nowrap;}',
    '.ss-modal .c-table th.n, .ss-modal .c-table td.n{text-align:center; width:118px;}',
    '.ss-modal .c-table td.note{text-align:right; width:124px; white-space:nowrap; font-size:var(--text-caption-size);',
    '  color:var(--color-neutral-5);}',
    '.ss-modal .c-table tr.is-ok td.note{color:var(--color-green);}',
    '.ss-modal .c-table tr.is-short td.note{color:#8A5A00;}',
    '.ss-modal .c-table tr.is-none td.note{color:var(--color-red);}',
    '.ss-band{display:inline-flex; align-items:center; gap:6px; font-weight:700;}',
    '.ss-band .cmp-dot{width:6px; height:6px; border-radius:99px; flex:none;}',
    '.ss-modal .c-table td.n input{width:100%; max-width:72px; height:36px; box-sizing:border-box;',
    '  text-align:center; font:inherit; font-weight:800; border:1px solid var(--color-neutral-3);',
    '  border-radius:var(--radius-sm); background:var(--color-neutral-1); -moz-appearance:textfield;}',
    '.ss-modal .c-table td.n input::-webkit-outer-spin-button,',
    '.ss-modal .c-table td.n input::-webkit-inner-spin-button{-webkit-appearance:none; margin:0;}',
    '.ss-modal .c-table td.n input:focus{outline:none; border:2px solid var(--color-obsidian);}',
    '.ss-lede{margin:-4px 0 var(--spacing-12); font-size:var(--text-caption-size); color:var(--color-neutral-6);}',
    '.ss-lock{display:inline-flex; align-items:center; gap:4px; color:var(--color-neutral-5);}',
    '.ss-modal .c-table td.n input:disabled{background:var(--color-neutral-2); color:var(--color-neutral-7); border-color:var(--color-neutral-2); cursor:default;}',
    '.ss-extra{color:var(--color-neutral-4);}',
    '.ss-modal .c-table th.note{text-align:right;}',
    '.ss-modal .c-table tr.ss-more td{padding:0; border-bottom:1px solid var(--color-neutral-3);}',
    '.ss-modal .c-table tr.ss-more button{width:100%; padding:8px var(--spacing-12); text-align:left;',
    '  border:0; background:var(--color-neutral-2); font:inherit; font-size:var(--text-caption-size);',
    '  color:var(--color-neutral-6); cursor:pointer; display:flex; align-items:center; gap:6px;}',
    '.ss-modal .c-table tr.ss-more button:hover{color:var(--color-neutral-9);}',
    '.ss-warn{margin-top:var(--spacing-12);}',
    '.ss-err{margin:var(--spacing-12) 0 0; color:var(--color-red); font-size:var(--text-caption-size);}',
    '@media (max-width:600px){ .ss-dest, .ss-grid{grid-template-columns:1fr;}',
    '  .ss-modal .c-table th.n, .ss-modal .c-table td.n{width:64px;}',
    '  .ss-modal .c-table td.note{width:84px;} }'
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
      showExtra: false,
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

    /* A DLS radio: the real input is visually hidden by .c-choice, and
       .c-radio-circle carries the state. Same for the checkbox below. */
    function choiceHtml(value, on, label, desc) {
      return '<label class="c-choice' + (on ? ' is-on' : '') + '">' +
        '<input type="radio" name="ssMode" value="' + value + '"' + (on ? ' checked' : '') + ' />' +
        '<span class="c-radio-circle' + (on ? ' on' : '') + '">' +
          (on ? '<span class="dot"></span>' : '') + '</span>' +
        '<span class="text"><span class="label">' + label + '</span>' +
        '<span class="desc">' + desc + '</span></span></label>';
    }

    function render() {
      /* An open dropdown portals its panel onto document.body, so it must be
         closed before innerHTML is rebuilt or the panel is left orphaned
         there with nothing to close it. */
      if (window.collabDropdown) window.collabDropdown.close();
      seedAsk();
      var cov = bandRows(state.ask, state.infIds, opts.people);
      /* Bands in the ask lead; bands you merely happen to be sending sit
         behind a toggle, so a long tail of "not in the ask" rows does not
         bury the four that matter. */
      var asked = cov.filter(function (r) { return r.want > 0; });
      var extra = cov.filter(function (r) { return !r.want; });
      /* With nothing asked for yet, the bands are not "other" — they are the
         only ones there are, and the rows you type into. Collapsing them
         would leave a toggle with an empty table above it. */
      if (!asked.length) { asked = extra; extra = []; }
      var sum = summary(state.ask, state.infIds, opts.people);
      var c = destinationCampaign();
      /* When the campaign already defines the ask, it is the source of truth
         and these numbers are shown, not typed. Editing them here would
         rewrite the campaign silently. A campaign with no ask yet is the one
         case where they are editable, and then they save back to it. */
      var askLocked = !!(c && model().derivedPax(c));

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

      /* The last column answers one question — can the client actually pick
         the number being asked for in this band — so it says yes, or how
         many more are needed. "enough" and "short 1" were shorthand that
         only made sense if you already knew what the table was for. */
      function rowHtml(r) {
        var cls = !r.want ? '' : (r.have === 0 ? 'is-none' : (r.gap > 0 ? 'is-short' : 'is-ok'));
        var note = !r.want ? '<span class="ss-extra">not in the ask</span>'
                 : (r.have === 0 ? 'None sent'
                 : (r.gap > 0 ? 'Need ' + r.gap + ' more' : 'Yes'));
        var tier = window.tiers.tierByKey(r.tier);
        return '<tr class="' + cls + '"><td>' +
          '<span class="ss-band"><span class="cmp-dot" style="background:' + tier.dot + '"></span>' +
            esc(PLAT_LABEL[r.platform] || r.platform) + ' · ' + esc(tier.name) + '</span></td>' +
          '<td class="n"><input type="number" min="0" inputmode="numeric" value="' + r.want +
            '" data-ss="ask" data-plat="' + esc(r.platform) + '" data-tier="' + esc(r.tier) + '"' +
            (askLocked ? ' disabled title="Set on the campaign"' : '') +
            ' aria-label="Pax to pick, ' + esc(PLAT_LABEL[r.platform] + ' ' + tier.name) + '" /></td>' +
          '<td class="n num">' + r.have + '</td>' +
          '<td class="note">' + note + '</td></tr>';
      }

      host.innerHTML =
        '<div class="c-modal ss-modal" role="dialog" aria-modal="true" aria-labelledby="ssTitle">' +

        '<div class="c-modal-head">' +
          '<div><h4 id="ssTitle">Create selection list</h4>' +
            '<p class="sub">' + sum.candidates + (sum.candidates === 1 ? ' profile' : ' profiles') +
            ' · ' + sum.channels + ' channel accounts' +
            (opts.lockCampaign && c ? ' · for ' + esc(c.name) : '') + '</p></div>' +
          '<button class="c-icon-btn" type="button" data-ss="close" aria-label="Close">' +
            '<i class="ph ph-x"></i></button>' +
        '</div>' +

        '<div class="c-modal-body">' +

          (opts.lockCampaign ? '' :
            '<section class="ss-sec">' +
              '<h5 class="ss-sec-h">Send to</h5>' +
              '<div class="ss-dest">' +
                choiceHtml('existing', state.mode === 'existing', 'Existing campaign',
                  'Adds a list to a campaign you already have.') +
                choiceHtml('lead', state.mode === 'lead', 'New campaign (lead)',
                  'For work you have not won yet.') +
              '</div>' +
              '<div class="ss-destbody">' + (state.mode === 'existing'
                ? '<div class="c-field"><label for="ssCampaign">Campaign</label>' +
                  '<select id="ssCampaign" data-ss="campaign">' + opts.campaigns.map(function (x) {
                    return '<option value="' + esc(x.id) + '"' +
                      (x.id === state.campaignId ? ' selected' : '') + '>' + esc(x.name) +
                      (x.brand ? ' · ' + esc(x.brand) : '') +
                      (x.stage === 'lead' ? ' (lead)' : '') + '</option>';
                  }).join('') + '</select>' +
                  '<span class="c-helper">' + stillNeeds() + '</span></div>'
                : '<div class="ss-grid">' +
                  '<div class="c-field"><label for="ssLeadName">Campaign name</label>' +
                    '<input id="ssLeadName" data-ss="leadName" value="' + esc(state.leadName) +
                    '" placeholder="e.g. Raya 2027 pitch" /></div>' +
                  '<div class="c-field"><label for="ssLeadBrand">Brand ' +
                    '<span class="ss-opt">(optional)</span></label>' +
                    '<input id="ssLeadBrand" data-ss="leadBrand" value="' + esc(state.leadBrand) +
                    '" placeholder="e.g. Shopee" /></div>' +
                  '<span class="c-helper span2">Starts at stage Lead and stays out of the ' +
                  'active counts until you mark it won.</span></div>') +
              '</div>' +
            '</section>') +

          '<section class="ss-sec">' +
            '<h5 class="ss-sec-h">Pax to select <span class="opt">per platform and tier</span></h5>' +
            '<p class="ss-lede">How many profiles the client should pick in each band, and ' +
            'whether the ones you have ticked can cover it.' +
            (askLocked
              ? ' <span class="ss-lock"><i class="ph ph-lock-simple"></i> Set on ' +
                esc(c.name) + ' — change it on the campaign.</span>'
              : '') + '</p>' +
            (cov.length
              ? '<div class="c-table-standalone-wrap">' +
                  '<table class="c-table c-table-standalone"><thead><tr>' +
                    '<th>Channel · Tier</th><th class="n">Pax to pick</th>' +
                    '<th class="n">Profiles sent</th>' +
                    '<th class="note">Can they pick that many?</th></tr></thead><tbody>' +
                    asked.map(rowHtml).join('') +
                    (extra.length
                      ? '<tr class="ss-more"><td colspan="4">' +
                        '<button type="button" data-ss="more">' +
                        '<i class="ph ph-caret-' + (state.showExtra ? 'up' : 'down') + '"></i> ' +
                        (state.showExtra ? 'Hide the ' : 'Show the ') + extra.length +
                        ' other band' + (extra.length === 1 ? '' : 's') +
                        ' you are sending</button></td></tr>' +
                        (state.showExtra ? extra.map(rowHtml).join('') : '')
                      : '') +
                  '</tbody></table></div>' +
                (sum.shortBands
                  ? '<div class="c-banner c-banner-warning ss-warn">' +
                    '<i class="ph-fill ph-warning icon"></i><div class="body"><p class="message">' +
                    sum.shortBands + (sum.shortBands === 1 ? ' band has' : ' bands have') +
                    ' fewer profiles than you are asking the client to pick. You can still send — ' +
                    'they will see the number and not be able to reach it.</p></div></div>'
                  : '')
              : '<p class="c-helper">Tick some profiles first and their channels and tiers appear here.</p>') +
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
            '<label class="c-choice" style="margin-top:var(--spacing-12)">' +
              '<input type="checkbox" data-ss="requireName"' +
                (state.requireName ? ' checked' : '') + ' />' +
              '<span class="c-checkbox-box' + (state.requireName ? ' on' : '') + '">' +
                (state.requireName ? '<i class="ph-bold ph-check"></i>' : '') + '</span>' +
              '<span class="text"><span class="label">Ask for a name before responding</span>' +
              '<span class="desc">Records who made the choices.</span></span></label>' +
            '<p class="ss-err" data-ss="err" hidden></p>' +
          '</section>' +

        '</div>' +

        '<div class="c-modal-foot">' +
          '<button class="c-btn c-btn-secondary c-btn-md" type="button" data-ss="cancel">Cancel</button>' +
          '<button class="c-btn c-btn-primary c-btn-md" type="button" data-ss="send">' +
            '<i class="ph ph-paper-plane-tilt"></i> Create selection list</button>' +
        '</div></div>';

      /* The DLS dropdown replaces each native select in place, keeping the
         select as the value holder — so the change handlers below go on
         reading `data-ss` off it exactly as before. */
      if (window.collabDropdown) {
        host.querySelectorAll('select[data-ss]').forEach(function (sl) {
          window.collabDropdown.enhance(sl, {placeholder: 'Pick one'});
        });
      }
    }

    function close() { host.remove(); }

    host.addEventListener('click', function (e) {
      if (e.target === host || e.target.closest('[data-ss="close"], [data-ss="cancel"]')) return close();
      if (e.target.closest('[data-ss="more"]')) {
        state.showExtra = !state.showExtra;
        return render();
      }
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
