import React from 'react';
import { LayoutDashboard, Bot, Radio, RotateCcw } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, onOpen3D, theme }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ai-analyst', label: 'AI Analyst', icon: Bot, badge: 'Offline AI' },
  ];

  const isDark = theme === 'dark';
  const gold = 'text-yellow-500';
  const goldBorder = isDark ? 'border-yellow-500/20' : 'border-yellow-600/20';
  const goldBg = isDark ? 'bg-yellow-500/10' : 'bg-yellow-600/08';
  const sidebarBg = isDark ? 'bg-black border-yellow-500/15' : 'bg-white border-yellow-600/20';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-400';
  const textPrimary = isDark ? 'text-gray-200' : 'text-gray-800';

  return (
    <aside className={`w-64 border-r flex flex-col h-screen fixed left-0 top-0 z-30 select-none transition-colors duration-300 ${sidebarBg}`}>
      
      {/* Brand Header */}
      <div className={`p-5 border-b ${goldBorder} flex items-center space-x-3`}>
        <div className={`w-10 h-10 rounded-lg border ${goldBorder} ${goldBg} flex items-center justify-center`}>
          <Radio className={`w-5 h-5 ${gold} animate-pulse`} />
        </div>
        <div>
          <h1 className={`font-bold text-lg tracking-widest font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>HeliXpert</h1>
          <span className={`text-[10px] ${gold} font-mono flex items-center gap-1`}>
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block animate-ping" />
            OFFLINE INTEL
          </span>
        </div>
      </div>

      {/* Return to 3D View */}
      <div className="p-3">
        <button
          onClick={onOpen3D}
          className={`w-full px-3 py-2 rounded-lg border text-xs font-mono flex items-center justify-center space-x-2 transition-all duration-200 ${goldBorder} ${isDark ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/08 bg-black/40' : 'text-gray-500 hover:text-yellow-700 hover:bg-yellow-50 bg-gray-50'}`}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${gold}`} />
          <span>3D Helicopter View</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? `border-l-2 border-yellow-500 ${goldBg} text-yellow-500 font-semibold`
                  : `border-l-2 border-transparent ${textMuted} hover:${isDark ? 'text-gray-200' : 'text-gray-800'} ${isDark ? 'hover:bg-white/04' : 'hover:bg-gray-50'}`
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? gold : textMuted}`} />
                <span className={isActive ? gold : textPrimary}>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${goldBorder} ${goldBg} ${gold}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`p-4 border-t ${goldBorder} text-[10px] font-mono flex items-center justify-between ${textMuted}`}>
        <span className={gold}>HeliXpert</span>
        <span>v2.0 · Offline</span>
      </div>
    </aside>
  );
}
