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

  /* Everyone in the roster who has an account on this channel in this tier,
     biggest account first. Biggest is a defensible default rather than a
     claim about quality: it is the one ordering the agency can explain to a
     client, and the list is editable afterwards either way. */
  function candidatesFor(platform, tier, people, exclude) {
    var out = [];
    Object.keys(people || {}).forEach(function (id) {
      if (exclude && exclude[id]) return;
      model().channelsOf(people[id]).forEach(function (ch) {
        if (ch.platform !== platform) return;
        var t = window.tiers.tierOf(ch.followers);
        if (t && t.key === tier) out.push({id: id, followers: ch.followers || 0});
      });
    });
    out.sort(function (a, b) { return b.followers - a.followers; });
    return out;
  }

  /* Which profiles to add so every short band is covered. Returns what it
     can: a band the roster cannot fill comes back short rather than throwing,
     and the caller says so.

     The subtlety is that one creator can land in two bands — approve them on
     TikTok Macro and you have also filled an Instagram Mid — so each pick is
     credited to every band it occupies before the next band is considered.
     Without that, filling four bands could add four profiles where two would
     have done. */
  function fillGaps(rows, people, exclude) {
    var taken = Object.assign({}, exclude || {});
    var gained = {}, add = [];
    function key(p, t) { return p + '/' + t; }
    (rows || []).filter(function (r) { return r.gap > 0; }).forEach(function (r) {
      var need = r.gap - (gained[key(r.platform, r.tier)] || 0);
      if (need <= 0) return;
      candidatesFor(r.platform, r.tier, people, taken).slice(0, need).forEach(function (cand) {
        taken[cand.id] = true;
        add.push(cand.id);
        model().channelsOf(people[cand.id]).forEach(function (ch) {
          var t = window.tiers.tierOf(ch.followers);
          if (!t) return;
          var k = key(ch.platform, t.key);
          gained[k] = (gained[k] || 0) + 1;
        });
      });
    });
    return add;
  }

  /* Which of the ticked profiles answer the ask and which do not. A creator
     counts as fitting if any one of their channels lands in a band being
     asked for — the client only needs one reason to book them. With no ask
     at all nothing can fail it, so everyone fits. */
  function matchSplit(ask, infIds, people) {
    var wanted = {};
    model().slotsOf({requirement: ask || {}}).forEach(function (s) {
      wanted[s.platform + '/' + s.tier] = true;
    });
    var none = !Object.keys(wanted).length;
    var match = [], mismatch = [];
    (infIds || []).forEach(function (id) {
      if (none) { match.push(id); return; }
      var fits = model().channelsOf(people[id]).some(function (ch) {
        var t = window.tiers.tierOf(ch.followers);
        return t && wanted[ch.platform + '/' + t.key];
      });
      (fits ? match : mismatch).push(id);
    });
    return {match: match, mismatch: mismatch};
  }

  /* One row per ticked profile: the bands their accounts land in, and whether
     any of those bands is one you are asking for. The fit rule is matchSplit's,
     read off the same slots — with no ask at all nothing can fail it — so the
     list the sheet draws and the count in its header can never disagree. */
  function peopleRows(ask, infIds, people) {
    var wanted = {};
    model().slotsOf({requirement: ask || {}}).forEach(function (s) {
      wanted[s.platform + '/' + s.tier] = true;
    });
    var none = !Object.keys(wanted).length;
    return (infIds || []).map(function (id) {
      var rec = (people || {})[id] || {};
      var bands = model().channelsOf(rec).map(function (ch) {
        var t = window.tiers.tierOf(ch.followers);
        return {
          platform: ch.platform, tier: t ? t.key : null,
          followers: ch.followers || 0,
          wanted: !!(t && wanted[ch.platform + '/' + t.key])
        };
      });
      return {
        id: id, name: rec.name || id, bands: bands,
        fits: none || bands.some(function (b) { return b.wanted; })
      };
    });
  }

  /* Name or handle, biggest total following first. The point of it is to let
     someone answer a mismatch without closing the sheet, so it searches the
     same roster the page does and leans on `exclude` to keep out whoever is
     already on the list or already spoken for on the destination. */
  function searchPeople(q, people, exclude, limit) {
    var needle = String(q || '').trim().toLowerCase();
    if (!needle) return [];
    var out = [];
    Object.keys(people || {}).forEach(function (id) {
      if (exclude && exclude[id]) return;
      var rec = people[id], hay = String(rec.name || ''), reach = 0;
      model().channelsOf(rec).forEach(function (ch) {
        hay += ' ' + (ch.handle || '');
        reach += ch.followers || 0;
      });
      if (hay.toLowerCase().indexOf(needle) === -1) return;
      out.push({id: id, name: rec.name || id, reach: reach});
    });
    out.sort(function (a, b) { return b.reach - a.reach; });
    return limit ? out.slice(0, limit) : out;
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

  /* Inclusive of the expiry day: a link that expires today still opens.
     Plain string comparison is safe because both sides are ISO yyyy-mm-dd,
     which sorts lexicographically, and it avoids a timezone rounding that
     would close a link a day early for anyone east of the server. */
  function isExpired(batch, todayISO) {
    var e = batch && batch.expiresAt;
    return !!e && String(e) < String(todayISO);
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
    /* Inside the fold-out modal the sheet is the panel's content: no shadow
       or width of its own, the modal's close instead of the sheet's. */
    '.ss-host{display:flex; flex-direction:column; flex:1; min-height:0;}',
    '.ss-host .ss-modal{max-width:none; max-height:none; box-shadow:none; border-radius:0; flex:1; min-height:0;}',
    '.ss-host .c-modal-head{padding-right:var(--spacing-48);}',
    '.ss-host [data-ss="close"]{display:none;}',

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
       numeric cells and the in-cell input need saying.

       The clip has to be re-asserted. The DLS gives the wrap overflow:hidden
       so its 20px radius actually cuts the header fill and the last row, but
       both host pages drop it globally — `.c-table-standalone-wrap{overflow:
       visible}` — so a kebab menu opened on their last row is not cut off.
       That unscoped rule reaches in here too, and squared off all four
       corners: the grey thead and the grey toggle row painted straight past
       the rounded border. This table has no kebab menus, and the one thing
       that would suffer from a clip — the DLS dropdown in the add-band row —
       portals its panel onto document.body. A shared module cannot rely on
       the host page's stylesheet leaving a component's defaults alone. */
    '.ss-modal .c-table-standalone-wrap{overflow:hidden;}',
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
    /* Faces, on the campaign page's own stack recipe. */
    '.ss-head-id{min-width:0;}',
    '.ss-who{display:flex; align-items:flex-start; gap:var(--spacing-12); margin-top:6px;}',
    '.ss-stack{display:flex; align-items:center; padding-left:7px; flex:none;}',
    '.ss-stack .c-card-profile-avatar{width:28px; height:28px; margin-left:-7px;',
    '  border:2px solid var(--color-neutral-1); border-radius:var(--radius-pill);',
    '  object-fit:cover; background:var(--color-neutral-2); color:var(--color-neutral-6);',
    '  display:inline-flex; align-items:center; justify-content:center;',
    '  font-size:10px; font-weight:800;}',
    /* Still going to the client, so dimmed and ringed rather than hidden. */
    '.ss-stack .c-card-profile-avatar.is-mis{opacity:.45; border-color:var(--color-amber);}',
    '.ss-stack .more{display:inline-flex; align-items:center; justify-content:center;',
    '  width:28px; height:28px; margin-left:-7px; border-radius:var(--radius-pill);',
    '  border:2px solid var(--color-neutral-1); background:var(--color-neutral-2);',
    '  font-size:10px; font-weight:800; color:var(--color-neutral-6);}',
    '.ss-mis{display:inline-flex; align-items:center; gap:4px; margin-top:2px; color:#8A5A00;}',
    '.ss-mis button{border:0; background:none; padding:0; font:inherit; color:inherit;',
    '  text-decoration:underline; text-underline-offset:3px; cursor:pointer;}',

    /* The add-a-band row, so a lead can ask for something it has nobody for. */
    '.ss-modal .c-table tr.ss-add td{padding:0; background:var(--color-neutral-2);',
    '  border-bottom:1px solid var(--color-neutral-3);}',
    '.ss-addrow{display:flex; gap:6px; align-items:center; padding:8px var(--spacing-12); flex-wrap:nowrap;}',
    '.ss-addrow .c-btn{flex:none; white-space:nowrap;}',
    /* The DLS dropdown wraps each select in .cf-dd, which is block and
       100% wide by default — right in a stacked form, wrong in a toolbar
       row, where it stacks the three controls vertically. */
    '.ss-addrow .cf-dd{flex:1 1 118px; width:auto; min-width:0;}',
    '.ss-addrow .cf-dd .c-dropdown-input{height:36px;}',
    '.ss-addrow select{height:36px; min-width:120px; border:1px solid var(--color-neutral-3);',
    '  border-radius:var(--radius-sm); padding:0 10px; font:inherit;',
    '  font-size:var(--text-body2-size); background:var(--color-neutral-1);}',
    '.ss-addrow input{width:60px; flex:none; height:36px; text-align:center; font:inherit; font-weight:800;',
    '  border:1px solid var(--color-neutral-3); border-radius:var(--radius-sm);',
    '  background:var(--color-neutral-1); -moz-appearance:textfield;}',
    '.ss-addrow input::-webkit-outer-spin-button, .ss-addrow input::-webkit-inner-spin-button{-webkit-appearance:none; margin:0;}',
    '.ss-modal .c-table tr.ss-none td{color:var(--color-neutral-5); font-size:var(--text-caption-size);}',
    '.ss-lede{margin:-4px 0 var(--spacing-12); font-size:var(--text-caption-size); color:var(--color-neutral-6);}',

    /* The people list. One row per profile, 44px of touch target, and the
       remove control always in the same column so the eye can run down it. */
    '.ss-plist{display:flex; flex-direction:column;}',
    '.ss-prow{display:flex; align-items:center; gap:var(--spacing-12); min-height:44px;',
    '  padding:6px 8px; border-radius:var(--radius-sm);}',
    '.ss-prow:hover{background:var(--color-neutral-2);}',
    '.ss-prow .c-card-profile-avatar{width:28px; height:28px; flex:none; border-radius:var(--radius-pill);',
    '  object-fit:cover; background:var(--color-neutral-2); color:var(--color-neutral-6);',
    '  display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:800;}',
    '.ss-prow .nm{flex:1 1 auto; min-width:0; display:flex; align-items:center; gap:6px;',
    '  font-size:var(--text-body2-size); font-weight:700; white-space:nowrap;',
    '  overflow:hidden; text-overflow:ellipsis;}',
    '.ss-prow .nm i{color:var(--color-amber); flex:none;}',
    /* Tinted, not hidden: it is still going to the client until you say otherwise. */
    '.ss-prow.is-mis{background:var(--color-gold-bg); box-shadow:inset 2px 0 0 var(--color-amber);}',
    '.ss-prow .c-icon-btn{flex:none; color:var(--color-neutral-5);}',
    '.ss-prow .c-icon-btn:hover{color:var(--color-red); background:var(--color-neutral-2);}',
    '.ss-pb{display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end; flex:none;}',
    '.ss-pb span{display:inline-flex; align-items:center; gap:4px; padding:2px 8px;',
    '  border-radius:var(--radius-pill); background:var(--color-neutral-2);',
    '  font-size:11px; font-weight:700; color:var(--color-neutral-6); white-space:nowrap;}',
    /* A band the client was actually asked to pick from, filled so it reads
       at a glance which of a creator's accounts is the reason they are here. */
    '.ss-pb span.is-want{background:var(--color-obsidian); color:var(--color-neutral-1);}',
    '.ss-pb .cmp-dot{width:6px; height:6px; border-radius:99px; flex:none;}',
    '.ss-allbtn{align-self:flex-start; margin-top:4px; padding:6px 8px; border:0; background:none;',
    '  font:inherit; font-size:var(--text-caption-size); color:var(--color-neutral-6);',
    '  cursor:pointer; display:inline-flex; align-items:center; gap:6px;}',
    '.ss-allbtn:hover{color:var(--color-neutral-9);}',
    '.ss-search{display:flex; align-items:center; gap:8px; margin-top:var(--spacing-12);',
    '  height:40px; padding:0 var(--spacing-12); box-sizing:border-box;',
    '  border:1px solid var(--color-neutral-3); border-radius:var(--radius-sm);',
    '  background:var(--color-neutral-1); color:var(--color-neutral-5);}',
    '.ss-search:focus-within{border:2px solid var(--color-obsidian); padding:0 11px;}',
    '.ss-search input{flex:1; min-width:0; border:0; outline:none; background:none;',
    '  font:inherit; font-size:var(--text-body2-size); color:var(--color-neutral-9);}',
    '.ss-results{margin-top:4px;}',
    '.ss-results .c-helper{padding:6px 8px;}',
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
    '.ss-warn .ss-sub{margin-top:6px; font-weight:400; opacity:.75;}',

    /* The assist reads as Collab AI, on the system pastel sweep the planner
       already uses for "Draft it with Collab AI" — same gradient stops, same
       keyframe, same reduced-motion guard. Not a second gradient invented
       here: an AI action should look the same everywhere in the product. */
    '.ss-ai-btn{position:relative; z-index:0; overflow:hidden; font-weight:800;}',
    '.ss-ai-btn:hover{background:none;}',
    ".ss-ai-btn::before, .ss-ai-btn::after{content:''; position:absolute; inset:0;",
    '  border-radius:inherit; pointer-events:none;',
    '  background-image:linear-gradient(90deg,var(--color-fire-pastel) 0%,',
    '    var(--color-wood-pastel) 20%,var(--color-earth-pastel) 40%,',
    '    var(--color-water-pastel) 60%,var(--color-gold-pastel) 80%,var(--color-fire-pastel) 100%);',
    '  background-size:200% 100%; animation:c-prompt-bar-glow-move 4s linear infinite;}',
    '.ss-ai-btn::before{z-index:-1; opacity:.18;}',
    '.ss-ai-btn:hover::before{opacity:.32;}',
    '.ss-ai-btn::after{z-index:1; padding:1px;',
    '  -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);',
    '  -webkit-mask-composite:xor; mask-composite:exclude;}',
    /* Working: the sweep speeds up and the fill deepens, so the button itself
       is the progress indicator rather than a spinner bolted beside it. */
    '.ss-ai-btn.is-working{cursor:default;}',
    '.ss-ai-btn.is-working::before{opacity:.42; animation-duration:1.1s;}',
    '.ss-ai-btn.is-working::after{animation-duration:1.1s;}',
    '.ss-ai-btn.is-working i{animation:ss-ai-spin 1.1s var(--ease-standard) infinite;}',
    '@keyframes ss-ai-spin{0%{transform:scale(1); opacity:1;}',
    '  50%{transform:scale(1.35); opacity:.55;} 100%{transform:scale(1); opacity:1;}}',

    /* Which rows Collab AI put there. The point of the tag is that its work is
       reviewable: every one of these still has an x beside it. */
    '.ss-ai-tag{display:inline-flex; align-items:center; gap:4px; flex:none;',
    '  position:relative; z-index:0; overflow:hidden; padding:1px 8px;',
    '  border-radius:var(--radius-pill); font-size:10px; font-weight:800;',
    '  letter-spacing:.01em; color:rgba(8,8,8,.8);}',
    ".ss-ai-tag::before, .ss-ai-tag::after{content:''; position:absolute; inset:0;",
    '  border-radius:inherit; pointer-events:none;',
    '  background-image:linear-gradient(90deg,var(--color-fire-pastel) 0%,',
    '    var(--color-wood-pastel) 20%,var(--color-earth-pastel) 40%,',
    '    var(--color-water-pastel) 60%,var(--color-gold-pastel) 80%,var(--color-fire-pastel) 100%);',
    '  background-size:200% 100%; animation:c-prompt-bar-glow-move 4s linear infinite;}',
    '.ss-ai-tag::before{z-index:-1; opacity:.22;}',
    '.ss-ai-tag::after{z-index:1; padding:1px;',
    '  -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);',
    '  -webkit-mask-composite:xor; mask-composite:exclude;}',
    '.ss-ai-tag i{font-size:9px;}',
    '.ss-ai-tag.is-think i{animation:ss-ai-spin 1.1s var(--ease-standard) infinite;}',
    '.ss-ai-tag.is-think::before{opacity:.34;}',

    /* A row being thought about: the shape of the answer, before the answer. */
    '@keyframes ss-sheen{from{background-position:-180px 0;} to{background-position:260px 0;}}',
    '.ss-prow.ss-ghost, .ss-prow.ss-ghost:hover{background:none; cursor:default;}',
    '.ss-sk{background-color:var(--color-neutral-2); border-radius:var(--radius-pill);',
    "  background-image:linear-gradient(90deg, transparent 0, rgba(255,255,255,.85) 50%, transparent 100%);",
    '  background-repeat:no-repeat; background-size:180px 100%;',
    '  animation:ss-sheen 1.15s linear infinite;}',
    '.ss-ghost .ss-gav{width:28px; height:28px; flex:none;}',
    '.ss-ghost .ss-gline{display:block; height:10px; width:min(140px, 40%);}',

    /* What the assist did, said next to what it did it to. It used to report
       from the banner, which the anchor scrolls off the screen. */
    '.ss-ainote{display:flex; align-items:center; gap:8px; margin:0 0 var(--spacing-12);',
    '  padding:8px var(--spacing-12); border-radius:var(--radius-md);',
    '  background:var(--color-neutral-2); font-size:var(--text-caption-size);',
    '  color:var(--color-neutral-9);}',
    '.ss-ainote i{flex:none; color:var(--color-green);}',
    '.ss-ainote.is-ai{position:relative; z-index:0; overflow:hidden; background:none;',
    '  color:rgba(8,8,8,.8);}',
    ".ss-ainote.is-ai::before, .ss-ainote.is-ai::after{content:''; position:absolute; inset:0;",
    '  border-radius:inherit; pointer-events:none;',
    '  background-image:linear-gradient(90deg,var(--color-fire-pastel) 0%,',
    '    var(--color-wood-pastel) 20%,var(--color-earth-pastel) 40%,',
    '    var(--color-water-pastel) 60%,var(--color-gold-pastel) 80%,var(--color-fire-pastel) 100%);',
    '  background-size:200% 100%; animation:c-prompt-bar-glow-move 4s linear infinite;}',
    '.ss-ainote.is-ai::before{z-index:-1; opacity:.16;}',
    '.ss-ainote.is-ai::after{z-index:1; padding:1px;',
    '  -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);',
    '  -webkit-mask-composite:xor; mask-composite:exclude;}',
    '.ss-ainote.is-ai i{color:inherit; position:relative; z-index:1;}',
    '.ss-ainote.is-ai span{position:relative; z-index:1;}',
    /* The rows it just added land rather than appear. */
    '@keyframes ss-land{from{opacity:0; transform:translateY(-6px);} to{opacity:1; transform:none;}}',
    '.ss-prow.is-new{animation:ss-land var(--duration-base) var(--ease-standard) both;}',

    /* Add band with no number: the count is the field at fault, so it is the
       field that answers — a red edge and two pulses, then back to normal. */
    '@keyframes ss-nudge{0%,100%{box-shadow:0 0 0 0 transparent;}',
    '  25%,75%{box-shadow:0 0 0 4px color-mix(in srgb, var(--color-red) 22%, transparent);}}',
    '.ss-addrow input.is-bad{border-color:var(--color-red); color:var(--color-red);',
    '  animation:ss-nudge 1.1s var(--ease-standard) 2;}',
    '.ss-sr{position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0);',
    '  clip-path:inset(50%); white-space:nowrap;}',
    '@media (prefers-reduced-motion:reduce){',
    '  .ss-ai-btn::before, .ss-ai-btn::after, .ss-ai-tag::before, .ss-ai-tag::after,',
    '  .ss-ainote.is-ai::before, .ss-ainote.is-ai::after, .ss-sk,',
    '  .ss-ai-tag.is-think i, .ss-ai-btn.is-working i, .ss-prow.is-new{animation:none;}',
    '  .ss-addrow input.is-bad{animation:none;} }',
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

  /* opts: {infIds, people, campaigns, defaultCampaignId, lockCampaign,
            onSend, onSelection}
     onSelection fires on every change to who is on the list, so the page that
     opened the sheet can keep its own selection in step — the sheet is now
     where you edit the list, and closing it must not undo that.
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
      showExtra: false, fillNote: '', fillAi: false, q: '', showAll: false, focusQ: false,
      aiAdded: {}, aiBusy: false, newIds: {},
      newPlat: 'tiktok', newTier: 'mid', newN: '',
      infIds: opts.infIds || []
    };

    /* The sheet lives in the shared fold-out modal where the page has one,
       flying out of `opts.anchor`; without it, it owns its own scrim. It
       used to borrow `inf-scrim`, declared in influencers-v2.html's own
       CSS — a shared module cannot depend on one page's stylesheet. */
    var SW = window.swingModal || null;
    var host = document.createElement('div');
    if (SW) {
      host.className = 'ss-host';
      SW.open({anchor: opts.anchor || null, width: 680, key: 'send', label: 'Create selection list'}).appendChild(host);
    } else {
      host.className = 'ss-scrim';
      document.body.appendChild(host);
    }

    /* Never auto-add someone already ticked, already booked on this campaign,
       or already turned down by this client — re-pitching a rejection is worse
       than sending a short list. Lives at open() scope because the click
       handler needs it, not just render(). */
    function excluded() {
      var out = {}, c = destinationCampaign();
      state.infIds.forEach(function (id) { out[id] = true; });
      if (!c) return out;
      (c.roster || []).forEach(function (r) { out[r.inf] = true; });
      (c.batches || []).forEach(function (b) {
        (b.picks || []).forEach(function (p) {
          var ch = p.channels || {};
          if (Object.keys(ch).some(function (k) { return ch[k] === 'rejected'; })) out[p.inf] = true;
        });
      });
      return out;
    }

    /* One avatar recipe for the header stack and the people list both — they
       used to be the same seven lines twice over. */
    function avatarHtml(id, extraCls, title) {
      var rec = opts.people[id];
      if (!rec) return '';
      var m = (window.AVATAR_FILES || {})[id] || {};
      var src = m.tt ? '../assets/avatars/' + id + '-tt.jpg'
              : m.ig ? '../assets/avatars/' + id + '-ig.jpg' : null;
      var parts = String(rec.name || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
      var ini = esc(((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase());
      var cls = 'c-card-profile-avatar' + (extraCls ? ' ' + extraCls : '');
      var t = esc(title == null ? (rec.name || id) : title);
      return src
        ? '<img class="' + cls + '" src="' + esc(src) + '" alt="" title="' + t + '" />'
        : '<span class="' + cls + '" title="' + t + '">' + ini + '</span>';
    }

    function bandChips(bands) {
      if (!bands.length) return '<span class="ss-pb"><span>No accounts</span></span>';
      return '<span class="ss-pb">' + bands.map(function (b) {
        var t = b.tier ? window.tiers.tierByKey(b.tier) : null;
        return '<span' + (b.wanted ? ' class="is-want"' : '') + '>' +
          (t ? '<span class="cmp-dot" style="background:' + t.dot + '"></span>' : '') +
          esc(PLAT_LABEL[b.platform] || b.platform) + ' · ' + esc(t ? t.name : 'Untiered') +
          '</span>';
      }).join('') + '</span>';
    }

    function personHtml(r, extraCls) {
      return '<div class="ss-prow' + (r.fits ? '' : ' is-mis') +
        (state.newIds[r.id] ? ' is-new' : '') + (extraCls ? ' ' + extraCls : '') + '">' +
        avatarHtml(r.id, '', r.name) +
        '<span class="nm">' + esc(r.name) +
          (r.fits ? '' : '<i class="ph-fill ph-warning-circle" ' +
            'title="Fits no band you are asking for"></i>') + '</span>' +
        (state.aiAdded[r.id]
          ? '<span class="ss-ai-tag" title="Added by Collab AI to close a gap">' +
            '<i class="ph-fill ph-sparkle"></i> Collab AI</span>'
          : '') +
        bandChips(r.bands) +
        '<button type="button" class="c-icon-btn" data-ss="drop" data-id="' + esc(r.id) +
          '" title="Take off this list" aria-label="Take ' + esc(r.name) +
          ' off this list"><i class="ph ph-x"></i></button>' +
      '</div>';
    }

    /* Rebuilt on its own so typing in the search box never re-renders the
       sheet around the caret. */
    function resultsHtml() {
      if (!String(state.q || '').trim()) return '';
      var res = searchPeople(state.q, opts.people, excluded(), 6);
      if (!res.length) {
        return '<p class="c-helper">No match, or they are already listed, ' +
          'booked, or turned down.</p>';
      }
      return peopleRows(state.ask, res.map(function (r) { return r.id; }), opts.people)
        .map(function (r) {
          return '<div class="ss-prow">' + avatarHtml(r.id, '', r.name) +
            '<span class="nm">' + esc(r.name) + '</span>' + bandChips(r.bands) +
            '<button type="button" class="c-btn c-btn-secondary c-btn-sm" data-ss="pick" ' +
              'data-id="' + esc(r.id) + '"><i class="ph ph-plus"></i> Add</button></div>';
        }).join('');
    }

    function renderResults() {
      var el = host.querySelector('[data-ss="results"]');
      if (el) el.innerHTML = resultsHtml();
    }

    /* The page that opened the sheet keeps its own selection, so an edit made
       in here has to reach it. Without this, fixing the list and then closing
       would quietly roll the fix back. */
    function sync() { if (opts.onSelection) opts.onSelection(state.infIds.slice()); }

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
      /* innerHTML replaces the scrolling element, so its position has to be
         carried over by hand — otherwise every edit (dropping one person,
         adding a band) returns the user to the top of the sheet. */
      var wasAt = host.querySelector('.c-modal-body');
      wasAt = wasAt ? wasAt.scrollTop : 0;
      seedAsk();
      var cov = bandRows(state.ask, state.infIds, opts.people);
      /* Bands in the ask lead; bands you merely happen to be sending sit
         behind a toggle, so a long tail of "not in the ask" rows does not
         bury the four that matter. */
      var asked = cov.filter(function (r) { return r.want > 0; });
      var extra = cov.filter(function (r) { return !r.want; });
      /* No fallback here any more. This used to promote the bands you happen
         to be sending into rows, because with no ask there was nowhere to
         type; the add-a-band row is that entry point now, so a new campaign
         opens with no lines at all and you state the ask rather than editing
         a list of things you did not ask for. */
      var sum = summary(state.ask, state.infIds, opts.people);
      var c = destinationCampaign();
      var split = matchSplit(state.ask, state.infIds, opts.people);
      /* Misfits lead: they are the rows there is something to do about. Past
         six the list stops being scannable, so the rest sit behind a toggle —
         but a misfit is never in the hidden half. */
      var prows = peopleRows(state.ask, state.infIds, opts.people);
      var ordered = prows.filter(function (r) { return !r.fits; })
                     .concat(prows.filter(function (r) { return r.fits; }));
      var PEEK = 6;
      var shownP = state.showAll ? ordered : ordered.slice(0, PEEK);

      /* Faces, not just a count: the same overlapping stack the campaign
         page uses for a roster. A profile that answers no band being asked
         for is dimmed and ringed rather than hidden — it is still going to
         the client, so it should still be visible. */
      function stackHtml() {
        var mis = {};
        split.mismatch.forEach(function (id) { mis[id] = true; });
        var ids = state.infIds.slice(0, 7);
        if (!ids.length) return '';
        return '<span class="ss-stack">' + ids.map(function (id) {
          var rec = opts.people[id];
          if (!rec) return '';
          return avatarHtml(id, mis[id] ? 'is-mis' : '',
            (rec.name || id) + (mis[id] ? ' — fits no band you are asking for' : ''));
        }).join('') +
        (state.infIds.length > 7 ? '<span class="more">+' + (state.infIds.length - 7) + '</span>' : '') +
        '</span>';
      }

      /* When the campaign already defines the ask, it is the source of truth
         and these numbers are shown, not typed. Editing them here would
         rewrite the campaign silently. A campaign with no ask yet is the one
         case where they are editable, and then they save back to it. */
      var askLocked = !!(c && model().derivedPax(c));

      function stillNeeds() {
        if (!c) return '';
        if (!model().derivedPax(c)) {
          return 'No pax set yet — set them below.';
        }
        var rows = askRows();
        return rows.length
          ? 'Still open: ' + rows.map(function (r) {
              return esc(PLAT_LABEL[r.platform] || r.platform) + ' ' +
                esc(window.tiers.tierByKey(r.tier).name) + ' ×' + r.want;
            }).join(', ')
          : 'Every slot is filled.';
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
          '<div class="ss-head-id">' +
            '<h4 id="ssTitle">Create selection list</h4>' +
            '<div class="ss-who">' + stackHtml() +
              '<p class="sub">' + sum.candidates + (sum.candidates === 1 ? ' profile' : ' profiles') +
              ' · ' + sum.channels + ' channel accounts' +
              (opts.lockCampaign && c ? ' · for ' + esc(c.name) : '') +
              (split.mismatch.length
                ? '<br><span class="ss-mis"><i class="ph-fill ph-warning-circle"></i> ' +
                  split.mismatch.length + ' fit no band you asked for ' +
                  '<button type="button" data-ss="dropmis">Remove</button></span>'
                : '') + '</p>' +
            '</div></div>' +
          '<button class="c-icon-btn" type="button" data-ss="close" aria-label="Close">' +
            '<i class="ph ph-x"></i></button>' +
        '</div>' +

        '<div class="c-modal-body">' +

          (opts.lockCampaign ? '' :
            '<section class="ss-sec">' +
              '<h5 class="ss-sec-h">Send to</h5>' +
              '<div class="ss-dest">' +
                choiceHtml('existing', state.mode === 'existing', 'Existing campaign',
                  'Work you have already won.') +
                choiceHtml('lead', state.mode === 'lead', 'New campaign (lead)',
                  'Work you have not won yet.') +
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
                  '<span class="c-helper span2">Stays out of active counts ' +
                  'until you mark it won.</span></div>') +
              '</div>' +
            '</section>') +

          '<section class="ss-sec">' +
            '<h5 class="ss-sec-h">Pax to select</h5>' +
            (askLocked
              ? '<p class="ss-lede"><span class="ss-lock">' +
                '<i class="ph ph-lock-simple"></i> Set on ' + esc(c.name) +
                ' — change it there.</span></p>'
              : '') +
            (cov.length || !askLocked
              ? '<div class="c-table-standalone-wrap">' +
                  '<table class="c-table c-table-standalone"><thead><tr>' +
                    '<th>Channel · Tier</th><th class="n">Pax to pick</th>' +
                    '<th class="n">Profiles sent</th>' +
                    '<th class="note">Can they pick that many?</th></tr></thead><tbody>' +
                    (asked.length ? asked.map(rowHtml).join('')
                      : '<tr class="ss-none"><td colspan="4">No bands yet — add one below.</td></tr>') +
                    (!askLocked
                      ? '<tr class="ss-add"><td colspan="4">' +
                        '<div class="ss-addrow">' +
                          '<select data-ss="newplat" aria-label="Channel to add">' +
                            S.PLATFORMS.map(function (pl) {
                              return '<option value="' + pl.key + '"' +
                                (state.newPlat === pl.key ? ' selected' : '') + '>' +
                                esc(pl.label) + '</option>';
                            }).join('') + '</select>' +
                          '<select data-ss="newtier" aria-label="Tier to add">' +
                            window.tiers.TIERS.map(function (t) {
                              return '<option value="' + t.key + '"' +
                                (state.newTier === t.key ? ' selected' : '') + '>' +
                                esc(t.name) + '</option>';
                            }).join('') + '</select>' +
                          '<input type="number" min="1" inputmode="numeric" data-ss="newn" ' +
                            'value="' + (state.newN || '') + '" placeholder="0" aria-label="How many" />' +
                          '<button type="button" class="c-btn c-btn-secondary c-btn-sm" data-ss="addband">' +
                            '<i class="ph ph-plus"></i> Add band</button>' +
                          '<span class="ss-sr" role="alert" data-ss="addalert"></span>' +
                        '</div></td></tr>'
                      : '') +
                    (extra.length
                      ? '<tr class="ss-more"><td colspan="4">' +
                        '<button type="button" data-ss="more">' +
                        '<i class="ph ph-caret-' + (state.showExtra ? 'up' : 'down') + '"></i> ' +
                        (state.showExtra ? 'Hide ' : 'Show ') + extra.length +
                        ' other band' + (extra.length === 1 ? '' : 's') +
                        '</button></td></tr>' +
                        (state.showExtra ? extra.map(rowHtml).join('') : '')
                      : '') +
                  '</tbody></table></div>' +
                (sum.shortBands
                  ? '<div class="c-banner c-banner-ai ss-warn" role="status">' +
                    '<i class="ph-fill ph-sparkle icon"></i><div class="body"><p class="message">' +
                    sum.shortBands + (sum.shortBands === 1 ? ' band is' : ' bands are') +
                    ' short — the client will see a number they cannot reach.</p>' +
                    '<p class="message ss-sub">Collab AI picks the biggest accounts that fit, ' +
                    'skipping anyone already listed, booked, or turned down.</p>' +
                    '<div class="actions">' +
                      '<button type="button" class="c-btn c-btn-ghost c-btn-sm ss-ai-btn" ' +
                      'data-ss="fill"><i class="ph-fill ph-sparkle"></i> ' +
                      'Let Collab AI fill the gaps</button></div></div></div>'
                  : '')
              : '<p class="c-helper">Tick some profiles and their bands appear here.</p>') +
          '</section>' +

          '<section class="ss-sec" data-ss="whosec">' +
            '<h5 class="ss-sec-h">Who you are sending <span class="opt">' +
              prows.length + (prows.length === 1 ? ' profile' : ' profiles') +
              (split.mismatch.length ? ' · ' + split.mismatch.length + ' off the brief' : '') +
              '</span></h5>' +
            (state.fillNote
              ? '<p class="ss-ainote' + (state.fillAi ? ' is-ai' : '') + '" role="status">' +
                '<i class="ph-fill ph-' + (state.fillAi ? 'sparkle' : 'check-circle') + '"></i>' +
                '<span>' + esc(state.fillNote) + '</span></p>'
              : '') +
            '<div class="ss-plist" data-ss="plist">' +
              (shownP.length ? shownP.map(personHtml).join('')
                : '<p class="c-helper">Nobody yet — search below.</p>') +
              (ordered.length > PEEK
                ? '<button type="button" class="ss-allbtn" data-ss="all">' +
                  '<i class="ph ph-caret-' + (state.showAll ? 'up' : 'down') + '"></i> ' +
                  (state.showAll ? 'Show fewer' : 'Show all ' + ordered.length) + '</button>'
                : '') +
            '</div>' +
            '<div class="ss-search"><i class="ph ph-magnifying-glass"></i>' +
              '<input data-ss="q" value="' + esc(state.q) + '" ' +
              'placeholder="Add someone — name or handle" ' +
              'aria-label="Search the roster for someone to add" /></div>' +
            '<div class="ss-plist ss-results" data-ss="results">' + resultsHtml() + '</div>' +
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
                '" placeholder="Name or email" /></div>' +
            '</div>' +
            '<label class="c-choice" style="margin-top:var(--spacing-12)">' +
              '<input type="checkbox" data-ss="requireName"' +
                (state.requireName ? ' checked' : '') + ' />' +
              '<span class="c-checkbox-box' + (state.requireName ? ' on' : '') + '">' +
                (state.requireName ? '<i class="ph-bold ph-check"></i>' : '') + '</span>' +
              '<span class="text"><span class="label">Ask for a name before ' +
              'responding</span></span></label>' +
            '<p class="ss-err" data-ss="err" hidden></p>' +
          '</section>' +

        '</div>' +

        '<div class="c-modal-foot">' +
          '<button class="c-btn c-btn-secondary c-btn-md" type="button" data-ss="cancel">Cancel</button>' +
          '<button class="c-btn c-btn-primary c-btn-md" type="button" data-ss="send">' +
            '<i class="ph ph-paper-plane-tilt"></i> Create list</button>' +
        '</div></div>';

      /* The DLS dropdown replaces each native select in place, keeping the
         select as the value holder — so the change handlers below go on
         reading `data-ss` off it exactly as before. */
      if (window.collabDropdown) {
        host.querySelectorAll('select[data-ss]').forEach(function (sl) {
          window.collabDropdown.enhance(sl, {placeholder: 'Pick one'});
        });
      }
      if (wasAt) {
        var nowAt = host.querySelector('.c-modal-body');
        if (nowAt) nowAt.scrollTop = wasAt;
      }

      state.newIds = {};

      /* Adding someone re-renders the whole sheet, which would otherwise drop
         you out of the search box mid-search. */
      if (state.focusQ) {
        state.focusQ = false;
        var q = host.querySelector('[data-ss="q"]');
        if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      }
    }

    /* Rolled by hand rather than scrollTo({behavior:'smooth'}), which some
       browsers and OS motion settings quietly decline — and a scroll that
       sometimes does not happen is worse than one that always does. Each frame
       re-finds the body, because a render in the middle of a glide replaces
       the element the tween started on. */
    var glide = null;
    function anchor(el, smooth) {
      var body = host.querySelector('.c-modal-body');
      if (!body || !el) return;
      var to = body.scrollTop +
        el.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
      to = Math.max(0, Math.min(to, body.scrollHeight - body.clientHeight));
      if (glide) { cancelAnimationFrame(glide); glide = null; }
      if (!smooth) { body.scrollTop = to; return; }

      var from = body.scrollTop, start = 0, DUR = 420;
      function step(ts) {
        var b = host.querySelector('.c-modal-body');
        if (!b) { glide = null; return; }
        if (!start) start = ts;
        var k = Math.min(1, (ts - start) / DUR);
        b.scrollTop = from + (to - from) * (1 - Math.pow(1 - k, 3));
        glide = k < 1 ? requestAnimationFrame(step) : null;
      }
      glide = requestAnimationFrame(step);
    }

    function working(btn, label) {
      if (!btn) return;
      btn.classList.add('is-working');
      btn.disabled = true;
      btn.innerHTML = '<i class="ph-fill ph-sparkle"></i> ' + esc(label);
    }

    /* The assist works where its answer will land: anchor to the list, think
       in it, then fill the rows in one at a time. The search itself is instant
       — a sort over a list already in memory — so the pacing is a choice. It
       buys the one thing a silent result cannot: the user watches the rows
       they asked for being built, in the place they will have to judge them,
       instead of a button spinning in a banner while the answer appears off
       the bottom of the sheet. */
    function runAssist(btn) {
      var rows = bandRows(state.ask, state.infIds, opts.people);
      var short = rows.filter(function (r) { return r.gap > 0; });
      var add = fillGaps(rows, opts.people, excluded());

      /* The first short band this profile answers — so a thinking row can name
         the gap it is being pulled in to close. */
      function bandFor(id) {
        var chans = model().channelsOf(opts.people[id]);
        for (var i = 0; i < short.length; i++) {
          var b = short[i];
          var hit = chans.some(function (ch) {
            var t = window.tiers.tierOf(ch.followers);
            return ch.platform === b.platform && t && t.key === b.tier;
          });
          if (hit) {
            return (PLAT_LABEL[b.platform] || b.platform) + ' · ' +
              window.tiers.tierByKey(b.tier).name;
          }
        }
        return null;
      }

      /* Say what happened, including what could not: a band the list cannot
         fill is the thing worth knowing, and it is invisible if the only
         feedback is rows appearing. */
      function report() {
        var left = bandRows(state.ask, state.infIds, opts.people)
          .filter(function (r) { return r.gap > 0; });
        state.fillAi = true;
        state.fillNote = !add.length
          ? 'Nothing in your list fits the short bands.'
          : 'Added ' + add.length + (add.length === 1 ? ' profile' : ' profiles') +
            (left.length
              ? ', but ' + left.map(function (r) {
                  return (PLAT_LABEL[r.platform] || r.platform) + ' ' +
                    window.tiers.tierByKey(r.tier).name + ' still ' + r.gap + ' short.';
                }).join(' ')
              : ' — all bands covered.');
      }

      var still = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      /* Nothing it adds should land behind a "show all" toggle. */
      state.showAll = true;

      if (still) {
        state.infIds = state.infIds.concat(add);
        state.newIds = {};
        add.forEach(function (id) { state.aiAdded[id] = true; state.newIds[id] = true; });
        report();
        sync();
        render();
        return anchor(host.querySelector('[data-ss="whosec"]'), false);
      }

      state.aiBusy = true;
      working(btn, 'Working…');
      render();
      anchor(host.querySelector('[data-ss="whosec"]'), true);

      var STEP = 260, LEAD = 520;
      setTimeout(function () {
        var list = host.querySelector('[data-ss="plist"]');
        if (!list) { state.aiBusy = false; return; }

        /* One thinking row per profile it is about to add, so the list shows
           the shape of the answer before the answer. Nothing to add still
           gets one, or the assist would look like it never ran. */
        var n = add.length || 1;
        var ghosts = '';
        for (var i = 0; i < n; i++) {
          ghosts += '<div class="ss-prow ss-ghost" data-ghost="' + i + '">' +
            '<span class="ss-gav ss-sk"></span>' +
            '<span class="nm"><span class="ss-gline ss-sk"></span></span>' +
            '<span class="ss-ai-tag is-think"><i class="ph-fill ph-sparkle"></i> ' +
            esc(add.length
              ? 'Matching ' + (bandFor(add[i]) || 'the short bands') + '…'
              : 'Reading your influencer list…') + '</span></div>';
        }
        list.insertAdjacentHTML('beforeend', ghosts);

        add.forEach(function (id, i) {
          setTimeout(function () {
            var g = list.querySelector('[data-ghost="' + i + '"]');
            if (!g) return;
            /* Committed as it lands, not all at the end — so a click during
               the fill acts on a list that is telling the truth. */
            state.infIds = state.infIds.concat([id]);
            state.aiAdded[id] = true;
            sync();
            g.outerHTML = personHtml(peopleRows(state.ask, [id], opts.people)[0], 'is-new');
          }, LEAD + i * STEP);
        });

        setTimeout(function () {
          state.aiBusy = false;
          state.newIds = {};   /* they already landed; do not play it twice */
          report();
          render();
          /* Filling the last gap takes the banner away, so everything below it
             shifts up. render() holds the old offset; this glides to the new
             one rather than letting the section jump under the eye. */
          anchor(host.querySelector('[data-ss="whosec"]'), true);
        }, LEAD + n * STEP + 180);
      }, 420);
    }

    function close() { if (SW && SW.isOpen('send')) SW.close(); else host.remove(); }

    host.addEventListener('click', function (e) {
      if (e.target === host || e.target.closest('[data-ss="close"], [data-ss="cancel"]')) return close();
      if (e.target.closest('[data-ss="addband"]')) {
        var n = Math.max(0, Math.floor(Number(state.newN) || 0));
        if (!n) {
          var box = host.querySelector('[data-ss="newn"]');
          var alert = host.querySelector('[data-ss="addalert"]');
          if (box) {
            box.setAttribute('aria-invalid', 'true');
            /* Re-adding the class alone will not restart a running animation;
               reading offsetWidth between the two forces the reflow that does. */
            box.classList.remove('is-bad');
            void box.offsetWidth;
            box.classList.add('is-bad');
            box.focus();
          }
          if (alert) alert.textContent = 'Enter how many.';
          return;
        }
        state.ask[state.newPlat] = state.ask[state.newPlat] || {};
        state.ask[state.newPlat][state.newTier] = n;
        askTouched = true;
        state.newN = '';
        state.fillNote = '';
        return render();
      }
      var drop = e.target.closest('[data-ss="drop"]');
      if (drop) {
        state.infIds = state.infIds.filter(function (x) { return x !== drop.dataset.id; });
        state.fillNote = '';
        sync();
        return render();
      }
      var pick = e.target.closest('[data-ss="pick"]');
      if (pick) {
        if (state.infIds.indexOf(pick.dataset.id) === -1) state.infIds.push(pick.dataset.id);
        state.fillNote = '';
        state.focusQ = true;
        sync();
        return render();
      }
      if (e.target.closest('[data-ss="all"]')) {
        state.showAll = !state.showAll;
        return render();
      }
      if (e.target.closest('[data-ss="dropmis"]')) {
        var keep = matchSplit(state.ask, state.infIds, opts.people).match;
        var dropped = state.infIds.length - keep.length;
        state.infIds = keep;
        state.fillAi = false;
        state.fillNote = 'Removed ' + dropped + ' that fit no band you asked for.';
        sync();
        return render();
      }
      var fillBtn = e.target.closest('[data-ss="fill"]');
      if (fillBtn) { if (!state.aiBusy) runAssist(fillBtn); return; }
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
      /* The note reports a run against one destination's ask. Change the
         destination and it is describing something that is no longer on screen. */
      if (t.name === 'ssMode') {
        state.mode = t.value; askTouched = false; state.fillNote = '';
        return render();
      }
      if (t.dataset.ss === 'campaign') {
        state.campaignId = t.value; askTouched = false; state.fillNote = '';
        return render();
      }
      if (t.dataset.ss === 'ask') {
        askTouched = true;
        var n = Math.max(0, Number(t.value) || 0);
        state.ask[t.dataset.plat] = state.ask[t.dataset.plat] || {};
        if (n) state.ask[t.dataset.plat][t.dataset.tier] = n;
        else delete state.ask[t.dataset.plat][t.dataset.tier];
        return render();
      }
      if (t.dataset.ss === 'newplat') { state.newPlat = t.value; return; }
      if (t.dataset.ss === 'newtier') { state.newTier = t.value; return; }
      if (t.dataset.ss === 'requireName') { state.requireName = t.checked; return; }
      if (t.dataset.ss === 'expiryDays') { state.expiryDays = Number(t.value); return; }
    });

    /* Text inputs update state without a re-render, so the caret stays put. */
    host.addEventListener('input', function (e) {
      var k = e.target.dataset.ss;
      if (k === 'leadName' || k === 'leadBrand' || k === 'name' || k === 'recipient') {
        state[k] = e.target.value;
      }
      if (k === 'newn') {
        state.newN = e.target.value;
        e.target.classList.remove('is-bad');
        e.target.removeAttribute('aria-invalid');
        var al = host.querySelector('[data-ss="addalert"]');
        if (al) al.textContent = '';
      }
      if (k === 'q') { state.q = e.target.value; renderResults(); }
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
    candidatesFor: candidatesFor, fillGaps: fillGaps, matchSplit: matchSplit,
    peopleRows: peopleRows, searchPeople: searchPeople,
    validate: validate, expiryFrom: expiryFrom, isExpired: isExpired,
    open: open
  };
})();
