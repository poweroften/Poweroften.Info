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

// ---------- Index: header/footer swap on scroll ----------
window.addEventListener(
  "scroll",
  () => setEngaged(window.scrollY > 40),
  { passive: true }
);

// ---------- Index: build thumbnails ----------
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

// ---------- Viewer: directional 3-panel carousel ----------
const track = document.getElementById("slideTrack");
const prevImg = document.getElementById("slidePrev");
const curImg = document.getElementById("slideCurrent");
const nextImg = document.getElementById("slideNext");
const counterEl = document.getElementById("counter");

if (track && prevImg && curImg && nextImg && counterEl) {
  const params = new URLSearchParams(window.location.search);
  let current = clampSlide(parseInt(params.get("slide") || "1", 10));
  let animating = false;

  // Keep some decoded images alive on iOS (prevents GC dropping warm images)
  const resident = new Map();

  function setCounter() {
    counterEl.textContent = `${current} / ${TOTAL_SLIDES}`;
  }

  function setURL() {
    const url = new URL(window.location.href);
    url.searchParams.set("slide", String(current));
    history.replaceState({}, "", url);
  }

  function warm(n) {
    n = normalize(n);
    if (resident.has(n)) return;

    const im = new Image();
    im.decoding = "async";
    im.src = srcFor(n);
    if (im.decode) im.decode().catch(() => {});
    resident.set(n, im);

    // cap cache size
    if (resident.size > 8) {
      const firstKey = resident.keys().next().value;
      resident.delete(firstKey);
    }
  }

  function updateImages() {
    const p = current - 1 || TOTAL_SLIDES;
    const n = current % TOTAL_SLIDES + 1;

    prevImg.src = srcFor(p);
    curImg.src = srcFor(current);
    nextImg.src = srcFor(n);

    // warm extra neighbors
    warm(p - 1 || TOTAL_SLIDES);
    warm(n + 1 > TOTAL_SLIDES ? 1 : n + 1);

    setCounter();
    setURL();
  }

  function snapToCenterNoAnim() {
    track.style.transition = "none";
    track.style.transform = "translate3d(-100vw,0,0)";
    track.getBoundingClientRect(); // force reflow
    track.style.transition = "";
  }

  function go(dir) {
    if (animating) return;
    animating = true;

    setEngaged(true);

    // dir = +1 => next (slide left)
    // dir = -1 => prev (slide right)
    track.style.transform = (dir === +1)
      ? "translate3d(-200vw,0,0)"
      : "translate3d(0vw,0,0)";

    track.addEventListener(
      "transitionend",
      () => {
        current = normalize(current + dir);
        updateImages();
        snapToCenterNoAnim();
        animating = false;
      },
      { once: true }
    );
  }

  // init
  updateImages();
  snapToCenterNoAnim();

  // arrows
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

  // swipe
  let startX = 0;
  document.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -50) go(+1);
    if (dx > 50) go(-1);
  }, { passive: true });
}