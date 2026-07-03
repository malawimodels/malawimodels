
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { 
  getModelProfile, 
  subscribeToOpenProjectsByCategories, 
  subscribeToProjectInvites, 
  applyToProject,
  cancelProjectApplication, 
  declineProjectInvite 
} from '../../services/supabase.service';
import { Project, ModelProfile } from '../../types';
import { MapPin, Calendar, CheckCircle, User, Briefcase, Clock, Send, X, ShieldCheck, Search, Filter } from 'lucide-react';
import { useNotification } from '../NotificationSystem';
import ConfirmationModal from '../ConfirmationModal';
import OptimizedImage from '../OptimizedImage';

const ModelOpportunitiesView: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  
  const [profile, setProfile] = useState<ModelProfile | null>(null);
  const [invites, setInvites] = useState<Project[]>([]);
  const [relevantProjects, setRelevantProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  
  // Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const [confirmModal, setConfirmModal] = useState<{ 
    isOpen: boolean; 
    title: string; 
    message: string; 
    onConfirm: () => void; 
    isDestructive?: boolean;
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    let isMounted = true;
    let unsubInvites: () => void = () => {};
    let unsubOpen: () => void = () => {};

    const init = async () => {
      if (!user) return;
      try {
        const profileData = await getModelProfile(user.uid);
        if (isMounted) {
            setProfile(profileData);
            
            // 1. Subscribe to Direct Invites
            unsubInvites = subscribeToProjectInvites(user.uid, (data) => {
                if (isMounted) setInvites(data);
            });

            // 2. Subscribe to Relevant Projects (based on categories)
            if (profileData && profileData.categories) {
                unsubOpen = subscribeToOpenProjectsByCategories(profileData.categories, (data) => {
                    if (isMounted) setRelevantProjects(data);
                    if (isMounted) setLoading(false);
                });
            } else {
                if (isMounted) setLoading(false);
            }
        }
      } catch (error) {
        console.error("Error loading opportunities", error);
        if (isMounted) setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      unsubInvites();
      unsubOpen();
    };
  }, [user]);

  const handleApply = async (projectId: string) => {
    if (!user) return;
    setApplying(projectId);
    try {
      await applyToProject(projectId, user.uid);
      addNotification('success', "Application sent successfully!");
    } catch (e: any) {
      addNotification('error', e.message || "Failed to apply.");
    } finally {
      setApplying(null);
    }
  };

  const handleCancelApplication = (projectId: string) => {
    if (!user) return;
    setConfirmModal({
        isOpen: true,
        title: "Cancel Application",
        message: "Are you sure you want to cancel your application for this project?",
        isDestructive: true,
        confirmLabel: "Yes, Cancel",
        onConfirm: async () => {
            try {
                await cancelProjectApplication(projectId, user.uid);
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                addNotification('success', "Application cancelled.");
            } catch (e) {
                addNotification('error', "Error canceling application.");
            }
        }
    });
  };

  const handleDecline = (projectId: string) => {
    if (!user) return;
    setConfirmModal({
        isOpen: true,
        title: "Decline Invitation",
        message: "Are you sure? This will remove the project from your invites.",
        isDestructive: true,
        confirmLabel: "Decline",
        onConfirm: async () => {
            try {
                await declineProjectInvite(projectId, user.uid);
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                addNotification('success', "Invitation declined.");
            } catch (e) {
                addNotification('error', "Error declining project.");
            }
        }
    });
  };

  // Combine and Filter for Display
  const filterList = (list: Project[]) => {
      return list.filter(p => {
          const matchSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
          const matchType = filterType === 'all' || p.category === filterType;
          return matchSearch && matchType;
      });
  };

  const displayInvites = filterList(invites);
  const displayRelevant = filterList(relevantProjects);

  // Helper Card Component
  const ProjectCard: React.FC<{ project: Project, isInvite?: boolean }> = ({ project, isInvite }) => {
      const isApplied = project.applicantModels.includes(user?.uid || '');
      const isApproved = project.approvedModels.includes(user?.uid || '');

      return (
        <div className={`group relative bg-brand-surface border rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
            isInvite ? 'border-brand-primary/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'border-white/10 hover:border-white/20'
        }`}>
            {isInvite && (
                <div className="absolute top-0 right-0 bg-brand-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-10 shadow-sm">
                    DIRECT INVITE
                </div>
            )}

            <div className="p-5">
                {/* Client Header */}
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/5">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 bg-black/40">
                            {project.ownerPhotoUrl ? (
                                <OptimizedImage src={project.ownerPhotoUrl} variant="avatar" alt={project.ownerName} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-6 h-6 text-brand-muted m-auto h-full flex items-center justify-center" />
                            )}
                        </div>
                        {project.ownerVerified && (
                            <div className="absolute -bottom-1 -right-1 bg-brand-bg rounded-full p-0.5" title="Verified Client">
                                <ShieldCheck className="w-4 h-4 text-blue-500 fill-current" />
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center text-white font-bold text-sm">
                            {project.ownerName}
                            {project.ownerVerified && <CheckCircle className="w-3 h-3 text-blue-500 ml-1" />}
                        </div>
                        <div className="text-[10px] text-brand-muted uppercase tracking-wider flex items-center mt-0.5">
                            Client • {project.location}
                        </div>
                    </div>
                </div>

                {/* Project Details */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/5 text-brand-muted border border-white/5">
                            {project.category}
                        </span>
                        <span className="text-xs text-brand-muted flex items-center">
                            <Clock className="w-3 h-3 mr-1" /> {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 leading-tight group-hover:text-brand-primary transition-colors">
                        {project.title}
                    </h3>
                    <p className="text-sm text-brand-muted line-clamp-2 min-h-[40px]">
                        {project.description}
                    </p>
                </div>

                {/* Meta Info */}
                <div className="grid grid-cols-2 gap-2 text-xs text-brand-muted mb-6 bg-black/20 p-3 rounded-lg">
                    <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-2 text-brand-primary" />
                        {project.dates || 'Dates TBD'}
                    </div>
                    <div className="flex items-center">
                        <MapPin className="w-3 h-3 mr-2 text-brand-primary" />
                        {project.location}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    {isApproved ? (
                        <div className="w-full py-2.5 bg-green-500/10 text-green-400 font-bold rounded-lg text-center text-sm border border-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 mr-2" /> Hired
                        </div>
                    ) : isApplied ? (
                        <div className="flex-1 flex gap-2">
                            <button 
                                className="flex-1 py-2.5 bg-blue-500/10 text-blue-400 font-bold rounded-lg text-center text-sm border border-blue-500/20 flex items-center justify-center cursor-default"
                            >
                                <CheckCircle className="w-4 h-4 mr-2" /> Requested
                            </button>
                            <button 
                                onClick={() => handleCancelApplication(project.id)}
                                className="px-3 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20"
                                title="Cancel Application"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <button 
                                onClick={() => handleApply(project.id)}
                                disabled={applying === project.id}
                                className={`flex-1 py-2.5 font-bold rounded-lg text-sm transition-all flex items-center justify-center shadow-lg ${
                                    isInvite 
                                    ? 'bg-brand-primary text-white hover:bg-brand-accent' 
                                    : 'bg-white/10 text-white hover:bg-white/20 hover:text-brand-primary'
                                }`}
                            >
                                {applying === project.id ? (
                                    <span className="animate-pulse">Applying...</span>
                                ) : (
                                    <><Send className="w-4 h-4 mr-2" /> Apply</>
                                )}
                            </button>
                            {isInvite && (
                                <button 
                                    onClick={() => handleDecline(project.id)}
                                    className="px-3 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                    title="Decline Invitation"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
      );
  };

  if (loading) return <div className="p-20 text-center text-brand-muted animate-pulse">Scanning for opportunities...</div>;

  return (
    <div className="space-y-8 animate-slide-up">
        <ConfirmationModal 
            isOpen={confirmModal.isOpen} 
            title={confirmModal.title} 
            message={confirmModal.message} 
            onConfirm={confirmModal.onConfirm} 
            onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
            isDestructive={confirmModal.isDestructive} 
            confirmLabel={confirmModal.confirmLabel}
        />

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-brand-surface p-4 rounded-xl border border-white/5">
            <h2 className="text-xl font-bold text-white flex items-center">
                <Briefcase className="w-5 h-5 mr-2 text-brand-primary" />
                Find Work
            </h2>
            <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-grow md:flex-grow-0">
                    <input 
                        type="text" 
                        placeholder="Search projects..." 
                        className="w-full md:w-64 bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-brand-primary focus:outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-brand-muted" />
                </div>
                <div className="relative">
                    <select 
                        className="bg-black/20 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:border-brand-primary focus:outline-none appearance-none cursor-pointer"
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                    >
                        <option value="all">All Types</option>
                        {profile?.categories?.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <Filter className="absolute right-3 top-2.5 w-3 h-3 text-brand-muted pointer-events-none" />
                </div>
            </div>
        </div>

        {/* Direct Invites Section */}
        {invites.length > 0 && (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center">
                        Direct Invitations 
                        <span className="ml-2 bg-brand-primary text-white text-xs px-2 py-0.5 rounded-full">{invites.length}</span>
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayInvites.map(p => <ProjectCard key={p.id} project={p} isInvite={true} />)}
                </div>
            </div>
        )}

        {/* Recommended Section */}
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Recommended for You</h3>
            {displayRelevant.length === 0 ? (
                <div className="text-center py-20 bg-brand-surface rounded-xl border border-white/5 border-dashed">
                    <Briefcase className="w-12 h-12 text-brand-muted mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-white">No matching projects found</h3>
                    <p className="text-brand-muted mt-1 max-w-md mx-auto">
                        We couldn't find any open casting calls matching your categories and location right now. Check back later!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayRelevant.map(p => <ProjectCard key={p.id} project={p} />)}
                </div>
            )}
        </div>
    </div>
  );
};

export default ModelOpportunitiesView;
