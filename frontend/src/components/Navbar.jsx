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
  Briefcase 
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, role, logout, quickLogin } = useAuth();

  const getRoleBadge = () => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <ShieldCheck className="w-3.5 h-3.5" /> Admin
          </span>
        );
      case 'OPERATIONS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Wrench className="w-3.5 h-3.5" /> Operations
          </span>
        );
      case 'SALES':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Briefcase className="w-3.5 h-3.5" /> Sales
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
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
              ERP
            </div>
            <div>
              <span className="font-bold text-white tracking-tight text-lg">Mini Operations ERP</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">v1.0</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex space-x-1 sm:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Profile & Role Switcher */}
          <div className="flex items-center gap-3">
            {/* Quick Switcher for Interview / Demo */}
            <div className="hidden lg:flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-500 px-2 font-mono">Switch:</span>
              {Object.keys(PRESET_USERS).map((key) => {
                const p = PRESET_USERS[key];
                const isCurrent = role === p.role;
                return (
                  <button
                    key={key}
                    onClick={() => quickLogin(key)}
                    className={`px-2 py-1 rounded transition-colors ${
                      isCurrent
                        ? 'bg-slate-800 text-indigo-400 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    {p.role}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-medium text-slate-200">{user?.full_name}</div>
                <div>{getRoleBadge()}</div>
              </div>
              <button
                onClick={logout}
                title="Logout"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
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
