
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUserData, getAgencyModels } from '../services/supabase.service';
import { UserData, ModelProfile } from '../types';
import { Building, MapPin, Globe, Mail, Phone, Instagram, CheckCircle, Users, Image as ImageIcon, ExternalLink, Link as LinkIcon } from 'lucide-react';
import ModelCard from '../components/ModelCard';
import JoinAgencyModal from '../components/JoinAgencyModal';
import OptimizedImage from '../components/OptimizedImage';

const AgencyProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agency, setAgency] = useState<UserData | null>(null);
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchData = async () => {
      if (!id) return;
      try {
        const [agencyData, agencyModels] = await Promise.all([
          getUserData(id),
          getAgencyModels(id)
        ]);
        
        if (agencyData && agencyData.role === 'agency') {
          setAgency(agencyData);
          setModels(agencyModels);
        } else {
          navigate('/agencies'); // Redirect if not found or not an agency
        }
      } catch (error) {
        console.error("Error loading agency profile", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  if (loading) return <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-muted">Loading Agency...</div>;
  if (!agency) return null;

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      {/* Join Modal */}
      <JoinAgencyModal 
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        agency={agency}
      />

      {/* Cover / Header */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden bg-gradient-to-r from-brand-surface to-black border-b border-white/10">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-10 relative z-10">
          <div className="flex flex-col md:flex-row items-end md:items-center gap-6 w-full">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-brand-surface rounded-2xl border-4 border-brand-bg shadow-2xl overflow-hidden flex-shrink-0">
              {agency.photoUrl ? (
                <OptimizedImage src={agency.photoUrl} variant="avatar" alt={agency.displayName} className="w-full h-full object-cover" />
              ) : (
                <Building className="w-12 h-12 text-brand-muted m-auto h-full" />
              )}
            </div>
            <div className="flex-grow">
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 flex items-center">
                {agency.displayName}
                {agency.verified && <CheckCircle className="w-6 h-6 text-blue-500 ml-3" />}
              </h1>
              <div className="flex flex-wrap gap-4 text-brand-muted text-sm">
                <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> Malawi</span>
                
                {/* Standard Links */}
                {agency.contact?.instagram && (
                  <span className="flex items-center"><Instagram className="w-4 h-4 mr-1" /> {agency.contact.instagram}</span>
                )}
                {agency.website && (
                  <a href={agency.website} target="_blank" rel="noreferrer" className="flex items-center text-brand-primary hover:underline">
                    <Globe className="w-4 h-4 mr-1" /> Website
                  </a>
                )}

                {/* Custom Dynamic Links */}
                {agency.customLinks && agency.customLinks.map((link, idx) => (
                    <a key={idx} href={link.url} target="_blank" rel="noreferrer" className="flex items-center text-brand-primary hover:text-white transition-colors">
                        <LinkIcon className="w-3 h-3 mr-1" /> {link.platform}
                    </a>
                ))}
              </div>
            </div>
            <div className="text-right hidden md:block">
               <div className="text-3xl font-bold text-white">{models.length}</div>
               <div className="text-xs text-brand-muted uppercase tracking-wider">Models Signed</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            {/* About */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">About the Agency</h2>
              <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 leading-relaxed text-brand-muted">
                {agency.bio || "No bio available for this agency."}
              </div>
            </section>

            {/* Gallery (Team/Events) */}
            {agency.gallery && agency.gallery.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2 text-brand-primary" /> Agency Gallery
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {agency.gallery.map((img, idx) => (
                    <div key={idx} className="aspect-video rounded-xl overflow-hidden bg-black/20 border border-white/5 group">
                      <OptimizedImage src={img} variant="gallery" alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Roster */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center justify-between">
                <span>Roster / Models</span>
                <span className="text-sm font-normal text-brand-muted bg-white/5 px-3 py-1 rounded-full">{models.length} Talent</span>
              </h2>
              {models.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {models.map(model => (
                    <ModelCard key={model.uid} model={model} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-brand-surface rounded-xl border border-white/5 border-dashed text-brand-muted">
                  No models currently displayed in the public roster.
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 sticky top-24">
              <h3 className="text-lg font-bold text-white mb-4">Contact Information</h3>
              <ul className="space-y-4 text-sm text-brand-muted">
                {agency.contact?.publicEmail && (
                  <li className="flex items-center">
                    <Mail className="w-4 h-4 mr-3 text-brand-primary" />
                    <a href={`mailto:${agency.contact.publicEmail}`} className="hover:text-white transition-colors">{agency.contact.publicEmail}</a>
                  </li>
                )}
                {agency.contact?.whatsapp && (
                  <li className="flex items-center">
                    <Phone className="w-4 h-4 mr-3 text-brand-primary" />
                    <span>{agency.contact.whatsapp}</span>
                  </li>
                )}
                {agency.contact?.instagram && (
                  <li className="flex items-center">
                    <Instagram className="w-4 h-4 mr-3 text-brand-primary" />
                    <span>@{agency.contact.instagram.replace('@','')}</span>
                  </li>
                )}
              </ul>
              
              <div className="mt-6 pt-6 border-t border-white/5">
                 <div className="flex items-center gap-3 mb-2">
                    <Users className="w-5 h-5 text-brand-primary" />
                    <span className="font-bold text-white">Join this Agency</span>
                 </div>
                 <p className="text-xs text-brand-muted mb-4">
                   Are you a model looking for representation?
                 </p>
                 <button 
                    onClick={() => setIsJoinModalOpen(true)}
                    className="w-full py-2 bg-white/5 hover:bg-brand-primary hover:text-white text-brand-muted font-bold text-xs rounded-lg transition-colors border border-white/10"
                 >
                   Submit Application
                 </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AgencyProfile;
