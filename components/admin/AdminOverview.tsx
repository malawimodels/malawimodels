
import React from 'react';
import { UserData, Project, AgencyRequest } from '../../types';
import { Users, Briefcase, Building, TrendingUp } from 'lucide-react';

interface AdminOverviewProps {
    users: UserData[];
    projects: Project[];
    requests: AgencyRequest[];
}

const AdminOverview: React.FC<AdminOverviewProps> = ({ users, projects, requests }) => {
    
    const stats = {
        totalUsers: users.length,
        models: users.filter(u => u.role === 'model').length,
        clients: users.filter(u => u.role === 'client').length,
        agencies: users.filter(u => u.role === 'agency').length,
        activeProjects: projects.filter(p => p.status === 'OPEN').length,
        pendingRequests: requests.length
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

            {/* Recent Activity Mini-List could go here */}
            <div className="bg-brand-surface border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Platform Health</h3>
                <div className="text-brand-muted text-sm">
                    System is operational. {users.length > 0 ? "User database is active." : "No users yet."}
                </div>
            </div>
        </div>
    );
};

export default AdminOverview;
