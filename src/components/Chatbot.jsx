import { useState, useEffect, useRef } from 'react';
import { nlqQuery, getQuerySuggestions, checkBackendHealth, rateQuery } from '../services/api';
import DynamicChart from './DynamicChart';
import useTwinStore from '../store/useTwinStore';
import { Bot, PlusCircle, ThumbsUp, ThumbsDown, Send } from 'lucide-react';

export default function Chatbot() {
  const { kpis, components, selectedComponentId, selectedDomain, activeTwinId, nlqMessages: messages, setNlqMessages: setMessages, clearNlqMessages } = useTwinStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [currentThought, setCurrentThought] = useState('');
  const [backendOnline, setBackendOnline] = useState(null); // null=checking
  const [timeRange, setTimeRange] = useState('24h');
  const bottomRef = useRef();

  // Check backend health + load suggestions (re-check every 30s)
  useEffect(() => {
    const check = () => checkBackendHealth().then(online => {
      setBackendOnline(online);
      if (online) getQuerySuggestions(activeTwinId || 'default', selectedDomain).then(s => setSuggestions(s.map(x => x.text))).catch(() => {});
    });
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [selectedDomain]);

  // Default suggestions when no data
  const defaultSuggestions = [
    'What is the system status?',
    'Show anomalies in the last 24h',
    'Compare all KPI trends',
    'Which component has the highest temperature?',
  ];
  const displaySuggestions = suggestions.length > 0 ? suggestions : defaultSuggestions;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const critCount  = kpis.filter(k => k.status === 'red').length;
  const warnCount  = kpis.filter(k => k.status === 'orange').length;
  const okCount    = kpis.filter(k => k.status === 'green').length;
  const selComp    = components.find(c => c.id === selectedComponentId);

  const handleSend = async (text) => {
    const q = (text || input).trim();
    if (!q) return;
    setInput('');
    const userMsg = { id: Date.now(), role: 'user', text: q, chart: null };
    setMessages(prev => [...prev, userMsg]);
    setCurrentThought('Starting analysis...');
    setIsTyping(true);

    try {
      if (backendOnline) {
        // Real NLQ via backend
        const chatHistory = messages.filter(m => m.id !== 0 && m.id !== userMsg.id).map(m => ({ role: m.role, content: m.text }));
        const result = await nlqQuery(activeTwinId || 'default', q, {
          history: chatHistory,
          componentId: selComp?.id,
          timeRange,
        }, (thought) => setCurrentThought(thought));
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          text: result.answer,
          chart: result.chart,
          queryId: result.queryId,
          rating: null
        }]);
      } else {
        // Offline mock fallback
        await new Promise(r => setTimeout(r, 700));
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          text: buildMockAnswer(q, kpis, components, selComp),
          chart: null,
        }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        text: `! Backend error: ${e.message}. Using offline mock data instead.\n\n${buildMockAnswer(q, kpis, components, selComp)}`,
        chart: null,
      }]);
    } finally {
      setIsTyping(false);
      setCurrentThought('');
      // Refresh suggestions
      if (backendOnline) getQuerySuggestions(activeTwinId || 'default', selectedDomain).then(s => setSuggestions(s.map(x => x.text))).catch(() => {});
    }
  };

  const handleRate = async (msgId, queryId, score) => {
    if (!queryId) return;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, rating: score } : m));
    try {
      await rateQuery(queryId, score);
    } catch (e) {
      console.error("Failed to submit feedback", e);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-1)' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'var(--accent)' }}><Bot size={18} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Analytics AI
              <span style={{
                fontSize: '9px', padding: '1px 6px', borderRadius: '10px', fontWeight: 600,
                background: backendOnline === null ? 'rgba(100,116,139,0.2)' : backendOnline ? 'rgba(16,217,141,0.15)' : 'rgba(245,158,11,0.15)',
                color: backendOnline === null ? '#64748b' : backendOnline ? '#10d98d' : '#f59e0b',
                border: `1px solid ${backendOnline === null ? '#64748b40' : backendOnline ? '#10d98d40' : '#f59e0b40'}`,
              }}>
                {backendOnline === null ? 'connecting...' : backendOnline === true ? '● connected' : `○ offline mode`}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-2)' }}>
              {selComp ? `Focused on: ${selComp.name}` : 'Analyzing all components'}
            </div>
          </div>
          {/* New Chat Button */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button 
              onClick={clearNlqMessages}
              title="New Chat"
              style={{ padding: '6px', marginLeft: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-1)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-1)'; e.currentTarget.style.color = 'var(--text-0)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-0)'; e.currentTarget.style.color = 'var(--text-1)' }}
            >
              <PlusCircle size={14} />
            </button>
          </div>
        </div>

        {/* Time range selector */}
        <div style={{ display: 'flex', gap: '3px', marginTop: '8px', background: 'var(--bg-0)', borderRadius: '7px', padding: '2px' }}>
          {['1h','6h','24h','7d','30d'].map(t => (
            <button key={t} onClick={() => setTimeRange(t)} style={{ flex: 1, padding: '3px', borderRadius: '5px', border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: timeRange === t ? 'var(--accent)' : 'transparent', color: timeRange === t ? '#fff' : 'var(--text-2)' }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '96%', padding: '9px 13px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-0)',
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
              fontSize: '12px', lineHeight: 1.6, color: msg.role === 'user' ? '#fff' : 'var(--text-1)',
              whiteSpace: 'pre-wrap',
            }}>
              {formatMsg(msg.text)}
            </div>

            {/* Dynamic chart from backend */}
            {msg.chart && msg.chart.data?.length > 0 && (
              <div style={{ width: '98%', marginTop: '6px', padding: '12px', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <DynamicChart config={msg.chart} height={180} />
              </div>
            )}
            
            {/* Feedback buttons */}
            {msg.role === 'assistant' && msg.queryId && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', paddingLeft: '4px' }}>
                <button 
                  onClick={() => handleRate(msg.id, msg.queryId, 1)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: msg.rating === 1 ? 'var(--accent)' : 'var(--text-2)', display: 'flex', alignItems: 'center' }}
                  title="Helpful"
                >
                  <ThumbsUp size={14} />
                </button>
                <button 
                  onClick={() => handleRate(msg.id, msg.queryId, 0)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: msg.rating === 0 ? 'var(--red)' : 'var(--text-2)', display: 'flex', alignItems: 'center' }}
                  title="Not Helpful"
                >
                  <ThumbsDown size={14} />
                </button>
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div style={{ display: 'flex' }}>
            <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: 'var(--bg-0)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-1)', marginRight: '4px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bot size={12} color="var(--accent)" /> {currentThought ? currentThought : 'AI thinking'}
                  </span>
                <div style={{display: 'flex', gap: '4px'}}>
                    {[0,1,2].map(i => <span key={i} style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--accent)', animation:`bounce 0.8s ease-in-out ${i*0.15}s infinite` }} />)}
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestion chips */}
      <div style={{ padding: '6px 12px', display: 'flex', gap: '5px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {displaySuggestions.slice(0, 4).map(s => (
          <button key={s} onClick={() => handleSend(s)} style={{ padding: '3px 9px', borderRadius: '16px', fontSize: '10px', fontWeight: 500, background: 'rgba(72,101,242,0.08)', border: '1px solid rgba(72,101,242,0.2)', color: 'var(--accent)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(72,101,242,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(72,101,242,0.08)'}>
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', flexShrink: 0 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          placeholder={backendOnline ? 'Ask about KPIs — AI will analyze & chart…' : 'Ask about your KPIs…'}
          rows={2} style={{ flex: 1, background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', color: 'var(--text-0)', fontSize: '12px', resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={() => handleSend()} disabled={!input.trim()}
          style={{ width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', flexShrink: 0, alignSelf: 'flex-end', background: input.trim() ? 'linear-gradient(135deg,#4865f2,#f4723e)' : 'var(--bg-0)', border: '1px solid var(--border)', cursor: input.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
          <Send size={15} color={input.trim() ? '#fff' : 'var(--text-3)'} />
        </button>
      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  );
}

function formatMsg(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2,-2)}</strong>
      : part
  );
}

function buildMockAnswer(q, kpis, components, selComp) {
  const ql = q.toLowerCase();
  if (!kpis.length) return 'No KPI data loaded yet. Import data via the KPIs panel or run the demo first.';
  const crit = kpis.filter(k => k.status === 'red');
  const warn = kpis.filter(k => k.status === 'orange');
  if (ql.includes('status') || ql.includes('statut') || ql.includes('overview')) {
    return `**System Overview**\n${kpis.filter(k=>k.status==='green').length} OK · ${warn.length} Warning · ${crit.length} Critical\n\n${kpis.map(k=>`• **${k.name}**: ${typeof k.value==='number'?k.value.toFixed(1):k.value} ${k.unit} (${k.status.toUpperCase()})`).join('\n')}`;
  }
  if (ql.includes('anomal') || ql.includes('alert') || ql.includes('critical')) {
    return crit.length ? `**${crit.length} critical alert(s):**\n${crit.map(k=>`! ${k.name}: ${k.value.toFixed?k.value.toFixed(1):k.value} ${k.unit}`).join('\n')}` : 'No critical anomalies detected.';
  }
  const targets = selComp ? kpis.filter(k => selComp.kpiIds?.includes(k.id)) : kpis;
  return `**KPI Summary${selComp ? ` for ${selComp.name}` : ''}**\n${targets.slice(0,4).map(k=>`• ${k.name}: **${typeof k.value==='number'?k.value.toFixed(1):k.value} ${k.unit}** — ${k.status}`).join('\n')}`;
}
