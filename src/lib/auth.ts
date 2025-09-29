import GoogleProvider from '@auth/core/providers/google';
import { SvelteKitAuth } from '@auth/sveltekit';
import type { AuthOptions } from '@auth/core';
import { sbServer } from './supabase';
import dotenv from 'dotenv';

// Ensure .env is loaded when running the dev server so process.env values are available
dotenv.config({ path: process.cwd() + '/.env' });

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

// Fallback lookup for allowed users via Supabase
async function findUserByEmail(email: string) {
  try {
    const { data, error } = await sbServer.from('users').select('name,email,role').eq('email', email).limit(1).maybeSingle();
    if (!error && data && data.email) return { name: data.name || '', email: data.email, role: data.role || '' };

    const res2 = await sbServer.from('Customers').select('Name,Email').ilike('Email', email).limit(1).maybeSingle();
    if (!res2.error && res2.data) return { name: res2.data.Name || '', email: res2.data.Email || '', role: '' };

    return null;
  } catch (e) {
    console.error('findUserByEmail error:', e);
    return null;
  }
}

export const authOptions: AuthOptions = {
  secret: AUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
    })
  ],
  callbacks: {
    // signIn callback: allow only if email exists in Supabase users table or in Google Sheet
    async signIn({ user, profile }: any) {
      try {
        const email = (user?.email || profile?.email || '').toString().trim().toLowerCase();
        if (!email) return false;

        // 1) Try Supabase lookup
        try {
          const { data, error } = await sbServer.from('users').select('name,email,role').eq('email', email).limit(1).maybeSingle();
          if (error) {
            console.warn('[auth] supabase lookup error', error.message || error);
          }
          if (data && data.email) {
            (user as any).role = data.role;
            (user as any).name = data.name || user.name;
            return true;
          }
        } catch (e) {
          console.warn('[auth] supabase lookup exception', e);
        }

        // 2) Fallback to Google Sheets lookup if Supabase misses
        const matched = await findUserByEmail(String(email));
        if (!matched) return false;
        (user as any).role = matched.role;
        (user as any).name = matched.name || user.name;
        return true;
      } catch (e) {
        console.error('signIn callback error:', e);
        return false;
      }
    },
    async jwt({ token, user }: any) {
      if (user && (user as any).role) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }: any) {
      (session as any).user = (session as any).user || {};
      if (token?.role) (session as any).user.role = token.role;
      return session;
    }
  }
};

export default authOptions;

// Export the SvelteKitAuth handlers so hooks can use them
export const { handle, signIn, signOut } = SvelteKitAuth(authOptions as any);
