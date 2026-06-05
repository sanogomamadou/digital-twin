import { useState, useEffect } from 'react';
import { getLLMConfig, updateLLMConfig } from '../../services/api';
import { Save, BrainCircuit, Key, Trash2, Plus } from 'lucide-react';

export default function AdminLLMOps() {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const data = await getLLMConfig();
            setConfig(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateLLMConfig(config);
            alert('LLM Configuration saved successfully!');
        } catch (e) {
            alert('Error saving: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading || !config) return <div>Loading configuration...</div>;

    return (
        <div style={{ maxWidth: '800px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>LLM Operations</h1>
            <p style={{ color: 'var(--text-2)', marginBottom: '32px' }}>Configure models, prompts, and inference settings for all agents.</p>

            <div style={{ background: 'var(--bg-1)', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <BrainCircuit size={24} color="var(--accent)" />
                    <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Active Model Settings</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-1)' }}>Model Provider / Name</label>
                        <select 
                            value={config.model} 
                            onChange={e => setConfig({...config, model: e.target.value})}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', outline: 'none' }}
                        >
                            <option value="llama3-70b-8192">Llama 3 70B (Groq)</option>
                            <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Groq)</option>
                            <option value="llama3-8b-8192">Llama 3 8B (Groq)</option>
                            <option value="mixtral-8x7b-32768">Mixtral 8x7B (Groq)</option>
                            <option value="gpt-4o">GPT-4o (OpenAI)</option>
                            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Anthropic)</option>
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Google)</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-1)' }}>
                            Temperature ({config.temperature})
                        </label>
                        <input 
                            type="range" 
                            min="0" max="2" step="0.1" 
                            value={config.temperature}
                            onChange={e => setConfig({...config, temperature: parseFloat(e.target.value)})}
                            style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-1)' }}>Max Tokens</label>
                        <input 
                            type="number" 
                            value={config.max_tokens}
                            onChange={e => setConfig({...config, max_tokens: parseInt(e.target.value)})}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', outline: 'none' }}
                        />
                    </div>
                </div>

                <div style={{ marginBottom: '32px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-1)' }}>Base System Prompt (Applies to all agents)</label>
                    <textarea 
                        value={config.system_prompt}
                        onChange={e => setConfig({...config, system_prompt: e.target.value})}
                        style={{ width: '100%', height: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', outline: 'none', resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                    />
                </div>

                <div style={{ marginBottom: '32px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <Key size={20} color="var(--accent)" />
                        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>API Key Vault (Failover / Quotas)</h3>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>
                        Add multiple API keys. If the primary key hits a 429 Rate Limit, the system will automatically fallback to the next key.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                        {config.api_keys.map((key, index) => (
                            <div key={index} style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                    type="password" 
                                    value={key}
                                    onChange={e => {
                                        const newKeys = [...config.api_keys];
                                        newKeys[index] = e.target.value;
                                        setConfig({...config, api_keys: newKeys});
                                    }}
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)' }}
                                />
                                <button 
                                    onClick={() => {
                                        const newKeys = config.api_keys.filter((_, i) => i !== index);
                                        setConfig({...config, api_keys: newKeys});
                                    }}
                                    style={{ padding: '10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--red)' }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    
                    <button 
                        onClick={() => setConfig({...config, api_keys: [...config.api_keys, '']})}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'var(--bg-2)', border: '1px dashed var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-1)' }}
                    >
                        <Plus size={14} /> Add Another API Key
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'var(--accent)', color: 'white', padding: '10px 20px',
                            borderRadius: '8px', border: 'none', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        <Save size={18} />
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
}
