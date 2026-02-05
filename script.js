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

// ---------- Viewer page: directional 3-panel carousel (decode-gated, iOS hardened) ----------
const track = document.getElementById("slideTrack");
const prevImg = document.getElementById("slidePrev");
const curImg  = document.getElementById("slideCurrent");
const nextImg = document.getElementById("slideNext");
const counterEl = document.getElementById("counter");

if (track && prevImg && curImg && nextImg && counterEl) {
  const params = new URLSearchParams(window.location.search);
  let current = clampSlide(parseInt(params.get("slide") || "1", 10));
  let animating = false;

  const resident = new Map(); // keep a few decoded images alive (iOS)

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

    // cap to avoid memory blowups
    if (resident.size > 8) {
      const firstKey = resident.keys().next().value;
      resident.delete(firstKey);
    }
  }

  async function waitImgReady(imgEl) {
    // Prefer decode()
    if (imgEl.decode) {
      try { await imgEl.decode(); return; } catch (_) {}
    }
    // If already complete
    if (imgEl.complete && imgEl.naturalWidth > 0) return;

    // Wait for load/error briefly
    await new Promise((resolve) => {
      const done = () => resolve();
      imgEl.addEventListener("load", done, { once: true });
      imgEl.addEventListener("error", done, { once: true });
      setTimeout(resolve, 600);
    });
  }

  function updateImages() {
    const p = current - 1 || TOTAL_SLIDES;
    const n = current % TOTAL_SLIDES + 1;

    prevImg.src = srcFor(p);
    curImg.src  = srcFor(current);
    nextImg.src = srcFor(n);

    // warm beyond neighbors
    warm(p - 1 || TOTAL_SLIDES);
    warm(n + 1 > TOTAL_SLIDES ? 1 : n + 1);

    setCounter();
    setURL();
  }

  function snapToCenterNoAnim() {
    track.style.transition = "none";
    track.style.transform = "translate3d(-100vw,0,0)";
    track.getBoundingClientRect(); // reflow
    track.style.transition = "";
  }

  async function go(dir) {
    if (animating) return;
    animating = true;

    document.documentElement.classList.add("is-engaged");

    // ✅ Ensure the incoming image is decoded BEFORE we animate.
    // If going next, incoming is nextImg; if prev, incoming is prevImg.
    const incomingEl = (dir === +1) ? nextImg : prevImg;

    // Make sure its src is already set
    // (it should be, via updateImages)
    await waitImgReady(incomingEl);

    // One frame to let WebKit settle decoded pixels
    await new Promise(requestAnimationFrame);

    // Animate directionally
    track.style.transform =
      dir === +1
        ? "translate3d(-200vw,0,0)" // slide left to next
        : "translate3d(0vw,0,0)";   // slide right to prev

    track.addEventListener("transitionend", async () => {
      // advance index
      current = normalize(current + dir);

      // update images
      updateImages();

      // ✅ critical: wait one frame after src swap before snapping back
      await new Promise(requestAnimationFrame);

      snapToCenterNoAnim();
      animating = false;
    }, { once: true });
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