import React, { useState, useEffect } from 'react';
import Landing3D from './components/Landing3D';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AiAnalyst from './components/AiAnalyst';

export default function App() {
  const [isLanding, setIsLanding] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [aiPrompt, setAiPrompt] = useState(null);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('helixpert_theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('helixpert_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleSelectQuickPrompt = (promptText) => {
    setAiPrompt(promptText);
    setActiveTab('ai-analyst');
  };

  if (isLanding) {
    return (
      <Landing3D
        onLaunch={() => setIsLanding(false)}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className={`min-h-screen flex font-sans transition-colors duration-300 ${
      theme === 'dark' ? 'bg-black text-gray-100' : 'bg-white text-gray-900'
    }`}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpen3D={() => setIsLanding(true)}
        theme={theme}
      />

      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Header
          activeTab={activeTab}
          onSearchClick={() => setActiveTab('ai-analyst')}
          theme={theme}
          toggleTheme={toggleTheme}
          onOpenImport={() => {}}
        />

        <main className="flex-1 mt-16 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              setActiveTab={setActiveTab}
              onSelectQuickPrompt={handleSelectQuickPrompt}
              theme={theme}
            />
          )}

          {activeTab === 'ai-analyst' && (
            <AiAnalyst
              initialPrompt={aiPrompt}
              clearInitialPrompt={() => setAiPrompt(null)}
              theme={theme}
            />
          )}
        </main>
      </div>
    </div>
  );
}
