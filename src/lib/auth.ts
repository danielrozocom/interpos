// Auth options for SvelteKitAuth (@auth/sveltekit). We keep `any` types to
// avoid pulling in heavy types during svelte-check. This file configures a
// Google provider and a signIn callback that upserts the user into Supabase.
import GoogleProvider from '@auth/core/providers/google';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Create admin client lazily to avoid module-load errors when env vars are missing
let _supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Auth signIn callback requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set in the environment.');
  }
  _supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  return _supabaseAdmin;
}

export const authOptions: any = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_SECRET || ''
    })
  ],

  callbacks: {
    // After successful sign in, ensure the user exists in Supabase auth/users table
    // or a profile table you maintain. This uses the admin/service role key so
    // it must run server-side only (which @auth/sveltekit callbacks do).
    async signIn({ user, account, profile }: any) {
        try {
          if (!user || !user.email) return false;

          const email = (user.email || '').toString().toLowerCase();

          // First: check allowed_emails table. If an entry exists the email is allowed
          // to sign up/login. The entry may optionally include a role_id to assign.
          const supabaseAdmin = getSupabaseAdmin();
          const { data: allowed, error: allowedErr } = await supabaseAdmin.from('allowed_emails').select('role_id').eq('email', email).limit(1);
          if (allowedErr) {
            console.warn('Error reading allowed_emails in signIn callback', allowedErr);
            return false;
          }

          if (allowed && allowed[0]) {
            const role_id = allowed[0].role_id || null;
            await supabaseAdmin.from('profiles').upsert({ id: user.id, email, name: user.name || profile?.name || null, role_id });
            return true;
          }

          // If not present in allowed_emails, see if there's an existing profile with a role.
          const { data: existingProfiles, error: profErr } = await supabaseAdmin.from('profiles').select('role_id').eq('email', email).limit(1);
          if (profErr) {
            console.warn('Error reading profiles in signIn callback', profErr);
            return false;
          }

          if (existingProfiles && existingProfiles[0]) {
            const role_id = existingProfiles[0].role_id || null;
            await supabaseAdmin.from('profiles').upsert({ id: user.id, email, name: user.name || profile?.name || null, role_id });
            return true;
          }

          // Not allowed to sign up/login via Google
          return false;
        } catch (err) {
          console.warn('Error in signIn callback', err);
          return false;
        }
    }
  }
};
