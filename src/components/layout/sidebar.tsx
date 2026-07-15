'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Settings,
  ChevronRight,
  Zap,
  UserCheck,
  MessagesSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { useState } from 'react';

const menuGroups = [
  {
    label: 'Menu Principal',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
      { icon: Users, label: 'Leads', href: '/leads' },
      { icon: MessagesSquare, label: 'Omnichannel', href: '/crm' },
    ]
  },
  {
    label: 'Gestão',
    items: [
      { icon: UserCheck, label: 'Clientes', href: '/clients' },
      { icon: DollarSign, label: 'Financeiro', href: '/billing' },
    ]
  },
  {
    label: 'Configurações',
    items: [
      { icon: Zap, label: 'Automações', href: '/automations' },
      { icon: Settings, label: 'Configurações', href: '/settings' },
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Menu Principal': true,
    'Gestão': true,
    'Configurações': true,
  });

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  return (
    <aside className="w-64 h-screen bg-[#020617] border-r border-slate-800 flex flex-col fixed left-0 top-0 z-50">
      <div className="p-5 flex items-center gap-3">
        <div className="h-11 w-11 overflow-hidden rounded-xl bg-white p-1 shadow-lg shadow-amber-400/10">
          <Image src="/behub-symbol.png" alt="Símbolo BeHub" width={44} height={44} className="h-full w-full object-contain" priority />
        </div>
        <div>
          <span className="block text-xl font-bold tracking-tight text-white">BeHub</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-400">CRM Energia</span>
        </div>
      </div>

      <nav className="flex-1 px-4 overflow-y-auto">
        {menuGroups.map((group, idx) => {
          const isExpanded = expandedGroups[group.label];
          return (
            <div key={group.label} className={cn("mb-6", idx === 0 ? "mt-0" : "mt-6")}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 mb-2 group-hover:text-slate-300 transition-colors"
              >
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {group.label}
                </p>
                <ChevronRight
                  className={cn(
                    "w-3 h-3 text-slate-500 transition-transform duration-200",
                    isExpanded ? "rotate-90" : ""
                  )}
                />
              </button>

              <div className={cn(
                "space-y-1 overflow-hidden transition-all duration-300 ease-in-out",
                isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
              )}>
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group",
                        isActive
                          ? "bg-blue-600/10 text-blue-500"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={cn("w-5 h-5", isActive ? "text-blue-500" : "text-slate-400 group-hover:text-slate-200")} />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
          <p className="text-xs text-slate-500 font-medium mb-1">Status do Sistema</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-slate-300 font-medium">Operacional</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
