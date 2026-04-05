import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import Sidebar from '../components/Sidebar';
import Message from '../components/Message';

const SUGGESTED = [
  '¿Qué es la resiliencia para un piloto?',
  '¿Cómo aplico el framework 4-MAT en un briefing?',
  '¿Qué comportamientos observables definen a un piloto competente?',
  'Explícame el concepto de conciencia situacional',
];

export default function Chat() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Cargar lista de sesiones
  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch {
      // silencioso
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Cargar mensajes de sesión activa
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    api.getMessages(activeSessionId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [activeSessionId]);

  // Scroll al fondo al llegar mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setError('');
    setSending(true);

    // Optimistic: añadir mensaje usuario ya
    const optimistic = {
      id: Date.now(),
      rol: 'user',
      contenido: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const res = await api.chat(text, activeSessionId);
      setActiveSessionId(res.session_id);

      const aiMsg = {
        id: Date.now() + 1,
        rol: 'assistant',
        contenido: res.respuesta,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);

      // Refrescar sidebar para actualizar contadores/títulos
      fetchSessions();
    } catch (err) {
      setError(err.message);
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function startNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    textareaRef.current?.focus();
  }

  const isEmpty = messages.length === 0 && !loadingMessages;

  return (
    <div style={styles.layout}>
      <Sidebar
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={id => { setActiveSessionId(id); }}
        onNewChat={startNewChat}
        loading={loadingSessions}
      />

      <main style={styles.main}>
        {/* Header */}
        <div style={styles.topBar}>
          <div style={styles.topBarLeft}>
            <span style={styles.statusDot} />
            <span style={styles.topBarTitle}>
              {activeSessionId
                ? (sessions.find(s => s.id === activeSessionId)?.titulo || 'Conversación')
                : 'Nueva conversación'}
            </span>
          </div>
          <div style={styles.modelBadge}>claude-sonnet-4-6 · RAG</div>
        </div>

        {/* Messages area */}
        <div style={styles.messagesArea}>
          {isEmpty && (
            <div style={styles.welcome}>
              <div style={styles.welcomeIcon}>✈</div>
              <h2 style={styles.welcomeTitle}>Bienvenido al Pilot Coach</h2>
              <p style={styles.welcomeSub}>
                Haz una pregunta sobre competencias de aviación, CRM o desarrollo como piloto.
              </p>
              <div style={styles.suggestGrid}>
                {SUGGESTED.map((s, i) => (
                  <button key={i} style={styles.suggestBtn} onClick={() => setInput(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingMessages && (
            <div style={styles.loadingMsg}>Cargando mensajes…</div>
          )}

          {messages.map(m => (
            <Message key={m.id} {...m} />
          ))}

          {sending && (
            <div style={styles.typingRow}>
              <div style={styles.typingAvatar}>✈</div>
              <div style={styles.typingBubble}>
                <span style={styles.dot} />
                <span style={styles.dot} />
                <span style={styles.dot} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Error banner */}
        {error && (
          <div style={styles.errorBanner}>
            ⚠ {error}
            <button style={styles.errorClose} onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* Input area */}
        <div style={styles.inputArea}>
          <div style={styles.inputBox}>
            <textarea
              ref={textareaRef}
              style={styles.textarea}
              placeholder="Escribe tu pregunta… (Enter para enviar, Shift+Enter para nueva línea)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending}
              autoFocus
            />
            <button
              style={{ ...styles.sendBtn, opacity: (!input.trim() || sending) ? 0.4 : 1 }}
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              title="Enviar"
            >
              ➤
            </button>
          </div>
          <p style={styles.inputHint}>
            Powered by Claude Sonnet · RAG sobre libro de Jaime Ferrer Vives
          </p>
        </div>
      </main>
    </div>
  );
}

const styles = {
  layout: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'linear-gradient(180deg, #0a1628 0%, #0d1e3d 100%)',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    borderBottom: '1px solid rgba(56,189,248,0.1)',
    background: 'rgba(10,22,40,0.8)',
    backdropFilter: 'blur(8px)',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#22c55e',
    boxShadow: '0 0 6px rgba(34,197,94,0.6)',
  },
  topBarTitle: {
    fontWeight: '600',
    fontSize: '14px',
    color: '#f0f4ff',
  },
  modelBadge: {
    fontSize: '11px',
    background: 'rgba(56,189,248,0.08)',
    color: '#38bdf8',
    border: '1px solid rgba(56,189,248,0.15)',
    borderRadius: '20px',
    padding: '3px 10px',
    fontWeight: '500',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 32px',
    display: 'flex',
    flexDirection: 'column',
  },
  welcome: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '40px 20px',
    gap: '16px',
  },
  welcomeIcon: {
    fontSize: '52px',
    filter: 'drop-shadow(0 0 20px rgba(56,189,248,0.5))',
  },
  welcomeTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#f0f4ff',
    letterSpacing: '-0.5px',
  },
  welcomeSub: {
    fontSize: '14px',
    color: '#64748b',
    maxWidth: '400px',
    lineHeight: '1.6',
  },
  suggestGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginTop: '16px',
    maxWidth: '620px',
    width: '100%',
  },
  suggestBtn: {
    background: 'rgba(15,32,68,0.8)',
    border: '1px solid rgba(56,189,248,0.15)',
    borderRadius: '10px',
    color: '#94a3b8',
    padding: '12px 14px',
    fontSize: '13px',
    textAlign: 'left',
    cursor: 'pointer',
    lineHeight: '1.4',
    transition: 'all 0.2s',
  },
  loadingMsg: {
    color: '#475569',
    textAlign: 'center',
    padding: '20px',
    fontSize: '14px',
  },
  typingRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '18px',
    padding: '0 4px',
  },
  typingAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #0f2044, #1d4ed8)',
    border: '1px solid rgba(56,189,248,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    flexShrink: 0,
  },
  typingBubble: {
    background: '#0f2044',
    border: '1px solid rgba(56,189,248,0.12)',
    borderRadius: '14px',
    borderBottomLeftRadius: '4px',
    padding: '14px 18px',
    display: 'flex',
    gap: '5px',
    alignItems: 'center',
  },
  dot: {
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#38bdf8',
    animation: 'pulse 1.2s infinite',
    opacity: 0.7,
  },
  errorBanner: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.25)',
    color: '#fca5a5',
    fontSize: '13px',
    padding: '10px 16px 10px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '0 24px 8px',
    borderRadius: '8px',
  },
  errorClose: {
    background: 'transparent',
    border: 'none',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0 4px',
  },
  inputArea: {
    padding: '12px 24px 16px',
    borderTop: '1px solid rgba(56,189,248,0.08)',
    background: 'rgba(10,22,40,0.6)',
  },
  inputBox: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
    background: '#0f2044',
    border: '1px solid rgba(56,189,248,0.2)',
    borderRadius: '12px',
    padding: '8px 8px 8px 16px',
  },
  textarea: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#f0f4ff',
    fontSize: '14.5px',
    resize: 'none',
    lineHeight: '1.5',
    maxHeight: '160px',
    overflowY: 'auto',
    padding: '4px 0',
  },
  sendBtn: {
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    width: '38px',
    height: '38px',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.2s',
    boxShadow: '0 2px 8px rgba(29,78,216,0.4)',
  },
  inputHint: {
    fontSize: '11px',
    color: '#334155',
    textAlign: 'center',
    marginTop: '8px',
  },
};
