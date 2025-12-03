'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Loader2, Mail, Phone, MapPin, Globe } from 'lucide-react';
import { formatToronto, parseToronto } from '@/lib/toronto-time';
import { formatPrice } from '@/lib/price-format';
import type { BookingDocument } from '@/firebase/firestore/bookings';
import { STUDIO_ADDRESS } from '@/lib/services';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface InvoiceGeneratorProps {
  booking: BookingDocument;
}

export function InvoiceGenerator({ booking }: InvoiceGeneratorProps) {
  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => {
    // Generate invoice number from booking ID
    return `INV-${booking.id.substring(0, 8).toUpperCase()}`;
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const quote = booking.finalQuote;
  const day = quote.booking.days[0];
  const selectedQuoteData = quote.selectedQuote && quote.quotes[quote.selectedQuote]
    ? quote.quotes[quote.selectedQuote]
    : null;

  const totalAmount = selectedQuoteData?.total || 0;
  const subtotal = selectedQuoteData?.subtotal || 0;
  const tax = selectedQuoteData?.tax || 0;

  const eventDate = day?.date ? (() => {
    try {
      return formatToronto(parseToronto(day.date, 'PPP'), 'PPP');
    } catch {
      return day.date;
    }
  })() : 'N/A';

  const invoiceDate = formatToronto(new Date(), 'PPP');

  // Get payment breakdown
  const paymentDetails = quote.paymentDetails;
  const advancePayment = paymentDetails?.depositAmount || 0;
  const finalPayment = paymentDetails?.finalPayment?.amount || 0;
  const isFullyPaid = paymentDetails?.finalPayment?.status === 'payment-approved' || 
                      paymentDetails?.finalPayment?.status === 'deposit-paid';
  const isAdvancePaid = paymentDetails?.status === 'deposit-paid' || 
                        paymentDetails?.status === 'payment-approved';

  const generateInvoicePDF = async () => {
    setIsGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).jsPDF;

      const invoiceElement = document.getElementById('invoice-content');
      if (!invoiceElement) {
        throw new Error('Invoice content not found');
      }

      const canvas = await html2canvas(invoiceElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

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

      pdf.save(`Invoice_${invoiceNumber}_${formatToronto(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Invoice generation error:', error);
      alert('Failed to generate invoice. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="rounded-xl border border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base md:text-lg flex items-center gap-2">
          <FileText className="h-4 w-4 md:h-5 md:w-5" />
          Invoice Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Invoice Number */}
        <div className="space-y-2">
          <Label className="text-xs md:text-sm">Invoice Number</Label>
          <Input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="INV-XXXXXXX"
            className="h-9 md:h-10 text-xs md:text-sm"
          />
        </div>

        {/* Hidden Invoice Content for PDF Generation (kept in DOM for PDF generation) */}
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '210mm', backgroundColor: 'white', padding: '24px' }}>
          <div id="invoice-content" className="space-y-6 max-w-4xl mx-auto bg-white p-4 md:p-6">
            {/* Header with Logo and Company Info */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 pb-6 border-b-2 border-black">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 md:w-24 md:h-24 flex-shrink-0">
                  <Image
                    src="/LBA.png"
                    alt="Looks by Anum Logo"
                    fill
                    className="object-contain"
                    priority
                    sizes="96px"
                  />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-black tracking-tight">Looks by Anum</h1>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">
                    Professional Makeup & Hair Services
                  </p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-3xl md:text-4xl font-bold text-black mb-2">INVOICE</h2>
                <div className="space-y-1 text-xs md:text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-black">Invoice #:</span> {invoiceNumber}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-black">Date:</span> {invoiceDate}
                  </p>
                </div>
              </div>
            </div>

            {/* Company Details and Bill To */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {/* Company Details */}
              <div className="space-y-3">
                <h3 className="text-sm md:text-base font-bold text-black uppercase tracking-wide">From:</h3>
                <div className="space-y-1.5 text-xs md:text-sm">
                  <p className="font-semibold text-black">Looks by Anum</p>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 mt-0.5 shrink-0" />
                    <div>
                      <p>{STUDIO_ADDRESS.street}</p>
                      <p>{STUDIO_ADDRESS.city}, {STUDIO_ADDRESS.province} {STUDIO_ADDRESS.postalCode}</p>
                      <p>{STUDIO_ADDRESS.country}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground mt-2">
                    <Globe className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
                    <a href="https://looksbyanum.com" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">
                      looksbyanum.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div className="space-y-3">
                <h3 className="text-sm md:text-base font-bold text-black uppercase tracking-wide">Bill To:</h3>
                <div className="space-y-1.5 text-xs md:text-sm">
                  <p className="font-semibold text-black">{quote.contact.name}</p>
                  {quote.contact.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
                      <a href={`mailto:${quote.contact.email}`} className="hover:text-black transition-colors break-all">
                        {quote.contact.email}
                      </a>
                    </div>
                  )}
                  {quote.contact.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
                      <span>{quote.contact.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Booking Details */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border">
              <h3 className="text-sm md:text-base font-bold text-black uppercase tracking-wide mb-3">Booking Details:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
                <div>
                  <span className="text-muted-foreground">Booking ID:</span>
                  <span className="ml-2 font-mono font-semibold text-black">{booking.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Event Date:</span>
                  <span className="ml-2 font-semibold text-black">{eventDate}</span>
                </div>
                {day?.getReadyTime && (
                  <div>
                    <span className="text-muted-foreground">Time:</span>
                    <span className="ml-2 font-semibold text-black">{day.getReadyTime}</span>
                  </div>
                )}
                {day?.location && (
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <span className="ml-2 font-semibold text-black">{day.location}</span>
                  </div>
                )}
                {day?.serviceName && (
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground">Service:</span>
                    <span className="ml-2 font-semibold text-black">{day.serviceName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border-t-2 border-black pt-4">
              <h3 className="text-sm md:text-base font-bold text-black uppercase tracking-wide mb-4">Services:</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black">
                      <th className="text-left py-2 px-3 text-xs md:text-sm font-bold text-black">Description</th>
                      <th className="text-right py-2 px-3 text-xs md:text-sm font-bold text-black">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuoteData?.lineItems && selectedQuoteData.lineItems.length > 0 ? (
                      selectedQuoteData.lineItems.map((item, index) => (
                        <tr key={index} className="border-b border-border">
                          <td className="py-3 px-3 text-xs md:text-sm text-foreground">{item.description}</td>
                          <td className="py-3 px-3 text-xs md:text-sm text-right font-medium text-black">
                            ${formatPrice(item.price)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="py-4 px-3 text-xs md:text-sm text-center text-muted-foreground">
                          No line items available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full md:w-80 space-y-2 border-t-2 border-black pt-4">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium text-black">${formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-muted-foreground">Tax (HST 13%):</span>
                  <span className="font-medium text-black">${formatPrice(tax)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-base md:text-lg font-bold border-t-2 border-black pt-2">
                  <span className="text-black">Total:</span>
                  <span className="text-black">${formatPrice(totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            {(isAdvancePaid || isFullyPaid) && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h3 className="text-sm md:text-base font-bold text-black uppercase tracking-wide mb-3">Payment Information:</h3>
                <div className="space-y-2 text-xs md:text-sm">
                  {isAdvancePaid && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Advance Payment (50%):</span>
                      <span className="font-semibold text-green-700 dark:text-green-400">
                        ${formatPrice(advancePayment)} ✓
                      </span>
                    </div>
                  )}
                  {isFullyPaid && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Final Payment (50%):</span>
                      <span className="font-semibold text-green-700 dark:text-green-400">
                        ${formatPrice(finalPayment)} ✓
                      </span>
                    </div>
                  )}
                  {isFullyPaid && (
                    <div className="flex justify-between pt-2 border-t border-green-200 dark:border-green-800">
                      <span className="font-bold text-black">Total Paid:</span>
                      <span className="font-bold text-green-700 dark:text-green-400">
                        ${formatPrice(totalAmount)} ✓
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment Status Badge */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm text-muted-foreground">Payment Status:</span>
                <Badge
                  variant={
                    isFullyPaid
                      ? 'default'
                      : isAdvancePaid
                      ? 'default'
                      : paymentDetails?.status === 'deposit-pending'
                      ? 'secondary'
                      : 'secondary'
                  }
                  className={cn(
                    "text-xs",
                    isFullyPaid && "bg-green-600 hover:bg-green-700 text-white",
                    isAdvancePaid && !isFullyPaid && "bg-blue-600 hover:bg-blue-700 text-white"
                  )}
                >
                  {isFullyPaid
                    ? 'Fully Paid'
                    : isAdvancePaid
                    ? 'Advance Paid'
                    : paymentDetails?.status === 'deposit-pending'
                    ? 'Pending Payment'
                    : 'Unpaid'}
                </Badge>
              </div>
              {paymentDetails?.method && (
                <span className="text-xs md:text-sm text-muted-foreground">
                  Payment Method: {paymentDetails.method === 'stripe' ? 'Credit Card' : 'Interac e-Transfer'}
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="border-t-2 border-black pt-6 mt-6">
              <div className="text-center space-y-2">
                <p className="text-sm md:text-base font-semibold text-black">
                  Thank you for choosing Looks by Anum!
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  We look forward to making you look beautiful on your special day.
                </p>
                <div className="flex items-center justify-center gap-4 pt-4 text-xs text-muted-foreground">
                  <a href="https://looksbyanum.com" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">
                    looksbyanum.com
                  </a>
                  <span>•</span>
                  <span>{STUDIO_ADDRESS.city}, {STUDIO_ADDRESS.province}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Download Button */}
        <Button
          onClick={generateInvoicePDF}
          disabled={isGenerating}
          className="w-full h-10 md:h-11 touch-manipulation active:scale-95 transition-all"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download Invoice PDF
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
