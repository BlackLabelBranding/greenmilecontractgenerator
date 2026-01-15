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

/** Offscreen clone to avoid responsive reflow */
function cloneOffscreen(element, fixedPxWidth = 816) {
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-100000px";
  wrapper.style.top = "0";
  wrapper.style.width = `${fixedPxWidth}px`;
  wrapper.style.background = "#fff";
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "-1";

  const clone = element.cloneNode(true);
  clone.style.width = `${fixedPxWidth}px`;
  clone.style.maxWidth = `${fixedPxWidth}px`;
  clone.style.background = "#fff";

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  return { wrapper, clone };
}

/** Normalize layout in clone only */
function normalizeForPdf(root) {
  root.querySelectorAll("*").forEach((el) => {
    const cs = getComputedStyle(el);
    const s = el.style;

    if (cs.minHeight?.includes("vh")) s.minHeight = "auto";
    if (cs.height?.includes("vh")) s.height = "auto";

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
 * FORCE ONE PAGE:
 * - Capture once
 * - Scale to fit BOTH width and height of Letter
 * - Never adds pages
 */
export async function generatePDFFromElement(element, filename = "document.pdf") {
  if (!element) throw new Error("Element not found for PDF generation");

  const { wrapper, clone } = cloneOffscreen(element, 816);

  try {
    normalizeForPdf(clone);

    await waitForFonts();
    await decodeImages(clone);
    await raf(2);

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      windowWidth: 816,
      imageTimeout: 20000,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });

    const pageW = 8.5;
    const pageH = 11;

    const imgData = canvas.toDataURL("image/png", 1.0);

    // image size if we fit by width
    const fitW = pageW;
    const fitH = (canvas.height * fitW) / canvas.width;

    // if height too tall, scale down to fit height
    const scale = fitH > pageH ? pageH / fitH : 1;

    const drawW = fitW * scale;
    const drawH = fitH * scale;

    // center horizontally, top align
    const x = (pageW - drawW) / 2;
    const y = 0;

    // IMPORTANT: never add pages
    pdf.addImage(imgData, "PNG", x, y, drawW, drawH, undefined, "FAST");
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
