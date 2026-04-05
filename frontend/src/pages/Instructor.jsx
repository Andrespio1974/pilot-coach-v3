import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Message from '../components/Message';

export default function Instructor() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingS, setLoadingS] = useState(true);
  const [loadingM, setLoadingM] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getInstructorSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoadingS(false));
  }, []);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    setLoadingM(true);
    api.getInstructorMessages(activeId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingM(false));
  }, [activeId]);

  function formatDate(d) {
    return new Date(d).toLocaleString('es', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  const filtered = sessions.filter(s =>
    !search || (s.titulo || '').toLowerCase().includes(search.toLowerCase())
  );

  // Agrupar por piloto (user_id)
  const byPilot = filtered.reduce((acc, s) => {
    const k = s.user_id;
    if (!acc[k]) acc[k] = [];
    acc[k].push(s);
    return acc;
  }, {});

  const activeSession = sessions.find(s => s.id === activeId);

  return (
    <div style={styles.layout}>
      {/* Panel izquierdo */}
      <aside style={styles.aside}>
        <div style={styles.asideHeader}>
          <div style={styles.logoRow}>
            <span style={styles.logoMark}>✈</span>
            <div>
              <div style={styles.logoText}>Pilot Coach</div>
              <div style={styles.instructorBadge}>Instructor</div>
            </div>
          </div>
          <div style={styles.userChip}>
            <span style={styles.userInitial}>{user?.nombre?.[0]}</span>
            <span style={styles.userName}>{user?.nombre}</span>
            <button style={styles.logoutBtn} onClick={logout} title="Salir">✕</button>
          </div>
        </div>

        <div style={styles.searchBox}>
          <input
            style={styles.searchInput}
            placeholder="Buscar conversaciones…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={styles.statsRow}>
          <div style={styles.stat}>
            <span style={styles.statNum}>{sessions.length}</span>
            <span style={styles.statLabel}>sesiones</span>
          </div>
          <div style={styles.statDiv} />
          <div style={styles.stat}>
            <span style={styles.statNum}>{Object.keys(byPilot).length}</span>
            <span style={styles.statLabel}>pilotos</span>
          </div>
          <div style={styles.statDiv} />
          <div style={styles.stat}>
            <span style={styles.statNum}>
              {sessions.reduce((a, s) => a + (s.total_mensajes || 0), 0)}
            </span>
            <span style={styles.statLabel}>mensajes</span>
          </div>
        </div>

        <div style={styles.sessionList}>
          {loadingS && <div style={styles.empty}>Cargando…</div>}
          {!loadingS && filtered.length === 0 && (
            <div style={styles.empty}>Sin sesiones</div>
          )}

          {Object.entries(byPilot).map(([userId, pilotSessions]) => (
            <div key={userId} style={styles.pilotGroup}>
              <div style={styles.pilotHeader}>
                <div style={styles.pilotAvatar}>P</div>
                <div>
                  <div style={styles.pilotName}>Piloto #{userId}</div>
                  <div style={styles.pilotCount}>{pilotSessions.length} conversaciones</div>
                </div>
              </div>

              {pilotSessions.map(s => (
                <button
                  key={s.id}
                  style={{
                    ...styles.sessionItem,
                    ...(s.id === activeId ? styles.sessionItemActive : {}),
                  }}
                  onClick={() => setActiveId(s.id)}
                >
                  <div style={styles.sessionTitle}>
                    {s.titulo || 'Sin título'}
                  </div>
                  <div style={styles.sessionMeta}>
                    <span>{formatDate(s.fecha)}</span>
                    <span style={styles.msgCount}>{s.total_mensajes} msg</span>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Panel derecho */}
      <main style={styles.main}>
        {!activeId ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📋</div>
            <h2 style={styles.emptyTitle}>Selecciona una conversación</h2>
            <p style={styles.emptyText}>
              Revisa el historial de tus pilotos para monitorizar su progreso.
            </p>
          </div>
        ) : (
          <>
            <div style={styles.topBar}>
              <div>
                <div style={styles.topBarTitle}>
                  {activeSession?.titulo || 'Conversación'}
                </div>
                <div style={styles.topBarMeta}>
                  Piloto #{activeSession?.user_id} · {activeSession?.total_mensajes} mensajes · {activeSession && formatDate(activeSession.fecha)}
                </div>
              </div>
              <div style={styles.readOnlyBadge}>Solo lectura</div>
            </div>

            <div style={styles.messagesArea}>
              {loadingM && <div style={styles.empty}>Cargando mensajes…</div>}
              {messages.map(m => (
                <Message key={m.id} {...m} />
              ))}
              {!loadingM && messages.length === 0 && (
                <div style={styles.empty}>Sin mensajes</div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  layout: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: '#0a1628',
  },
  aside: {
    width: '340px',
    minWidth: '340px',
    background: '#0a1628',
    borderRight: '1px solid rgba(56,189,248,0.1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  asideHeader: {
    padding: '18px 16px 14px',
    borderBottom: '1px solid rgba(56,189,248,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoMark: {
    fontSize: '22px',
    filter: 'drop-shadow(0 0 8px rgba(56,189,248,0.5))',
  },
  logoText: {
    fontWeight: '700',
    fontSize: '16px',
    color: '#f0f4ff',
  },
  instructorBadge: {
    fontSize: '10px',
    background: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: '4px',
    padding: '1px 6px',
    fontWeight: '600',
    display: 'inline-block',
    marginTop: '2px',
  },
  userChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(15,32,68,0.6)',
    borderRadius: '8px',
    padding: '7px 10px',
  },
  userInitial: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    flexShrink: 0,
  },
  userName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#e2e8f0',
    flex: 1,
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 4px',
  },
  searchBox: {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(56,189,248,0.08)',
  },
  searchInput: {
    width: '100%',
    background: 'rgba(15,32,68,0.7)',
    border: '1px solid rgba(56,189,248,0.15)',
    borderRadius: '7px',
    padding: '8px 12px',
    color: '#f0f4ff',
    fontSize: '13px',
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(56,189,248,0.08)',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  statNum: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#38bdf8',
  },
  statLabel: {
    fontSize: '10px',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statDiv: {
    width: '1px',
    height: '30px',
    background: 'rgba(56,189,248,0.1)',
  },
  sessionList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  },
  pilotGroup: {
    marginBottom: '16px',
  },
  pilotHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    marginBottom: '4px',
  },
  pilotAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    flexShrink: 0,
  },
  pilotName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#e2e8f0',
  },
  pilotCount: {
    fontSize: '11px',
    color: '#475569',
  },
  sessionItem: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    padding: '9px 10px 9px 14px',
    textAlign: 'left',
    cursor: 'pointer',
    marginBottom: '2px',
    transition: 'background 0.15s',
  },
  sessionItemActive: {
    background: 'rgba(29,78,216,0.2)',
  },
  sessionTitle: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '3px',
  },
  sessionMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#334155',
  },
  msgCount: {
    background: 'rgba(56,189,248,0.08)',
    color: '#38bdf8',
    padding: '1px 6px',
    borderRadius: '4px',
    fontSize: '10px',
  },
  empty: {
    color: '#334155',
    fontSize: '13px',
    padding: '16px',
    textAlign: 'center',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'linear-gradient(180deg, #0a1628 0%, #0d1e3d 100%)',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    color: '#475569',
  },
  emptyIcon: {
    fontSize: '40px',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#64748b',
  },
  emptyText: {
    fontSize: '14px',
    color: '#334155',
    maxWidth: '320px',
    textAlign: 'center',
    lineHeight: '1.6',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    borderBottom: '1px solid rgba(56,189,248,0.1)',
    background: 'rgba(10,22,40,0.8)',
  },
  topBarTitle: {
    fontWeight: '600',
    fontSize: '15px',
    color: '#f0f4ff',
  },
  topBarMeta: {
    fontSize: '12px',
    color: '#475569',
    marginTop: '3px',
  },
  readOnlyBadge: {
    fontSize: '11px',
    background: 'rgba(245,158,11,0.1)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: '20px',
    padding: '3px 10px',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 32px',
  },
};
