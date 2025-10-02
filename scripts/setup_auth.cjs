// Script to create auth tables and add allowed email
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const email = process.argv[2] || 'daniel.rozo@interfundeoms.edu.co';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setupDatabase() {
  try {
    // Read and execute SQL file
    const sqlPath = path.join(__dirname, 'setup_auth_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Creating auth tables...');
    const { error: sqlError } = await supabase.rpc('exec_sql', { sql_text: sql });
    
    if (sqlError) {
      console.log('SQL execution via RPC failed, trying direct table creation...');
      
      // Fallback: Create tables directly
      console.log('Creating roles table...');
      await supabase.from('roles').upsert([
        { name: 'admin', description: 'Full administrative access' },
        { name: 'user', description: 'Standard user access' }
      ]);
      
      console.log('Tables should exist now. Adding allowed email...');
    }
    
    // Add the email to allowed_emails
    console.log(`Adding email ${email} to allowed_emails...`);
    const { data, error } = await supabase.from('allowed_emails').upsert({ 
      email: email.toLowerCase(),
      role_id: null  // Will be assigned based on your business logic
    });
    
    if (error) {
      console.error('Error adding email:', error);
      process.exit(1);
    }
    
    console.log('✅ Email successfully added to allowed_emails:', email);
    console.log('You can now log in with Google OAuth using this email.');
    
  } catch (err) {
    console.error('Setup error:', err);
    process.exit(1);
  }
}

setupDatabase();