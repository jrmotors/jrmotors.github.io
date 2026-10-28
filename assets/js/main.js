/*!
 * JR Motors — site behaviour
 * ---------------------------------------------------------------
 * Plain ES5-compatible script (no modules, no fetch) so the page also
 * works when opened straight from disk (file://).
 *
 * Depends on (loaded before, with defer):
 *   window.JR_CONFIG — assets/js/config.js
 *   window.JR_I18N   — assets/js/i18n.js
 *
 * Features: contacts from config, RU/KZ switch, tabs (APG pattern),
 * mobile menu with focus trap, smooth anchors, header state, hero
 * parallax, scroll-spy, reveal-on-scroll, counter, price rendering,
 * floating WhatsApp button. Everything respects prefers-reduced-motion.
 */
(function () {
  'use strict';

  var CFG = window.JR_CONFIG || {};
  var DICT = window.JR_I18N || { ru: {}, kz: {} };
  var doc = document;
  var root = doc.documentElement;
  var STORAGE_KEY = 'jr-motors-lang';
  var NBSP = '\u00A0'; // no-break space: thousands separator and "от 5 000 ₸" glue

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var hasIO = 'IntersectionObserver' in window;

  var state = {
    lang: 'ru',
    menuOpen: false
  };

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  function $(sel, ctx) {
    return (ctx || doc).querySelector(sel);
  }

  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
  }

  function has(obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  /** Translation lookup: current language → RU fallback → null. */
  function t(key) {
    if (has(DICT[state.lang], key)) return DICT[state.lang][key];
    if (has(DICT.ru, key)) return DICT.ru[key];
    return null;
  }

  /** Pick a localized value from a {ru, kz} object (or return a plain string). */
  function pick(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value[state.lang] || value.ru || '';
  }

  function onMediaChange(mql, fn) {
    if (!mql) return;
    if (mql.addEventListener) mql.addEventListener('change', fn);
    else if (mql.addListener) mql.addListener(fn);
  }

  function rafThrottle(fn) {
    var queued = false;
    return function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        fn();
      });
    };
  }

  /* ------------------------------------------------------------------
     Contacts — every phone/WhatsApp/Instagram/map link comes from config
     ------------------------------------------------------------------ */
  function waUrl(message) {
    return 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(message || '');
  }

  function waMessageFor(el) {
    var serviceKey = el.getAttribute('data-wa-service');
    if (serviceKey) {
      return (t('wa.service') || '').replace('{service}', t(serviceKey) || '');
    }
    return t(el.getAttribute('data-wa-msg') || 'wa.default') || '';
  }

  function mapSrc() {
    return 'https://maps.google.com/maps?q=' + encodeURIComponent(CFG.mapQuery || '') + '&z=16&output=embed';
  }

  function twoGisUrl() {
    return 'https://2gis.kz/' + (CFG.twoGisCity || 'turkestan') + '/search/' + encodeURIComponent(CFG.twoGisQuery || '');
  }

  function openInNewTab(el) {
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener');
  }

  function fillContacts() {
    $$('[data-contact]').forEach(function (el) {
      switch (el.getAttribute('data-contact')) {
        case 'phone':
          if (CFG.phone) el.setAttribute('href', 'tel:' + CFG.phone);
          break;
        case 'whatsapp':
          if (CFG.whatsapp) {
            el.setAttribute('href', waUrl(waMessageFor(el)));
            openInNewTab(el);
          }
          break;
        case 'instagram':
          if (CFG.instagram) {
            el.setAttribute('href', 'https://www.instagram.com/' + CFG.instagram + '/');
            openInNewTab(el);
          }
          break;
        case '2gis':
          if (CFG.twoGisQuery) {
            el.setAttribute('href', twoGisUrl());
            openInNewTab(el);
          }
          break;
        case 'map':
          // only touch src if it differs — avoids reloading the iframe
          if (CFG.mapQuery && el.getAttribute('src') !== mapSrc()) el.setAttribute('src', mapSrc());
          break;
      }
    });

    $$('[data-contact-text]').forEach(function (el) {
      var value = '';
      switch (el.getAttribute('data-contact-text')) {
        case 'phone': value = CFG.phoneDisplay; break;
        case 'instagram': value = CFG.instagram ? '@' + CFG.instagram : ''; break;
        case 'address': value = pick(CFG.address); break;
        case 'hours': value = pick(CFG.hours); break;
      }
      if (value) el.textContent = value;
    });
  }

  /** Keep structured data in sync with config (Google renders JS). */
  function syncJsonLd() {
    var node = $('script[type="application/ld+json"]');
    if (!node) return;
    try {
      var data = JSON.parse(node.textContent);
      if (CFG.phone) data.telephone = CFG.phone;
      if (CFG.hoursSchema) data.openingHours = CFG.hoursSchema;
      if (CFG.instagram) data.sameAs = ['https://www.instagram.com/' + CFG.instagram + '/'];
      if (CFG.foundedYear) data.foundingDate = String(CFG.foundedYear);
      node.textContent = JSON.stringify(data);
    } catch (e) { /* keep static JSON-LD */ }
  }

  function setYear() {
    var year = String(new Date().getFullYear());
    $$('[data-year]').forEach(function (el) { el.textContent = year; });
  }

  /* ------------------------------------------------------------------
     Prices — rendered from CFG.PRICES in the current language
     ------------------------------------------------------------------ */
  function formatNumber(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  }

  function renderPrices() {
    var items = CFG.PRICES || [];
    var prefix = t('price.prefix') || '';
    var suffix = t('price.suffix') || '₸';

    $$('[data-prices]').forEach(function (list) {
      var cat = list.getAttribute('data-prices');
      var frag = doc.createDocumentFragment();

      items.forEach(function (item) {
        if (item.cat !== cat) return;

        var li = doc.createElement('li');
        li.className = 'price-row';

        var name = doc.createElement('span');
        name.className = 'price-row__name';
        name.textContent = item[state.lang] || item.ru || '';

        var dots = doc.createElement('span');
        dots.className = 'price-row__dots';
        dots.setAttribute('aria-hidden', 'true');

        var price = doc.createElement('span');
        price.className = 'price-row__price';
        if (prefix) {
          var small = doc.createElement('small');
          small.textContent = prefix;
          price.appendChild(small);
          price.appendChild(doc.createTextNode(NBSP));
        }
        price.appendChild(doc.createTextNode(formatNumber(item.from) + NBSP));
        var cur = doc.createElement('span');
        cur.className = 'price-row__cur';
        cur.textContent = suffix;
        price.appendChild(cur);

        li.appendChild(name);
        li.appendChild(dots);
        li.appendChild(price);
        frag.appendChild(li);
      });

      list.textContent = '';
      list.appendChild(frag);
    });
  }

  /* ------------------------------------------------------------------
     i18n
     ------------------------------------------------------------------ */
  function readSavedLang() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return v === 'ru' || v === 'kz' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function saveLang(lang) {
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* private mode etc. */ }
  }

  function setMeta(selector, value) {
    var el = $(selector);
    if (el && value) el.setAttribute('content', value);
  }

  function translateDom() {
    $$('[data-i18n]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n'));
      if (v !== null) el.textContent = v;
    });

    // Trusted, static markup from our own dictionary only
    $$('[data-i18n-html]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n-html'));
      if (v !== null) el.innerHTML = v;
    });

    // data-i18n-attr="aria-label:key, alt:key2"
    $$('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var i = pair.indexOf(':');
        if (i < 1) return;
        var attr = pair.slice(0, i).trim();
        var v = t(pair.slice(i + 1).trim());
        if (attr && v !== null) el.setAttribute(attr, v);
      });
    });

    var title = t('meta.title');
    var desc = t('meta.description');
    if (title) doc.title = title;
    setMeta('meta[name="description"]', desc);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', desc);
  }

  function applyLang(lang, isInitial) {
    if (!has(DICT, lang)) lang = 'ru';
    state.lang = lang;
    root.setAttribute('lang', lang === 'kz' ? 'kk' : 'ru');

    // Russian is already in the HTML — skip the DOM pass on first load
    if (!(isInitial && lang === 'ru')) translateDom();

    $$('[data-lang]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang') === lang));
    });

    fillContacts();
    renderPrices();
    updateBurgerLabel();
    refreshTabIndicators();
  }

  function initLangSwitch() {
    $$('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = btn.getAttribute('data-lang');
        if (lang === state.lang) return;
        applyLang(lang, false);
        saveLang(lang);
      });
    });
  }

  /* ------------------------------------------------------------------
     Tabs — WAI-ARIA APG, automatic activation, roving tabindex
     ------------------------------------------------------------------ */
  function moveIndicator(list) {
    var indicator = $('.tabs__indicator', list);
    var active = $('[role="tab"][aria-selected="true"]', list);
    if (!indicator || !active) return;
    indicator.style.setProperty('--x', active.offsetLeft + 'px');
    indicator.style.setProperty('--y', active.offsetTop + 'px');
    indicator.style.setProperty('--w', active.offsetWidth + 'px');
    indicator.style.setProperty('--h', active.offsetHeight + 'px');
  }

  function refreshTabIndicators() {
    $$('[data-tabs]').forEach(moveIndicator);
  }

  function initTabs() {
    $$('[data-tabs]').forEach(function (list) {
      var tabs = $$('[role="tab"]', list);
      if (!tabs.length) return;

      function select(tab, setFocus) {
        tabs.forEach(function (item) {
          var on = item === tab;
          item.setAttribute('aria-selected', String(on));
          item.tabIndex = on ? 0 : -1;
          var panel = doc.getElementById(item.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
        if (setFocus) tab.focus();
        moveIndicator(list);
      }

      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () { select(tab, false); });
        tab.addEventListener('keydown', function (e) {
          var i = tabs.indexOf(tab);
          var next = null;
          switch (e.key) {
            case 'ArrowRight': next = tabs[(i + 1) % tabs.length]; break;
            case 'ArrowLeft': next = tabs[(i - 1 + tabs.length) % tabs.length]; break;
            case 'Home': next = tabs[0]; break;
            case 'End': next = tabs[tabs.length - 1]; break;
          }
          if (next) {
            e.preventDefault();
            select(next, true);
          }
        });
      });

      var current = tabs.filter(function (tab) {
        return tab.getAttribute('aria-selected') === 'true';
      })[0] || tabs[0];
      select(current, false);

      // enable the sliding transition only after the first placement
      window.requestAnimationFrame(function () { list.classList.add('is-ready'); });
    });

    window.addEventListener('resize', rafThrottle(refreshTabIndicators), { passive: true });
    // tab widths change once web fonts arrive
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(refreshTabIndicators);
  }

  /* ------------------------------------------------------------------
     Mobile menu — Esc closes, focus trapped in header + menu
     ------------------------------------------------------------------ */
  var menu = {};

  function updateBurgerLabel() {
    if (!menu.label) return;
    menu.label.textContent = t(state.menuOpen ? 'menu.close' : 'menu.open') || '';
  }

  function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function trapFocus(e) {
    var nodes = $$('a[href], button:not([disabled])', menu.header)
      .concat($$('a[href], button:not([disabled])', menu.panel))
      .filter(isVisible);
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    var active = doc.activeElement;
    if (nodes.indexOf(active) === -1) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function setInert(on) {
    menu.inert.forEach(function (el) {
      if (on) el.setAttribute('inert', '');
      else el.removeAttribute('inert');
    });
  }

  function openMenu() {
    if (!menu.panel || state.menuOpen) return;
    state.menuOpen = true;
    menu.panel.classList.add('is-open');
    menu.header.classList.add('is-menu-open');
    menu.burger.setAttribute('aria-expanded', 'true');
    root.classList.add('is-locked');
    setInert(true);
    updateBurgerLabel();
    window.requestAnimationFrame(function () {
      var firstLink = $('a[href]', menu.panel);
      if (firstLink) firstLink.focus({ preventScroll: true });
    });
  }

  function closeMenu(returnFocus) {
    if (!menu.panel || !state.menuOpen) return;
    state.menuOpen = false;
    menu.panel.classList.remove('is-open');
    menu.header.classList.remove('is-menu-open');
    menu.burger.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-locked');
    setInert(false);
    updateBurgerLabel();
    if (returnFocus) menu.burger.focus();
  }

  function initMenu() {
    menu.burger = $('[data-burger]');
    menu.panel = $('[data-menu]');
    menu.header = $('[data-header]');
    menu.label = menu.burger ? $('[data-burger-label]', menu.burger) : null;
    menu.inert = [$('main'), $('[data-footer]'), $('[data-fab]')].filter(Boolean);
    if (!menu.burger || !menu.panel || !menu.header) return;

    updateBurgerLabel();

    menu.burger.addEventListener('click', function () {
      if (state.menuOpen) closeMenu(true);
      else openMenu();
    });

    doc.addEventListener('keydown', function (e) {
      if (!state.menuOpen) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        closeMenu(true);
      } else if (e.key === 'Tab') {
        trapFocus(e);
      }
    });

    // close if the viewport grows to desktop while open
    onMediaChange(window.matchMedia && window.matchMedia('(min-width: 960px)'), function (mq) {
      if (mq.matches) closeMenu(false);
    });
  }

  /* ------------------------------------------------------------------
     Smooth in-page anchors (offset for the fixed header, focus target)
     ------------------------------------------------------------------ */
  function initAnchors() {
    doc.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!link) return;
      var id = link.getAttribute('href').slice(1);
      var target = id ? doc.getElementById(id) : null;
      if (!target) return;

      e.preventDefault();
      if (state.menuOpen) closeMenu(false);

      var header = $('[data-header]');
      var offset = header ? header.offsetHeight : 0;
      var top = id === 'hero' ? 0 : target.getBoundingClientRect().top + window.pageYOffset - offset;

      window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });

      try { window.history.pushState(null, '', '#' + id); } catch (err) { /* file:// in some browsers */ }

      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
    });
  }

  /* ------------------------------------------------------------------
     Scroll: header state, hero parallax, floating WhatsApp visibility
     ------------------------------------------------------------------ */
  function initScroll() {
    var header = $('[data-header]');
    var hero = $('#hero');
    var media = $('[data-parallax]');
    var fab = $('[data-fab]');
    var footer = $('[data-footer]');
    var heroH = hero ? hero.offsetHeight : 0;
    var footerInView = false;
    var parallax = !reduceMotion && !!media;

    // Where the button can overlap content (no side margin), tuck it away
    // while the user scrolls down and bring it back on scroll up.
    var autoHideMq = window.matchMedia ? window.matchMedia('(max-width: 1399px)') : null;
    var lastY = window.pageYOffset || 0;
    var scrollingDown = false;

    function update() {
      var y = window.pageYOffset || root.scrollTop || 0;

      if (header) header.classList.toggle('is-scrolled', y > 24);

      if (parallax && y <= heroH) {
        media.style.transform = 'translate3d(0,' + (y * 0.32).toFixed(1) + 'px,0)';
      }

      if (Math.abs(y - lastY) > 6) {
        scrollingDown = y > lastY;
        lastY = y;
      }

      if (fab) {
        var autoHide = !!(autoHideMq && autoHideMq.matches) && scrollingDown;
        fab.classList.toggle('is-visible', y > heroH * 0.6 && !footerInView && !autoHide);
      }
    }

    var onScroll = rafThrottle(update);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', rafThrottle(function () {
      heroH = hero ? hero.offsetHeight : 0;
      update();
    }), { passive: true });

    // hide the floating button over the footer so it never covers content
    if (hasIO && footer && fab) {
      new IntersectionObserver(function (entries) {
        footerInView = entries[0].isIntersecting;
        update();
      }, { rootMargin: '0px 0px -40px 0px' }).observe(footer);
    }

    update();
  }

  /* ------------------------------------------------------------------
     Scroll-spy for the desktop nav
     ------------------------------------------------------------------ */
  function initScrollSpy() {
    var links = $$('.nav__link');
    if (!hasIO || !links.length) return;

    var byId = {};
    links.forEach(function (link) { byId[link.getAttribute('href').slice(1)] = link; });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var active = byId[entry.target.id];
        links.forEach(function (link) { link.classList.toggle('is-active', link === active); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    $$('main > section[id]').forEach(function (section) { io.observe(section); });
  }

  /* ------------------------------------------------------------------
     Reveal on scroll — items entering together are staggered
     ------------------------------------------------------------------ */
  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;

    if (!hasIO || reduceMotion) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    // A "mask" item starts fully clipped (clip-path: inset(0 0 100% 0)), and
    // Chrome's IntersectionObserver applies the target's own clip-path, so it
    // would never intersect — watch its parent instead.
    var watched = new Map();
    items.forEach(function (el) {
      var target = el.getAttribute('data-reveal') === 'mask' ? el.parentElement : el;
      if (!watched.has(target)) watched.set(target, []);
      watched.get(target).push(el);
    });

    var io = new IntersectionObserver(function (entries) {
      var batch = [];
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        batch = batch.concat(watched.get(entry.target));
        io.unobserve(entry.target);
      });
      batch.forEach(function (el, i) {
        el.style.setProperty('--i', Math.min(i, 6));
        el.classList.add('is-in');
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    watched.forEach(function (_, target) { io.observe(target); });
  }

  /* ------------------------------------------------------------------
     Years-of-experience counter (rounded down to 5: 30+, 35+ …
     so the label "лет / жылдық" is always grammatical)
     ------------------------------------------------------------------ */
  function initCounter() {
    var el = $('[data-counter]');
    if (!el) return;
    var sr = $('[data-counter-sr]');
    var years = new Date().getFullYear() - (Number(CFG.foundedYear) || 1995);
    var target = Math.max(5, Math.floor(years / 5) * 5);

    if (sr) sr.textContent = target + '+';

    if (reduceMotion || !hasIO) {
      el.textContent = String(target);
      return;
    }

    el.textContent = '0';

    function run() {
      var start = null;
      var duration = 1800;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / duration);
        var eased = 1 - Math.pow(1 - p, 4);
        el.textContent = String(Math.round(eased * target));
        if (p < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }

    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      // let the hero entrance settle first
      window.setTimeout(run, 650);
    }, { threshold: 0.6 });
    io.observe(el);
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function init() {
    root.classList.remove('no-js');
    root.classList.add('js');

    setYear();
    syncJsonLd();
    initMenu();
    initTabs();
    applyLang(readSavedLang() || 'ru', true);
    initLangSwitch();
    initAnchors();
    initScroll();
    initScrollSpy();
    initReveal();
    initCounter();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
