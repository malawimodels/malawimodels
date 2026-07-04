
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ModelProfile } from '../../types';
import { subscribeToAgencyModels } from '../../services/supabase.service';
import { Users, TrendingUp, UserPlus, Info } from 'lucide-react';
import OptimizedImage from '../OptimizedImage';
import { AVATAR_PLACEHOLDER_IMAGE } from '../../utils/placeholders';

const AgencyOverview: React.FC = () => {
    const { user, role } = useAuth();
    const [agencyModels, setAgencyModels] = useState<ModelProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || role !== 'agency') return;

        setLoading(true);
        const unsubAgency = subscribeToAgencyModels(user.uid, (models) => {
            setAgencyModels(models);
            setLoading(false);
        });

        return () => { unsubAgency(); };
    }, [user, role]);

    if (loading) return <div className="text-brand-muted p-10 text-center animate-pulse">Loading agency stats...</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-up">
            {/* Quick Stats */}
            <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 flex items-center justify-between">
                        <div>
                            <p className="text-brand-muted text-sm uppercase font-bold">Total Models</p>
                            <h3 className="text-3xl font-bold text-white mt-1">{agencyModels.length}</h3>
                        </div>
                        <div className="p-4 bg-brand-primary/10 rounded-full text-brand-primary">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 flex items-center justify-between">
                        <div>
                            <p className="text-brand-muted text-sm uppercase font-bold">Total Views</p>
                            <h3 className="text-3xl font-bold text-white mt-1">{agencyModels.reduce((acc, curr) => acc + (curr.views || 0), 0)}</h3>
                        </div>
                        <div className="p-4 bg-green-500/10 rounded-full text-green-500">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                        <Users className="w-5 h-5 mr-3 text-brand-primary" />
                        Top Performing Models
                    </h2>
                    {agencyModels.length === 0 ? (
                        <div className="text-center py-10 border border-white/5 border-dashed rounded-xl">
                            <p className="text-brand-muted">You haven't signed any models yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {agencyModels.slice(0, 4).map(model => (
                                <div key={model.uid} className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-center gap-4 hover:border-brand-primary/30 transition-colors">
                                    <OptimizedImage src={model.media.images[0] || AVATAR_PLACEHOLDER_IMAGE} variant="avatar" className="w-12 h-12 rounded-lg object-cover" alt={model.displayName} />
                                    <div>
                                        <h4 className="text-white font-bold text-sm">{model.displayName}</h4>
                                        <p className="text-[10px] text-brand-muted">{model.views} Views</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-6">Availability</h3>
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                        <div>
                            <p className="text-[10px] text-brand-muted font-bold uppercase">Models Available</p>
                            <p className="text-xl font-bold text-white">{agencyModels.filter(m => m.availability).length}</p>
                        </div>
                        <UserPlus className="w-8 h-8 text-blue-500 opacity-20" />
                    </div>
                </div>

                <div className="p-6 bg-brand-primary/5 border border-brand-primary/20 rounded-2xl flex gap-3">
                    <Info className="w-5 h-5 text-brand-primary flex-shrink-0" />
                    <p className="text-xs text-brand-muted leading-relaxed">
                        Use the <strong>Recruit</strong> tab to find new talent and the <strong>Inbox</strong> to review applications. Manage your current models in the <strong>Roster</strong> tab.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AgencyOverview;
