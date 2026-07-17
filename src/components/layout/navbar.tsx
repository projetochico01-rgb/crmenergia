'use client';

import Link from 'next/link';
import { Menu, User, X } from 'lucide-react';
import { useState } from 'react';
import { LogoutButton } from '@/components/layout/logout-button';
import { navigationGroups } from '@/components/layout/sidebar';

export function Navbar({ displayName, role }: { displayName: string; role: 'admin' | 'atendente' }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b border-slate-800 bg-[#020617]/95 px-4 backdrop-blur-md md:ml-64 md:px-8">
      <button type="button" className="button-secondary px-3 md:hidden" onClick={() => setMenuOpen((current) => !current)} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen}>
        {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <div className="hidden text-sm text-slate-500 md:block">BeHub CRM · Operação comercial</div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-slate-200">{displayName}</p>
          <p className="text-xs capitalize text-slate-500">{role}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800">
          <User className="h-5 w-5 text-slate-400" />
        </div>
        <LogoutButton />
      </div>

      {menuOpen && (
        <nav className="absolute left-0 right-0 top-full max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-slate-800 bg-slate-950 p-4 shadow-2xl md:hidden" aria-label="Navegação móvel">
          {navigationGroups.filter((group) => !group.admin || role === 'admin').map((group) => (
            <div key={group.label} className="mb-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{group.label}</p>
              <div className="grid gap-1">
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-200 hover:bg-slate-800">
                    <item.icon className="h-5 w-5 text-amber-300" /> {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      )}
    </header>
  );
}
