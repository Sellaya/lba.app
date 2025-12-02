# Domain Migration: Sellaya to Looks by Anum

## Changes Made

### Email Configuration
- **Email**: `orders@looksbyanum.com`
- **Admin Email**: `orders@looksbyanum.com`

### Resend API Key
**IMPORTANT**: Update your environment variable with your new Resend API key:

```bash
RESEND_API_KEY=re_QXRCHYrL_5BtSext6ikgmNcLtkMABmsvr
```

**Setup Steps:**
1. Copy your new Resend API key from https://resend.com/api-keys
2. Add it to your `.env.local` file (for local development):
   ```bash
  RESEND_API_KEY=re_QXRCHYrL_5BtSext6ikgmNcLtkMABmsvr
   ```
3. Update your production environment variables (Vercel, Firebase, etc.) with the same key
4. **CRITICAL**: Ensure the API key belongs to the SAME Resend workspace/account where `looksbyanum.com` domain is verified
5. Restart your development server after updating the environment variable

### Files Updated

1. **Email Configuration** (`src/lib/email.ts`)
   - All `fromEmail` changed to `orders@looksbyanum.com`
   - All `adminEmail` changed to `orders@looksbyanum.com`

2. **Email Templates**
   - All email templates updated to use `orders@looksbyanum.com`
   - Interac e-Transfer instructions updated
   - Contact email links updated

3. **Components**
   - Quote confirmation page: Interac payment instructions
   - Contract display: Uses "Looks by Anum"

4. **API Routes**
   - Calendar/ICS file generation: Organizer email updated
   - Test email functionality: Updated test email addresses

### Note on Branding
- "Made by Sellaya" attribution in footers and admin pages has been kept as-is (this is just developer attribution, not business communication)

### Next Steps

1. **Update Environment Variables**:
   - Add `RESEND_API_KEY=re_LnKrfTJx_MoNFChZhMeb3nTWMQM6Fqb1i` to your `.env.local` file
   - Update your production environment variables (Vercel, etc.)

2. **Verify Resend Domain**:
   - Ensure `looksbyanum.com` is verified in your Resend account
   - Ensure `orders@looksbyanum.com` is set up as a sending domain

3. **Test Email Functionality**:
   - Test sending emails from the admin dashboard
   - Verify all email templates are working correctly


