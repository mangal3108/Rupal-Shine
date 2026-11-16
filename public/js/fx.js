// Landing-page motion: 3D tilt, gold dust, scroll journey, bottle spin viewer, reveals.
// Everything here is decoration — the page works fully without it.
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- reveal on scroll ---------- */
  const reveals = $$('.reveal');
  if (reduce || !('IntersectionObserver' in window)) reveals.forEach(el => el.classList.add('in'));
  else {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15 });
    reveals.forEach(el => io.observe(el));
  }

  /* ---------- count-up numbers ---------- */
  $$('[data-count]').forEach(el => {
    const m = /^(\D*)(\d+)(.*)$/.exec(el.dataset.count);
    if (!m || reduce || !('IntersectionObserver' in window)) return;
    const target = +m[2];
    el.textContent = m[1] + '0' + m[3];
    new IntersectionObserver((es, io) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1400;
      const tick = t => {
        const p = clamp((t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = m[1] + Math.round(target * e) + m[3];
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 }).observe(el);
  });

  if (reduce) return; // the rest is pure motion

  /* ---------- run a frame loop only while an element is on screen ---------- */
  function whileVisible(el, frame) {
    let on = false, raf = 0;
    const loop = t => { if (!on) return; frame(t); raf = requestAnimationFrame(loop); };
    new IntersectionObserver(es => {
      const vis = es[0].isIntersecting;
      if (vis && !on) { on = true; raf = requestAnimationFrame(loop); }
      else if (!vis) { on = false; cancelAnimationFrame(raf); }
    }).observe(el);
  }

  /* ---------- hero: bottle tilts toward the pointer ---------- */
  const hero = document.querySelector('[data-hero]');
  const tiltImg = hero && hero.querySelector('[data-tilt]');
  if (tiltImg) {
    let tx = 0, ty = 0, cx = 0, cy = 0;
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
    });
    hero.addEventListener('pointerleave', () => { tx = ty = 0; });
    whileVisible(hero, t => {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      const bob = Math.sin(t / 1400) * 8;
      tiltImg.style.transform = `perspective(1100px) translate3d(${cx * -26}px, ${bob + cy * -18}px, 0) rotateY(${cx * 16}deg) rotateX(${cy * -12}deg) scale(1.03)`;
    });
  }

  /* ---------- gold dust: soft particles with depth that drift and avoid the pointer ---------- */
  $$('[data-dust]').forEach(cv => {
    const host = cv.parentElement, ctx = cv.getContext('2d');
    const dark = cv.dataset.dust === 'dark';
    let w = 0, h = 0, mx = -999, my = -999;
    const N = window.innerWidth < 700 ? 26 : 54;
    const parts = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), z: 0.25 + Math.random() * 0.75, s: Math.random() * 6.28, vx: 0, vy: 0 }));
    const size = () => {
      const r = host.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height; cv.width = w * d; cv.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    size(); window.addEventListener('resize', size);
    host.addEventListener('pointermove', e => { const r = host.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    host.addEventListener('pointerleave', () => { mx = my = -999; });
    whileVisible(host, t => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= 0.00035 * p.z; p.x += Math.sin(t / 2600 + p.s) * 0.00018;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        let px = p.x * w + p.vx, py = p.y * h + p.vy;
        const dx = px - mx, dy = py - my, dist = Math.hypot(dx, dy);
        if (dist < 130) { const f = (130 - dist) / 130 * 2.2 * p.z; p.vx += dx / (dist || 1) * f; p.vy += dy / (dist || 1) * f; }
        p.vx *= 0.94; p.vy *= 0.94;
        const r = 1.5 + p.z * (dark ? 5 : 4), tw = 0.55 + 0.45 * Math.sin(t / 900 + p.s);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
        g.addColorStop(0, `rgba(${dark ? '241,214,140' : '195,154,53'},${(dark ? 0.75 : 0.45) * p.z * tw})`);
        g.addColorStop(1, 'rgba(195,154,53,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r * 3, 0, 6.2832); ctx.fill();
      }
    });
  });

  /* ---------- journey: scroll drives a 3D scene (herbs orbit, then flow into the bottle) ---------- */
  const journey = document.querySelector('[data-journey]');
  if (journey) {
    const world = journey.querySelector('[data-jworld]'), spot = journey.querySelector('[data-jspot]');
    const ring = journey.querySelector('.j-ring');
    const orbs = $$('[data-jorb]', journey), stepEls = $$('[data-jstep]', journey), dots = $$('.j-progress li', journey);
    const scene = journey.querySelector('.journey-scene');
    const n = stepEls.length;
    let mx = 0, my = 0, cx = 0, cy = 0, shown = -1, ps = 0;
    journey.addEventListener('pointermove', e => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; });

    whileVisible(journey, t => {
      const r = journey.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - window.innerHeight));
      ps += (p - ps) * 0.09; // eased scroll position
      const step = Math.min(n - 1, Math.floor(p * n + 0.02));
      if (step !== shown) {
        shown = step;
        stepEls.forEach((el, i) => el.classList.toggle('on', i === step));
        dots.forEach((el, i) => el.classList.toggle('on', i <= step));
      }
      cx += (mx - cx) * 0.05; cy += (my - cy) * 0.05;
      world.style.transform = `rotateY(${cx * 14}deg) rotateX(${cy * -10}deg)`;

      const sr = scene.getBoundingClientRect(), R = Math.min(sr.width, sr.height) * 0.43;
      const spread = 1 - smooth(0.3, 0.72, ps);          // 1 = wide orbit, 0 = inside the bottle
      const grow = smooth(0.12, 0.8, ps);
      orbs.forEach((el, i) => {
        const a = i / orbs.length * 6.2832 + ps * 7 + t / 9000;
        const z = Math.sin(a), rad = R * (0.25 + 0.75 * spread) * spread ** 0.35;
        const x = Math.cos(a) * rad, y = z * rad * 0.26 + Math.sin(a * 2 + i) * R * 0.1 * spread;
        const sc = (0.62 + 0.38 * (z + 1) / 2) * (0.3 + 0.7 * spread);
        el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${sc})`;
        el.style.zIndex = z > 0 ? 3 : 1;
        el.style.opacity = clamp(spread * 4) * (0.55 + 0.45 * (z + 1) / 2);
        el.classList.toggle('named', spread > 0.9 && z > 0.55);
      });
      const pulse = 1 + Math.sin(t / 700) * 0.012;
      spot.style.transform = `translateY(${Math.sin(t / 1600) * 8}px) scale(${(0.72 + 0.34 * grow) * pulse})`;
      spot.style.setProperty('--glow', (0.25 + 0.75 * grow).toFixed(3));
      ring.style.transform = `rotateX(74deg) rotateZ(${t / 60 + ps * 300}deg) scale(${0.6 + spread * 0.55})`;
      ring.style.opacity = 0.15 + 0.5 * spread;
    });
  }

  /* ---------- bottle viewer: drag (or arrows) to turn it in 3D ---------- */
  $$('[data-spin]').forEach(box => {
    const card = box.querySelector('[data-spin-card]'), imgs = $$('img', card), n = imgs.length;
    let angle = 0, target = 0, dragging = false, startX = 0, startA = 0, touched = false, face = -1;
    const show = () => {
      const k = Math.round(angle / 180);
      const idx = ((k % n) + n) % n;
      if (idx !== face) { face = idx; imgs.forEach((im, i) => { im.hidden = i !== idx; }); }
      card.style.transform = `rotateY(${angle - k * 180}deg)`;
    };
    box.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      dragging = touched = true; startX = e.clientX; startA = target; box.setPointerCapture(e.pointerId); box.classList.add('grab');
    });
    box.addEventListener('pointermove', e => { if (dragging) target = startA + (e.clientX - startX) * 0.7; });
    const end = () => { if (!dragging) return; dragging = false; box.classList.remove('grab'); target = Math.round(target / 180) * 180; };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
    box.addEventListener('click', e => { const b = e.target.closest('[data-spin-step]'); if (b) { touched = true; target = Math.round(target / 180) * 180 + 180 * +b.dataset.spinStep; } });
    box.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); touched = true; target = Math.round(target / 180) * 180 + (e.key === 'ArrowRight' ? 180 : -180);
    });
    whileVisible(box, t => {
      const idle = touched ? 0 : Math.sin(t / 1100) * 14; // gentle sway invites a drag
      angle += (target + idle - angle) * (dragging ? 0.35 : 0.09);
      show();
    });
  });

  /* ---------- product cards lean toward the pointer ---------- */
  if (window.matchMedia('(hover: hover)').matches) $$('.card').forEach(c => {
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${y * -8}deg) translateY(-4px)`;
    });
    c.addEventListener('pointerleave', () => { c.style.transform = ''; });
  });
})();
