
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ModelProfile, LeaveRequest } from '../../types';
import { subscribeToAgencyModels, removeModelFromAgency, subscribeToAgencyLeaveRequests } from '../../services/supabase.service';
import { Users, Trash2, AlertTriangle, LogOut } from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import OptimizedImage from '../OptimizedImage';
import { AVATAR_PLACEHOLDER_IMAGE } from '../../utils/placeholders';

const AgencyModelManagement: React.FC = () => {
    const { user } = useAuth();
    const [models, setModels] = useState<ModelProfile[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDestructive?: boolean;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    useEffect(() => {
        if (!user) return;
        setLoading(true);

        const unsubModels = subscribeToAgencyModels(user.uid, (data) => {
            setModels(data);
            setLoading(false);
        });

        const unsubLeaves = subscribeToAgencyLeaveRequests(user.uid, (reqs) => {
            // Filter only pending requests for visibility
            setLeaveRequests(reqs.filter(r => r.status === 'pending'));
        });

        return () => {
            unsubModels();
            unsubLeaves();
        };
    }, [user]);

    const handleRemoveModel = (modelUid: string, modelName: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Remove Model",
            message: `Are you sure you want to remove ${modelName} from your agency? They will become an independent talent.`,
            isDestructive: true,
            onConfirm: async () => {
                await removeModelFromAgency(modelUid);
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    if (loading) return <div className="text-center p-10 text-brand-muted animate-pulse">Loading roster...</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-up">
            <ConfirmationModal 
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                isDestructive={confirmModal.isDestructive}
            />

            {/* Main Roster */}
            <div className="lg:col-span-2 bg-brand-surface p-6 rounded-2xl border border-white/5">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                    <Users className="w-5 h-5 mr-3 text-brand-primary" />
                    Manage Roster ({models.length})
                </h2>

                {models.length === 0 ? (
                    <div className="text-center py-10 border border-white/5 border-dashed rounded-xl text-brand-muted">
                        No models currently signed. Go to Recruitment to find talent.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {models.map(model => (
                            <div key={model.uid} className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <OptimizedImage src={model.media.images[0] || AVATAR_PLACEHOLDER_IMAGE} variant="avatar" className="w-12 h-12 rounded-lg object-cover" alt={model.displayName} />
                                    <div>
                                        <h4 className="text-white font-bold text-sm">{model.displayName}</h4>
                                        <p className="text-[10px] text-brand-muted">{model.categories[0]}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleRemoveModel(model.uid, model.displayName)}
                                    className="p-2 bg-white/5 hover:bg-red-500/10 text-brand-muted hover:text-red-500 rounded-lg transition-colors"
                                    title="Remove from Agency"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Leave Requests (Read Only) */}
            <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 h-fit">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                    <LogOut className="w-5 h-5 mr-3 text-orange-500" />
                    Leave Requests
                </h2>
                
                {leaveRequests.length === 0 ? (
                    <div className="text-center py-8 text-brand-muted text-sm border border-white/5 border-dashed rounded-xl">
                        No pending leave requests.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {leaveRequests.map(req => (
                            <div key={req.id} className="bg-orange-500/5 border border-orange-500/10 p-4 rounded-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                                    <span className="text-sm font-bold text-orange-200">{req.modelName}</span>
                                </div>
                                <p className="text-xs text-brand-muted mb-3 italic">"{req.reason}"</p>
                                <div className="text-[10px] text-brand-muted bg-black/20 p-2 rounded text-center">
                                    Pending Admin Approval. You cannot perform actions on this request.
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgencyModelManagement;
