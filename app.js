/* 캔터베리로 가는 길 — light version.
   The stained glass is pre-rendered into images (see /tools), so nothing heavy runs in the browser:
   no animation libraries, no canvas work, no smooth-scroll hijacking. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.remove('arriving');
  root.classList.add('js');

  /* ── background glass for this page (landscape / portrait image) ── */
  var here = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';
  if (['index', 'prologue', 'meaning', 'language', 'epilogue'].indexOf(here) < 0) here = 'index';
  var bg = document.createElement('div');
  bg.className = 'glass-bg';
  bg.setAttribute('aria-hidden', 'true');
  bg.style.setProperty('--glass-l', 'url(img/glass-' + here + '-l.webp)');
  bg.style.setProperty('--glass-p', 'url(img/glass-' + here + '-p.webp)');
  var scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(scrim, document.body.firstChild);
  document.body.insertBefore(bg, document.body.firstChild);
  var img = new Image();
  img.onload = function () { bg.classList.add('ready'); };
  img.src = 'img/glass-' + here + (innerWidth > innerHeight ? '-l' : '-p') + '.webp';

  /* darker behind the text once you start reading (one update per frame at most) */
  var ticking = false, bar = document.querySelector('.bar'), lastY = 0;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      root.style.setProperty('--dim', Math.min(.62, y / innerHeight * .75).toFixed(2));
      if (bar) bar.classList.toggle('hide', y > lastY && y > 120);
      lastY = y;
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── tale windows: plain images ── */
  document.querySelectorAll('canvas.lancet').forEach(function (c) {
    var im = document.createElement('img');
    im.className = 'lancet';
    im.alt = '';
    im.decoding = 'async';
    im.src = 'img/window-' + (c.getAttribute('data-pal') || 'knight') + '.webp';
    c.parentNode.replaceChild(im, c);
  });

  /* ── reveal on scroll: one observer, CSS does the rest ── */
  var revealSel = '[data-fade], [data-split], [data-stagger] > *';
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll(revealSel).forEach(function (el) {
      var d = parseFloat(el.getAttribute('data-fade'));
      if (d) el.style.transitionDelay = d + 's';
      io.observe(el);
    });
  } else {
    document.querySelectorAll(revealSel).forEach(function (el) { el.classList.add('in'); });
  }

  /* ── where am I ── */
  var rail = document.createElement('div');
  rail.className = 'rail'; rail.setAttribute('aria-hidden', 'true');
  rail.innerHTML = '<i></i><span></span>';
  document.body.appendChild(rail);
  var titled = Array.prototype.slice.call(document.querySelectorAll('[data-title]'));
  if ('IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        rail.querySelector('i').textContent = String(titled.indexOf(el) + 1).padStart(2, '0') + ' / ' + String(titled.length).padStart(2, '0');
        rail.querySelector('span').textContent = el.getAttribute('data-title');
        rail.classList.add('on');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    titled.forEach(function (el) { ro.observe(el); });
  }

  /* ── page change: a short fade ── */
  var leaving = false;
  function go(href) {
    if (leaving) return;
    leaving = true;
    if (reduce) { location.href = href; return; }
    document.body.classList.add('leaving');
    setTimeout(function () { location.href = href; }, 320);
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a');
    if (!a || a.target === '_blank') return;
    if (!/^[\w-]+\.html(#[\w-]+)?$/.test(a.getAttribute('href') || '')) return;
    e.preventDefault();
    go(a.getAttribute('href'));
  });
  addEventListener('pageshow', function (e) { if (e.persisted) { leaving = false; document.body.classList.remove('leaving'); } });
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
    if (t && t.closest && t.closest('[data-codex]')) return;
    var rel = e.key === 'ArrowRight' ? 'next' : e.key === 'ArrowLeft' ? 'prev' : null;
    if (!rel) return;
    var a = document.querySelector('a[rel="' + rel + '"]');
    if (a) { e.preventDefault(); go(a.getAttribute('href')); }
  });

  /* ── books: the original text and the eight tales ── */
  var out = document.getElementById('gloss-out');
  function gloss(codex, w) {
    if (!out || !w) return;
    codex.querySelectorAll('.w').forEach(function (x) { x.setAttribute('aria-pressed', String(x === w)); });
    out.querySelector('.go-word').textContent = w.textContent;
    out.querySelector('.go-mod').textContent = w.getAttribute('data-m') || '';
    out.querySelector('.go-note').textContent = w.getAttribute('data-g');
    out.classList.remove('flash'); void out.offsetWidth; out.classList.add('flash');
  }
  document.querySelectorAll('[data-codex]').forEach(function (codex) {
    var leaves = Array.prototype.slice.call(codex.querySelectorAll('.leaves > .leaf')), cur = 0;
    var count = codex.querySelector('.codex-count'), prevB = codex.querySelector('.codex-prev'), nextB = codex.querySelector('.codex-next');
    var dots = codex.querySelector('.codex-dots');
    var toc = codex.id ? document.querySelectorAll('[data-toc="' + codex.id + '"] button') : [];
    leaves.forEach(function (l, i) { l.classList.toggle('on', i === 0); if (dots) dots.appendChild(document.createElement('i')); });
    function sync() {
      if (count) count.textContent = (cur + 1) + ' / ' + leaves.length;
      prevB.disabled = cur === 0; nextB.disabled = cur === leaves.length - 1;
      if (dots) dots.querySelectorAll('i').forEach(function (d, i) { d.classList.toggle('on', i === cur); });
      toc.forEach(function (b, i) { b.setAttribute('aria-current', String(i === cur)); });
    }
    function show(n) {
      if (n < 0 || n >= leaves.length || n === cur) return;
      var dir = n > cur ? 'fwd' : 'back';
      leaves[cur].classList.remove('on', 'fwd', 'back');
      leaves[n].classList.remove('fwd', 'back');
      leaves[n].classList.add(dir, 'on');
      cur = n; sync();
      gloss(codex, leaves[n].querySelector('.w'));
    }
    prevB.addEventListener('click', function () { show(cur - 1); });
    nextB.addEventListener('click', function () { show(cur + 1); });
    toc.forEach(function (b, i) { b.addEventListener('click', function () { show(i); }); });
    codex.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
    });
    var sx = null;
    codex.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    codex.addEventListener('pointerup', function (e) {
      if (sx === null) return; var dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 60) show(cur + (dx < 0 ? 1 : -1));
    });
    codex.querySelectorAll('.w').forEach(function (w) { w.addEventListener('click', function () { gloss(codex, w); }); });
    sync();
  });

  /* ── verse: feet that keep time (only while visible), and a beat you can watch ── */
  document.querySelectorAll('.foot-card').forEach(function (card) {
    var syl = card.querySelectorAll('.fs'), i = 0, timer = null;
    function tick() { syl.forEach(function (s, j) { s.classList.toggle('now', j === i); }); i = (i + 1) % (syl.length + 1); }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (e.isIntersecting && !timer) timer = setInterval(tick, 430);
          else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; }
        });
      }).observe(card);
    }
  });
  var play = document.querySelector('[data-play]');
  if (play) play.addEventListener('click', function () {
    var syl = document.querySelectorAll('#verse-lines .syl'), i = 0;
    var host = document.getElementById('verse-lines');
    host.classList.add('show-meter', 'playing');
    play.disabled = true;
    (function step() {
      syl.forEach(function (s) { s.classList.remove('beat'); });
      if (i >= syl.length) { host.classList.remove('playing'); play.disabled = false; return; }
      var s = syl[i++];
      if (s.getAttribute('data-s') === 'e') { step(); return; }
      s.classList.add('beat');
      setTimeout(step, s.getAttribute('data-s') === '1' ? 420 : 260);
    })();
  });

  /* ── small interactions ── */
  document.querySelectorAll('[data-toggle]').forEach(function (b) {
    var target = document.querySelector(b.getAttribute('data-target')), cls = b.getAttribute('data-toggle');
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      if (target) target.classList.toggle(cls, on);
    });
  });
  document.querySelectorAll('.flip').forEach(function (c) {
    c.addEventListener('click', function () { c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); });
  });
})();
