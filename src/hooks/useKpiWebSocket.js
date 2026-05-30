/**
 * useKpiWebSocket — connects to the backend WebSocket and feeds
 * real-time KPI readings into the Zustand store.
 *
 * Features:
 * - Auto-reconnect with exponential backoff (1s → 30s max)
 * - On connect: receives snapshot of latest KPI values immediately
 * - Handles ping/pong heartbeats
 * - Exposes connection status: connecting | live | reconnecting | offline
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import useTwinStore from '../store/useTwinStore';

const WS_URL = (twinId = 'default') => {
  // Use window.location.host so the Vite proxy forwards the WebSocket and includes the HttpOnly cookie
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/kpis?twin_id=${twinId}`;
};

const STATUS = {
  CONNECTING: 'connecting',
  LIVE: 'live',
  RECONNECTING: 'reconnecting',
  OFFLINE: 'offline',
};

export default function useKpiWebSocket(twinId = 'default') {
  const [status, setStatus] = useState(STATUS.CONNECTING);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const retryDelay = useRef(1000);
  const mounted = useRef(true);

  const connect = useCallback(() => {
    if (!mounted.current) return;

    try {
      setStatus(STATUS.CONNECTING);
      const ws = new WebSocket(WS_URL(twinId));
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mounted.current || wsRef.current !== ws) return;
        setStatus(STATUS.LIVE);
        retryDelay.current = 1000;
        console.log('[WS] Connected to KPI stream');
      };

      ws.onmessage = (event) => {
        if (!mounted.current || wsRef.current !== ws) return;
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          if (msg.type === 'snapshot') {
            msg.readings?.forEach(r => useTwinStore.getState().updateKpiFromWS?.(r));
            setLastUpdate(new Date());
            return;
          }

          if (msg.type === 'kpi') {
            useTwinStore.getState().updateKpiFromWS?.(msg);
            setLastUpdate(new Date());
            setMessageCount(c => c + 1);
          }
        } catch (e) {
          console.warn('[WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        if (!mounted.current || wsRef.current !== ws) return;
        setStatus(STATUS.RECONNECTING);
        console.log(`[WS] Disconnected — reconnecting in ${retryDelay.current}ms`);
        reconnectTimer.current = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 2, 30000);
          connect();
        }, retryDelay.current);
      };

      ws.onerror = () => {
        if (!mounted.current || wsRef.current !== ws) return;
        ws.close();
      };
    } catch (e) {
      setStatus(STATUS.OFFLINE);
    }
  }, [twinId]);

  useEffect(() => {
    mounted.current = true;
    connect();
    return () => {
      mounted.current = false;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const disconnect = () => {
    mounted.current = false;
    clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    setStatus(STATUS.OFFLINE);
  };

  return { status, lastUpdate, messageCount, disconnect, STATUS };
}
