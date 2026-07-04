
import React, { useEffect, useState } from 'react';
import { UserData, Project, AgencyRequest, ModelRankingSignal } from '../../types';
import { Users, Briefcase, Building, TrendingUp, Star, CheckCircle, AlertTriangle } from 'lucide-react';
import { getModelRankingSignals } from '../../services/supabase.service';

interface AdminOverviewProps {
    users: UserData[];
    projects: Project[];
    requests: AgencyRequest[];
}

const AdminOverview: React.FC<AdminOverviewProps> = ({ users, projects, requests }) => {
    const [rankingSignals, setRankingSignals] = useState<ModelRankingSignal[]>([]);
    const [loadingSignals, setLoadingSignals] = useState(true);

    useEffect(() => {
        let active = true;
        setLoadingSignals(true);
        getModelRankingSignals(8)
            .then((signals) => {
                if (active) setRankingSignals(signals);
            })
            .catch((error) => console.error('Error loading ranking signals:', error))
            .finally(() => {
                if (active) setLoadingSignals(false);
            });

        return () => { active = false; };
    }, []);
    
    const stats = {
        totalUsers: users.length,
        models: users.filter(u => u.role === 'model').length,
        clients: users.filter(u => u.role === 'client').length,
        agencies: users.filter(u => u.role === 'agency').length,
        activeProjects: projects.filter(p => p.status === 'OPEN').length,
        pendingRequests: requests.filter((request) => request.status === 'pending').length
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{stats.totalUsers}</div>
                    <div className="text-sm text-brand-muted flex gap-2">
                        <span>{stats.models} Models</span> • <span>{stats.clients} Clients</span>
                    </div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/10 rounded-bl-full pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary">
                            <Briefcase className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{stats.activeProjects}</div>
                    <div className="text-sm text-brand-muted">Active Projects</div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-bl-full pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-500/10 rounded-xl text-green-400">
                            <Building className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{stats.agencies}</div>
                    <div className="text-sm text-brand-muted">Registered Agencies</div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-bl-full pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{stats.pendingRequests}</div>
                    <div className="text-sm text-brand-muted">Pending Applications</div>
                </div>
            </div>

            <div className="bg-brand-surface border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Platform Health</h3>
                <div className="text-brand-muted text-sm">
                    System is operational. {users.length > 0 ? "User database is active." : "No users yet."}
                </div>
            </div>

            <div className="bg-brand-surface border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/10 flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-white">Ranking Signals</h3>
                        <p className="text-xs text-brand-muted mt-1">Top talent by score, reviews, work history, cancellations, and profile strength.</p>
                    </div>
                    <TrendingUp className="w-5 h-5 text-brand-primary" />
                </div>

                {loadingSignals ? (
                    <div className="p-8 text-center text-brand-muted animate-pulse">Loading ranking analytics...</div>
                ) : rankingSignals.length === 0 ? (
                    <div className="p-8 text-center text-brand-muted">No model ranking data yet.</div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {rankingSignals.map((signal) => (
                            <div key={signal.modelId} className="p-4 grid grid-cols-1 lg:grid-cols-[1.3fr_repeat(5,1fr)] gap-3 items-center hover:bg-white/5 transition-colors">
                                <div>
                                    <div className="font-bold text-white">{signal.displayName}</div>
                                    <div className="text-xs text-brand-muted">Score {signal.rankingScore.toFixed(1)}</div>
                                </div>
                                <div className="text-sm text-brand-muted flex items-center gap-2">
                                    <Star className="w-4 h-4 text-brand-primary fill-brand-primary" />
                                    <span className="text-white font-bold">{signal.averageRating.toFixed(1)}</span>
                                    <span>({signal.reviewsCount})</span>
                                </div>
                                <div className="text-sm text-brand-muted flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    <span className="text-white font-bold">{signal.completedJobs}</span>
                                    <span>completed</span>
                                </div>
                                <div className="text-sm text-brand-muted flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                                    <span className="text-white font-bold">{signal.cancelledJobs}</span>
                                    <span>cancelled</span>
                                </div>
                                <div>
                                    <div className="text-xs text-brand-muted mb-1">Response</div>
                                    <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-400" style={{ width: `${Math.min(signal.responseRate, 100)}%` }} />
                                    </div>
                                    <div className="text-[10px] text-brand-muted mt-1">{signal.responseRate}% approved</div>
                                </div>
                                <div>
                                    <div className="text-xs text-brand-muted mb-1">Profile</div>
                                    <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                                        <div className="h-full bg-brand-primary" style={{ width: `${Math.min(signal.profileCompleteness, 100)}%` }} />
                                    </div>
                                    <div className="text-[10px] text-brand-muted mt-1">{signal.profileCompleteness}% complete</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminOverview;
