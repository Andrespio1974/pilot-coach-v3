import { useAuth } from '../AuthContext';

export default function Sidebar({ sessions, activeId, onSelect, onNewChat, loading }) {
  const { user, logout } = useAuth();

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  return (
    <aside style={styles.sidebar}>
      {/* Header */}
      <div style={styles.sidebarHeader}>
        <div style={styles.logoRow}>
          <span style={styles.logoMark}>✈</span>
          <span style={styles.logoText}>Pilot Coach</span>
        </div>
        <button style={styles.newBtn} onClick={onNewChat} title="Nueva sesión">
          ＋
        </button>
      </div>

      {/* User info */}
      <div style={styles.userBox}>
        <div style={styles.avatar}>{user?.nombre?.[0] ?? '?'}</div>
        <div style={styles.userInfo}>
          <span style={styles.userName}>{user?.nombre}</span>
          <span style={styles.userRole}>{user?.rol}</span>
        </div>
      </div>

      {/* Session list */}
      <div style={styles.sectionLabel}>Conversaciones</div>
      <div style={styles.sessionList}>
        {loading && (
          <div style={styles.emptyMsg}>Cargando…</div>
        )}
        {!loading && sessions.length === 0 && (
          <div style={styles.emptyMsg}>
            No hay conversaciones aún.<br />
            Haz una pregunta para empezar.
          </div>
        )}
        {sessions.map(s => (
          <button
            key={s.id}
            style={{
              ...styles.sessionItem,
              ...(s.id === activeId ? styles.sessionItemActive : {}),
            }}
            onClick={() => onSelect(s.id)}
          >
            <div style={styles.sessionTitle}>
              {s.titulo || 'Nueva conversación'}
            </div>
            <div style={styles.sessionMeta}>
              <span>{formatDate(s.fecha)}</span>
              <span>{s.total_mensajes} msg</span>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <button style={styles.logoutBtn} onClick={logout}>
          ← Salir
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: '280px',
    minWidth: '280px',
    background: '#0a1628',
    borderRight: '1px solid rgba(56,189,248,0.1)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 16px 14px',
    borderBottom: '1px solid rgba(56,189,248,0.08)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoMark: {
    fontSize: '18px',
    filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.5))',
  },
  logoText: {
    fontWeight: '700',
    fontSize: '16px',
    color: '#f0f4ff',
    letterSpacing: '-0.3px',
  },
  newBtn: {
    background: 'rgba(56,189,248,0.1)',
    color: '#38bdf8',
    border: '1px solid rgba(56,189,248,0.2)',
    borderRadius: '6px',
    width: '30px',
    height: '30px',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    lineHeight: 1,
  },
  userBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 16px',
    borderBottom: '1px solid rgba(56,189,248,0.08)',
  },
  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #1d4ed8, #38bdf8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '14px',
    flexShrink: 0,
    textTransform: 'uppercase',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  userName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f0f4ff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: '11px',
    color: '#38bdf8',
    textTransform: 'capitalize',
    marginTop: '1px',
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    padding: '14px 16px 6px',
  },
  sessionList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 8px',
  },
  emptyMsg: {
    color: '#475569',
    fontSize: '13px',
    padding: '16px 8px',
    lineHeight: '1.6',
  },
  sessionItem: {
    width: '100%',
    background: 'transparent',
    color: '#94a3b8',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 10px',
    textAlign: 'left',
    cursor: 'pointer',
    marginBottom: '2px',
    transition: 'background 0.15s, color 0.15s',
  },
  sessionItemActive: {
    background: 'rgba(29,78,216,0.25)',
    color: '#f0f4ff',
  },
  sessionTitle: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'inherit',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '3px',
  },
  sessionMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#475569',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid rgba(56,189,248,0.08)',
  },
  logoutBtn: {
    background: 'transparent',
    color: '#475569',
    border: 'none',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '4px 0',
    transition: 'color 0.2s',
  },
};
