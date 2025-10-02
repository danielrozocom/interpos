import { sbServer } from './supabase';

export async function requireAdmin(event: any) {
  const user = (event.locals as any).user || null;
  if (!user || !user.email) return false;

  // Try to find profile by user id or email
  const { data: profiles, error: profErr } = await sbServer.from('profiles').select('id, role_id').or(`id.eq.${user.id},email.eq.${user.email}`).limit(1);
  if (profErr) {
    console.warn('requireAdmin: profiles lookup error', profErr.message);
    return false;
  }
  const profile = profiles && profiles[0];

  if (profile && profile.role_id) {
    const { data: roles, error: roleErr } = await sbServer.from('roles').select('permissions').eq('id', profile.role_id).limit(1);
    if (roleErr) {
      console.warn('requireAdmin: roles lookup error', roleErr.message);
      return false;
    }
    const role = roles && roles[0];
    if (role && role.permissions && role.permissions.admin) return true;
  }

  // check allowed_emails mapping (if email mapped to role with admin)
  const { data: allowed } = await sbServer.from('allowed_emails').select('role_id').eq('email', user.email).limit(1);
  if (allowed && allowed[0] && allowed[0].role_id) {
    const { data: roles2 } = await sbServer.from('roles').select('permissions').eq('id', allowed[0].role_id).limit(1);
    const role2 = roles2 && roles2[0];
    if (role2 && role2.permissions && role2.permissions.admin) return true;
  }

  return false;
}
