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
  /* light through the glass: a slow sweep, and a soft glow that follows the mouse (transform-only, cheap) */
  var sweep = document.createElement('div'); sweep.className = 'sweep'; sweep.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(sweep, scrim);
  var fine = window.matchMedia && matchMedia('(pointer: fine)').matches;
  if (fine && !reduce) {
    var glow = document.createElement('div'); glow.className = 'glow'; glow.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(glow, scrim);
    var gx = innerWidth * .7, gy = innerHeight * .35, tx = gx, ty = gy, gliding = false;
    var glowLoop = function () {
      gx += (tx - gx) * .09; gy += (ty - gy) * .09;
      glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
      if (Math.abs(tx - gx) > .4 || Math.abs(ty - gy) > .4) requestAnimationFrame(glowLoop); else gliding = false;
    };
    glow.style.transform = 'translate3d(' + gx + 'px,' + gy + 'px,0)';
    addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!gliding) { gliding = true; requestAnimationFrame(glowLoop); }
    }, { passive: true });
  }

  /* ── glass motion: the pre-rendered pieces are set in one by one, and lifted out when you leave ── */
  var orient = innerWidth > innerHeight ? 'l' : 'p';
  var base = 'img/glass-' + here + '-' + orient;
  var cv = document.createElement('canvas'); cv.className = 'glass-cv'; cv.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(cv, bg.nextSibling);
  var ctx = cv.getContext('2d'), acc = document.createElement('canvas'), actx = acc.getContext('2d');
  var im = null, data = null, pieces = [], T = null, sc = 1, ready = false;
  function fit() {
    var d = 1, W = innerWidth, H = innerHeight;
    cv.width = acc.width = Math.round(W * d); cv.height = acc.height = Math.round(H * d);
    sc = Math.max(W / data.w, H / data.h);
    T = [d * sc, d * (W - data.w * sc) / 2, d * (H - data.h * sc) / 2];
  }
  function at(c) { c.setTransform(T[0], 0, 0, T[0], T[1], T[2]); }
  function trace(c, p) { var q = p.q; c.beginPath(); c.moveTo(q[0], q[1]); for (var i = 2; i < q.length; i += 2) c.lineTo(q[i], q[i + 1]); c.closePath(); }
  function blit(c, p) {
    var x = Math.max(0, p.x), y = Math.max(0, p.y), w = Math.min(data.w, p.x + p.w) - x, h = Math.min(data.h, p.y + p.h) - y;
    if (w > 0 && h > 0) c.drawImage(im, x, y, w, h, x, y, w, h);
  }
  function stamp(p, erase) {
    actx.save(); at(actx); trace(actx, p);
    if (erase) { actx.clip(); actx.clearRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8); }
    else { actx.lineWidth = data.lw; actx.strokeStyle = '#121010'; actx.stroke(); actx.clip(); blit(actx, p); }
    actx.restore();
  }
  function moving(p, t) {
    var e = 1 - Math.pow(1 - t, 3), lift = 26 / sc;
    ctx.save(); at(ctx);
    ctx.globalAlpha = Math.min(1, t * 1.4);
    ctx.translate(p.cx, p.cy + (1 - e) * lift); ctx.rotate(p.rot * (1 - e));
    var k = .9 + .1 * e; ctx.scale(k, k); ctx.translate(-p.cx, -p.cy);
    trace(ctx, p); ctx.lineWidth = data.lw; ctx.strokeStyle = '#121010'; ctx.stroke(); ctx.clip(); blit(ctx, p);
    ctx.restore();
  }
  function order(fx, fy) {
    var X = (fx * cv.width - T[1]) / T[0], Y = (fy * cv.height - T[2]) / T[0], far = 1;
    pieces.forEach(function (p) { p.d = Math.hypot(p.cx - X, p.cy - Y); far = Math.max(far, p.d); });
    pieces.forEach(function (p) { p.d /= far; });
  }
  function run(total, tOf, settled) {
    var t0 = performance.now(), done = false;
    return new Promise(function (resolve) {
      function finish() { if (!done) { done = true; resolve(); } }
      setTimeout(finish, (total + 2) * 1000);
      (function frame(now) {
        if (done) return;
        var t = (now - t0) / 1000, i, p, k;
        for (i = 0; i < pieces.length; i++) { p = pieces[i]; k = tOf(p, t); if (settled(k) && !p.s) { p.s = true; stamp(p, p.er); } }
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(acc, 0, 0);
        for (i = 0; i < pieces.length; i++) { p = pieces[i]; k = tOf(p, t); if (k > 0 && k < 1) moving(p, k); }
        if (t < total + .1) requestAnimationFrame(frame); else finish();
      })(t0);
    });
  }
  function assemble(fx, fy) {
    var total = 1.7, spread = total * .75, each = total * .25;
    order(fx, fy);
    actx.setTransform(1, 0, 0, 1, 0, 0); actx.clearRect(0, 0, acc.width, acc.height);
    pieces.forEach(function (p) { p.s = false; p.er = false; });
    cv.classList.add('on');
    return run(total, function (p, t) { return (t - p.d * spread - p.j * .12) / each; }, function (k) { return k >= 1; })
      .then(function () { bg.classList.add('ready'); setTimeout(function () { cv.classList.remove('on'); }, 60); });
  }
  function disassemble(fx, fy) {
    var total = .95, spread = total * .7, each = total * .3;
    order(fx, fy);
    actx.setTransform(1, 0, 0, 1, 0, 0); actx.clearRect(0, 0, acc.width, acc.height);
    at(actx); actx.drawImage(im, 0, 0);
    pieces.forEach(function (p) { p.s = false; p.er = true; });
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(acc, 0, 0);
    cv.classList.add('on'); bg.classList.add('gone');
    return run(total, function (p, t) { return 1 - (t - p.d * spread - p.j * .1) / each; }, function (k) { return k < 1; });
  }
  var arrive = null;
  try { arrive = JSON.parse(sessionStorage.getItem('arrive') || 'null'); sessionStorage.removeItem('arrive'); } catch (e) { arrive = null; }
  Promise.all([
    new Promise(function (res, rej) { var i = new Image(); i.onload = function () { im = i; res(); }; i.onerror = rej; i.src = base + '.webp'; }),
    fetch(base + '.json').then(function (r) { return r.json(); }).then(function (j) { data = j; })
  ]).then(function () {
    pieces = data.p.map(function (q) {
      var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, cx = 0, cy = 0, n = q.length / 2;
      for (var i = 0; i < q.length; i += 2) { minx = Math.min(minx, q[i]); maxx = Math.max(maxx, q[i]); miny = Math.min(miny, q[i + 1]); maxy = Math.max(maxy, q[i + 1]); cx += q[i]; cy += q[i + 1]; }
      var pad = data.lw;
      return { q: q, x: Math.floor(minx - pad), y: Math.floor(miny - pad), w: Math.ceil(maxx - minx + 2 * pad), h: Math.ceil(maxy - miny + 2 * pad), cx: cx / n, cy: cy / n, rot: (Math.random() - .5) * .14, j: Math.random() };
    });
    fit(); ready = true;
    if (reduce) { bg.classList.add('ready'); return; }
    var ok = arrive && arrive.p === here;
    return assemble(ok ? arrive.fx : .5, ok ? arrive.fy : .55);
  }).catch(function () { bg.classList.add('ready'); });
  var rz;
  addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (ready) fit(); }, 200); });

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

  /* ── page change: the glass is lifted out piece by piece from where you clicked ── */
  var leaving = false;
  function go(href, x, y) {
    if (leaving) return;
    leaving = true;
    var target = href.split('#')[0].replace('.html', '') || 'index';
    var fx = x == null ? .5 : x / innerWidth, fy = y == null ? .5 : y / innerHeight;
    try { sessionStorage.setItem('arrive', JSON.stringify({ p: target, fx: fx, fy: fy })); } catch (e) {}
    if (reduce || !ready) { location.href = href; return; }
    document.body.classList.add('leaving');
    disassemble(fx, fy).then(function () { location.href = href; });
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a');
    if (!a || a.target === '_blank') return;
    if (!/^[\w-]+\.html(#[\w-]+)?$/.test(a.getAttribute('href') || '')) return;
    e.preventDefault();
    go(a.getAttribute('href'), e.clientX || null, e.clientY || null);
  });
  addEventListener('pageshow', function (e) {
    if (e.persisted) { leaving = false; document.body.classList.remove('leaving'); bg.classList.remove('gone'); bg.classList.add('ready'); cv.classList.remove('on'); }
  });
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
