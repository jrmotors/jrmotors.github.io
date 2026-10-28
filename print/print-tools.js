/*!
 * JR Motors print — preview guides & layout QA.
 * Inert by default. Never affects the print PDFs.
 *
 *   ?guides  draws trim (cyan), safe zones (magenta, dashed) and folds (cyan, dashed)
 *   ?qa      writes a JSON report into <pre id="qa-report"> (read it with --dump-dom):
 *            every glyph box is checked against the safe zone of its panel,
 *            the fold keep-out bands, the minimum point size and the brand fonts.
 *
 * Sheets describe themselves with data attributes (all values in mm):
 *   data-w, data-h          page size incl. bleed
 *   data-bleed, data-safe   bleed and safe distance from the trim
 *   data-folds              fold x-positions on the page (e.g. "100,200")
 *   data-fold-safe          keep-out on each side of a fold
 *   data-min-pt             smallest allowed type size
 * Elements may opt out with [data-qa-ignore] (decorative type) or declare
 * their visible area with data-qa-visible="x0 y0 x1 y1" (fractions, e.g. logo PNG).
 */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var wantGuides = params.has('guides');
  var wantQA = params.has('qa');
  if (!wantGuides && !wantQA) return;

  var PX_PER_MM = 96 / 25.4;
  var PT_PER_PX = 0.75;

  function spec(sheet) {
    var d = sheet.dataset;
    return {
      label: d.label || '',
      w: +d.w, h: +d.h,
      bleed: +d.bleed, safe: +d.safe,
      folds: (d.folds || '').split(',').filter(Boolean).map(Number),
      foldSafe: +(d.foldSafe || 0),
      minPt: +(d.minPt || 0)
    };
  }

  /* safe rectangles, one per panel (between trim edges and folds) */
  function safeRects(s) {
    var xs = [s.bleed].concat(s.folds, [s.w - s.bleed]);
    var top = s.bleed + s.safe, bottom = s.h - s.bleed - s.safe, out = [];
    for (var i = 0; i < xs.length - 1; i++) {
      out.push({
        x0: xs[i] + (i === 0 ? s.safe : s.foldSafe),
        x1: xs[i + 1] - (i === xs.length - 2 ? s.safe : s.foldSafe),
        y0: top, y1: bottom
      });
    }
    return out;
  }

  function el(cls, css, parent, text) {
    var e = document.createElement('div');
    e.className = cls;
    for (var k in css) e.style[k] = css[k];
    if (text) e.textContent = text;
    parent.appendChild(e);
    return e;
  }

  function drawGuides(sheet) {
    var s = spec(sheet);
    var art = sheet.querySelector('.artboard');
    var g = el('guides', {}, art);
    el('g-trim', { left: s.bleed + 'mm', top: s.bleed + 'mm', width: (s.w - 2 * s.bleed) + 'mm', height: (s.h - 2 * s.bleed) + 'mm' }, g);
    safeRects(s).forEach(function (r) {
      el('g-safe', { left: r.x0 + 'mm', top: r.y0 + 'mm', width: (r.x1 - r.x0) + 'mm', height: (r.y1 - r.y0) + 'mm' }, g);
    });
    s.folds.forEach(function (x) {
      el('g-fold', { left: x + 'mm' }, g);
      el('g-tag', { left: (x + 1) + 'mm', top: (s.bleed + 1) + 'mm' }, g, 'фальц ' + (x - s.bleed) + ' мм');
    });
    el('g-tag', { left: (s.bleed + 1) + 'mm', bottom: (s.bleed + 1) + 'mm' }, g,
      (s.label ? s.label + ' · ' : '') + 'обрез ' + (s.w - 2 * s.bleed) + '×' + (s.h - 2 * s.bleed) + ' мм, вылет ' + s.bleed + ' мм');
  }

  function toMM(r, origin) {
    return {
      x0: (r.left - origin.left) / PX_PER_MM, x1: (r.right - origin.left) / PX_PER_MM,
      y0: (r.top - origin.top) / PX_PER_MM, y1: (r.bottom - origin.top) / PX_PER_MM
    };
  }
  function round(n) { return Math.round(n * 100) / 100; }

  function check(box, s, rects, what, issues) {
    var EPS = 0.05;
    var cx = (box.x0 + box.x1) / 2;
    var panel = rects.filter(function (r) { return cx >= r.x0 - 8 && cx <= r.x1 + 8; })[0] ||
      rects.reduce(function (a, r) { return Math.abs((r.x0 + r.x1) / 2 - cx) < Math.abs((a.x0 + a.x1) / 2 - cx) ? r : a; });
    var out = [];
    if (box.x0 < panel.x0 - EPS) out.push('left ' + round(panel.x0 - box.x0) + 'mm');
    if (box.x1 > panel.x1 + EPS) out.push('right ' + round(box.x1 - panel.x1) + 'mm');
    if (box.y0 < panel.y0 - EPS) out.push('top ' + round(panel.y0 - box.y0) + 'mm');
    if (box.y1 > panel.y1 + EPS) out.push('bottom ' + round(box.y1 - panel.y1) + 'mm');
    s.folds.forEach(function (f) {
      if (box.x1 > f - s.foldSafe + EPS && box.x0 < f + s.foldSafe - EPS) out.push('fold@' + f);
    });
    if (out.length) issues.push({ what: what, box: [round(box.x0), round(box.y0), round(box.x1), round(box.y1)], problems: out });
  }

  function runQA() {
    var report = { fonts: [], sheets: [] };
    document.fonts.forEach(function (f) {
      if (f.status === 'loaded') report.fonts.push(f.family.replace(/"/g, '') + ' ' + f.weight);
    });
    var families = ['Unbounded', 'Manrope'];

    Array.prototype.forEach.call(document.querySelectorAll('.sheet'), function (sheet) {
      var s = spec(sheet);
      var art = sheet.querySelector('.artboard');
      var origin = art.getBoundingClientRect();
      var rects = safeRects(s);
      var issues = [], small = [], badFont = [], overflow = [], textRuns = 0, minSeen = 99;

      var walker = document.createTreeWalker(art, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        if (!node.nodeValue.trim()) continue;
        var parent = node.parentElement;
        if (parent.closest('[data-qa-ignore], .guides, .sprite, script, style')) continue;
        var cs = getComputedStyle(parent);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        textRuns++;
        var pt = parseFloat(cs.fontSize) * PT_PER_PX;
        var svg = parent.closest('svg');
        if (svg && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) {
          pt *= svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;  // user units -> CSS px
        }
        minSeen = Math.min(minSeen, pt);
        var label = node.nodeValue.trim().slice(0, 40);
        if (s.minPt && pt < s.minPt - 0.01) small.push({ text: label, pt: round(pt) });
        var fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        if (families.indexOf(fam) < 0) badFont.push({ text: label, family: fam });
        var range = document.createRange();
        range.selectNodeContents(node);
        Array.prototype.forEach.call(range.getClientRects(), function (r) {
          if (r.width < 0.5 || r.height < 0.5) return;
          check(toMM(r, origin), s, rects, label, issues);
        });
      }

      Array.prototype.forEach.call(art.querySelectorAll('[data-qa-visible], [data-qa-box]'), function (e) {
        var r = e.getBoundingClientRect();
        var box = toMM(r, origin);
        if (e.dataset.qaVisible) {
          var f = e.dataset.qaVisible.split(/\s+/).map(Number);
          var w = box.x1 - box.x0, h = box.y1 - box.y0;
          box = { x0: box.x0 + f[0] * w, y0: box.y0 + f[1] * h, x1: box.x0 + f[2] * w, y1: box.y0 + f[3] * h };
        }
        check(box, s, rects, '[' + (e.getAttribute('alt') || e.className) + ']', issues);
      });

      /* in-flow content must end inside the padding box (absolute bleed layers are ignored) */
      Array.prototype.forEach.call(art.querySelectorAll('[data-qa-fit]'), function (e) {
        var pr = e.getBoundingClientRect(), pcs = getComputedStyle(e);
        var innerBottom = pr.bottom - parseFloat(pcs.paddingBottom);
        var innerRight = pr.right - parseFloat(pcs.paddingRight);
        var maxB = -1e9, maxR = -1e9;
        Array.prototype.forEach.call(e.children, function (c) {
          var ccs = getComputedStyle(c);
          if (ccs.position === 'absolute' || ccs.position === 'fixed') return;
          var r = c.getBoundingClientRect();
          maxB = Math.max(maxB, r.bottom + parseFloat(ccs.marginBottom || 0));
          maxR = Math.max(maxR, r.right);
        });
        var overB = (maxB - innerBottom) / PX_PER_MM, overR = (maxR - innerRight) / PX_PER_MM;
        if (overB > 0.05 || overR > 0.05) {
          overflow.push({ el: e.className, bottomMm: round(overB), rightMm: round(overR) });
        }
      });

      report.sheets.push({
        label: s.label, textRuns: textRuns, minPt: round(minSeen),
        safeZoneOrFold: issues, belowMinPt: small, nonBrandFont: badFont, overflow: overflow
      });
    });

    var pre = document.createElement('pre');
    pre.id = 'qa-report';
    pre.textContent = JSON.stringify(report, null, 1);
    document.body.appendChild(pre);
  }

  document.fonts.ready.then(function () {
    if (wantQA) runQA();          // measure first, so guide tags are not measured
    if (wantGuides) Array.prototype.forEach.call(document.querySelectorAll('.sheet'), drawGuides);
  });
})();
