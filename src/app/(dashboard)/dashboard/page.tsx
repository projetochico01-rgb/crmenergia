import { 
  Users, 
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';

const stats = [
  { 
    label: 'Financeiro', 
    value: 'R$ 12.840', 
    change: '+12%', 
    icon: DollarSign,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
  { 
    label: 'Novos Leads', 
    value: '156', 
    change: '+18%', 
    icon: Users,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10'
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Bem-vindo, Admin</h1>
        <p className="text-slate-500 mt-1">Visão geral de todos os seus modelos de negócio.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl hover:border-slate-700 transition-all group">
            <div className="flex justify-between items-start">
              <div className={`${stat.bg} p-3 rounded-2xl`}>
                <stat.icon className={`${stat.color} w-6 h-6`} />
              </div>
              <span className={cn(
                "text-xs font-bold px-2 py-1 rounded-full",
                stat.change.startsWith('+') ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
              )}>
                {stat.change}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white">Desempenho de Vendas</h2>
            <select className="bg-slate-800 border-none text-xs text-slate-300 rounded-lg px-3 py-1.5 focus:ring-0">
              <option>Últimos 7 dias</option>
              <option>Últimos 30 dias</option>
            </select>
          </div>
          <div className="h-64 flex items-center justify-center border border-dashed border-slate-800 rounded-2xl">
            <p className="text-slate-600 text-sm">Gráfico de Vendas (Multi-modelo)</p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
          <h2 className="text-lg font-bold text-white mb-6">Atividades Recentes</h2>
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm text-slate-200">
                    <span className="font-bold">João Silva</span> assinou o <span className="text-blue-500">Plano Premium</span>
                  </p>
                  <p className="text-xs text-slate-500">Há 5 minutos</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
