
import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getAllUsers, getAllProjectsAdmin, toggleUserVerification, toggleUserStatus, deleteUserPermanently, deleteProject, subscribeToAgencyRequests, approveAgencyRequest, rejectAgencyRequest, subscribeToReports, updateReportStatus, sendAdminWarning } from '../services/supabase.service';
import { UserData, Project, UserRole, AgencyRequest, Report, ReportStatus } from '../types';
import { Search, Shield, User, Briefcase, Building, Flag, LayoutDashboard, LogOut, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../components/ConfirmationModal';
import AdminOverview from '../components/admin/AdminOverview';
import AdminUsers from '../components/admin/AdminUsers';
import AdminClients from '../components/admin/AdminClients';
import AdminProjects from '../components/admin/AdminProjects';
import AdminRequests from '../components/admin/AdminRequests';
import AdminReports from '../components/admin/AdminReports';
import AdminLeaveRequests from '../components/admin/AdminLeaveRequests';

const Admin: React.FC = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'clients' | 'projects' | 'agency_requests' | 'reports' | 'leave_requests'>('overview');
  const [users, setUsers] = useState<UserData[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [requests, setRequests] = useState<AgencyRequest[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  // Verify Admin Access - Only admin email can access
  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== UserRole.ADMIN) {
        // Unauthorized access - redirect to home
        console.warn('Unauthorized admin access attempt:', user?.email);
        navigate('/');
      } else {
        fetchData();
      }
    }
  }, [user, role, authLoading, navigate]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, projectsData] = await Promise.all([
        getAllUsers(),
        getAllProjectsAdmin()
      ]);
      setUsers(usersData);
      setProjects(projectsData);
    } catch (e: any) {
      console.error("Admin fetch error", e);
      setError("Failed to fetch data. You might not have permission or the internet connection is unstable.");
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscriptions - Only for admin
  useEffect(() => {
    if (!user || role !== UserRole.ADMIN) return;
    
    // Agency Requests
    const unsubRequests = subscribeToAgencyRequests((newRequests) => {
        setRequests(newRequests);
    });

    // Reports
    const unsubReports = subscribeToReports((newReports) => {
        setReports(newReports);
    });

    return () => {
      unsubRequests();
      unsubReports();
    };
  }, [user, role]);

  // --- Handlers ---

  const handleVerifyUser = (uid: string, currentStatus: boolean, role: UserRole) => {
    const action = currentStatus ? "remove verification from" : "verify";
    setConfirmModal({
        isOpen: true,
        title: currentStatus ? "Remove Verification" : "Verify User",
        message: `Are you sure you want to ${action} this user?`,
        confirmLabel: currentStatus ? "Remove" : "Verify",
        onConfirm: async () => {
            try {
                await toggleUserVerification(uid, !currentStatus, role);
                setUsers(prev => prev.map(u => u.uid === uid ? { ...u, verified: !currentStatus } : u));
                closeConfirm();
            } catch (e) {
                alert("Permission Denied.");
            }
        }
    });
  };

  const handleBlockUser = (uid: string, currentStatus: boolean) => {
    const action = currentStatus ? "Block" : "Unblock";
    setConfirmModal({
        isOpen: true,
        title: `${action} User`,
        message: `Are you sure you want to ${action} this user account?`,
        isDestructive: !currentStatus,
        confirmLabel: action,
        onConfirm: async () => {
            try {
                await toggleUserStatus(uid, !currentStatus);
                setUsers(prev => prev.map(u => u.uid === uid ? { ...u, isActive: !currentStatus } : u));
                closeConfirm();
            } catch (e) {
                alert("Permission Denied.");
            }
        }
    });
  };

  const handleDeleteUser = (uid: string, role: UserRole) => {
    setConfirmModal({
        isOpen: true,
        title: "Delete User",
        message: "DANGER: This will permanently delete the user and all their profile data. This action cannot be undone.",
        isDestructive: true,
        confirmLabel: "Delete Permanently",
        onConfirm: async () => {
            try {
                await deleteUserPermanently(uid, role);
                setUsers(prev => prev.filter(u => u.uid !== uid));
                closeConfirm();
            } catch (e) {
                alert("Permission Denied.");
            }
        }
    });
  };

  const handleDeleteProject = (id: string) => {
    setConfirmModal({
        isOpen: true,
        title: "Delete Project",
        message: "Are you sure you want to delete this project? This cannot be undone.",
        isDestructive: true,
        confirmLabel: "Delete",
        onConfirm: async () => {
            try {
                await deleteProject(id);
                setProjects(prev => prev.filter(p => p.id !== id));
                closeConfirm();
            } catch (e) {
                alert("Permission Denied.");
            }
        }
    });
  };

  const handleApproveAgency = (req: AgencyRequest) => {
    setConfirmModal({
        isOpen: true,
        title: "Approve Agency",
        message: `Approve "${req.agencyName}"? The user will be upgraded to an Agency Admin role.`,
        confirmLabel: "Approve",
        onConfirm: async () => {
            try {
                await approveAgencyRequest(req);
                closeConfirm();
            } catch (e) {
                alert("Failed to approve agency.");
            }
        }
    });
  };

  const handleRejectAgency = (id: string) => {
    setConfirmModal({
        isOpen: true,
        title: "Reject Request",
        message: "Are you sure you want to reject this agency application?",
        isDestructive: true,
        confirmLabel: "Reject",
        onConfirm: async () => {
            await rejectAgencyRequest(id);
            closeConfirm();
        }
    });
  };

  const handleReviewReport = async (reportId: string) => {
      await updateReportStatus(reportId, ReportStatus.REVIEWED);
  };

  const handleSendWarning = (userId: string, reportId: string) => {
      setConfirmModal({
          isOpen: true,
          title: "Send Official Warning",
          message: "This will send a formal warning notification to the user and log a strike on their account.",
          isDestructive: true,
          confirmLabel: "Send Warning",
          onConfirm: async () => {
              try {
                  await sendAdminWarning(userId, "Reported violation of terms");
                  await updateReportStatus(reportId, ReportStatus.WARNING_SENT);
                  closeConfirm();
              } catch (e) {
                  alert("Failed to send warning.");
              }
          }
      });
  };

  const handleResolveReport = async (reportId: string) => {
       await updateReportStatus(reportId, ReportStatus.RESOLVED);
  };

  if (loading) return <div className="min-h-screen bg-brand-bg flex items-center justify-center text-white">Loading Admin Panel...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-screen text-brand-text relative">
      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
        isDestructive={confirmModal.isDestructive}
        confirmLabel={confirmModal.confirmLabel}
      />

      <div className="mb-8 border-b border-white/10 pb-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-6">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold text-white flex items-center justify-center md:justify-start">
              <Shield className="w-8 h-8 mr-3 text-red-500" />
              Admin Control
            </h1>
            <p className="text-brand-muted text-sm mt-1">Authorized Access: {user?.email}</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-2 bg-white/5 p-1 rounded-xl w-full md:w-auto">
             <button 
                onClick={() => setActiveTab('overview')}
                className={`flex-grow md:flex-grow-0 px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${activeTab === 'overview' ? 'bg-brand-surface shadow-md text-white' : 'text-brand-muted hover:text-white'}`}
             >
               <LayoutDashboard className="w-4 h-4 mr-2" /> Overview
             </button>
             <button 
                onClick={() => setActiveTab('users')}
                className={`flex-grow md:flex-grow-0 px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${activeTab === 'users' ? 'bg-brand-surface shadow-md text-white' : 'text-brand-muted hover:text-white'}`}
             >
               <User className="w-4 h-4 mr-2" /> Users
             </button>
             <button
               onClick={() => setActiveTab('clients')}
               className={`flex-grow md:flex-grow-0 px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${activeTab === 'clients' ? 'bg-brand-surface shadow-md text-white' : 'text-brand-muted hover:text-white'}`}
             >
              <UserCheck className="w-4 h-4 mr-2" /> Clients
             </button>
             <button
                onClick={() => setActiveTab('projects')}
                className={`flex-grow md:flex-grow-0 px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${activeTab === 'projects' ? 'bg-brand-surface shadow-md text-white' : 'text-brand-muted hover:text-white'}`}
             >
               <Briefcase className="w-4 h-4 mr-2" /> Projects
             </button>
             <button
                onClick={() => setActiveTab('agency_requests')}
                className={`flex-grow md:flex-grow-0 px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${activeTab === 'agency_requests' ? 'bg-brand-surface shadow-md text-white' : 'text-brand-muted hover:text-white'}`}
             >
               <Building className="w-4 h-4 mr-2" /> Requests
               {requests.length > 0 && <span className="ml-2 bg-red-500 text-white px-1.5 rounded-full text-[10px]">{requests.length}</span>}
             </button>
             <button
                onClick={() => setActiveTab('reports')}
                className={`flex-grow md:flex-grow-0 px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${activeTab === 'reports' ? 'bg-brand-surface shadow-md text-white' : 'text-brand-muted hover:text-white'}`}
             >
               <Flag className="w-4 h-4 mr-2" /> Reports
               {reports.filter(r => r.status === ReportStatus.PENDING).length > 0 && <span className="ml-2 bg-red-500 text-white px-1.5 rounded-full text-[10px]">{reports.filter(r => r.status === ReportStatus.PENDING).length}</span>}
             </button>
             <button
                onClick={() => setActiveTab('leave_requests')}
                className={`flex-grow md:flex-grow-0 px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${activeTab === 'leave_requests' ? 'bg-brand-surface shadow-md text-white' : 'text-brand-muted hover:text-white'}`}
             >
               <LogOut className="w-4 h-4 mr-2" /> Leave Req.
             </button>
          </div>
        </div>

        {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                {error}
            </div>
        )}

        {/* Filter Bar (Only show for certain tabs) */}
        {['users', 'clients', 'projects'].includes(activeTab) && (
            <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
                <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                className="w-full pl-10 pr-4 py-3 bg-brand-surface border border-white/10 rounded-xl text-white focus:border-brand-primary focus:outline-none transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-3.5 text-brand-muted w-5 h-5" />
            </div>
            
            {activeTab === 'users' && (
                <select
                className="bg-brand-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                >
                <option value="all">All Roles</option>
                <option value="model">Models</option>
                <option value="client">Clients</option>
                <option value="agency">Agencies</option>
                </select>
            )}
            </div>
        )}
      </div>

      {/* --- CONTENT RENDER --- */}

      {activeTab === 'overview' && (
          <AdminOverview users={users} projects={projects} requests={requests} />
      )}

      {activeTab === 'users' && (
          <AdminUsers
            users={users}
            searchTerm={searchTerm}
            filterRole={filterRole}
            onVerify={handleVerifyUser}
            onBlock={handleBlockUser}
            onDelete={handleDeleteUser}
          />
      )}

      {activeTab === 'clients' && (
          <AdminClients
            users={users}
            projects={projects}
            searchTerm={searchTerm}
            onVerify={handleVerifyUser}
            onBlock={handleBlockUser}
            onDelete={handleDeleteUser}
          />
      )}

      {activeTab === 'projects' && (
          <AdminProjects 
            projects={projects}
            searchTerm={searchTerm}
            onDelete={handleDeleteProject}
          />
      )}

      {activeTab === 'agency_requests' && (
          <AdminRequests 
            requests={requests}
            onApprove={handleApproveAgency}
            onReject={handleRejectAgency}
          />
      )}

      {activeTab === 'reports' && (
          <AdminReports 
            reports={reports}
            onReview={handleReviewReport}
            onWarn={handleSendWarning}
            onBlock={(uid) => handleBlockUser(uid, true)}
            onResolve={handleResolveReport}
          />
      )}

      {activeTab === 'leave_requests' && (
          <AdminLeaveRequests />
      )}
    </div>
  );
};

export default Admin;
