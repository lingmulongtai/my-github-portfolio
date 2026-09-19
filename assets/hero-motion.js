(() => {
  "use strict";
  const hero = document.getElementById("home");
  const canvas = document.getElementById("heroCanvas");
  const toggle = document.getElementById("heroMotionToggle");
  const portrait = hero?.querySelector(".hero-portrait img");
  const copy = hero?.querySelector(".hero-copy");
  const ctx = canvas?.getContext("2d");
  if (!ctx || !portrait || !copy || !toggle) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const preferenceKey = "portfolio.hero-motion-paused";
  const mask = document.createElement("canvas");
  const maskCtx = mask.getContext("2d");
  const tau = Math.PI * 2;
  const colors = { blue: "#428faa", gold: "#e9b744", teal: "#478f89",
    mint: "#d6e7dd", pale: "#e5eee6", butter: "#f3e4b5" };
  const waves = [
    { x: 90, y: 439, length: 145, wavelength: 70, amplitude: 7, color: "blue", angle: -.12, rate: .70, phase: .3 },
    { x: 277, y: 464, length: 90, wavelength: 58, amplitude: 6.5, color: "gold", angle: .08, rate: -.58, phase: 2.5 },
    { x: 448, y: 434, length: 125, wavelength: 66, amplitude: 8, color: "blue", angle: -.07, rate: .47, phase: 4.9 },
    { x: 646, y: 467, length: 97, wavelength: 56, amplitude: 6, color: "gold", angle: .08, rate: -.80, phase: 1.4 },
    { x: 866, y: 443, length: 134, wavelength: 74, amplitude: 8, color: "blue", angle: .05, rate: .55, phase: 3.1 },
    { x: 987, y: 392, length: 62, wavelength: 48, amplitude: 7, color: "gold", angle: 1.2, rate: -.63, phase: 5.2 },
    { x: 502, y: 48, length: 75, wavelength: 56, amplitude: 6, color: "gold", angle: -.13, rate: -.44, phase: 1.9 },
    { x: 652, y: 32, length: 112, wavelength: 69, amplitude: 6.5, color: "blue", angle: .08, rate: .64, phase: 4.3 },
    { x: 872, y: 41, length: 78, wavelength: 59, amplitude: 6, color: "gold", angle: -.12, rate: -.72, phase: .8 },
    { x: 980, y: 245, length: 106, wavelength: 64, amplitude: 7.5, color: "blue", angle: 1.42, rate: .52, phase: 3.7 },
  ];
  const dots = [
    [127, 47, 0], [343, 31, 1], [495, 86, 2], [570, 137, 0], [625, 67, 1], [969, 172, 2],
    [972, 257, 0], [953, 343, 1], [784, 423, 2], [596, 392, 0], [489, 463, 1], [369, 450, 2],
    [255, 476, 0], [109, 405, 1], [34, 362, 2], [664, 422, 0], [866, 34, 1], [410, 52, 2],
  ];
  let paused = false;
  try { paused = localStorage.getItem(preferenceKey) === "true"; } catch {}
  let frame = 0, elapsed = 3.2, lastPaint = 0, onscreen = false;
  let width = 0, height = 0, dpr = 1, scale = 1, offsetX = 0, offsetY = 0, inkWidth = 5.5, stacked = false;

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
    const x = wave.x + Math.sin(elapsed * (.13 + Math.abs(wave.rate) * .07) + wave.phase) * 6;
    const y = wave.y + Math.cos(elapsed * (.11 + Math.abs(wave.rate) * .09) + wave.phase * .8) * 5;
    const tilt = Math.sin(elapsed * (.10 + Math.abs(wave.rate) * .04) + wave.phase) * .035;
    const points = [];
    for (let i = 0; i <= 60; i++) {
      const px = (i / 60 - .5) * wave.length;
      points.push([px, Math.sin(px * tau / wave.wavelength + elapsed * wave.rate + wave.phase) * wave.amplitude +
        Math.sin(px * .09 + wave.phase) * .5]);
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(wave.angle + tilt);
    brush(points, colors[wave.color], wave.phase); ctx.restore();
  }

  function draw() {
    if (!width || !height) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    if (stacked) blob(width + 15, 105, 65, 37, colors.butter, 0, 0);
    ctx.save(); ctx.translate(offsetX, offsetY); ctx.scale(scale, scale);
    blob(920, 70, 145, 100, colors.butter, 1, .18);
    blob(80, 498, 270, 91, colors.mint, 2, -.08);
    blob(1000, 376, 76, 165, colors.pale, 4, .15);
    waves.forEach(drawWave);
    dots.forEach(([x, y, color], i) => {
      ctx.fillStyle = [colors.blue, colors.gold, colors.teal][color];
      ctx.beginPath();
      ctx.arc(x + Math.sin(elapsed * .27 + i * 1.71) * 5, y + Math.cos(elapsed * .23 + i * .93) * 6, inkWidth / 2, 0, tau);
      ctx.fill();
    });
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(mask, 0, 0, width, height); ctx.restore();
  }

  function measure() {
    const bounds = canvas.getBoundingClientRect(), image = portrait.getBoundingClientRect(), text = copy.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    if (!width || !height || !image.width) return;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = mask.width = Math.round(width * dpr);
    canvas.height = mask.height = Math.round(height * dpr);
    stacked = image.top >= text.bottom;
    scale = stacked ? image.width / 410 : width / 1024;
    offsetX = image.left - bounds.left + image.width * .5 - 790 * scale;
    offsetY = image.top - bounds.top + image.height * .5 - 241 * scale;
    inkWidth = 5.5 * Math.min(1, image.width / 410 / scale);

    // Cache the mask between layout changes so text and the face stay clear without a per-frame blur.
    maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    maskCtx.save(); maskCtx.fillStyle = "black"; maskCtx.shadowColor = "black"; maskCtx.shadowBlur = 20 * dpr;
    maskCtx.fillRect(text.left - bounds.left - 4, text.top - bounds.top - 4, text.width + 8, text.height + 8);
    maskCtx.restore();
    const x = image.left - bounds.left + image.width * .54, y = image.top - bounds.top + image.height * .46;
    const radius = image.width * .37;
    const face = maskCtx.createRadialGradient(x, y, radius * .34, x, y, radius);
    face.addColorStop(0, "rgba(0,0,0,.96)"); face.addColorStop(.62, "rgba(0,0,0,.9)"); face.addColorStop(1, "rgba(0,0,0,0)");
    maskCtx.fillStyle = face; maskCtx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    draw();
  }

  function canAnimate() {
    return !paused && !reduced.matches && onscreen && !document.hidden && !document.body.classList.contains("locked");
  }

  function label() {
    const ja = document.documentElement.lang.startsWith("ja");
    toggle.textContent = paused ? (ja ? "背景の動きを再生" : "Play background") : (ja ? "背景の動きを止める" : "Pause background");
    toggle.hidden = reduced.matches;
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
    if (canAnimate() && !frame) { lastPaint = 0; frame = requestAnimationFrame(tick); }
    else if (!canAnimate() && frame) { cancelAnimationFrame(frame); frame = 0; lastPaint = 0; }
  }

  toggle.addEventListener("click", () => {
    paused = !paused;
    try { localStorage.setItem(preferenceKey, String(paused)); } catch {}
    sync();
  });
  reduced.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  new IntersectionObserver(entries => { onscreen = entries[0].isIntersecting; sync(); }).observe(hero);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  const resize = new ResizeObserver(measure);
  [hero, portrait, copy].forEach(element => resize.observe(element));
  addEventListener("resize", measure);
  measure(); sync();
})();
