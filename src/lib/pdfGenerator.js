import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/** Fetch -> DataURL (reliable for canvas rendering) */
async function imageUrlToDataUrl(url) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  try {
    const res = await fetch(url, { mode: "cors", cache: "no-cache" });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const blob = await res.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("imageUrlToDataUrl failed:", e);
    return null;
  }
}

async function waitForFonts() {
  try {
    if (document?.fonts?.ready) await document.fonts.ready;
  } catch {}
}

async function decodeImages(root) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      try {
        if (!img?.src) return;
        if (img.complete && img.naturalWidth > 0) return;
        if (img.decode) await img.decode();
      } catch {}
    })
  );
}

function raf(n = 1) {
  return new Promise((resolve) => {
    const step = (k) => (k <= 0 ? resolve() : requestAnimationFrame(() => step(k - 1)));
    step(n);
  });
}

/** Offscreen fixed width clone to prevent responsive reflow */
function makeOffscreenClone(element, fixedPxWidth = 816) {
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-100000px";
  wrapper.style.top = "0";
  wrapper.style.width = `${fixedPxWidth}px`;
  wrapper.style.background = "#ffffff";
  wrapper.style.zIndex = "-1";
  wrapper.style.pointerEvents = "none";

  const clone = element.cloneNode(true);
  clone.style.width = `${fixedPxWidth}px`;
  clone.style.maxWidth = `${fixedPxWidth}px`;
  clone.style.background = "#ffffff";

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  return { wrapper, clone };
}

/**
 * PDF-only layout normalization:
 * - kills min-h-screen / h-screen / vh-based heights
 * - kills flex "space-between" that pushes content apart vertically
 * - reduces overly large top/bottom padding/margins that create empty space
 */
function normalizeLayoutForPdf(root) {
  root.querySelectorAll("*").forEach((el) => {
    const cs = getComputedStyle(el);
    const s = el.style;

    // Kill viewport height behaviors that create giant gaps
    if (cs.minHeight && cs.minHeight.includes("vh")) s.minHeight = "auto";
    if (cs.height && cs.height.includes("vh")) s.height = "auto";

    // Kill flex spacing tricks that explode vertical space on capture
    if (cs.display === "flex") {
      const jc = cs.justifyContent;
      if (jc === "space-between" || jc === "space-around" || jc === "space-evenly") {
        s.justifyContent = "flex-start";
        s.alignContent = "flex-start";
      }
    }

    // If something has absurd padding/margin (common in "screen" layouts), tone it down for PDF
    // (Only if it's really large — avoids breaking intentional small spacing.)
    const mt = parseFloat(cs.marginTop || "0");
    const mb = parseFloat(cs.marginBottom || "0");
    const pt = parseFloat(cs.paddingTop || "0");
    const pb = parseFloat(cs.paddingBottom || "0");

    if (mt > 80) s.marginTop = "24px";
    if (mb > 80) s.marginBottom = "24px";
    if (pt > 80) s.paddingTop = "24px";
    if (pb > 80) s.paddingBottom = "24px";
  });

  // Ensure the clone itself doesn't force height
  root.style.minHeight = "auto";
  root.style.height = "auto";
}

/** Optional: watermark per page via jsPDF (consistent) */
function addWatermarkPerPage(pdf, watermarkDataUrl) {
  if (!watermarkDataUrl) return;

  try {
    const GState = pdf.GState;
    if (GState) pdf.setGState(new GState({ opacity: 0.07 }));
  } catch {}

  const pageW = 8.5;
  const pageH = 11;
  const wmW = 7.5;
  const wmH = 7.5;
  const x = (pageW - wmW) / 2;
  const y = (pageH - wmH) / 2;

  pdf.addImage(watermarkDataUrl, "PNG", x, y, wmW, wmH, undefined, "FAST");

  try {
    const GState = pdf.GState;
    if (GState) pdf.setGState(new GState({ opacity: 1 }));
  } catch {}
}

