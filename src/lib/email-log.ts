import { supabaseAdmin } from '@/lib/supabase/server';
import type { ScheduledEmailType } from './scheduled-emails';

type EmailLogStatus = 'processing' | 'sent' | 'skipped' | 'failed';

interface EmailLogEntry {
  scheduledEmailId?: string | null;
  bookingId: string;
  emailType: ScheduledEmailType | 'initial';
  status: EmailLogStatus;
  detail?: string | null;
}

export async function logEmailEvent(entry: EmailLogEntry): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('scheduled_email_logs').insert({
      scheduled_email_id: entry.scheduledEmailId ?? null,
      booking_id: entry.bookingId,
      email_type: entry.emailType,
      status: entry.status,
      detail: entry.detail ?? null,
    });

    if (error) {
      console.warn('[EMAIL LOG] Failed to insert log entry:', error);
    }
  } catch (logError: any) {
    console.warn('[EMAIL LOG] Unexpected error while logging email event:', logError?.message);
  }
}

