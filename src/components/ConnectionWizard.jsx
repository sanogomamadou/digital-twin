import { useState, useEffect } from 'react';
import { connectTelemetryDb, selectTelemetryTable, getTelemetrySchema, getTelemetryStatus } from '../services/api';
import useTwinStore from '../store/useTwinStore';

const SOURCE_TYPES = [
  { id: 'postgres', label: 'PostgreSQL' },
  { id: 'mongo', label: 'MongoDB' },
  { id: 'cassandra', label: 'Cassandra' },
  { id: 'databricks', label: 'Databricks' },
  { id: 'kafka', label: 'Apache Kafka' },
  { id: 'mqtt', label: 'MQTT Broker' },
];

export default function ConnectionWizard() {
  const { activeTwinId } = useTwinStore();
  const [sourceType, setSourceType] = useState('postgres');
  const [dbUrl, setDbUrl] = useState('');
  const [credentials, setCredentials] = useState({ db_name: '', access_token: '', topic: '', port: '1883', username: '', password: '' });
  
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [columns, setColumns] = useState([]);
  const [timestampCol, setTimestampCol] = useState('timestamp');
  const [componentIdCol, setComponentIdCol] = useState('component_id');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sourceStatus, setSourceStatus] = useState(null);

  useEffect(() => {
    getTelemetryStatus(activeTwinId || 'default').then(s => {
      setSourceStatus(s);
      if (s.connected) {
        getTelemetrySchema(activeTwinId || 'default').then(sch => {
          setSelectedTable(sch.table || '');
          setTimestampCol(sch.timestamp_col || 'timestamp');
          setComponentIdCol(sch.component_id_col || 'component_id');
          setColumns(sch.columns || []);
          setSuccess(`Currently connected to table/topic: ${sch.table}`);
        });
      }
    }).catch(() => {});
  }, []);

  const handleConnect = async () => {
    if (!dbUrl) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const data = await connectTelemetryDb(activeTwinId || 'default', sourceType, dbUrl, credentials);
      setTables(data.tables || []);
      setSuccess('Connected to data source. Please select a table/collection/topic.');
      
      // Auto-select if only 1 topic
      if ((sourceType === 'kafka' || sourceType === 'mqtt') && data.tables?.length === 1) {
          handleSelectTable(data.tables[0]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTable = async (t) => {
    if (!t) return;
    setSelectedTable(t);
    setLoading(true);
    try {
      await selectTelemetryTable(activeTwinId || 'default', t, timestampCol, componentIdCol);
      const sch = await getTelemetrySchema(activeTwinId || 'default');
      setColumns(sch.columns || []);
    } catch (e) {
      setError('Failed to fetch schema for mapping: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!selectedTable) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      await selectTelemetryTable(activeTwinId || 'default', selectedTable, timestampCol, componentIdCol);
      setSuccess(`Configuration saved! Telemetry will be streamed from: ${selectedTable}. You can now proceed to create a Twin and map these columns.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Switch default URL when changing source type
  const handleTypeChange = (e) => {
    const t = e.target.value;
    setSourceType(t);
    setTables([]);
    setSelectedTable('');
    if (t === 'postgres') setDbUrl('');
    if (t === 'mongo') setDbUrl('mongodb://localhost:27017/');
    if (t === 'cassandra') setDbUrl('127.0.0.1');
    if (t === 'databricks') setDbUrl('dbc-xxxxx.cloud.databricks.com');
    if (t === 'kafka') setDbUrl('localhost:9092');
    if (t === 'mqtt') setDbUrl('localhost');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🔌 Global Telemetry Connection
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
          Connect the platform to your telemetry database or stream. Assignment and live visualization will be configured during the Twin creation.
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          
          {/* Source Type */}
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '6px', display: 'block' }}>Source Type</label>
          <select 
            value={sourceType}
            onChange={handleTypeChange}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: '12px', marginBottom: '12px' }}
          >
            {SOURCE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>

          {/* Dynamic DB URL */}
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '6px', display: 'block' }}>
            {sourceType === 'postgres' ? 'Database URL' : 
             sourceType === 'mongo' ? 'Connection String (URI)' : 
             sourceType === 'cassandra' ? 'Contact Points (comma separated)' : 
             sourceType === 'databricks' ? 'Server Hostname' : 
             sourceType === 'kafka' ? 'Bootstrap Servers' : 'Broker Host'}
          </label>
          <input 
            type="text" 
            value={dbUrl} 
            onChange={e => setDbUrl(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: '12px', marginBottom: '12px', boxSizing: 'border-box' }}
          />

          {/* Dynamic Credentials / Extra Config */}
          {(sourceType === 'mongo' || sourceType === 'cassandra' || sourceType === 'databricks') && (
            <>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '6px', display: 'block' }}>
                {sourceType === 'databricks' ? 'HTTP Path' : sourceType === 'cassandra' ? 'Keyspace' : 'Database Name'}
              </label>
              <input 
                type="text" 
                value={credentials.db_name} 
                onChange={e => setCredentials({...credentials, db_name: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: '12px', marginBottom: '12px', boxSizing: 'border-box' }}
              />
            </>
          )}

          {sourceType === 'databricks' && (
            <>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '6px', display: 'block' }}>Access Token</label>
              <input 
                type="password" 
                value={credentials.access_token} 
                onChange={e => setCredentials({...credentials, access_token: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: '12px', marginBottom: '12px', boxSizing: 'border-box' }}
              />
            </>
          )}

          {(sourceType === 'kafka' || sourceType === 'mqtt') && (
            <>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '6px', display: 'block' }}>
                {sourceType === 'mqtt' ? 'Topic Prefix (e.g. dt/#)' : 'Topic Name'}
              </label>
              <input 
                type="text" 
                value={credentials.topic} 
                onChange={e => setCredentials({...credentials, topic: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: '12px', marginBottom: '12px', boxSizing: 'border-box' }}
              />
            </>
          )}

          {sourceType === 'mqtt' && (
            <>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '6px', display: 'block' }}>Port</label>
                  <input type="text" value={credentials.port} onChange={e => setCredentials({...credentials, port: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: '12px', marginBottom: '12px', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '6px', display: 'block' }}>Username</label>
                  <input type="text" value={credentials.username} onChange={e => setCredentials({...credentials, username: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: '12px', marginBottom: '12px', boxSizing: 'border-box' }} />
                </div>
              </div>
            </>
          )}

          <button onClick={handleConnect} disabled={!dbUrl || loading}
            style={{ width: '100%', padding: '10px', borderRadius: '10px', background: dbUrl ? 'linear-gradient(135deg,#4865f2,#f4723e)' : 'var(--bg-0)', border: 'none', color: dbUrl ? '#fff' : 'var(--text-2)', fontSize: '12px', fontWeight: 700, cursor: dbUrl ? 'pointer' : 'not-allowed' }}>
            {loading ? '⏳ Connecting...' : 'Test Connection & Fetch Schemas'}
          </button>
        </div>

        {tables.length > 0 ? (
          <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-0)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '6px', display: 'block' }}>
              Select {sourceType === 'mongo' ? 'Collection' : sourceType === 'kafka' || sourceType === 'mqtt' ? 'Topic' : 'Table'}
            </label>
            <select 
              value={selectedTable}
              onChange={e => handleSelectTable(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', fontSize: '12px', marginBottom: '12px' }}
            >
              <option value="" disabled>-- Select --</option>
              {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {selectedTable && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '8px' }}>Schema Mapping (Normalization)</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-2)', marginBottom: '4px', display: 'block' }}>Component/Sensor ID Field</label>
                    {columns.length > 0 ? (
                      <select 
                        value={componentIdCol}
                        onChange={e => setComponentIdCol(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: '11px' }}
                      >
                        <option value="component_id">Default (component_id)</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={componentIdCol} onChange={e => setComponentIdCol(e.target.value)} placeholder="e.g. sensor_id" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: '11px', boxSizing: 'border-box' }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-2)', marginBottom: '4px', display: 'block' }}>Timestamp Field</label>
                    {columns.length > 0 ? (
                      <select 
                        value={timestampCol}
                        onChange={e => setTimestampCol(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: '11px' }}
                      >
                        <option value="timestamp">Default (timestamp)</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={timestampCol} onChange={e => setTimestampCol(e.target.value)} placeholder="e.g. created_at" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: '11px', boxSizing: 'border-box' }} />
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <button onClick={handleSaveConnection} disabled={!selectedTable || loading}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: selectedTable ? '#10d98d' : 'var(--bg-1)', border: 'none', color: selectedTable ? '#fff' : 'var(--text-2)', fontSize: '12px', fontWeight: 700, cursor: selectedTable ? 'pointer' : 'not-allowed' }}>
              {loading ? '⏳ Saving...' : 'Save Configuration'}
            </button>
          </div>
        ) : success && tables.length === 0 && !loading && sourceType === 'postgres' ? (
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(245,158,11,0.08)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: '11px' }}>
            <strong style={{ display: 'block', marginBottom: '4px' }}>⚠️ No tables found in this database</strong>
            The database is currently empty. Please make sure you have restarted the <code>generate_pg_data.py</code> script so it can create the telemetry tables.
          </div>
        ) : null}

        {error && <div style={{ fontSize: '11px', color: '#ef4444', padding: '10px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
        {success && <div style={{ fontSize: '11px', color: '#10d98d', padding: '10px', background: 'rgba(16,217,141,0.08)', borderRadius: '8px', border: '1px solid rgba(16,217,141,0.2)' }}>{success}</div>}
      </div>
    </div>
  );
}
