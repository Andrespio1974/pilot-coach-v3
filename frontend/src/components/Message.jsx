import ReactMarkdown from 'react-markdown';

// Mapa completo de competencias (EASA + conceptos propios de Jaime Ferrer)
const COMPETENCIES = {
  PSD:  'Resolución de problemas y toma de decisiones',
  SAW:  'Consciencia situacional y gestión de la información',
  KNO:  'Aplicación del conocimiento',
  WLM:  'Gestión de la carga de trabajo',
  'M&I': 'Monitoreo e intervención',
  RES:  'Resiliencia',
  COM:  'Comunicación',
  LTM:  'Liderazgo y trabajo en equipo',
  PRO:  'Procedimientos y cumplimiento normativo',
  FPA:  'Gestión de trayectoria de vuelo (automatización)',
  FPM:  'Gestión de trayectoria de vuelo (control manual)',
  SSAW: 'Shared Situation Awareness · Ferrer',
  CAW:  'Conscious Awareness · Ferrer',
};

const COMPETENCY_CODES = Object.keys(COMPETENCIES);

// Palabras clave que indican cierre o conclusión de sesión
const CLOSING_KEYWORDS = [
  'compromiso', 'comprometes', 'próxima sesión', 'hasta la próxima',
  'próximo vuelo', 'nos volvamos a ver', 'insight de hoy', 'hemos trabajado',
  'te llevas de hoy', 'cerramos', 'buena sesión', 'ha sido valioso',
  'lo dejaremos aquí', 'antes de despedirnos', 'para terminar',
];

function detectClosingAndCompetencies(text) {
  const upper = text.toUpperCase();

  const isClosing = CLOSING_KEYWORDS.some(kw =>
    text.toLowerCase().includes(kw.toLowerCase())
  );

  // Busca cada código como palabra completa (no dentro de otra palabra)
  const found = COMPETENCY_CODES.filter(code => {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(upper);
  });

  return { isClosing, competencies: found };
}

function CompetencyCard({ competencies }) {
  return (
    <div style={card.wrap}>
      <div style={card.header}>
        <span style={card.icon}>🎯</span>
        <span style={card.title}>Competencias trabajadas en esta sesión</span>
      </div>
      <div style={card.chips}>
        {competencies.map(code => (
          <div key={code} style={card.chip}>
            <span style={card.code}>{code}</span>
            <span style={card.name}>{COMPETENCIES[code]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Message({ rol, contenido, timestamp }) {
  const isUser = rol === 'user';

  const { isClosing, competencies } = !isUser
    ? detectClosingAndCompetencies(contenido)
    : { isClosing: false, competencies: [] };

  const showCard = !isUser && isClosing && competencies.length > 0;

  function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{ ...styles.row, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && <div style={styles.aiAvatar}>✈</div>}

      <div style={styles.bubbleCol}>
        <div style={{ ...styles.bubble, ...(isUser ? styles.bubbleUser : styles.bubbleAi) }}>
          <div style={styles.content}>
            {isUser
              ? <p style={styles.userText}>{contenido}</p>
              : <ReactMarkdown
                  components={{
                    p:          ({ children }) => <p style={styles.aiPara}>{children}</p>,
                    strong:     ({ children }) => <strong style={styles.strong}>{children}</strong>,
                    ul:         ({ children }) => <ul style={styles.ul}>{children}</ul>,
                    ol:         ({ children }) => <ol style={styles.ol}>{children}</ol>,
                    li:         ({ children }) => <li style={styles.li}>{children}</li>,
                    h2:         ({ children }) => <h2 style={styles.h2}>{children}</h2>,
                    h3:         ({ children }) => <h3 style={styles.h3}>{children}</h3>,
                    blockquote: ({ children }) => <blockquote style={styles.blockquote}>{children}</blockquote>,
                    code: ({ inline, children }) =>
                      inline
                        ? <code style={styles.inlineCode}>{children}</code>
                        : <pre style={styles.codeBlock}><code>{children}</code></pre>,
                  }}
                >
                  {contenido}
                </ReactMarkdown>
            }
          </div>
          {timestamp && (
            <div style={{ ...styles.time, textAlign: isUser ? 'right' : 'left' }}>
              {formatTime(timestamp)}
            </div>
          )}
        </div>

        {showCard && <CompetencyCard competencies={competencies} />}
      </div>

      {isUser && <div style={styles.userAvatar}>Tú</div>}
    </div>
  );
}

// ── Estilos del mensaje ────────────────────────────────────────────────────

const styles = {
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '18px',
    padding: '0 4px',
  },
  bubbleCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: 'min(70%, 680px)',
  },
  aiAvatar: {
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
    marginTop: '2px',
    filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.3))',
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: '700',
    flexShrink: 0,
    marginTop: '2px',
    color: '#fff',
  },
  bubble: {
    borderRadius: '14px',
    padding: '12px 16px',
    lineHeight: '1.65',
  },
  bubbleUser: {
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    borderBottomRightRadius: '4px',
    boxShadow: '0 2px 10px rgba(29,78,216,0.3)',
  },
  bubbleAi: {
    background: '#0f2044',
    border: '1px solid rgba(56,189,248,0.12)',
    borderBottomLeftRadius: '4px',
  },
  content: {},
  userText: {
    color: '#e0eaff',
    fontSize: '14.5px',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  aiPara: {
    color: '#c8d8f0',
    fontSize: '14.5px',
    marginBottom: '10px',
    margin: '0 0 10px 0',
  },
  strong:     { color: '#38bdf8', fontWeight: '600' },
  h2: {
    color: '#f0f4ff',
    fontSize: '16px',
    fontWeight: '700',
    marginBottom: '8px',
    marginTop: '14px',
    paddingBottom: '6px',
    borderBottom: '1px solid rgba(56,189,248,0.2)',
  },
  h3: {
    color: '#e0eaff',
    fontSize: '14.5px',
    fontWeight: '600',
    marginBottom: '6px',
    marginTop: '12px',
  },
  ul:         { paddingLeft: '18px', margin: '6px 0' },
  ol:         { paddingLeft: '18px', margin: '6px 0' },
  li:         { color: '#c8d8f0', fontSize: '14.5px', marginBottom: '4px' },
  blockquote: {
    borderLeft: '3px solid #38bdf8',
    paddingLeft: '12px',
    margin: '10px 0',
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  inlineCode: {
    background: 'rgba(56,189,248,0.1)',
    color: '#38bdf8',
    padding: '1px 5px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '13px',
  },
  codeBlock: {
    background: 'rgba(0,0,0,0.3)',
    padding: '12px',
    borderRadius: '6px',
    overflowX: 'auto',
    fontSize: '13px',
    color: '#94a3b8',
  },
  time: {
    fontSize: '11px',
    color: 'rgba(148,163,184,0.5)',
    marginTop: '5px',
  },
};

// ── Estilos de la tarjeta de competencias ─────────────────────────────────

const card = {
  wrap: {
    background: 'rgba(10,22,40,0.7)',
    border: '1px solid rgba(56,189,248,0.2)',
    borderRadius: '10px',
    padding: '10px 14px',
    backdropFilter: 'blur(6px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  icon: {
    fontSize: '13px',
  },
  title: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#38bdf8',
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: 'rgba(29,78,216,0.15)',
    border: '1px solid rgba(29,78,216,0.3)',
    borderRadius: '6px',
    padding: '3px 8px',
  },
  code: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#38bdf8',
    fontFamily: 'monospace',
  },
  name: {
    fontSize: '11px',
    color: '#64748b',
  },
};
