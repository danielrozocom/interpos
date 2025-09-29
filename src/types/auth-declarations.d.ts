declare module '@auth/sveltekit' {
  import type { AuthOptions } from '@auth/core';
  export function SvelteKitAuth(opts: AuthOptions): any;
  export default SvelteKitAuth;
}

declare module '@auth/core' {
  export type AuthOptions = any;
}

declare module '@auth/core/providers/google' {
  const GoogleProvider: any;
  export default GoogleProvider;
}

declare module '@supabase/auth-helpers-sveltekit' {
  export function handleAuth(): any;
}
