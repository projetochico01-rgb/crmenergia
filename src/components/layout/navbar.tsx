'use client';

import { Bell, Search, User } from 'lucide-react';

export function Navbar() {
  return (
    <header className="h-16 border-b border-slate-800 bg-[#020617]/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-40 ml-64">
      <div className="flex items-center bg-slate-900/50 border border-slate-800 rounded-full px-4 py-1.5 w-96 group focus-within:border-blue-500/50 transition-all">
        <Search className="w-4 h-4 text-slate-500 group-focus-within:text-blue-500" />
        <input 
          type="text" 
          placeholder="Pesquisar..." 
          className="bg-transparent border-none focus:ring-0 text-sm text-slate-200 placeholder:text-slate-600 w-full ml-2"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-slate-800 rounded-full relative transition-colors">
          <Bell className="w-5 h-5 text-slate-400" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full border-2 border-[#020617]" />
        </button>
        
        <div className="h-8 w-[1px] bg-slate-800 mx-2" />
        
        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-200">Operador Atrioz</p>
            <p className="text-xs text-slate-500">Atendimento</p>
          </div>
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
            <User className="w-6 h-6 text-slate-400" />
          </div>
        </div>
      </div>
    </header>
  );
}
