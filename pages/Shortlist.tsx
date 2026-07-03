// pages/Shortlist.tsx

import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ShortlistContext } from '../App';
import { getModelProfile, subscribeToClientProjects, inviteModelToProject } from '../services/supabase.service';
import { ModelProfile, Project, UserRole, ProjectStatus } from '../types';
import ModelCard from '../components/ModelCard';
import { Heart, Briefcase, CheckCircle, X, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../components/NotificationSystem';

const Shortlist: React.FC = () => {
  const { shortlist, toggleShortlist } = useContext(ShortlistContext);
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const [models, setModels] = useState<ModelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedModelToInvite, setSelectedModelToInvite] = useState<ModelProfile | null>(null);
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      if (shortlist.length > 0) {
        try {
          // Fetch all models in parallel
          const promises = shortlist.map(uid => getModelProfile(uid));
          const results = await Promise.all(promises);
          setModels(results.filter(m => m !== null) as ModelProfile[]);
        } catch (error) {
          console.error("Error fetching shortlisted models", error);
        }
      } else {
        setModels([]);
      }
      setLoading(false);
    };

    fetchModels();
  }, [shortlist]);

  // Subscribe to client projects if user is a client
  useEffect(() => {
    if (user && role === UserRole.CLIENT) {
      const unsubscribe = subscribeToClientProjects(user.uid, (projs) => {
        // Filter only open projects
        const open = projs.filter(p => p.status === ProjectStatus.OPEN);
        setClientProjects(open);
        if (open.length > 0 && !selectedProjectId) {
          setSelectedProjectId(open[0].id);
        }
      });
      return () => unsubscribe();
    }
  }, [user, role]);

  const openInviteModal = (model: ModelProfile) => {
    if (role !== UserRole.CLIENT) {
      addNotification('info', "Only clients can invite models to projects. Sign up as a client!");
      return;
    }
    if (clientProjects.length === 0) {
      addNotification('error', "You don't have any open projects. Create one first!");
      navigate('/casting');
      return;
    }
    setSelectedModelToInvite(model);
    setIsInviteModalOpen(true);
  };

  const handleSendInvite = async () => {
    if (!selectedProjectId || !selectedModelToInvite) return;
    setInviting(true);
    try {
      await inviteModelToProject(selectedProjectId, selectedModelToInvite.uid);
      addNotification('success', `Invited ${selectedModelToInvite.displayName} to project!`);
      setIsInviteModalOpen(false);
    } catch (error) {
      console.error(error);
      addNotification('error', "Failed to send invitation.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-screen">
      <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center">
            <Heart className="w-8 h-8 mr-3 text-brand-primary fill-brand-primary" />
            My Shortlist
          </h1>
          <p className="text-brand-muted mt-2">
            {models.length} {models.length === 1 ? 'talent' : 'talents'} saved
          </p>
        </div>
        {models.length > 0 && (
           <button 
             onClick={() => models.forEach(m => toggleShortlist(m.uid))}
             className="px-4 py-2 bg-white/5 hover:bg-red-500/10 hover:text-red-500 text-brand-muted rounded-lg text-sm transition-colors"
           >
             Clear All
           </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader className="w-10 h-10 text-brand-primary animate-spin" />
        </div>
      ) : models.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {models.map(model => (
            <div key={model.uid} className="relative group">
               <ModelCard model={model} />
               <div className="absolute top-4 left-4 z-20">
                  <button 
                    onClick={() => openInviteModal(model)}
                    className="p-3 bg-brand-primary text-white rounded-full shadow-lg hover:bg-brand-accent transition-transform hover:scale-110"
                    title="Invite to Project"
                  >
                    <Briefcase className="w-5 h-5" />
                  </button>
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-brand-surface rounded-2xl border border-white/5 border-dashed">
          <Heart className="w-16 h-16 text-brand-muted mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-white mb-2">Your shortlist is empty</h2>
          <p className="text-brand-muted mb-6">Browse talent and click the heart icon to save them here.</p>
          <button 
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-accent transition-all"
          >
            Find Talent
          </button>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && selectedModelToInvite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-brand-surface w-full max-w-md rounded-2xl border border-white/10 shadow-2xl p-6 relative">
                  <button 
                    onClick={() => setIsInviteModalOpen(false)}
                    className="absolute top-4 right-4 text-brand-muted hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  
                  <h3 className="text-xl font-bold text-white mb-2">Invite Talent</h3>
                  <p className="text-sm text-brand-muted mb-6">
                    Invite <span className="text-white font-bold">{selectedModelToInvite.displayName}</span> to apply for your project.
                  </p>

                  {clientProjects.length > 0 ? (
                      <div className="mb-6">
                          <label className="block text-sm text-brand-muted mb-2">Select Project</label>
                          <select 
                             className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-brand-primary"
                             value={selectedProjectId}
                             onChange={(e) => setSelectedProjectId(e.target.value)}
                          >
                              {clientProjects.map(p => (
                                  <option key={p.id} value={p.id}>{p.title}</option>
                              ))}
                          </select>
                          
                          {/* Dynamic Status Message based on selection */}
                          {(() => {
                              const project = clientProjects.find(p => p.id === selectedProjectId);
                              if (project && selectedModelToInvite) {
                                  if (project.taggedModels.includes(selectedModelToInvite.uid)) {
                                      return <p className="text-xs text-yellow-400 mt-2 flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Already Invited</p>;
                                  }
                                  if (project.applicantModels.includes(selectedModelToInvite.uid)) {
                                      return <p className="text-xs text-blue-400 mt-2 flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Already Applied</p>;
                                  }
                                  if (project.approvedModels.includes(selectedModelToInvite.uid)) {
                                      return <p className="text-xs text-green-400 mt-2 flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Already Hired</p>;
                                  }
                              }
                              return <p className="text-xs text-brand-muted mt-2">The model will receive a notification to apply.</p>;
                          })()}
                      </div>
                  ) : (
                      <div className="mb-6 text-center py-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                          You don't have any open projects. Create a casting call first.
                      </div>
                  )}

                  <div className="flex gap-3">
                      <button 
                        onClick={() => setIsInviteModalOpen(false)}
                        className="flex-1 py-3 bg-white/5 text-brand-muted font-bold rounded-lg hover:bg-white/10 transition-colors"
                      >
                          Cancel
                      </button>
                      
                      {/* Button logic with disabled state for existing links */}
                      {(() => {
                          const project = clientProjects.find(p => p.id === selectedProjectId);
                          const isLinked = project && selectedModelToInvite && (
                              project.taggedModels.includes(selectedModelToInvite.uid) ||
                              project.applicantModels.includes(selectedModelToInvite.uid) ||
                              project.approvedModels.includes(selectedModelToInvite.uid)
                          );

                          return (
                              <button 
                                onClick={handleSendInvite}
                                disabled={clientProjects.length === 0 || inviting || isLinked}
                                className={`flex-1 py-3 font-bold rounded-lg transition-colors flex items-center justify-center ${
                                    isLinked 
                                    ? 'bg-white/10 text-brand-muted cursor-not-allowed' 
                                    : 'bg-brand-primary text-white hover:bg-brand-accent shadow-lg disabled:opacity-50'
                                }`}
                              >
                                  {inviting ? "Sending..." : isLinked ? "Already Sent" : "Send Invite"}
                              </button>
                          );
                      })()}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Shortlist;
