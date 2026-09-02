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
    return out;
  }
  function get(id) {
    return merged().filter(function (c) { return c.id === id; })[0] || null;
  }
  function update(id, patch) {
    var s = state();
    s.edits[id] = Object.assign({}, s.edits[id] || {}, patch, {updatedAt: Date.now()});
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
        out[p.status || 'none'] += 1;
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

    merged: merged,
    get: get,
    add: function (rec) {
      var s = state();
      rec.id = 'ucamp-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e4).toString(36);
      rec.createdAt = rec.updatedAt = Date.now();
      rec.roster = rec.roster || [];
      rec.batches = rec.batches || [];
      rec.deliverables = rec.deliverables || {done: 0, total: 0};
      s.added.push(rec);
      save(s);
      return rec.id;
    },
    update: update,
    remove: function (id) {
      var s = state();
      if (s.removed.indexOf(id) < 0) s.removed.push(id);
      save(s);
    },

    /* ── Roster — who is on the campaign. `source` is 'team' (added by
       hand) or 'client' (answered Selected on a preview link). */
    addToRoster: function (id, infIds, source, batch) {
      var c = get(id); if (!c) return null;
      var roster = (c.roster || []).slice();
      infIds.forEach(function (inf) {
        if (roster.some(function (r) { return r.inf === inf; })) return;
        roster.push({inf: inf, source: source || 'team', batch: batch || null});
      });
      return update(id, {roster: roster});
    },
    removeFromRoster: function (id, inf) {
      var c = get(id); if (!c) return null;
      return update(id, {roster: (c.roster || []).filter(function (r) { return r.inf !== inf; })});
    },

    /* ── Preview batches — one per link sent to the client. */
    addBatch: function (id, name, infIds) {
      var c = get(id); if (!c) return null;
      var batches = (c.batches || []).slice();
      var n = batches.length + 1;
      batches.push({
        n: n, name: name || ('Batch ' + n), sentAt: today(),
        picks: infIds.map(function (inf) { return {inf: inf, kultRemark: '', status: 'none', clientRemark: ''}; }),
        paxTargets: {}, notes: ''
      });
      update(id, {batches: batches});
      return n;
    },
    /* Patch one pick; a Selected answer also puts the person on the
       roster, and taking it back removes them again if the client's
       answer was the only reason they were there. */
    updatePick: function (id, n, inf, patch) {
      var c = get(id); if (!c) return null;
      var batches = (c.batches || []).map(function (b) {
        if (b.n !== n) return b;
        return Object.assign({}, b, {picks: (b.picks || []).map(function (p) {
          return p.inf === inf ? Object.assign({}, p, patch) : p;
        })});
      });
      var roster = (c.roster || []).slice();
      if (patch.status === 'selected') {
        if (!roster.some(function (r) { return r.inf === inf; })) roster.push({inf: inf, source: 'client', batch: n});
      } else if (patch.status) {
        roster = roster.filter(function (r) { return !(r.inf === inf && r.source === 'client' && r.batch === n); });
      }
      return update(id, {batches: batches, roster: roster});
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
