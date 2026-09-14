/* Seeded influencer campaigns — a cleaned sample modelled on the live
   Collab:Influence list, kept read-only. The user's own campaigns and
   every edit layer over these through campaign-store.js.

   Roster and pick entries reference ids from influencers-data.js so the
   KOL Selection tab can draw real names, handles and avatars. */
window.CAMPAIGNS = [
  {
    id: 'camp-001', name: '[Testing] Campaign', brand: 'Nestlé MY', agency: 'Wavemaker',
    description: 'Darlie toothpaste seeding and paid posting across TikTok and Instagram.',
    pic: 'Izuan I.', overseer: 'Pui Yann', salesperson: 'Grace Wong',
    start: '2026-09-16', end: '2026-09-29', color: 'obsidian',
    io: 'KULT-2006-3010', types: ['Influencers', 'Seeders'], stage: 'posting',
    requirement: {tiktok: {mid: 2}, instagram: {nano: 1}},
    platforms: ['tiktok', 'instagram'], pax: 30, quote: 13000, cost: 12000,
    picPct: 30, overseerPct: 70, remarks: '',
    createdAt: 1787000000000, updatedAt: 1788206789329,
    deliverables: {done: 1, total: 8},
    roster: [
      {inf: 'inf-195', source: 'team', batch: 1},
      {inf: 'inf-111', source: 'team', batch: null},
      {inf: 'inf-209', source: 'team', batch: null},
      {inf: 'inf-338', source: 'team', batch: null}
    ],
    batches: [
      {
        n: 1, name: 'Angel picks', sentAt: '2026-09-01',
        picks: [
          {inf: 'inf-030', kultRemark: '', status: 'none', clientRemark: ''},
          {inf: 'inf-195', kultRemark: '', status: 'none', clientRemark: ''},
          {inf: 'inf-302', kultRemark: '', status: 'none', clientRemark: ''}
        ],
        paxTargets: {}, notes: ''
      }
    ],
    /* Newest last; the page renders newest first. */
    activity: [
      {at: '2026-08-20T03:12:00Z', by: 'Izuan I.', type: 'create', text: 'Created'},
      {at: '2026-08-22T08:40:00Z', by: 'Izuan I.', type: 'edit', text: 'Set the ask'},
      {at: '2026-09-01T02:05:00Z', by: 'Izuan I.', type: 'batch', text: 'Sent batch 1 to Wavemaker · 3 creators', ref: {batch: 1}},
      {at: '2026-09-03T06:20:00Z', by: 'Izuan I.', type: 'answer', text: 'Client approved Abby Suehaiveey Abir on TikTok', ref: {batch: 1, inf: 'inf-195', platform: 'tiktok'}},
      {at: '2026-09-03T09:48:00Z', by: 'Izuan I.', type: 'roster', text: 'Confirmed Abby Suehaiveey Abir on TikTok', ref: {inf: 'inf-195', platform: 'tiktok'}},
      {at: '2026-09-05T01:30:00Z', by: 'Pui Yann', type: 'note', text: 'Wavemaker wants every first draft by 12 Sep. The IG story goes out the same day as the reel, not after.'},
      {at: '2026-09-06T02:00:00Z', by: 'Izuan I.', type: 'stage', text: 'Moved to Drafting'},
      {at: '2026-09-13T01:10:00Z', by: 'Izuan I.', type: 'stage', text: 'Moved to Posting'}
    ]
  },
  {
    id: 'camp-002', name: '[Testing] Merdeka holiday fiesta', brand: 'Shopee', agency: '',
    description: '', pic: 'Digital Team', overseer: '', salesperson: '',
    start: '2026-09-01', end: '2026-09-30', color: 'earth',
    io: '', types: ['Influencers'], stage: 'sourcing',
    platforms: [], pax: null, quote: null, cost: null,
    picPct: 100, overseerPct: null, remarks: '',
    createdAt: 1788234000000, updatedAt: 1788234000000,
    deliverables: {done: 0, total: 0}, roster: [], batches: []
  },
  {
    id: 'camp-003', name: '[Testing] Raya 2026 Influencer Push', brand: 'Razer', agency: '',
    description: '', pic: 'Digital Team', overseer: '', salesperson: '',
    start: '2026-09-01', end: '2026-09-30', color: 'water',
    io: '', types: ['Influencers'], stage: 'sourcing',
    platforms: [], pax: null, quote: 10000, cost: 5000,
    picPct: 100, overseerPct: null, remarks: '',
    createdAt: 1788230000000, updatedAt: 1788230000000,
    deliverables: {done: 0, total: 0}, roster: [], batches: []
  },
  {
    id: 'camp-004', name: 'Enfagrow A+ MindPro Routine Phase 5', brand: 'Enfagrow', agency: '',
    description: 'Phase 5 of the MindPro routine series with parenting creators.',
    pic: 'Neeza', overseer: '', salesperson: '',
    start: '2026-08-01', end: '2026-10-01', color: 'purple',
    io: '', types: ['Influencers'], stage: 'sourcing',
    requirement: {tiktok: {mid: 2, macro: 1}, instagram: {mid: 1, macro: 1}},
    platforms: ['tiktok', 'instagram'], pax: 13, quote: 31423, cost: 20700,
    picPct: 100, overseerPct: null, remarks: '',
    createdAt: 1788100000000, updatedAt: 1788234402696,
    deliverables: {done: 0, total: 0}, roster: [],
    /* Eight candidates against five slots, so every band has headroom and the
       client has a real choice to make. Abby is the case the old model could
       not express: she is a TikTok Macro and an Instagram Mid at the same
       time, and the client can take one without the other. */
    batches: [
      {
        n: 1, name: 'Batch 1 · parenting shortlist', sentAt: '2026-09-10',
        picks: [
          {inf: 'inf-195', kultRemark: 'Highest TikTok reach on the list, and her Instagram lands squarely in the Mid band — one booking can cover two of the slots.', status: 'none', clientRemark: ''},
          {inf: 'inf-116', kultRemark: 'Parenting-first audience and the strongest Instagram Macro figure here. Closest fit to the MindPro brief.', status: 'none', clientRemark: ''},
          {inf: 'inf-118', kultRemark: 'Parenting and lifestyle, with a large Instagram following and a steady TikTok Mid.', status: 'none', clientRemark: ''},
          {inf: 'inf-323', kultRemark: 'Macro on both channels. Food-led rather than parenting, so worth a look only if you want the wider reach.', status: 'none', clientRemark: ''},
          {inf: 'inf-234', kultRemark: 'Consistent lifestyle poster, Macro on TikTok and Mid on Instagram.', status: 'none', clientRemark: ''},
          {inf: 'inf-209', kultRemark: 'Reliable TikTok Mid. Esports-leaning, included to give the Mid band a second option.', status: 'none', clientRemark: ''},
          {inf: 'inf-107', kultRemark: 'Product-review background, which suits a routine-led format.', status: 'none', clientRemark: ''},
          {inf: 'inf-302', kultRemark: 'Instagram Mid only — his TikTok is a Seeder account, so treat him as an Instagram booking.', status: 'none', clientRemark: ''}
        ],
        paxTargets: {}, notes: ''
      }
    ],
    activity: [
      {at: '2026-09-04T02:10:00Z', by: 'Neeza', type: 'create', text: 'Created as a lead'},
      {at: '2026-09-05T06:40:00Z', by: 'Neeza', type: 'edit', text: 'Set the ask'},
      {at: '2026-09-08T09:15:00Z', by: 'Neeza', type: 'note', text: 'Enfagrow wants parenting-led profiles first. Food-led creators only if the reach clearly justifies it — flag them as such in the KULT remarks.'},
      {at: '2026-09-09T03:00:00Z', by: 'Neeza', type: 'stage', text: 'Marked as won, moved to Sourcing'},
      {at: '2026-09-10T07:30:00Z', by: 'Neeza', type: 'batch', text: 'Sent batch 1 to the client · 8 creators', ref: {batch: 1}}
    ]
  },
  {
    id: 'camp-005', name: 'Enfagrow Ambassador (Adira)', brand: 'Enfagrow', agency: '',
    description: 'Year-long ambassador engagement.',
    pic: 'Melissa N.', overseer: '', salesperson: '',
    start: '2026-06-01', end: '2027-06-01', color: 'gold',
    io: '', types: ['Influencers'], stage: 'sourcing',
    platforms: ['tiktok', 'instagram'], pax: 1, quote: 450000, cost: 330000,
    picPct: 100, overseerPct: null, remarks: '',
    createdAt: 1785000000000, updatedAt: 1786000000000,
    deliverables: {done: 0, total: 0}, roster: [], batches: []
  }
];
