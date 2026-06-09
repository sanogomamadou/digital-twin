import { create } from 'zustand';
import { listTwins, getTwin, saveTwin as apiSaveTwin, deleteTwin as apiDeleteTwin, renameTwin as apiRenameTwin, listShareLinks, createShareLink, updateShareLink, deleteShareLink, generateReport } from '../services/api';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const DOMAINS = {
    factory: {
        label: 'Factory', icon: '🏭', color: '#f97316',
        components: [
            { type: 'hydraulic_press', name: 'Hydraulic Press', gridSize: [2, 2], color: '#64748b' },
            { type: 'conveyor_belt', name: 'Conveyor Belt', gridSize: [4, 1], color: '#3b82f6' },
            { type: 'cnc_machine', name: 'CNC Machine', gridSize: [2, 2], color: '#6366f1' },
            { type: 'assembly_station', name: 'Assembly Station', gridSize: [2, 2], color: '#10b981' },
            { type: 'quality_control', name: 'Quality Control', gridSize: [2, 1], color: '#f59e0b' },
            { type: 'warehouse_rack', name: 'Warehouse Rack', gridSize: [3, 1], color: '#f4723e' },
        ],
    },
    airport: {
        label: 'Airport', icon: '✈️', color: '#06b6d4',
        components: [
            { type: 'terminal', name: 'Terminal', gridSize: [4, 3], color: '#0ea5e9' },
            { type: 'gate', name: 'Gate', gridSize: [2, 1], color: '#6366f1' },
            { type: 'runway', name: 'Runway', gridSize: [6, 2], color: '#374151' },
            { type: 'checkin_desk', name: 'Check-in Desk', gridSize: [2, 1], color: '#10b981' },
            { type: 'security_zone', name: 'Security Zone', gridSize: [3, 2], color: '#ef4444' },
            { type: 'baggage_claim', name: 'Baggage Claim', gridSize: [3, 2], color: '#f59e0b' },
        ],
    },
    warehouse: {
        label: 'Warehouse', icon: '📦', color: '#84cc16',
        components: [
            { type: 'storage_rack', name: 'Storage Rack', gridSize: [3, 1], color: '#a78bfa' },
            { type: 'picking_zone', name: 'Picking Zone', gridSize: [2, 2], color: '#34d399' },
            { type: 'reception_dock', name: 'Reception Dock', gridSize: [3, 2], color: '#60a5fa' },
            { type: 'shipping_dock', name: 'Shipping Dock', gridSize: [3, 2], color: '#f472b6' },
            { type: 'conveyor', name: 'Conveyor', gridSize: [4, 1], color: '#fbbf24' },
            { type: 'sorter', name: 'Sorter', gridSize: [2, 2], color: '#fb923c' },
        ],
    },
};

const generateKpis = (domain) => {
    const kpiSets = {
        factory: [
            { id: 'kpi_temp', name: 'Machine Temperature', value: 72, unit: '°C', status: 'orange', rules: { green: [0, 60], orange: [60, 85], red: [85, 200] } },
            { id: 'kpi_throughput', name: 'Production Throughput', value: 94, unit: 'u/h', status: 'green', rules: { green: [80, 200], orange: [50, 80], red: [0, 50] } },
            { id: 'kpi_downtime', name: 'Machine Downtime', value: 8, unit: '%', status: 'green', rules: { green: [0, 10], orange: [10, 20], red: [20, 100] } },
            { id: 'kpi_quality', name: 'Quality Rate', value: 96, unit: '%', status: 'green', rules: { green: [90, 100], orange: [70, 90], red: [0, 70] } },
        ],
        airport: [
            { id: 'kpi_pax_flow', name: 'Passenger Flow', value: 1240, unit: 'pax/h', status: 'orange', rules: { green: [0, 1000], orange: [1000, 1500], red: [1500, 5000] } },
            { id: 'kpi_gate_util', name: 'Gate Utilization', value: 78, unit: '%', status: 'green', rules: { green: [60, 100], orange: [30, 60], red: [0, 30] } },
            { id: 'kpi_security_wait', name: 'Security Wait', value: 22, unit: 'min', status: 'orange', rules: { green: [0, 15], orange: [15, 30], red: [30, 120] } },
            { id: 'kpi_baggage_delay', name: 'Baggage Delay', value: 4, unit: 'min', status: 'green', rules: { green: [0, 10], orange: [10, 20], red: [20, 60] } },
        ],
        warehouse: [
            { id: 'kpi_pick_rate', name: 'Pick Rate', value: 340, unit: 'items/h', status: 'green', rules: { green: [300, 600], orange: [200, 300], red: [0, 200] } },
            { id: 'kpi_fill_rate', name: 'Rack Fill Rate', value: 88, unit: '%', status: 'green', rules: { green: [0, 85], orange: [85, 95], red: [95, 100] } },
            { id: 'kpi_dock_util', name: 'Dock Utilization', value: 65, unit: '%', status: 'green', rules: { green: [50, 90], orange: [30, 50], red: [0, 30] } },
            { id: 'kpi_cycle_time', name: 'Order Cycle Time', value: 38, unit: 'min', status: 'orange', rules: { green: [0, 30], orange: [30, 60], red: [60, 240] } },
        ],
    };
    return kpiSets[domain] || kpiSets.factory;
};

