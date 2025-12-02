# Order Status Matrix - Complete Logic Reference

This document outlines all possible order status combinations and the corresponding messages displayed on the confirmation page.

## Status Flow Overview

1. **Initial Quote** → User receives quote
2. **Package Selected** → User selects lead or team package
3. **Contract Signed** → User agrees to terms
4. **Advance Payment** → User pays 50% deposit
5. **Payment Approval** → Admin approves payment (for Interac)
6. **Final Payment** → User pays remaining 50%
7. **Final Payment Approval** → Admin approves final payment (for Interac)

---

## Status Combinations & Messages

### 1. Initial Quote (No Payment)
**Conditions:**
- `status = 'quoted'`
- No `paymentDetails` exists

**Title:** `Your Quote is Ready!`
**Description:** `Thank you, {name}. Please review your quotes and follow the steps below to confirm your booking.`
**Icon:** CheckCircle2 (primary color)

---

### 2. Advance Payment Pending (Interac)
**Conditions:**
- `status = 'confirmed'`
- `paymentDetails.status = 'deposit-pending'`
- `paymentDetails.method = 'interac'`
- No `finalPayment` exists

**Title:** `Awaiting Payment Approval`
**Description:** `Thank you, {name}. We have received your screenshot for payment approval. Once it is reviewed and approved, you will receive a confirmation email within the next 24 hours.`
**Icon:** CheckCircle2 (primary color)

---

### 3. Advance Payment Pending (Stripe)
**Conditions:**
- `status = 'confirmed'`
- `paymentDetails.status = 'deposit-pending'`
- `paymentDetails.method = 'stripe'`
- No `finalPayment` exists

**Title:** `Booking Confirmed!`
**Description:** `Thank you, {name}. Your booking with {package} is confirmed. A confirmation email will be sent to you shortly.`
**Icon:** ShieldCheck (green)

---

### 4. Advance Payment Screenshot Rejected
**Conditions:**
- `status = 'confirmed'`
- `paymentDetails.status = 'screenshot-rejected'`
- No `finalPayment` exists

**Title:** `Screenshot Rejected`
**Description:** `Thank you, {name}. Your payment screenshot could not be verified. Please upload the correct screenshot to proceed with your booking.`
**Icon:** CheckCircle2 (primary color)

---

### 5. Advance Payment Approved/Paid - Final Payment Not Started
**Conditions:**
- `status = 'confirmed'`
- `paymentDetails.status = 'payment-approved'` OR `'deposit-paid'`
- No `finalPayment` exists OR `finalPayment` is undefined

**Title:** `Payment Approved – Booking Confirmed`
**Description:** `Thank you, {name}. Your advance payment has been approved and your booking is confirmed! The remaining 50% balance is due on or before the day of your service.`
**Icon:** ShieldCheck (green)

**Payment Summary Shows:**
- ✅ 50% Advance Payment (Paid): $X.XX
- ⏳ 50% Remaining Balance (Due on Booking Day): $X.XX
- "Pay Remaining Balance" button visible

---

### 6. Advance Payment Approved/Paid - Final Payment Pending (Interac)
**Conditions:**
- `status = 'confirmed'`
- `paymentDetails.status = 'payment-approved'` OR `'deposit-paid'`
- `finalPayment.status = 'deposit-pending'`
- `finalPayment.method = 'interac'`

**Title:** `Final Payment Pending Approval`
**Description:** `Thank you, {name}. We have received your final payment screenshot for approval. Once it is reviewed and approved, you will receive confirmation within 24 hours.`
**Icon:** ShieldCheck (green)

**Payment Summary Shows:**
- ✅ 50% Advance Payment (Paid): $X.XX
- ⏳ 50% Final Payment (Pending Approval): $X.XX
- Message: "Your final payment screenshot is being reviewed. Once approved, you will receive confirmation."

---

### 7. Advance Payment Approved/Paid - Final Payment Pending (Stripe)
**Conditions:**
- `status = 'confirmed'`
- `paymentDetails.status = 'payment-approved'` OR `'deposit-paid'`
- `finalPayment.status = 'deposit-pending'`
- `finalPayment.method = 'stripe'`

