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

  window.campaignModel = {migrate: migrate, channelsOf: channelsOf};
})();
