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
  // Build once
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

  // A/B state
  let showingA = true; // A is current at start
  let animating = false;

  // Preload cache
  const preload = new Map(); // n -> Image()

  function ensurePreload(n) {
    n = ((n - 1 + TOTAL_SLIDES) % TOTAL_SLIDES) + 1;
    if (preload.has(n)) return;
    const im = new Image();
    im.decoding = "async";
    im.loading = "eager";
    im.src = srcFor(n);
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
    // Load current into A
    imgA.src = srcFor(current);
    imgB.src = "";
    // Center on A
    track.style.transform = "translateX(0)";
    updateCounter();
    updateURL();

    // Preload neighbors
    ensurePreload(current + 1);
    ensurePreload(current - 1);
  }

  function go(nextSlide, direction /* +1 or -1 */) {
    if (animating) return;
    animating = true;

    setEngaged(true); // move logo to footer after interaction

    const incoming = showingA ? imgB : imgA;
    incoming.src = srcFor(nextSlide);

    // Make sure neighbors stay warm
    ensurePreload(nextSlide + 1);
    ensurePreload(nextSlide - 1);

    // Slide to show incoming
    // If current is on A (left), incoming sits on B (right)
    // direction +1 => slide left to reveal B
    // direction -1 => we fake it by swapping roles (see below)
    if (direction === +1) {
      // A -> B: translate to -100vw
      requestAnimationFrame(() => {
        track.style.transform = "translateX(-100vw)";
      });
    } else {
      // For prev: we want a right-to-left slide in the opposite direction.
      // Trick: place incoming on the left by swapping instantly, then animate back.
      // Step 1: put incoming image on A position
      // We'll do this by flipping which image is "current" and using an immediate jump.
      // Implementation: jump track to -100vw with incoming already visible there, then animate to 0.

      // Ensure incoming is the left panel
      // Swap showing flag early so "incoming" becomes left
      // We'll just swap by toggling and rearranging via transform jump.
      // 1) Jump to -100vw (so right panel is visible)
      track.style.transition = "none";
      track.style.transform = "translateX(-100vw)";
      // 2) On next frame, restore transition and animate back to 0
      requestAnimationFrame(() => {
        track.style.transition = ""; // revert to CSS transition
        requestAnimationFrame(() => {
          track.style.transform = "translateX(0)";
        });
      });
    }

    // After transition ends, finalize state
    const onDone = () => {
      track.removeEventListener("transitionend", onDone);

      current = nextSlide;
      updateCounter();
      updateURL();

      // Normalize: always keep "current" on the left panel at rest (transform 0)
      // Move the current image into A and reset B for the next transition
      const currentImg = showingA ? imgB : imgA;

      imgA.src = currentImg.src;
      imgB.src = "";

      track.style.transition = "none";
      track.style.transform = "translateX(0)";
      // force reflow to apply the reset
      track.getBoundingClientRect();
      track.style.transition = "";

      showingA = true; // current is now on A
      animating = false;
    };

    // Only listen when we used the normal transition
    // For "prev" we animate too (back to 0), still ends in transitionend.
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

  // Start
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
  document.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    if (endX < startX - 50) next();
    if (endX > startX + 50) prev();
  }, { passive: true });

  // Optional: click to advance (remove if you don’t want it)
  document.addEventListener("click", () => next());
}