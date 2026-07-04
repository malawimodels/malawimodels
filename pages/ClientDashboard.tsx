
import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { UserData } from '../types';
import { subscribeToUser, updateUserData } from '../services/supabase.service';
import { Briefcase } from 'lucide-react';
import { useNotification } from '../components/NotificationSystem';
import ConfirmationModal from '../components/ConfirmationModal';
import ClientBookingsView from '../components/dashboard/ClientBookingsView';
import ClientProjectsView from '../components/dashboard/ClientProjectsView';
import ClientOverview from '../components/dashboard/ClientOverview';
import ClientProfileSettings from '../components/dashboard/ClientProfileSettings';
import ReviewHistoryView from '../components/dashboard/ReviewHistoryView';
import OptimizedImage from '../components/OptimizedImage';

const ClientDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'profile' | 'bookings' | 'reviews'>('projects');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    let isMounted = true;
    let unsubUser: () => void = () => {};

    if (user) {
        setLoading(true);
        unsubUser = subscribeToUser(user.uid, (data) => {
            if (isMounted) setUserData(data);
            if (isMounted) setLoading(false);
        });
    }

    return () => {
        isMounted = false;
        unsubUser();
    };
  }, [user]);

  const handleProfileUpdate = async () => {
      if (!user || !userData) return;
      setSaving(true);
      try {
          await updateUserData(user.uid, userData);
          addNotification('success', "Profile updated successfully!");
      } catch (e) {
          console.error(e);
          addNotification('error', e instanceof Error ? e.message : "Failed to update profile.");
      } finally {
          setSaving(false);
      }
  };

  if (loading) return <div className="text-white p-20 text-center animate-pulse">Loading Client Dashboard...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-brand-text">
       <ConfirmationModal 
         isOpen={confirmModal.isOpen}
         title={confirmModal.title}
         message={confirmModal.message}
         onConfirm={confirmModal.onConfirm}
         onCancel={closeConfirm}
         isDestructive={confirmModal.isDestructive}
         confirmLabel={confirmModal.confirmLabel}
       />

       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-10 border-b border-white/10 pb-6 gap-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="w-16 h-16 rounded-full border-2 border-brand-primary overflow-hidden bg-brand-surface flex items-center justify-center flex-shrink-0">
                {userData?.photoUrl ? <OptimizedImage src={userData.photoUrl} variant="avatar" className="w-full h-full object-cover" alt={userData.displayName || 'Client'} /> : <Briefcase className="w-8 h-8 text-brand-muted" />}
             </div>
             <div>
                <h1 className="text-2xl font-bold text-white">Client Portal</h1>
                <p className="text-brand-muted text-sm">{userData?.displayName || 'Client Account'}</p>
             </div>
          </div>
          
          <div className="flex flex-wrap justify-center items-center bg-white/5 p-1 rounded-xl w-full md:w-auto gap-1">
             <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-lg text-sm font-bold flex-grow md:flex-grow-0 transition-all ${activeTab === 'overview' ? 'bg-brand-surface shadow-md text-brand-primary' : 'text-brand-muted hover:text-white'}`}>Overview</button>
             <button onClick={() => setActiveTab('projects')} className={`px-4 py-2 rounded-lg text-sm font-bold flex-grow md:flex-grow-0 transition-all ${activeTab === 'projects' ? 'bg-brand-surface shadow-md text-brand-primary' : 'text-brand-muted hover:text-white'}`}>Projects</button>
             <button onClick={() => setActiveTab('bookings')} className={`px-4 py-2 rounded-lg text-sm font-bold flex-grow md:flex-grow-0 transition-all ${activeTab === 'bookings' ? 'bg-brand-surface shadow-md text-brand-primary' : 'text-brand-muted hover:text-white'}`}>Bookings</button>
             <button onClick={() => setActiveTab('reviews')} className={`px-4 py-2 rounded-lg text-sm font-bold flex-grow md:flex-grow-0 transition-all ${activeTab === 'reviews' ? 'bg-brand-surface shadow-md text-brand-primary' : 'text-brand-muted hover:text-white'}`}>Reviews</button>
             <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-lg text-sm font-bold flex-grow md:flex-grow-0 transition-all ${activeTab === 'profile' ? 'bg-brand-surface shadow-md text-white' : 'text-brand-muted hover:text-white'}`}>Settings</button>
          </div>
       </div>

       {activeTab === 'overview' && (
           <ClientOverview />
       )}

       {activeTab === 'projects' && (
           <ClientProjectsView />
       )}

       {activeTab === 'bookings' && (
           <ClientBookingsView />
       )}

       {activeTab === 'reviews' && user && (
           <ReviewHistoryView
               mode="authored"
               userId={user.uid}
               title="Reviews You Left"
               emptyText="You have not reviewed any completed bookings yet."
           />
       )}

       {activeTab === 'profile' && userData && (
           <ClientProfileSettings 
               userData={userData} 
               setUserData={setUserData} 
               onSave={handleProfileUpdate} 
               saving={saving} 
           />
       )}
    </div>
  );
};

export default ClientDashboard;
