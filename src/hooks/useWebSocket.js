import { useEffect, useRef, useState } from 'react';
import { apiClient, wsUrl } from '../api/client';
import { backoffDelay } from '../components/risk/riskUtils';

const HEARTBEAT_MS = 20000;
const STALE_MS = 60000; // server pings every 25 s; silence this long means a dead link
const UNAUTHORIZED = 4401;

/**
 * JSON WebSocket with exponential-backoff reconnect and a heartbeat (Section 11).
 * `onOpen` runs on every (re)connect - use it to replay missed data over REST.
 * Pass path=null to stay disconnected.
 *
 * @param {string|null} path API path, e.g. `/ws/alerts/NWIS-UA-017`
 * @param {{onMessage?: (msg: object) => void, onOpen?: () => void}} handlers
 * @returns {'idle'|'connecting'|'open'|'reconnecting'} connection state
 */
export function useWebSocket(path, { onMessage, onOpen } = {}) {
  const [state, setState] = useState('idle');
  const handlers = useRef({ onMessage, onOpen });
  handlers.current = { onMessage, onOpen };

  useEffect(() => {
    if (!path) {
      setState('idle');
      return undefined;
    }
    let ws = null;
    let attempt = 0;
    let closed = false;
    let retryTimer = null;
    let heartbeat = null;
    let lastMessage = Date.now();

    const schedule = () => {
      if (closed) return;
      setState('reconnecting');
      retryTimer = setTimeout(connect, backoffDelay(attempt++, { jitter: 0.3 }));
    };

    function connect() {
      if (closed) return;
      setState(attempt ? 'reconnecting' : 'connecting');
      ws = new WebSocket(wsUrl(path));
      ws.onopen = () => {
        attempt = 0;
        lastMessage = Date.now();
        setState('open');
        handlers.current.onOpen?.();
        heartbeat = setInterval(() => {
          if (Date.now() - lastMessage > STALE_MS) {
            ws.close();
            return;
          }
          if (ws.readyState === WebSocket.OPEN) ws.send('ping');
        }, HEARTBEAT_MS);
      };
      ws.onmessage = (ev) => {
        lastMessage = Date.now();
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type !== 'ping' && msg.type !== 'pong') handlers.current.onMessage?.(msg);
      };
      ws.onclose = (ev) => {
        clearInterval(heartbeat);
        if (closed) return;
        if (ev.code === UNAUTHORIZED) {
          // Expired access token: any authenticated call makes the client refresh it
          apiClient
            .get('/auth/me')
            .then(schedule)
            .catch(() => setState('idle'));
          return;
        }
        schedule();
      };
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      clearInterval(heartbeat);
      if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
    };
  }, [path]);

  return state;
}
