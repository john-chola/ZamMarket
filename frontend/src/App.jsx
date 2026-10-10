import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useSelector } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import store from './store';
import ProtectedRoute from './components/common/ProtectedRoute';
import { initSocket, disconnectSocket } from './utils/socket';

// Pages
import RegisterPage      from './pages/RegisterPage';
import LoginPage         from './pages/LoginPage';
import DashboardPage     from './pages/DashboardPage';
import BrowsePage        from './pages/BrowsePage';
import CreateListingPage from './pages/CreateListingPage';
import MyListingsPage    from './pages/MyListingsPage';
import ListingDetailPage from './pages/ListingDetailPage';
import TrustScorePage    from './pages/TrustScorePage';
import InboxPage         from './pages/InboxPage';
import ChatPage          from './pages/ChatPage';
import AdminPage         from './pages/AdminPage';

import './index.css';

function SocketInit() {
  const { token, isAuthenticated } = useSelector((s) => s.auth);
  useEffect(() => {
    if (isAuthenticated && token) initSocket(token);
    else disconnectSocket();
  }, [isAuthenticated, token]);
  return null;
}

function AppRoutes() {
  return (
    <>
      <SocketInit />
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <Routes>
        {/* Public */}
        <Route path="/"             element={<Navigate to="/login" replace />} />
        <Route path="/register"     element={<RegisterPage />} />
        <Route path="/login"        element={<LoginPage />} />
        <Route path="/browse"       element={<BrowsePage />} />
        <Route path="/listings/:id" element={<ListingDetailPage />} />
        <Route path="/trust/:sellerId" element={<TrustScorePage />} />

        {/* Protected — all logged-in users */}
        <Route path="/dashboard"    element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/chat"         element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
        <Route path="/chat/:id"     element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/trust"        element={<ProtectedRoute><TrustScorePage /></ProtectedRoute>} />

        {/* Seller-only */}
        <Route path="/listings/new" element={<ProtectedRoute><CreateListingPage /></ProtectedRoute>} />
        <Route path="/listings/my"  element={<ProtectedRoute><MyListingsPage /></ProtectedRoute>} />

        {/* Admin-only */}
        <Route path="/admin"        element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Provider>
  );
}