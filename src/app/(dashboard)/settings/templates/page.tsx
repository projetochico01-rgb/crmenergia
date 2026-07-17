import { redirect } from 'next/navigation';
import { TemplatesManager } from '@/components/admin/templates-manager';
import { createAuthServerClient, getAuthenticatedUser } from '@/lib/supabase-auth-server';

export default async function TemplatesPage() {
  const user = await getAuthenticatedUser(); if (!user) redirect('/login');
  const supabase = await createAuthServerClient();
  const [{ data: profile }, { data: templates }] = await Promise.all([supabase.from('crm_user_profiles').select('role, active').eq('user_id', user.id).maybeSingle(), supabase.from('message_templates').select('*').order('name').order('version', { ascending: false })]);
  if (!profile?.active || profile.role !== 'admin') redirect('/dashboard');
  return <div className="mx-auto max-w-7xl"><h1 className="text-2xl font-bold">Templates de mensagens</h1><p className="mb-6 text-sm text-slate-500">Crie versões imutáveis para a cadência, que continua desligada.</p><TemplatesManager initialTemplates={templates ?? []} /></div>;
}
