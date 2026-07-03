
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { createProject, subscribeToSearchModels, inviteModelToProject, getProjectById, getUserData } from '../services/supabase.service';
import { ModelProfile, Category, District, ProjectVisibility, ProjectStatus, Gender, SkinTone } from '../types';
import ModelCard from '../components/ModelCard';
import { Calendar, MapPin, Briefcase, ChevronRight, CheckCircle, ArrowLeft, Send, Search, Users, AlertCircle, Globe, Lock } from 'lucide-react';
import { useNotification } from '../components/NotificationSystem';

const CastingCall: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const [searchParams] = useSearchParams();
  const existingProjectId = searchParams.get('projectId');

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]); // Models to invite
  const [alreadyInvited, setAlreadyInvited] = useState<string[]>([]); // Models already in DB
  
  // Real Project State
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectData, setProjectData] = useState({
    title: '',
    description: '',
    category: '' as Category,
    location: '' as District,
    visibility: ProjectVisibility.PUBLIC,
    dates: '',
    eventDate: '' // Strict ISO date
  });

  const [availableModels, setAvailableModels] = useState<ModelProfile[]>([]);

  // Initialize: If projectId exists, fetch it and jump to Step 2
  useEffect(() => {
    if (existingProjectId) {
      setProjectId(existingProjectId);
      setIsLoading(true);
      getProjectById(existingProjectId).then(p => {
        if (p) {
          setProjectData({
            title: p.title,
            description: p.description,
            category: p.category,
            location: p.location,
            visibility: p.visibility,
            dates: p.dates || '',
            eventDate: p.eventDate || ''
          });
          setAlreadyInvited(p.taggedModels || []);
          setStep(2);
        }
        setIsLoading(false);
      });
    }
  }, [existingProjectId]);

  // Step 2 Logic: Real-Time Subscription Search
  useEffect(() => {
    if (step === 2 && projectData.category && projectData.location) {
      setIsLoading(true);
      
      const unsubscribe = subscribeToSearchModels({
        categories: [projectData.category],
        locations: [projectData.location],
        minHeight: 0,
        maxHeight: 300,
        gender: null,
        skinTones: [],
        onlyAvailable: true // Usually casting calls want available talent
      }, (results) => {
        setAvailableModels(results);
        setIsLoading(false);
      });

      return () => unsubscribe();
    }
  }, [step, projectData.category, projectData.location]);

  const handleCreateProject = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Fetch user data to ensure we have the correct display name, photoUrl AND Verification status
      const userData = await getUserData(user.uid);

      const newId = await createProject({
        ownerId: user.uid,
        ownerName: userData?.displayName || user.displayName || 'Client',
        ownerPhotoUrl: userData?.photoUrl || null,
        ownerVerified: userData?.verified || false, // Inject verification status
        title: projectData.title,
        description: projectData.description,
        dates: projectData.dates,
        eventDate: projectData.eventDate, // Pass strict date
        category: projectData.category,
        location: projectData.location,
        visibility: projectData.visibility,
        status: ProjectStatus.OPEN,
        taggedModels: [],
        applicantModels: [],
        approvedModels: []
      });
      setProjectId(newId);
      setStep(2);
      addNotification('success', 'Project created successfully!');
    } catch (e) {
      console.error(e);
      addNotification('error', "Error creating project");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (modelUid: string) => {
    if (!projectId) return;
    try {
      await inviteModelToProject(projectId, modelUid);
      setAlreadyInvited(prev => [...prev, modelUid]);
      // Remove from selectedModels if it was there
      setSelectedModels(prev => prev.filter(id => id !== modelUid));
    } catch (e) {
      console.error("Failed to invite", e);
    }
  };

  const handleBulkInvite = async () => {
    if (!projectId) return;
    setIsLoading(true);
    // Process all selected models
    const promises = selectedModels.map(uid => inviteModelToProject(projectId, uid));
    await Promise.all(promises);
    setAlreadyInvited(prev => [...prev, ...selectedModels]);
    setSelectedModels([]);
    setIsLoading(false);
    addNotification('success', 'Invitations sent successfully!');
    navigate('/client-dashboard');
  };

  // STEP 1: CREATE PROJECT (Only if not existing)
  const renderStep1 = () => (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="bg-brand-surface border border-white/5 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-bl-full pointer-events-none"></div>

        <h2 className="text-3xl font-bold text-white mb-6 flex items-center">
          <Briefcase className="w-8 h-8 mr-3 text-brand-primary" />
          Create Casting Call
        </h2>
        <p className="text-brand-muted mb-8">
          Define your project requirements. Once created, you can immediately search and invite matching talent.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Project Name / Title</label>
            <input 
              type="text" 
              className="w-full bg-brand-bg/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
              placeholder="e.g. Summer Music Video"
              value={projectData.title}
              onChange={(e) => setProjectData({...projectData, title: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Project Category</label>
              <div className="relative">
                <select 
                  className="w-full bg-brand-bg/50 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:border-brand-primary cursor-pointer"
                  value={projectData.category}
                  onChange={(e) => setProjectData({...projectData, category: e.target.value as Category})}
                >
                  <option value="" disabled>Select Type</option>
                  {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <Briefcase className="absolute right-4 top-3.5 w-4 h-4 text-brand-muted pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Location</label>
              <div className="relative">
                <select 
                  className="w-full bg-brand-bg/50 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:border-brand-primary cursor-pointer"
                  value={projectData.location}
                  onChange={(e) => setProjectData({...projectData, location: e.target.value as District})}
                >
                  <option value="" disabled>Select District</option>
                  {Object.values(District).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <MapPin className="absolute right-4 top-3.5 w-4 h-4 text-brand-muted pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-white mb-2">Event Date (Required for Completion Logic)</label>
             <div className="relative">
                {/* Changed to type="date" to capture ISO date for logic */}
                <input 
                  type="date" 
                  className="w-full bg-brand-bg/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary"
                  value={projectData.eventDate}
                  onChange={(e) => setProjectData({...projectData, eventDate: e.target.value, dates: e.target.value})}
                />
                <Calendar className="absolute right-4 top-3.5 w-4 h-4 text-brand-muted pointer-events-none" />
             </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-white mb-2">Visibility</label>
             <div className="grid grid-cols-2 gap-4">
                 <button 
                   onClick={() => setProjectData({...projectData, visibility: ProjectVisibility.PUBLIC})}
                   className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${projectData.visibility === ProjectVisibility.PUBLIC ? 'bg-brand-primary/20 border-brand-primary text-white' : 'bg-brand-bg/50 border-white/10 text-brand-muted hover:border-white/30'}`}
                 >
                   <Globe className="w-6 h-6 mb-2" />
                   <span className="font-bold text-sm">Public</span>
                   <span className="text-[10px] mt-1 opacity-70">Models can see & apply</span>
                 </button>
                 <button 
                   onClick={() => setProjectData({...projectData, visibility: ProjectVisibility.PRIVATE})}
                   className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${projectData.visibility === ProjectVisibility.PRIVATE ? 'bg-brand-primary/20 border-brand-primary text-white' : 'bg-brand-bg/50 border-white/10 text-brand-muted hover:border-white/30'}`}
                 >
                   <Lock className="w-6 h-6 mb-2" />
                   <span className="font-bold text-sm">Private</span>
                   <span className="text-[10px] mt-1 opacity-70">Only invited models see this</span>
                 </button>
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Description / Notes</label>
            <textarea 
              className="w-full bg-brand-bg/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary h-24 resize-none"
              placeholder="Briefly describe what you are looking for..."
              value={projectData.description}
              onChange={(e) => setProjectData({...projectData, description: e.target.value})}
            />
          </div>

          <button 
            disabled={!projectData.title || !projectData.category || !projectData.location || !projectData.eventDate || isLoading}
            onClick={handleCreateProject}
            className="w-full bg-brand-primary hover:bg-brand-accent text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-brand-primary/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {isLoading ? "Creating..." : "Save & Find Talent"} <ChevronRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );

  // STEP 2: SEARCH & INVITE
  const renderStep2 = () => (
    <div className="animate-fade-in w-full">
       <div className="bg-brand-surface border-y border-white/10 py-6 mb-8 sticky top-[72px] z-30 shadow-2xl backdrop-blur-md bg-opacity-90">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <div className="flex items-center text-xs text-brand-muted uppercase tracking-widest mb-1">
                <button onClick={() => navigate('/client-dashboard')} className="hover:text-white flex items-center mr-2"><ArrowLeft className="w-3 h-3 mr-1" /> Dashboard</button> 
                / {projectData.title}
              </div>
              <h2 className="text-2xl font-bold text-white flex items-center">
                Search & Invite
                <span className="ml-3 px-2 py-0.5 rounded text-sm bg-white/10 text-white font-normal border border-white/10">{projectData.category}</span>
                <span className="ml-2 px-2 py-0.5 rounded text-sm bg-white/10 text-white font-normal border border-white/10">{projectData.location}</span>
                {projectData.visibility === ProjectVisibility.PRIVATE && <Lock className="w-4 h-4 ml-3 text-brand-muted" />}
              </h2>
            </div>
            
            <div className="flex items-center gap-4">
               {selectedModels.length > 0 && (
                 <div className="text-sm font-bold text-brand-primary">{selectedModels.length} selected</div>
               )}
              <button 
                onClick={handleBulkInvite}
                disabled={selectedModels.length === 0 || isLoading}
                className="px-6 py-3 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-lg"
              >
                {isLoading ? "Sending..." : "Send Invites"} <Send className="w-4 h-4 ml-2" />
              </button>
            </div>
         </div>
       </div>

       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
         {isLoading ? (
           <div className="flex flex-col items-center justify-center h-64">
             <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
             <p className="text-brand-muted animate-pulse">Scanning database for available talent...</p>
           </div>
         ) : availableModels.length > 0 ? (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
             {availableModels.map(model => {
               const isAlreadyInvited = alreadyInvited.includes(model.uid);
               const isSelected = selectedModels.includes(model.uid);

               return (
                 <div key={model.uid} className={`relative group transition-all duration-300 ${isSelected ? 'ring-2 ring-brand-primary rounded-xl transform scale-[1.02] z-10' : ''}`}>
                   {/* Card Action Overlay */}
                   <div className="absolute inset-0 z-20 pointer-events-none">
                     <div className="absolute top-4 right-4 pointer-events-auto">
                        {isAlreadyInvited ? (
                            <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1" /> Invited
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    if(isSelected) setSelectedModels(prev => prev.filter(id => id !== model.uid));
                                    else setSelectedModels(prev => [...prev, model.uid]);
                                }}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-lg ${isSelected ? 'bg-brand-primary text-white' : 'bg-black/50 text-white hover:bg-brand-primary'}`}
                            >
                                {isSelected ? <CheckCircle className="w-5 h-5" /> : <div className="w-4 h-4 rounded-full border-2 border-white"></div>}
                            </button>
                        )}
                     </div>
                   </div>
                   
                   {/* Blur if invited */}
                   <div className={isAlreadyInvited ? "opacity-60 grayscale" : ""}>
                       <ModelCard model={model} />
                   </div>
                 </div>
               );
             })}
           </div>
         ) : (
           <div className="flex flex-col items-center justify-center py-20 bg-brand-surface/30 rounded-2xl border border-white/5 border-dashed">
             <AlertCircle className="w-12 h-12 text-brand-muted mb-4" />
             <h3 className="text-xl font-bold text-white">No models found</h3>
             <p className="text-brand-muted mt-2">No models match this project's category and location yet.</p>
           </div>
         )}
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-bg px-4 sm:px-6">
       {/* Wizard Steps Indicator */}
       {step === 1 && (
         <div className="max-w-xl mx-auto flex items-center justify-center mb-10 space-x-4 pt-10">
           <div className={`h-2 w-16 rounded-full transition-colors bg-brand-primary`}></div>
           <div className={`h-2 w-16 rounded-full transition-colors bg-white/10`}></div>
         </div>
       )}

       {step === 1 && renderStep1()}
       {step === 2 && renderStep2()}
    </div>
  );
};

export default CastingCall;