const getBlueprint = (domain, type) =>
    DOMAINS[domain]?.components.find(c => c.type === type);

const generateComponents = (domain, gridCols, gridRows) => {
    const blueprints = DOMAINS[domain]?.components || [];
    const placed = [];
    const occupied = new Set();
    let idCounter = 1;

    const canPlace = (col, row, w, h) => {
        for (let r = row; r < row + h; r++)
            for (let c = col; c < col + w; c++)
                if (c >= gridCols || r >= gridRows || occupied.has(`${r}-${c}`)) return false;
        return true;
    };
    const markOccupied = (col, row, w, h) => {
        for (let r = row; r < row + h; r++)
            for (let c = col; c < col + w; c++)
                occupied.add(`${r}-${c}`);
    };

    for (const bp of blueprints) {
        const [w, h] = bp.gridSize;
        for (let row = 1; row < gridRows - h; row++) {
            let found = false;
            for (let col = 1; col < gridCols - w; col++) {
                if (canPlace(col, row, w, h)) {
                    const uniqueSuffix = Math.random().toString(36).substring(2,7);
                    placed.push({ id: `${bp.type}_${idCounter++}_${uniqueSuffix}`, type: bp.type, name: `${bp.name} ${idCounter - 1}`, gridSize: bp.gridSize, color: bp.color, col, row, kpiIds: [] });
                    markOccupied(col, row, w, h);
                    found = true; break;
                }
            }
            if (found) break;
        }
    }
    return placed;
};

const generateConnections = (components) => {
    const connections = [];
    const statuses = ['green', 'orange', 'green', 'red'];
    for (let i = 0; i < Math.min(components.length - 1, 5); i++) {
        connections.push({ id: `conn_${i}`, sourceId: components[i].id, targetId: components[i + 1].id, flowStatus: statuses[i % 4] });
    }
    return connections;
};

// Generate simulated history for charts
const generateHistory = (kpis) => {
    const now = Date.now();
    const history = [];
    for (let i = 29; i >= 0; i--) {
        const point = { time: new Date(now - i * 10000).toLocaleTimeString() };
        kpis.forEach(kpi => {
            const lo = kpi.rules.green[0];
            const hi = kpi.rules.red?.[1] || kpi.rules.orange?.[1] || 200;
            point[kpi.id] = Math.max(lo, Math.min(hi, kpi.value + (Math.random() - 0.5) * (hi - lo) * 0.15));
        });
        history.push(point);
    }
    return history;
};

