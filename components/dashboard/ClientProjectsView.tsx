
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { subscribeToClientProjects, updateProject, updateProjectStatus, deleteProject, approveModelApplication, getModelProfile } from '../../services/supabase.service';
import { Project, ProjectStatus, Category, District, ModelProfile } from '../../types';
import { Plus, Search, Filter, Briefcase, Calendar, MapPin, Edit2, Trash2, X, Check, Eye, Users, CheckCircle, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import { useNotification } from '../NotificationSystem';
import OptimizedImage from '../OptimizedImage';
import { AVATAR_PLACEHOLDER_IMAGE } from '../../utils/placeholders';

// Robust Applicant Row Component
const ApplicantRow: React.FC<{ 
    modelId: string, 
    projectId: string, 
    onApprove: (id: string, price: number) => Promise<void>,
    onReject: (id: string) => Promise<void>
}> = ({ modelId, projectId, onApprove, onReject }) => {
    const [model, setModel] = useState<ModelProfile | null>(null);
    const [price, setPrice] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        getModelProfile(modelId).then(data => {
            if (isMounted) setModel(data);
        });
        return () => { isMounted = false; };
    }, [modelId]);

    const handleApprove = async () => {
        setLoading(true);
        // Default to 0 if empty
        const offerAmount = price ? parseInt(price) : 0; 
        await onApprove(modelId, offerAmount);
        setLoading(false);
    };

    const handleReject = async () => {
        setLoading(true);
        await onReject(modelId);
        setLoading(false);
    };

    if (!model) return <div className="h-16 animate-pulse bg-white/5 rounded-xl my-2"></div>;

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors gap-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-brand-surface border border-white/10 flex-shrink-0">
                    <OptimizedImage src={model.media?.images?.[0] || AVATAR_PLACEHOLDER_IMAGE} variant="avatar" className="w-full h-full object-cover" alt={model.displayName} />
                </div>
                <div>
                    <div 
                        className="font-bold text-white text-sm hover:text-brand-primary cursor-pointer transition-colors" 
                        onClick={() => window.open(`#/profile/${model.uid}`, '_blank')}
                        title="View Profile"
                    >
                        {model.displayName}
                    </div>
                    <div className="text-xs text-brand-muted">{model.height}cm • {model.location}</div>
                </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative group flex-grow sm:flex-grow-0">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-brand-primary">
                        <DollarSign className="w-3.5 h-3.5" />
                    </div>
                    <input 
                        type="number" 
                        placeholder="Offer Amount" 
                        className="w-full sm:w-36 pl-9 pr-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:border-brand-primary focus:outline-none transition-colors"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        disabled={loading}
                    />
                </div>
                
                <button 
                    onClick={handleApprove}
                    disabled={loading}
                    className="p-2.5 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    title="Approve & Send Offer"
                >
                    {loading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                
                <button 
                    onClick={handleReject}
                    disabled={loading}
                    className="p-2.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    title="Reject Applicant"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const ClientProjectsView: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addNotification } = useNotification();
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [expandedProject, setExpandedProject] = useState<string | null>(null);

    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; isDestructive?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    useEffect(() => {
        if (!user) return;
        const unsub = subscribeToClientProjects(user.uid, (data) => {
            setProjects(data);
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    const filteredProjects = projects.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleReject = async (modelId: string) => {
        // Since ApplicantRow is inside map(projectId...), we need to pass a closure that knows the project ID.
        // But here we need to find which project this model belongs to in the context of the row.
        // The ApplicantRow component receives specific handlers. 
        // We will define the specific handlers inside the render loop for clarity.
    };

    // Actual handlers used in render
    const onRejectApplicant = async (projectId: string, modelId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            const newApplicants = project.applicantModels.filter(id => id !== modelId);
            await updateProject(projectId, { applicantModels: newApplicants });
            addNotification('info', "Applicant removed.");
        }
    };

    const onApproveApplicant = async (projectId: string, modelId: string, offerPrice: number) => {
        try {
            const project = projects.find(p => p.id === projectId);
            if(project) {
                await approveModelApplication(projectId, modelId, project.approvals || [], offerPrice);
                addNotification('success', "Applicant approved! Booking negotiation started.");
            }
        } catch (e) {
            console.error(e);
            addNotification('error', "Approval failed.");
        }
    };

    const handleDelete = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Delete Project",
            message: "This will permanently delete the project and all associated data.",
            isDestructive: true,
            onConfirm: async () => {
                await deleteProject(id);
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                addNotification('success', "Project deleted.");
            }
        });
    };

    const handleClose = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Close Casting",
            message: "No new applicants will be able to apply.",
            isDestructive: false,
            onConfirm: async () => {
                await updateProjectStatus(id, { status: ProjectStatus.COMPLETED });
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                addNotification('success', "Project closed.");
            }
        });
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-brand-muted">Loading projects...</div>;

    return (
        <div className="space-y-6">
            <ConfirmationModal 
                isOpen={confirmModal.isOpen} 
                title={confirmModal.title} 
                message={confirmModal.message} 
                onConfirm={confirmModal.onConfirm} 
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                isDestructive={confirmModal.isDestructive} 
            />

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-brand-surface p-4 rounded-xl border border-white/5">
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
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="OPEN">Open</option>
                            <option value="COMPLETED">Closed</option>
                        </select>
                        <Filter className="absolute right-3 top-2.5 w-3 h-3 text-brand-muted pointer-events-none" />
                    </div>
                </div>
                <button 
                    onClick={() => navigate('/casting')}
                    className="w-full md:w-auto px-4 py-2 bg-brand-primary hover:bg-brand-accent text-white font-bold rounded-lg transition-colors flex items-center justify-center shadow-lg"
                >
                    <Plus className="w-4 h-4 mr-2" /> New Project
                </button>
            </div>

            {/* Project List */}
            <div className="space-y-4 animate-slide-up">
                {filteredProjects.length === 0 ? (
                    <div className="text-center py-20 text-brand-muted border border-white/5 border-dashed rounded-xl">
                        No projects found. Create one to get started.
                    </div>
                ) : (
                    filteredProjects.map(project => (
                        <div key={project.id} className="bg-brand-surface border border-white/10 rounded-xl overflow-hidden shadow-md transition-all hover:border-brand-primary/20">
                            {/* Card Header */}
                            <div className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${project.status === 'OPEN' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                                            {project.status}
                                        </span>
                                        <span className="text-xs text-brand-muted flex items-center"><Calendar className="w-3 h-3 mr-1" /> {project.dates || 'TBD'}</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white">{project.title}</h3>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-brand-muted">
                                        <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {project.location}</span>
                                        <span className="flex items-center"><Briefcase className="w-3 h-3 mr-1" /> {project.category}</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-6">
                                    <div className="text-center px-4 border-r border-white/10">
                                        <div className="text-lg font-bold text-white">{project.applicantModels.length}</div>
                                        <div className="text-[10px] text-brand-muted uppercase">Applicants</div>
                                    </div>
                                    <div className="text-center px-4">
                                        <div className="text-lg font-bold text-green-400">{project.approvedModels.length}</div>
                                        <div className="text-[10px] text-brand-muted uppercase">Hired</div>
                                    </div>
                                    <div className="pl-4">
                                        {expandedProject === project.id ? <ChevronUp className="w-5 h-5 text-brand-muted" /> : <ChevronDown className="w-5 h-5 text-brand-muted" />}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedProject === project.id && (
                                <div className="bg-black/20 border-t border-white/10 p-5 animate-fade-in">
                                    <div className="flex justify-end gap-2 mb-4">
                                        {project.status === 'OPEN' && (
                                            <button onClick={() => handleClose(project.id)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded flex items-center">
                                                <X className="w-3 h-3 mr-1" /> Close Casting
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(project.id)} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded flex items-center">
                                            <Trash2 className="w-3 h-3 mr-1" /> Delete
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-3">Pending Applicants</h4>
                                            <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                                {project.applicantModels.length === 0 ? (
                                                    <div className="text-xs text-brand-muted italic py-4 text-center border border-white/5 rounded-lg border-dashed">No pending applications.</div>
                                                ) : (
                                                    project.applicantModels.map(uid => (
                                                        <ApplicantRow 
                                                            key={uid} 
                                                            modelId={uid} 
                                                            projectId={project.id} 
                                                            onApprove={(id, price) => onApproveApplicant(project.id, id, price)}
                                                            onReject={(id) => onRejectApplicant(project.id, id)}
                                                        />
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-3">Hired Talent</h4>
                                            <div className="space-y-2">
                                                {project.approvedModels.length === 0 ? (
                                                    <div className="text-xs text-brand-muted italic py-4 text-center border border-white/5 rounded-lg border-dashed">No talent hired yet.</div>
                                                ) : (
                                                    <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-4 text-center">
                                                        <div className="text-green-400 font-bold text-sm mb-1">
                                                            <CheckCircle className="w-5 h-5 inline mr-2" /> {project.approvedModels.length} Models Hired
                                                        </div>
                                                        <div className="text-xs text-brand-muted">
                                                            Visit the <span className="text-white font-bold cursor-pointer hover:underline" onClick={() => navigate('/client-dashboard')}>Bookings</span> tab to manage contracts and payments.
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ClientProjectsView;
