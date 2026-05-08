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
  const [activeSessionMeta, setActiveSessionMeta] = useState(null); // {mode, scenario_id}
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');

  // Estado del wizard de bienvenida (sólo cuando no hay sesión activa)
  const [pendingMode, setPendingMode] = useState(null);   // null | 'coaching' | 'scenario'
  const [pendingScenarioId, setPendingScenarioId] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);

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

  // Cargar mensajes de sesión activa y restaurar metadata (mode/scenario_id) desde la lista
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      setActiveSessionMeta(null);
      return;
    }
    setLoadingMessages(true);
    api.getMessages(activeSessionId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));

    const s = sessions.find(x => x.id === activeSessionId);
    if (s) setActiveSessionMeta({ mode: s.mode || 'coaching', scenario_id: s.scenario_id || null });
  }, [activeSessionId, sessions]);

  // Scroll al fondo al llegar mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cargar escenarios la primera vez que el usuario elige modo escenario
  async function loadScenariosIfNeeded() {
    if (scenarios.length > 0 || loadingScenarios) return;
    setLoadingScenarios(true);
    try {
      const data = await api.getScenarios();
      setScenarios(data);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los escenarios.');
    } finally {
      setLoadingScenarios(false);
    }
  }

  function chooseModeCoaching() {
    setPendingMode('coaching');
    setPendingScenarioId(null);
    textareaRef.current?.focus();
  }

  function chooseModeScenario() {
    setPendingMode('scenario');
    setPendingScenarioId(null);
    loadScenariosIfNeeded();
  }

  function chooseScenario(id) {
    setPendingScenarioId(id);
    setInput('empezamos');
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function backToModeChoice() {
    setPendingMode(null);
    setPendingScenarioId(null);
    setInput('');
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    // Si estamos arrancando una sesión nueva en modo escenario sin haber elegido escenario, bloquea.
    if (!activeSessionId && pendingMode === 'scenario' && !pendingScenarioId) {
      setError('Elige un escenario antes de enviar.');
      return;
    }

    setInput('');
    setError('');
    setSending(true);

    const optimistic = {
      id: Date.now(),
      rol: 'user',
      contenido: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    // Mode/scenario_id sólo importan al crear una sesión nueva
    const isNewSession = !activeSessionId;
    const modeForCall = isNewSession ? (pendingMode || 'coaching') : null;
    const scenarioForCall = isNewSession && modeForCall === 'scenario' ? pendingScenarioId : null;

    try {
      const res = await api.chat(text, activeSessionId, modeForCall, scenarioForCall);
      setActiveSessionId(res.session_id);
      setActiveSessionMeta({ mode: res.mode, scenario_id: res.scenario_id });

      const aiMsg = {
        id: Date.now() + 1,
        rol: 'assistant',
        contenido: res.respuesta,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);

      // Reset del wizard, ya estamos dentro de la sesión
      setPendingMode(null);
      setPendingScenarioId(null);

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
    setActiveSessionMeta(null);
    setMessages([]);
    setInput('');
    setPendingMode(null);
    setPendingScenarioId(null);
    textareaRef.current?.focus();
  }

  const isEmpty = messages.length === 0 && !loadingMessages;
  const isWelcome = isEmpty && !activeSessionId;

  // ── Header dinámico según modo ────────────────────────────────────────────
  const activeMode = activeSessionMeta?.mode || pendingMode || null;
  const activeScenario = (activeSessionMeta?.scenario_id || pendingScenarioId)
    ? scenarios.find(s => s.id === (activeSessionMeta?.scenario_id || pendingScenarioId))
    : null;

  let headerTitle = 'Nueva conversación';
  if (activeSessionId) {
    headerTitle = sessions.find(s => s.id === activeSessionId)?.titulo || 'Conversación';
  } else if (pendingMode === 'coaching') {
    headerTitle = 'Modo Coaching';
  } else if (pendingMode === 'scenario' && activeScenario) {
    headerTitle = `Escenario · ${activeScenario.title}`;
  } else if (pendingMode === 'scenario') {
    headerTitle = 'Modo Escenario · elige uno';
  }

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
            <span style={styles.topBarTitle}>{headerTitle}</span>
            {activeMode === 'scenario' && (
              <span style={styles.modeBadge}>SCENARIO</span>
            )}
          </div>
          <div style={styles.modelBadge}>claude-sonnet-4-6 · RAG</div>
        </div>

        {/* Messages area */}
        <div style={styles.messagesArea}>
          {isWelcome && (
            <Welcome
              pendingMode={pendingMode}
              pendingScenarioId={pendingScenarioId}
              scenarios={scenarios}
              loadingScenarios={loadingScenarios}
              onChooseCoaching={chooseModeCoaching}
              onChooseScenario={chooseModeScenario}
              onChooseScenarioId={chooseScenario}
              onBack={backToModeChoice}
              onSuggestion={s => setInput(s)}
            />
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

        {/* Input area — sólo visible si ya elegiste modo (o estás en una sesión existente) */}
        {(activeSessionId || pendingMode === 'coaching' || (pendingMode === 'scenario' && pendingScenarioId)) && (
          <div style={styles.inputArea}>
            <div style={styles.inputBox}>
              <textarea
                ref={textareaRef}
                style={styles.textarea}
                placeholder={
                  pendingMode === 'scenario' && pendingScenarioId
                    ? "Escribe 'empezamos' para iniciar el escenario… (Enter para enviar)"
                    : "Escribe tu pregunta… (Enter para enviar, Shift+Enter para nueva línea)"
                }
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
              {activeMode === 'scenario'
                ? 'Modo Escenario — el coach evalúa tus decisiones contra los OBs'
                : 'Powered by Claude Sonnet · RAG sobre libro de Jaime Ferrer Vives'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Pantalla de bienvenida con wizard de modo ───────────────────────────────

function Welcome({
  pendingMode,
  pendingScenarioId,
  scenarios,
  loadingScenarios,
  onChooseCoaching,
  onChooseScenario,
  onChooseScenarioId,
  onBack,
  onSuggestion,
}) {
  // Paso 1: elegir modo
  if (!pendingMode) {
    return (
      <div style={welcome.wrap}>
        <div style={welcome.icon}>✈</div>
        <h2 style={welcome.title}>Hola, ¿cómo quieres trabajar hoy?</h2>
        <p style={welcome.sub}>
          Puedes conversar con tu coach sobre cualquier tema, o revisar un escenario operacional.
        </p>
        <div style={welcome.modeGrid}>
          <button style={welcome.modeBtn} onClick={onChooseCoaching}>
            <div style={welcome.modeIcon}>💬</div>
            <div style={welcome.modeName}>Hablar con mi coach</div>
            <div style={welcome.modeDesc}>
              Conversación abierta sobre competencias, CRM o lo que tengas en mente.
            </div>
          </button>
          <button style={welcome.modeBtn} onClick={onChooseScenario}>
            <div style={welcome.modeIcon}>🎯</div>
            <div style={welcome.modeName}>Revisar un escenario</div>
            <div style={welcome.modeDesc}>
              Simulación operacional. El coach evalúa tus decisiones contra los OBs.
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Paso 2a: coaching → muestra sugerencias
  if (pendingMode === 'coaching') {
    return (
      <div style={welcome.wrap}>
        <button style={welcome.backLink} onClick={onBack}>← cambiar modo</button>
        <div style={welcome.icon}>💬</div>
        <h2 style={welcome.title}>Modo Coaching</h2>
        <p style={welcome.sub}>
          Haz una pregunta sobre competencias de aviación, CRM o desarrollo como piloto.
        </p>
        <div style={welcome.suggestGrid}>
          {SUGGESTED.map((s, i) => (
            <button key={i} style={welcome.suggestBtn} onClick={() => onSuggestion(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Paso 2b: scenario → muestra lista
  if (pendingMode === 'scenario') {
    return (
      <div style={welcome.wrap}>
        <button style={welcome.backLink} onClick={onBack}>← cambiar modo</button>
        <div style={welcome.icon}>🎯</div>
        <h2 style={welcome.title}>Elige un escenario</h2>
        <p style={welcome.sub}>
          Cada escenario sigue el estándar MASTER-AERO-DOC-V17C de Jaime Ferrer.
        </p>
        {loadingScenarios && <p style={welcome.loadingTxt}>Cargando escenarios…</p>}
        <div style={welcome.scenarioGrid}>
          {scenarios.map(s => {
            const selected = s.id === pendingScenarioId;
            return (
              <button
                key={s.id}
                style={{
                  ...welcome.scenarioCard,
                  ...(selected ? welcome.scenarioCardSelected : {}),
                }}
                onClick={() => onChooseScenarioId(s.id)}
              >
                <div style={welcome.scenarioCompetency}>
                  {s.competency_code} · {s.primary_ob_code}
                </div>
                <div style={welcome.scenarioTitle}>{s.title}</div>
                <div style={welcome.scenarioOb}>
                  Primary OB: {s.primary_ob_name}
                </div>
              </button>
            );
          })}
        </div>
        {pendingScenarioId && (
          <p style={welcome.scenarioHint}>
            Escribe <strong>«empezamos»</strong> abajo para iniciar la sesión.
          </p>
        )}
      </div>
    );
  }

  return null;
}

// ── Estilos ─────────────────────────────────────────────────────────────────

const styles = {
  layout: { display: 'flex', height: '100vh', overflow: 'hidden' },
  main: {
    flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    background: 'linear-gradient(180deg, #0a1628 0%, #0d1e3d 100%)',
  },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 24px',
    borderBottom: '1px solid rgba(56,189,248,0.1)',
    background: 'rgba(10,22,40,0.8)', backdropFilter: 'blur(8px)',
  },
  topBarLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
  statusDot: {
    width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e',
    boxShadow: '0 0 6px rgba(34,197,94,0.6)',
  },
  topBarTitle: { fontWeight: '600', fontSize: '14px', color: '#f0f4ff' },
  modeBadge: {
    fontSize: '10px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24',
    border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px',
    padding: '2px 8px', fontWeight: '700', letterSpacing: '0.5px',
  },
  modelBadge: {
    fontSize: '11px', background: 'rgba(56,189,248,0.08)', color: '#38bdf8',
    border: '1px solid rgba(56,189,248,0.15)', borderRadius: '20px',
    padding: '3px 10px', fontWeight: '500',
  },
  messagesArea: {
    flex: 1, overflowY: 'auto', padding: '24px 32px',
    display: 'flex', flexDirection: 'column',
  },
  loadingMsg: { color: '#475569', textAlign: 'center', padding: '20px', fontSize: '14px' },
  typingRow: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    marginBottom: '18px', padding: '0 4px',
  },
  typingAvatar: {
    width: '32px', height: '32px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #0f2044, #1d4ed8)',
    border: '1px solid rgba(56,189,248,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '14px', flexShrink: 0,
  },
  typingBubble: {
    background: '#0f2044', border: '1px solid rgba(56,189,248,0.12)',
    borderRadius: '14px', borderBottomLeftRadius: '4px',
    padding: '14px 18px', display: 'flex', gap: '5px', alignItems: 'center',
  },
  dot: {
    display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
    background: '#38bdf8', animation: 'pulse 1.2s infinite', opacity: 0.7,
  },
  errorBanner: {
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
    color: '#fca5a5', fontSize: '13px', padding: '10px 16px 10px 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    margin: '0 24px 8px', borderRadius: '8px',
  },
  errorClose: {
    background: 'transparent', border: 'none', color: '#fca5a5',
    cursor: 'pointer', fontSize: '14px', padding: '0 4px',
  },
  inputArea: {
    padding: '12px 24px 16px',
    borderTop: '1px solid rgba(56,189,248,0.08)',
    background: 'rgba(10,22,40,0.6)',
  },
  inputBox: {
    display: 'flex', gap: '10px', alignItems: 'flex-end',
    background: '#0f2044', border: '1px solid rgba(56,189,248,0.2)',
    borderRadius: '12px', padding: '8px 8px 8px 16px',
  },
  textarea: {
    flex: 1, background: 'transparent', border: 'none', color: '#f0f4ff',
    fontSize: '14.5px', resize: 'none', lineHeight: '1.5',
    maxHeight: '160px', overflowY: 'auto', padding: '4px 0',
  },
  sendBtn: {
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: '#fff',
    border: 'none', borderRadius: '8px', width: '38px', height: '38px',
    fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'opacity 0.2s',
    boxShadow: '0 2px 8px rgba(29,78,216,0.4)',
  },
  inputHint: {
    fontSize: '11px', color: '#334155',
    textAlign: 'center', marginTop: '8px',
  },
};

const welcome = {
  wrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '40px 20px', gap: '16px',
    position: 'relative',
  },
  backLink: {
    position: 'absolute', top: '16px', left: '16px',
    background: 'transparent', border: 'none', color: '#64748b',
    cursor: 'pointer', fontSize: '13px', padding: '6px 10px',
    borderRadius: '6px',
  },
  icon: { fontSize: '52px', filter: 'drop-shadow(0 0 20px rgba(56,189,248,0.5))' },
  title: { fontSize: '24px', fontWeight: '700', color: '#f0f4ff', letterSpacing: '-0.5px', margin: 0 },
  sub: { fontSize: '14px', color: '#64748b', maxWidth: '480px', lineHeight: '1.6', margin: 0 },
  modeGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '14px', marginTop: '16px', maxWidth: '720px', width: '100%',
  },
  modeBtn: {
    background: 'rgba(15,32,68,0.8)', border: '1px solid rgba(56,189,248,0.2)',
    borderRadius: '14px', color: '#f0f4ff', padding: '24px 20px',
    cursor: 'pointer', textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: '8px',
    transition: 'all 0.2s',
  },
  modeIcon: { fontSize: '32px' },
  modeName: { fontSize: '17px', fontWeight: '700', color: '#f0f4ff' },
  modeDesc: { fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' },
  suggestGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px', marginTop: '16px', maxWidth: '620px', width: '100%',
  },
  suggestBtn: {
    background: 'rgba(15,32,68,0.8)', border: '1px solid rgba(56,189,248,0.15)',
    borderRadius: '10px', color: '#94a3b8',
    padding: '12px 14px', fontSize: '13px',
    textAlign: 'left', cursor: 'pointer', lineHeight: '1.4',
    transition: 'all 0.2s',
  },
  scenarioGrid: {
    display: 'flex', flexDirection: 'column',
    gap: '10px', marginTop: '12px', maxWidth: '720px', width: '100%',
  },
  scenarioCard: {
    background: 'rgba(15,32,68,0.8)', border: '1px solid rgba(56,189,248,0.15)',
    borderRadius: '12px', color: '#f0f4ff',
    padding: '14px 18px', cursor: 'pointer', textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: '4px',
    transition: 'all 0.2s',
  },
  scenarioCardSelected: {
    border: '1px solid #38bdf8',
    background: 'rgba(29,78,216,0.18)',
    boxShadow: '0 0 14px rgba(56,189,248,0.3)',
  },
  scenarioCompetency: {
    fontSize: '11px', color: '#38bdf8', fontWeight: '700',
    fontFamily: 'monospace', letterSpacing: '0.5px',
  },
  scenarioTitle: { fontSize: '15px', fontWeight: '600', color: '#f0f4ff' },
  scenarioOb: { fontSize: '12px', color: '#94a3b8' },
  scenarioHint: {
    fontSize: '13px', color: '#fbbf24', marginTop: '8px',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.3)',
    padding: '8px 14px', borderRadius: '8px',
  },
  loadingTxt: { color: '#64748b', fontSize: '13px' },
};
