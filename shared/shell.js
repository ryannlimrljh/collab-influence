/* Collab:Media planner — shell behaviour.

   Ported from the mothership's feedback-v1/landing-v3 shell: collapse
   toggle, account menu, department switcher, collapsed hover labels,
   and the landing's auto-minimise — the rail folds itself shortly
   after load to hand the canvas the width, driven through the same
   setter a manual click uses. A manual toggle before the timer fires
   cancels it, so the auto-collapse never fights the user. */

(function () {
  'use strict';

  /* ── Brand logo lookup ──
     Maximising hit rate: every brand gets an ordered CHAIN of candidate
     URLs — the curated map's real domain first (Clearbit for quality,
     Google's favicon endpoint as a guaranteed backstop), then guesses
     built from the brand's tokens across .com / .com.my / .my, served
     by sources whose real 404s let the chain advance. The first URL
     that loads is cached in localStorage; a fully exhausted chain hides
     the mark. Wire an <img> with collabBrand.attach(img, brand). */
  var BRAND_DOMAINS = {
    astro: 'astro.com.my', maybank: 'maybank.com', proton: 'proton.com.my',
    nestle: 'nestle.com.my', milo: 'milo.com.my', petronas: 'petronas.com',
    touchngo: 'touchngo.com.my', tng: 'touchngo.com.my', sooka: 'sooka.my',
    grab: 'grab.com', celcom: 'celcomdigi.com', digi: 'celcomdigi.com',
    bmw: 'bmw.com.my', mazda: 'mazda.com.my', toyota: 'toyota.com.my',
    honda: 'honda.com.my', perodua: 'perodua.com.my', vios: 'toyota.com.my',
    samsung: 'samsung.com', apple: 'apple.com', xiaomi: 'mi.com',
    airasia: 'airasia.com', malaysiaairlines: 'malaysiaairlines.com',
    loreal: 'loreal.com', lancome: 'lancome.com', shopee: 'shopee.com.my',
    lazada: 'lazada.com.my', kfc: 'kfc.com.my', mcdonalds: 'mcdonalds.com.my',
    coway: 'coway.com.my', cuckoo: 'cuckoo.com.my', tesco: 'lotuss.com.my',
    aeon: 'aeonretail.com.my', maxis: 'maxis.com.my', unifi: 'unifi.com.my',
    cimb: 'cimb.com.my', publicbank: 'pbebank.com', hsbc: 'hsbc.com.my',
    guinness: 'guinness.com', heineken: 'heinekenmalaysia.com',
    fandf: 'fnnfoods.com', dutchlady: 'dutchlady.com.my', yeos: 'yeos.com.my'
  };
  var LOGO_CACHE_KEY = 'collab-logo-cache';
  function logoCache() {
    try { return JSON.parse(localStorage.getItem(LOGO_CACHE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function logoCacheSet(slug, url) {
    try {
      var c = logoCache();
      c[slug] = url;
      localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(c));
    } catch (e) {}
  }
  function fold(brand) {
    /* Accent folding so Nestlé → nestle, L'Oréal → l'oreal. */
    var t = (brand || '').toLowerCase();
    try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return t;
  }
  function slugOf(brand) {
    return fold(brand).replace(/[^a-z0-9]/g, '');
  }
  function knownDomain(brand) {
    var slug = slugOf(brand);
    if (!slug) return null;
    if (BRAND_DOMAINS[slug]) return BRAND_DOMAINS[slug];
    for (var key in BRAND_DOMAINS) {
      if (slug.indexOf(key) > -1) return BRAND_DOMAINS[key];
    }
    /* word-level: "Mazda 6" → mazda; "Apple products" → apple */
    var words = fold(brand).split(/[^a-z0-9]+/).filter(Boolean);
    for (var i = 0; i < words.length; i++) {
      if (BRAND_DOMAINS[words[i]]) return BRAND_DOMAINS[words[i]];
    }
    return null;
  }
  window.collabBrand = {
    domain: knownDomain,
    known: function (brand) { return !!knownDomain(brand); },
    /* Best text to resolve from: the brand when it maps (or when there
       is nothing better), otherwise a plan name that hits the curated
       map ("Coway water filter launch" with a blank brand field). */
    pick: function (brand, name) {
      if (brand && knownDomain(brand)) return brand;
      if (name && knownDomain(name)) return name;
      return brand || '';
    },
    /* Ordered candidates, best quality and confidence first. */
    candidates: function (brand) {
      var out = [];
      var d = knownDomain(brand);
      if (d) {
        out.push('https://logo.clearbit.com/' + d);
        out.push('https://www.google.com/s2/favicons?domain=' + d + '&sz=64');
        return out;
      }
      var slug = slugOf(brand);
      if (!slug) return out;
      var words = fold(brand).split(/[^a-z0-9]+/)
        .filter(function (w) { return w.length > 2 && !/^\d+$/.test(w); });
      var bases = [];
      if (words[0] && words[0] !== slug) bases.push(words[0]);
      bases.push(slug);
      bases.forEach(function (b2) {
        out.push('https://logo.clearbit.com/' + b2 + '.com');
        out.push('https://icons.duckduckgo.com/ip3/' + b2 + '.com.my.ico');
        out.push('https://icons.duckduckgo.com/ip3/' + b2 + '.com.ico');
      });
      return out.slice(0, 6);
    },
    /* legacy single-url helper: best first candidate */
    url: function (brand) {
      var cached = logoCache()[slugOf(brand)];
      if (cached === 'none') return null;
      if (cached) return cached;
      return window.collabBrand.candidates(brand)[0] || null;
    },
    /* Attach the chain to an <img>: steps to the next candidate on
       error, caches the winner on load. onDone(ok) is optional; the
       default hides the img's parent when every candidate fails. */
    attach: function (img, brand, onDone) {
      var fin = onDone || function (ok) {
        if (!ok && img.parentNode) img.parentNode.style.visibility = 'hidden';
      };
      var slug = slugOf(brand);
      var cached = logoCache()[slug];
      if (cached === 'none') { fin(false); return; }
      var list = cached ? [cached] : window.collabBrand.candidates(brand);
      if (!list.length) { fin(false); return; }
      var i = 0;
      img.onerror = function () {
        i += 1;
        if (i < list.length) { img.src = list[i]; return; }
        if (!cached) logoCacheSet(slug, 'none');
        fin(false);
      };
      img.onload = function () {
        if (!cached) logoCacheSet(slug, list[i]);
        fin(true);
      };
      img.src = list[0];
    }
  };

  var NARROW = window.matchMedia('(max-width:640px)');
  var NAV_KEY = 'collab-nav-collapsed';

  function setCollapsed(on) {
    document.getElementById('shellSidebarNav').classList.toggle('is-collapsed', on);
    var t = document.getElementById('sidebarToggle');
    t.setAttribute('aria-label', on ? 'Expand sidebar' : 'Collapse sidebar');
    document.getElementById('sidebarArrow').setAttribute('d',
      on ? 'M11.5 7 14 10l-2.5 3' : 'M13.5 7 11 10l2.5 3');
    try { sessionStorage.setItem(NAV_KEY, on ? '1' : '0'); } catch (e) {}
  }

  /* The nav follows the previous screen's condition: whatever state the
     user left it in carries across pages in this tab. Only a first-ever
     view gets the landing's auto-minimise timing. */
  var storedNav = null;
  try { storedNav = sessionStorage.getItem(NAV_KEY); } catch (e) {}
  if (NARROW.matches) setCollapsed(true);
  else if (storedNav !== null) setCollapsed(storedNav === '1');

  var AUTO_COLLAPSE_DELAY_MS = 1400;
  var autoCollapseTimer = (storedNav === null && !NARROW.matches)
    ? setTimeout(function () { if (!NARROW.matches) setCollapsed(true); }, AUTO_COLLAPSE_DELAY_MS)
    : null;

  document.getElementById('sidebarToggle').addEventListener('click', function () {
    if (autoCollapseTimer) clearTimeout(autoCollapseTimer);
    setCollapsed(!document.getElementById('shellSidebarNav').classList.contains('is-collapsed'));
  });

  /* Expanded on a phone, the box overlays the content, so it needs a way
     out that is not one small button. */
  document.addEventListener('click', function (e) {
    if (!NARROW.matches || e.target.closest('#shellSidebarShell') ||
        e.target.closest('#accountMenu') || e.target.closest('#deptDropdown')) return;
    setCollapsed(true);
  });

  /* ── Account menu — opens above the pinned row. */
  (function () {
    var trigger = document.getElementById('accountMenuTrigger');
    var menu = document.getElementById('accountMenu');
    if (!trigger || !menu) return;

    function place() {
      var r = trigger.getBoundingClientRect();
      var w = menu.offsetWidth || 200;
      menu.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2,
                                             window.innerWidth - w - 8)) + 'px';
      menu.style.bottom = (window.innerHeight - r.top + 8) + 'px';
    }
    function close() {
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
    }
    function open() {
      place();
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
    }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.classList.contains('is-open')) close(); else open();
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('.c-account-menu-item')) close();
    });
    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('is-open')) return;
      if (e.target.closest('#accountMenu') || e.target.closest('#accountMenuTrigger')) return;
      close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', function () {
      if (menu.classList.contains('is-open')) place();
    });
  })();

  /* ── Department switcher. The system supplies the markup contract
     (data-dept / data-logo / data-element-icon per option); this wires it
     and positions a fixed panel next to a trigger inside a clipping rail.
     The choice lives in memory, same limit as the dashboard. */
  (function () {
    var trigger = document.querySelector('.js-dept-trigger');
    var panel = document.getElementById('deptDropdown');
    if (!trigger || !panel) return;

    var liveMark = trigger.querySelector('.js-dept-logo-live');
    var staticMark = trigger.querySelector('.js-dept-logo-static');
    var collapsedMark = document.querySelector('.js-dept-logo-collapsed');
    var chevron = trigger.querySelector('.js-dept-chevron');

    function place() {
      var r = trigger.getBoundingClientRect();
      var w = panel.offsetWidth || 240;
      panel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
      panel.style.top = (r.bottom + 8) + 'px';
    }
    function close() {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (chevron) chevron.classList.replace('ph-caret-up', 'ph-caret-down');
    }
    function open() {
      panel.hidden = false;          /* unhidden BEFORE measuring */
      place();
      trigger.setAttribute('aria-expanded', 'true');
      if (chevron) chevron.classList.replace('ph-caret-down', 'ph-caret-up');
    }

    function apply(opt) {
      var all = panel.querySelectorAll('.c-dept-option');
      for (var i = 0; i < all.length; i++) {
        var on = all[i] === opt;
        all[i].classList.toggle('is-active', on);
        all[i].setAttribute('aria-selected', String(on));
      }
      /* No data-logo means the default department, which shows the
         animated mark. Absence is the signal. */
      var logo = opt.dataset.logo;
      if (logo) {
        staticMark.src = logo;
        staticMark.alt = opt.dataset.name || '';
        staticMark.style.display = '';
        liveMark.style.display = 'none';
      } else {
        staticMark.style.display = 'none';
        staticMark.removeAttribute('src');
        liveMark.style.display = '';
      }
      if (collapsedMark && opt.dataset.elementIcon) collapsedMark.src = opt.dataset.elementIcon;
      trigger.setAttribute('aria-label', 'Switch department, ' + (opt.dataset.name || ''));
    }

    /* This is Collab:Sales' own surface — arrive with Sales picked. */
    var initial = panel.querySelector('.c-dept-option.is-active');
    if (initial) apply(initial);

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.hidden) open(); else close();
    });
    panel.addEventListener('click', function (e) {
      var opt = e.target.closest('.c-dept-option');
      if (!opt) return;
      apply(opt);
      close();
    });
    document.addEventListener('click', function (e) {
      if (panel.hidden) return;
      if (e.target.closest('#deptDropdown') || e.target.closest('.js-dept-trigger')) return;
      close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', function () { if (!panel.hidden) place(); });
  })();

  /* ── Collapsed rail's hover label — delegated, keyboard included. */
  (function () {
    var label = document.getElementById('shellSidebarHoverLabel');
    if (!label) return;

    function show(item) {
      var nav = item.closest('.c-sidebar');
      var source = item.querySelector('.c-sidebar-hover-text');
      if (!nav || !nav.classList.contains('is-collapsed') || !source) return;
      var icon = item.querySelector('i');
      if (!icon) return;
      var ir = icon.getBoundingClientRect();
      label.textContent = source.textContent;
      label.style.left = (nav.getBoundingClientRect().right + 8) + 'px';
      label.style.top = (ir.top + ir.height / 2) + 'px';
      label.style.transform = 'translateY(-50%)';
      label.classList.add('is-visible');
    }
    function hide() { label.classList.remove('is-visible'); }

    document.addEventListener('mouseover', function (e) {
      var item = e.target.closest('.c-sidebar-item');
      if (item && !item.contains(e.relatedTarget)) show(item);
    });
    document.addEventListener('mouseout', function (e) {
      var item = e.target.closest('.c-sidebar-item');
      if (item && !item.contains(e.relatedTarget)) hide();
    });
    document.addEventListener('focusin', function (e) {
      var item = e.target.closest('.c-sidebar-item');
      if (item) show(item);
    });
    document.addEventListener('focusout', function (e) {
      var item = e.target.closest('.c-sidebar-item');
      if (item) hide();
    });
  })();
})();
