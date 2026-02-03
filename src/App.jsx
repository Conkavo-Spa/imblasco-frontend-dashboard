import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/public/Login';
import Dashboard from './pages/private/Dashboard';
import Mails from './pages/private/Mails';
import MailThread from './pages/private/MailThread';
import Chat from './pages/private/Chat';
import ChatThread from './pages/private/ChatThread';
import FineTuning from './pages/private/FineTuning';
import Ajustes from './pages/private/Ajustes';
import PrivateRoute from './components/PrivateRoute';

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
      <NormalizeTrailingSlash>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/mails" replace />} />
          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/mails" element={<Mails />} />
            <Route path="/mails/:id" element={<MailThread />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:id" element={<ChatThread />} />
            <Route path="/fine-tuning" element={<FineTuning />} />
            <Route path="/ajustes" element={<Ajustes />} />
          </Route>
          <Route path="*" element={<Navigate to="/mails" replace />} />
        </Routes>
      </NormalizeTrailingSlash>
    </Router>
  );
}

export default App;

