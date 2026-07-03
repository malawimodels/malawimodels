
import React, { Suspense, lazy, useEffect, useState, createContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { UserRole } from './types';
import Layout from './components/Layout';
import { NotificationProvider } from './components/NotificationSystem';
import { ThemeProvider } from './components/ThemeContext';
import { clearSavedModels, getSavedModelIds, toggleSavedModel } from './services/supabase.service';

const Home = lazy(() => import('./pages/Home'));
const Profile = lazy(() => import('./pages/Profile'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const AgencyDashboard = lazy(() => import('./pages/AgencyDashboard'));
const Agencies = lazy(() => import('./pages/Agencies'));
const AgencyProfile = lazy(() => import('./pages/AgencyProfile'));
const AgencyRegistration = lazy(() => import('./pages/AgencyRegistration'));
const Register = lazy(() => import('./pages/Register'));
const CastingCall = lazy(() => import('./pages/CastingCall'));
const Shortlist = lazy(() => import('./pages/Shortlist'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const SafetyTrust = lazy(() => import('./pages/SafetyTrust'));
const Contact = lazy(() => import('./pages/Contact'));
const Admin = lazy(() => import('./pages/Admin'));

export const ShortlistContext = createContext<{
  shortlist: string[];
  toggleShortlist: (id: string) => void;
  clearShortlist: () => void;
}>({ shortlist: [], toggleShortlist: () => {}, clearShortlist: () => {} });

const ProtectedRoute = ({ children, allowedRoles }: { children?: React.ReactNode, allowedRoles: UserRole[] }) => {
  const { role, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen bg-brand-bg text-white flex items-center justify-center">Loading...</div>;
  }
  
  if (!allowedRoles.includes(role)) {
    // Redirect to appropriate dashboard based on user's role
    if (role === UserRole.MODEL) return <Navigate to="/dashboard" replace />;
    if (role === UserRole.AGENCY) return <Navigate to="/agency-dashboard" replace />;
    if (role === UserRole.CLIENT) return <Navigate to="/client-dashboard" replace />;
    if (role === UserRole.ADMIN) return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const PageLoader = () => (
  <div className="min-h-[50vh] bg-brand-bg text-white flex items-center justify-center">Loading...</div>
);

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

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [shortlist, setShortlist] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    const loadShortlist = async () => {
      if (!user) {
        const local = window.localStorage.getItem('malawi_models_shortlist');
        if (active) setShortlist(local ? JSON.parse(local) : []);
        return;
      }

      const saved = await getSavedModelIds(user.uid).catch(() => []);
      if (active) setShortlist(saved);
    };

    loadShortlist();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const persistGuestShortlist = (next: string[]) => {
    window.localStorage.setItem('malawi_models_shortlist', JSON.stringify(next));
  };

  const toggleShortlist = (id: string) => {
    setShortlist(prev => {
      const shouldSave = !prev.includes(id);
      const next = shouldSave ? [id, ...prev].slice(0, 100) : prev.filter(x => x !== id);

      if (user) {
        toggleSavedModel(user.uid, id, shouldSave).catch((error) => {
          console.error('Failed to update saved model:', error);
        });
      } else {
        persistGuestShortlist(next);
      }

      return next;
    });
  };

  const clearShortlist = () => {
    setShortlist([]);
    if (user) {
      clearSavedModels(user.uid).catch((error) => {
        console.error('Failed to clear saved models:', error);
      });
    } else {
      persistGuestShortlist([]);
    }
  };

  return (
    <ShortlistContext.Provider value={{ shortlist, toggleShortlist, clearShortlist }}>
      <HashRouter>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <AppRoutes />
          </Suspense>
        </Layout>
      </HashRouter>
    </ShortlistContext.Provider>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
