import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Convert an image URL into a data URL (reliable for canvas).
 */
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

/**
 * Create an offscreen clone with fixed width so breakpoints don't change.
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
 * Force PDF-safe layout to prevent flex/vh spacing issues.
 */
function forcePdfLayoutStyles(root) {
  root.querySelectorAll("*").forEach((el) => {
    const cs = getComputedStyle(el);
    const s = el.style;

    // Kill vh-based min heights/heights that cause huge gaps
    if (cs.minHeight && cs.minHeight.includes("vh")) s.minHeight = "auto";
    if (cs.height && cs.height.includes("vh")) s.height = "auto";

    // Stop space-between from spreading content across tall containers
    if (cs.display === "flex") {
      if (cs.justifyContent === "space-between" || cs.justifyContent === "space-around") {
        s.justifyContent = "flex-start";
        s.alignContent = "flex-start";
      }
    }
  });
}

/**
 * OPTIONAL watermark per page (consistent). Looks for <img alt="Watermark"> in your source.
 */
function addWatermarkPerPage(pdf, watermarkDataUrl) {
  if (!watermarkDataUrl) return;

  // Try opacity if supported
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

/**
 * Render one "page section" to a PDF page.
 */
async function renderSectionToPdfPage({ sectionEl, pdf, watermarkDataUrl, pageIndex }) {
  const canvas = await html2canvas(sectionEl, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    imageTimeout: 20000,
    windowWidth: 816,
    logging: false,
  });

  const pageW = 8.5;
  const pageH = 11;

  const imgData = canvas.toDataURL("image/png", 1.0);
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  // Start new page after the first section
  if (pageIndex > 0) pdf.addPage();

  // Watermark first so content sits above it
  addWatermarkPerPage(pdf, watermarkDataUrl);

  // If a section is taller than 1 page, we still slice it — but now ONLY that section.
  if (imgH <= pageH) {
    pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH, undefined, "FAST");
    return;
  }

  // Multi-page section: slice by shifting y
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
 * MAIN: section-aware PDF generator.
 *
 * REQUIREMENT: inside `element`, mark page sections with:
 *   data-pdf-section="page"
 *
 * Example:
 *   <div id="pdf-root">
 *     <section data-pdf-section="page"> ... header/client/job ... </section>
 *     <section data-pdf-section="page"> ... scope table ... </section>
 *     <section data-pdf-section="page"> ... totals/details/footer ... </section>
 *   </div>
 */
export async function generatePDFFromElement(element, filename = "document.pdf") {
  if (!element) throw new Error("Element not found for PDF generation");

  // Grab watermark from original DOM if present
  const watermarkImg = element.querySelector('img[alt="Watermark"]');
  const watermarkDataUrl = watermarkImg?.src ? await imageUrlToDataUrl(watermarkImg.src) : null;

  // Clone root offscreen to keep breakpoints stable
  const { wrapper, clone } = makeOffscreenClone(element, 816);

  try {
    forcePdfLayoutStyles(clone);
    await waitForFonts();
    await decodeImages(clone);
    await raf(2);

    // Find sections
    const sections = Array.from(clone.querySelectorAll('[data-pdf-section="page"]'));

    // Fallback: if you forgot sections, treat the whole clone as one page
    const pageSections = sections.length ? sections : [clone];

    const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });

    for (let i = 0; i < pageSections.length; i++) {
      await renderSectionToPdfPage({
        sectionEl: pageSections[i],
        pdf,
        watermarkDataUrl,
        pageIndex: i,
      });
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
