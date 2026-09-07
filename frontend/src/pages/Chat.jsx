import { useEffect, useState, useRef, useCallback } from 'react';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';

// Team Chat — division-scoped, live over WebSocket (§18 communication).
export default function Chat() {
  const { user } = useAuth();
  const [divisions, setDivisions] = useState([]);
  const [divisionId, setDivisionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const listRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    api.get('/divisions').then((r) => {
      setDivisions(r.data.data);
      if (r.data.data.length) setDivisionId(r.data.data[0].id);
    }).catch((e) => setError(errMessage(e)));
  }, []);

  const load = useCallback(() => {
    if (!divisionId && !user.isSuperAdmin) return;
    api.get('/chat/messages', { params: divisionId ? { divisionId } : {} })
      .then((r) => setMessages(r.data.data))
      .catch((e) => setError(errMessage(e)));
  }, [divisionId, user.isSuperAdmin]);
  useEffect(load, [load]);

  // Live connection — reconnects automatically if the socket drops
  useEffect(() => {
    const token = localStorage.getItem('poms_token');
    if (!token) return;
    let closed = false;
    let retry;
    function connect() {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/chat?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onopen = () => setLive(true);
      ws.onmessage = (ev) => {
        try {
          const { type, message } = JSON.parse(ev.data);
          if (type === 'chat') setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        } catch { /* ignore malformed frames */ }
      };
      ws.onclose = () => {
        setLive(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
    }
    connect();
    return () => { closed = true; clearTimeout(retry); wsRef.current?.close(); };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      const { data } = await api.post('/chat/messages', { divisionId: divisionId || null, body });
      setMessages((prev) => (prev.some((m) => m.id === data.data.id) ? prev : [...prev, data.data]));
    } catch (err) {
      setError(errMessage(err));
      setDraft(body);
    }
  }

  const time = (ts) => new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page">
      <h1 className="page-title">Team Chat</h1>
      <p className="page-sub">Division-scoped team communication — live, persisted and auditable (§18) {live ? '· 🟢 live' : '· 🟡 reconnecting…'}</p>
      {error && <div className="alert error">{error}</div>}

      <div className="panel chat-panel">
        <div className="row" style={{ alignItems: 'center', marginBottom: 10 }}>
          <label className="field" style={{ marginBottom: 0 }}><span className="field-label">Division context</span>
            <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
              {user.isSuperAdmin && <option value="">All divisions</option>}
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <span className="muted right">{messages.length} messages</span>
        </div>

        <div className="chat-list" ref={listRef}>
          {messages.map((m) => (
            <div key={m.id} className={`chat-msg ${m.user_name === user.fullName ? 'mine' : ''}`}>
              <div className="chat-meta">
                <strong>{m.user_name}</strong>
                <span className="muted"> · {m.role_label || 'member'} · {m.division_code || 'ALL'} · {time(m.created_at)}</span>
              </div>
              <div className="chat-body">{m.body}</div>
            </div>
          ))}
          {!messages.length && <p className="muted">No messages yet — say hello 👋</p>}
        </div>

        <form className="row chat-input" onSubmit={send}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${divisions.find((d) => d.id === divisionId)?.name || 'the team'}…`}
            maxLength={2000}
          />
          <button className="btn primary" disabled={!draft.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}
