import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Modal } from 'antd';
import Login from './pages/public/Login';
import Dashboard from './pages/private/Dashboard';
import Mails from './pages/private/Mails';
import MailThread from './pages/private/MailThread';
import Chat from './pages/private/Chat';
import ChatThread from './pages/private/ChatThread';
import FineTuning from './pages/private/FineTuning';
import Ajustes from './pages/private/Ajustes';
import Conciliaciones from './pages/private/conciliaciones';
import PrivateRoute from './components/PrivateRoute';

const LAST_PATH_KEY = 'app_last_private_path';

// Guarda la ruta actual (salvo login) para poder restaurar tras reload cuando el servidor devuelve /
function PersistLastPath() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname && pathname !== '/login') {
      try {
        sessionStorage.setItem(LAST_PATH_KEY, pathname);
      } catch (_) { }
    }
    // Limpia cualquier modal/máscara residual al cambiar de ruta
    try {
      Modal.destroyAll();
      document.body.classList.remove('ant-modal-open');
    } catch (_) {}
  }, [pathname]);
  return null;
}

// Si cargamos en / (p. ej. reload en Render que no conserva la ruta), restaurar última ruta privada
function RootRedirect() {
  try {
    const last = sessionStorage.getItem(LAST_PATH_KEY);
    if (last && last !== '/' && last !== '/login') {
      return <Navigate to={last} replace />;
    }
  } catch (_) { }
  return <Navigate to="/chat" replace />;
}

// Evita que /chat/ o /mails/123/ fallen en el catch-all (React Router v6 no matchea /chat con /chat/)
function NormalizeTrailingSlash({ children }) {
  const location = useLocation();
  const pathname = location.pathname;
  if (pathname !== '/' && pathname.endsWith('/')) {
    const normalized = pathname.slice(0, -1);
    return <Navigate to={normalized + (location.search || '')} replace />;
  }
  return children;
}

function App() {
  return (
    <Router>
      <>
        <PersistLastPath />
        <NormalizeTrailingSlash>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RootRedirect />} />
            <Route element={<PrivateRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/mails" element={<Mails />} />
              <Route path="/mails/:id" element={<MailThread />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/chat/:id" element={<ChatThread />} />
              <Route path="/fine-tuning" element={<FineTuning />} />
              <Route path="/ajustes" element={<Ajustes />} />
              <Route path="/conciliaciones" element={<Conciliaciones />} />
            </Route>
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </NormalizeTrailingSlash>
      </>
    </Router>
  );
}

export default App;

