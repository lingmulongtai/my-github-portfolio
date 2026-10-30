/* Sketchbook motion layer: smooth scrolling, entrances and reflow animation.
   Runs only when GSAP/Lenis loaded and the visitor has not asked for reduced motion;
   the page is complete and usable without it. */
(() => {
  "use strict";
  const { gsap, ScrollTrigger, Flip, Lenis } = window;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger, ...(Flip ? [Flip] : []));

  const $ = selector => document.querySelector(selector);
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const seen = new Set(); // flip ids that already played their entrance
  const ambient = [];      // looping tweens that obey the "pause background" toggle
  const syncAmbient = () => {
    const paused = document.documentElement.dataset.motionPaused === "true" || document.hidden;
    ambient.forEach(tween => paused ? tween.pause() : tween.resume());
  };
  new MutationObserver(syncAmbient).observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion-paused"] });
  document.addEventListener("visibilitychange", syncAmbient);

  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    let active = true;
    /* ---------- smooth scroll ---------- */
    let lenis = null;
    let raf, lockWatch, onAnchorClick;
    if (Lenis) {
      lenis = new Lenis({ lerp: .1, wheelMultiplier: 1 });
      lenis.on("scroll", ScrollTrigger.update);
      raf = time => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      // dialogs pin the body; pause smoothing while they are open
      lockWatch = new MutationObserver(() =>
        document.body.classList.contains("locked") ? lenis.stop() : lenis.start());
      lockWatch.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      onAnchorClick = event => {
        const link = event.target.closest('a[href^="#"]');
        const target = link && link.getAttribute("href").length > 1 && document.querySelector(link.getAttribute("href"));
        if (!target || event.defaultPrevented || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-height")) || 64;
        lenis.scrollTo(target, { offset: -(nav + 12), duration: 1.4 });
        history.pushState(null, "", link.getAttribute("href"));
      };
      document.addEventListener("click", onAnchorClick);
    }

    /* ---------- hero ---------- */
    const heroIn = () => {
      const letters = gsap.utils.toArray("#kin .l");
      if (!letters.length || $("#kin").dataset.played) return;
      $("#kin").dataset.played = "1";
      gsap.timeline({ defaults: { overwrite: "auto" } })
        .from(letters, { yPercent: 115, rotation: () => gsap.utils.random(-22, 22), scaleY: .6, autoAlpha: 0,
          duration: .9, ease: "back.out(2.2)", stagger: .045, clearProps: "transform,opacity,visibility" })
        .from(".hero-portrait", { y: 40, rotation: -5, scale: .92, autoAlpha: 0, duration: 1.1, ease: "back.out(1.5)" }, .15)
        .from(["#heroMeta > span", "#heroSub", ".hero-actions a"], { y: 18, autoAlpha: 0, duration: .7,
          ease: "power3.out", stagger: .05, clearProps: "transform,opacity,visibility" }, .35);
    };
    // portrait layers drift toward the pointer at different depths
    const visual = $(".hero-visual");
    let onPointerMove;
    if (visual) {
      const layers = [[visual.querySelector("img"), 10], [visual.querySelector(".hero-art"), 22]]
        .filter(([el]) => el).map(([el, depth]) => [gsap.quickTo(el, "x", { duration: .9, ease: "power3" }),
          gsap.quickTo(el, "y", { duration: .9, ease: "power3" }), depth]);
      onPointerMove = event => {
        if (event.pointerType !== "mouse" || !fine.matches) return;
        const box = visual.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - .5, y = (event.clientY - box.top) / box.height - .5;
        layers.forEach(([qx, qy, depth]) => { qx(x * depth); qy(y * depth); });
      };
      $("#home").addEventListener("pointermove", onPointerMove);
      gsap.to(".hero-portrait", { yPercent: -8, ease: "none",
        scrollTrigger: { trigger: "#home", start: "top top", end: "bottom top", scrub: true } });
    }

    /* ---------- section headings: hand-drawn underline ---------- */
    const placements = [];
    // drawn beside the heading, not inside it: translations rewrite the heading's text
    document.querySelectorAll(".sechead h2, .pulse-head h2").forEach(heading => {
      if (!heading.nextElementSibling?.classList.contains("scribble")) {
        heading.insertAdjacentHTML("afterend", '<svg class="scribble" viewBox="0 0 420 18" preserveAspectRatio="none" aria-hidden="true"><path d="M4 12 q50 -10 100 0 t100 0 t100 0 t100 0"/></svg>');
      }
      const svg = heading.nextElementSibling, path = svg.querySelector("path"), length = path.getTotalLength();
      const place = () => { svg.style.top = `${heading.offsetTop + heading.offsetHeight - 2}px`;
        svg.style.left = `${heading.offsetLeft}px`; svg.style.width = `${Math.min(heading.offsetWidth * .85, 380)}px`; };
      place(); placements.push(place); ScrollTrigger.addEventListener("refresh", place);
      gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1.1,
        ease: "power2.inOut", scrollTrigger: { trigger: heading, start: "top 82%" } });
    });

    /* ---------- illustrations bob gently ---------- */
    gsap.utils.toArray(".section-art").forEach((art, i) => ambient.push(gsap.to(art,
      { y: -8, rotation: i % 2 ? 1.5 : -1.5, duration: 2.6 + i * .3, ease: "sine.inOut", yoyo: true, repeat: -1 })));

    /* ---------- activity: heat map fills column by column ---------- */
    let heatPlayed = false;
    const heatIn = () => {
      const cells = gsap.utils.toArray("#heat i");
      if (heatPlayed || !cells.length) return;
      heatPlayed = true;
      gsap.from(cells, { scale: 0, duration: .5, ease: "back.out(2)", transformOrigin: "50% 50%",
        stagger: { each: .0016, from: "start" }, clearProps: "transform",
        scrollTrigger: { trigger: "#heat", start: "top 85%" } });
    };

    /* ---------- cards: messy desk tidies itself, reflows animate ---------- */
    const enter = (selector, trigger) => {
      const fresh = gsap.utils.toArray(selector).filter(el => !seen.has(el.dataset.flipId));
      fresh.forEach(el => seen.add(el.dataset.flipId));
      if (!fresh.length) return;
      ScrollTrigger.batch(fresh, { start: "top 92%", once: true, onEnter: batch => gsap.fromTo(batch,
        { y: () => gsap.utils.random(50, 110), x: () => gsap.utils.random(-40, 40), rotation: () => gsap.utils.random(-9, 9), autoAlpha: 0 },
        { y: 0, x: 0, rotation: 0, autoAlpha: 1, duration: .9, ease: "back.out(1.4)", stagger: .07, overwrite: "auto",
          clearProps: "transform,opacity,visibility" }) });
      ScrollTrigger.refresh();
    };
    const cardsIn = () => {
      enter("#launchGrid .launch-card");
      enter("#bento > .tile, #bento > .project-group");
    };

    let flipState = null;
    const capture = event => {
      if (!Flip || !event.target.closest?.(".fbtn,.viewbtn,.site-fbtn,#projectSort")) return;
      const scope = event.target.closest(".site-fbtn") ? "#launchGrid .launch-card" : "#bento [data-flip-id]";
      flipState = { scope, state: Flip.getState(scope) };
      requestAnimationFrame(play); // after the page re-renders, before it paints
    };
    function play() {
      if (!active || !flipState) return;
      const { scope, state } = flipState; flipState = null;
      const targets = gsap.utils.toArray(scope);
      targets.forEach(el => seen.add(el.dataset.flipId));
      Flip.from(state, { targets, duration: .65, ease: "back.out(1.1)", absolute: true, nested: true, stagger: .015, prune: true,
        onEnter: els => gsap.fromTo(els, { scale: .7, rotation: -6, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: .5, ease: "back.out(1.8)" }),
        onComplete: () => ScrollTrigger.refresh() });
    }
    document.addEventListener("click", capture, true);
    document.addEventListener("change", capture, true);

    /* ---------- about + footer ---------- */
    gsap.from("#aboutQuote", { y: 40, autoAlpha: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: "#about", start: "top 75%" } });
    gsap.from("#skills i", { scale: .4, autoAlpha: 0, duration: .5, ease: "back.out(2)", stagger: .03,
      scrollTrigger: { trigger: "#skills", start: "top 88%" } });
    const big = $(".fbig");
    if (big && !big.querySelector(".l")) {
      big.innerHTML = big.innerHTML.split("<br>").map(line => [...line].map(c => `<span class="l">${c}</span>`).join("")).join("<br>");
      gsap.from(".fbig .l", { yPercent: 110, rotation: () => gsap.utils.random(-20, 20), autoAlpha: 0, duration: .8,
        ease: "back.out(2)", stagger: .05, scrollTrigger: { trigger: "footer", start: "top 80%" } });
    }
    const wave = $(".footer-wave path");
    if (wave) ambient.push(gsap.to(wave, { x: -140, duration: 2.4, ease: "none", repeat: -1 }));
    syncAmbient();

    /* the inline script renders after fetching data; react to each render */
    const run = () => { if (active) { heroIn(); heatIn(); cardsIn(); placements.forEach(place => place()); } };
    const watch = new MutationObserver(() => requestAnimationFrame(run));
    ["kin", "heat", "launchGrid", "bento"].forEach(id => { const el = document.getElementById(id); if (el) watch.observe(el, { childList: true }); });
    run();
    const onLoad = () => ScrollTrigger.refresh();
    addEventListener("load", onLoad);

    return () => {
      active = false;
      if (raf) gsap.ticker.remove(raf);
      lockWatch?.disconnect();
      if (onAnchorClick) document.removeEventListener("click", onAnchorClick);
      lenis?.destroy();
      if (onPointerMove) $("#home").removeEventListener("pointermove", onPointerMove);
      placements.forEach(place => ScrollTrigger.removeEventListener("refresh", place));
      ambient.length = 0;
      watch.disconnect();
      removeEventListener("load", onLoad);
      document.removeEventListener("click", capture, true);
      document.removeEventListener("change", capture, true);
    };
  });
})();
