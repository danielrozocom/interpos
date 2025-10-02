// Quick script to add allowed email to the database
// Run this once: node scripts/add-allowed-email.js

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function addAllowedEmail() {
  try {
    // First, check if we have any roles to assign (get admin role if exists)
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, name')
      .eq('name', 'admin')
      .limit(1);

    if (rolesError) {
      console.warn('Error fetching roles:', rolesError);
    }

    const adminRoleId = roles && roles[0] ? roles[0].id : null;
    console.log('Admin role ID:', adminRoleId);

    // Add the email to allowed_emails
    const email = 'daniel.rozo@interfundeoms.edu.co';
    const { data, error } = await supabase
      .from('allowed_emails')
      .upsert({ 
        email: email, 
        role_id: adminRoleId  // Assign admin role if available
      })
      .select();

    if (error) {
      console.error('Error adding allowed email:', error);
    } else {
      console.log('✅ Successfully added allowed email:', data);
      
      // Also check/create the profile entry
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          email: email,
          name: 'Daniel Josue Rozo Vargas',
          role_id: adminRoleId
        })
        .select();

      if (profileError) {
        console.warn('Error updating profile:', profileError);
      } else {
        console.log('✅ Profile updated:', profile);
      }
    }
  } catch (err) {
    console.error('Script error:', err);
  }
}

addAllowedEmail();