import React from 'react';
import { useAuth, PRESET_USERS } from '../context/AuthContext';
import { 
  Boxes, 
  ClipboardList, 
  ArrowLeftRight, 
  ShoppingCart, 
  LogOut, 
  ShieldCheck, 
  Wrench, 
  Briefcase,
  Sparkles
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, role, logout, quickLogin } = useAuth();

  const getRoleBadge = () => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm shadow-purple-500/10">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Admin
          </span>
        );
      case 'OPERATIONS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10">
            <Wrench className="w-3.5 h-3.5 text-amber-400" /> Operations
          </span>
        );
      case 'SALES':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
            <Briefcase className="w-3.5 h-3.5 text-emerald-400" /> Sales
          </span>
        );
      default:
        return null;
    }
  };

  const navItems = [
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'work-orders', label: 'Work Orders', icon: ClipboardList },
    { id: 'transfers', label: 'Internal Transfers', icon: ArrowLeftRight },
    { id: 'orders', label: 'Customer Orders', icon: ShoppingCart },
  ];

  return (
    <header className="bg-[#070b14]/85 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-40 shadow-xl shadow-black/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo with Glowing Aura */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-sm tracking-wider shadow-lg shadow-cyan-500/25 border border-cyan-300/30">
              ERP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white tracking-tight text-lg bg-gradient-to-r from-white via-slate-200 to-cyan-200 bg-clip-text text-transparent">
                  Mini Operations ERP
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono font-medium text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/50">
                  <Sparkles className="w-2.5 h-2.5" /> v1.0
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links with Glowing Pill Effect */}
          <nav className="flex space-x-1 sm:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-indigo-500/10 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Profile & Interactive Role Switcher */}
          <div className="flex items-center gap-3">
            {/* Quick Demo Switcher */}
            <div className="hidden lg:flex items-center bg-[#0d1424] p-1 rounded-xl border border-slate-800 text-xs shadow-inner">
              <span className="text-slate-500 px-2 font-mono text-[11px]">Role:</span>
              {Object.keys(PRESET_USERS).map((key) => {
                const p = PRESET_USERS[key];
                const isCurrent = role === p.role;
                return (
                  <button
                    key={key}
                    onClick={() => quickLogin(key)}
                    className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                      isCurrent
                        ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/20 text-cyan-300 font-semibold border border-cyan-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {p.role}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-medium text-slate-200">{user?.full_name}</div>
                <div className="mt-0.5">{getRoleBadge()}</div>
              </div>
              <button
                onClick={logout}
                title="Logout"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-500/20"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
