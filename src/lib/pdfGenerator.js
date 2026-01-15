import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
 * IMPORTANT: PDF-only layout normalization.
 * This prevents the "giant vertical stretch" we still see on page 1. :contentReference[oaicite:3]{index=3}
 */
function normalizeLayoutForPdf(root) {
  root.querySelectorAll("*").forEach((el) => {
    const cs = getComputedStyle(el);
    const s = el.style;

    // kill vh / screen sizing
    if (cs.minHeight?.includes("vh")) s.minHeight = "auto";
    if (cs.height?.includes("vh")) s.height = "auto";

    // stop flex space spreading
    if (cs.display === "flex") {
      const jc = cs.justifyContent;
      if (jc === "space-between" || jc === "space-around" || jc === "space-evenly") {
        s.justifyContent = "flex-start";
        s.alignContent = "flex-start";
      }
    }
  });
}

/**
 * Render section to PDF page WITHOUT slicing.
 * If section would be taller than one page, we scale it down to fit.
 */
async function addSectionAsSinglePage(pdf, sectionEl, pageIndex) {
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

  if (pageIndex > 0) pdf.addPage();

  // If the captured section is taller than a page, SCALE it down to fit ONE page
  if (imgH > pageH) {
    const scale = pageH / imgH;
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const x = (pageW - drawW) / 2;
    const y = 0; // top align
    pdf.addImage(imgData, "PNG", x, y, drawW, drawH, undefined, "FAST");
  } else {
    pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH, undefined, "FAST");
  }
}

/**
 * MAIN:
 * Requires you to mark page sections with data-pdf-section="page"
 * If not found, it treats whole element as one page.
 */
export async function generatePDFFromElement(element, filename = "document.pdf") {
  if (!element) throw new Error("Element not found for PDF generation");

  const { wrapper, clone } = makeOffscreenClone(element, 816);

  try {
    normalizeLayoutForPdf(clone);
    await waitForFonts();
    await decodeImages(clone);
    await raf(2);

    const sections = Array.from(clone.querySelectorAll('[data-pdf-section="page"]'));
    const pageSections = sections.length ? sections : [clone];

    const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });

    for (let i = 0; i < pageSections.length; i++) {
      await addSectionAsSinglePage(pdf, pageSections[i], i);
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
