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

  /* The band a fill counts against: its own tier, unless it was taken as a
     stand-in for another — a Micro counted toward the Mid ask. */
  function groupTier(r) { return r.substitutedFor || r.tier; }

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
      cell(r.platform, groupTier(r)).filled += 1;
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

  /* What a new batch should ask for: whatever the campaign still owes.
     shortfallOf gives a flat list; the sheet wants it in requirement shape
     so it can seed the steppers directly. */
  function askFor(c) {
    var out = {};
    shortfallOf(c).forEach(function (s) {
      out[s.platform] = out[s.platform] || {};
      out[s.platform][s.tier] = s.want;
    });
    return out;
  }


  /* The batch's ask is what is still outstanding, so the campaign's ask is
     that plus whatever is already filled. Bands already met keep their
     figure rather than disappearing. */
  function mergeAsk(c, ask) {
    var filled = slotStatus(c), out = {};
    Object.keys(ask || {}).forEach(function (p) {
      Object.keys(ask[p]).forEach(function (t) {
        out[p] = out[p] || {};
        out[p][t] = (Number(ask[p][t]) || 0) + (((filled[p] || {})[t] || {}).filled || 0);
      });
    });
    Object.keys(filled).forEach(function (p) {
      Object.keys(filled[p]).forEach(function (t) {
        if (out[p] && out[p][t] != null) return;
        if (!filled[p][t].want) return;
        out[p] = out[p] || {};
        out[p][t] = filled[p][t].want;
      });
    });
    return out;
  }

  /* Two asks are the same when they hold the same slots, whatever order
     the keys came in — a rebuilt map must not read as an edit. */
  function sameAsk(a, b) {
    var key = function (req) {
      return slotsOf({requirement: req || {}}).map(function (x) { return x.platform + '/' + x.tier + '=' + x.want; }).sort().join(',');
    };
    return key(a) === key(b);
  }

  /* ── The board. One group per asked band, in ask order, then any band the
     roster occupies that nobody asked for (want 0), so an unasked-for fill
     is visible rather than lost. Fills sort confirmed, approved, then
     unavailable. `awaiting` counts creators on a sent batch who sit in this
     band and have no answer yet; it needs `people` to know their tier. */
  var STATE_ORDER = {confirmed: 0, approved: 1, unavailable: 2};
  function groupsOf(c, people) {
    people = people || {};
    var st = slotStatus(c), roster = (c && c.roster) || [], out = [], seen = {};
    function push(platform, tier, want) {
      var key = platform + '/' + tier;
      if (seen[key]) return; seen[key] = true;
      var x = (st[platform] && st[platform][tier]) || {want: want, filled: 0, open: want, over: 0};
      var fills = roster.filter(function (r) { return r.platform === platform && groupTier(r) === tier; })
        .sort(function (a, b) { return (STATE_ORDER[a.state] || 0) - (STATE_ORDER[b.state] || 0); });
      var awaiting = 0;
      if (Object.keys(people).length) {
        ((c && c.batches) || []).forEach(function (b) {
          (b.picks || []).forEach(function (p) {
            if (!p.channels || p.channels[platform] !== 'none') return;
            var ch = channelsOf(people[p.inf]).filter(function (y) { return y.platform === platform; })[0];
            var t = ch ? window.tiers.tierOf(ch.followers) : null;
            if (t && t.key === tier) awaiting += 1;
          });
        });
      }
      out.push({platform: platform, tier: tier, want: x.want, filled: x.filled, open: x.open, over: x.over,
                fills: fills, awaiting: awaiting});
    }
    slotsOf(c).forEach(function (s) { push(s.platform, s.tier, s.want); });
    roster.forEach(function (r) { if (r.platform && groupTier(r)) push(r.platform, groupTier(r), 0); });
    return out;
  }

  /* ── Deliverables. A record that still holds {done, total} keeps reading
     from those two numbers until someone adds a deliverable; once it is a
     list, the list is the truth and `posted` is what counts as done. */
  function deliverableCounts(c) {
    var d = (c && c.deliverables) || null;
    if (Array.isArray(d)) {
      return {done: d.filter(function (x) { return x.status === 'posted'; }).length, total: d.length, list: true};
    }
    return {done: (d && Number(d.done)) || 0, total: (d && Number(d.total)) || 0, list: false};
  }

  /* Distinct creators holding at least one confirmed channel fill. */
  function confirmedCreators(c) {
    var seen = {};
    ((c && c.roster) || []).forEach(function (r) { if (r.state === 'confirmed') seen[r.inf] = true; });
    return Object.keys(seen);
  }

  /* ── What to do next: one sentence of state, one primary action, at most
     one secondary, computed from where the campaign is. Actions are plain
     keys the page maps to handlers:
       send · won · client · confirm · ask · tab:<key> · stage:<key>
     A sentence may carry `{date}`; the page formats `date` into it. */
  var ORDER = ['lead', 'sourcing', 'drafting', 'posting', 'reporting', 'payment', 'completed'];
  function nextStage(stage) {
    var i = ORDER.indexOf(stage);
    return i > -1 && i < ORDER.length - 1 ? ORDER[i + 1] : null;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function nextUp(c) {
    var stage = (c && c.stage) || 'lead';
    var batches = (c && c.batches) || [];
    var last = batches.length ? batches[batches.length - 1] : null;
    var k = batches.length + 1;
    var hasAsk = slotsOf(c).length > 0;
    var open = shortfallOf(c).reduce(function (a, s) { return a + s.want; }, 0);
    var pending = ((c && c.roster) || []).filter(function (r) { return r.state === 'approved'; }).length;
    var out = {stage: stage, sentence: '', primary: null, secondary: null};
    function act(label, action) { return {label: label, action: action}; }

    if (stage === 'lead') {
      if (!hasAsk && !last) {
        out.sentence = 'No ask yet. Set what you need before anything goes to the client.';
        out.primary = act('Set the ask', 'ask'); out.secondary = act('Mark as won', 'won');
      } else if (!last) {
        out.sentence = 'Nothing sent to the client yet.';
        out.primary = act('Send selection list', 'send'); out.secondary = act('Mark as won', 'won');
      } else {
        out.sentence = 'Waiting on the client · sent {date}.'; out.date = last.sentAt || null;
        out.primary = act('Open client view', 'client'); out.secondary = act('Mark as won', 'won');
      }
      return out;
    }
    if (stage === 'sourcing') {
      if (!hasAsk) {
        out.sentence = 'No ask yet. Set what you need before sending a batch.';
        out.primary = act('Set the ask', 'ask'); out.secondary = act('Send batch ' + k, 'send');
      } else if (pending) {
        out.sentence = plural(pending, 'approval', 'approvals') + ' to confirm' + (open ? ' and ' + plural(open, 'open slot', 'open slots') : '') + '.';
        out.primary = act('Confirm availability (' + pending + ')', 'confirm'); out.secondary = act('Send batch ' + k, 'send');
      } else if (open) {
        out.sentence = plural(open, 'open slot', 'open slots') + '.';
        out.primary = act('Send batch ' + k, 'send');
      } else {
        out.sentence = 'Line-up complete.';
        out.primary = act('Move to Drafting', 'stage:drafting');
      }
      return out;
    }
    var d = deliverableCounts(c);
    var creators = confirmedCreators(c);
    if (stage === 'drafting') {
      var without;
      if (d.list) {
        var has = {};
        c.deliverables.forEach(function (x) { has[x.inf] = true; });
        without = creators.filter(function (inf) { return !has[inf]; }).length;
      } else {
        without = d.total ? 0 : creators.length;
      }
      if (!creators.length) {
        out.sentence = 'Nobody confirmed yet.';
        out.primary = act('Open selection', 'tab:selection');
      } else if (without) {
        out.sentence = plural(without, 'creator has', 'creators have') + ' no deliverables yet.';
        out.primary = act('Add deliverables', 'tab:deliverables'); out.secondary = act('Move to Posting', 'stage:posting');
      } else {
        out.sentence = plural(d.total, 'deliverable', 'deliverables') + ' planned.';
        out.primary = act('Move to Posting', 'stage:posting');
      }
      return out;
    }
    if (stage === 'posting') {
      if (!d.total) {
        out.sentence = 'No deliverables planned.';
        out.primary = act('Add deliverables', 'tab:deliverables'); out.secondary = act('Move to Reporting', 'stage:reporting');
      } else if (d.done < d.total) {
        out.sentence = d.done + ' of ' + d.total + ' posted.';
        out.primary = act('Track deliverables', 'tab:deliverables'); out.secondary = act('Move to Reporting', 'stage:reporting');
      } else {
        out.sentence = 'All ' + d.total + ' posted.';
        out.primary = act('Move to Reporting', 'stage:reporting');
      }
      return out;
    }
    if (stage === 'completed') {
      out.sentence = c && c.end ? 'Wrapped {date}.' : 'Wrapped.'; out.date = (c && c.end) || null;
      return out;
    }
    var nx = nextStage(stage);
    out.sentence = 'In ' + stage.charAt(0).toUpperCase() + stage.slice(1) + '.';
    if (nx) out.primary = act('Move to ' + nx.charAt(0).toUpperCase() + nx.slice(1), 'stage:' + nx);
    return out;
  }

  window.campaignModel = {
    migrate: migrate, channelsOf: channelsOf,
    pickStatus: pickStatus,
    slotsOf: slotsOf, askFor: askFor, derivedPax: derivedPax, slotStatus: slotStatus,
    shortfallOf: shortfallOf, coverageOf: coverageOf,
    deliverableCounts: deliverableCounts, confirmedCreators: confirmedCreators, nextUp: nextUp,
    groupTier: groupTier, mergeAsk: mergeAsk, sameAsk: sameAsk, groupsOf: groupsOf
  };
})();
