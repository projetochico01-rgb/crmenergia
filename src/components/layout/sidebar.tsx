'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  ChevronRight,
  FileText,
  LayoutDashboard,
  ListRestart,
  MessagesSquare,
  PlugZap,
  ScrollText,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const menuGroups = [
  {
    label: 'Operação',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
      { icon: Users, label: 'Leads', href: '/leads' },
      { icon: MessagesSquare, label: 'Atendimento', href: '/crm' },
      { icon: BarChart3, label: 'Campanhas', href: '/campaigns' },
    ],
  },
  {
    label: 'Administração',
    admin: true,
    items: [
      { icon: ShieldCheck, label: 'Usuários', href: '/settings/users' },
      { icon: FileText, label: 'Templates', href: '/settings/templates' },
      { icon: ListRestart, label: 'Cadência', href: '/settings/cadence' },
      { icon: ScrollText, label: 'Auditoria', href: '/settings/audit' },
      { icon: PlugZap, label: 'Integrações', href: '/settings/integrations' },
      { icon: Settings2, label: 'Conversões Meta', href: '/settings/conversions' },
    ],
  },
];

export const navigationGroups = menuGroups;

export function Sidebar({ role }: { role: 'admin' | 'atendente' }) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Operação: true,
    Administração: true,
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-slate-800 bg-[#020617] md:flex">
      <div className="flex items-center gap-3 p-5">
        <div className="h-11 w-11 overflow-hidden rounded-xl bg-white p-1 shadow-lg shadow-amber-400/10">
          <Image src="/behub-symbol.png" alt="Símbolo BeHub" width={44} height={44} className="h-full w-full object-contain" priority />
        </div>
        <div>
          <span className="block text-xl font-bold tracking-tight text-white">BeHub</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-400">CRM Energia</span>
        </div>
      </div>

      <nav className="custom-scrollbar flex-1 overflow-y-auto px-4" aria-label="Navegação principal">
        {menuGroups.filter((group) => !group.admin || role === 'admin').map((group) => {
          const isExpanded = expandedGroups[group.label];
          return (
            <div key={group.label} className="mb-6">
              <button
                type="button"
                onClick={() => setExpandedGroups((current) => ({ ...current, [group.label]: !current[group.label] }))}
                className="mb-2 flex w-full items-center justify-between px-3 py-1 text-slate-500 transition hover:text-slate-300"
                aria-expanded={isExpanded}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest">{group.label}</span>
                <ChevronRight className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-90')} />
              </button>
              <div className={cn('space-y-1 overflow-hidden transition-all', isExpanded ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0')}>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link key={item.href} href={item.href} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-amber-400/10 text-amber-300' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white')}>
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="mb-1 text-xs font-medium text-slate-500">Status do sistema</p>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> CRM operacional
          </div>
          <p className="mt-2 text-[11px] text-slate-600">Automações permanecem desligadas.</p>
        </div>
      </div>
    </aside>
  );
}
