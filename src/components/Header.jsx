import React from 'react';
import { Search, Sun, Moon, CheckCircle2 } from 'lucide-react';

export default function Header({ activeTab, onSearchClick, activeHelicopterModel, theme, toggleTheme, onOpenImport }) {
  const isDark = theme === 'dark';
  const gold = 'text-yellow-500';
  const goldBorder = isDark ? 'border-yellow-500/20' : 'border-yellow-600/20';

  const titles = {
    'dashboard': 'Fleet Executive Dashboard',
    'ai-analyst': 'AI Database Analyst',
  };

  return (
    <header className={`h-16 border-b fixed top-0 right-0 left-64 z-20 px-6 flex items-center justify-between transition-colors duration-300 ${
      isDark
        ? 'bg-black/90 backdrop-blur-md border-yellow-500/15 text-white'
        : 'bg-white/95 backdrop-blur-md border-yellow-600/20 text-gray-900 shadow-sm'
    }`}>
      {/* View Title */}
      <div className="flex items-center space-x-3">
        <div className={`w-1 h-5 rounded-full ${isDark ? 'bg-yellow-500' : 'bg-yellow-600'}`} />
        <h2 className={`text-sm font-semibold font-mono tracking-widest uppercase ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          {titles[activeTab] || 'HeliXpert'}
        </h2>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-3">

        {/* Search */}
        <button
          onClick={onSearchClick}
          className={`px-3 py-1.5 rounded-lg border text-xs flex items-center space-x-2 transition-all duration-200 ${goldBorder} ${
            isDark
              ? 'bg-white/04 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/08'
              : 'bg-gray-50 text-gray-500 hover:text-yellow-700'
          }`}
        >
          <Search className={`w-3.5 h-3.5 ${gold}`} />
          <span>Search...</span>
          <kbd className={`px-1 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-white/08 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>⌘K</kbd>
        </button>

        {/* DB Status Badge */}
        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border ${goldBorder} text-xs font-mono bg-green-500/10 text-green-500`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>DB Active</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg border transition-all duration-200 ${goldBorder} ${
            isDark
              ? 'bg-white/04 text-yellow-500 hover:bg-yellow-500/10'
              : 'bg-gray-50 text-yellow-600 hover:bg-yellow-50'
          }`}
          title="Toggle Light / Dark Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-yellow-600" />}
        </button>
      </div>
    </header>
  );
}
