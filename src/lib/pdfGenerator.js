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

const preloadImage = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve();
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
    if (img.complete) resolve();
  });

const waitForImagesInRoot = async (root) => {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (!img?.src) return resolve();
          if (img.complete && img.naturalWidth > 0) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
};

export const generatePDFFromElement = async (element, filename = "document.pdf") => {
  if (!element) throw new Error("Element not found for PDF generation");

  await new Promise((r) => setTimeout(r, 500));

  const watermarkImg = element.querySelector('img[alt="Watermark"]');
  const logoImg = element.querySelector('img[alt*="Logo"]');

  const [watermarkDataUrl, logoDataUrl] = await Promise.all([
    watermarkImg?.src ? imageUrlToDataUrl(watermarkImg.src) : Promise.resolve(null),
    logoImg?.src ? imageUrlToDataUrl(logoImg.src) : Promise.resolve(null),
  ]);

  const imgs = Array.from(element.querySelectorAll("img"));
  await Promise.all(imgs.map((img) => preloadImage(img.src)));

  const scrollHeight = element.scrollHeight;
  const scrollWidth = element.scrollWidth;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    width: scrollWidth,
    height: scrollHeight,
    windowWidth: scrollWidth,
    windowHeight: scrollHeight + 1000,
    imageTimeout: 15000,

    onclone: async (clonedDoc) => {
      if (clonedDoc?.body) {
        clonedDoc.body.style.width = `${scrollWidth}px`;
        clonedDoc.body.style.height = `${scrollHeight}px`;
      }

      clonedDoc.querySelectorAll("img").forEach((img) => {
        img.setAttribute("crossorigin", "anonymous");
      });

      if (watermarkDataUrl) {
        const w = clonedDoc.querySelector('img[alt="Watermark"]');
        if (w) w.src = watermarkDataUrl;
      }

      if (logoDataUrl) {
        const l = clonedDoc.querySelector('img[alt*="Logo"]');
        if (l) l.src = logoDataUrl;
      }

      await waitForImagesInRoot(clonedDoc);
    },
  });

  const imgWidth = 8.5;
  const pageHeight = 11;
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

export const generateContractPDF = async (element, projectInfo, businessProfile) => {
  const clientName = projectInfo?.clientName || "Client";
  const sanitized = String(clientName)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 60);

  const prefix = (businessProfile?.filenamePrefix || "GreenMile").replace(/[^a-zA-Z0-9]/g, "");
  const filename = `${prefix}_Proposal_${sanitized}.pdf`;

  return generatePDFromElement(element, file
