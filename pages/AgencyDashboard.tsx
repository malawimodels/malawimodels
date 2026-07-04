
import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Building, User, UserPlus, Inbox, Users } from 'lucide-react';
import AgencyOverview from '../components/dashboard/AgencyOverview';
import AgencyProfileSettings from '../components/dashboard/AgencyProfileSettings';
import AgencyRecruitTalent from '../components/dashboard/AgencyRecruitTalent';
import AgencyApplications from '../components/dashboard/AgencyApplications';
import AgencyModelManagement from '../components/dashboard/AgencyModelManagement';
import MessagingCenter from '../components/dashboard/MessagingCenter';
import { subscribeToUser, updateUserData } from '../services/supabase.service';
import { UserData, UserRole } from '../types';
import { useNotification } from '../components/NotificationSystem';

const AgencyDashboard: React.FC = () => {
    const { user, role } = useAuth();
    const navigate = useNavigate();
    const { addNotification } = useNotification();
    const [userData, setUserData] = useState<UserData | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'recruit' | 'applications' | 'roster' | 'profile' | 'messages'>('overview');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user || role !== 'agency') {
            navigate('/');
            return;
        }

        const unsubUser = subscribeToUser(user.uid, (data) => {
            setUserData(data);
            setLoading(false);
        });

        return () => unsubUser();
    }, [user, role, navigate]);

    const handleProfileUpdate = async () => {
        if (!user || !userData) return;
        setSaving(true);
        try {
            await updateUserData(user.uid, userData);
            addNotification('success', "Agency profile updated successfully!");
        } catch (e) {
            console.error(e);
            addNotification('error', e instanceof Error ? e.message : "Failed to update profile.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-white p-20 text-center animate-pulse">Loading Agency Dashboard...</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-brand-text">
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 border-b border-white/10 pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center">
                        <Building className="w-8 h-8 mr-3 text-brand-primary" />
                        Agency Dashboard
                    </h1>
                    <p className="text-brand-muted mt-1">Manage your talent roster and profile.</p>
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-xs font-bold transition-all whitespace-nowrap mb-2 md:mb-0"
                    >
                        <User className="w-4 h-4 mr-2" /> Model View
                    </button>

                    <div className="dashboard-tab-list">
                        <button onClick={() => setActiveTab('overview')} className={`dashboard-tab ${activeTab === 'overview' ? 'dashboard-tab--active' : 'dashboard-tab--idle'}`}>Overview</button>
                        <button onClick={() => setActiveTab('recruit')} className={`dashboard-tab ${activeTab === 'recruit' ? 'dashboard-tab--active' : 'dashboard-tab--idle'}`}><UserPlus className="md:hidden" /> Recruit</button>
                        <button onClick={() => setActiveTab('applications')} className={`dashboard-tab ${activeTab === 'applications' ? 'dashboard-tab--active' : 'dashboard-tab--idle'}`}><Inbox className="md:hidden" /> Inbox</button>
                        <button onClick={() => setActiveTab('roster')} className={`dashboard-tab ${activeTab === 'roster' ? 'dashboard-tab--active' : 'dashboard-tab--idle'}`}><Users className="md:hidden" /> Roster</button>
                        <button onClick={() => setActiveTab('messages')} className={`dashboard-tab ${activeTab === 'messages' ? 'dashboard-tab--active' : 'dashboard-tab--idle'}`}>Messages</button>
                        <button onClick={() => setActiveTab('profile')} className={`dashboard-tab ${activeTab === 'profile' ? 'dashboard-tab--active dashboard-tab--active-neutral' : 'dashboard-tab--idle'}`}>Profile</button>
                    </div>
                </div>
            </div>

            {activeTab === 'overview' && <AgencyOverview />}
            {activeTab === 'recruit' && <AgencyRecruitTalent />}
            {activeTab === 'applications' && <AgencyApplications />}
            {activeTab === 'roster' && <AgencyModelManagement />}
            {activeTab === 'messages' && user && <MessagingCenter currentUserId={user.uid} currentRole={UserRole.AGENCY} />}

            {activeTab === 'profile' && userData && (
                <AgencyProfileSettings 
                    userData={userData} 
                    setUserData={setUserData} 
                    onSave={handleProfileUpdate} 
                    saving={saving} 
                />
            )}
        </div>
    );
};

export default AgencyDashboard;
