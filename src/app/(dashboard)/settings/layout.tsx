import { redirect } from 'next/navigation';
import { createAuthServerClient, getAuthenticatedUser } from '@/lib/supabase-auth-server';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/login');
  const supabase = await createAuthServerClient();
  const { data: profile } = await supabase.from('crm_user_profiles').select('role, active').eq('user_id', user.id).maybeSingle();
  if (!profile?.active || profile.role !== 'admin') redirect('/dashboard');
  return children;
}
