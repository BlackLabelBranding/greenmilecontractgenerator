import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/** Fetch -> DataURL (for logos/watermarks if you still want DOM-based images) */
async function imageUrlToDataUrl(url) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  try {
    const res = await fetch(url, { mode: "cors", cache: "no-cache" });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const blob = await res.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
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

/**
 * Force PDF-friendly layout to prevent flex/vh from creating massive gaps.
 * This is the key fix for the whitespace you’re seeing on page 1.
 */
function forcePdfLayoutStyles(root) {
  // Disable viewport-height behaviors that explode spacing in canvas capture
  root.querySelectorAll("*").forEach((el) => {
    const s = el.style;

    // If your app uses Tailwind utility classes, these inline overrides are the safest
    // (they don't require knowing your class names).
    // These target the common causes: minHeight/height vh, flex spacing.
    if (getComputedStyle(el).minHeight.includes("vh")) s.minHeight = "auto";
    if (getComputedStyle(el).height.includes("vh")) s.height = "auto";

    const cs = getComputedStyle(el);
    if (cs.display === "flex") {
      // Prevent "space-between" from spreading sections across the entire height.
      if (cs.justifyContent === "space-between" || cs.justifyContent === "space-around") {
        s.justifyContent = "flex-start";
        s.alignContent = "flex-start";
      }
    }
  });
}

/**
 * Create an offscreen clone with fixed width.
 * This prevents responsive breakpoint changes during html2canvas.
 */
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
 * Optional: add a watermark image per page in jsPDF so it is ALWAYS consistent
 * (instead of depending on DOM stacking and canvas slicing).
 */
function addWatermarkPerPage(pdf, watermarkDataUrl) {
  if (!watermarkDataUrl) return;

  // Try to set opacity if supported
  try {
    // Some jsPDF builds support GState
    const GState = pdf.GState;
    if (GState) pdf.setGState(new GState({ opacity: 0.07 }));
  } catch {}

  const pageW = 8.5;
  const pageH = 11;

  // Centered watermark
  const wmW = 7.5;
  const wmH = 7.5;
  const x = (pageW - wmW) / 2;
  const y = (pageH - wmH) / 2;

  pdf.addImage(watermarkDataUrl, "PNG", x, y, wmW, wmH, undefined, "FAST");

  // Reset opacity if possible
  try {
    const GState = pdf.GState;
    if (GState) pdf.setGState(new GState({ opacity: 1 }));
  } catch {}
}

export async function generatePDFFromElement(element, filename = "document.pdf") {
  if (!element) throw new Error("Element not found for PDF generation");

  // If you have a watermark <img alt="Watermark" ...>, use it as source for per-page watermark.
  const watermarkImg = element.querySelector('img[alt="Watermark"]');
  const watermarkDataUrl = watermarkImg?.src ? await imageUrlToDataUrl(watermarkImg.src) : null;

  // 1) Clone into a fixed-width offscreen container (prevents responsive reflow)
  const { wrapper, clone } = makeOffscreenClone(element, 816);

  try {
    // 2) Force PDF-safe layout so flex/vh doesn't create giant gaps
    forcePdfLayoutStyles(clone);

    // 3) Wait for fonts/images in the CLONE (not the live DOM)
    await waitForFonts();
    await decodeImages(clone);
    await raf(2);

    // 4) Capture clone
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      imageTimeout: 20000,
      // lock "windowWidth" so breakpoints don’t shift in capture:
      windowWidth: 816,
      logging: false,
    });

    // 5) Build PDF with correct paging
    const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });

    const pageW = 8.5;
    const pageH = 11;

    const imgData = canvas.toDataURL("image/png", 1.0);
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    // Number of pages based on height ratio (prevents blank extra page)
    const totalPages = Math.max(1, Math.ceil(imgH / pageH));

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();

      // Watermark per page (consistent)
      addWatermarkPerPage(pdf, watermarkDataUrl);

      // Slice position
      const y = -i * pageH;

      pdf.addImage(imgData, "PNG", 0, y, imgW, imgH, undefined, "FAST");
    }

    pdf.save(filename);
    return pdf;
  } finally {
    // cleanup clone
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
