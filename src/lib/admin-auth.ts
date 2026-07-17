import 'server-only';

import { NextResponse } from 'next/server';
import { createAuthServerClient, getAuthenticatedUser } from '@/lib/supabase-auth-server';

export async function requireAdminContext() {
  const user = await getAuthenticatedUser();
  if (!user) return { response: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) };

  const supabase = await createAuthServerClient();
  const { data: profile } = await supabase
    .from('crm_user_profiles')
    .select('role, active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.active || profile.role !== 'admin') {
    return { response: NextResponse.json({ error: 'Acesso exclusivo para administradores.' }, { status: 403 }) };
  }

  return { user, supabase };
}
