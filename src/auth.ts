import { SvelteKitAuth } from '@auth/sveltekit';
import { authOptions } from '$lib/auth';

// Create the SvelteKitAuth instance with our authOptions.
// Export the handle to be used in hooks.server.ts and helpers for signIn/signOut if needed.
const _sveltekitAuth = SvelteKitAuth(authOptions as any);

export const handle = _sveltekitAuth.handle;
export const signIn = _sveltekitAuth.signIn;
export const signOut = _sveltekitAuth.signOut;

export default _sveltekitAuth;
