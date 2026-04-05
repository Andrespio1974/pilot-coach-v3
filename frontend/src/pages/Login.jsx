import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.rol === 'instructor' ? '/instructor' : '/chat');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo / Header */}
        <div style={styles.header}>
          <div style={styles.logoIcon}>✈</div>
          <h1 style={styles.title}>Pilot Coach</h1>
          <p style={styles.subtitle}>Basado en la obra de Jaime Ferrer Vives</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="piloto@demo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />

          <label style={styles.label}>Contraseña</label>
          <input
            style={styles.input}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          {error && <p style={styles.error}>{error}</p>}

          <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'Identificando…' : 'Entrar'}
          </button>
        </form>

        <div style={styles.hints}>
          <p style={styles.hintTitle}>Usuarios de prueba</p>
          <p style={styles.hintLine}>
            <span style={styles.hintRole}>Piloto</span>
            piloto@demo.com / piloto123
          </p>
          <p style={styles.hintLine}>
            <span style={styles.hintRole}>Instructor</span>
            instructor@demo.com / instructor123
          </p>
        </div>
      </div>

      {/* Decoración background */}
      <div style={styles.bgDecor1} />
      <div style={styles.bgDecor2} />
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a1628 0%, #0f2044 60%, #0a1628 100%)',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px',
  },
  bgDecor1: {
    position: 'absolute',
    top: '-120px',
    right: '-120px',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(29,78,216,0.15) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  bgDecor2: {
    position: 'absolute',
    bottom: '-80px',
    left: '-80px',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    background: 'rgba(15,32,68,0.95)',
    border: '1px solid rgba(56,189,248,0.2)',
    borderRadius: '16px',
    padding: '48px 40px 36px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logoIcon: {
    fontSize: '40px',
    display: 'block',
    marginBottom: '12px',
    filter: 'drop-shadow(0 0 12px rgba(56,189,248,0.6))',
  },
  title: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#f0f4ff',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '6px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    marginTop: '12px',
    marginBottom: '4px',
  },
  input: {
    background: 'rgba(10,22,40,0.8)',
    border: '1px solid rgba(56,189,248,0.2)',
    borderRadius: '8px',
    padding: '12px 14px',
    color: '#f0f4ff',
    fontSize: '15px',
    transition: 'border-color 0.2s',
    width: '100%',
  },
  error: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#fca5a5',
    fontSize: '13px',
    marginTop: '8px',
  },
  btn: {
    marginTop: '24px',
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    color: '#fff',
    padding: '13px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '15px',
    letterSpacing: '0.3px',
    transition: 'opacity 0.2s, transform 0.1s',
    boxShadow: '0 4px 15px rgba(29,78,216,0.4)',
  },
  hints: {
    marginTop: '28px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(56,189,248,0.1)',
  },
  hintTitle: {
    fontSize: '11px',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    marginBottom: '8px',
  },
  hintLine: {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '4px',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  hintRole: {
    background: 'rgba(56,189,248,0.1)',
    color: '#38bdf8',
    padding: '2px 7px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  },
};
