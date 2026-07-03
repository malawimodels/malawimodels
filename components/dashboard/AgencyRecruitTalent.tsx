
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ModelProfile, AgencyInvite } from '../../types';
import { subscribeToSearchModels, inviteModelToAgency, getAgencies, subscribeToAgencyOutgoingInvites } from '../../services/supabase.service';
import { UserPlus, Search, Send, CheckCircle, XCircle } from 'lucide-react';
import OptimizedImage from '../OptimizedImage';

const AgencyRecruitTalent: React.FC = () => {
    const { user } = useAuth();
    const [allModels, setAllModels] = useState<ModelProfile[]>([]);
    const [sentInvites, setSentInvites] = useState<AgencyInvite[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [inviting, setInviting] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        // Subscribe to real-time invites sent by this agency
        const unsubInvites = subscribeToAgencyOutgoingInvites(user.uid, (invites) => {
            setSentInvites(invites);
        });

        // Fetch list of users who are agencies (owners) to filter them out
        getAgencies().then((agencies) => {
            const agencyOwnerIds = agencies.map(a => a.uid);

            const unsubRecruit = subscribeToSearchModels({
                categories: [], locations: [], minHeight: 0, maxHeight: 300, gender: null, skinTones: [], onlyAvailable: false
            }, (models) => {
                const availableForRecruitment = models.filter(m => 
                    m.uid !== user.uid && 
                    !m.agencyId && // Not signed
                    !agencyOwnerIds.includes(m.uid) // Not an agency owner
                );
                setAllModels(availableForRecruitment);
            });
            
            return unsubRecruit;
        });

        return () => { unsubInvites(); };
    }, [user]);

    const handleInvite = async (model: ModelProfile) => {
        if (!user) return;
        setInviting(model.uid);
        try {
            await inviteModelToAgency(user.uid, user.displayName || 'Agency', model.uid);
        } catch (e) {
            console.error("Failed to invite", e);
        } finally {
            setInviting(null);
        }
    };

    // Filter out models who have already been invited
    const invitedModelIds = sentInvites.map(i => i.modelUid);
    const availableRecruits = allModels.filter(m => 
        !invitedModelIds.includes(m.uid) &&
        m.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Prepare list of pending invites with model names (we might only have ID in invite, but we can match with allModels if they were loaded, 
    // or we might need to fetch their names. For simplicity, we'll try to find name in allModels or just show ID if not found immediately, 
    // but ideally AgencyInvite should store modelName too or we fetch it. 
    // Optimization: Since 'allModels' only contains un-signed models, if an invite is pending, the model is likely still un-signed and in 'allModels' list 
    // OR they accepted another agency. If they accepted another, they aren't in allModels. 
    // Let's assume for this UI we display the invite status.)

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up">
            
            {/* Recruit Section */}
            <div className="bg-brand-surface p-6 rounded-2xl border border-white/5">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-xl font-bold text-white flex items-center">
                        <UserPlus className="w-5 h-5 mr-3 text-brand-primary" />
                        Find Talent
                    </h2>
                    <div className="relative w-full md:w-64">
                        <input 
                            type="text" 
                            placeholder="Search independent models..." 
                            className="w-full bg-brand-bg border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:border-brand-primary focus:outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-brand-muted" />
                    </div>
                </div>
                
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {availableRecruits.length === 0 ? (
                        <div className="text-center py-8 text-brand-muted text-sm border border-white/5 border-dashed rounded-xl">
                            No independent talent found matching your search.
                        </div>
                    ) : (
                        availableRecruits.map(model => (
                            <div key={model.uid} className="bg-white/5 p-4 rounded-xl flex items-center justify-between border border-transparent hover:border-brand-primary/20 transition-all">
                                <div className="flex items-center gap-4">
                                    <OptimizedImage src={model.media.images[0] || 'https://via.placeholder.com/150'} variant="avatar" className="w-10 h-10 rounded-lg object-cover" alt={model.displayName} />
                                    <div>
                                        <h4 className="text-white font-bold text-sm">{model.displayName}</h4>
                                        <p className="text-[10px] text-brand-muted">{model.location}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleInvite(model)}
                                    disabled={inviting === model.uid}
                                    className="px-4 py-2 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center"
                                >
                                    {inviting === model.uid ? 'Sending...' : <><Send className="w-3 h-3 mr-1" /> Invite</>}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Invited Section */}
            <div className="bg-brand-surface p-6 rounded-2xl border border-white/5">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                    <Send className="w-5 h-5 mr-3 text-brand-muted" />
                    Outgoing Invitations
                </h2>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {sentInvites.length === 0 ? (
                        <div className="text-center py-8 text-brand-muted text-sm border border-white/5 border-dashed rounded-xl">
                            You haven't sent any invitations yet.
                        </div>
                    ) : (
                        sentInvites.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(invite => (
                            <div key={invite.id} className="bg-black/20 p-4 rounded-xl flex items-center justify-between border border-white/5">
                                <div>
                                    <div className="text-white font-bold text-sm">Model ID: {invite.modelUid.substring(0, 8)}...</div>
                                    <div className="text-[10px] text-brand-muted mt-1">Sent: {new Date(invite.createdAt).toLocaleDateString()}</div>
                                </div>
                                <div>
                                    {invite.status === 'pending' && (
                                        <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-full text-xs font-bold border border-yellow-500/20">Pending</span>
                                    )}
                                    {invite.status === 'accepted' && (
                                        <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-bold border border-green-500/20 flex items-center">
                                            <CheckCircle className="w-3 h-3 mr-1" /> Accepted
                                        </span>
                                    )}
                                    {invite.status === 'rejected' && (
                                        <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-xs font-bold border border-red-500/20 flex items-center">
                                            <XCircle className="w-3 h-3 mr-1" /> Declined
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default AgencyRecruitTalent;
