// Quick script to add an email to allowed_emails table in Supabase
// Usage: node scripts/add_allowed_email.js <email> [role_id]

const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const email = process.argv[2];
const role_id = process.argv[3] || null;
if (!email) {
  console.error('Usage: node scripts/add_allowed_email.js <email> [role_id]');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function addAllowedEmail() {
  const { data, error } = await supabase.from('allowed_emails').upsert({ email, role_id });
  if (error) {
    console.error('Error adding email:', error);
    process.exit(1);
  }
  console.log('Email added to allowed_emails:', data);
}

addAllowedEmail();
