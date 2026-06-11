import { useState, useEffect } from 'react';
import { getLLMConfig, updateLLMConfig } from '../../services/api';
import { Save, BrainCircuit, Key, Trash2, Plus, Server, Settings2, HelpCircle } from 'lucide-react';
import useToastStore from '../../store/useToastStore';
import useHotkeys from '../../hooks/useHotkeys';

export default function AdminLLMOps() {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { addToast } = useToastStore();

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

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            await updateLLMConfig(config);
            addToast('LLM Configuration saved successfully!', 'success');
        } catch (e) {
            addToast('Error saving: ' + e.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    useHotkeys('ctrl+s', handleSave);

    if (loading || !config) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '900px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-0)', marginBottom: '4px', letterSpacing: '-0.02em' }}>LLM Operations</h1>
                    <p style={{ color: 'var(--text-2)', fontSize: '15px' }}>Configure models, prompts, and inference settings for all agents.</p>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary"
                    style={{ height: '42px', padding: '0 24px' }}
                >
                    <Save size={18} />
                    {saving ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>

            <div style={{ 
                background: 'var(--bg-1)', 
                borderRadius: 'var(--r-xl)', 
                border: '1px solid var(--border)', 
                boxShadow: 'var(--shadow-sm)'
            }}>
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ padding: '10px', background: 'var(--accent-dim)', borderRadius: 'var(--r-md)', color: 'var(--accent)' }}>
                            <Server size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-0)' }}>Active Model Settings</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Select the foundational model driving the intelligence layer.</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                        <div>
                            <label className="label">Provider / Model</label>
                            <select 
                                value={config.model} 
                                onChange={e => setConfig({...config, model: e.target.value})}
                                className="input"
                                style={{ appearance: 'none', cursor: 'pointer', height: '42px' }}
                            >
                                {/* Only Groq is installed (langchain-groq). The backend
                                    (_build_llm_from_db) can route OpenAI/Anthropic/Google by model
                                    name, but their langchain-* packages are not in requirements.txt.
                                    Re-add their optgroups here once those packages are installed. */}
                                <optgroup label="Groq (Fast Inference)">
                                    <option value="llama3-70b-8192">Llama 3 70B</option>
                                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile</option>
                                    <option value="llama3-8b-8192">Llama 3 8B</option>
                                    <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                                </optgroup>
                            </select>
                        </div>

                        <div>
                            <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                Temperature <span>{config.temperature}</span>
                            </label>
                            <input 
                                type="range" 
                                min="0" max="2" step="0.1" 
                                value={config.temperature}
                                onChange={e => setConfig({...config, temperature: parseFloat(e.target.value)})}
                                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', marginTop: '12px' }}
                            />
                        </div>

                        <div>
                            <label className="label">Max Tokens</label>
                            <input 
                                type="number" 
                                value={config.max_tokens}
                                onChange={e => setConfig({...config, max_tokens: parseInt(e.target.value)})}
                                className="input"
                                style={{ height: '42px' }}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <Settings2 size={18} color="var(--text-1)" />
                        <label className="label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Base System Prompt
                            <div className="tooltip-wrap" style={{ display: 'flex' }}>
                                <HelpCircle size={14} color="var(--text-2)" />
                                <div className="tooltip">Prepended to all agents. Impacts global behavior.</div>
                            </div>
                        </label>
                    </div>
                    <textarea 
                        value={config.system_prompt}
                        onChange={e => setConfig({...config, system_prompt: e.target.value})}
                        className="input"
                        style={{ 
                            height: '180px', 
                            resize: 'vertical', 
                            fontFamily: 'monospace', 
                            fontSize: '13px',
                            lineHeight: 1.5,
                            background: 'var(--bg-1)'
                        }}
                    />
                    <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '8px' }}>
                        This prompt is prepended to all agents in the platform. Be careful, changes here impact global behavior.
                    </p>
                </div>

                <div style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ padding: '10px', background: 'rgba(245,158,11,0.15)', borderRadius: 'var(--r-md)', color: 'var(--orange)' }}>
                            <Key size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                API Key Vault (Failover Quotas)
                                <div className="tooltip-wrap" style={{ display: 'flex' }}>
                                    <HelpCircle size={14} color="var(--text-2)" />
                                    <div className="tooltip">Multiple keys allow automatic fallback on 429 Rate Limits.</div>
                                </div>
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Add secondary keys for high-availability routing.</p>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        {config.api_keys.map((key, index) => (
                            <div key={index} style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Key size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2)' }} />
                                    <input 
                                        type="password" 
                                        value={key}
                                        onChange={e => {
                                            const newKeys = [...config.api_keys];
                                            newKeys[index] = e.target.value;
                                            setConfig({...config, api_keys: newKeys});
                                        }}
                                        className="input"
                                        style={{ paddingLeft: '40px', fontFamily: 'monospace' }}
                                        placeholder="sk-..."
                                    />
                                </div>
                                <button 
                                    onClick={() => {
                                        const newKeys = config.api_keys.filter((_, i) => i !== index);
                                        setConfig({...config, api_keys: newKeys});
                                    }}
                                    className="btn btn-icon btn-danger"
                                    title="Remove Key"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                    
                    <button 
                        onClick={() => setConfig({...config, api_keys: [...config.api_keys, '']})}
                        className="btn btn-ghost"
                        style={{ borderStyle: 'dashed' }}
                    >
                        <Plus size={16} /> Add Fallback Key
                    </button>
                </div>
            </div>
        </div>
    );
}
