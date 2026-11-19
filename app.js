/* 캔터베리로 가는 길 — full-screen glass, cursor light, page transitions, smooth scroll and reveals */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var HAS = !!(window.gsap && window.ScrollTrigger) && !reduce;
  var root = document.documentElement;
  var G = window.Glass;

  /* page glass: composition + colour families (muted, as in old glass) */
  var BLUE = { bg: ['#1a3a9c', '#2146b0', '#163288', '#2a52c0', '#1d40a6'], bgdeep: ['#0f2266', '#122a78'], patch: ['#2f6fb8', '#3a7ac4', '#1f7a8c', '#2c5fb4'],
    acc1: ['#b3182e', '#c42638', '#9c1428'], acc2: ['#e3a83a', '#efbe55', '#d4952a'], acc3: ['#2f8a4c', '#3b9a58'], vine: ['#efe3b8', '#e6d69e', '#f3ead0'], light: ['#fff1c4', '#f6e2a6'] };
  var PAGES = {
    'index.html': Object.assign({ comp: 'medallion', cx: .71, cy: .52, R: .44, lightAt: [.72, .35],
      vines: [[-.06, .98, .12, .62, .24, .9, .4, .4], [-.06, .18, .1, .34, .2, -.02, .34, -.08]] }, BLUE),
    'prologue.html': { comp: 'lancets', arches: [[.57, .73, .1], [.78, .94, .1]], lightAt: [.75, .3],
      bg: ['#9a1428', '#ad1d32', '#8a1022', '#b8253a'], bgdeep: ['#5e0c18', '#6c0f1d'], patch: ['#c23a2e', '#a8283e', '#b5402a'],
      acc1: ['#1f45b4', '#2a55c8', '#1a3a9c', '#3466cc'], acc2: ['#e3a83a', '#efbe55'], acc3: ['#2f8a4c'], roundel: ['#e3a83a', '#efbe55', '#c42638'], light: ['#fff1c4'] },
    'meaning.html': { comp: 'rays', lightAt: [.5, .05],
      bg: ['#1f7a4a', '#258a55', '#1a6a40', '#2c9560'], bgdeep: ['#0f4a2c', '#125432'], patch: ['#4a9a3a', '#2a8a78', '#5aa84a'],
      acc1: ['#e8b040', '#f2c55a', '#d99a2c'], acc2: ['#b3182e', '#c42638'], acc3: ['#2146b0'], light: ['#fff3c8', '#fbe7a8', '#fff8dc'] },
    'language.html': { comp: 'quarry', lightAt: [.7, .25],
      bg: ['#5a2a9a', '#6632aa', '#4e2488', '#7038b4'], bgdeep: ['#341660', '#3c1a6c'], patch: ['#8a5ac0', '#7a4ab4', '#9a6ac8'],
      acc1: ['#e3a83a', '#efbe55'], acc2: ['#c42638', '#b3182e'], light: ['#fff1c4'] },
    'epilogue.html': { comp: 'rose', cx: .74, cy: .5, R: .42, lightAt: [.74, .45],
      bg: ['#c88a1c', '#d89a2a', '#b87a14', '#e0a83a'], bgdeep: ['#8a5a10', '#9a6614'], patch: ['#e8b850', '#d4a040', '#f0c460'],
      acc1: ['#1f45b4', '#2a55c8'], acc2: ['#b3182e', '#c42638'], acc3: ['#2f8a4c'], light: ['#fff6d8', '#fff1c4'] }
  };
  var here = location.pathname.split('/').pop() || 'index.html';
  if (!PAGES[here]) here = 'index.html';
  var P = PAGES[here];

  function store(key, val) {
    try {
      if (val === undefined) { var v = sessionStorage.getItem(key); sessionStorage.removeItem(key); return v; }
      sessionStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  /* ───────── layers ───────── */
  function layer(tag, cls) {
    var el = document.createElement(tag); el.className = cls; el.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(el, document.body.firstChild); return el;
  }
  var scrim = layer('div', 'scrim');
  var bars = layer('div', 'bars');
  var glint = layer('div', 'glint');
  var glow = layer('canvas', 'glass-glow');
  var cv = layer('canvas', 'glass-bg');
  var ctx = cv.getContext('2d');
  var W, H, DPR, pieces = [], lw = 6, off = null, OD = 1;

  function build() {
    DPR = touch ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var s = G.sprites(W, H, P, here.length * 131 + 7, DPR);
    pieces = s.pieces; lw = s.lw; off = s.canvas; OD = s.dpr;
    if (touch) return;
    // glass-only mask so the cursor light falls on glass, not on the lead
    var m = document.createElement('canvas'); m.width = Math.round(W / 2); m.height = Math.round(H / 2);
    var g = m.getContext('2d'); g.scale(.5, .5); g.fillStyle = '#fff';
    pieces.forEach(function (p) { g.beginPath(); p.poly.forEach(function (q, i) { i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); g.fill(); });
    g.globalCompositeOperation = 'destination-out'; g.lineWidth = lw; g.lineJoin = 'round';
    pieces.forEach(function (p) { g.beginPath(); p.poly.forEach(function (q, i) { i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); g.stroke(); });
    var url = 'url(' + m.toDataURL('image/png') + ')';
    glint.style.webkitMaskImage = url; glint.style.maskImage = url;
  }
  function makeGlow() {
    if (touch) return;
    glow.width = Math.round(W / 3); glow.height = Math.round(H / 3);
    var g = glow.getContext('2d');
    if ('filter' in g) g.filter = 'blur(12px)';
    g.drawImage(cv, 0, 0, glow.width, glow.height);
  }
  function glassImage() {
    try {
      var c = document.createElement('canvas'); c.width = Math.round(W * .6); c.height = Math.round(H * .6);
      c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
      root.style.setProperty('--glass-img', 'url(' + c.toDataURL('image/jpeg', .82) + ')');
      root.classList.add('has-glass');
    } catch (e) {}
  }
  function order(fx, fy) {
    var ox = fx * W, oy = fy * H, far = 1;
    pieces.forEach(function (p) { p.d = Math.hypot(p.cx - ox, p.cy - oy); far = Math.max(far, p.d); });
    pieces.forEach(function (p) { p.d = p.d / far; });
  }
  var acc = document.createElement('canvas'), actx = acc.getContext('2d');
  function shape(c, p) {
    c.beginPath();
    for (var i = 0; i < p.poly.length; i++) i ? c.lineTo(p.poly[i][0], p.poly[i][1]) : c.moveTo(p.poly[i][0], p.poly[i][1]);
    c.closePath();
  }
  function blit(c, p) {
    var sx = Math.max(0, p.x), sy = Math.max(0, p.y), ex = Math.min(W, p.x + p.w), ey = Math.min(H, p.y + p.h);
    if (ex > sx && ey > sy) c.drawImage(off, sx * OD, sy * OD, (ex - sx) * OD, (ey - sy) * OD, sx, sy, ex - sx, ey - sy);
  }
  /* a piece in motion: lifted, turned a little, fading */
  function drawMoving(p, t) {
    var e = 1 - Math.pow(1 - t, 3);
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 1.5);
    ctx.translate(p.cx, p.cy + (1 - e) * 22);
    ctx.rotate(p.rot * (1 - e));
    var s = .92 + .08 * e; ctx.scale(s, s);
    ctx.translate(-p.cx, -p.cy);
    shape(ctx, p);
    ctx.lineWidth = lw; ctx.strokeStyle = '#121010'; ctx.stroke();
    ctx.clip(); blit(ctx, p);
    ctx.restore();
  }
  /* pieces at rest live in an accumulation layer, so each is stamped (or erased) only once */
  function stamp(p, erase) {
    actx.save(); shape(actx, p);
    if (erase) { actx.clip(); actx.clearRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4); }
    else { actx.lineWidth = lw; actx.strokeStyle = '#121010'; actx.stroke(); actx.clip(); blit(actx, p); }
    actx.restore();
  }
  function paint() { ctx.clearRect(0, 0, W, H); ctx.drawImage(off, 0, 0, W, H); }
  function run(total, tOf, settledOf, after) {
    var t0 = performance.now(), finished = false;
    return new Promise(function (resolve) {
      function done() { if (!finished) { finished = true; resolve(); } }
      // if the browser throttles animation frames, finish anyway
      setTimeout(done, (total + 2.5) * 1000);
      (function frame(now) {
        if (finished) return;
        var t = (now - t0) / 1000;
        for (var i = 0; i < pieces.length; i++) {
          var p = pieces[i], k = tOf(p, t);
          if (settledOf(p, k)) { if (!p._s) { p._s = true; stamp(p, p._erase); } }
        }
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(acc, 0, 0, W, H);
        for (var j = 0; j < pieces.length; j++) {
          var q = pieces[j], kk = tOf(q, t);
          if (kk > 0 && kk < 1) drawMoving(q, kk);
        }
        if (after) after(t);
        if (t < total + .2) requestAnimationFrame(frame); else done();
      })(t0);
    });
  }
  function freshAcc(full) {
    acc.width = W; acc.height = H; actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.clearRect(0, 0, W, H);
    if (full) actx.drawImage(off, 0, 0, W, H);
  }
  function assemble(fx, fy, total, onHalf) {
    order(fx, fy);
    freshAcc(false);
    pieces.forEach(function (p) { p._s = false; p._erase = false; });
    var spread = total * .62, each = total * .38, half = false;
    return run(total, function (p, t) { return (t - p.d * spread - p.jit * .12) / each; },
      function (p, k) { return k >= 1; },
      function (t) { if (!half && t > total * .45) { half = true; if (onHalf) onHalf(); } })
      .then(function () { paint(); makeGlow(); document.body.classList.add('lit'); });
  }
  function disassemble(fx, fy, total) {
    order(fx, fy);
    document.body.classList.remove('lit');
    freshAcc(true);
    pieces.forEach(function (p) { p._s = false; p._erase = true; });
    var spread = total * .6, each = total * .4;
    return run(total, function (p, t) { return 1 - (t - p.d * spread - p.jit * .1) / each; },
      function (p, k) { return k < 1; });
  }

  build();
  var rz;
  addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      if (Math.abs(innerWidth - W) > 40 || Math.abs(innerHeight - H) > 140) { build(); paint(); makeGlow(); }
      panels();
    }, 300);
  });

  /* ───────── light: follows the cursor, drifts on its own on touch screens ───────── */
  var mx = innerWidth * .7, my = innerHeight * .3, tx = mx, ty = my, looping = false;
  function lightLoop() {
    mx += (tx - mx) * .08; my += (ty - my) * .08;
    glint.style.setProperty('--mx', mx.toFixed(1) + 'px');
    glint.style.setProperty('--my', my.toFixed(1) + 'px');
    if (Math.abs(tx - mx) > .5 || Math.abs(ty - my) > .5) requestAnimationFrame(lightLoop); else looping = false;
  }
  if (!touch) addEventListener('pointermove', function (e) {
    tx = e.clientX; ty = e.clientY;
    if (!looping) { looping = true; requestAnimationFrame(lightLoop); }
  }, { passive: true });
  function dimFor(y) { root.style.setProperty('--dim', Math.min(.62, y / innerHeight * .75).toFixed(3)); }
  dimFor(0);

  /* ───────── lancet windows for the tales ───────── */
  var TALE = {
    knight: Object.assign({}, BLUE),
    miller: { bg: ['#d89a2a', '#c88a1c', '#e0a83a'], bgdeep: ['#8a5a10'], patch: ['#4a9a3a', '#2f8a4c'], acc1: ['#2146b0'], acc2: ['#fff1c4', '#efe3b8'], acc3: ['#b3182e'], light: ['#fff6d8'], vine: ['#2f8a4c'] },
    wife: { bg: ['#b3182e', '#c42638', '#9c1428'], bgdeep: ['#6c0f1d'], patch: ['#d0402e', '#a8283e'], acc1: ['#2146b0', '#2a55c8'], acc2: ['#e3a83a'], acc3: ['#2f8a4c'], light: ['#fff1c4'], vine: ['#efe3b8'] },
    pardoner: { bg: ['#e0a83a', '#efbe55', '#d4952a'], bgdeep: ['#9a6614'], patch: ['#c88a1c', '#f0c460'], acc1: ['#b3182e'], acc2: ['#1a3a9c'], acc3: ['#2f8a4c'], light: ['#fff6d8'], vine: ['#fff1c4'] },
    nun: { bg: ['#7a94c4', '#8aa2cc', '#6a86ba'], bgdeep: ['#3c5a96'], patch: ['#e6ecf0', '#d8e2e8', '#f2f2e6'], acc1: ['#1f45b4'], acc2: ['#e3a83a'], acc3: ['#b3182e'], light: ['#ffffff'], vine: ['#efe3b8'] },
    yeoman: { bg: ['#1f7a4a', '#258a55', '#2c9560'], bgdeep: ['#0f4a2c'], patch: ['#4a9a3a', '#2a8a78'], acc1: ['#e3a83a', '#efbe55'], acc2: ['#b3182e'], acc3: ['#2146b0'], light: ['#fff3c8'], vine: ['#efe3b8'] },
    priest: { bg: ['#c2502a', '#d0602e', '#b04424'], bgdeep: ['#6e2412'], patch: ['#e07a36', '#d86a30'], acc1: ['#1f7a4a'], acc2: ['#fff1c4'], acc3: ['#2146b0'], light: ['#fff6d8'], vine: ['#efe3b8'] },
    parson: { bg: ['#5a2a9a', '#6632aa', '#7038b4'], bgdeep: ['#341660'], patch: ['#8a5ac0'], acc1: ['#e3a83a'], acc2: ['#2146b0'], acc3: ['#b3182e'], light: ['#fff1c4'], vine: ['#efe3b8'] }
  };
  function panels() {
    document.querySelectorAll('canvas.lancet').forEach(function (c, i) {
      var pal = TALE[c.getAttribute('data-pal')] || TALE.knight;
      G.panel(c, Object.assign({ comp: 'medallion', cx: .5, cy: .43, R: .4, vines: [] }, pal), 40 + i * 17);
    });
  }
  panels();

  /* ───────── smooth scroll + reveals ───────── */
  var lenis = null;
  if (HAS) {
    root.classList.add('motion');
    gsap.registerPlugin(ScrollTrigger);
    if (window.Lenis && !touch) {
      lenis = new Lenis({ duration: 1.4, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      var barEl = document.querySelector('.bar');
      lenis.on('scroll', function (l) {
        dimFor(l.scroll);
        if (barEl) barEl.classList.toggle('hide', l.direction === 1 && l.scroll > 120);
      });
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
  }
  if (!lenis) addEventListener('scroll', function () { dimFor(scrollY); }, { passive: true });

  function split(el) {
    if (el._w) return el._w;
    var out = [];
    (function walk(n) {
      Array.prototype.slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var m = document.createElement('span'); m.className = 'wm';
            var i = document.createElement('span'); i.className = 'wi'; i.textContent = part;
            m.appendChild(i); frag.appendChild(m); out.push(i);
          });
          c.parentNode.replaceChild(frag, c);
        } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
      });
    })(el);
    el._w = out;
    return out;
  }

  var hero = document.querySelector('[data-hero]'), heroPlayed = false;
  function playHero() {
    if (heroPlayed) return;
    heroPlayed = true;
    if (!HAS || !hero) return;
    var tl = gsap.timeline();
    hero.querySelectorAll('[data-split]').forEach(function (el, i) {
      tl.to(split(el), { yPercent: 0, rotate: 0, duration: 1.9, ease: 'expo.out', stagger: .06 }, i * .14);
    });
    tl.to(hero.querySelectorAll('[data-fade]'), { autoAlpha: 1, y: 0, duration: 1.8, ease: 'power3.out', stagger: .12 }, .3);
  }

  var PIN = {};
  if (HAS) {
    if (hero) {
      hero.querySelectorAll('[data-split]').forEach(function (el) { gsap.set(split(el), { yPercent: 115, rotate: 3 }); });
      gsap.set(hero.querySelectorAll('[data-fade]'), { autoAlpha: 0, y: 34 });
    }
    var outside = function (el) { return !hero || !hero.contains(el); };
    document.querySelectorAll('[data-split]').forEach(function (el) {
      if (!outside(el)) return;
      gsap.from(split(el), { yPercent: 115, rotate: 3, duration: 1.8, ease: 'expo.out', stagger: .045, scrollTrigger: { trigger: el, start: 'top 86%' } });
    });
    document.querySelectorAll('[data-fade]').forEach(function (el) {
      if (!outside(el)) return;
      gsap.fromTo(el, { y: 44, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.8, ease: 'power3.out', delay: parseFloat(el.getAttribute('data-fade')) || 0, clearProps: 'filter', scrollTrigger: { trigger: el, start: 'top 88%' } });
    });
    document.querySelectorAll('[data-stagger]').forEach(function (g) {
      gsap.fromTo(g.children, { y: 80, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.9, ease: 'expo.out', stagger: .09, clearProps: 'opacity,visibility,transform,filter', scrollTrigger: { trigger: g, start: 'top 85%' } });
    });
    document.querySelectorAll('.scrub').forEach(function (el) {
      var words = split(el);
      words.forEach(function (w) { w.classList.add('sw'); });
      gsap.to(words, { opacity: 1, stagger: .1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 40%', scrub: 1 } });
    });
    PIN['steps'] = function (sec) {
      var steps = Array.prototype.slice.call(sec.querySelectorAll('.step')), bars = sec.querySelectorAll('.progress i');
      gsap.set(steps.slice(1), { autoAlpha: 0 });
      var tl = gsap.timeline({ scrollTrigger: {
        trigger: sec, pin: true, start: 'top top', end: '+=' + steps.length * 85 + '%', scrub: 1.2,
        onUpdate: function (self) {
          var k = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
          bars.forEach(function (b, i) { b.classList.toggle('on', i <= k); });
        } } });
      steps.forEach(function (s, i) {
        if (i > 0) tl.fromTo(s, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power2.out' });
        tl.to({}, { duration: .9 });
        if (i < steps.length - 1) tl.to(s, { autoAlpha: 0, y: -60, duration: 1, ease: 'power2.in' });
      });
    };
    PIN['h'] = function (sec) {
      var wrap = sec.querySelector('.hwrap'), track = sec.querySelector('.htrack');
      var dist = function () { return Math.max(0, track.scrollWidth - wrap.clientWidth); };
      gsap.to(track, { x: function () { return -dist(); }, ease: 'none', scrollTrigger: { trigger: sec, pin: true, start: 'top top', end: function () { return '+=' + dist(); }, scrub: 1, invalidateOnRefresh: true } });
    };
    /* ── dramatic transitions ── */
    // hero drifts up and dissolves as you leave it
    if (hero) {
      gsap.to(hero.querySelector('.wrap'), { yPercent: -18, autoAlpha: 0, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 15%', scrub: true } });
    }
    // chapter cards: a title cut out of the glass, then you fly through the letters
    PIN['chapter'] = function (sec) {
      var t = sec.querySelector('.chap-t'), k = sec.querySelectorAll('.chap-k'), bg = sec.querySelector('.chap-bg');
      var tl = gsap.timeline({ scrollTrigger: { trigger: sec, pin: true, start: 'top top', end: '+=170%', scrub: 1 } });
      tl.fromTo(t, { scale: .7, autoAlpha: 0, letterSpacing: '.12em' }, { scale: 1, autoAlpha: 1, letterSpacing: '-.02em', duration: 1, ease: 'power2.out' })
        .fromTo(k, { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, stagger: .15 }, '-=.4')
        .to({}, { duration: .5 })
        .to(k, { autoAlpha: 0, y: -20, duration: .4 })
        .to(t, { scale: 14, duration: 1.6, ease: 'power3.in' }, '<')
        .to(bg, { autoAlpha: 0, duration: .8 }, '-=.8')
        .to(t, { autoAlpha: 0, duration: .3 }, '-=.3');
    };
    // vaults: the section opens up through a pointed arch
    document.querySelectorAll('.vault').forEach(function (sec) {
      var inner = sec.querySelector('.vault-in');
      gsap.fromTo(inner, { clipPath: 'inset(38% 32% 0% 32% round 50% 50% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0% round 0% 0% 0% 0%)', ease: 'none',
          scrollTrigger: { trigger: sec, start: 'top 95%', end: 'top 10%', scrub: 1 } });
    });
    // decks: each card slides over the last, which sinks back into the dark
    document.querySelectorAll('.deck').forEach(function (deck) {
      var cards = deck.querySelectorAll('.card');
      cards.forEach(function (c, i) {
        if (i === cards.length - 1) return;
        gsap.to(c, { scale: .92, autoAlpha: .35, ease: 'none',
          scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 14%', scrub: true } });
      });
    });
    // line-by-line reading: the passage rolls past a reading line
    PIN['lines'] = function (sec) {
      var track = sec.querySelector('.ltrack'), rows = track.querySelectorAll('.lrow'), n = rows.length, cur = -1;
      var stage = sec.querySelector('.lstage');
      gsap.timeline({ scrollTrigger: { trigger: sec, pin: true, start: 'top top', end: '+=' + n * 22 + '%', scrub: .6,
        onUpdate: function (self) {
          var k = Math.min(n - 1, Math.floor(self.progress * n));
          if (k !== cur) { cur = k; rows.forEach(function (r, i) { r.classList.toggle('on', i === k); r.classList.toggle('past', i < k); }); }
          var rh = rows[0].offsetHeight;
          gsap.set(track, { y: stage.clientHeight / 2 - rh / 2 - self.progress * (n - 1) * rh });
        } } });
    };
    // pinned sections must be created in page order so their spacing adds up correctly
    document.querySelectorAll('[data-steps], [data-h], .chapter, [data-lines]').forEach(function (sec) {
      if (sec.matches('[data-steps]')) PIN.steps(sec);
      else if (sec.matches('[data-h]')) PIN.h(sec);
      else if (sec.matches('.chapter')) PIN.chapter(sec);
      else PIN.lines(sec);
    });
    addEventListener('load', function () { ScrollTrigger.refresh(); panels(); });
  }

  /* ───────── arrival ───────── */
  var arrive = null;
  try { arrive = JSON.parse(store('arrive') || 'null'); } catch (e) { arrive = null; }
  root.classList.remove('arriving');
  if (reduce) { paint(); makeGlow(); document.body.classList.add('lit'); heroPlayed = true; }
  else {
    var ok = arrive && arrive.p === here;
    assemble(ok ? arrive.fx : .5, ok ? arrive.fy : .5, ok ? 1.5 : 1.9, playHero).then(playHero);
  }

  /* ───────── leaving ───────── */
  var leaving = false;
  function go(href, x, y) {
    if (leaving) return;
    var target = href.split('#')[0];
    var fx = x == null ? .5 : x / W, fy = y == null ? .5 : y / H;
    store('arrive', JSON.stringify({ p: target, fx: fx, fy: fy }));
    if (reduce) { location.href = href; return; }
    leaving = true;
    if (lenis) lenis.stop();
    document.body.classList.add('leaving');
    disassemble(fx, fy, 1.05).then(function () { location.href = href; });
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
    if (e.persisted) { leaving = false; document.body.classList.remove('leaving'); document.body.classList.add('lit'); if (lenis) lenis.start(); paint(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
    if (t && t.closest && t.closest('[data-codex]')) return;
    if (document.querySelector('dialog[open]')) return;
    var rel = e.key === 'ArrowRight' ? 'next' : e.key === 'ArrowLeft' ? 'prev' : null;
    if (!rel) return;
    var a = document.querySelector('a[rel="' + rel + '"]');
    if (a) { e.preventDefault(); go(a.getAttribute('href')); }
  });

  /* ───────── tales: filter + reading dialog ───────── */
  var bar = document.querySelector('.estate-bar');
  if (bar) bar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    bar.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    var flt = b.getAttribute('data-filter');
    document.querySelectorAll('.tale').forEach(function (w) { w.classList.toggle('dim', flt !== 'all' && w.getAttribute('data-estate') !== flt); });
  });
  var dlg = document.getElementById('reader');
  if (dlg) {
    var body = dlg.querySelector('.dlg-body'), opener = null;
    document.querySelectorAll('.tale').forEach(function (t) {
      t.addEventListener('click', function () {
        opener = t;
        body.innerHTML = t.querySelector('.detail').innerHTML;
        if (lenis) lenis.stop();
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
        body.scrollTop = 0;
      });
    });
    var close = function () { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); };
    dlg.querySelector('.dlg-close').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener('close', function () { if (lenis) lenis.start(); if (opener) opener.focus({ preventScroll: true }); });
  }

  /* ───────── books: leaves you can turn (the original text, the eight tales) ───────── */
  var out = document.getElementById('gloss-out');
  function gloss(codex, w) {
    if (!out || !w) return;
    codex.querySelectorAll('.w').forEach(function (x) { x.setAttribute('aria-pressed', String(x === w)); });
    out.querySelector('.go-word').textContent = w.textContent;
    out.querySelector('.go-mod').textContent = w.getAttribute('data-m') || '';
    out.querySelector('.go-note').textContent = w.getAttribute('data-g');
    if (HAS) gsap.fromTo(out.querySelectorAll('.go-word, .go-mod, .go-note'), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .9, ease: 'expo.out', stagger: .06 });
  }
  document.querySelectorAll('[data-codex]').forEach(function (codex) {
    var leaves = Array.prototype.slice.call(codex.querySelectorAll('.leaves > .leaf')), cur = 0, busy = false;
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
      if (busy || n < 0 || n >= leaves.length || n === cur) return;
      var dir = n > cur ? 1 : -1, a = leaves[cur], b = leaves[n];
      cur = n; sync();
      if (!HAS) { a.classList.remove('on'); b.classList.add('on'); gloss(codex, b.querySelector('.w')); return; }
      busy = true;
      b.classList.add('on');
      gsap.timeline({ onComplete: function () { a.classList.remove('on'); gsap.set([a, b], { clearProps: 'transform,opacity,visibility,filter' }); busy = false; } })
        .to(a, { rotateY: dir * -100, autoAlpha: 0, transformOrigin: dir > 0 ? '0% 50%' : '100% 50%', duration: .85, ease: 'power3.inOut' }, 0)
        .fromTo(b, { autoAlpha: 0, x: dir * 40 }, { autoAlpha: 1, x: 0, duration: 1, ease: 'power3.out' }, .35);
      gloss(codex, b.querySelector('.w'));
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

  /* where am I: a quiet marker of the current section */
  var rail = document.createElement('div');
  rail.className = 'rail'; rail.setAttribute('aria-hidden', 'true');
  rail.innerHTML = '<i></i><span></span>';
  document.body.appendChild(rail);
  var railNum = rail.querySelector('i'), railTxt = rail.querySelector('span');
  var titled = Array.prototype.slice.call(document.querySelectorAll('[data-title]'));
  function setRail(el) {
    if (!el) { rail.classList.remove('on'); return; }
    railNum.textContent = String(titled.indexOf(el) + 1).padStart(2, '0') + ' / ' + String(titled.length).padStart(2, '0');
    railTxt.textContent = el.getAttribute('data-title');
    rail.classList.add('on');
  }
  if (HAS) titled.forEach(function (el) {
    ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', onToggle: function (self) { if (self.isActive) setRail(el); } });
  });

  /* ───────── verse: feet that keep time, and a beat you can watch ───────── */
  document.querySelectorAll('.foot-card').forEach(function (card, ci) {
    var syl = card.querySelectorAll('.fs'), i = 0;
    setInterval(function () {
      syl.forEach(function (s, j) { s.classList.toggle('now', j === i); });
      i = (i + 1) % (syl.length + 1);
    }, 420 + ci * 15);
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

  /* ───────── small interactions ───────── */
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
