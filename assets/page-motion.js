(() => {
  "use strict";
  const track = document.getElementById("track"), cursor = document.getElementById("cur");
  if (!track || !cursor) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  let visible = false, frame = 0, lastPaint = 0, position = 0, velocity = 0, previousY = scrollY;
  let pointerFrame = 0, mouse = null;
  const allowed = () => !reduced.matches && !document.hidden &&
    !document.body.classList.contains("locked") && document.documentElement.dataset.motionPaused !== "true";

  function resetPointer() {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0; mouse = null; cursor.style.opacity = "0";
    document.querySelectorAll(".kin .l").forEach(letter => { letter.style.transform = ""; });
  }
  function tick(now) {
    frame = 0;
    if (!allowed() || !visible) return;
    if (!lastPaint || now - lastPaint >= 1000 / 30) {
      const delta = lastPaint ? Math.min((now - lastPaint) / 1000, .08) : 0;
      lastPaint = now;
      const width = track.scrollWidth / 3;
      position -= (24 + Math.abs(velocity) * 30) * delta;
      velocity *= Math.exp(-delta * 6);
      if (width) position = -((-position) % width);
      track.style.transform = `translateX(${position.toFixed(1)}px) skewX(${(-velocity * .32).toFixed(2)}deg)`;
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (allowed() && visible) {
      if (!frame) { lastPaint = 0; frame = requestAnimationFrame(tick); }
    } else if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (!allowed() || !fine.matches) resetPointer();
    previousY = scrollY;
  }
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(track.parentElement);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion-paused"] });
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);
  fine.addEventListener("change", sync);
  addEventListener("scroll", () => {
    if (allowed() && visible) velocity = Math.min(16, velocity + Math.abs(scrollY - previousY) * .025);
    previousY = scrollY; resetPointer();
  }, { passive: true });
  addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse" || !fine.matches || !allowed()) return;
    mouse = { x: event.clientX, y: event.clientY };
    cursor.style.opacity = ".35";
    cursor.style.transform = `translate(${mouse.x}px,${mouse.y}px) translate(-50%,-50%)`;
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!mouse || !allowed() || !fine.matches) return;
      document.querySelectorAll(".kin .l").forEach(letter => {
        const bounds = letter.getBoundingClientRect();
        const distance = Math.hypot(mouse.x - bounds.left - bounds.width / 2, mouse.y - bounds.top - bounds.height / 2);
        const amount = Math.max(0, 1 - distance / 300);
        letter.style.transform = amount ? `translateY(${-amount * 18}px) scaleY(${1 + amount * .14})` : "";
      });
    });
  }, { passive: true });
  document.addEventListener("pointerover", event => {
    if (event.pointerType === "mouse" && fine.matches)
      cursor.classList.toggle("big", !!event.target.closest("a,button,input"));
  });
  document.addEventListener("pointerout", event => { if (!event.relatedTarget) resetPointer(); });
  sync();
})();
