// ================== CONFIG ==================
const TOTAL_SLIDES = 40;
const EXT = "jpeg"; // your files are 01.jpeg, 02.jpeg...
// ============================================

function pad2(n) {
  return String(n).padStart(2, "0");
}

function srcFor(n) {
  return `img/${pad2(n)}.${EXT}`;
}

function clampSlide(n) {
  if (Number.isNaN(n) || n < 1) return 1;
  if (n > TOTAL_SLIDES) return TOTAL_SLIDES;
  return n;
}

function normalize(n) {
  return ((n - 1 + TOTAL_SLIDES) % TOTAL_SLIDES) + 1;
}

function setEngaged(isOn) {
  document.documentElement.classList.toggle("is-engaged", isOn);
}

/* ---------- Index: header/footer swap on scroll ---------- */
window.addEventListener("scroll", () => setEngaged(window.scrollY > 40), { passive: true });

/* ---------- Index: build thumbnails ---------- */
const thumbsEl = document.getElementById("thumbs");
if (thumbsEl) {
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= TOTAL_SLIDES; i++) {
    const a = document.createElement("a");
    a.className = "thumb";
    a.href = `viewer.html?slide=${i}`;

    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = srcFor(i);
    img.alt = `Slide ${i}`;

    a.appendChild(img);
    frag.appendChild(a);
  }
  thumbsEl.appendChild(frag);
}

/* ---------- Viewer: draggable 3-panel carousel + iOS warm-up ---------- */
const track = document.getElementById("slideTrack");
const prevImg = document.getElementById("slidePrev");
const curImg = document.getElementById("slideCurrent");
const nextImg = document.getElementById("slideNext");
const counterEl = document.getElementById("counter");
const viewport = document.querySelector(".slide-viewport");
const whiteOverlay = document.getElementById("whiteOverlay");

