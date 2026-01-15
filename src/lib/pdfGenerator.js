// src/lib/pdfGenerator.js
// Drop-in replacement that:
// 1) FIXES the Vercel build error (named exports match your import)
// 2) Makes watermark/logo far more reliable by swapping to data URLs BEFORE render
// 3) Avoids the scrollWidth/scrollHeight sizing that often causes big blank gaps
// 4) Waits for fonts + images (2 RAFs) so the PDF matches your preview

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Convert an image URL into a data URL so html2canvas can't "lose" it due to CORS/async loading.
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
  } catch {
    // ignore
  }
}

async function decodeImages(root) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      try {
        if (!img?.src) return;
        // If already loaded, good.
        if (img.complete && img.naturalWidth > 0) return;
        // decode() is best when available
        if (img.decode) await img.decode();
      } catch {
        // ignore decode errors; still continue
      }
    })
  );
}

function raf(count = 1) {
  return new Promise((resolve) => {
    const step = (n) => {
      if (n <= 0) return resolve();
      requestAnimationFrame(() => step(n - 1));
    };
    step(count);
  });
}

/**
 * Core generator: pass a DOM element and get a saved multi-page letter PDF.
 */
export async function generatePDFFromElement(element, filename = "document.pdf") {
  if (!element) throw new Error("Element not found for PDF generation");

  // Find your watermark/logo images by alt text (matches your current strategy)
  const watermarkImg = element.querySelector('img[alt="Watermark"]');
  const logoImg = element.querySelector('img[alt*="Logo"]');

  // Convert to data URLs up-front (removes CORS + async load races)
  const [watermarkDataUrl, logoDataUrl] = await Promise.all([
    watermarkImg?.src ? imageUrlToDataUrl(watermarkImg.src) : Promise.resolve(null),
    logoImg?.src ? imageUrlToDataUrl(logoImg.src) : Promise.resolve(null),
  ]);

  // Temporarily swap src on the LIVE DOM (most reliable; avoids async onclone issues)
  const original = {
    watermark: watermarkImg?.src,
    logo: logoImg?.src,
  };

  if (watermarkImg && watermarkDataUrl) watermarkImg.src = watermarkDataUrl;
  if (logoImg && logoDataUrl) logoImg.src = logoDataUrl;

  // Ensure everything is truly ready before capture
  await waitForFonts();
  await decodeImages(element);
  await raf(2); // 2 paints helps a lot with "sloppy" layout

  // Capture (do NOT force scrollWidth/scrollHeight — that causes blank space in many layouts)
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    imageTimeout: 15000,
    logging: false,
  });

  // Restore original sources
  if (watermarkImg && original.watermark) watermarkImg.src = original.watermark;
  if (logoImg && original.logo) logoImg.src = original.logo;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
  });

  const pageWidth = 8.5;
  const pageHeight = 11;

  // Fit image to page width
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const imgData = canvas.toDataURL("image/png", 1.0);

  // Multi-page slicing
  let heightLeft = imgHeight;
  let y = 0;

  pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight, undefined, "FAST");
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    // Negative y shifts the same full image upward to show the next "slice"
    y = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
  return pdf;
}

/**
 * Your filename logic wrapper (this is what App.jsx imports).
 * IMPORTANT: this is a NAMED export, matching:
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

// Optional default export (won't hurt anything; useful if you ever switch import style)
export default {
  generatePDFFromElement,
  generateContractPDF,
};
