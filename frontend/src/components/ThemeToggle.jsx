import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      className={`relative p-2 rounded-xl border transition-all duration-300 flex items-center justify-center ${
        isDark
          ? 'bg-[#0d1424] border-slate-700/80 text-cyan-400 hover:text-cyan-300 hover:border-cyan-500/40 shadow-sm shadow-cyan-500/10'
          : 'bg-white border-slate-200 text-amber-500 hover:text-amber-600 hover:border-amber-400/60 shadow-sm'
      } ${className}`}
      aria-label="Toggle theme"
    >
      <div className="relative w-4 h-4">
        {isDark ? (
          <Moon className="w-4 h-4 transition-transform duration-300 rotate-0 scale-100" />
        ) : (
          <Sun className="w-4 h-4 transition-transform duration-300 rotate-90 scale-100" />
        )}
      </div>
    </button>
  );
}
