// src/lib/pdfGenerator.js
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

/**
 * Force PDF-safe layout rules on the element being captured.
 * This prevents flex/vh spacing from stretching the capture.
 */
function normalizeLayoutForPdf(root) {
  root.querySelectorAll("*").forEach((el) => {
    const cs = getComputedStyle(el);
    const s = el.style;

    // kill vh-based heights that create huge empty gaps in capture
    if (cs.minHeight?.includes("vh")) s.minHeight = "auto";
    if (cs.height?.includes("vh")) s.height = "auto";

    // kill flex space distribution that pushes sections apart vertically
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
 * SINGLE-PAGE PDF:
 * - Captures the element once
 * - Scales the image down (if needed) to fit on 8.5x11
 * - Never slices into multiple pages (prevents chopped/duplicated watermark/logo)
 */
export async function generatePDFFromElement(element, filename = "document.pdf") {
  if (!element) throw new Error("Element not found for PDF generation");

  // Temporarily add a marker class (optional) if you want PDF-only CSS later
  element.classList.add("pdf-capture");

  try {
    await waitForFonts();
    await decodeImages(element);
    await raf(2);

    // Apply layout normalization to a cloned subtree (so we don't mess with UI)
    const clone = element.cloneNode(true);
    normalizeLayoutForPdf(clone);

    // Put clone offscreen so computed layout is stable
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-100000px";
    wrapper.style.top = "0";
    wrapper.style.background = "#fff";
    wrapper.style.width = "816px"; // ~8.5in @ 96dpi (good breakpoint lock)
    clone.style.width = "816px";
    clone.style.maxWidth = "816px";
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

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

    document.body.removeChild(wrapper);

    const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });

    const pageW = 8.5;
    const pageH = 11;

    const imgData = canvas.toDataURL("image/png", 1.0);

    // Fit to page width first
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    // If taller than one page, scale DOWN to fit height (prevents multi-page slicing)
    let drawW = imgW;
    let drawH = imgH;
    let x = 0;
    let y = 0;

    if (drawH > pageH) {
      const scale = pageH / drawH;
      drawW = drawW * scale;
      drawH = drawH * scale;
      x = (pageW - drawW) / 2; // center horizontally
      y = 0;
    }

    pdf.addImage(imgData, "PNG", x, y, drawW, drawH, undefined, "FAST");
    pdf.save(filename);
    return pdf;
  } finally {
    element.classList.remove("pdf-capture");
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
