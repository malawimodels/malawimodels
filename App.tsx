
import React, { useState, createContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { UserRole } from './types';
import { isAdminEmail } from './config/admin';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import ClientDashboard from './pages/ClientDashboard';
import AgencyDashboard from './pages/AgencyDashboard'; 
import Agencies from './pages/Agencies'; 
import AgencyProfile from './pages/AgencyProfile'; 
import AgencyRegistration from './pages/AgencyRegistration'; // NEW
import Register from './pages/Register';
import Layout from './components/Layout';
import CastingCall from './pages/CastingCall';
import Shortlist from './pages/Shortlist';
import HelpCenter from './pages/HelpCenter';
import SafetyTrust from './pages/SafetyTrust';
import Contact from './pages/Contact';
import Admin from './pages/Admin';
import { NotificationProvider } from './components/NotificationSystem';
import { ThemeProvider } from './components/ThemeContext';

export const ShortlistContext = createContext<{
  shortlist: string[];
  toggleShortlist: (id: string) => void;
}>({ shortlist: [], toggleShortlist: () => {} });

const ProtectedRoute = ({ children, allowedRoles }: { children?: React.ReactNode, allowedRoles: UserRole[] }) => {
  const { role, user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen bg-brand-bg text-white flex items-center justify-center">Loading...</div>;
  }
  
  // Special case: Admin access by email (even if role not yet set in DB)
  const isAdminByEmail = user && isAdminEmail(user.email);
  const hasAdminAccess = allowedRoles.includes(UserRole.ADMIN) && isAdminByEmail;
  
  if (!allowedRoles.includes(role) && !hasAdminAccess) {
    // Redirect to appropriate dashboard based on user's role
    if (role === UserRole.MODEL) return <Navigate to="/dashboard" replace />;
    if (role === UserRole.AGENCY) return <Navigate to="/agency-dashboard" replace />;
    if (role === UserRole.CLIENT) return <Navigate to="/client-dashboard" replace />;
    if (role === UserRole.ADMIN || isAdminByEmail) return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  const { role } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/profile/:id" element={<Profile />} />
      <Route path="/agencies" element={<Agencies />} /> 
      <Route path="/agency/:id" element={<AgencyProfile />} />
      <Route path="/casting" element={<CastingCall />} />
      <Route path="/shortlist" element={<Shortlist />} />
      <Route path="/help" element={<HelpCenter />} />
      <Route path="/safety" element={<SafetyTrust />} />
      <Route path="/contact" element={<Contact />} />
      
      {/* Admin Dashboard - Protected */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <Admin />
          </ProtectedRoute>
        } 
      />
      
      {/* New Route for Detailed Agency Registration */}
      <Route 
        path="/agency-registration" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.MODEL]}>
            <AgencyRegistration />
          </ProtectedRoute>
        } 
      />
      
      {/* Model Dashboard - Protected */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.MODEL]}>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/client-dashboard" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.CLIENT]}>
            <ClientDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/agency-dashboard" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.AGENCY]}>
            <AgencyDashboard />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

const App: React.FC = () => {
  const [shortlist, setShortlist] = useState<string[]>([]);
  const toggleShortlist = (id: string) => {
    setShortlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <ShortlistContext.Provider value={{ shortlist, toggleShortlist }}>
            <HashRouter>
              <Layout>
                <AppRoutes />
              </Layout>
            </HashRouter>
          </ShortlistContext.Provider>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
