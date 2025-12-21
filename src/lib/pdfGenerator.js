
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Converts an image URL to a Base64 Data URL
 * @param {string} url - The URL of the image
 * @returns {Promise<string|null>} - The Data URL or null if failed
 */
const imageUrlToDataUrl = async (url) => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Failed to convert image to Data URL:', error);
    return null;
  }
};

/**
 * Generates a PDF from a DOM element using html2canvas and jsPDF
 * @param {HTMLElement} element - The DOM element to convert to PDF
 * @param {string} filename - The name of the output PDF file
 * @returns {Promise<void>}
 */
export const generatePDFFromElement = async (element, filename = 'document.pdf') => {
  if (!element) {
    throw new Error('Element not found for PDF generation');
  }

  try {
    // Wait a brief moment to ensure any pending renders/fonts are ready
    await new Promise(resolve => setTimeout(resolve, 300));

    // Get the watermark image if it exists to preload as data URL
    const watermarkImg = element.querySelector('img[alt="Watermark"]');
    let watermarkDataUrl = null;

    if (watermarkImg && watermarkImg.src) {
      // Attempt to convert to data URL to avoid CORS issues in html2canvas
      watermarkDataUrl = await imageUrlToDataUrl(watermarkImg.src);
    }

    // Get the full scroll dimensions
    const scrollHeight = element.scrollHeight;
    const scrollWidth = element.scrollWidth;
    const heightBuffer = 500; // Buffer to prevent cutoff

    // Capture the element as a canvas with high quality settings
    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better quality
      useCORS: true, // Enable CORS for images
      logging: false,
      backgroundColor: '#ffffff',
      // Explicitly set dimensions to full scroll size
      width: scrollWidth,
      height: scrollHeight,
      // Ensure window is large enough to render fully without clipping
      windowWidth: scrollWidth,
      windowHeight: scrollHeight + heightBuffer, 
      x: 0,
      y: 0,
      onclone: (clonedDoc) => {
        // If we successfully converted the watermark to a data URL, swap it in the clone
        // This ensures the image renders in the PDF even if cross-origin rules block the original URL
        if (watermarkDataUrl) {
          const clonedWatermark = clonedDoc.querySelector('img[alt="Watermark"]');
          if (clonedWatermark) {
            clonedWatermark.src = watermarkDataUrl;
          }
        }
      }
    });

    // Get canvas dimensions
    const imgWidth = 8.5; // Letter size width in inches
    const pageHeight = 11; // Letter size height in inches
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Convert canvas to image data
    const imgData = canvas.toDataURL('image/png', 1.0);

    // Create PDF with letter size
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'letter'
    });

    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // Add additional pages if content exceeds one page
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    // Save the PDF
    pdf.save(filename);

    return pdf;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

/**
 * Generates a PDF from contract data
 * @param {HTMLElement} element - The contract content element
 * @param {Object} projectInfo - Project information object
 * @returns {Promise<void>}
 */
export const generateContractPDF = async (element, projectInfo, businessProfile) => {
  const clientName = projectInfo?.clientName || 'Client';
  const sanitizedName = clientName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const prefix = (businessProfile?.filenamePrefix || businessProfile?.businessName || 'Proposal')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 25);
  const filename = `${prefix}_Proposal_${sanitizedName}.pdf`;
  return generatePDFFromElement(element, filename);
};