const AI_RESPONSES = (kpis, msg) => {
    const lower = msg.toLowerCase();
    const criticals = kpis.filter(k => k.status === 'red');
    const warnings = kpis.filter(k => k.status === 'orange');
    const normals = kpis.filter(k => k.status === 'green');

    if (lower.includes('status') || lower.includes('overview') || lower.includes('rapport') || lower.includes('résumé')) {
        return `📊 **System Status Overview**\n\n✅ ${normals.length} KPIs in normal range\n⚠️ ${warnings.length} KPIs with warnings\n🚨 ${criticals.length} KPIs critical\n\n${criticals.length > 0 ? `**Critical alerts:** ${criticals.map(k => k.name).join(', ')}` : 'No critical alerts at this time.'}`;
    }
    if (lower.includes('critical') || lower.includes('critique') || lower.includes('alert') || lower.includes('alerte')) {
        if (criticals.length === 0) return '✅ No critical KPIs detected. All systems are within safe thresholds.';
        return `🚨 **Critical KPIs Detected:**\n\n${criticals.map(k => `• **${k.name}**: ${k.value} ${k.unit} (threshold: ${k.rules.red?.[0]}+)`).join('\n')}\n\n**Recommendation:** Immediate intervention required for highlighted systems.`;
    }
    if (lower.includes('recommend') || lower.includes('action') || lower.includes('conseil')) {
        const issues = [...criticals, ...warnings];
        if (issues.length === 0) return '✅ All KPIs are healthy. No actions needed. Continue monitoring at current 3s refresh rate.';
        return `💡 **Recommended Actions:**\n\n${issues.map((k, i) => `${i + 1}. **${k.name}** (${k.status.toUpperCase()}): ${k.status === 'red' ? 'Stop and inspect immediately' : 'Schedule maintenance check'
            } — current value ${k.value} ${k.unit}`).join('\n')}`;
    }
    if (lower.includes('trend') || lower.includes('tendance') || lower.includes('evolution')) {
        return `📈 **KPI Trends (last 5 minutes):**\n\n${kpis.map(k => `• **${k.name}**: ${k.value} ${k.unit} — ${k.status === 'green' ? '↔ Stable' : k.status === 'orange' ? '↗ Rising' : '↑ Critical rise'}`).join('\n')}\n\nRefresh rate: every 3 seconds.`;
    }
    if (lower.includes('best') || lower.includes('worst') || lower.includes('performance')) {
        const best = normals[0];
        const worst = criticals[0] || warnings[0];
        return `🏆 **Performance Summary:**\n\n${best ? `**Best performing:** ${best.name} at ${best.value} ${best.unit} ✅` : ''}\n${worst ? `\n**Needs attention:** ${worst.name} at ${worst.value} ${worst.unit} ${worst.status === 'red' ? '🚨' : '⚠️'}` : ''}`;
    }
    // Default
    return `🤖 I can help you analyze your digital twin data. Try asking:\n\n• "What is the system status?"\n• "Are there any critical alerts?"\n• "What actions do you recommend?"\n• "Show me KPI trends"\n• "What is the best/worst performing KPI?"`;
};

let compIdCounter = 100;

