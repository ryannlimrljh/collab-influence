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
    /* Eight planned, one out the door — the same 1/8 the ring showed when
       this was just a pair of numbers. */
    deliverables: [
      {id: 'd-001-1', inf: 'inf-195', platform: 'tiktok', kind: 'video', dueAt: '2026-09-16', link: 'https://www.tiktok.com/@abbysuehaiveey/video/7412', caption: 'Morning routine with Darlie — the 2-minute rule my kids actually follow.', status: 'posted', clientApproval: 'approved', internalNote: 'Went live on time. Pull the 48h numbers Thursday.', clientNote: 'Love this one.'},
      {id: 'd-001-2', inf: 'inf-195', platform: 'instagram', kind: 'reel', dueAt: '2026-09-18', link: 'https://drive.google.com/darlie/abby-reel-v2', caption: 'Same routine, Instagram cut.', status: 'approved', clientApproval: 'approved', internalNote: '', clientNote: 'Approved v2, thanks for trimming the intro.'},
      {id: 'd-001-3', inf: 'inf-111', platform: 'tiktok', kind: 'video', dueAt: '2026-09-17', link: 'https://drive.google.com/darlie/abelizzati-v1', caption: 'Brushing after iftar — a small habit that stuck.', status: 'review', clientApproval: 'changes', internalNote: 'Client wants the product shot earlier.', clientNote: 'Can the tube appear in the first 3 seconds?'},
      {id: 'd-001-4', inf: 'inf-111', platform: 'instagram', kind: 'post', dueAt: '2026-09-20', link: '', caption: '', status: 'drafted', clientApproval: 'pending', internalNote: 'Carousel, 4 frames.', clientNote: ''},
      {id: 'd-001-5', inf: 'inf-209', platform: 'tiktok', kind: 'video', dueAt: '2026-09-19', link: '', caption: 'Gamer dental hygiene — yes it is a thing.', status: 'drafted', clientApproval: 'pending', internalNote: '', clientNote: ''},
      {id: 'd-001-6', inf: 'inf-209', platform: 'instagram', kind: 'story', dueAt: '2026-09-19', link: '', caption: '', status: 'not_started', clientApproval: 'pending', internalNote: 'Same day as the video.', clientNote: ''},
      {id: 'd-001-7', inf: 'inf-338', platform: 'tiktok', kind: 'video', dueAt: '2026-09-24', link: '', caption: '', status: 'not_started', clientApproval: 'pending', internalNote: '', clientNote: ''},
      {id: 'd-001-8', inf: 'inf-338', platform: 'instagram', kind: 'reel', dueAt: '2026-09-26', link: '', caption: '', status: 'not_started', clientApproval: 'pending', internalNote: '', clientNote: ''}
    ],
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
    description: '', pic: 'Ryann Lim', overseer: '', salesperson: '',
    start: '2026-09-01', end: '2026-09-30', color: 'earth',
    io: '', types: ['Influencers'], stage: 'sourcing',
    platforms: [], pax: null, quote: null, cost: null,
    picPct: 100, overseerPct: null, remarks: '',
    createdAt: 1788234000000, updatedAt: 1788234000000,
    deliverables: {done: 0, total: 0}, roster: [], batches: []
  },
  {
    id: 'camp-003', name: '[Testing] Raya 2026 Influencer Push', brand: 'Razer', agency: '',
    description: '', pic: 'Ryann Lim', overseer: '', salesperson: '',
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
  },
  {
    /* A complete record, every field filled, for reading the page against:
       won, ask set, one list answered, a second out, fills confirmed,
       deliverables planned with the first drafts in, the brief attached. */
    id: 'camp-006', name: 'LEGO Play Unstoppable — Year-End Build', brand: 'LEGO', agency: 'Initiative MY',
    description: 'Family build-along content for the year-end range: TikTok build videos, Instagram reels and stories, with a Pavilion KL pop-up tie-in on 14–15 Nov.',
    pic: 'Melissa N.', overseer: 'Pui Yann', salesperson: 'Grace Wong',
    start: '2026-09-22', end: '2026-11-30', color: 'gold',
    io: 'KULT-2026-00042', types: ['Influencers', 'Seeders'], stage: 'drafting',
    requirement: {tiktok: {mid: 2, macro: 1}, instagram: {macro: 2, mid: 1}},
    platforms: ['tiktok', 'instagram'], pax: 6, quote: 78000, cost: 52000,
    picPct: 60, overseerPct: 40, remarks: 'Two creators to attend the Pavilion KL pop-up on 14–15 Nov; LEGO covers travel. No competitor toy brands in the same month.',
    createdAt: 1785900000000, updatedAt: 1788350000000,
    files: [
      {id: 'f-006-1', name: 'LEGO Year-End Build — creator brief v2.pdf', size: 847, type: 'application/pdf', addedAt: '2026-09-03T02:40:00Z', data: 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggMzAyID4+CnN0cmVhbQpCVCAvRjEgMjIgVGYgNjAgNzQwIFRkIChMRUdPIFBsYXkgVW5zdG9wcGFibGUgLSBZZWFyLUVuZCBCdWlsZCkgVGogMCAtMzQgVGQgL0YxIDEyIFRmIChDcmVhdG9yIGJyaWVmLCB2MiAtIEluaXRpYXRpdmUgTVkgZm9yIHRoZSBMRUdPIEdyb3VwKSBUaiAwIC0yNCBUZCAoQnVpbGQtYWxvbmcgY29udGVudCBhY3Jvc3MgVGlrVG9rIGFuZCBJbnN0YWdyYW0sIDIyIFNlcCAtIDMwIE5vdiAyMDI2LikgVGogMCAtMTggVGQgKFBvcC11cCBhdCBQYXZpbGlvbiBLTCBvbiAxNC0xNSBOb3YuIFR3byBjcmVhdG9ycyBhdHRlbmQuKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0MSAwMDAwMCBuIAowMDAwMDAwMzExIDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNjY0CiUlRU9GCg=='},
      {id: 'f-006-2', name: 'LEGO Q4 range deck.pptx', size: 2516582, type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', addedAt: '2026-09-03T02:41:00Z', data: null}
    ],
    deliverables: [
      {id: 'd-006-1', inf: 'inf-116', platform: 'tiktok', kind: 'video', dueAt: '2026-10-12', link: 'https://drive.google.com/lego/ainan-build-v1', caption: 'We built the whole botanical set in one sitting — the kids picked the colours, I did the tricky bits.', status: 'drafted', clientApproval: 'pending', internalNote: 'First draft in. Check the box is in frame for the reveal.', clientNote: ''},
      {id: 'd-006-2', inf: 'inf-116', platform: 'instagram', kind: 'reel', dueAt: '2026-10-16', link: '', caption: '', status: 'not_started', clientApproval: 'pending', internalNote: 'Vertical cut of the TikTok, same day or the day after.', clientNote: ''},
      {id: 'd-006-3', inf: 'inf-117', platform: 'tiktok', kind: 'video', dueAt: '2026-10-14', link: 'https://drive.google.com/lego/aisyah-build-v2', caption: 'Rainy weekend, one castle, zero screen time. Full build with the twins.', status: 'review', clientApproval: 'pending', internalNote: 'v2 fixes the audio. Sent to Initiative 12 Sep.', clientNote: ''},
      {id: 'd-006-4', inf: 'inf-117', platform: 'instagram', kind: 'reel', dueAt: '2026-10-18', link: '', caption: '', status: 'not_started', clientApproval: 'pending', internalNote: '', clientNote: ''},
      {id: 'd-006-5', inf: 'inf-117', platform: 'instagram', kind: 'post', dueAt: '2026-11-14', link: '', caption: 'See you at the LEGO pop-up, Pavilion KL, this weekend.', status: 'not_started', clientApproval: 'pending', internalNote: 'Pop-up day. Carousel from the event.', clientNote: ''},
      {id: 'd-006-6', inf: 'inf-341', platform: 'instagram', kind: 'story', dueAt: '2026-10-20', link: '', caption: '', status: 'not_started', clientApproval: 'pending', internalNote: 'Three frames: unboxing, build, the shelf.', clientNote: ''}
    ],
    roster: [
      {inf: 'inf-116', platform: 'tiktok', tier: 'mid', source: 'client', batch: 1, state: 'confirmed', substitutedFor: null},
      {inf: 'inf-116', platform: 'instagram', tier: 'macro', source: 'client', batch: 1, state: 'confirmed', substitutedFor: null},
      {inf: 'inf-117', platform: 'tiktok', tier: 'macro', source: 'client', batch: 1, state: 'confirmed', substitutedFor: null},
      {inf: 'inf-117', platform: 'instagram', tier: 'macro', source: 'client', batch: 1, state: 'confirmed', substitutedFor: null},
      {inf: 'inf-033', platform: 'tiktok', tier: 'mid', source: 'client', batch: 1, state: 'approved', substitutedFor: null},
      {inf: 'inf-118', platform: 'instagram', tier: 'macro', source: 'client', batch: 1, state: 'unavailable', substitutedFor: null},
      {inf: 'inf-341', platform: 'instagram', tier: 'mid', source: 'team', batch: null, state: 'confirmed', substitutedFor: null}
    ],
    batches: [
      {
        n: 1, name: 'Build crew', sentAt: '2026-08-12', recipient: 'aina.r@initiative.my', expiresAt: '2026-09-30', requireName: true,
        picks: [
          {inf: 'inf-116', channels: {tiktok: 'selected', instagram: 'selected'}, kultRemark: 'Parenting-first, Mid on TikTok and a strong Instagram Macro — one booking covers two slots.', clientRemark: 'Yes to both. Her tone is right for us.'},
          {inf: 'inf-117', channels: {tiktok: 'selected', instagram: 'selected'}, kultRemark: 'Macro on both channels, twins in every video. Our first pick for the castle build.', clientRemark: 'Approved. Please brief her on the pop-up dates.'},
          {inf: 'inf-033', channels: {tiktok: 'selected', instagram: 'rejected'}, kultRemark: 'Steady TikTok Mid, parenting only. Instagram is small.', clientRemark: 'TikTok only, thanks.'},
          {inf: 'inf-118', channels: {tiktok: 'none', instagram: 'selected'}, kultRemark: 'Instagram Macro with a parenting audience. TikTok is a Mid at the low end.', clientRemark: 'Instagram yes.'},
          {inf: 'inf-024', channels: {tiktok: 'rejected', instagram: 'kiv'}, kultRemark: 'Younger parenting audience; Instagram Mid.', clientRemark: 'Keep her in mind for the spring range.'},
          {inf: 'inf-226', channels: {tiktok: 'rejected', instagram: 'rejected'}, kultRemark: 'Mega on both. Included for reach; fee will sit above the band.', clientRemark: 'Out of budget for this one.'}
        ],
        paxTargets: {}, notes: 'Initiative answered in two days. Ainul confirmed then dropped out — travelling in October.'
      },
      {
        n: 2, name: 'Round two — the open Macro', sentAt: '2026-08-24', recipient: 'aina.r@initiative.my', expiresAt: '2026-09-30', requireName: true,
        picks: [
          {inf: 'inf-341', channels: {tiktok: 'none', instagram: 'none'}, kultRemark: 'TikTok Macro, Instagram Mid. Lifestyle and parenting.', clientRemark: ''},
          {inf: 'inf-156', channels: {tiktok: 'none', instagram: 'none'}, kultRemark: 'Instagram Mid, content-creator background — good for the stories.', clientRemark: ''},
          {inf: 'inf-030', channels: {tiktok: 'none', instagram: 'none'}, kultRemark: 'Product-review dad. Micro on TikTok, so a stand-in rather than a band fit.', clientRemark: ''}
        ],
        paxTargets: {}, notes: ''
      }
    ],
    activity: [
      {at: '2026-08-03T01:20:00Z', by: 'Melissa N.', type: 'create', text: 'Created as a lead'},
      {at: '2026-08-04T03:05:00Z', by: 'Melissa N.', type: 'edit', text: 'Set the ask'},
      {at: '2026-08-06T07:30:00Z', by: 'Pui Yann', type: 'note', text: 'Initiative wants parenting creators with kids on camera. No unboxing-only formats — the build has to be the content.'},
      {at: '2026-08-10T02:00:00Z', by: 'Melissa N.', type: 'stage', text: 'Marked as won, moved to Sourcing'},
      {at: '2026-08-12T06:15:00Z', by: 'Melissa N.', type: 'batch', text: 'Sent batch 1 to Initiative MY · 6 creators', ref: {batch: 1}},
      {at: '2026-08-14T08:40:00Z', by: 'Melissa N.', type: 'answer', text: 'Client approved Ainan Tasneem on TikTok and Instagram', ref: {batch: 1, inf: 'inf-116'}},
      {at: '2026-08-14T08:41:00Z', by: 'Melissa N.', type: 'answer', text: 'Client approved Aisyah Habshee on TikTok and Instagram', ref: {batch: 1, inf: 'inf-117'}},
      {at: '2026-08-14T08:42:00Z', by: 'Melissa N.', type: 'answer', text: 'Client approved Amila Baszelan on TikTok', ref: {batch: 1, inf: 'inf-033', platform: 'tiktok'}},
      {at: '2026-08-14T08:43:00Z', by: 'Melissa N.', type: 'answer', text: 'Client approved Ainul Aishah on Instagram', ref: {batch: 1, inf: 'inf-118', platform: 'instagram'}},
      {at: '2026-08-17T02:10:00Z', by: 'Melissa N.', type: 'roster', text: 'Confirmed Ainan Tasneem on TikTok and Instagram', ref: {inf: 'inf-116'}},
      {at: '2026-08-17T02:12:00Z', by: 'Melissa N.', type: 'roster', text: 'Confirmed Aisyah Habshee on TikTok and Instagram', ref: {inf: 'inf-117'}},
      {at: '2026-08-19T09:00:00Z', by: 'Melissa N.', type: 'roster', text: 'Marked Ainul Aishah unavailable on Instagram — the slot is open again', ref: {inf: 'inf-118', platform: 'instagram'}},
      {at: '2026-08-20T03:30:00Z', by: 'Melissa N.', type: 'roster', text: 'Added Aliss Azam on Instagram by hand', ref: {inf: 'inf-341', platform: 'instagram'}},
      {at: '2026-08-24T05:00:00Z', by: 'Melissa N.', type: 'batch', text: 'Sent batch 2 to Initiative MY · 3 creators', ref: {batch: 2}},
      {at: '2026-09-01T02:00:00Z', by: 'Melissa N.', type: 'stage', text: 'Moved to Drafting'},
      {at: '2026-09-02T02:30:00Z', by: 'Melissa N.', type: 'deliverable', text: 'Planned 6 deliverables across 3 creators', ref: {planned: 6}},
      {at: '2026-09-03T02:41:00Z', by: 'Pui Yann', type: 'file', text: 'Attached 2 files: LEGO Year-End Build — creator brief v2.pdf, LEGO Q4 range deck.pptx', ref: {files: ['f-006-1', 'f-006-2']}},
      {at: '2026-09-10T07:20:00Z', by: 'Melissa N.', type: 'deliverable', text: "Marked Ainan Tasneem's TikTok video as drafted", ref: {deliverable: 'd-006-1', inf: 'inf-116'}},
      {at: '2026-09-12T06:45:00Z', by: 'Melissa N.', type: 'deliverable', text: "Marked Aisyah Habshee's TikTok video as in review", ref: {deliverable: 'd-006-3', inf: 'inf-117'}},
      {at: '2026-09-13T01:15:00Z', by: 'Pui Yann', type: 'note', text: 'Pop-up confirmed for 14–15 Nov at Pavilion KL. Aisyah and Ainan to attend; LEGO covers travel.'}
    ]
  }
];
