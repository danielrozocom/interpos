import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  const user = (event.locals as any).user;
  // Server-side debug: log whether a user was populated for this request
  try {
    console.log('[layout.server] user present?', Boolean(user), user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name || user.user_metadata?.name || user.email } : null);
  } catch (e) {
    console.log('[layout.server] error logging user', e);
  }
  return { user };
};
