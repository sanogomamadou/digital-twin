/**
 * API Client — typed service for all backend calls.
 * Uses Vite dev proxy (see vite.config.js) — no CORS issues.
 * In production, set VITE_API_URL env var to backend URL.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
import useAuthStore from '../store/useAuthStore';

async function apiFetch(path, options = {}) {
    
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
    });
    
    if (!res.ok) {
        if (res.status === 401 && !path.startsWith('/auth/')) {
            useAuthStore.getState().logout();
            throw new Error("Session expirée, veuillez vous reconnecter");
        }

        let errStr = `Erreur ${res.status} ${res.statusText}`;
        try {
            const txt = await res.text();
            if (txt) {
                const j = JSON.parse(txt);
                errStr = j.detail || errStr;
            }
        } catch (e) {}
        throw new Error(errStr);
    }
    
    const txt = await res.text();
    try {
        return txt ? JSON.parse(txt) : {};
    } catch(e) {
        throw new Error("Invalid JSON de l'API: " + txt.substring(0, 50));
    }
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export async function loginUser(username, password) {
    return apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export async function logoutUser() {
    return apiFetch('/auth/logout', {
        method: 'POST',
    });
}

export async function registerUser(username, password) {
    return apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export async function getMe() {
    return apiFetch('/auth/me');
}

// ─── Layout API ───────────────────────────────────────────────────────────────

export async function layoutPrompt(prompt, currentState) {
    return apiFetch('/layout/prompt', {
        method: 'POST',
        body: JSON.stringify({ prompt, currentState }),
    });
}

export async function getLayoutSuggestions(domain) {
    const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    return apiFetch(`/layout/suggestions${query}`);
}

export async function getLayoutState(layoutId = 'default') {
    return apiFetch(`/layout/state/${layoutId}`);
}

export async function saveLayoutState(state) {
    return apiFetch('/layout/state', {
        method: 'PUT',
        body: JSON.stringify(state),
    });
}

// ─── KPI API ──────────────────────────────────────────────────────────────────

// ─── Data Source API ─────────────────────────────────────────────────────────

export async function connectTelemetryDb(twinId, sourceType, dbUrl, credentials = {}) {
    return apiFetch(`/source/connect?twin_id=${twinId}`, {
        method: 'POST',
        body: JSON.stringify({ source_type: sourceType, db_url: dbUrl, credentials }),
    });
}

export async function selectTelemetryTable(twinId, tableName) {
    return apiFetch(`/source/table?twin_id=${twinId}`, {
        method: 'POST',
        body: JSON.stringify({ table_name: tableName }),
    });
}

export async function getTelemetrySchema(twinId, domain) {
    const query = domain ? `?twin_id=${twinId}&domain=${domain}` : `?twin_id=${twinId}`;
    return apiFetch(`/source/schema${query}`);
}

export async function saveTelemetryAssignments(twinId, domain, assignments) {
    return apiFetch(`/source/assign?twin_id=${twinId}`, {
        method: 'POST',
        body: JSON.stringify({ domain, assignments }),
    });
}

export async function disconnectTelemetry(twinId) {
    return apiFetch(`/source?twin_id=${twinId}`, { method: 'DELETE' });
}

export async function getTelemetryStatus(twinId) {
    return apiFetch(`/source/status?twin_id=${twinId}`);
}

export async function proposeKpis(twinId, domain, columns, components = []) {
    return apiFetch(`/source/propose_kpis?twin_id=${twinId}`, {
        method: 'POST',
        body: JSON.stringify({ domain, columns, components }),
    });
}

export async function getComponentKpis(componentId, kpiName, limit = 200) {
    const params = new URLSearchParams();
    if (kpiName) params.set('kpi_name', kpiName);
    params.set('limit', limit);
    return apiFetch(`/kpis/${componentId}?${params}`);
}

export async function getKpiSummary() {
    return apiFetch('/kpis/summary');
}

export async function pushRealtimeKpi(componentId, kpiName, value, unit = '') {
    const params = new URLSearchParams({ component_id: componentId, kpi_name: kpiName, value, unit });
    return apiFetch(`/kpis/realtime?${params}`, { method: 'POST' });
}

// ─── Analytics API ────────────────────────────────────────────────────────────

export async function nlqQuery(twinId, question, { componentId, timeRange = '24h', history = [] } = {}, onThought = null) {
    const headers = { 'Content-Type': 'application/json' };

    const res = await fetch(`${BASE_URL}/analytics/query`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ twin_id: twinId, question, component_id: componentId, time_range: timeRange, history }),
    });

    if (!res.ok) {
        throw new Error(`Erreur ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let result = null;
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // Keep the last incomplete chunk in buffer
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.substring(6));
                    if (data.type === 'thought' && onThought) {
                        onThought(data.content);
                    } else if (data.type === 'result') {
                        result = data;
                    }
                } catch (e) {
                    console.error('SSE JSON Parse error', e, line);
                }
            }
        }
    }
    
    if (!result) throw new Error("No final result received from stream");
    return result;
}

export async function chartFromPrompt(prompt, data) {
    return apiFetch('/analytics/chart', {
        method: 'POST',
        body: JSON.stringify({ prompt, data }),
    });
}

export async function getQueryHistory(twinId, limit = 20) {
    return apiFetch(`/analytics/history?twin_id=${twinId}&limit=${limit}`);
}

export async function getQuerySuggestions(twinId, domain) {
    const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    return apiFetch(`/analytics/suggestions${query ? query + '&' : '?'}twin_id=${twinId}`);
}

export async function generateReport(data) {
    return apiFetch('/analytics/report', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// ─── Twins CRUD API ───────────────────────────────────────────────────────────

export async function listTwins() {
    return apiFetch('/twins');
}

export async function getTwin(twinId) {
    return apiFetch(`/twins/${twinId}`);
}

export async function saveTwin(twinId, state) {
    return apiFetch(`/twins/${twinId}`, {
        method: 'PUT',
        body: JSON.stringify(state),
    });
}

export async function deleteTwin(twinId) {
    return apiFetch(`/twins/${twinId}`, { method: 'DELETE' });
}

// ─── Share Link API ───────────────────────────────────────────────────────────

export async function createShareLink(data) {
    return apiFetch('/share', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function listShareLinks() {
    return apiFetch('/share');
}

export async function updateShareLink(shareId, data) {
    return apiFetch(`/share/${shareId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteShareLink(shareId) {
    return apiFetch(`/share/${shareId}`, { method: 'DELETE' });
}

export async function verifyShareLink(shareId, password) {
    return apiFetch(`/share/${shareId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ password }),
    });
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function checkBackendHealth() {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${BASE_URL}/health`, { signal: controller.signal });
        clearTimeout(id);
        if (res.ok) return true;
        return `HTTP ${res.status}`;
    } catch (e) {
        console.error("Health check failed:", e);
        return `Err: ${e.message}`;
    }
}