if (track && prevImg && curImg && nextImg && counterEl && viewport) {
  const params = new URLSearchParams(window.location.search);
  let current = clampSlide(parseInt(params.get("slide") || "1", 10));
  let animating = false;

  // Show white mask only during iOS "warm-up" transitions.
  let warmupTransitionsLeft = 12;

  function flashWhiteFrame() {
    if (!whiteOverlay) return;
    if (warmupTransitionsLeft <= 0) return;
    warmupTransitionsLeft--;

    whiteOverlay.style.opacity = "1";
    requestAnimationFrame(() => {
      whiteOverlay.style.opacity = "0";
    });
  }

  // Keep decoded images alive (helps iOS)
  const resident = new Map();

  function warm(n) {
    n = normalize(n);
    if (resident.has(n)) return;

    const im = new Image();
    im.decoding = "async";
    im.src = srcFor(n);
    if (im.decode) im.decode().catch(() => {});
    resident.set(n, im);

    // Larger cache to avoid iOS throwing away decoded textures
    if (resident.size > 24) {
      resident.delete(resident.keys().next().value);
    }
  }

  async function preloadWindow(center, radius = 8) {
    const tasks = [];
    for (let d = -radius; d <= radius; d++) {
      const n = normalize(center + d);
      warm(n);
      const im = resident.get(n);
      if (im && im.decode) tasks.push(im.decode().catch(() => {}));
    }

    // Don’t block forever; we just want to get ahead of iOS
    await Promise.race([
      Promise.all(tasks),
      new Promise((res) => setTimeout(res, 350))
    ]);
  }

  function setCounter() {
    counterEl.textContent = `${current} / ${TOTAL_SLIDES}`;
  }

  function setURL() {
    const url = new URL(window.location.href);
    url.searchParams.set("slide", String(current));
    history.replaceState({}, "", url);
  }

  function updateImages() {
    const p = current - 1 || TOTAL_SLIDES;
    const n = current % TOTAL_SLIDES + 1;

    prevImg.src = srcFor(p);
    curImg.src = srcFor(current);
    nextImg.src = srcFor(n);

    // warm immediate neighbors + a bit beyond
    warm(p);
    warm(n);
    warm(p - 1 || TOTAL_SLIDES);
    warm(n + 1 > TOTAL_SLIDES ? 1 : n + 1);

    setCounter();
    setURL();
  }

  // --- Transform helpers
  let currentX = 0;

  const baseX = () => -window.innerWidth; // center panel

  const setX = (x) => {
    currentX = x;
    track.style.transform = `translate3d(${x}px,0,0)`;
    track.style.webkitTransform = `translate3d(${x}px,0,0)`;
  };

  function snapCenterNoAnim() {
    track.style.transition = "none";
    setX(baseX());
    track.getBoundingClientRect(); // reflow
    track.style.transition = "";
  }

  // Safe animateTo: completes even if transitionend doesn't fire
  function animateTo(targetX, onDone) {
    if (Math.abs(currentX - targetX) < 0.5) {
      setX(targetX);
      onDone?.();
      return;
    }

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      track.removeEventListener("transitionend", done);
      onDone?.();
    };

    const timeout = setTimeout(done, 1200);

    track.style.transition = `transform var(--slide-ms) var(--slide-ease)`;
    setX(targetX);

    track.addEventListener(
      "transitionend",
      () => {
        clearTimeout(timeout);
        done();
      },
      { once: true }
    );
  }

  function go(dir) {
    if (animating) return;
    animating = true;

    setEngaged(true);

    const w = window.innerWidth;
    const targetX = dir === +1 ? -2 * w : 0;

    animateTo(targetX, async () => {
      current = normalize(current + dir);
      updateImages();

      // Warm up the next window so the "first ~12" issue doesn't travel with start slide
      preloadWindow(current, 8);

      // One-frame settle then mask the snap-back frame
      requestAnimationFrame(() => {
        flashWhiteFrame();
        snapCenterNoAnim();
        animating = false;
      });
    });
  }

  // init
  updateImages();
  snapCenterNoAnim();
  preloadWindow(current, 8);

  // buttons
  document.querySelector(".arrow.right")?.addEventListener("click", (e) => {
    e.stopPropagation();
    go(+1);
  });

  document.querySelector(".arrow.left")?.addEventListener("click", (e) => {
    e.stopPropagation();
    go(-1);
  });

  // keyboard
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") go(+1);
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "Escape") window.location.href = "index.html";
  });

  // --- DRAG (pointer-based)
  let dragging = false;
  let startClientX = 0;
  let lastClientX = 0;
  let lastT = 0;
  let vx = 0; // velocity px/ms
  let startBase = 0;

  function onDown(e) {
    if (animating) return;
    dragging = true;
    setEngaged(true);

    startClientX = e.clientX;
    lastClientX = e.clientX;
    lastT = performance.now();
    vx = 0;

    startBase = baseX();
    track.style.transition = "none";
    viewport.setPointerCapture?.(e.pointerId);
  }

  function onMove(e) {
    if (!dragging) return;

    const now = performance.now();
    const dx = e.clientX - startClientX;

    const dt = Math.max(1, now - lastT);
    vx = (e.clientX - lastClientX) / dt;
    lastClientX = e.clientX;
    lastT = now;

    setX(startBase + dx);
  }

  function onUp(e) {
    if (!dragging) return;
    dragging = false;

    const w = window.innerWidth;
    const dx = e.clientX - startClientX;

    const DIST = w * 0.18;
    const VEL = 0.45;

    const shouldNext = dx < -DIST || vx < -VEL;
    const shouldPrev = dx >  DIST || vx >  VEL;

    if (shouldNext) return go(+1);
    if (shouldPrev) return go(-1);

    // snap back to center
    animateTo(-w, () => {
      requestAnimationFrame(() => {
        flashWhiteFrame();
        snapCenterNoAnim();
        animating = false;
      });
    });
  }

  viewport.addEventListener("pointerdown", onDown, { passive: true });
  viewport.addEventListener("pointermove", onMove, { passive: true });
  viewport.addEventListener("pointerup", onUp, { passive: true });
  viewport.addEventListener("pointercancel", onUp, { passive: true });

  window.addEventListener("resize", () => {
    snapCenterNoAnim();
  });
}