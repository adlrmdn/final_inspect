import { createRoot } from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PrintReport } from '../components/workspace/PrintReport';

export const generateReportPdfBase64 = async (
  project: any,
  session: any,
  getCycleName: (cycleNum: number) => string,
  tempDefectImages: any[] = []
): Promise<string> => {
  if (!project || !session) return '';

  // Create a temporary hidden container
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'fixed';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '-9999px';
  tempDiv.style.width = '718px'; // A4 Portrait printable width in pixels at 96dpi
  tempDiv.style.background = '#ffffff';
  tempDiv.style.color = '#000000';
  document.body.appendChild(tempDiv);

  try {
    // Render the PrintReport component into the temp container
    const root = createRoot(tempDiv);
    root.render(
      <PrintReport
        activePackagingProject={project}
        activeSession={session}
        getCycleName={getCycleName}
        tempDefectImages={tempDefectImages}
      />
    );

    // Wait for React component to mount and render completely
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Force styles to override App.css screen media queries
    const printEl = tempDiv.querySelector('.print-report-view') as HTMLElement;
    if (printEl) {
      printEl.style.setProperty('visibility', 'visible', 'important');
      printEl.style.setProperty('display', 'block', 'important');
      printEl.style.setProperty('width', '718px', 'important');
      printEl.style.setProperty('position', 'static', 'important');
      printEl.style.setProperty('background', '#ffffff', 'important');
      printEl.style.setProperty('color', '#0F172A', 'important');
      printEl.style.setProperty('padding', '0', 'important');
      printEl.style.setProperty('margin', '0', 'important');
      printEl.style.setProperty('opacity', '1', 'important');
    }

    const page1El = tempDiv.querySelector('.print-page-1') as HTMLElement;
    const page2El = tempDiv.querySelector('.print-page-2') as HTMLElement;

    if (page1El) {
      page1El.style.setProperty('height', '1039px', 'important');
      page1El.style.setProperty('min-height', '1039px', 'important');
      page1El.style.setProperty('box-sizing', 'border-box', 'important');
      page1El.style.setProperty('overflow', 'hidden', 'important');

      // Mirror @media print zoom: 0.78 on content zone without CSS zoom (unsupported by html2canvas).
      // Widen the zone to 921px (718/0.78) so that after scale(0.78) it fills the 718px parent.
      // Negative margin-bottom collapses the empty layout space left by the transform.
      const contentZone = page1El.querySelector('.print-content-zone') as HTMLElement | null;
      if (contentZone) {
        contentZone.style.setProperty('width', '921px', 'important');
        await new Promise(r => setTimeout(r, 150));
        const zoneH = contentZone.offsetHeight;
        contentZone.style.setProperty('transform', 'scale(0.78)', 'important');
        contentZone.style.setProperty('transform-origin', 'top left', 'important');
        contentZone.style.setProperty('margin-bottom', `${-zoneH * 0.22}px`, 'important');
      }
    }
    if (page2El) {
      page2El.style.setProperty('height', '1039px', 'important');
      page2El.style.setProperty('min-height', '1039px', 'important');
      page2El.style.setProperty('box-sizing', 'border-box', 'important');
    }

    if (!page1El) {
      console.error('Could not find .print-page-1 in rendered container');
      root.unmount();
      document.body.removeChild(tempDiv);
      return '';
    }

    // Initialize jsPDF A4 portrait
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210; // mm
    const pdfHeight = 297; // mm
    const marginX = 10; // mm
    const marginYTop = 12; // mm
    const marginYBottom = 10; // mm
    const printableWidth = pdfWidth - 2 * marginX; // 190 mm
    const printableHeight = pdfHeight - marginYTop - marginYBottom; // 275 mm

    // Helper to render and add page
    const addPageToPdf = async (element: HTMLElement, isFirstPage: boolean) => {
      if (!isFirstPage) {
        pdf.addPage();
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const canvasW = canvas.width;
      const canvasH = canvas.height;
      const ratio = canvasH / canvasW;

      const renderedHeight = printableWidth * ratio;

      if (renderedHeight <= printableHeight) {
        pdf.addImage(imgData, 'JPEG', marginX, marginYTop, printableWidth, renderedHeight, undefined, 'FAST');
      } else {
        const scaleWidth = printableHeight / ratio;
        const xOffset = marginX + (printableWidth - scaleWidth) / 2;
        pdf.addImage(imgData, 'JPEG', xOffset, marginYTop, scaleWidth, printableHeight, undefined, 'FAST');
      }
    };

    // Draw Page 1
    await addPageToPdf(page1El, true);

    // Draw Page 2 if it exists
    if (page2El) {
      await addPageToPdf(page2El, false);
    }

    // Unmount and clean up
    root.unmount();
    document.body.removeChild(tempDiv);

    return pdf.output('datauristring');
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    try {
      document.body.removeChild(tempDiv);
    } catch {}
    return '';
  }
};
