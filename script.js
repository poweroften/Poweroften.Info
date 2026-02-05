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

function setEngaged(isOn) {
  const root = document.documentElement;
  if (isOn) root.classList.add("is-engaged");
  else root.classList.remove("is-engaged");
}

// Index engage on scroll (header -> footer logo)
window.addEventListener(
  "scroll",
  () => setEngaged(window.scrollY > 40),
  { passive: true }
);

// ---------- Index page: build thumbnails ----------
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

// ---------- Viewer page: 2-panel sliding slideshow ----------
const track = document.getElementById("slideTrack");
const imgA = document.getElementById("slideA");
const imgB = document.getElementById("slideB");
const counterEl = document.getElementById("counter");

if (track && imgA && imgB && counterEl) {
  const params = new URLSearchParams(window.location.search);
  let current = clampSlide(parseInt(params.get("slide") || "1", 10));

  let animating = false;
  const preload = new Map(); // n -> Image
  let lastTouch = 0;

  function normalize(n) {
    return ((n - 1 + TOTAL_SLIDES) % TOTAL_SLIDES) + 1;
  }

  function ensurePreload(n) {
    n = normalize(n);
    if (preload.has(n)) return;

    const im = new Image();
    im.decoding = "async";
    im.loading = "eager";
    im.src = srcFor(n);

    // Warm decode (reduces iOS flashes)
    if (im.decode) im.decode().catch(() => {});

    preload.set(n, im);
  }

  function updateURL() {
    const url = new URL(window.location.href);
    url.searchParams.set("slide", String(current));
    history.replaceState({}, "", url);
  }

  function updateCounter() {
    counterEl.textContent = `${current} / ${TOTAL_SLIDES}`;
  }

  function prime() {
    imgA.src = srcFor(current);
    imgB.src = "";
    track.style.transform = "translate3d(0,0,0)";
    updateCounter();
    updateURL();

    ensurePreload(current + 1);
    ensurePreload(current - 1);
  }

  function go(nextSlide, direction /* +1 or -1 */) {
    if (animating) return;
    animating = true;

    setEngaged(true);

    nextSlide = normalize(nextSlide);

    // Put incoming image in B
    imgB.src = srcFor(nextSlide);

    // Warm neighbors
    ensurePreload(nextSlide + 1);
    ensurePreload(nextSlide - 1);

    // Always animate the same way (left) to reduce Safari weirdness:
    // For "prev", we compute the previous slide but still animate forward visually.
    // (Feels consistent + avoids direction-flip glitches.)
    requestAnimationFrame(() => {
      track.style.transform = "translate3d(-100vw, 0, 0)";
    });

    const onDone = () => {
      // Commit new current
      current = nextSlide;

      // Swap A <- B
      imgA.src = imgB.src;
      imgB.src = "";

      updateCounter();
      updateURL();

      // Snap back to start instantly (no visual jump because image already swapped)
      track.style.transition = "none";
      track.style.transform = "translate3d(0,0,0)";
      track.getBoundingClientRect(); // reflow
      track.style.transition = "";

      animating = false;
    };

    track.addEventListener("transitionend", onDone, { once: true });
  }

  function next() {
    go(current + 1, +1);
  }

  function prev() {
    // We still animate forward, but set incoming to previous slide
    go(current - 1, -1);
  }

  prime();

  // Arrows
  document.querySelector(".arrow.right")?.addEventListener("click", (e) => {
    e.stopPropagation();
    next();
  });

  document.querySelector(".arrow.left")?.addEventListener("click", (e) => {
    e.stopPropagation();
    prev();
  });

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "Escape") window.location.href = "index.html";
  });

  // Swipe
  let startX = 0;
  document.addEventListener("touchstart", (e) => {
    lastTouch = Date.now();
    startX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -50) next();
    if (dx > 50) prev();
  }, { passive: true });

  // Optional click-to-advance (guarded)
  document.addEventListener("click", () => {
    if (Date.now() - lastTouch < 500) return;
    next();
  });
}