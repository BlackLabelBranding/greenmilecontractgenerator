function normalizeForPdf(root) {
  // 1) Kill vh / min-height tricks
  root.querySelectorAll("*").forEach((el) => {
    const cs = getComputedStyle(el);
    const s = el.style;

    if (cs.minHeight?.includes("vh")) s.minHeight = "auto";
    if (cs.height?.includes("vh")) s.height = "auto";

    // Stop flex vertical spreading
    if (cs.display === "flex") {
      const jc = cs.justifyContent;
      if (jc === "space-between" || jc === "space-around" || jc === "space-evenly") {
        s.justifyContent = "flex-start";
        s.alignContent = "flex-start";
      }
    }
  });

  // 2) Inject PDF-only tightening rules (targets common Tailwind spacing patterns)
  const style = document.createElement("style");
  style.setAttribute("data-pdf-tight", "true");
  style.textContent = `
    /* Reduce big vertical spacing that looks nice on screen but wastes PDF space */
    [data-pdf-tight] .py-8 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
    [data-pdf-tight] .py-10 { padding-top: 1.25rem !important; padding-bottom: 1.25rem !important; }
    [data-pdf-tight] .py-12 { padding-top: 1.5rem !important; padding-bottom: 1.5rem !important; }
    [data-pdf-tight] .pt-10, [data-pdf-tight] .pt-12 { padding-top: 1rem !important; }
    [data-pdf-tight] .pb-10, [data-pdf-tight] .pb-12 { padding-bottom: 1rem !important; }
    [data-pdf-tight] .my-8 { margin-top: 1rem !important; margin-bottom: 1rem !important; }
    [data-pdf-tight] .my-10 { margin-top: 1.25rem !important; margin-bottom: 1.25rem !important; }
    [data-pdf-tight] .my-12 { margin-top: 1.5rem !important; margin-bottom: 1.5rem !important; }
    [data-pdf-tight] .mt-10, [data-pdf-tight] .mt-12 { margin-top: 1rem !important; }
    [data-pdf-tight] .mb-10, [data-pdf-tight] .mb-12 { margin-bottom: 1rem !important; }

    /* If you’re using separators/hr with lots of spacing */
    [data-pdf-tight] hr { margin-top: 0.75rem !important; margin-bottom: 0.75rem !important; }

    /* Keep tables compact */
    [data-pdf-tight] table th, [data-pdf-tight] table td { padding-top: 0.35rem !important; padding-bottom: 0.35rem !important; }
  `;

  // Tag the clone root so selectors apply only there
  root.setAttribute("data-pdf-tight", "true");
  root.appendChild(style);
}
