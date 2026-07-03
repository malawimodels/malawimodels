
import React, { useState } from 'react';
import { UserData, UserRole } from '../../types';
import { User, CheckCircle, AlertTriangle, Ban, Shield, Lock, Unlock, Trash2, Check } from 'lucide-react';
import OptimizedImage from '../OptimizedImage';

interface AdminUsersProps {
    users: UserData[];
    searchTerm: string;
    filterRole: string;
    onVerify: (uid: string, current: boolean, role: UserRole) => void;
    onBlock: (uid: string, current: boolean) => void;
    onDelete: (uid: string, role: UserRole) => void;
}

const AdminUsers: React.FC<AdminUsersProps> = ({ users, searchTerm, filterRole, onVerify, onBlock, onDelete }) => {
    
    const filteredUsers = users.filter(u => {
        const matchesSearch = (u.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'all' || u.role === filterRole;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="bg-brand-surface rounded-xl shadow-xl overflow-hidden border border-white/5 animate-fade-in">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-black/20">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-brand-muted uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-brand-muted uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-brand-muted uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-brand-muted uppercase tracking-wider">Stats</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-brand-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map(u => (
                  <tr key={u.uid} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full overflow-hidden border border-white/10 bg-black/50 flex items-center justify-center">
                          {u.photoUrl ? (
                             <OptimizedImage className="h-10 w-10 object-cover" src={u.photoUrl} variant="avatar" alt={u.displayName || u.email} />
                          ) : (
                             <User className="w-5 h-5 text-brand-muted" />
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-white flex items-center">
                             {u.displayName || 'Unnamed User'}
                             {u.verified && <CheckCircle className="w-3 h-3 ml-1 text-blue-400" />}
                          </div>
                          <div className="text-xs text-brand-muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-[10px] font-bold uppercase tracking-wide rounded-full border ${
                        u.role === UserRole.CLIENT ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                        u.role === UserRole.MODEL ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        u.role === UserRole.AGENCY ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        'bg-white/10 text-brand-muted border-white/10'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       {u.isActive ? (
                         <span className="text-green-400 text-xs font-bold flex items-center"><Check className="w-3 h-3 mr-1" /> Active</span>
                       ) : (
                         <span className="text-red-400 text-xs font-bold flex items-center"><Ban className="w-3 h-3 mr-1" /> Blocked</span>
                       )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col gap-1">
                          {u.warningCount ? (
                              <span className="text-xs text-red-400 font-bold flex items-center"><AlertTriangle className="w-3 h-3 mr-1" /> {u.warningCount} Warnings</span>
                          ) : <span className="text-xs text-brand-muted">No Warnings</span>}
                          
                          {u.deletionCount ? (
                              <span className="text-xs text-orange-400 font-bold flex items-center" title="Removed by other users after projects"><Ban className="w-3 h-3 mr-1" /> Deleted x{u.deletionCount}</span>
                          ) : null}
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                         <button 
                           onClick={() => onVerify(u.uid, u.verified || false, u.role)}
                           className={`p-2 rounded transition-colors ${u.verified ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-white/5 text-brand-muted hover:text-white'}`} 
                           title={u.verified ? "Remove Verification" : "Verify User"}
                         >
                           <Shield className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={() => onBlock(u.uid, u.isActive)}
                           className={`p-2 rounded transition-colors ${!u.isActive ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-brand-muted hover:text-yellow-400'}`}
                           title={u.isActive ? "Block Account" : "Unblock Account"}
                         >
                           {u.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                         </button>
                         <button 
                           onClick={() => onDelete(u.uid, u.role)}
                           className="p-2 rounded bg-white/5 text-brand-muted hover:bg-red-500/20 hover:text-red-400 transition-colors" 
                           title="Delete Permanently"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    );
};

export default AdminUsers;
