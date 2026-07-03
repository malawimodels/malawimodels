
import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { 
  getModelProfile, updateModelProfile, 
  getUserAgencyRequest, subscribeToNotifications, 
  deleteNotification, respondToAgencyInvite, subscribeToPendingInvites,
  withdrawAgencyRequest, subscribeToAcceptedProjects, getUserData
} from '../services/supabase.service';
import { ModelProfile, Project, AgencyRequest, Notification, NotificationType, AgencyInvite, UserData, UserRole } from '../types';
import { User, CheckCircle, Bell, X, Building, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../components/ConfirmationModal';
import { useNotification } from '../components/NotificationSystem';
import ModelBookingsView from '../components/dashboard/ModelBookingsView';
import ModelOpportunitiesView from '../components/dashboard/ModelOpportunitiesView';
import ModelOverview from '../components/dashboard/ModelOverview';
import ModelProfileSettings from '../components/dashboard/ModelProfileSettings';
import OptimizedImage from '../components/OptimizedImage';

type Tab = 'overview' | 'profile' | 'opportunities' | 'bookings';

const Dashboard: React.FC = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const [profile, setProfile] = useState<ModelProfile | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  const [acceptedProjects, setAcceptedProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingAgencyInvites, setPendingAgencyInvites] = useState<AgencyInvite[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  const [existingRequest, setExistingRequest] = useState<AgencyRequest | null>(null);

  const combinedList = [
    ...notifications.map(n => ({ ...n, isInvite: false, inviteData: null })),
    ...pendingAgencyInvites.map(i => ({
        id: i.id,
        title: "Agency Invitation",
        message: `${i.agencyName} invited you to join.`,
        type: NotificationType.AGENCY_INVITE,
        isInvite: true,
        inviteData: i,
        createdAt: i.createdAt
    }))
  ].sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

  useEffect(() => {
    let isMounted = true;
    let unsubAccepted: () => void = () => {};
    let unsubNotifs: () => void = () => {};
    let unsubAgencyInvites: () => void = () => {};

    const initDashboard = async () => {
        if (!user) {
          if (isMounted) setLoading(false);
          return;
        }
        
        try {
            const data = await getModelProfile(user.uid);
            const uData = await getUserData(user.uid);
            if (isMounted) {
                setProfile(data);
                setUserData(uData);
                
                unsubAccepted = subscribeToAcceptedProjects(user.uid, (acc) => {
                    if (isMounted) setAcceptedProjects(acc);
                });

                unsubNotifs = subscribeToNotifications(user.uid, (notifs) => {
                    if (isMounted) setNotifications(notifs);
                });
                
                unsubAgencyInvites = subscribeToPendingInvites(user.uid, (invites) => {
                     if (isMounted) setPendingAgencyInvites(invites);
                });

                getUserAgencyRequest(user.uid)
                  .then(req => { if (isMounted) setExistingRequest(req); })
                  .catch(e => console.error("Error fetching agency request", e));
            }
        } catch (error) {
            console.error("Failed to load dashboard data", error);
        } finally {
            if (isMounted) setLoading(false);
        }
    };

    initDashboard();

    return () => {
        isMounted = false;
        unsubAccepted();
        unsubNotifs();
        unsubAgencyInvites();
    };
  }, [user]);

  const handleNotificationAction = async (notif: any) => {
      if (!notif.isInvite) {
        await deleteNotification(notif.id);
      }
  };

  const handleAgencyInviteResponse = (invite: AgencyInvite, accept: boolean) => {
      const action = accept ? "Accept" : "Reject";
      setConfirmModal({
        isOpen: true,
        title: `${action} Invitation`,
        message: `${action} invitation from ${invite.agencyName}?`,
        isDestructive: !accept,
        confirmLabel: action,
        onConfirm: async () => {
          try {
              await respondToAgencyInvite(invite.id, accept);
              if (accept) window.location.reload(); 
              closeConfirm();
          } catch (e) {
              addNotification('error', "Failed to process invitation.");
          }
        }
      });
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      const payload = { 
          ...profile, 
          media: { ...profile.media, images: profile.media.images },
          pricing: profile.pricing || {},
          contact: profile.contact || {}
      };

      await updateModelProfile(user.uid, payload);
      addNotification('success', "Profile updated successfully!");
    } catch (e) {
      console.error(e);
      addNotification('error', e instanceof Error ? e.message : "Error updating profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelRequest = () => {
      if (!existingRequest) return;
      setConfirmModal({
        isOpen: true,
        title: "Cancel Application",
        message: "Are you sure you want to cancel your agency application? This action cannot be undone.",
        isDestructive: true,
        confirmLabel: "Cancel Request",
        onConfirm: async () => {
            try {
                await withdrawAgencyRequest(existingRequest.id);
                setExistingRequest(null);
                closeConfirm();
            } catch (e) {
                addNotification('error', "Failed to cancel request.");
            }
        }
      });
  };

  if (loading) return <div className="text-white p-20 text-center animate-pulse">Loading Dashboard...</div>;

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

        {/* Header - Mobile Friendly Stack */}
        <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-8 border-b border-white/10 pb-6 gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-16 h-16 rounded-full border-2 border-brand-primary overflow-hidden bg-brand-surface flex-shrink-0">
                   {profile?.media?.images?.[0] ? (
                       <OptimizedImage src={profile.media.images[0]} variant="avatar" alt="Profile" className="w-full h-full object-cover" />
                   ) : (
                       <User className="w-8 h-8 text-brand-muted m-auto h-full flex items-center justify-center" />
                   )}
                </div>
                <div>
                   <h1 className="text-2xl font-bold text-white flex items-center flex-wrap">
                       {profile?.displayName || user?.displayName || 'Talent'}
                       {profile?.verified && <CheckCircle className="w-5 h-5 text-blue-500 ml-2" />}
                   </h1>
                   <div className="text-brand-muted text-sm flex items-center flex-wrap">
                       {profile?.location} • {profile?.categories?.[0] || 'Model'}
                       {profile?.agencyName && <span className="ml-2 flex items-center text-xs bg-white/5 px-2 py-0.5 rounded whitespace-nowrap"><Building className="w-3 h-3 mr-1" /> {profile.agencyName}</span>}
                   </div>
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                {/* Switch to Agency Button */}
                {role === UserRole.AGENCY && (
                    <button 
                        onClick={() => navigate('/agency-dashboard')}
                        className="px-4 py-2 bg-brand-primary/10 border border-brand-primary/50 text-brand-primary hover:bg-brand-primary hover:text-white rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap"
                    >
                        <Building className="w-4 h-4 mr-2" /> Switch to Agency
                    </button>
                )}

                <div className="relative self-end sm:self-auto">
                    <button 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative p-2 rounded-full hover:bg-white/5 text-brand-muted hover:text-white transition-colors"
                    >
                        <Bell className="w-6 h-6" />
                        {combinedList.length > 0 && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-brand-bg"></span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="fixed md:absolute md:right-0 top-20 md:top-full mt-2 w-[90%] left-[5%] md:left-auto md:w-80 bg-brand-surface border border-white/10 rounded-xl shadow-2xl z-[80] overflow-hidden animate-slide-up">
                            <div className="p-3 border-b border-white/10 font-bold text-white text-sm">Notifications</div>
                            <div className="max-h-64 overflow-y-auto">
                                {combinedList.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-brand-muted">No new notifications</div>
                                ) : (
                                    combinedList.map(item => (
                                        <div key={item.id} className="p-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="text-sm font-bold text-white">{item.title}</h4>
                                                {!item.isInvite && (
                                                    <button onClick={() => handleNotificationAction(item)} className="text-brand-muted hover:text-white"><X className="w-3 h-3" /></button>
                                                )}
                                            </div>
                                            <p className="text-xs text-brand-muted mb-2">{item.message}</p>
                                            
                                            {item.isInvite && item.inviteData && (
                                                <div className="flex gap-2 mt-2">
                                                    <button 
                                                        onClick={() => handleAgencyInviteResponse(item.inviteData!, true)}
                                                        className="flex-1 py-1.5 bg-green-500/10 text-green-400 text-xs font-bold rounded hover:bg-green-500 hover:text-white transition-colors"
                                                    >
                                                        Accept
                                                    </button>
                                                    <button 
                                                        onClick={() => handleAgencyInviteResponse(item.inviteData!, false)}
                                                        className="flex-1 py-1.5 bg-white/5 text-brand-muted text-xs font-bold rounded hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                                    >
                                                        Decline
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap justify-center bg-white/5 p-1 rounded-xl w-full sm:w-auto gap-1">
                    <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-lg text-sm font-bold flex-grow sm:flex-grow-0 transition-all ${activeTab === 'overview' ? 'bg-brand-surface shadow-md text-brand-primary' : 'text-brand-muted hover:text-white'}`}>Overview</button>
                    <button onClick={() => setActiveTab('bookings')} className={`px-4 py-2 rounded-lg text-sm font-bold flex-grow sm:flex-grow-0 transition-all ${activeTab === 'bookings' ? 'bg-brand-surface shadow-md text-brand-primary' : 'text-brand-muted hover:text-white'}`}>Bookings</button>
                    <button onClick={() => setActiveTab('opportunities')} className={`px-4 py-2 rounded-lg text-sm font-bold flex-grow sm:flex-grow-0 transition-all ${activeTab === 'opportunities' ? 'bg-brand-surface shadow-md text-brand-primary' : 'text-brand-muted hover:text-white'}`}>Opportunities</button>
                    <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-lg text-sm font-bold flex-grow sm:flex-grow-0 transition-all ${activeTab === 'profile' ? 'bg-brand-surface shadow-md text-white' : 'text-brand-muted hover:text-white'}`}>Profile</button>
                </div>
            </div>
        </div>

        {/* Tab Content - Modularized */}
        {activeTab === 'overview' && profile && (
            <ModelOverview 
                profile={profile} 
                userData={userData} 
                acceptedProjects={acceptedProjects}
                existingRequest={existingRequest}
                onCancelRequest={handleCancelRequest}
                onOpenAgencyModal={() => navigate('/agency-registration')}
            />
        )}

        {activeTab === 'profile' && profile && (
            <ModelProfileSettings 
                profile={profile} 
                setProfile={setProfile} 
                onSave={handleSaveProfile} 
                saving={saving} 
            />
        )}
        
        {activeTab === 'opportunities' && (
            <div className="animate-slide-up">
                 <ModelOpportunitiesView />
            </div>
        )}

        {activeTab === 'bookings' && (
             <div className="animate-slide-up">
                 <ModelBookingsView />
             </div>
        )}
    </div>
  );
};

export default Dashboard;
