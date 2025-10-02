import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';

export const load: PageServerLoad = async (event) => {
  // Expect the auth middleware to populate event.locals.user
  const user = (event.locals as any).user || null;

  if (!user || !user.email) {
    // Not logged in -> redirect to home (or login)
    throw redirect(303, '/');
  }

  try {
    // Find profile by user id first, then by email as fallback. This avoids
    // constructing `.or(...)` strings which can be fragile with user input.
    const { data: profilesById, error: profIdErr } = await sbServer.from('profiles').select('id, role_id').eq('id', user.id).limit(1);
    if (profIdErr) throw new Error(`profiles select by id error: ${profIdErr.message}`);
    let profile = (profilesById && profilesById[0]) || null;
    if (!profile) {
      const { data: profilesByEmail, error: profEmailErr } = await sbServer.from('profiles').select('id, role_id').eq('email', user.email).limit(1);
      if (profEmailErr) throw new Error(`profiles select by email error: ${profEmailErr.message}`);
      profile = (profilesByEmail && profilesByEmail[0]) || null;
    }

    // If profile has role_id, fetch role and check permission 'admin'
    if (profile && profile.role_id) {
      const { data: roles, error: roleErr } = await sbServer.from('roles').select('id, name, permissions').eq('id', profile.role_id).limit(1);
      if (roleErr) throw new Error(`roles select error: ${roleErr.message}`);
      const role = roles && roles[0];
      const permissions = role?.permissions || {};
      if (permissions && permissions.admin) {
        // authorized
        return { user, profile, role };
      }
    }

    // Also allow an explicit email match in allowed_emails with no role but admin flag
    const { data: allowed, error: allowedErr } = await sbServer.from('allowed_emails').select('id,email,role_id').eq('email', user.email).limit(1);
    if (allowedErr) throw new Error(`allowed_emails select error: ${allowedErr.message}`);
    if (allowed && allowed[0]) {
      // If allowed email maps to a role, check that role's permissions
      const allowedEntry = allowed[0];
      if (allowedEntry.role_id) {
        const { data: roles2, error: role2Err } = await sbServer.from('roles').select('id,name,permissions').eq('id', allowedEntry.role_id).limit(1);
        if (role2Err) throw new Error(`roles select (for allowed_emails) error: ${role2Err.message}`);
        const role2 = roles2 && roles2[0];
        const permissions2 = role2?.permissions || {};
        if (permissions2 && permissions2.admin) return { user, profile, role: role2 };
      }
    }

    // Not authorized
    throw redirect(303, '/');
  } catch (err) {
    console.error('Error checking admin permissions', err);
    throw error(500, 'Error verificando permisos');
  }
};
