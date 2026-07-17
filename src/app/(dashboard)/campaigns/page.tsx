import { CampaignsManager } from '@/components/admin/campaigns-manager';
import { createAuthServerClient } from '@/lib/supabase-auth-server';

export default async function CampaignsPage() {
  const supabase = await createAuthServerClient();
  const [{ data: campaigns }, { data: ads }, { data: leads }] = await Promise.all([
    supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
    supabase.from('campaign_ads').select('*').order('created_at', { ascending: false }),
    supabase.from('leads_pipeline').select('*'),
  ]);
  return <div className="mx-auto max-w-7xl"><h1 className="text-2xl font-bold">Campanhas e atribuição</h1><p className="mb-6 text-sm text-slate-500">Compare origem, anúncios, conversão e receita sem enviar eventos à Meta.</p><CampaignsManager initialCampaigns={campaigns ?? []} ads={ads ?? []} leads={leads ?? []} /></div>;
}
