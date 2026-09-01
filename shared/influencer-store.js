/* Roster store — the same localStorage overlay model as the planner's
   plan-store: the generated dataset stays read-only on disk, and this
   layers the user's additions, edits, and removals on top of it.

   Record shape matches influencers-data.js. Added profiles get ids in
   their own 'usr-' range so a regenerated dataset never collides. */
(function () {
  'use strict';

  /* A page can claim its own overlay by setting this global BEFORE the
     script loads (influencers-v2.html does) — otherwise every page
     shares the original store. */
  var KEY = window.INFLUENCER_STORE_KEY || 'collab-influencers';

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
    s.pins = s.pins || [];
    return s;
  }

  window.influencerStore = {
    /* Dataset + overlay, removals filtered, edits applied, additions in. */
    merged: function (base) {
      var s = state();
      var out = base
        .filter(function (r) { return s.removed.indexOf(r.id) < 0; })
        .map(function (r) {
          return s.edits[r.id]
            ? Object.assign({}, r, s.edits[r.id], {id: r.id})
            : r;
        });
      return out.concat(s.added.filter(function (r) {
        return s.removed.indexOf(r.id) < 0;
      }).map(function (r) {
        return s.edits[r.id]
          ? Object.assign({}, r, s.edits[r.id], {id: r.id})
          : r;
      }));
    },
    add: function (rec) {
      var s = state();
      rec.id = 'usr-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e4).toString(36);
      s.added.push(rec);
      save(s);
      return rec.id;
    },
    update: function (id, patch) {
      var s = state();
      s.edits[id] = patch;
      save(s);
    },
    remove: function (id) {
      var s = state();
      if (s.removed.indexOf(id) < 0) s.removed.push(id);
      s.pins = s.pins.filter(function (p) { return p !== id; });
      save(s);
    },
    isPinned: function (id) {
      return state().pins.indexOf(id) > -1;
    },
    /* Toggle; returns true when the card is now pinned. */
    togglePin: function (id) {
      var s = state();
      var i = s.pins.indexOf(id);
      if (i > -1) s.pins.splice(i, 1); else s.pins.push(id);
      save(s);
      return i < 0;
    },
    /* Clear the whole overlay — back to the generated dataset. */
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  };
})();
