// src/lib/pdfGenerator.js
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ---------- helpers ---------- */

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
 * Clone offscreen at a fixed width so Tailwind breakpoints don't shift
 * during html2canvas rendering.
 *
 * 816px ~= 8.5in @ 96dpi (good stable width).
 */
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

/**
 * Prevent screen-layout tricks (vh, flex space-between) from creating
 * big empty gaps in PDF capture.
 */
function normalizeForPdf(root) {
  root.querySelectorAll("*").forEach((el) => {
    const cs = getComputedStyle(el);
    const s = el.style;

    // kill vh/min-h-screen/h-screen style spacing
    if (cs.minHeight?.includes("vh")) s.minHeight = "auto";
    if (cs.height?.includes("vh")) s.height = "auto";

    // stop vertical spreading from flex layouts
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
 * Tighten spacing in the clone ONLY so the PDF feels "full"
 * without changing your on-screen preview.
 */
function tightenPdfSpacing(root) {
  root.setAttribute("data-pdf-tight", "true");

  const style = document.createElement("style");
  style.setAttribute("data-pdf-tight-style", "true");
  style.textContent = `
    /* General: reduce overly airy screen spacing */
    [data-pdf-tight] hr { margin: 0.6rem 0 !important; }

    /* Common Tailwind spacing classes that often cause big gaps */
    [data-pdf-tight] .py-8 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
    [data-pdf-tight] .py-10 { padding-top: 1.25rem !important; padding-bottom: 1.25rem !important; }
    [data-pdf-tight] .py-12 { padding-top: 1.5rem !important; padding-bottom: 1.5rem !important; }

    [data-pdf-tight] .my-8 { margin-top: 1rem !important; margin-bottom: 1rem !important; }
    [data-pdf-tight] .my-10 { margin-top: 1.25rem !important; margin-bottom: 1.25rem !important; }
    [data-pdf-tight] .my-12 { margin-top: 1.5rem !important; margin-bottom: 1.5rem !important; }

    [data-pdf-tight] .mt-8, 
    [data-pdf-tight] .mt-10, 
    [data-pdf-tight] .mt-12 { margin-top: 1rem !important; }

    [data-pdf-tight] .mb-8, 
    [data-pdf-tight] .mb-10, 
    [data-pdf-tight] .mb-12 { margin-bottom: 1rem !important; }

    /* Compact tables slightly */
    [data-pdf-tight] table th,
    [data-pdf-tight] table td {
      padding-top: 0.35rem !important;
      padding-bottom: 0.35rem !important;
    }
  `;

  root.appendChild(style);
}

/* ---------- main exports ---------- */

/**
 * FORCE ONE PAGE:
 * - Capture once
 * - Scale to fit BOTH width and height of Letter
 * - Never calls pdf.addPage()
 */
export async function generatePDFFromElement(element, filename = "document.pdf") {
  if (!element) throw new Error("Element not found for PDF generation");

  const { wrapper, clone } = cloneOffscreen(element, 816);

  try {
    normalizeForPdf(clone);
    tightenPdfSpacing(clone);

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

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: "letter",
    });

    const pageW = 8.5;
    const pageH = 11;

    const imgData = canvas.toDataURL("image/png", 1.0);

    // Fit by width first
    const fitW = pageW;
    const fitH = (canvas.height * fitW) / canvas.width;

    // Then scale down if too tall
    const scale = fitH > pageH ? pageH / fitH : 1;

    const drawW = fitW * scale;
    const drawH = fitH * scale;

    // Center horizontally, top align
    const x = (pageW - drawW) / 2;
    const y = 0;

    pdf.addImage(imgData, "PNG", x, y, drawW, drawH, undefined, "FAST");
    pdf.save(filename);
    return pdf;
  } finally {
    try {
      document.body.removeChild(wrapper);
    } catch {}
  }
}

/**
 * ✅ Named export required by:
 *   import { generateContractPDF } from '@/lib/pdfGenerator';
 */
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

// Optional default export (harmless, sometimes convenient)
export default { generatePDFFromElement, generateContractPDF };
