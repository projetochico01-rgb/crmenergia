import { Sidebar } from '@/components/layout/sidebar';
import { Navbar } from '@/components/layout/navbar';
import { getAuthenticatedUser } from '@/lib/supabase-auth-server';
import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createAuthServerClient();
  const { data: profile } = await supabase
    .from('crm_user_profiles')
    .select('display_name, role, active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile && !profile.active) {
    redirect('/login?error=inactive');
  }

  const role = profile?.role === 'admin' ? 'admin' : 'atendente';
  const displayName = profile?.display_name || user.email?.split('@')[0] || 'Operador BeHub';

  return (
    <div className="min-h-screen bg-[#020617]">
      <Sidebar role={role} />
      <div className="flex flex-col min-h-screen">
        <Navbar displayName={displayName} role={role} />
        <main className="flex-1 p-4 md:ml-64 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
