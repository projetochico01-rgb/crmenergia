import { redirect } from 'next/navigation';
import { UsersManager } from '@/components/admin/users-manager';
import { createAuthServerClient, getAuthenticatedUser } from '@/lib/supabase-auth-server';

export default async function UsersPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/login');
  const supabase = await createAuthServerClient();
  const { data: profile } = await supabase.from('crm_user_profiles').select('role, active').eq('user_id', user.id).maybeSingle();
  if (!profile?.active || profile.role !== 'admin') redirect('/dashboard');
  return <div className="mx-auto max-w-7xl space-y-2"><h1 className="text-2xl font-bold">Usuários e acessos</h1><p className="mb-6 text-sm text-slate-500">Gerencie a equipe sem precisar abrir o Supabase.</p><UsersManager /></div>;
}
