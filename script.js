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

// ---------- Viewer page: sliding slideshow ----------
const track = document.getElementById("slideTrack");
const imgA = document.getElementById("slideA");
const imgB = document.getElementById("slideB");
const counterEl = document.getElementById("counter");

if (track && imgA && imgB && counterEl) {
  const params = new URLSearchParams(window.location.search);
  let current = clampSlide(parseInt(params.get("slide") || "1", 10));

  let showingA = true;
  let animating = false;

  // Preload cache
  const preload = new Map();

  function ensurePreload(n) {
    n = ((n - 1 + TOTAL_SLIDES) % TOTAL_SLIDES) + 1;
    if (preload.has(n)) return;

    const im = new Image();
    im.decoding = "async";
    im.loading = "eager";
    im.src = srcFor(n);

    // Force decode when supported (helps iOS Safari reduce flicker)
    if (im.decode) {
      im.decode().catch(() => {});
    }

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

    // Use GPU-friendly transform
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

    const incoming = showingA ? imgB : imgA;
    incoming.src = srcFor(nextSlide);

    ensurePreload(nextSlide + 1);
    ensurePreload(nextSlide - 1);

    if (direction === +1) {
      requestAnimationFrame(() => {
        track.style.transform = "translate3d(-100vw, 0, 0)";
      });
    } else {
      // prev: jump then animate back (keep it GPU-friendly)
      track.style.transition = "none";
      track.style.transform = "translate3d(-100vw, 0, 0)";

      requestAnimationFrame(() => {
        track.style.transition = "";
        requestAnimationFrame(() => {
          track.style.transform = "translate3d(0,0,0)";
        });
      });
    }

    const onDone = () => {
      track.removeEventListener("transitionend", onDone);

      current = nextSlide;
      updateCounter();
      updateURL();

      const currentImg = showingA ? imgB : imgA;
      imgA.src = currentImg.src;
      imgB.src = "";

      // Reset without flicker
      track.style.transition = "none";
      track.style.transform = "translate3d(0,0,0)";
      track.getBoundingClientRect(); // force reflow
      track.style.transition = "";

      showingA = true;
      animating = false;
    };

    track.addEventListener("transitionend", onDone, { once: true });
  }

  function next() {
    const n = current % TOTAL_SLIDES + 1;
    go(n, +1);
  }

  function prev() {
    const n = current - 1 || TOTAL_SLIDES;
    go(n, -1);
  }

  prime();

  // Arrows
  const rightArrow = document.querySelector(".arrow.right");
  const leftArrow = document.querySelector(".arrow.left");
  if (rightArrow) rightArrow.addEventListener("click", (e) => { e.stopPropagation(); next(); });
  if (leftArrow) leftArrow.addEventListener("click", (e) => { e.stopPropagation(); prev(); });

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "Escape") window.location.href = "index.html";
  });

  // Swipe
  let startX = 0;
  let lastTouch = 0;

  document.addEventListener("touchstart", (e) => {
    lastTouch = Date.now();
    startX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    if (endX < startX - 50) next();
    if (endX > startX + 50) prev();
  }, { passive: true });

  // Click-to-advance (guarded so swipe doesn't trigger a click advance)
  document.addEventListener("click", () => {
    if (Date.now() - lastTouch < 500) return;
    next();
  });
}