const useTwinStore = create((set, get) => ({
    threeSceneRef: null,

    currentStep: 0,
    selectedDomain: null,
    twinName: '',
    width: 60,
    length: 40,
    gridCols: 10,
    gridRows: 0,
    minCols: 1,
    minRows: 1,
    cellSize: 2,

    twins: [],
    activeTwinId: null,
    shareLinks: [],

    components: [],
    connections: [],
    kpis: [],
    kpiAssignments: [],
    kpiHistory: [],
    selectedComponentId: null,
    hoveredComponentId: null,
    sidebarOpen: true,
    activeView: 'isometric',
    activePanel: 'kpi',  // 'kpi' | 'charts' | 'chat'

    chatMessages: [
        { id: 0, role: 'assistant', text: '👋 Hello! I\'m your Analytics AI powered by Groq.\n\nConnect your data source first (🔌 Source tab), then ask me anything about your KPIs.' }
    ],

    nlqMessages: [
        { id: 0, role: 'assistant', text: '✨ Welcome to your **Analytics AI**!\n\nI\'m here to turn your KPI data into actionable insights. Ask me anything, and I\'ll generate beautiful charts on the fly.', chart: null }
    ],
    setNlqMessages: (updater) => set(s => ({
        nlqMessages: typeof updater === 'function' ? updater(s.nlqMessages) : updater
    })),
    clearNlqMessages: () => set({
        nlqMessages: [
            { id: 0, role: 'assistant', text: '✨ Welcome to your **Analytics AI**!\n\nI\'m here to turn your KPI data into actionable insights. Ask me anything, and I\'ll generate beautiful charts on the fly.', chart: null }
        ]
    }),

    setStep: (step) => set(s => ({
        currentStep: step,
        selectedComponentId: s.currentStep !== step ? null : s.selectedComponentId
    })),
    setDomain: (domain) => set({ selectedDomain: domain }),
    setTwinName: (name) => set({ twinName: name }),
    setDimensions: (width, length) => {
        const cellSize = 2;
        set({ width, length, gridCols: Math.ceil(width / cellSize), gridRows: Math.ceil(length / cellSize), cellSize });
    },
    resizeGrid: (cols, rows) => {
        const { cellSize, components, minCols, minRows } = get();
        
        // Find the maximum extent of all placed components
        let maxColExtent = minCols;
        let maxRowExtent = minRows;
        
        components.forEach(c => {
            const extCol = c.col + c.gridSize[0];
            const extRow = c.row + c.gridSize[1];
            if (extCol > maxColExtent) maxColExtent = extCol;
            if (extRow > maxRowExtent) maxRowExtent = extRow;
        });

        // Enforce the boundary
        const safeCols = Math.max(cols, maxColExtent);
        const safeRows = Math.max(rows, maxRowExtent);

        set({ gridCols: safeCols, gridRows: safeRows, width: safeCols * cellSize, length: safeRows * cellSize });
    },
    selectComponent: (id) => set({ selectedComponentId: id }),
    hoverComponent: (id) => set({ hoveredComponentId: id }),
    toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
    setView: (v) => set({ activeView: v }),
    setActivePanel: (p) => set({ activePanel: p }),

    initScene: () => {
        const { selectedDomain, gridCols, gridRows } = get();
        // Start with empty components and connections
        const components = [];
        const connections = [];
        const kpiHistory = [];
        set({ components, connections, kpis: [], kpiAssignments: [], kpiHistory });
    },

    addComponent: (type, overrides = {}) => {
        const { selectedDomain, gridCols, gridRows, components } = get();
        const bp = getBlueprint(selectedDomain, type) || { name: type, gridSize: [2, 2], color: '#4865f2' };
        const [w, h] = overrides.gridSize || bp.gridSize;
        const occupied = new Set();
        components.forEach(c => {
            const [cw, ch] = c.gridSize;
            for (let r = c.row; r < c.row + ch; r++)
                for (let cl = c.col; cl < c.col + cw; cl++)
                    occupied.add(`${r}-${cl}`);
        });

        // If explicit position provided (from AI agent), use it
        if (overrides.row !== undefined && overrides.col !== undefined) {
            const uniqueSuffix = Math.random().toString(36).substring(2,7);
            const newComp = {
                id: `${type}_${++compIdCounter}_${uniqueSuffix}`,
                type,
                name: overrides.name || `${bp.name} ${compIdCounter}`,
                gridSize: overrides.gridSize || bp.gridSize,
                color: overrides.color || bp.color,
                col: overrides.col,
                row: overrides.row,
                kpiIds: [],
                // Custom AI-generated component metadata
                isCustom: overrides.isCustom || false,
                icon: overrides.icon || '',
                description: overrides.description || '',
                mesh3D: overrides.mesh3D || null,
            };
            set(s => ({ components: [...s.components, newComp] }));
            return;
        }

        // Auto-place: find first free cell
        for (let row = 0; row < gridRows - h + 1; row++) {
            for (let col = 0; col < gridCols - w + 1; col++) {
                let ok = true;
                for (let r = row; r < row + h && ok; r++)
                    for (let c = col; c < col + w && ok; c++)
                        if (occupied.has(`${r}-${c}`)) ok = false;
                if (ok) {
                    const uniqueSuffix = Math.random().toString(36).substring(2,7);
                    const newComp = { id: `${type}_${++compIdCounter}_${uniqueSuffix}`, type, name: `${bp.name} ${compIdCounter}`, gridSize: bp.gridSize, color: bp.color, col, row, kpiIds: [] };
                    set(s => ({ components: [...s.components, newComp] }));
                    return;
                }
            }
        }
    },

    removeComponent: (id) => {
        set(s => ({
            components: s.components.filter(c => c.id !== id),
            connections: s.connections.filter(cn => cn.sourceId !== id && cn.targetId !== id),
            selectedComponentId: s.selectedComponentId === id ? null : s.selectedComponentId,
        }));
    },

    removeConnection: (id) => {
        set(s => ({
            connections: s.connections.filter(c => c.id !== id)
        }));
    },

    addConnection: (sourceId, targetId) => {
        set(s => {
            if (sourceId === targetId) return s;
            if (s.connections.some(c => c.sourceId === sourceId && c.targetId === targetId)) return s;
            const newConn = { id: `conn_${Date.now()}_${Math.floor(Math.random()*1000)}`, sourceId, targetId, flowStatus: 'green' };
            return { connections: [...s.connections, newConn] };
        });
    },

    moveComponent: (id, newCol, newRow) => {
        set(s => {
            const comp = s.components.find(c => c.id === id);
            if (!comp) return s;
            const [w, h] = comp.gridSize;
            const occupied = new Set();
            s.components.forEach(c => {
                if (c.id === id) return;
                const [cw, ch] = c.gridSize;
                for (let r = c.row; r < c.row + ch; r++)
                    for (let cl = c.col; cl < c.col + cw; cl++)
                        occupied.add(`${r}-${cl}`);
            });
            for (let r = newRow; r < newRow + h; r++)
                for (let c = newCol; c < newCol + w; c++)
                    if (occupied.has(`${r}-${c}`)) return s;
            if (newCol < 0 || newRow < 0 || newCol + w > s.gridCols || newRow + h > s.gridRows) return s;
            return { components: s.components.map(c => c.id === id ? { ...c, col: newCol, row: newRow } : c) };
        });
    },

    rotateComponent: (id) => {
        set(s => {
            const comp = s.components.find(c => c.id === id);
            if (!comp) return s;
            const [w, h] = comp.gridSize;
            const newW = h;
            const newH = w;
            
            const occupied = new Set();
            s.components.forEach(c => {
                if (c.id === id) return;
                const [cw, ch] = c.gridSize;
                for (let r = c.row; r < c.row + ch; r++)
                    for (let cl = c.col; cl < c.col + cw; cl++)
                        occupied.add(`${r}-${cl}`);
            });
            
            for (let r = comp.row; r < comp.row + newH; r++) {
                for (let c = comp.col; c < comp.col + newW; c++) {
                    if (c >= s.gridCols || r >= s.gridRows || occupied.has(`${r}-${c}`)) {
                        return s;
                    }
                }
            }
            
            return {
                components: s.components.map(c => 
                    c.id === id 
                        ? { ...c, gridSize: [newW, newH], rotation: ((c.rotation || 0) + 90) % 360 } 
                        : c
                )
            };
        });
    },

    resizeComponent: (id, newW, newH) => {
        set(s => {
            if (newW < 1 || newH < 1) return s;
            const comp = s.components.find(c => c.id === id);
            if (!comp) return s;

            // Check boundaries
            if (comp.col + newW > s.gridCols || comp.row + newH > s.gridRows) {
                return s;
            }

            // Check collisions
            const occupied = new Set();
            s.components.forEach(c => {
                if (c.id === id) return;
                const [cw, ch] = c.gridSize;
                for (let r = c.row; r < c.row + ch; r++)
                    for (let cl = c.col; cl < c.col + cw; cl++)
                        occupied.add(`${r}-${cl}`);
            });

            for (let r = comp.row; r < comp.row + newH; r++) {
                for (let c = comp.col; c < comp.col + newW; c++) {
                    if (occupied.has(`${r}-${c}`)) {
                        return s; // collision detected
                    }
                }
            }

            return {
                components: s.components.map(c =>
                    c.id === id ? { ...c, gridSize: [newW, newH] } : c
                )
            };
        });
    },

    updateKpiValues: () => {
        set(s => {
            const newKpis = s.kpis.map(kpi => {
                const lo = kpi.rules.green[0];
                const hi = kpi.rules.red?.[1] || kpi.rules.orange?.[1] || 200;
                const newVal = +(kpi.value + (Math.random() - 0.5) * (hi - lo) * 0.04).toFixed(1);
                const clamped = Math.max(lo, Math.min(newVal, hi));
                let status = 'green';
                if (clamped >= (kpi.rules.red?.[0] ?? Infinity)) status = 'red';
                else if (clamped >= (kpi.rules.orange?.[0] ?? Infinity)) status = 'orange';
                return { ...kpi, value: clamped, status };
            });
            const newPoint = { time: new Date().toLocaleTimeString() };
            newKpis.forEach(k => { newPoint[k.id] = k.value; });
            const newHistory = [...s.kpiHistory.slice(-49), newPoint];
            return { kpis: newKpis, kpiHistory: newHistory };
        });
    },

    clearKpis: () => {
        set(s => {
            const newComponents = s.components.map(c => ({ ...c, kpiIds: [] }));
            return { kpis: [], kpiHistory: [], components: newComponents };
        });
    },

    setKpiAssignments: (assignments) => set({ kpiAssignments: assignments }),

    // Called by the WebSocket hook for each real-time reading from the backend
    updateKpiFromWS: (reading) => {
        // reading shape: { componentId, kpiName, value, unit, status, source, meta? }
        set(s => {
            const comp = s.components.find(c => c.id === reading.componentId);
            if (!comp) {
                // FIX: Ignore KPI readings for components that don't belong to the active twin.
                return s;
            }

            const kpiId = `ws_${reading.componentId}_${reading.kpiName}`
                .replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '').toLowerCase();

            const exists = s.kpis.find(k => k.id === kpiId);
            let newKpis;
            let newComponents = s.components;

            if (exists) {
                // Update existing KPI value + status
                newKpis = s.kpis.map(k =>
                    k.id === kpiId
                        ? {
                            ...k,
                            value: reading.value,
                            status: reading.status || 'green',
                            unit: reading.unit || k.unit,
                            interaction: reading.meta?.interaction || k.interaction || 'pulse',
                          }
                        : k
                );
            } else {
                // First reading for this KPI — register it
                // Parse rules from the reading meta (set during column assignment)
                const rules = reading.meta?.rules || {};
                const newKpi = {
                    id: kpiId,
                    name: reading.kpiName,
                    value: reading.value,
                    unit: reading.unit || '',
                    status: reading.status || 'green',
                    source: reading.source || 'realtime',
                    interaction: reading.meta?.interaction || 'pulse',
                    rules: {
                        green:  rules.green  || [0, rules.orange?.[0] || 999],
                        orange: rules.orange || null,
                        red:    rules.red    || null,
                    },
                };
                newKpis = [...s.kpis, newKpi];

                // Link KPI to its component
                if (!comp.kpiIds?.includes(kpiId)) {
                    newComponents = s.components.map(c =>
                        c.id === reading.componentId
                            ? { ...c, kpiIds: [...(c.kpiIds || []), kpiId] }
                            : c
                    );
                }
            }

            // Always update history — add one time-point with ALL current kpi values
            const newPoint = { time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
            newKpis.forEach(k => { newPoint[k.id] = typeof k.value === 'number' ? +k.value.toFixed(2) : k.value; });
            const newHistory = [...s.kpiHistory.slice(-59), newPoint];

            return { kpis: newKpis, kpiHistory: newHistory, components: newComponents };
        });
    },



    sendMessage: (text) => {
        const msgId = Date.now();
        set(s => ({ chatMessages: [...s.chatMessages, { id: msgId, role: 'user', text }] }));
        setTimeout(() => {
            const { kpis } = get();
            const response = AI_RESPONSES(kpis, text);
            set(s => ({ chatMessages: [...s.chatMessages, { id: msgId + 1, role: 'assistant', text: response }] }));
        }, 700);
    },

    createTwin: () => {
        const { twinName, selectedDomain, width, length, gridCols, gridRows } = get();
        const newTwin = { id: `twin_${Date.now()}`, name: twinName || `${DOMAINS[selectedDomain]?.label} Twin`, domain: selectedDomain, width, length, gridCols, gridRows, modified: new Date().toISOString() };
        set(s => ({ twins: [...s.twins, newTwin], activeTwinId: newTwin.id }));
    },

    exportDigitalTwin: async ({ exportJson, export3D, exportPdf } = { exportJson: true, export3D: true, exportPdf: false }) => {
        const { threeSceneRef, twinName, selectedDomain, components, kpis, connections, activeTwinId } = get();
        if (export3D && !threeSceneRef) throw new Error("3D Scene not ready.");

        // 1. Gather Data Snapshot
        const dataSnapshot = { twin_id: activeTwinId || 'default', 
            timestamp: new Date().toISOString(),
            twinName,
            domain: selectedDomain,
            components,
            connections,
            kpis,
        };

        const name = (twinName || "digital_twin").replace(/\s+/g, '_').toLowerCase();
        let glbBuffer = null;
        let pdfBlob = null;
        let pdfFilename = `${name}_report.pdf`;
        let jsonFilename = `${name}_data.json`;
        let glbFilename = `${name}_scene.glb`;

        // 2. Export GLTF
        if (export3D) {
            const exporter = new GLTFExporter();
            const exportScene = () => new Promise((resolve, reject) => {
                exporter.parse(
                    threeSceneRef,
                    (gltf) => { resolve(gltf); },
                    (err) => { reject(err); },
                    { binary: true } // GLB format
                );
            });
            glbBuffer = await exportScene();
        }

        // 3. Export PDF
        if (exportPdf) {
            try {
                const resData = await generateReport(dataSnapshot);
                const aiReport = resData.report || "Analyse IA non disponible.";

                const doc = new jsPDF();
                const dxcPurple = [95, 37, 159]; // #5F259F
                const dxcBlack = [26, 26, 26];

                // Mappage du domaine en français
                const domainEn = selectedDomain === 'factory' ? 'Factory' : selectedDomain === 'airport' ? 'Airport' : selectedDomain === 'warehouse' ? 'Warehouse' : 'Unknown';

                // Header block with DXC Purple
                doc.setFillColor(...dxcPurple);
                doc.rect(0, 0, 210, 40, 'F');

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(24);
                doc.setTextColor(255, 255, 255);
                doc.text(`Digital Twin Report`, 14, 20);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                doc.text(`Domain: ${domainEn}  |  Date: ${new Date().toLocaleDateString('en-US')}`, 14, 30);
                doc.text(`Components: ${components.length}  |  Connections: ${connections.length}`, 14, 36);

                let currentY = 50;

                if (typeof aiReport === 'object') {
                    // Executive Summary
                    doc.setFontSize(16);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...dxcPurple);
                    doc.text("Résumé Exécutif", 14, currentY);
                    currentY += 8;
                    
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...dxcBlack);
                    const execText = doc.splitTextToSize(aiReport.executiveSummary || "", 180);
                    doc.text(execText, 14, currentY);
                    currentY += (execText.length * 5) + 10;
                    
                    // Operational Status
                    doc.setFontSize(16);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...dxcPurple);
                    doc.text("Statut Opérationnel", 14, currentY);
                    currentY += 8;
                    
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...dxcBlack);
                    const opText = doc.splitTextToSize(aiReport.operationalStatus || "", 180);
                    doc.text(opText, 14, currentY);
                    currentY += (opText.length * 5) + 10;
                    
                    // Key Insights
                    if (aiReport.keyInsights && aiReport.keyInsights.length > 0) {
                        doc.setFontSize(16);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(...dxcPurple);
                        doc.text("Insights Majeurs", 14, currentY);
                        currentY += 8;
                        
                        doc.setFontSize(11);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(...dxcBlack);
                        aiReport.keyInsights.forEach(insight => {
                            const lines = doc.splitTextToSize(`• ${insight}`, 175);
                            doc.text(lines, 14, currentY);
                            currentY += (lines.length * 5) + 2;
                        });
                        currentY += 8;
                    }
                    
                    // Recommendations
                    if (aiReport.recommendations && aiReport.recommendations.length > 0) {
                        if (currentY > 250) { doc.addPage(); currentY = 20; }
                        doc.setFontSize(16);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(...dxcPurple);
                        doc.text("Recommandations Stratégiques", 14, currentY);
                        currentY += 8;
                        
                        doc.setFontSize(11);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(...dxcBlack);
                        aiReport.recommendations.forEach(rec => {
                            const lines = doc.splitTextToSize(`• ${rec}`, 175);
                            doc.text(lines, 14, currentY);
                            currentY += (lines.length * 5) + 2;
                        });
                        currentY += 10;
                    }
                } else {
                    // Fallback
                    doc.setFontSize(16);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...dxcPurple);
                    doc.text("Analyse IA", 14, currentY);
                    currentY += 8;
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...dxcBlack);
                    const splitText = doc.splitTextToSize(String(aiReport), 180);
                    doc.text(splitText, 14, currentY);
                    currentY += (splitText.length * 5) + 10;
                }

                // KPIs Table
                if (kpis.length > 0) {
                    if (currentY > 230) { doc.addPage(); currentY = 20; }
                    
                    doc.setFontSize(16);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...dxcPurple);
                    doc.text("Indicateurs Clés de Performance (KPIs)", 14, currentY);
                    
                    const tableData = kpis.map(k => {
                        const comp = components.find(c => c.kpiIds && c.kpiIds.includes(k.id));
                        const statusFr = k.status === 'red' ? 'CRITIQUE' : k.status === 'orange' ? 'ATTENTION' : 'NORMAL';
                        return [
                            k.name, 
                            comp ? comp.name : 'Général',
                            `${typeof k.value === 'number' ? k.value.toFixed(2) : k.value} ${k.unit || ''}`,
                            statusFr
                        ];
                    });

                    autoTable(doc, {
                        startY: currentY + 6,
                        head: [['Nom du KPI', 'Composant', 'Valeur Actuelle', 'Statut']],
                        body: tableData,
                        theme: 'grid',
                        headStyles: { fillColor: dxcPurple, textColor: 255, fontStyle: 'bold' },
                        styles: { font: 'helvetica', fontSize: 10 },
                        didParseCell: function(data) {
                            if (data.section === 'body' && data.column.index === 3) {
                                if (data.cell.raw === 'CRITIQUE') data.cell.styles.textColor = [239, 68, 68];
                                else if (data.cell.raw === 'ATTENTION') data.cell.styles.textColor = [245, 158, 11];
                                else data.cell.styles.textColor = [16, 217, 141];
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                    });
                }
                
                pdfBlob = doc.output('blob');
            } catch (err) {
                console.error("Failed to generate PDF:", err);
            }
        }

        // 4. Download
        const selectedCount = [exportJson, export3D, exportPdf].filter(Boolean).length;
        
        if (selectedCount === 1) {
            // Download a single file without ZIP
            if (exportJson) {
                const blob = new Blob([JSON.stringify(dataSnapshot, null, 2)], { type: "application/json" });
                saveAs(blob, jsonFilename);
            } else if (export3D && glbBuffer) {
                const blob = new Blob([glbBuffer], { type: "model/gltf-binary" });
                saveAs(blob, glbFilename);
            } else if (exportPdf && pdfBlob) {
                saveAs(pdfBlob, pdfFilename);
            }
        } else if (selectedCount > 1) {
            // Create ZIP
            const zip = new JSZip();
            if (exportJson) zip.file(jsonFilename, JSON.stringify(dataSnapshot, null, 2));
            if (export3D && glbBuffer) zip.file(glbFilename, glbBuffer);
            if (exportPdf && pdfBlob) zip.file(pdfFilename, pdfBlob);

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `${name}_export.zip`);
        }
    },

    // ─── DB-persisted twin CRUD ────────────────────────────────────────────────

    fetchTwins: async () => {
        try {
            const data = await listTwins();
            set({ twins: data });
        } catch (e) {
            console.warn('Could not fetch twins from backend:', e.message);
        }
    },

    saveTwinToDb: async () => {
        const { activeTwinId, twinName, selectedDomain, width, length, gridCols, gridRows, components, connections, kpiAssignments } = get();
        const id = activeTwinId || `twin_${Date.now()}`;
        const state = {
            id,
            name: twinName || `${DOMAINS[selectedDomain]?.label} Twin`,
            domain: selectedDomain,
            width,
            length,
            gridCols,
            gridRows,
            components,
            connections,
            kpiAssignments,
        };
        try {
            const saved = await apiSaveTwin(id, state);
            set(s => ({
                activeTwinId: id,
                twins: s.twins.some(t => t.id === id)
                    ? s.twins.map(t => t.id === id ? saved : t)
                    : [...s.twins, saved],
            }));
            return saved;
        } catch (e) {
            console.error('Failed to save twin:', e.message);
            throw e;
        }
    },

    deleteTwinFromDb: async (twinId) => {
        try {
            await apiDeleteTwin(twinId);
            set(s => ({
                twins: s.twins.filter(t => t.id !== twinId),
                activeTwinId: s.activeTwinId === twinId ? null : s.activeTwinId,
                shareLinks: s.shareLinks.filter(link => link.twin_id !== twinId),
            }));
        } catch (e) {
            console.error('Failed to delete twin:', e.message);
            throw e;
        }
    },

    renameTwinDb: async (twinId, newName) => {
        try {
            const updated = await apiRenameTwin(twinId, newName);
            set(s => ({
                twins: s.twins.map(t => t.id === twinId ? updated : t),
                twinName: s.activeTwinId === twinId ? newName : s.twinName,
            }));
            return updated;
        } catch (e) {
            console.error('Failed to rename twin:', e.message);
            throw e;
        }
    },

    loadTwinFromDb: async (twinId, targetStep = 5, preloadedState = null) => {
        try {
            const state = preloadedState || await getTwin(twinId);
            const cellSize = 2;
            set({
                activeTwinId: twinId,
                twinName: state.name,
                selectedDomain: state.domain,
                width: state.width,
                length: state.length,
                gridCols: state.gridCols,
                gridRows: state.gridRows,
                cellSize,
                components: state.components || [],
                connections: state.connections || [],
                kpis: [],
                kpiAssignments: state.kpiAssignments || [],
                kpiHistory: [],
                currentStep: targetStep,
            });
        } catch (e) {
            console.error('Failed to load twin:', e.message);
            throw e;
        }
    },

    loadDemo: () => {
        set({ selectedDomain: 'factory', twinName: 'Main Production Floor', width: 60, length: 42, gridCols: 10, gridRows: 7, currentStep: 5 });
        get().initScene();
    },

    // ─── Share Links CRUD ──────────────────────────────────────────────────────
    
    fetchShareLinks: async () => {
        try {
            const links = await listShareLinks();
            set({ shareLinks: links });
        } catch (e) {
            console.error('Failed to fetch share links:', e.message);
        }
    },
    
    createShareLink: async (data) => {
        try {
            const newLink = await createShareLink(data);
            set(s => ({ shareLinks: [...s.shareLinks, newLink] }));
            return newLink;
        } catch (e) {
            console.error('Failed to create share link:', e.message);
            throw e;
        }
    },
    
    updateShareLink: async (id, data) => {
        try {
            const updated = await updateShareLink(id, data);
            set(s => ({ shareLinks: s.shareLinks.map(l => l.id === id ? updated : l) }));
            return updated;
        } catch (e) {
            console.error('Failed to update share link:', e.message);
            throw e;
        }
    },
    
    deleteShareLink: async (id) => {
        try {
            await deleteShareLink(id);
            set(s => ({ shareLinks: s.shareLinks.filter(l => l.id !== id) }));
        } catch (e) {
            console.error('Failed to delete share link:', e.message);
            throw e;
        }
    },

    getDomains: () => DOMAINS,
}));

export default useTwinStore;
