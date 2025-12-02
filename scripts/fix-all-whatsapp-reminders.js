/**
 * Script to fix WhatsApp reminders for all existing bookings
 * Run this once: node scripts/fix-all-whatsapp-reminders.js
 * 
 * This will schedule WhatsApp reminders for all bookings that don't have them scheduled
 */

require('dotenv').config({ path: '.env.local' });

async function fixAllWhatsAppReminders() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const adminToken = process.env.ADMIN_SECRET_TOKEN;

  if (!adminToken) {
    console.error('❌ ADMIN_SECRET_TOKEN not found in .env.local');
    console.log('Please add ADMIN_SECRET_TOKEN to your .env.local file');
    process.exit(1);
  }

  console.log('🚀 Starting to fix WhatsApp reminders for all bookings...');
  console.log(`📍 Using base URL: ${baseUrl}`);

  try {
    const response = await fetch(`${baseUrl}/api/admin/schedule-all-bookings-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Error:', result.error || result.message);
      process.exit(1);
    }

    console.log('\n✅ Success!');
    console.log(`📊 Results:`);
    console.log(`   - Processed: ${result.processed} bookings`);
    console.log(`   - Skipped: ${result.skipped} bookings`);
    console.log(`   - Scheduled 2-week reminders: ${result.scheduled2w}`);
    console.log(`   - Scheduled 1-week reminders: ${result.scheduled1w}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.errors.length}):`);
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log(`\n📝 Message: ${result.message}`);
    console.log('\n✨ All bookings have been processed!');

  } catch (error) {
    console.error('❌ Failed to fix WhatsApp reminders:', error.message);
    process.exit(1);
  }
}

// Run the script
fixAllWhatsAppReminders();

