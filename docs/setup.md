### Server setup (environment and hosting)

- Required environment variables (create a `.env.local` for local dev and configure hosting env for production):

```
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
# Optional for local server access to Firestore Admin:
# GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

- Firebase client config is already embedded in `src/firebase/config.ts`. No client env needed.

- For Firebase App Hosting:
  - `apphosting.yaml` exists with `maxInstances: 1`. Adjust as needed.
  - Deploy via Firebase CLI after login and project selection:

```bash
firebase login
firebase use <your-project-id>
firebase deploy --only hosting,firestore:rules,storage:rules
```

- To run locally:

```bash
npm install
npm run dev
```

- Notes:
  - Stripe checkout requires both `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (for client-side Stripe.js) and `STRIPE_SECRET_KEY` (for server-side API calls).
  - Email sending requires `RESEND_API_KEY`.
  - Server Firestore access (for `getBooking`) uses Firebase Admin default credentials in prod. For local server actions that hit Firestore Admin, set `GOOGLE_APPLICATION_CREDENTIALS`.

