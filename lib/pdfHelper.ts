import { ReportData } from "@/types";
import { generateReportHtml } from "@/lib/reportHtmlGenerator";

/**
 * PDF Generation Helper - IFRAME ISOLATION APPROACH
 *
 * The root cause of blank PDFs: Tailwind CSS v4 injects oklab() color functions
 * into computed styles globally. html2canvas traverses the entire DOM including
 * inherited/computed styles and silently fails when it encounters oklab().
 *
 * Solution: Render the report HTML inside a hidden IFRAME. The iframe has its own
 * document context, completely isolated from the parent page's Tailwind styles.
 * This is exactly how professional PDF libraries work.
 *
 * Flow:
 * 1. Create a hidden iframe
 * 2. Write our clean HTML (pure inline styles) into the iframe's document
 * 3. Point html2pdf at the iframe's body content
 * 4. html2canvas only sees the iframe's clean DOM - no oklab, no Tailwind
 * 5. Clean up
 */

export async function generatePDF(report: ReportData, filename: string, template: 'standard' | 'modern' | 'minimal' = 'standard', logoUrl?: string) {
    if (!report) {
        alert('Invalid report data.');
        return;
    }

    // Import html2pdf dynamically to avoid SSR issues
    // @ts-ignore
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = html2pdfModule.default || html2pdfModule;

    // 1. Generate the Clean HTML (pure inline styles, no Tailwind)
    const htmlContent = generateReportHtml(report, template, logoUrl);

    // 2. Create a hidden iframe for COMPLETE CSS isolation
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    iframe.style.opacity = '1'; // Must be visible for html2canvas
    document.body.appendChild(iframe);

    // 3. Write clean HTML into the iframe's document
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
        console.error('Could not access iframe document');
        document.body.removeChild(iframe);
        alert('PDF generation failed: Could not create isolated render context.');
        return;
    }

    iframeDoc.open();
    iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    background: #ffffff; 
                    color: #000000; 
                    font-family: Arial, Helvetica, sans-serif;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            </style>
        </head>
        <body>
            ${htmlContent}
        </body>
        </html>
    `);
    iframeDoc.close();

    // 4. Wait for the iframe content to fully render (images, fonts, layout)
    await new Promise(resolve => setTimeout(resolve, 800));

    // 5. Get the content element from inside the iframe
    const contentElement = iframeDoc.body.firstElementChild as HTMLElement || iframeDoc.body;

    // 6. Configure PDF Options - compact margin for single page fit
    const opt = {
        margin: [5, 5, 5, 5] as [number, number, number, number],
        filename: filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: true, // Enable to debug in console
            letterRendering: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            // CRITICAL: Tell html2canvas to use the iframe's window context
            windowWidth: contentElement.scrollWidth || 794, // ~210mm in px
            windowHeight: contentElement.scrollHeight || 1123, // ~297mm in px
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all'] },
    };

    // 7. Generate and Save
    try {
        await html2pdf().set(opt).from(contentElement).save();
    } catch (err: any) {
        console.error('PDF Generation failed:', err);
        alert('PDF generation failed: ' + (err.message || 'Unknown error'));
    } finally {
        // 8. Cleanup
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    }
}