**Title:** `Final Payment Pending Approval`
**Description:** `Thank you, {name}. Your final payment is being processed. You will receive confirmation shortly.`
**Icon:** ShieldCheck (green)

**Payment Summary Shows:**
- ✅ 50% Advance Payment (Paid): $X.XX
- ⏳ 50% Final Payment (Pending Approval): $X.XX

---

### 8. Advance Payment Approved/Paid - Final Payment Screenshot Rejected
**Conditions:**
- `status = 'confirmed'`
- `paymentDetails.status = 'payment-approved'` OR `'deposit-paid'`
- `finalPayment.status = 'screenshot-rejected'`

**Title:** `Final Payment Screenshot Rejected`
**Description:** `Thank you, {name}. Your final payment screenshot could not be verified. Please upload the correct screenshot to complete your booking.`
**Icon:** ShieldCheck (green)

**Payment Summary Shows:**
- ✅ 50% Advance Payment (Paid): $X.XX
- ❌ 50% Final Payment (Required): $X.XX
- "Re-upload Final Payment Screenshot" button visible
- Error message: "Please upload the correct screenshot to proceed with your final payment."

---

### 9. Fully Paid - Both Payments Complete
**Conditions:**
- `status = 'confirmed'`
- `paymentDetails.status = 'payment-approved'` OR `'deposit-paid'`
- `finalPayment.status = 'payment-approved'` OR `'deposit-paid'`

**Title:** `Payment Complete – Booking Confirmed`
**Description:** `Thank you, {name}. Your booking is fully paid and confirmed! We look forward to serving you on your special day.`
**Icon:** ShieldCheck (green)

**Payment Summary Shows:**
- ✅ 50% Advance Payment (Paid): $X.XX
- ✅ 50% Final Payment (Paid): $X.XX
- Total: $X.XX (fully paid)

---

## Payment Status Priority Order

When determining which message to show, check statuses in this order (highest priority first):

1. **Final Payment Status** (if exists)
   - `screenshot-rejected` → Show final payment rejection message
   - `deposit-pending` → Show final payment pending message
   - `payment-approved` or `deposit-paid` → Show fully paid message

2. **Advance Payment Status** (if final payment doesn't exist or is not applicable)
   - `screenshot-rejected` → Show advance payment rejection message
   - `deposit-pending` (Interac) → Show awaiting approval message
   - `deposit-pending` (Stripe) → Show booking confirmed message
   - `payment-approved` or `deposit-paid` → Show advance payment approved message

3. **Booking Status**
   - `confirmed` → Show booking confirmed message
   - `quoted` → Show initial quote message

---

## UI Elements Visibility

### Step Indicator
- **Visible when:** `!bookingConfirmed || paymentDetails?.status === 'screenshot-rejected'`
- **Hidden when:** Booking is fully confirmed and no issues

### Payment Summary Section
- **Visible when:** `(bookingConfirmed || paymentDetails) && selectedQuote`
- Shows different content based on payment statuses

### Final Payment Section
- **Visible when:** `showFinalPayment && (paymentDetails?.status === 'payment-approved' || paymentDetails?.status === 'deposit-paid') && selectedQuote`
- Shows when user clicks "Pay Remaining Balance" button

### Footer Buttons
- **Visible when:** `!bookingConfirmed || paymentDetails?.status === 'screenshot-rejected'`
- **Hidden when:** Booking is fully confirmed and no action needed

---

## Testing Checklist

- [ ] Initial quote display
- [ ] Advance payment pending (Interac)
- [ ] Advance payment pending (Stripe)
- [ ] Advance payment screenshot rejected
- [ ] Advance payment approved, final payment not started
- [ ] Final payment pending (Interac)
- [ ] Final payment pending (Stripe)
- [ ] Final payment screenshot rejected
- [ ] Fully paid status

---

## Notes

- All messages are personalized with the user's name
- Payment amounts are calculated as 50% of total quote
- Interac payments require admin approval, Stripe payments are instant
- Final payment can only be made after advance payment is approved
- Contract is included in email when advance payment is approved















