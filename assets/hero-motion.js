(() => {
  "use strict";
  const hero = document.getElementById("home");
  const canvas = document.getElementById("heroCanvas");
  const toggle = document.getElementById("heroMotionToggle");
  const touchHint = document.getElementById("touchHint");
  const ctx = canvas?.getContext("2d");
  if (!ctx || !hero || !toggle) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const preferenceKey = "portfolio.hero-motion-paused";
  const tau = Math.PI * 2;
  const colors = { blue: "#428faa", gold: "#e9b744", teal: "#478f89",
    mint: "#d6e7dd", pale: "#e5eee6", butter: "#f3e4b5" };
  const waves = [
    { x: 120, y: 55, length: 92, wavelength: 62, amplitude: 7, color: "blue", angle: -.12, rate: .70, phase: .3 },
    { x: 438, y: 53, length: 78, wavelength: 58, amplitude: 6.5, color: "gold", angle: .08, rate: -.58, phase: 2.5 },
    { x: 35, y: 220, length: 72, wavelength: 60, amplitude: 7, color: "gold", angle: 1.25, rate: .47, phase: 4.9 },
    { x: 43, y: 395, length: 74, wavelength: 56, amplitude: 6, color: "blue", angle: 1.42, rate: -.80, phase: 1.4 },
    { x: 566, y: 238, length: 86, wavelength: 66, amplitude: 7, color: "blue", angle: 1.42, rate: .55, phase: 3.1 },
    { x: 557, y: 415, length: 62, wavelength: 48, amplitude: 7, color: "gold", angle: 1.2, rate: -.63, phase: 5.2 },
    { x: 160, y: 552, length: 88, wavelength: 56, amplitude: 6, color: "gold", angle: -.13, rate: -.44, phase: 1.9 },
    { x: 410, y: 550, length: 102, wavelength: 69, amplitude: 6.5, color: "blue", angle: .08, rate: .64, phase: 4.3 },
  ];
  const dots = [
    [60, 128, 0], [235, 35, 1], [340, 47, 2], [535, 130, 0], [568, 330, 1],
    [518, 509, 2], [290, 570, 0], [80, 498, 1], [30, 312, 2],
  ];
  let paused = false;
  try { paused = localStorage.getItem(preferenceKey) === "true"; } catch {}
  let frame = 0, elapsed = 3.2, lastPaint = 0, onscreen = false;
  let touchStart = null, tap = null, layoutKey = "";
  let width = 0, height = 0, dpr = 1, scale = 1, offsetX = 0, offsetY = 0;
  const inkWidth = 5.5;

  function blob(x, y, rx, ry, color, seed, rotation) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const angle = i / 100 * tau;
      const radius = 1 + .065 * Math.sin(angle * 3 + seed + elapsed * .1) + .035 * Math.cos(angle * 5 - seed);
      const px = Math.cos(angle) * rx * radius, py = Math.sin(angle) * ry * radius;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
  }

  function brush(points, color, seed) {
    const left = [], right = [];
    points.forEach((point, i) => {
      const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
      const angle = Math.atan2(next[1] - previous[1], next[0] - previous[0]);
      const radius = inkWidth * .5 * (1 + Math.sin(i * .33 + seed) * .065 + Math.sin(i * .91 + seed) * .025);
      left.push([point[0] - Math.sin(angle) * radius, point[1] + Math.cos(angle) * radius]);
      right.push([point[0] + Math.sin(angle) * radius, point[1] - Math.cos(angle) * radius]);
    });
    ctx.save(); ctx.globalAlpha = .93; ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(...left[0]); left.slice(1).forEach(point => ctx.lineTo(...point));
    right.reverse().forEach(point => ctx.lineTo(...point)); ctx.closePath(); ctx.fill();
    for (const point of [points[0], points.at(-1)]) {
      ctx.beginPath(); ctx.arc(...point, inkWidth * .48, 0, tau); ctx.fill();
    }
    ctx.restore();
  }

  function drawWave(wave) {
    const nudge = tap ? Math.cos((elapsed - tap.time) * 9 + wave.phase) * Math.exp(-(elapsed - tap.time) * 2.8) : 0;
    const x = wave.x + Math.sin(elapsed * (.13 + Math.abs(wave.rate) * .07) + wave.phase) * 6;
    const y = wave.y + Math.cos(elapsed * (.11 + Math.abs(wave.rate) * .09) + wave.phase * .8) * 5;
    const tilt = Math.sin(elapsed * (.10 + Math.abs(wave.rate) * .04) + wave.phase) * .035;
    const points = [];
    for (let i = 0; i <= 60; i++) {
      const px = (i / 60 - .5) * wave.length;
      points.push([px, Math.sin(px * tau / wave.wavelength + elapsed * wave.rate + wave.phase) * (wave.amplitude + nudge * 9) +
        Math.sin(px * .09 + wave.phase) * .5]);
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(wave.angle + tilt);
    brush(points, colors[wave.color], wave.phase); ctx.restore();
  }

  function draw() {
    if (!width || !height) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    ctx.save(); ctx.translate(offsetX, offsetY); ctx.scale(scale, scale);
    blob(446, 140, 112, 85, colors.butter, 1, .18);
    blob(153, 452, 115, 71, colors.mint, 2, -.08);
    blob(489, 407, 61, 102, colors.pale, 4, .15);
    waves.forEach(drawWave);
    dots.forEach(([x, y, color], i) => {
      ctx.fillStyle = [colors.blue, colors.gold, colors.teal][color];
      ctx.beginPath();
      ctx.arc(x + Math.sin(elapsed * .27 + i * 1.71) * 5, y + Math.cos(elapsed * .23 + i * .93) * 6, inkWidth / 2, 0, tau);
      ctx.fill();
    });
    ctx.restore();
    if (tap) {
      const age = elapsed - tap.time;
      if (age > 1.4) tap = null;
      else {
        ctx.save(); ctx.globalAlpha = .8 * (1 - age / 1.4);
        for (let i = 0; i < 6; i++) {
          const angle = i / 6 * tau + .2, radius = (20 + age * 35) * scale;
          ctx.fillStyle = i % 2 ? colors.gold : colors.blue;
          ctx.beginPath(); ctx.arc(tap.x + Math.cos(angle) * radius, tap.y + Math.sin(angle) * radius, inkWidth * scale / 2, 0, tau); ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  function measure() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    if (!width || !height) return;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    const nextKey = [width, height, dpr].join(',');
    if (nextKey === layoutKey) return;
    layoutKey = nextKey;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    // Fit the complete composition, including its quiet edge, at every viewport size.
    scale = Math.min(width, height) / 600;
    offsetX = (width - 600 * scale) / 2;
    offsetY = (height - 600 * scale) / 2;
    draw();
  }

  function canAnimate() {
    return !paused && !reduced.matches && onscreen && !document.hidden && !document.body.classList.contains("locked");
  }

  function label() {
    const ja = document.documentElement.lang.startsWith("ja");
    toggle.textContent = paused ? (ja ? "背景の動きを再生" : "Play background") : (ja ? "背景の動きを止める" : "Pause background");
    toggle.hidden = reduced.matches;
    if (touchHint) touchHint.hidden = paused || reduced.matches;
  }

  function tick(now) {
    frame = 0;
    if (!canAnimate()) return;
    if (!lastPaint || now - lastPaint >= 1000 / 30) {
      elapsed += (lastPaint ? Math.min((now - lastPaint) / 1000, .08) : 0) * .8;
      lastPaint = now; draw();
    }
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    label();
    document.documentElement.dataset.motionPaused = String(paused);
    if (!canAnimate()) { touchStart = null; tap = null; }
    if (canAnimate() && !frame) { lastPaint = 0; frame = requestAnimationFrame(tick); }
    else if (!canAnimate() && frame) { cancelAnimationFrame(frame); frame = 0; lastPaint = 0; }
  }

  toggle.addEventListener("click", () => {
    paused = !paused;
    try { localStorage.setItem(preferenceKey, String(paused)); } catch {}
    sync();
  });
  hero.addEventListener("pointerdown", event => {
    touchStart = null;
    if (event.pointerType !== "touch" || !event.isPrimary || !canAnimate() || event.target.closest("a,button,input")) return;
    touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
  }, { passive: true });
  hero.addEventListener("pointermove", event => {
    if (touchStart && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 10) touchStart = null;
  }, { passive: true });
  hero.addEventListener("pointercancel", () => { touchStart = null; }, { passive: true });
  hero.addEventListener("pointerup", event => {
    const start = touchStart; touchStart = null;
    if (!start || start.id !== event.pointerId || !canAnimate() || event.timeStamp - start.time > 450 ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
    const bounds = canvas.getBoundingClientRect();
    const inset = 74 * scale;
    tap = { x: Math.max(inset, Math.min(width - inset, event.clientX - bounds.left)),
      y: Math.max(inset, Math.min(height - inset, event.clientY - bounds.top)), time: elapsed };
    draw();
  }, { passive: true });
  reduced.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  new IntersectionObserver(entries => { onscreen = entries[0].isIntersecting; sync(); }).observe(hero);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  const resize = new ResizeObserver(measure);
  resize.observe(canvas);
  addEventListener("resize", measure);
  measure(); sync();
})();
