import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Send, Terminal, Sparkles, CheckCircle, RefreshCw, Copy, Check, Table as TableIcon, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function AiAnalyst({ initialPrompt, clearInitialPrompt, theme }) {
  const isDark = theme === 'dark';
  const gold = isDark ? 'text-yellow-400' : 'text-yellow-700';
  const goldBorder = isDark ? 'border-yellow-500/20' : 'border-yellow-600/20';
  const goldBg = isDark ? 'bg-yellow-500/08' : 'bg-yellow-50';
  const cardBg = isDark ? 'bg-black/80 border-yellow-500/15' : 'bg-white border-yellow-600/15';
  const inputBg = isDark ? 'bg-black border-yellow-500/20 text-white placeholder-gray-600 focus:border-yellow-500/50' : 'bg-gray-50 border-yellow-600/20 text-gray-900 placeholder-gray-400 focus:border-yellow-600/50';
  const msgAiBg = isDark ? 'bg-black/60 border-yellow-500/12 text-gray-200' : 'bg-white border-yellow-600/15 text-gray-800';
  const msgUserBg = isDark ? 'bg-yellow-500/10 border-yellow-500/30 text-white' : 'bg-yellow-50 border-yellow-600/25 text-gray-900';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-400';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
  const pillBg = isDark ? 'bg-black/40 border-yellow-500/15 text-gray-400 hover:text-yellow-400 hover:border-yellow-500/40' : 'bg-gray-50 border-yellow-600/15 text-gray-500 hover:text-yellow-700 hover:border-yellow-600/40';
  const codeBg = isDark ? 'bg-black/80 border-yellow-500/12' : 'bg-gray-50 border-yellow-600/12';
  const tableHead = isDark ? 'bg-black/60 text-gray-500 border-yellow-500/12' : 'bg-gray-50 text-gray-400 border-yellow-600/12';
  const tableRow = isDark ? 'border-yellow-500/08 text-gray-300 hover:bg-yellow-500/05' : 'border-yellow-600/08 text-gray-600 hover:bg-yellow-50';

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: 'Hello! I am **HeliXpert AI**, your offline helicopter intelligence assistant.\n\nI query the local SQLite database directly — no internet required. Ask me about aircraft profiles, engine parameters, maintenance records, or sensor anomalies.\n\nTry a sample query below or type your own!',
      timestamp: new Date().toLocaleTimeString(),
      pipeline: null
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  const sampleQueries = [
    "How many helicopters are in the database?",
    "What is the average MGT?",
    "How many faulty observations?",
    "Show all helicopter models.",
    "What is the average torque margin?",
    "Show 10 maintenance records.",
  ];

  useEffect(() => {
    if (initialPrompt) {
      handleSend(initialPrompt);
      if (clearInitialPrompt) clearInitialPrompt();
    }
  }, [initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (queryToRun) => {
    const q = queryToRun || inputQuery;
    if (!q.trim() || isLoading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryToRun) setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/analyst/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });

      if (!response.ok) throw new Error(`Backend error: ${response.statusText}`);
      const data = await response.json();

      const chartData = Array.isArray(data.chartData) ? data.chartData : [];
      const queryResult = data.queryResult || null;
      const rowCount = queryResult?.row_count ?? 0;

      const insights = [];
      if (rowCount > 0) insights.push(`${rowCount} matching record(s) found.`);
      if (data.sql) insights.push(`Query: ${data.sql.substring(0, 90)}...`);
      if (data.intent) insights.push(`Intent classified as: ${data.intent}`);

      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: data.explanation || 'Query executed.',
        pipeline: {
          intent: data.intent || 'QUERY',
          sql: data.sql || null,
          isValid: data.isValid !== false,
          queryResult: queryResult
        },
        chartType: data.chartType || 'none',
        chartData: chartData,
        keyInsights: insights,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `⚠️ **Connection Error**: Could not reach the HeliXpert backend at http://localhost:8000.\n\nMake sure the FastAPI server is running.\n\nError: ${err.message}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySql = (sql, msgId) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderMarkdown = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, `<strong class="${isDark ? 'text-yellow-400' : 'text-yellow-700'}">$1</strong>`)
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-7rem)] rounded-xl border overflow-hidden ${cardBg}`}>

      {/* Header */}
      <div className={`px-5 py-3.5 border-b ${goldBorder} flex items-center justify-between ${isDark ? 'bg-black/50' : 'bg-gray-50/80'}`}>
        <div className="flex items-center space-x-3">
          <div className={`w-9 h-9 rounded-lg border ${goldBorder} ${goldBg} flex items-center justify-center`}>
            <Bot className={`w-5 h-5 ${gold}`} />
          </div>
          <div>
            <h3 className={`font-bold text-sm font-mono flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              HeliXpert AI Analyst
              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${goldBorder} ${goldBg} ${gold} font-mono uppercase`}>
                Offline · Read-Only SQL
              </span>
            </h3>
            <p className={`text-[10px] font-mono ${textMuted}`}>
              Rule-Based Intent Engine · Local SQLite · No Cloud
            </p>
          </div>
        </div>
        <button
          onClick={() => setMessages([messages[0]])}
          className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center space-x-1.5 transition-all ${goldBorder} ${pillBg}`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-5 overflow-y-auto space-y-5">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex space-x-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>

            {msg.sender === 'ai' && (
              <div className={`w-8 h-8 rounded-lg border ${goldBorder} ${goldBg} flex items-center justify-center ${gold} shrink-0 mt-0.5`}>
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div className={`max-w-3xl rounded-xl p-4 space-y-3 border ${msg.sender === 'user' ? msgUserBg : msgAiBg}`}>

              {/* Sender + time */}
              <div className={`flex items-center justify-between text-[10px] font-mono ${textMuted} pb-2 border-b ${goldBorder}`}>
                <span className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {msg.sender === 'user' ? 'You' : 'HeliXpert AI'}
                </span>
                <span>{msg.timestamp}</span>
              </div>

              {/* Text */}
              <div
                className="text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
              />

              {/* Key Insights */}
              {msg.keyInsights && msg.keyInsights.length > 0 && (
                <div className={`p-3 rounded-lg border ${goldBorder} ${goldBg} space-y-1.5`}>
                  <span className={`text-[10px] font-mono font-semibold ${gold} uppercase tracking-wider flex items-center gap-1.5`}>
                    <Sparkles className="w-3 h-3" /> Key Insights
                  </span>
                  <ul className={`text-xs space-y-1 ${textSub} list-disc list-inside`}>
                    {msg.keyInsights.map((insight, idx) => (
                      <li key={idx}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bar Chart */}
              {msg.chartType === 'bar' && msg.chartData?.length > 0 && (
                <div className={`p-3 rounded-lg border ${goldBorder} ${codeBg}`}>
                  <div className={`flex items-center gap-1.5 text-[10px] font-mono ${gold} mb-2`}>
                    <BarChart2 className="w-3.5 h-3.5" /> Analytics Chart
                  </div>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={msg.chartData}>
                        <XAxis dataKey="name" stroke={isDark ? '#555' : '#aaa'} tick={{ fontSize: 10 }} />
                        <YAxis stroke={isDark ? '#555' : '#aaa'} tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#0a0a0a' : '#fff',
                            borderColor: isDark ? 'rgba(201,168,76,0.3)' : 'rgba(201,168,76,0.4)',
                            color: isDark ? '#e5e5e5' : '#111'
                          }}
                        />
                        <Bar dataKey="value" fill={isDark ? '#c9a84c' : '#9a7930'} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Table Output */}
              {msg.pipeline?.queryResult?.data?.length > 0 && (
                <div className={`rounded-lg border ${goldBorder} overflow-hidden text-xs`}>
                  <div className={`px-3 py-2 border-b ${goldBorder} flex items-center justify-between font-mono ${tableHead}`}>
                    <span className={`flex items-center gap-1.5 font-semibold text-green-500`}>
                      <TableIcon className="w-3.5 h-3.5" />
                      {msg.pipeline.queryResult.row_count} row(s) returned
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-52">
                    <table className="w-full text-left font-mono">
                      <thead className={`${tableHead} border-b ${goldBorder}`}>
                        <tr>
                          {Object.keys(msg.pipeline.queryResult.data[0] || {}).slice(0, 7).map(col => (
                            <th key={col} className="px-3 py-2 text-[9px] uppercase tracking-wider">{col.replace(/_/g, ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.pipeline.queryResult.data.slice(0, 8).map((row, rIdx) => (
                          <tr key={rIdx} className={`border-t ${tableRow}`}>
                            {Object.keys(msg.pipeline.queryResult.data[0] || {}).slice(0, 7).map(col => (
                              <td key={col} className="px-3 py-1.5 truncate max-w-[160px]">
                                {String(row[col] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SQL Inspector */}
              {msg.pipeline?.sql && (
                <div className={`p-3 rounded-lg border ${goldBorder} ${codeBg} space-y-2 text-xs font-mono`}>
                  <div className={`flex items-center justify-between ${textMuted}`}>
                    <span className={`flex items-center gap-1.5 ${gold}`}>
                      <Terminal className="w-3.5 h-3.5" /> SQL Generated
                    </span>
                    <span className="flex items-center gap-1 text-green-500">
                      <CheckCircle className="w-3 h-3" /> Read-Only
                    </span>
                  </div>
                  <div className={`flex items-center justify-between p-2 rounded border ${goldBorder} ${isDark ? 'bg-black/60' : 'bg-white'}`}>
                    <code className={`text-[11px] ${gold} overflow-x-auto flex-1`}>
                      {msg.pipeline.sql}
                    </code>
                    <button
                      onClick={() => handleCopySql(msg.pipeline.sql, msg.id)}
                      className={`ml-2 ${textMuted} hover:${gold} transition`}
                    >
                      {copiedId === msg.id
                        ? <Check className="w-3.5 h-3.5 text-green-500" />
                        : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className={`w-8 h-8 rounded-lg border ${goldBorder} ${goldBg} flex items-center justify-center ${gold} shrink-0 mt-0.5`}>
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className={`flex items-center space-x-3 text-xs font-mono ${textMuted}`}>
            <div className={`w-8 h-8 rounded-lg border ${goldBorder} ${goldBg} flex items-center justify-center ${gold} animate-spin`}>
              <RefreshCw className="w-4 h-4" />
            </div>
            <span>Classifying intent · generating SQL · querying local database...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sample Query Pills */}
      <div className={`px-4 py-2.5 border-t ${goldBorder} flex items-center space-x-2 overflow-x-auto ${isDark ? 'bg-black/30' : 'bg-gray-50/60'}`}>
        <span className={`text-[10px] font-mono shrink-0 ${textMuted}`}>Try:</span>
        {sampleQueries.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className={`px-2.5 py-1 rounded border text-[10px] font-mono shrink-0 transition-all duration-150 ${pillBg}`}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className={`p-4 border-t ${goldBorder} ${isDark ? 'bg-black/50' : 'bg-gray-50/60'}`}>
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center space-x-3"
        >
          <input
            type="text"
            id="ai-analyst-input"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask HeliXpert AI a question about your helicopter data..."
            className={`flex-1 px-4 py-3 rounded-lg border text-sm font-sans transition-all duration-200 outline-none ${inputBg}`}
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className={`px-5 py-3 rounded-lg text-sm font-mono font-bold flex items-center space-x-2 transition-all duration-200 disabled:opacity-30 ${
              isDark
                ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_0_20px_rgba(201,168,76,0.4)]'
                : 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-[0_4px_16px_rgba(154,121,48,0.3)]'
            }`}
          >
            <span>Ask</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
