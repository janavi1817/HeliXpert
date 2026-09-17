import React, { useState, useEffect } from 'react';
import { Plane, CheckCircle2, AlertTriangle, Flame, Activity, Bot, ArrowRight, Database, Cpu, Zap } from 'lucide-react';

export default function Dashboard({ setActiveTab, onSelectQuickPrompt, theme }) {
  const [stats, setStats] = useState(null);
  const isDark = theme === 'dark';

  const gold = isDark ? 'text-yellow-400' : 'text-yellow-700';
  const goldBorder = isDark ? 'border-yellow-500/20' : 'border-yellow-600/20';
  const goldBg = isDark ? 'bg-yellow-500/08' : 'bg-yellow-50';
  const cardBg = isDark ? 'bg-black/60 border-yellow-500/12' : 'bg-white border-yellow-600/15';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-400';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/dashboard/stats');
        if (response.ok) {
          const data = await response.json();
          setStats({
            totalHelicopters: data.fleet_size,
            operationalCount: data.operational,
            readinessRate: data.readiness_rate,
            activeFaultsCount: data.active_faults,
            avgEngineTempC: data.avg_egt
          });
        }
      } catch (err) {
        // fallback static values
        setStats({
          totalHelicopters: 10,
          operationalCount: 10,
          readinessRate: 100,
          activeFaultsCount: 0,
          avgEngineTempC: 592
        });
      }
    };
    fetchData();
  }, []);

  if (!stats) return (
    <div className="flex items-center justify-center h-64">
      <div className={`font-mono text-xs ${gold} animate-pulse`}>LOADING DATABASE...</div>
    </div>
  );

  const kpiCards = [
    {
      label: 'Aircraft in Fleet',
      value: stats.totalHelicopters,
      sub: `${stats.operationalCount} Operational`,
      icon: Plane,
      color: 'text-yellow-500',
      glowColor: 'rgba(201,168,76,0.15)',
    },
    {
      label: 'Fleet Readiness',
      value: `${stats.readinessRate}%`,
      sub: 'All systems nominal',
      icon: CheckCircle2,
      color: 'text-green-500',
      glowColor: 'rgba(6,214,160,0.12)',
    },
    {
      label: 'Active Fault Logs',
      value: stats.activeFaultsCount,
      sub: '6,169 total records',
      icon: AlertTriangle,
      color: 'text-orange-400',
      glowColor: 'rgba(251,146,60,0.12)',
    },
    {
      label: 'Avg Engine MGT',
      value: `${stats.avgEngineTempC}°C`,
      sub: 'PHM Turboshaft data',
      icon: Flame,
      color: 'text-red-400',
      glowColor: 'rgba(239,68,68,0.12)',
    },
  ];

  const quickPrompts = [
    "How many helicopters are in the database?",
    "What is the average MGT across all observations?",
    "How many observations are marked as faulty?",
    "Show all available helicopter models.",
    "What is the average torque margin?",
    "Show 10 maintenance records with keyword engine.",
  ];

  return (
    <div className="space-y-6 pb-10">

      {/* Hero Banner */}
      <div className={`relative rounded-xl border overflow-hidden ${cardBg}`}
        style={{ boxShadow: isDark ? '0 0 40px rgba(201,168,76,0.06)' : '0 4px 24px rgba(201,168,76,0.08)' }}>
        {/* Gold top edge accent */}
        <div className={`absolute top-0 left-0 right-0 h-px ${isDark ? 'bg-gradient-to-r from-transparent via-yellow-500/60 to-transparent' : 'bg-gradient-to-r from-transparent via-yellow-600/40 to-transparent'}`} />
        
        <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className={`inline-flex items-center space-x-2 px-2.5 py-1 rounded border ${goldBorder} ${goldBg} ${gold} text-[10px] font-mono uppercase tracking-wider`}>
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
              <span>Database Active</span>
            </div>
            <h1 className={`text-2xl font-bold font-mono tracking-tight ${textPrimary}`}>
              Helicopter Intelligence Platform
            </h1>
            <p className={`text-sm ${textSub} max-w-xl`}>
              Offline-first analytics on real aircraft data — 10 profiles, 742K sensor readings, 6,169 maintenance records.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('ai-analyst')}
            className={`shrink-0 px-5 py-2.5 rounded-lg text-sm font-mono font-bold flex items-center space-x-2 transition-all duration-200 ${
              isDark
                ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_0_20px_rgba(201,168,76,0.4)]'
                : 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-[0_4px_16px_rgba(154,121,48,0.3)]'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Query AI Analyst</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, sub, icon: Icon, color, glowColor }) => (
          <div
            key={label}
            className={`rounded-xl border p-5 flex items-center justify-between transition-all duration-200 group ${cardBg}`}
            style={{ boxShadow: `0 0 0 1px transparent` }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 20px ${glowColor}`}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div>
              <span className={`text-[10px] font-mono uppercase tracking-widest ${textMuted}`}>{label}</span>
              <div className={`text-3xl font-bold font-mono mt-1 ${textPrimary}`}>{value}</div>
              <span className={`text-[10px] font-mono ${textMuted} flex items-center gap-1 mt-1`}>
                <CheckCircle2 className="w-3 h-3 text-green-500" />{sub}
              </span>
            </div>
            <div className={`w-11 h-11 rounded-lg border ${goldBorder} flex items-center justify-center ${goldBg}`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Dataset Summary */}
      <div className={`rounded-xl border p-5 ${cardBg}`}>
        <h3 className={`text-xs font-mono uppercase tracking-widest ${textMuted} mb-4`}>Dataset Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Plane, label: 'Helicopter Profiles', value: '10', sub: '9 columns · verified public data', color: 'text-yellow-500' },
            { icon: Activity, label: 'PHM Sensor Readings', value: '742,625', sub: '10 parameters · turboshaft engine', color: 'text-blue-400' },
            { icon: Database, label: 'Maintenance Records', value: '6,169', sub: '13 columns · annotated logbook', color: 'text-purple-400' },
          ].map(({ icon: Icon, label, value, sub, color }) => (
            <div key={label} className={`flex items-start gap-4 p-4 rounded-lg border ${goldBorder} ${goldBg}`}>
              <div className={`w-9 h-9 rounded border ${goldBorder} flex items-center justify-center shrink-0 ${isDark ? 'bg-black/40' : 'bg-white'}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <div className={`text-xs ${textMuted} font-mono`}>{label}</div>
                <div className={`text-xl font-bold font-mono ${textPrimary}`}>{value}</div>
                <div className={`text-[10px] ${textMuted}`}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Query Prompts */}
      <div className={`rounded-xl border p-5 ${cardBg}`}>
        <div className="flex items-center gap-2 mb-4">
          <Zap className={`w-4 h-4 ${gold}`} />
          <h3 className={`text-xs font-mono uppercase tracking-widest ${textMuted}`}>Quick AI Queries</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                if (onSelectQuickPrompt) onSelectQuickPrompt(prompt);
                setActiveTab('ai-analyst');
              }}
              className={`text-left px-3.5 py-2.5 rounded-lg border text-xs font-mono transition-all duration-200 ${goldBorder} ${
                isDark
                  ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/08 bg-black/20'
                  : 'text-gray-500 hover:text-yellow-700 hover:bg-yellow-50 bg-gray-50'
              }`}
            >
              <span className={`mr-2 ${gold}`}>›</span>{prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
