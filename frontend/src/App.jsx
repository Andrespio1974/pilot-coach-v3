import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './pages/Login';
import Chat from './pages/Chat';
import Instructor from './pages/Instructor';

function RequireAuth({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (role && user.rol !== role) {
    return <Navigate to={user.rol === 'instructor' ? '/instructor' : '/chat'} replace />;
  }
  return children;
}

function RedirectIfAuth() {
  const { user } = useAuth();
  if (user) return <Navigate to={user.rol === 'instructor' ? '/instructor' : '/chat'} replace />;
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RedirectIfAuth />} />
          <Route
            path="/chat"
            element={
              <RequireAuth role="piloto">
                <Chat />
              </RequireAuth>
            }
          />
          <Route
            path="/instructor"
            element={
              <RequireAuth role="instructor">
                <Instructor />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
