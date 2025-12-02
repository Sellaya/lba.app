'use client';

import jsPDF from 'jspdf';
import { formatPrice } from './price-format';
import html2canvas from 'html2canvas';

/**
 * Generates a PDF from a contract HTML element
 * @param elementId - The ID of the HTML element containing the contract
 * @param filename - The filename for the downloaded PDF
 */
export async function generateContractPDFFromElement(
  elementId: string,
  filename: string = 'Service-Agreement.pdf'
): Promise<void> {
  const element = document.getElementById(elementId);
  
  if (!element) {
    throw new Error(`Element with ID "${elementId}" not found`);
  }

  try {
    // Temporarily show the element if it's hidden
    const wasHidden = element.classList.contains('hidden');
    if (wasHidden) {
      element.classList.remove('hidden');
      // Position it off-screen but visible for rendering
      const originalStyle = element.style.cssText;
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      element.style.width = '800px';
      element.style.backgroundColor = '#ffffff';
      
      // Wait a bit for the element to render
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Create canvas from the element
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Restore original state
    if (wasHidden) {
      element.classList.add('hidden');
      element.style.cssText = '';
    }

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    
    let position = 0;
    
    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // Add additional pages if content is longer than one page
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // Download the PDF
    pdf.save(filename);
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

/**
 * Generates a PDF from contract data (alternative method using text rendering)
 * This is a fallback if html2canvas doesn't work well
 */
export async function generateContractPDFFromData(
  quote: any,
  selectedTier: string,
  signedDate: string,
  filename: string = 'Service-Agreement.pdf'
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;
  const margin = 20;
  const lineHeight = 7;
  const maxWidth = pageWidth - (margin * 2);

  // Helper function to add text with word wrap
  const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    const lines = pdf.splitTextToSize(text, maxWidth);
    
    // Check if we need a new page
    if (yPosition + (lines.length * lineHeight) > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
    
    lines.forEach((line: string) => {
      pdf.text(line, margin, yPosition);
      yPosition += lineHeight;
    });
    
    yPosition += 2; // Add spacing after paragraph
  };

  // Title
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Service Agreement', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Date
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Date: ${new Date(signedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 10;

  // Contract content
  addText(`1. Parties`, 14, true);
  addText(`This Service Agreement ("Agreement") is made between ${quote.contact.name} ("Client") and Looks by Anum ("Artist").`, 12, false);
  
  addText(`2. Services`, 14, true);
  addText(`The Artist agrees to provide the following makeup and/or hair services:`, 12, false);
  
  // Add services details
  quote.booking.days.forEach((day: any, index: number) => {
    addText(`${day.serviceName} on ${day.date} at approximately ${day.getReadyTime}. Location: ${day.location}.`, 12, false);
  });

  // Payment section
  const selectedQuote = quote.quotes[selectedTier];
  const depositAmount = selectedQuote.total * 0.5;
  
  addText(`3. Payment`, 14, true);
  addText(`The total fee for the services is $${formatPrice(selectedQuote.total)} (including GST).`, 12, false);
  addText(`A non-refundable deposit of $${formatPrice(depositAmount)} (50%) is required to secure the booking.`, 12, false);
  addText(`The remaining balance of $${formatPrice(selectedQuote.total - depositAmount)} is due on or before the day of the first scheduled service.`, 12, false);

  // Add other sections...
  addText(`4. Client Responsibilities`, 14, true);
  addText(`• Provide accurate and detailed information regarding the desired makeup and hair services.`, 12, false);
  addText(`• Ensure a suitable location with proper lighting and access to an electrical outlet.`, 12, false);
  addText(`• Arrive with clean, dry hair and a clean face, free from any makeup and hair products.`, 12, false);
  addText(`• If there are any parking fees or charges incurred at the location, the client will be responsible for covering those costs.`, 12, false);
  addText(`• Disclose any known allergies, skin conditions, or sensitivities prior to the service.`, 12, false);

  addText(`5. Cancellation Policy`, 14, true);
  addText(`All cancellations must be made in writing. In the event of cancellation by the client, the deposit is non-refundable. If cancellation occurs less than 3 days before the event, the full remaining balance will still be due.`, 12, false);

  addText(`6. Delays`, 14, true);
  addText(`A late fee may be charged if the Client is late for the appointment. The Artist will do their best to accommodate, but cannot guarantee the full service if the Client is significantly delayed.`, 12, false);

  addText(`7. Health and Safety`, 14, true);
  addText(`Client must disclose any allergies, skin conditions, or sensitivities prior to the service. The Artist reserves the right to refuse service for any health-related concerns.`, 12, false);

  addText(`8. Liability`, 14, true);
  addText(`Looks By Anum will not be held responsible for any allergic reactions or injuries that may occur as a result of the services provided, provided that the Artist has followed standard industry practices. The client agrees to indemnify and hold Looks By Anum harmless from any claims or damages arising from the services provided.`, 12, false);

  addText(`9. Agreement`, 14, true);
  addText(`By signing this contract, the Client acknowledges that they have read, understood, and agree to all the terms and conditions outlined in this Agreement.`, 12, false);

  // Signature section
  yPosition += 10;
  if (yPosition > pageHeight - 60) {
    pdf.addPage();
    yPosition = margin;
  }

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  
  // Client signature
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Client Signature:', margin, yPosition);
  yPosition += 5;
  pdf.line(margin, yPosition, margin + 80, yPosition);
  yPosition += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(quote.contact.name, margin, yPosition);
  
  // Date
  yPosition -= 13;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Date:', pageWidth - margin - 80, yPosition);
  yPosition += 5;
  pdf.line(pageWidth - margin - 80, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.text(new Date(signedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - margin - 80, yPosition);

  // Save the PDF
  pdf.save(filename);
}

