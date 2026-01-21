// PDF export functionality
import { getEditorHtml } from './editor.js';

export async function exportNoteToPdf() {
    const title = document.getElementById('noteTitle')?.value?.trim() || 'Untitled Note';
    const content = getEditorHtml();
    
    if (!content || content.trim().length === 0) {
        alert('There is no content to export.');
        return;
    }

    // Check if libraries are loaded
    if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        alert('PDF libraries are not loaded. Please refresh the page.');
        return;
    }

    try {
        // Create a temporary container for PDF rendering
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.width = '210mm'; // A4 width
        tempContainer.style.padding = '20mm';
        tempContainer.style.backgroundColor = '#ffffff';
        tempContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';
        tempContainer.style.color = '#1d1d1f';
        tempContainer.style.lineHeight = '1.6';
        tempContainer.style.fontSize = '14px';
        
        // Create title element
        const titleEl = document.createElement('h1');
        titleEl.textContent = title;
        titleEl.style.marginBottom = '20px';
        titleEl.style.fontSize = '24px';
        titleEl.style.fontWeight = '600';
        titleEl.style.color = '#1d1d1f';
        titleEl.style.borderBottom = '2px solid #e5e5e7';
        titleEl.style.paddingBottom = '10px';
        tempContainer.appendChild(titleEl);
        
        // Create content element
        const contentEl = document.createElement('div');
        contentEl.innerHTML = content;
        contentEl.style.marginTop = '20px';
        // Preserve basic formatting from the editor
        contentEl.style.wordWrap = 'break-word';
        tempContainer.appendChild(contentEl);
        
        document.body.appendChild(tempContainer);
        
        // Capture the content as canvas
        const canvas = await html2canvas(tempContainer, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: tempContainer.offsetWidth,
            height: tempContainer.offsetHeight
        });
        
        // Clean up
        document.body.removeChild(tempContainer);
        
        // Create PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min((pdfWidth - 40) / imgWidth, (pdfHeight - 40) / imgHeight); // 40mm margins
        const imgScaledWidth = imgWidth * ratio;
        const imgScaledHeight = imgHeight * ratio;
        
        // Center the image with margins
        const x = (pdfWidth - imgScaledWidth) / 2;
        let y = 20; // Top margin
        
        // If content is taller than one page, split it
        let heightLeft = imgScaledHeight;
        let position = 0;
        
        pdf.addImage(imgData, 'PNG', x, y + position, imgScaledWidth, imgScaledHeight);
        heightLeft -= (pdfHeight - 40); // Account for margins
        
        while (heightLeft > 0) {
            position = heightLeft - imgScaledHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', x, y + position, imgScaledWidth, imgScaledHeight);
            heightLeft -= (pdfHeight - 40);
        }
        
        // Save the PDF
        const filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'note';
        pdf.save(`${filename}.pdf`);
        
    } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Failed to export PDF. Please try again.');
    }
}
