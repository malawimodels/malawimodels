
import React, { useState } from 'react';
import { ModelProfile, Project, UserData, AgencyRequest } from '../../types';
import { Eye, Briefcase, Star, TrendingUp, Building, CheckCircle, Clock, LogOut } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ConfirmationModal from '../ConfirmationModal';
import { submitLeaveRequest } from '../../services/supabase.service';
import { useNotification } from '../NotificationSystem';

interface ModelOverviewProps {
    profile: ModelProfile;
    userData: UserData | null;
    acceptedProjects: Project[];
    existingRequest: AgencyRequest | null;
    onCancelRequest: () => void;
    onOpenAgencyModal: () => void;
}

const ModelOverview: React.FC<ModelOverviewProps> = ({ 
    profile, userData, acceptedProjects, existingRequest, onCancelRequest, onOpenAgencyModal 
}) => {
    const { addNotification } = useNotification();
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [leaveReason, setLeaveReason] = useState('');

    const handleLeaveRequest = async () => {
        if (!profile.agencyId) return;
        try {
            await submitLeaveRequest({
                modelUid: profile.uid,
                modelName: profile.displayName,
                agencyId: profile.agencyId,
                agencyName: profile.agencyName || 'Unknown Agency',
                reason: leaveReason
            });
            addNotification('success', "Request submitted to admin for approval.");
            setIsLeaveModalOpen(false);
        } catch (e) {
            addNotification('error', "Failed to submit request.");
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Leave Request Modal */}
            {isLeaveModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                    <div className="bg-brand-surface border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Leave Agency?</h3>
                        <p className="text-sm text-brand-muted mb-4">
                            Submitting this request will notify the platform administrators. 
                            If approved, you will be removed from <span className="text-white font-bold">{profile.agencyName}</span> and become an independent talent.
                        </p>
                        <textarea 
                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none h-32 mb-4"
                            placeholder="Reason for leaving..."
                            value={leaveReason}
                            onChange={e => setLeaveReason(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setIsLeaveModalOpen(false)} className="flex-1 py-2 bg-white/5 text-brand-muted rounded-lg font-bold">Cancel</button>
                            <button onClick={handleLeaveRequest} disabled={!leaveReason} className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold disabled:opacity-50">Submit Request</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detailed Analytics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 hover:border-brand-primary/20 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                            <Eye className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold bg-white/5 px-2 py-1 rounded text-brand-muted">All Time</span>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{profile.views}</div>
                    <div className="text-sm text-brand-muted">Profile Views</div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 hover:border-brand-primary/20 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                            <Briefcase className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold bg-white/5 px-2 py-1 rounded text-brand-muted">Current</span>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{acceptedProjects.length}</div>
                    <div className="text-sm text-brand-muted">Projects Hired</div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 hover:border-brand-primary/20 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <Star className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold bg-white/5 px-2 py-1 rounded text-brand-muted">Average</span>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">
                        {userData?.averageRating ? userData.averageRating.toFixed(1) : 'N/A'}
                    </div>
                    <div className="text-sm text-brand-muted">
                        Based on {userData?.reviewsCount || 0} Ratings
                    </div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 hover:border-brand-primary/20 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-500/10 rounded-xl text-green-400 group-hover:bg-green-500 group-hover:text-white transition-colors">
                            <Clock className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold bg-white/5 px-2 py-1 rounded text-brand-muted">Status</span>
                    </div>
                    <div className="text-xl font-bold text-white mb-1">
                        {profile.availability ? 'Available' : 'Booked'}
                    </div>
                    <div className="text-sm text-brand-muted">Current Availability</div>
                </div>
            </div>

            {/* Performance Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-brand-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-brand-muted" /> Engagement History
                    </h3>
                    <div className="h-64 w-full">
                        {profile.stats?.history && profile.stats.history.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={profile.stats.history}>
                                    <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Line type="monotone" dataKey="views" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#18181b', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-brand-muted text-sm border border-white/5 border-dashed rounded-xl">
                                Not enough data for chart history yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* Agency Status Card */}
                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 hover:border-brand-primary/20 transition-all">
                   <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                       <Building className="w-5 h-5 mr-2 text-brand-muted" /> Agency Status
                   </h3>
                   {profile.agencyId ? (
                       <div>
                           <div className="text-green-400 font-bold mb-2 flex items-center"><CheckCircle className="w-4 h-4 mr-2" /> Signed with {profile.agencyName}</div>
                           <p className="text-xs text-brand-muted mb-4">Managed by your agency. Contact them for representation details.</p>
                           <button 
                                onClick={() => setIsLeaveModalOpen(true)}
                                className="text-xs text-red-400 hover:text-red-300 underline flex items-center"
                           >
                               <LogOut className="w-3 h-3 mr-1" /> Request to Leave Agency
                           </button>
                       </div>
                   ) : existingRequest ? (
                       <div>
                           <div className={`font-bold mb-2 text-sm px-3 py-1 rounded inline-block ${
                               existingRequest.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                           }`}>
                               Application {existingRequest.status}
                           </div>
                           <p className="text-xs text-brand-muted mb-4">Your application to become an agency is under review.</p>
                           {existingRequest.status === 'pending' && (
                               <button onClick={onCancelRequest} className="text-xs text-red-400 hover:text-red-300 underline">Withdraw Application</button>
                           )}
                       </div>
                   ) : (
                       <div>
                           <p className="text-sm text-brand-muted mb-4">Are you a manager or agency owner? Register to manage talent.</p>
                           <button onClick={onOpenAgencyModal} className="w-full py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg text-sm transition-colors border border-white/10">Register as Agency</button>
                       </div>
                   )}
                </div>
            </div>
        </div>
    );
};

export default ModelOverview;
