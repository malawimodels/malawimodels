import React from 'react';
import { Project, ProjectStatus, UserData, UserRole } from '../../types';
import { AlertTriangle, Ban, Briefcase, Check, CheckCircle, Lock, Shield, Trash2, Unlock, User } from 'lucide-react';
import OptimizedImage from '../OptimizedImage';

interface AdminClientsProps {
    users: UserData[];
    projects: Project[];
    searchTerm: string;
    onVerify: (uid: string, current: boolean, role: UserRole) => void;
    onBlock: (uid: string, current: boolean) => void;
    onDelete: (uid: string, role: UserRole) => void;
}

const AdminClients: React.FC<AdminClientsProps> = ({ users, projects, searchTerm, onVerify, onBlock, onDelete }) => {
    const clients = users
        .filter((client) => client.role === UserRole.CLIENT)
        .filter((client) => {
            const normalizedSearch = searchTerm.trim().toLowerCase();
            if (!normalizedSearch) return true;

            const clientProjects = projects.filter((project) => project.ownerId === client.uid);
            return (
                (client.displayName?.toLowerCase() || '').includes(normalizedSearch) ||
                client.email.toLowerCase().includes(normalizedSearch) ||
                clientProjects.some((project) => project.title.toLowerCase().includes(normalizedSearch))
            );
        });

    const getClientProjects = (clientId: string) => projects.filter((project) => project.ownerId === clientId);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-brand-surface p-5 rounded-xl border border-white/5">
                    <div className="text-sm text-brand-muted mb-1">Client Accounts</div>
                    <div className="text-3xl font-bold text-white">{users.filter((client) => client.role === UserRole.CLIENT).length}</div>
                </div>
                <div className="bg-brand-surface p-5 rounded-xl border border-white/5">
                    <div className="text-sm text-brand-muted mb-1">Client Projects</div>
                    <div className="text-3xl font-bold text-white">{projects.length}</div>
                </div>
                <div className="bg-brand-surface p-5 rounded-xl border border-white/5">
                    <div className="text-sm text-brand-muted mb-1">Open Opportunities</div>
                    <div className="text-3xl font-bold text-white">{projects.filter((project) => project.status === ProjectStatus.OPEN).length}</div>
                </div>
            </div>

            <div className="bg-brand-surface rounded-xl shadow-xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/5">
                        <thead className="bg-black/20">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-brand-muted uppercase tracking-wider">Client</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-brand-muted uppercase tracking-wider">Activity</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-brand-muted uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-brand-muted uppercase tracking-wider">Risk</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-brand-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {clients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-brand-muted text-sm">
                                        No clients found.
                                    </td>
                                </tr>
                            ) : (
                                clients.map((client) => {
                                    const clientProjects = getClientProjects(client.uid);
                                    const openProjects = clientProjects.filter((project) => project.status === ProjectStatus.OPEN).length;
                                    const completedProjects = clientProjects.filter((project) => project.status === ProjectStatus.COMPLETED).length;
                                    const latestProject = clientProjects
                                        .slice()
                                        .sort((leftProject, rightProject) => new Date(rightProject.createdAt).getTime() - new Date(leftProject.createdAt).getTime())[0];

                                    return (
                                        <tr key={client.uid} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 flex-shrink-0 rounded-full overflow-hidden border border-white/10 bg-black/50 flex items-center justify-center">
                                                        {client.photoUrl ? (
                                                            <OptimizedImage className="h-10 w-10 object-cover" src={client.photoUrl} variant="avatar" alt={client.displayName || client.email} />
                                                        ) : (
                                                            <User className="w-5 h-5 text-brand-muted" />
                                                        )}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-bold text-white flex items-center">
                                                            {client.displayName || 'Unnamed Client'}
                                                            {client.verified && <CheckCircle className="w-3 h-3 ml-1 text-blue-400" />}
                                                        </div>
                                                        <div className="text-xs text-brand-muted">{client.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-white flex items-center">
                                                    <Briefcase className="w-4 h-4 mr-2 text-brand-primary" />
                                                    {clientProjects.length} Projects
                                                </div>
                                                <div className="text-xs text-brand-muted mt-1">
                                                    {openProjects} open &bull; {completedProjects} completed
                                                </div>
                                                {latestProject && (
                                                    <div className="text-[10px] text-brand-muted mt-1 truncate max-w-[220px]">
                                                        Latest: {latestProject.title}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {client.isActive ? (
                                                    <span className="text-green-400 text-xs font-bold flex items-center"><Check className="w-3 h-3 mr-1" /> Active</span>
                                                ) : (
                                                    <span className="text-red-400 text-xs font-bold flex items-center"><Ban className="w-3 h-3 mr-1" /> Blocked</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    {client.warningCount ? (
                                                        <span className="text-xs text-red-400 font-bold flex items-center"><AlertTriangle className="w-3 h-3 mr-1" /> {client.warningCount} Warnings</span>
                                                    ) : <span className="text-xs text-brand-muted">No Warnings</span>}

                                                    {client.deletionCount ? (
                                                        <span className="text-xs text-orange-400 font-bold flex items-center"><Ban className="w-3 h-3 mr-1" /> Deleted x{client.deletionCount}</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end space-x-2">
                                                    <button
                                                        onClick={() => onVerify(client.uid, client.verified || false, client.role)}
                                                        className={`p-2 rounded transition-colors ${client.verified ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-white/5 text-brand-muted hover:text-white'}`}
                                                        title={client.verified ? 'Remove Verification' : 'Verify Client'}
                                                    >
                                                        <Shield className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onBlock(client.uid, client.isActive)}
                                                        className={`p-2 rounded transition-colors ${!client.isActive ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-brand-muted hover:text-yellow-400'}`}
                                                        title={client.isActive ? 'Block Client' : 'Unblock Client'}
                                                    >
                                                        {client.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => onDelete(client.uid, client.role)}
                                                        className="p-2 rounded bg-white/5 text-brand-muted hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                                        title="Delete Permanently"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminClients;