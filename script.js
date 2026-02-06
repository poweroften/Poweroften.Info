// ================== CONFIG ==================
const TOTAL_SLIDES = 48;
// ============================================

// ---------- helpers ----------
function pad2(n) { return String(n).padStart(2, "0"); }
function normalize(n) { return ((n - 1 + TOTAL_SLIDES) % TOTAL_SLIDES) + 1; }
function clampSlide(n) {
  if (Number.isNaN(n) || n < 1) return 1;
  if (n > TOTAL_SLIDES) return TOTAL_SLIDES;
  return n;
}
function setEngaged(isOn) {
  document.documentElement.classList.toggle("is-engaged", !!isOn);
}

// Base folder for images (same folder structure as your logo)
const IMG_DIR = "img/";

// Detect your actual file naming once (jpg/jpeg/png + padded/nonpadded)
let detectedPattern = null;

function buildCandidates(i) {
  const n = String(i);
  const n2 = pad2(i);
  const exts = ["jpg", "jpeg", "png", "webp"];
  const names = [n2, n]; // try padded first, then plain
  const out = [];
  for (const name of names) {
    for (const ext of exts) out.push(`${IMG_DIR}${name}.${ext}`);
  }
  return out;
}

function probeUrl(url) {
  return new Promise((resolve) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => resolve(true);
    im.onerror = () => resolve(false);
    im.src = url;
  });
}

async function detectPattern() {
  if (detectedPattern) return detectedPattern;

  // Try slide 1 to detect the naming convention
  const candidates = buildCandidates(1);
  for (const url of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await probeUrl(url);
    if (ok) {
      // infer extension + padding from the winning URL
      const file = url.replace(IMG_DIR, "");
      const m = file.match(/^(\d+)\.(\w+)$/);
      const padLen = m ? m[1].length : 2;
      const ext = m ? m[2] : "jpg";
      detectedPattern = { padLen, ext };
      return detectedPattern;
    }
  }

  detectedPattern = { padLen: 2, ext: "jpg" }; // fallback
  return detectedPattern;
}

async function srcFor(i) {
  const pat = await detectPattern();
  const name = pat.padLen === 2 ? pad2(i) : String(i).padStart(pat.padLen, "0");
  return `${IMG_DIR}${name}.${pat.ext}`;
}

// ---------- Index engage on scroll ----------
window.addEventListener("scroll", () => setEngaged(window.scrollY > 48), { passive: true });

// ---------- Index page: build thumbnails ----------
const thumbsEl = document.getElementById("thumbs");
if (thumbsEl) {
  (async () => {
    await detectPattern();
    const frag = document.createDocumentFragment();

    for (let i = 1; i <= TOTAL_SLIDES; i++) {
      const a = document.createElement("a");
      a.className = "thumb";
      a.href = `viewer.html?slide=${i}`;

      const img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = `Slide ${i}`;
      img.src = await srcFor(i);

      a.appendChild(img);
      frag.appendChild(a);
    }

    thumbsEl.appendChild(frag);
  })();
}

// ---------- Viewer: native scroll-snap strip ----------
const viewport = document.getElementById("slideViewport");
const strip = document.getElementById("slideStrip");
const counterEl = document.getElementById("counter");

if (viewport && strip && counterEl) {
  (async () => {
    await detectPattern();

    const params = new URLSearchParams(window.location.search);
    let current = clampSlide(parseInt(params.get("slide") || "1", 10));

    // Build slide DOM once (set src lazily in a window)
    for (let i = 1; i <= TOTAL_SLIDES; i++) {
      const s = document.createElement("div");
      s.className = "slide";
      s.dataset.index = String(i);

      const img = document.createElement("img");
      img.decoding = "async";
      img.draggable = false;
      img.alt = `Slide ${i}`;
      img.dataset.src = await srcFor(i);

      s.appendChild(img);
      strip.appendChild(s);
    }

    // Warm decoded cache
    const resident = new Map();
    const MAX_RESIDENT = 24;

    function warm(n) {
      n = normalize(n);
      if (resident.has(n)) return;

      const im = new Image();
      im.decoding = "async";
      im.src = strip.children[n - 1]?.querySelector("img")?.dataset.src || "";
      im.decode?.().catch(() => {});
      resident.set(n, im);

      if (resident.size > MAX_RESIDENT) {
        resident.delete(resident.keys().next().value);
      }
    }

    function setCounter() {
      counterEl.textContent = `${current} / ${TOTAL_SLIDES}`;
    }

    function setURL() {
      const url = new URL(window.location.href);
      url.searchParams.set("slide", String(current));
      history.replaceState({}, "", url);
    }

    function ensureWindow(center, radius = 10) {
      for (let d = -radius; d <= radius; d++) {
        const idx = normalize(center + d);
        const slide = strip.children[idx - 1];
        if (!slide) continue;

        const img = slide.querySelector("img");
        if (img && !img.src) img.src = img.dataset.src;

        warm(idx);
      }
    }

    function scrollToIndex(idx, behavior = "auto") {
      const x = (idx - 1) * window.innerWidth;
      viewport.scrollTo({ left: x, behavior });
    }

    // Update current from scroll
    let raf = 0;
    function onScroll() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = window.innerWidth || 1;
        const idx = clampSlide(Math.round(viewport.scrollLeft / w) + 1);
        if (idx !== current) {
          current = idx;
          setEngaged(true);
          setCounter();
          setURL();
          ensureWindow(current, 10);
        }
      });
    }

    viewport.addEventListener("scroll", onScroll, { passive: true });

    // arrows
    document.querySelector(".arrow.right")?.addEventListener("click", (e) => {
      e.stopPropagation();
      scrollToIndex(normalize(current + 1), "smooth");
    });
    document.querySelector(".arrow.left")?.addEventListener("click", (e) => {
      e.stopPropagation();
      scrollToIndex(normalize(current - 1), "smooth");
    });

    // keyboard
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") scrollToIndex(normalize(current + 1), "smooth");
      if (e.key === "ArrowLeft") scrollToIndex(normalize(current - 1), "smooth");
      if (e.key === "Escape") window.location.href = "index.html";
    });

    // init
    setCounter();
    ensureWindow(current, 10);

    requestAnimationFrame(() => scrollToIndex(current, "auto"));
    window.addEventListener("resize", () => requestAnimationFrame(() => scrollToIndex(current, "auto")));
  })();
}