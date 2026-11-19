/* Stained-glass engine.
   Pieces come from a Voronoi split of the screen. Lead lines that must follow a design
   (circles, ribbons, rays, arches) are made by placing pairs of sites on both sides of the
   curve, so the shared cell edge falls exactly on it. Free areas are filled with pieces of
   uneven size. Colours come in soft patches (a low-frequency field), like real glazing. */
(function () {
  'use strict';

  function rng(seed) {
    var s = (Math.imul(seed | 0, 2654435761) >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function hex(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function shade(h, k) {
    var c = hex(h), t = k < 0 ? 0 : 255, p = Math.min(1, Math.abs(k));
    return 'rgb(' + c.map(function (v) { return Math.round(v + (t - v) * p); }).join(',') + ')';
  }
  function rgba(h, a) { var c = hex(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* ── geometry ── */
  function clipHalf(poly, a, b, c) {
    var out = [], n = poly.length;
    for (var i = 0; i < n; i++) {
      var p = poly[i], q = poly[(i + 1) % n];
      var pin = a * p[0] + b * p[1] <= c, qin = a * q[0] + b * q[1] <= c;
      if (pin) out.push(p);
      if (pin !== qin) {
        var t = (c - a * p[0] - b * p[1]) / (a * (q[0] - p[0]) + b * (q[1] - p[1]));
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    return out;
  }
  /* grid-bucketed Voronoi: each cell is clipped by its nearest neighbours */
  function voronoi(sites, W, H) {
    var m = 40, box = [[-m, -m], [W + m, -m], [W + m, H + m], [-m, H + m]];
    var cs = 90, gw = Math.ceil((W + 2 * m) / cs) + 1, grid = {};
    sites.forEach(function (s, i) {
      var k = Math.floor((s.x + m) / cs) + ',' + Math.floor((s.y + m) / cs);
      (grid[k] = grid[k] || []).push(i);
    });
    return sites.map(function (s, i) {
      var gx = Math.floor((s.x + m) / cs), gy = Math.floor((s.y + m) / cs), near = [], ring = 1;
      while (near.length < 30 && ring < 8) {
        near = [];
        for (var x = gx - ring; x <= gx + ring; x++) for (var y = gy - ring; y <= gy + ring; y++) {
          var b = grid[x + ',' + y]; if (!b) continue;
          for (var j = 0; j < b.length; j++) if (b[j] !== i) {
            var o = sites[b[j]], dx = o.x - s.x, dy = o.y - s.y;
            near.push([dx * dx + dy * dy, b[j]]);
          }
        }
        ring++;
      }
      near.sort(function (a, b) { return a[0] - b[0]; });
      var poly = box;
      for (var k = 0; k < Math.min(34, near.length) && poly.length > 2; k++) {
        var p = sites[near[k][1]];
        poly = clipHalf(poly, p.x - s.x, p.y - s.y, (p.x * p.x + p.y * p.y - s.x * s.x - s.y * s.y) / 2);
      }
      return poly;
    });
  }
  function centroid(poly) {
    var a = 0, x = 0, y = 0;
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length], f = p[0] * q[1] - q[0] * p[1];
      a += f; x += (p[0] + q[0]) * f; y += (p[1] + q[1]) * f;
    }
    a *= .5;
    return Math.abs(a) > 1e-6 ? [x / (6 * a), y / (6 * a)] : poly[0];
  }

  /* ── composition helpers ── */
  function Comp(W, H, r) {
    this.W = W; this.H = H; this.r = r; this.s = [];
  }
  /* walk a curve fn(t) at even arc length, placing site rows at the given normal offsets */
  Comp.prototype.curve = function (fn, step, offs, tags, extra) {
    var pts = [], N = 400, i, len = 0, prev = fn(0);
    pts.push([prev[0], prev[1], 0]);
    for (i = 1; i <= N; i++) {
      var p = fn(i / N); len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); pts.push([p[0], p[1], len]); prev = p;
    }
    var n = Math.max(2, Math.round(len / step)), idx = 0;
    for (var k = 0; k <= n; k++) {
      var target = k / n * len;
      while (idx < N && pts[idx + 1][2] < target) idx++;
      var a = pts[idx], b = pts[Math.min(N, idx + 1)];
      var tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
      var f = (target - a[2]) / ((b[2] - a[2]) || 1);
      var x = a[0] + tx * f, y = a[1] + ty * f, nx = -ty / tl, ny = tx / tl;
      for (var o = 0; o < offs.length; o++) {
        this.s.push({ x: x + nx * offs[o], y: y + ny * offs[o], tag: tags[o], k: k, rad: Math.abs(offs[o] - (offs[o + 1] || offs[o - 1] || 0)) * .9, ex: extra });
      }
    }
  };
  Comp.prototype.circle = function (cx, cy, R, step, offs, tags, extra) {
    this.curve(function (t) { var a = t * Math.PI * 2 - Math.PI / 2; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; }, step, offs, tags, extra);
  };
  /* fill free space with pieces of uneven size */
  Comp.prototype.fill = function (gap, tag, inside, density) {
    var W = this.W, H = this.H, r = this.r, s = this.s, cs = gap, grid = {};
    function key(x, y) { return Math.floor(x / cs) + ',' + Math.floor(y / cs); }
    s.forEach(function (p, i) { var k = key(p.x, p.y); (grid[k] = grid[k] || []).push(i); });
    var tries = Math.round(W * H / (gap * gap) * (density || 24));
    for (var t = 0; t < tries; t++) {
      var x = r() * (W + 60) - 30, y = r() * (H + 60) - 30;
      if (inside && !inside(x, y)) continue;
      var g = gap * (.7 + r() * r() * 1.3), ok = true;
      var gx = Math.floor(x / cs), gy = Math.floor(y / cs);
      for (var a = gx - 3; ok && a <= gx + 3; a++) for (var b = gy - 3; ok && b <= gy + 3; b++) {
        var bk = grid[a + ',' + b]; if (!bk) continue;
        for (var j = 0; j < bk.length; j++) {
          var o = s[bk[j]], d = Math.hypot(o.x - x, o.y - y), need = o.rad ? Math.max(o.rad * 1.2, g * .55) : (g + (o.g || g)) / 2;
          if (d < need) { ok = false; break; }
        }
      }
      if (!ok) continue;
      var site = { x: x, y: y, tag: tag, g: g };
      s.push(site); var k2 = key(x, y); (grid[k2] = grid[k2] || []).push(s.length - 1);
    }
  };

  /* low-frequency colour field: neighbouring pieces share a family, forming patches */
  function field(r, scale) {
    var w = [];
    for (var i = 0; i < 5; i++) w.push([(r() * 2 - 1) * scale, (r() * 2 - 1) * scale, r() * 6.28]);
    return function (x, y) { var v = 0; for (var i = 0; i < w.length; i++) v += Math.sin(w[i][0] * x + w[i][1] * y + w[i][2]); return v / w.length; };
  }
  function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }

  /* ── compositions ── */
  var COMPS = {
    /* a great medallion with a gold border ring, divided into petals, two vines across the field */
    medallion: function (c, o) {
      var W = c.W, H = c.H, m = Math.min(W, H), cx = W * o.cx, cy = H * o.cy, R = m * o.R, d = m * .022;
      c.circle(cx, cy, R, d * 2.2, [-1.6 * d, -.55 * d, .55 * d, 1.6 * d], ['bg', 'ring', 'ring', 'in']);
      c.circle(cx, cy, R * .5, d * 2, [-.6 * d, .6 * d], ['in', 'mid']);
      c.circle(cx, cy, R * .18, d * 1.6, [-.55 * d, .55 * d], ['mid', 'core']);
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2 + Math.PI / 8;
        (function (a) {
          c.curve(function (t) { var rr = R * (.5 + t * .43); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; }, d * 2, [-.6 * d, .6 * d], ['in', 'in']);
        })(a);
      }
      c.fill(d * 1.6, 'core', function (x, y) { return Math.hypot(x - cx, y - cy) < R * .15; }, 30);
      c.fill(d * 2.4, 'mid', function (x, y) { var q = Math.hypot(x - cx, y - cy); return q > R * .2 && q < R * .47; }, 30);
      c.fill(d * 2.8, 'in', function (x, y) { var q = Math.hypot(x - cx, y - cy); return q > R * .53 && q < R * .93; }, 30);
      // vines
      var vines = o.vines || [];
      vines.forEach(function (v) {
        c.curve(function (t) {
          var u = 1 - t;
          return [u * u * u * v[0] * W + 3 * u * u * t * v[2] * W + 3 * u * t * t * v[4] * W + t * t * t * v[6] * W,
                  u * u * u * v[1] * H + 3 * u * u * t * v[3] * H + 3 * u * t * t * v[5] * H + t * t * t * v[7] * H];
        }, d * 2.6, [-1.4 * d, -.45 * d, .45 * d, 1.4 * d], ['bg', 'vine', 'vine', 'bg']);
      });
      c.fill(m * .085, 'bg', function (x, y) { return Math.hypot(x - cx, y - cy) > R + 2.2 * d; });
      c.colorAt = function (s) {
        if (s.tag === 'in' || s.tag === 'mid') {
          var a = Math.atan2(s.y - cy, s.x - cx) - Math.PI / 8, sec = Math.floor(((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 4));
          return s.tag === 'mid' ? (sec % 2 ? 'acc2' : 'acc1') : (sec % 2 ? 'acc1' : 'bgdeep');
        }
        return null;
      };
    },
    /* two pointed lancet windows with borders, inside a wine-red field */
    lancets: function (c, o) {
      var W = c.W, H = c.H, m = Math.min(W, H), d = m * .02;
      var inArch = function (A, x, y, pad) {
        var x0 = W * A[0] + pad, x1 = W * A[1] - pad, w = W * (A[1] - A[0]), sp = H * A[2] + w * .866;
        if (x < x0 || x > x1) return false;
        if (y >= sp) return true;
        return Math.hypot(x - W * A[1], y - sp) < w - pad && Math.hypot(x - W * A[0], y - sp) < w - pad;
      };
      o.arches.forEach(function (A) {
        var x0 = W * A[0], x1 = W * A[1], w = x1 - x0, sp = H * A[2] + w * .866, bot = H + 60;
        var fn = function (t) {
          var q;
          if (t < .3) { q = t / .3; return [x0, bot + (sp - bot) * q]; }
          if (t < .5) { q = Math.PI - (t - .3) / .2 * (Math.PI / 3); return [x1 + w * Math.cos(q), sp - w * Math.sin(q)]; }
          if (t < .7) { q = Math.PI / 3 - (t - .5) / .2 * (Math.PI / 3); return [x0 + w * Math.cos(q), sp - w * Math.sin(q)]; }
          q = (t - .7) / .3; return [x1, sp + (bot - sp) * q];
        };
        c.curve(fn, d * 2.2, [-1.5 * d, -.5 * d, .5 * d, 1.5 * d], ['win', 'frame', 'frame', 'bg']);
        var mx = (x0 + x1) / 2, my = sp + w * .2, rr = w * .3;
        c.circle(mx, my, rr, d * 1.8, [-.55 * d, .55 * d], ['roundel', 'win']);
        c.fill(d * 1.6, 'roundel', function (x, y) { return Math.hypot(x - mx, y - my) < rr - d; }, 30);
        c.fill(d * 2.5, 'win', function (x, y) { return inArch(A, x, y, 2.2 * d) && Math.hypot(x - mx, y - my) > rr + d; }, 30);
      });
      c.fill(m * .09, 'bg', function (x, y) { return !o.arches.some(function (A) { return inArch(A, x, y, -2.4 * d); }); });
      c.colorAt = function (s) {
        if (s.tag === 'win') return Math.floor(s.y / (H * .14)) % 3 === 0 ? 'acc2' : 'acc1';
        return null;
      };
    },
    /* rays falling from above with arcs across them */
    rays: function (c, o) {
      var W = c.W, H = c.H, m = Math.min(W, H), d = m * .02, ox = W * .5, oy = -H * .18, far = Math.hypot(W, H) * 1.1;
      var arcs = [.42, .7, 1.0];
      arcs.forEach(function (k, i) {
        var R = H * k;
        c.curve(function (t) { var a = Math.PI * (.08 + t * .84); return [ox + Math.cos(a) * R * 1.4, oy + Math.sin(a) * R]; }, d * 2.4, [-.6 * d, .6 * d], ['a' + i, 'a' + (i + 1)]);
      });
      for (var i = 0; i < 11; i++) {
        var a = Math.PI * (.12 + i / 10 * .76);
        (function (a) { c.curve(function (t) { var rr = H * .25 + t * far; return [ox + Math.cos(a) * rr * 1.4, oy + Math.sin(a) * rr]; }, d * 2.4, [-.6 * d, .6 * d], ['ray', 'ray']); })(a);
      }
      c.fill(m * .08, 'bg');
      c.colorAt = function (s) {
        var dx = (s.x - ox) / 1.4, dy = s.y - oy, rr = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        var ring = rr < H * .42 ? 0 : rr < H * .7 ? 1 : rr < H ? 2 : 3, ray = Math.floor((ang / Math.PI - .12) / .076);
        if (ring === 0) return ray % 2 ? 'acc1' : 'light';
        if (ring === 1) return ray % 2 ? 'bgdeep' : (ray % 4 === 0 ? 'acc2' : null);
        return null;
      };
    },
    /* quarry glazing: diamond panes with leads running both ways, coloured roundels set in */
    quarry: function (c, o) { c.quarry = true; },
    /* a rose: concentric rings and spokes */
    rose: function (c, o) {
      var W = c.W, H = c.H, m = Math.min(W, H), cx = W * o.cx, cy = H * o.cy, R = m * o.R, d = m * .02;
      [1, .72, .44, .2].forEach(function (k, i) {
        c.circle(cx, cy, R * k, d * 2.1, [-.55 * d, .55 * d], ['r' + i, 'r' + (i + 1)]);
      });
      c.circle(cx, cy, R * 1.08, d * 2.4, [-.5 * d, .5 * d], ['rim', 'bg']);
      for (var i = 0; i < 16; i++) {
        var a = i / 16 * Math.PI * 2;
        (function (a, long) { c.curve(function (t) { var rr = R * ((long ? .2 : .44) + t * (1 - (long ? .2 : .44))); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; }, d * 2.1, [-.55 * d, .55 * d], ['sp', 'sp']); })(a, i % 2 === 0);
      }
      c.fill(d * 2.2, 'r', function (x, y) { return Math.hypot(x - cx, y - cy) < R * .98; }, 30);
      c.fill(d * 2.2, 'rim', function (x, y) { var q = Math.hypot(x - cx, y - cy); return q > R * 1.02 && q < R * 1.06; }, 30);
      c.fill(m * .085, 'bg', function (x, y) { return Math.hypot(x - cx, y - cy) > R * 1.12; });
      c.colorAt = function (s) {
        var q = Math.hypot(s.x - cx, s.y - cy) / R;
        if (q > 1.13) return null;
        if (q > .99) return 'acc2';
        var a = Math.atan2(s.y - cy, s.x - cx), sec = Math.floor((a + Math.PI) / (Math.PI / 8));
        if (q < .2) return 'light';
        if (q < .44) return sec % 2 ? 'acc1' : 'bgdeep';
        if (q < .72) return sec % 2 ? 'acc3' : 'acc1';
        return sec % 2 ? 'bgdeep' : 'acc2';
      };
    }
  };

  /* ── colour per piece ── */
  function colourFor(s, c, P, f, r) {
    var role = c.colorAt ? c.colorAt(s) : null;
    if (!role) {
      if (s.tag === 'ring' || s.tag === 'frame' || s.tag === 'rim') role = s.k % 4 === 0 ? 'acc1' : 'acc2';
      else if (s.tag === 'vine') role = s.k % 3 === 0 ? 'acc3' : 'vine';
      else if (s.tag === 'roundel') role = 'acc1';
      else if (s.tag === 'core') role = 'light';
      else {
        var v = f(s.x, s.y);
        role = v > .38 ? 'patch' : v < -.45 ? 'bgdeep' : 'bg';
        if (r() < .05) role = pick(['acc1', 'acc2', 'acc3'], r);
      }
    }
    var fam = P[role] || P.bg;
    return pick(fam, r);
  }

  /* ── painting a piece of glass ── */
  var noiseTile = null;
  function noise() {
    if (noiseTile) return noiseTile;
    var c = document.createElement('canvas'); c.width = c.height = 200;
    var x = c.getContext('2d'), d = x.createImageData(200, 200), r = rng(9);
    for (var i = 0; i < d.data.length; i += 4) { var v = 128 + (r() - .5) * 70; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    // soften into blotches
    var c2 = document.createElement('canvas'); c2.width = c2.height = 200;
    var y = c2.getContext('2d'); y.filter = 'blur(1.2px)'; y.drawImage(c, 0, 0);
    noiseTile = c2;
    return c2;
  }
  function trace(g, poly, ox, oy) {
    g.beginPath(); g.moveTo(poly[0][0] - ox, poly[0][1] - oy);
    for (var i = 1; i < poly.length; i++) g.lineTo(poly[i][0] - ox, poly[i][1] - oy);
    g.closePath();
  }
  function paintGlass(g, poly, ox, oy, col, bw, bh, r, lum, cx, cy, tag) {
    trace(g, poly, ox, oy);
    g.save(); g.clip();
    // light coming through: the base colour itself glows brighter where the light is stronger
    var base = shade(col, .02 + lum * .26 + (r() - .5) * .14);
    g.fillStyle = base; g.fillRect(0, 0, bw, bh);
    // luminous core of each piece, as if lit from behind
    var hx = cx - ox + (r() - .5) * bw * .4, hy = cy - oy + (r() - .5) * bh * .4, rad = Math.max(bw, bh) * (.55 + r() * .4);
    var cg = g.createRadialGradient(hx, hy, 0, hx, hy, rad);
    cg.addColorStop(0, shade(col, .45 + lum * .4));
    cg.addColorStop(.45, base);
    cg.addColorStop(1, shade(col, -.18));
    g.globalAlpha = .9; g.fillStyle = cg; g.fillRect(0, 0, bw, bh); g.globalAlpha = 1;
    // thicker and thinner patches of glass
    g.globalCompositeOperation = 'soft-light';
    for (var i = 0; i < 3; i++) {
      var x = r() * bw, y = r() * bh, rr = (.2 + r() * .45) * Math.max(bw, bh);
      var mg = g.createRadialGradient(x, y, 0, x, y, rr), light = r() < .65;
      mg.addColorStop(0, light ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.4)');
      mg.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = mg; g.fillRect(0, 0, bw, bh);
    }
    // streaks drawn while the glass was blown
    if (r() < .55) {
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1 + r() * 2.5;
      for (var k = 0; k < 3; k++) { var sx = r() * bw; g.beginPath(); g.moveTo(sx, -5); g.bezierCurveTo(sx + (r() - .5) * bw, bh * .3, sx + (r() - .5) * bw, bh * .7, sx + (r() - .5) * bw * .5, bh + 5); g.stroke(); }
    }
    g.globalAlpha = .18; g.globalCompositeOperation = 'overlay';
    g.drawImage(noise(), -r() * 100, -r() * 100, 200 + bw, 200 + bh);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // tiny seeds (air bubbles) catching the light
    var seeds = Math.round(r() * 7);
    for (var q = 0; q < seeds; q++) {
      g.beginPath(); g.arc(r() * bw, r() * bh, .5 + r() * 1.3, 0, 6.283);
      g.fillStyle = 'rgba(255,252,240,' + (.25 + r() * .35) + ')'; g.fill();
    }
    paintDetail(g, poly, ox, oy, bw, bh, cx - ox, cy - oy, r, tag);
    // grisaille matting: brown paint wiped thin in the middle, left thicker towards the lead
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = .1 + r() * .1;
    g.drawImage(noise(), -r() * 120, -r() * 120, 240 + bw, 240 + bh);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    trace(g, poly, ox, oy);
    if ('filter' in g) g.filter = 'blur(' + Math.max(3, Math.min(bw, bh) * .08).toFixed(1) + 'px)';
    g.strokeStyle = 'rgba(40,24,10,.42)'; g.lineWidth = Math.max(8, Math.min(bw, bh) * .22); g.stroke();
    if ('filter' in g) g.filter = 'none';
    g.restore();
  }
  /* painted ornament, as glass painters traced it in brown-black enamel */
  function paintDetail(g, poly, ox, oy, bw, bh, cx, cy, r, tag) {
    var ink = 'rgba(34,20,8,', m = Math.min(bw, bh);
    if (tag === 'ring' || tag === 'frame' || tag === 'rim' || tag === 'vine') {
      // a string of pearls: light dots left clear in a painted band
      var n = Math.max(2, Math.round(Math.max(bw, bh) / (m * .45))), horiz = bw > bh;
      for (var i = 0; i < n; i++) {
        var t = (i + .5) / n, x = horiz ? t * bw : cx, y = horiz ? cy : t * bh, rr = m * .17;
        g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fillStyle = 'rgba(255,248,225,.35)'; g.fill();
        g.lineWidth = Math.max(1, rr * .35); g.strokeStyle = ink + '.6)'; g.stroke();
      }
    } else if ((tag === 'in' || tag === 'mid' || tag === 'win' || tag === 'r' || tag === 'core' || tag === 'roundel') && r() < .3) {
      // a scrolling leaf traced across the piece
      g.lineCap = 'round'; g.strokeStyle = ink + (.45 + r() * .25) + ')'; g.lineWidth = Math.max(1.2, m * .05);
      var a0 = r() * 6.28, rad = m * .26;
      g.beginPath();
      for (var k = 0; k <= 24; k++) {
        var a = a0 + k / 24 * 4.2, q = rad * (1 - k / 30);
        var px = cx + Math.cos(a) * q, py = cy + Math.sin(a) * q;
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
      g.beginPath(); g.ellipse(cx + Math.cos(a0) * rad, cy + Math.sin(a0) * rad, m * .14, m * .06, a0 + 1, 0, 6.283);
      g.fillStyle = ink + '.4)'; g.fill();
    } else if (r() < .22) {
      // diaper cross-hatching on background glass
      g.strokeStyle = ink + '.18)'; g.lineWidth = 1;
      var sp = 6 + r() * 4;
      g.beginPath();
      for (var d = -bh; d < bw + bh; d += sp) { g.moveTo(d, 0); g.lineTo(d - bh, bh); g.moveTo(d - bh, 0); g.lineTo(d, bh); }
      g.stroke();
    }
    // pitting and grime from centuries of weather
    var pits = Math.round(r() * 10);
    for (var q2 = 0; q2 < pits; q2++) { g.beginPath(); g.arc(r() * bw, r() * bh, .4 + r() * 1.1, 0, 6.283); g.fillStyle = ink + (.2 + r() * .3) + ')'; g.fill(); }
  }
  function leadLine(g, poly, ox, oy, lw) {
    trace(g, poly, ox, oy);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = '#121010'; g.lineWidth = lw; g.stroke();
    g.strokeStyle = 'rgba(160,150,140,.16)'; g.lineWidth = Math.max(1, lw * .22); g.stroke();
    // soldered joints where the leads meet
    for (var i = 0; i < poly.length; i++) {
      g.beginPath(); g.arc(poly[i][0] - ox, poly[i][1] - oy, lw * .62, 0, 6.283);
      g.fillStyle = '#2a2724'; g.fill();
      g.beginPath(); g.arc(poly[i][0] - ox - lw * .15, poly[i][1] - oy - lw * .15, lw * .22, 0, 6.283);
      g.fillStyle = 'rgba(200,190,175,.18)'; g.fill();
    }
  }

  /* ── quarry panes are built directly as diamonds ── */
  function quarryPieces(W, H, P, r) {
    var m = Math.min(W, H), sw = m * .16, sh = sw * 1.45, out = [], i, j;
    var cols = Math.ceil(W / sw) + 2, rows = Math.ceil(H / (sh / 2)) + 2;
    for (j = -1; j < rows; j++) for (i = -1; i < cols; i++) {
      var cx = i * sw + (j % 2 ? sw / 2 : 0), cy = j * sh / 2;
      var poly = [[cx, cy - sh / 2], [cx + sw / 2, cy], [cx, cy + sh / 2], [cx - sw / 2, cy]];
      var roundel = (i * 7 + j * 3) % 11 === 0;
      var role = roundel ? 'acc1' : ((i + j) % 5 === 0 ? 'patch' : 'bg');
      if (roundel) {
        // a small roundel set into the diamond: ring + four little pieces
        var rr = sw * .26;
        out.push({ poly: poly, col: pick(P.bgdeep, r), hole: [cx, cy, rr], tag: 'bg' });
        var ring = [];
        for (var a = 0; a < 24; a++) ring.push([cx + Math.cos(a / 24 * 6.283) * rr, cy + Math.sin(a / 24 * 6.283) * rr]);
        for (var q = 0; q < 4; q++) {
          var seg = [[cx, cy]];
          for (var a2 = q * 6; a2 <= q * 6 + 6; a2++) seg.push(ring[a2 % 24]);
          out.push({ poly: seg, col: pick(q % 2 ? P.acc1 : P.acc2, r), tag: 'roundel' });
        }
      } else out.push({ poly: poly, col: pick(P[role], r), tag: 'bg' });
    }
    return out;
  }

  /* ── build a whole pane of glass ── */
  function design(W, H, P, seed) {
    var r = rng(seed), f = field(r, 1 / Math.max(W, H) * 5);
    var comp = COMPS[P.comp], c = new Comp(W, H, r);
    comp(c, P);
    var items = [];
    if (c.quarry) items = quarryPieces(W, H, P, r);
    else {
      var polys = voronoi(c.s, W, H);
      polys.forEach(function (poly, i) {
        if (poly.length < 3) return;
        items.push({ poly: poly, col: colourFor(c.s[i], c, P, f, r), tag: c.s[i].tag });
      });
    }
    return { items: items, r: r };
  }

  /* render pieces into sprites (for animation) */
  function sprites(W, H, P, seed, DPR) {
    var d = design(W, H, P, seed), r = d.r, lw = Math.max(5, Math.min(W, H) / 125), out = [];
    var L = P.lightAt || [.78, .2], lx = W * L[0], ly = H * L[1], far = Math.hypot(W, H) * .85;
    d.items.forEach(function (it) {
      var poly = it.poly;
      var xs = poly.map(function (p) { return p[0]; }), ys = poly.map(function (p) { return p[1]; });
      var bx = Math.floor(Math.min.apply(null, xs) - lw), by = Math.floor(Math.min.apply(null, ys) - lw);
      var bw = Math.ceil(Math.max.apply(null, xs) + lw) - bx, bh = Math.ceil(Math.max.apply(null, ys) + lw) - by;
      if (bw < 3 || bh < 3 || bx > W + 50 || by > H + 50 || bx + bw < -50 || by + bh < -50) return;
      var cnv = document.createElement('canvas');
      cnv.width = Math.ceil(bw * DPR); cnv.height = Math.ceil(bh * DPR);
      var g = cnv.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
      var c0 = centroid(poly), lum = Math.max(.15, 1 - Math.hypot(c0[0] - lx, c0[1] - ly) / far);
      paintGlass(g, poly, bx, by, it.col, bw, bh, r, lum, c0[0], c0[1], it.tag);
      if (it.hole) { /* roundel ring */ g.beginPath(); g.arc(it.hole[0] - bx, it.hole[1] - by, it.hole[2], 0, 6.283); g.strokeStyle = '#0c0a08'; g.lineWidth = lw; g.stroke(); }
      leadLine(g, poly, bx, by, lw);
      var c = centroid(poly);
      out.push({ sp: cnv, x: bx, y: by, w: bw, h: bh, cx: c[0], cy: c[1], poly: poly, rot: (r() - .5) * .12, jit: r() });
    });
    return { pieces: out, lw: lw };
  }

  /* a single framed window drawn into a canvas (used for the tale windows) */
  function panel(cnv, P, seed) {
    var DPR = Math.min(window.devicePixelRatio || 1, 2), W = cnv.clientWidth, H = cnv.clientHeight;
    if (!W || !H) return;
    cnv.width = Math.round(W * DPR); cnv.height = Math.round(H * DPR);
    var g = cnv.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
    var arch = function () {
      g.beginPath();
      g.moveTo(0, H); g.lineTo(0, W * .62);
      g.quadraticCurveTo(0, W * .1, W / 2, 0); g.quadraticCurveTo(W, W * .1, W, W * .62);
      g.lineTo(W, H); g.closePath();
    };
    var d = design(W, H, P, seed), r = d.r, lw = Math.max(3, W / 55);
    g.save(); arch(); g.clip();
    g.fillStyle = '#0c0a08'; g.fillRect(0, 0, W, H);
    d.items.forEach(function (it) {
      var poly = it.poly;
      var c0 = centroid(poly), lum = Math.max(.25, 1 - Math.hypot(c0[0] - W * .5, c0[1] - H * .35) / (H * .9));
      g.save(); paintGlass(g, poly, 0, 0, it.col, W, H, r, lum, c0[0], c0[1], it.tag); g.restore();
    });
    d.items.forEach(function (it) { leadLine(g, it.poly, 0, 0, lw); });
    // iron saddle bars
    g.fillStyle = '#0c0a08';
    [.34, .58, .8].forEach(function (k) { g.fillRect(0, H * k - lw * .6, W, lw * 1.2); });
    g.restore();
    // stone frame
    arch(); g.lineWidth = lw * 2.6; g.strokeStyle = '#2a241d'; g.stroke();
    arch(); g.lineWidth = lw * .8; g.strokeStyle = '#0c0a08'; g.stroke();
  }

  window.Glass = { sprites: sprites, panel: panel, rng: rng, shade: shade, rgba: rgba };
})();
