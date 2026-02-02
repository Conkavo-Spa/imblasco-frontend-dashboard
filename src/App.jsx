import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/public/Login';
import Dashboard from './pages/private/Dashboard';
import Mails from './pages/private/Mails';
import MailThread from './pages/private/MailThread';
import Chat from './pages/private/Chat';
import ChatThread from './pages/private/ChatThread';
import FineTuning from './pages/private/FineTuning';
import Ajustes from './pages/private/Ajustes';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
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
    </Router>
  );
}

export default App;

