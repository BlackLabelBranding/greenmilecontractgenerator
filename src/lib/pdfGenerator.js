import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const imageUrlToDataUrl = async (url) => {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  try {
    const response = await fetch(url, { mode: "cors", cache: "no-cache" });
    if (!response.ok) throw new Error(`Failed fetch: ${response.status}`);
    const blob = await response.blob();

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
};

const decodeAllImages = async (root) => {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      try {
        if (!img.src) return;
        if (img.complete && img.naturalWidth > 0) return;
        if (img.decode) await img.decode();
      } catch {}
    })
  );
};

export const generatePDFFromElement = async (element, filename = "document.pdf") => {
  if (!element) throw new Error("Element not found for PDF generation");

  // 1) Convert watermark/logo to data URLs BEFORE canvas render
  const watermarkImg = element.querySelector('img[alt="Watermark"]');
  const logoImg = element.querySelector('img[alt*="Logo"]');

  const [watermarkDataUrl, logoDataUrl] = await Promise.all([
    watermarkImg?.src ? imageUrlToDataUrl(watermarkImg.src) : Promise.resolve(null),
    logoImg?.src ? imageUrlToDataUrl(logoImg.src) : Promise.resolve(null),
  ]);

  // 2) Temporarily swap in the LIVE DOM (most reliable)
  const originalWatermarkSrc = watermarkImg?.src;
  const originalLogoSrc = logoImg?.src;

  if (watermarkImg && watermarkDataUrl) watermarkImg.src = watermarkDataUrl;
  if (logoImg && logoDataUrl) logoImg.src = logoDataUrl;

  // 3) Wait for fonts + images to be ready
  await document.fonts?.ready;
  await decodeAllImages(element);
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));

  // 4) Render
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    imageTimeout: 15000,
    // IMPORTANT: do NOT force width/height unless you absolutely must
  });

  // Restore sources
  if (watermarkImg && originalWatermarkSrc) watermarkImg.src = originalWatermarkSrc;
  if (logoImg && originalLogoSrc) logoImg.src = originalLogoSrc;

  const imgWidth = 8.5;  // inches
  const pageHeight = 11; // inches
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const imgData = canvas.toDataURL("image/png", 1.0);

  const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
  return pdf;
};
