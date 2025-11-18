
'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { sendTestEmailAction } from '@/app/test-email';
import { Loader2, MailCheck, MailWarning } from 'lucide-react';

const initialState = {
  success: false,
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sending...
        </>
      ) : (
        'Send Test Email'
      )}
    </Button>
  );
}

export default function TestEmailPage() {
  const [state, formAction] = useActionState(sendTestEmailAction, initialState);

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email Test</CardTitle>
          <CardDescription>
            Click the button below to send a test email to 'orders@looksbyanum.com'
            and an admin notification to 'orders@looksbyanum.com'.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={formAction}>
            <SubmitButton />
          </form>
          {state.message && (
            <Alert variant={state.success ? 'default' : 'destructive'} className={state.success ? 'border-green-500/50 text-green-600 [&>svg]:text-green-600 bg-green-500/10' : ''}>
              {state.success ? <MailCheck className="h-4 w-4" /> : <MailWarning className="h-4 w-4" />}
              <AlertTitle>{state.success ? 'Success' : 'Error'}</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
