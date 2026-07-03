
import React from 'react';
import { Project } from '../../types';
import { Trash2 } from 'lucide-react';
import OptimizedImage from '../OptimizedImage';

interface AdminProjectsProps {
    projects: Project[];
    searchTerm: string;
    onDelete: (id: string) => void;
}

const AdminProjects: React.FC<AdminProjectsProps> = ({ projects, searchTerm, onDelete }) => {
    
    const filteredProjects = projects.filter(p => 
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-brand-surface rounded-xl shadow-xl overflow-hidden border border-white/5 animate-fade-in">
           <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-black/20">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-brand-muted uppercase tracking-wider">Project</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-brand-muted uppercase tracking-wider">Owner / Client</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-brand-muted uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-brand-muted uppercase tracking-wider">Location</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-brand-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredProjects.map(p => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="text-sm font-bold text-white">{p.title}</div>
                       <div className="text-xs text-brand-muted">{new Date(p.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="text-sm text-white flex items-center">
                         {p.ownerPhotoUrl && <OptimizedImage src={p.ownerPhotoUrl} variant="avatar" className="w-6 h-6 rounded-full mr-2 object-cover" alt={p.ownerName} />}
                         {p.ownerName}
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="px-2 py-1 text-[10px] uppercase font-bold bg-white/10 rounded text-brand-muted">{p.category}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-muted">
                       {p.location}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                           onClick={() => onDelete(p.id)}
                           className="p-2 rounded bg-white/5 text-brand-muted hover:bg-red-500/20 hover:text-red-400 transition-colors" 
                           title="Delete Project"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    );
};

export default AdminProjects;
