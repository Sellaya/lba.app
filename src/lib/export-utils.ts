/**
 * Data Export Utilities
 * Functions to export bookings and reports to CSV, Excel, and PDF
 */

import type { BookingDocument } from '@/firebase/firestore/bookings';
import { formatToronto, parseToronto } from '@/lib/toronto-time';
import { formatPrice } from '@/lib/price-format';

/**
 * Export bookings to CSV
 */
export function exportBookingsToCSV(bookings: BookingDocument[], filename: string = 'bookings') {
  if (bookings.length === 0) {
    alert('No bookings to export');
    return;
  }

  // CSV Headers
  const headers = [
    'Booking ID',
    'Customer Name',
    'Email',
    'Phone',
    'Status',
    'Event Date',
    'Event Time',
    'Location',
    'Service Type',
    'Total Amount',
    'Advance Payment Status',
    'Advance Payment Method',
    'Final Payment Status',
    'Final Payment Method',
    'Payment Method',
    'Created Date',
    'Booking Date',
  ];

  // Convert bookings to CSV rows
  const rows = bookings.map(booking => {
    const quote = booking.finalQuote;
    const day = quote.booking.days[0];
    const totalAmount = quote.selectedQuote 
      ? quote.quotes[quote.selectedQuote].total
      : 0;
    
    const advanceStatus = quote.paymentDetails?.status || 'Not Started';
    const advanceMethod = quote.paymentDetails?.method || '';
    const finalStatus = quote.paymentDetails?.finalPayment?.status || 'Not Started';
    const finalMethod = quote.paymentDetails?.finalPayment?.method || '';
    
    const eventDate = day?.date ? (() => {
      try {
        return formatToronto(parseToronto(day.date, 'PPP'), 'yyyy-MM-dd');
      } catch {
        return day.date;
      }
    })() : 'N/A';

    const createdDate = booking.createdAt instanceof Date
      ? formatToronto(booking.createdAt, 'yyyy-MM-dd HH:mm:ss')
      : booking.createdAt?.toDate
      ? formatToronto(booking.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss')
      : 'N/A';

    return [
      booking.id,
      quote.contact.name,
      quote.contact.email || '',
      quote.contact.phone || '',
      quote.status,
      eventDate,
      day?.getReadyTime || '',
      day?.location || '',
      day?.serviceType || '',
      totalAmount.toFixed(2),
      advanceStatus,
      advanceMethod,
      finalStatus,
      finalMethod,
      advanceMethod || finalMethod || 'N/A',
      createdDate,
      eventDate,
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${formatToronto(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export bookings to Excel (true .xlsx format)
 */
export async function exportBookingsToExcel(bookings: BookingDocument[], filename: string = 'bookings') {
  if (bookings.length === 0) {
    alert('No bookings to export');
    return;
  }

  try {
    // Dynamic import for xlsx - handle both ESM and CommonJS
    const xlsxModule = await import('xlsx');
    const XLSX = xlsxModule.default || xlsxModule;
    
    if (!XLSX || !XLSX.utils) {
      throw new Error('XLSX library not loaded correctly');
    }
    
    // Prepare data
    const data = bookings.map(booking => {
      const quote = booking.finalQuote;
      const day = quote.booking.days[0];
      const totalAmount = quote.selectedQuote 
        ? quote.quotes[quote.selectedQuote].total
        : 0;
      
      const advanceStatus = quote.paymentDetails?.status || 'Not Started';
      const advanceMethod = quote.paymentDetails?.method || '';
      const finalStatus = quote.paymentDetails?.finalPayment?.status || 'Not Started';
      const finalMethod = quote.paymentDetails?.finalPayment?.method || '';
      
      const eventDate = day?.date ? (() => {
        try {
          return formatToronto(parseToronto(day.date, 'PPP'), 'yyyy-MM-dd');
        } catch {
          return day.date;
        }
      })() : 'N/A';

      const createdDate = booking.createdAt instanceof Date
        ? formatToronto(booking.createdAt, 'yyyy-MM-dd HH:mm:ss')
        : booking.createdAt?.toDate
        ? formatToronto(booking.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss')
        : 'N/A';

      return {
        'Booking ID': booking.id,
        'Customer Name': quote.contact.name,
        'Email': quote.contact.email || '',
        'Phone': quote.contact.phone || '',
        'Status': quote.status,
        'Event Date': eventDate,
        'Event Time': day?.getReadyTime || '',
        'Location': day?.location || '',
        'Service Type': day?.serviceType || '',
        'Total Amount': totalAmount,
        'Advance Payment Status': advanceStatus,
        'Advance Payment Method': advanceMethod,
        'Final Payment Status': finalStatus,
        'Final Payment Method': finalMethod,
        'Created Date': createdDate,
      };
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bookings');

    // Write file
    XLSX.writeFile(wb, `${filename}_${formatToronto(new Date(), 'yyyy-MM-dd')}.xlsx`);
  } catch (error) {
    console.error('Excel export error:', error);
    // Fallback to CSV
    exportBookingsToCSV(bookings, filename);
  }
}

/**
 * Generate PDF content for bookings (returns HTML string for PDF generation)
 */
export function generateBookingsPDFContent(bookings: BookingDocument[]): string {
  const rows = bookings.map(booking => {
    const quote = booking.finalQuote;
    const day = quote.booking.days[0];
    const totalAmount = quote.selectedQuote 
      ? quote.quotes[quote.selectedQuote].total
      : 0;
    
    const eventDate = day?.date ? (() => {
      try {
        return formatToronto(parseToronto(day.date, 'PPP'), 'PPP');
      } catch {
        return day.date;
      }
    })() : 'N/A';

    return `
      <tr>
        <td>${booking.id}</td>
        <td>${quote.contact.name}</td>
        <td>${quote.contact.email || ''}</td>
        <td>${quote.status}</td>
        <td>${eventDate}</td>
        <td>$${formatPrice(totalAmount)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Bookings Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #000; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Bookings Report</h1>
        <p>Generated: ${formatToronto(new Date(), 'PPP p')}</p>
        <p>Total Bookings: ${bookings.length}</p>
        <table>
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Customer Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Event Date</th>
              <th>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

/**
 * Export bookings to PDF
 */
export async function exportBookingsToPDF(bookings: BookingDocument[], filename: string = 'bookings') {
  if (bookings.length === 0) {
    alert('No bookings to export');
    return;
  }

  try {
    // Dynamic import to avoid SSR issues
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).jsPDF;
    
    const content = generateBookingsPDFContent(bookings);
    const element = document.createElement('div');
    element.innerHTML = content;
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    document.body.appendChild(element);

    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${filename}_${formatToronto(new Date(), 'yyyy-MM-dd')}.pdf`);
    document.body.removeChild(element);
  } catch (error) {
    console.error('PDF export error:', error);
    // Fallback: open in new window for printing
    const content = generateBookingsPDFContent(bookings);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }
  }
}

/**
 * Export accounting report to CSV
 */
export function exportAccountingReportToCSV(
  metrics: {
    totalRevenue: number;
    totalAdvanceReceived: number;
    totalFinalReceived: number;
    totalPending: number;
    totalQuoted: number;
    stripeRevenue: number;
    interacRevenue: number;
    transactions: Array<{
      id: string;
      customer: string;
      date: string;
      type: 'advance' | 'final';
      amount: number;
      method: 'stripe' | 'interac' | 'pending';
      status: string;
    }>;
  },
  filename: string = 'accounting_report'
) {
  // Summary section
  const summary = [
    ['Accounting Report'],
    ['Generated', formatToronto(new Date(), 'PPP p')],
    [''],
    ['Summary'],
    ['Total Revenue', `$${metrics.totalRevenue.toFixed(2)}`],
    ['Total Advance Received', `$${metrics.totalAdvanceReceived.toFixed(2)}`],
    ['Total Final Received', `$${metrics.totalFinalReceived.toFixed(2)}`],
    ['Total Pending', `$${metrics.totalPending.toFixed(2)}`],
    ['Total Quoted', `$${metrics.totalQuoted.toFixed(2)}`],
    ['Stripe Revenue', `$${metrics.stripeRevenue.toFixed(2)}`],
    ['Interac Revenue', `$${metrics.interacRevenue.toFixed(2)}`],
    [''],
    ['Transactions'],
    ['Booking ID', 'Customer', 'Date', 'Type', 'Method', 'Amount', 'Status'],
  ];

  // Transactions
  const transactions = metrics.transactions.map(t => [
    t.id,
    t.customer,
    t.date,
    t.type,
    t.method,
    t.amount.toFixed(2),
    t.status,
  ]);

  const csvContent = [
    ...summary.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ...transactions.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${formatToronto(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

