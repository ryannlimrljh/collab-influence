/* shared/campaign-model.js — the requirement, and the maths over it.

   Pure functions only: no storage, no DOM. campaign-store.js calls migrate()
   on read so the pages never see an un-migrated record, and the share page
   calls the slot and coverage helpers directly.

   `people` is always a map of influencer id -> record from influencers-data.js,
   passed in rather than read off a global so this file stays testable. */
(function () {
  'use strict';

  function channelsOf(rec) {
    return ((rec && rec.platforms) || []).filter(function (p) { return p.handle; });
  }

  /* ── Migration. Old records hold one status per creator and one roster
     entry per creator; both become per channel. Idempotent: a record that
     already has `channels` or channel-level roster entries passes through. */
  function migrate(c, people) {
    people = people || {};
    var out = Object.assign({}, c);
    out.requirement = c.requirement || {};

    /* Without `people` we cannot tell which channels a creator has. Migrating
       anyway would fan every pick's status into an empty `channels` map and
       lose the answer, and empty every roster entry. So pass the record
       through in its stored shape instead: pages that only need a headcount
       (the campaigns list) need not load a 283KB influencer file, and load
       order can never decide whether data survives. */
    if (!Object.keys(people).length) return out;

    out.batches = (c.batches || []).map(function (b) {
      return Object.assign({}, b, {picks: (b.picks || []).map(function (p) {
        if (p.channels) return p;
        var channels = {};
        channelsOf(people[p.inf]).forEach(function (ch) {
          channels[ch.platform] = p.status || 'none';
        });
        var next = Object.assign({}, p, {channels: channels});
        delete next.status;
        return next;
      })});
    });

    /* With `people` present, an id missing from it really is a stale
       reference, and is dropped. */
    out.roster = [];
    (c.roster || []).forEach(function (r) {
      if (r.platform) { out.roster.push(r); return; }
      channelsOf(people[r.inf]).forEach(function (ch) {
        var t = window.tiers.tierOf(ch.followers);
        out.roster.push({
          inf: r.inf, platform: ch.platform, tier: t ? t.key : null,
          source: r.source || 'team', batch: r.batch == null ? null : r.batch,
          /* Pre-dates the availability step, so treat it as settled. */
          state: 'confirmed', substitutedFor: null
        });
      });
    });

    return out;
  }

  /* ── One creator's answer, rolled up from their channels.

     The data is per channel now, but the campaign page still shows one row
     per creator until the slot board lands. Most-positive wins, so a creator
     approved on TikTok and rejected on Instagram reads as approved rather
     than disappearing from the selected count. Migrated records have the same
     value on every channel, so this is lossless for anything that existed
     before the split. */
  var STATUS_ORDER = ['selected', 'kiv', 'rejected', 'unavailable'];
  function pickStatus(p) {
    var ch = (p && p.channels) || {};
    var vals = Object.keys(ch).map(function (k) { return ch[k]; });
    for (var i = 0; i < STATUS_ORDER.length; i++) {
      if (vals.indexOf(STATUS_ORDER[i]) > -1) return STATUS_ORDER[i];
    }
    return 'none';
  }

  /* Requirement -> a flat, ordered list of asks. Object key order is
     insertion order for string keys, which is what we want: the ask reads
     back the way it was entered. */
  function slotsOf(c) {
    var req = (c && c.requirement) || {}, out = [];
    Object.keys(req).forEach(function (platform) {
      Object.keys(req[platform]).forEach(function (tier) {
        var want = Number(req[platform][tier]) || 0;
        if (want > 0) out.push({platform: platform, tier: tier, want: want});
      });
    });
    return out;
  }

  function derivedPax(c) {
    return slotsOf(c).reduce(function (a, s) { return a + s.want; }, 0);
  }

  /* A roster entry occupies its slot while it is approved or confirmed.
     `unavailable` releases it, which is what reopens the slot. */
  function occupies(r) { return r.state === 'approved' || r.state === 'confirmed'; }

  /* platform -> tier -> {want, filled, open, over}. Tiers present on the
     roster but absent from the ask still appear, with want 0, so an
     unasked-for fill is visible rather than silently dropped. */
  function slotStatus(c) {
    var out = {};
    function cell(platform, tier) {
      out[platform] = out[platform] || {};
      out[platform][tier] = out[platform][tier] || {want: 0, filled: 0, open: 0, over: 0};
      return out[platform][tier];
    }
    slotsOf(c).forEach(function (s) { cell(s.platform, s.tier).want = s.want; });
    ((c && c.roster) || []).filter(occupies).forEach(function (r) {
      cell(r.platform, r.tier).filled += 1;
    });
    Object.keys(out).forEach(function (p) {
      Object.keys(out[p]).forEach(function (t) {
        var x = out[p][t];
        x.open = Math.max(0, x.want - x.filled);
        x.over = Math.max(0, x.filled - x.want);
      });
    });
    return out;
  }

  function shortfallOf(c) {
    var st = slotStatus(c);
    return slotsOf(c).map(function (s) {
      return {platform: s.platform, tier: s.tier, want: st[s.platform][s.tier].open};
    }).filter(function (s) { return s.want > 0; });
  }

  /* How well a set of candidates covers an ask, before anything is sent.
     Counts channel accounts, not people: one creator on two platforms
     contributes to both. */
  function coverageOf(requirement, infIds, people) {
    var have = {};
    (infIds || []).forEach(function (id) {
      channelsOf(people[id]).forEach(function (ch) {
        var t = window.tiers.tierOf(ch.followers);
        if (!t) return;
        have[ch.platform] = have[ch.platform] || {};
        have[ch.platform][t.key] = (have[ch.platform][t.key] || 0) + 1;
      });
    });
    return slotsOf({requirement: requirement}).map(function (s) {
      var n = (have[s.platform] && have[s.platform][s.tier]) || 0;
      return {platform: s.platform, tier: s.tier, want: s.want, have: n,
              gap: Math.max(0, s.want - n)};
    });
  }

  window.campaignModel = {
    migrate: migrate, channelsOf: channelsOf,
    pickStatus: pickStatus,
    slotsOf: slotsOf, derivedPax: derivedPax, slotStatus: slotStatus,
    shortfallOf: shortfallOf, coverageOf: coverageOf
  };
})();