/** Capture one section to canvas */
async function captureSection(sectionEl) {
  return html2canvas(sectionEl, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    imageTimeout: 20000,
    windowWidth: 816,
    logging: false,
  });
}

/**
 * NEW: auto-merge last "short" section into previous page.
 * This prevents the "mostly-empty last page" you still have. :contentReference[oaicite:1]{index=1}
 */
function mergeIfLastSectionTooSmall(sections, pxThreshold = 900) {
  if (sections.length < 2) return sections;

  const last = sections[sections.length - 1];
  const prev = sections[sections.length - 2];

  // If last section is short, append it into previous section
  if (last.scrollHeight < pxThreshold) {
    // Create a container inside prev to keep DOM structure safe
    const spacer = document.createElement("div");
    spacer.style.height = "24px";
    prev.appendChild(spacer);

    // Move all children from last into prev
    while (last.firstChild) prev.appendChild(last.firstChild);

    // Remove last
    last.remove();
    return Array.from(sections).slice(0, -1);
  }

  return sections;
}

/** Render a canvas into one or more PDF pages */
function addCanvasToPdf(pdf, canvas, watermarkDataUrl, isFirstPage) {
  const pageW = 8.5;
  const pageH = 11;

  const imgData = canvas.toDataURL("image/png", 1.0);
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  // Start page if not first
  if (!isFirstPage) pdf.addPage();

  // Watermark first so content sits above it
  addWatermarkPerPage(pdf, watermarkDataUrl);

  // If it fits one page, simple
  if (imgH <= pageH) {
    pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH, undefined, "FAST");
    return;
  }

  // Multi-page slice (rare if you section correctly)
  let heightLeft = imgH;
  let y = 0;

  pdf.addImage(imgData, "PNG", 0, y, imgW, imgH, undefined, "FAST");
  heightLeft -= pageH;

  while (heightLeft > 0) {
    y = heightLeft - imgH;
    pdf.addPage();
    addWatermarkPerPage(pdf, watermarkDataUrl);
    pdf.addImage(imgData, "PNG", 0, y, imgW, imgH, undefined, "FAST");
    heightLeft -= pageH;
  }
}

/**
 * MAIN: section-aware PDF generator
 * Mark page sections with:
 *   data-pdf-section="page"
 */
export async function generatePDFFromElement(element, filename = "document.pdf") {
  if (!element) throw new Error("Element not found for PDF generation");

  // Pull watermark from original DOM if you have <img alt="Watermark" ...>
  const watermarkImg = element.querySelector('img[alt="Watermark"]');
  const watermarkDataUrl = watermarkImg?.src ? await imageUrlToDataUrl(watermarkImg.src) : null;

  const { wrapper, clone } = makeOffscreenClone(element, 816);

  try {
    normalizeLayoutForPdf(clone);
    await waitForFonts();
    await decodeImages(clone);
    await raf(2);

    // Find sections
    let sections = Array.from(clone.querySelectorAll('[data-pdf-section="page"]'));
    if (!sections.length) sections = [clone];

    // Auto-merge last short section to prevent mostly-empty final page
    sections = mergeIfLastSectionTooSmall(sections, 900);

    const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });

    for (let i = 0; i < sections.length; i++) {
      const canvas = await captureSection(sections[i]);
      addCanvasToPdf(pdf, canvas, watermarkDataUrl, i === 0);
    }

    pdf.save(filename);
    return pdf;
  } finally {
    try {
      document.body.removeChild(wrapper);
    } catch {}
  }
}

export async function generateContractPDF(element, projectInfo, businessProfile) {
  const clientName = projectInfo?.clientName || "Client";
  const sanitized = String(clientName)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 60);

  const prefix = (businessProfile?.filenamePrefix || "GreenMile").replace(/[^a-zA-Z0-9]/g, "");
  const filename = `${prefix}_Proposal_${sanitized}.pdf`;

  return generatePDFFromElement(element, filename);
}

export default { generatePDFFromElement, generateContractPDF };
