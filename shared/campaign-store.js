/* Campaign store — the same localStorage overlay model as the roster
   store: the seeded list in campaigns-data.js stays read-only, and this
   layers the user's additions, edits and removals on top of it.

   Unlike the roster, edits here are cumulative patches (a stage change
   should not throw away an earlier roster edit), so `update` merges
   into the stored patch rather than replacing it.

   The vocabularies the pages share — stages, pick statuses, platforms,
   team members — live here too, so the list, the detail page and the
   influencers page all say the same thing about the same campaign. */
(function () {
  'use strict';

  var KEY = window.CAMPAIGN_STORE_KEY || 'collab-campaigns-v1';

  /* Stage order is the pipeline order. `dot` is a DLS token so the
     list's strip, the badge and the detail header agree on the hue. */
  var STAGES = [
    {key: 'lead',      label: 'Lead',      short: 'Lead',      dot: 'var(--color-neutral-4)'},
    {key: 'sourcing',  label: 'Sourcing',            short: 'Sourcing',  dot: 'var(--color-navy)'},
    {key: 'drafting',  label: 'Drafting',            short: 'Drafting',  dot: 'var(--color-turquoise)'},
    {key: 'posting',   label: 'Posting',             short: 'Posting',   dot: 'var(--color-green)'},
    {key: 'reporting', label: 'Reporting',           short: 'Reporting', dot: 'var(--color-amber)'},
    {key: 'payment',   label: 'Payment',             short: 'Payment',   dot: 'var(--color-purple)'},
    {key: 'completed', label: 'Completed',           short: 'Completed', dot: 'var(--color-neutral-4)'}
  ];
  /* What the client answered on a preview link, per pick. */
  var PICK_STATUS = [
    {key: 'none',        label: 'No response', badge: 'c-badge-neutral', dot: 'var(--color-neutral-4)'},
    {key: 'selected',    label: 'Selected',    badge: 'c-badge-success', dot: 'var(--color-green)'},
    {key: 'kiv',         label: 'KIV',         badge: 'c-badge-warning', dot: 'var(--color-amber)'},
    {key: 'rejected',    label: 'Rejected',    badge: 'c-badge-error',   dot: 'var(--color-red)'},
    {key: 'unavailable', label: 'Unavailable', badge: 'c-badge-neutral', dot: 'var(--color-neutral-5)'}
  ];
  var PLATFORMS = [
    {key: 'tiktok',    label: 'TikTok'},
    {key: 'instagram', label: 'Instagram'},
    {key: 'xhs',       label: 'Xiaohongshu'}
  ];
  var TYPES = ['Influencers', 'Seeders', 'KOC'];
  var SALES_KEY = 'collab-salespeople-v1';
  var TEAM = ['Digital Team', 'Neeza', 'Melissa N.', 'Izuan I.', 'Pui Yann', 'Grace Wong', 'Amir Rahman'];
  /* Colour swatches for the campaign's own bar — DLS tokens only. */
  var COLORS = [
    {key: 'obsidian', css: 'var(--color-obsidian)'},
    {key: 'fire',     css: 'var(--color-fire-pastel)'},
    {key: 'wood',     css: 'var(--color-wood-pastel)'},
    {key: 'earth',    css: 'var(--color-earth-pastel)'},
    {key: 'water',    css: 'var(--color-water-pastel)'},
    {key: 'gold',     css: 'var(--color-gold-pastel)'},
    {key: 'purple',   css: 'var(--color-purple)'},
    {key: 'turquoise', css: 'var(--color-turquoise)'}
  ];

  /* Stages that count as live work. `lead` is a pitch, not a campaign yet,
     so it stays out of the dashboard's active counts and the pipeline strip. */
  function isActiveStage(key) { return key !== 'lead' && key !== 'completed'; }

  /* The influencer records migration needs, injected rather than read off a
     global so the store can be tested without loading a 283KB data file. */
  var PEOPLE = {};
  function setPeople(map) { PEOPLE = map || {}; }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function state() {
    var s = load();
    s.added = s.added || [];
    s.edits = s.edits || {};
    s.removed = s.removed || [];
    return s;
  }
  function base() { return window.CAMPAIGNS || []; }
  function apply(r, s) {
    return s.edits[r.id] ? Object.assign({}, r, s.edits[r.id], {id: r.id}) : r;
  }
  function merged() {
    var s = state();
    var live = function (r) { return s.removed.indexOf(r.id) < 0; };
    var out = base().filter(live).map(function (r) { return apply(r, s); })
      .concat(s.added.filter(live).map(function (r) { return apply(r, s); }));
    out.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    return out.map(function (c) { return window.campaignModel.migrate(c, PEOPLE); });
  }
  function get(id) {
    return merged().filter(function (c) { return c.id === id; })[0] || null;
  }
  /* ── Activity. Every meaningful write leaves one line on the record, so
     the campaign page can show what happened without a second store. `by`
     is the workspace user; the prototype has one. Notes come in through
     addNote and share the stream. */
  var BY = 'Digital Team';
  var PLAT_LABEL = {tiktok: 'TikTok', instagram: 'Instagram', xhs: 'Xiaohongshu'};
  function entry(type, text, ref) {
    var e = {at: new Date().toISOString(), by: BY, type: type, text: text};
    if (ref) e.ref = ref;
    return e;
  }
  function nameOf(inf) { return (PEOPLE[inf] && PEOPLE[inf].name) || inf; }

  /* ── Deliverables vocabulary. Kinds per platform; five working states;
     the client's word on each. */
  var DELIV_KINDS = {tiktok: ['video'], instagram: ['reel', 'post', 'story'], xhs: ['note']};
  var DELIV_STATUS = [
    {key: 'not_started', label: 'Not started', dot: 'var(--color-neutral-4)'},
    {key: 'drafted',     label: 'Drafted',     dot: 'var(--color-navy)'},
    {key: 'review',      label: 'In review',   dot: 'var(--color-amber)'},
    {key: 'approved',    label: 'Approved',    dot: 'var(--color-turquoise)'},
    {key: 'posted',      label: 'Posted',      dot: 'var(--color-green)'}
  ];
  var CLIENT_APPROVAL = [
    {key: 'pending',  label: 'Pending',         dot: 'var(--color-neutral-4)'},
    {key: 'approved', label: 'Client approved', dot: 'var(--color-green)'},
    {key: 'changes',  label: 'Changes asked',   dot: 'var(--color-amber)'}
  ];
  function labelOf(list, key) { var x = list.filter(function (o) { return o.key === key; })[0]; return x ? x.label : key; }
  function kindLabel(d) { return (PLAT_LABEL[d.platform] || d.platform) + ' ' + d.kind; }
  /* A record that still holds {done, total} becomes a list on the first
     write; the list is the truth from then on. */
  function delivList(c) { return Array.isArray(c.deliverables) ? c.deliverables.slice() : []; }

  /* `log` is an optional activity entry appended with the patch. A stage
     change is logged here whichever caller made it, since three surfaces
     can move a campaign and none of them should have to remember to. */
  function update(id, patch, log) {
    var s = state();
    var before = get(id);
    var entries = [];
    if (patch.stage && before && patch.stage !== before.stage) {
      var st = stageOf(patch.stage);
      entries.push(entry('stage', before.stage === 'lead' && patch.stage !== 'lead'
        ? 'Marked as won, moved to ' + st.label : 'Moved to ' + st.label));
    }
    if (log) entries.push(log);
    var next = Object.assign({}, patch, {updatedAt: Date.now()});
    if (entries.length) {
      var have = (s.edits[id] && s.edits[id].activity) || (before && before.activity) || [];
      next.activity = have.concat(entries);
    }
    s.edits[id] = Object.assign({}, s.edits[id] || {}, next);
    save(s);
    return get(id);
  }

  /* ── Derived figures, one place. */
  function num(v) { return (v === '' || v == null || isNaN(Number(v))) ? null : Number(v); }
  function money(c) {
    var q = num(c.quote), k = num(c.cost);
    var margin = (q != null && k != null) ? q - k : null;
    var pp = num(c.picPct), op = c.overseer ? num(c.overseerPct) : null;
    return {
      quote: q, cost: k, margin: margin,
      marginPct: (margin != null && q) ? Math.round(margin / q * 100) : null,
      picPct: pp, overseerPct: op,
      picRev: (margin != null && pp != null) ? margin * pp / 100 : null,
      overseerRev: (margin != null && op != null) ? margin * op / 100 : null,
      picGross: (q != null && pp != null) ? q * pp / 100 : null,
      overseerGross: (q != null && op != null) ? q * op / 100 : null
    };
  }
  function pickCounts(c) {
    var out = {requested: 0};
    PICK_STATUS.forEach(function (p) { out[p.key] = 0; });
    (c.batches || []).forEach(function (b) {
      (b.picks || []).forEach(function (p) {
        out.requested += 1;
        /* Statuses live on the channels now; roll them up so the counts the
           list and the header show keep meaning one row per creator. */
        out[window.campaignModel.pickStatus(p)] += 1;
      });
    });
    return out;
  }

  /* ── Formatting shared by the pages. */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function parse(iso) {
    if (!iso) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? {y: +m[1], m: +m[2], d: +m[3]} : null;
  }
  function fmtDate(iso, withYear) {
    var p = parse(iso);
    if (!p) return '';
    return p.d + ' ' + MONTHS[p.m - 1] + (withYear ? ' ' + p.y : '');
  }
  /* "1 Sep – 30 Sep 2026" when both ends share a year; the year lands
     on both when they differ, the way the live list writes it. */
  function fmtRange(a, b) {
    var pa = parse(a), pb = parse(b);
    if (!pa && !pb) return '—';
    if (!pb) return fmtDate(a, true);
    if (!pa) return fmtDate(b, true);
    var sameYear = pa.y === pb.y;
    return fmtDate(a, !sameYear) + ' – ' + fmtDate(b, true);
  }
  function fmtNum(n) {
    n = num(n);
    if (n == null) return '—';
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmtRM(n) {
    n = num(n);
    return n == null ? '—' : 'RM ' + fmtNum(n);
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function stageOf(key) {
    return STAGES.filter(function (s) { return s.key === key; })[0] || STAGES[0];
  }
  function colorOf(key) {
    return (COLORS.filter(function (c) { return c.key === key; })[0] || COLORS[0]).css;
  }
  function initials(name) {
    var parts = String(name || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
    if (!parts[0]) return '?';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  window.campaignStore = {
    STAGES: STAGES, PICK_STATUS: PICK_STATUS, PLATFORMS: PLATFORMS,
    TYPES: TYPES, TEAM: TEAM, COLORS: COLORS,
    stageOf: stageOf, colorOf: colorOf, initials: initials,
    money: money, pickCounts: pickCounts, num: num,
    fmtDate: fmtDate, fmtRange: fmtRange, fmtNum: fmtNum, fmtRM: fmtRM, today: today,
    isActiveStage: isActiveStage, setPeople: setPeople,

    merged: merged,
    get: get,
    add: function (rec) {
      var s = state();
      rec.id = 'ucamp-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e4).toString(36);
      rec.createdAt = rec.updatedAt = Date.now();
      rec.roster = rec.roster || [];
      rec.batches = rec.batches || [];
      rec.deliverables = rec.deliverables || {done: 0, total: 0};
      rec.activity = (rec.activity || []).concat([entry('create',
        rec.stage === 'lead' ? 'Created as a lead' : 'Created')]);
      s.added.push(rec);
      save(s);
      return rec.id;
    },
    update: function (id, patch) { return update(id, patch); },
    addNote: function (id, text) {
      text = String(text || '').trim();
      if (!text) return get(id);
      return update(id, {}, entry('note', text));
    },
    remove: function (id) {
      var s = state();
      if (s.removed.indexOf(id) < 0) s.removed.push(id);
      save(s);
    },

    /* The ask. pax and platforms are derived from it, not typed, so the
       list view keeps rendering without knowing about slots. */
    setRequirement: function (id, requirement) {
      var before = get(id);
      var had = before && window.campaignModel.slotsOf(before).length;
      return update(id, {
        requirement: requirement,
        pax: window.campaignModel.derivedPax({requirement: requirement}),
        platforms: Object.keys(requirement)
      }, entry('edit', had ? 'Changed the ask' : 'Set the ask'));
    },

    /* Roster — one entry per creator per channel. */
    addToRoster: function (id, entries, source, batch) {
      var c = get(id); if (!c) return null;
      var roster = (c.roster || []).slice();
      entries.forEach(function (e) {
        if (roster.some(function (r) { return r.inf === e.inf && r.platform === e.platform; })) return;
        roster.push({
          inf: e.inf, platform: e.platform, tier: e.tier,
          source: source || 'team', batch: batch == null ? null : batch,
          state: e.state || 'confirmed', substitutedFor: e.substitutedFor || null
        });
      });
      return update(id, {roster: roster});
    },
    removeFromRoster: function (id, inf, platform) {
      var c = get(id); if (!c) return null;
      return update(id, {roster: (c.roster || []).filter(function (r) {
        return !(r.inf === inf && (platform == null || r.platform === platform));
      })});
    },
    /* The agency's availability call: approved -> confirmed, or unavailable,
       which releases the slot without deleting the history. */
    setRosterState: function (id, inf, platform, nextState) {
      var c = get(id); if (!c) return null;
      var verb = nextState === 'confirmed' ? 'Confirmed ' : nextState === 'unavailable' ? 'Marked unavailable: ' : 'Reopened ';
      return update(id, {roster: (c.roster || []).map(function (r) {
        return (r.inf === inf && r.platform === platform)
          ? Object.assign({}, r, {state: nextState,
              confirmedAt: nextState === 'confirmed' ? today() : r.confirmedAt})
          : r;
      })}, entry('roster', verb + nameOf(inf) + ' on ' + (PLAT_LABEL[platform] || platform),
        {inf: inf, platform: platform}));
    },

    /* Count a fill toward a different band than its own tier — or stop
       doing so, with null. The entry keeps its real tier; only where it is
       counted moves. */
    setSubstitution: function (id, inf, platform, forTier) {
      var c = get(id); if (!c) return null;
      var tierName = function (k) { var t = k && window.tiers.tierByKey(k); return t ? t.name : k; };
      return update(id, {roster: (c.roster || []).map(function (r) {
        return (r.inf === inf && r.platform === platform)
          ? Object.assign({}, r, {substitutedFor: forTier || null}) : r;
      })}, entry('roster', (forTier ? 'Counted ' + nameOf(inf) + ' on ' + (PLAT_LABEL[platform] || platform) + ' toward ' + tierName(forTier)
                                    : 'Stopped counting ' + nameOf(inf) + ' on ' + (PLAT_LABEL[platform] || platform) + ' as a stand-in'),
        {inf: inf, platform: platform}));
    },

    /* One channel's answer on one pick. `selected` puts that channel on the
       roster as approved; any other answer takes back an entry the client's
       own answer put there, and leaves a hand-added one alone. */
    setChannelStatus: function (id, n, inf, platform, status) {
      var c = get(id); if (!c) return null;
      var batches = (c.batches || []).map(function (b) {
        if (b.n !== n) return b;
        return Object.assign({}, b, {picks: (b.picks || []).map(function (p) {
          if (p.inf !== inf) return p;
          var channels = Object.assign({}, p.channels);
          channels[platform] = status;
          return Object.assign({}, p, {channels: channels});
        })});
      });

      var roster = (c.roster || []).slice();
      var at = function (r) { return r.inf === inf && r.platform === platform; };
      if (status === 'selected') {
        if (!roster.some(at)) {
          var ch = window.campaignModel.channelsOf(PEOPLE[inf])
            .filter(function (x) { return x.platform === platform; })[0];
          var t = ch ? window.tiers.tierOf(ch.followers) : null;
          roster.push({
            inf: inf, platform: platform, tier: t ? t.key : null,
            source: 'client', batch: n, state: 'approved',
            substitutedFor: null
          });
        }
      } else {
        roster = roster.filter(function (r) {
          return !(at(r) && r.source === 'client' && r.batch === n);
        });
      }
      var said = {selected: 'approved', kiv: 'marked KIV', rejected: 'rejected',
        unavailable: 'marked unavailable', none: 'cleared the answer for'}[status] || status;
      return update(id, {batches: batches, roster: roster},
        entry('answer', 'Client ' + said + ' ' + nameOf(inf) + ' on ' + (PLAT_LABEL[platform] || platform),
          {batch: n, inf: inf, platform: platform}));
    },

    /* The campaign page still offers one status control per creator, so this
       fans the answer out across every channel they are on. The share page
       answers channels individually; this is the bridge until the slot board
       replaces that control. */
    setCreatorStatus: function (id, n, inf, status) {
      var c = get(id); if (!c) return null;
      var b = (c.batches || []).filter(function (x) { return x.n === n; })[0];
      var p = b && (b.picks || []).filter(function (x) { return x.inf === inf; })[0];
      if (!p) return c;
      Object.keys(p.channels || {}).forEach(function (platform) {
        c = window.campaignStore.setChannelStatus(id, n, inf, platform, status);
      });
      return c;
    },

    /* ── Salespeople: everyone named on a campaign, plus names added by
       hand, kept under their own key so a store reset leaves them. */
    salespeople: function () {
      var seen = {}, out = [];
      function add(n) { n = String(n || '').trim(); if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = true; out.push(n); } }
      try { (JSON.parse(localStorage.getItem(SALES_KEY)) || []).forEach(add); } catch (e) {}
      merged().forEach(function (c) { add(c.salesperson); });
      return out.sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; });
    },
    addSalesperson: function (name) {
      name = String(name || '').trim(); if (!name) return null;
      var list = [];
      try { list = JSON.parse(localStorage.getItem(SALES_KEY)) || []; } catch (e) {}
      if (!list.some(function (x) { return x.toLowerCase() === name.toLowerCase(); })) {
        list.push(name);
        try { localStorage.setItem(SALES_KEY, JSON.stringify(list)); } catch (e) {}
      }
      return name;
    },

    /* ── Deliverables. */
    DELIV_KINDS: DELIV_KINDS, DELIV_STATUS: DELIV_STATUS, CLIENT_APPROVAL: CLIENT_APPROVAL,
    addDeliverable: function (id, d) {
      var c = get(id); if (!c) return null;
      var list = delivList(c);
      var rec = Object.assign({
        id: 'd-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e4).toString(36),
        inf: null, platform: 'tiktok', kind: null, dueAt: '', link: '', caption: '',
        status: 'not_started', clientApproval: 'pending', internalNote: '', clientNote: ''
      }, d || {});
      if (!rec.kind) rec.kind = (DELIV_KINDS[rec.platform] || ['post'])[0];
      list.push(rec);
      update(id, {deliverables: list}, entry('deliverable',
        'Planned a ' + kindLabel(rec) + ' for ' + nameOf(rec.inf), {deliverable: rec.id, inf: rec.inf}));
      return rec.id;
    },
    updateDeliverable: function (id, did, patch) {
      var c = get(id); if (!c) return null;
      var before = delivList(c).filter(function (x) { return x.id === did; })[0];
      if (!before) return c;
      var next = Object.assign({}, before, patch);
      if (next.platform !== before.platform && !(patch && patch.kind)) next.kind = (DELIV_KINDS[next.platform] || ['post'])[0];
      var log = null;
      if (next.status !== before.status) {
        log = entry('deliverable', 'Marked ' + nameOf(next.inf) + "'s " + kindLabel(next) + ' as ' + labelOf(DELIV_STATUS, next.status).toLowerCase(),
          {deliverable: did, inf: next.inf});
      } else if (next.clientApproval !== before.clientApproval) {
        var said = next.clientApproval === 'approved' ? 'Client approved ' : next.clientApproval === 'changes' ? 'Client asked for changes on ' : 'Client approval reset on ';
        log = entry('deliverable', said + nameOf(next.inf) + "'s " + kindLabel(next), {deliverable: did, inf: next.inf, client: true});
      }
      return update(id, {deliverables: delivList(c).map(function (x) { return x.id === did ? next : x; })}, log);
    },
    removeDeliverable: function (id, did) {
      var c = get(id); if (!c) return null;
      return update(id, {deliverables: delivList(c).filter(function (x) { return x.id !== did; })});
    },

    /* Patch a pick's own fields — the remarks. Status is not patchable here;
       it belongs to the channels, via setChannelStatus or setCreatorStatus. */
    updatePick: function (id, n, inf, patch) {
      var c = get(id); if (!c) return null;
      var clean = Object.assign({}, patch);
      delete clean.status; delete clean.channels;
      return update(id, {batches: (c.batches || []).map(function (b) {
        if (b.n !== n) return b;
        return Object.assign({}, b, {picks: (b.picks || []).map(function (p) {
          return p.inf === inf ? Object.assign({}, p, clean) : p;
        })});
      })});
    },

    /* ── Preview batches — one per link sent to the client.

       Takes an options object rather than positional arguments: a batch now
       carries the ask it was sent against, who it went to and when it lapses,
       and a fourth positional argument was one too many. */
    addBatch: function (id, opts) {
      var c = get(id); if (!c) return null;
      opts = opts || {};
      var batches = (c.batches || []).slice();
      var n = batches.length + 1;
      batches.push({
        n: n,
        name: opts.name || ('Batch ' + n),
        sentAt: today(),
        /* The ask is copied, not referenced: it is what this batch was sent
           against, and must not move when the campaign's own ask changes. */
        ask: opts.ask ? JSON.parse(JSON.stringify(opts.ask)) : {},
        recipient: opts.recipient || null,
        expiresAt: opts.expiresAt || null,
        requireName: !!opts.requireName,
        picks: (opts.infIds || []).map(function (inf) {
          var pick = {inf: inf, kultRemark: '', clientRemark: ''};
          /* Only write `channels` when we can actually tell what they are.
             campaigns.html creates a batch without loading the influencer
             file, and an empty `channels` map is truthy — migrate() would
             take it as already-migrated and the pick would never get its
             channels at all. Omitting the key leaves migrate() to fill it in
             on a page that does have the profiles. */
          var chans = window.campaignModel.channelsOf(PEOPLE[inf]);
          if (chans.length) {
            pick.channels = {};
            chans.forEach(function (ch) { pick.channels[ch.platform] = 'none'; });
          }
          return pick;
        }),
        paxTargets: {}, notes: ''
      });
      update(id, {batches: batches}, entry('batch',
        'Sent batch ' + n + ' to ' + (opts.recipient ? opts.recipient : 'the client') +
        ' · ' + (opts.infIds || []).length + (((opts.infIds || []).length === 1) ? ' creator' : ' creators'),
        {batch: n}));
      return n;
    },

    /* A pitch: a campaign that exists so a list can be built against it
       before the work is won. isActiveStage keeps it out of the dashboard's
       counts until someone moves it to Sourcing. */
    createLead: function (fields) {
      fields = fields || {};
      var requirement = fields.requirement || {};
      return window.campaignStore.add({
        name: fields.name || 'Untitled lead',
        brand: fields.brand || '', agency: '', description: '',
        pic: fields.pic || 'Digital Team', overseer: '', salesperson: '',
        start: fields.start || null, end: fields.end || null,
        color: 'obsidian', io: '', types: ['Influencers'], stage: 'lead',
        requirement: requirement,
        platforms: Object.keys(requirement),
        pax: window.campaignModel.derivedPax({requirement: requirement}),
        quote: null, cost: null, picPct: 100, overseerPct: null, remarks: '',
        deliverables: {done: 0, total: 0}
      });
    },
    updateBatch: function (id, n, patch) {
      var c = get(id); if (!c) return null;
      return update(id, {batches: (c.batches || []).map(function (b) {
        return b.n === n ? Object.assign({}, b, patch) : b;
      })});
    },

    /* Clear the whole overlay — back to the seeded list. */
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  };
})();
