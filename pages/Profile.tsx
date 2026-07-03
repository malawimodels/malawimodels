
import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getModelProfile, incrementModelViews, getUserData } from '../services/supabase.service';
import { ModelProfile, UserData } from '../types';
import { MapPin, Share2, CheckCircle, Camera, Heart, PlayCircle, Building, Star, Maximize2, X } from 'lucide-react';
import { ShortlistContext } from '../App';
import OptimizedImage from '../components/OptimizedImage';
import { useNotification } from '../components/NotificationSystem';

const Profile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [model, setModel] = useState<ModelProfile | null>(null);
  const [userStats, setUserStats] = useState<UserData | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<{ src: string; alt: string } | null>(null);
  const { shortlist, toggleShortlist } = useContext(ShortlistContext);
  const { addNotification } = useNotification();

  useEffect(() => {
    window.scrollTo(0,0);
    if (id) {
      // 1. Fetch Profile
      getModelProfile(id).then(data => {
        if (!data) {
          navigate('/');
          return;
        }
        setModel(data);
        // 2. Increment View (fire and forget)
        incrementModelViews(id);
      });
      // 3. Fetch User Data for Rating
      getUserData(id).then(setUserStats);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!fullscreenImage) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreenImage(null);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeydown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [fullscreenImage]);

  if (!model) return <div className="min-h-screen flex items-center justify-center bg-brand-bg text-white">Loading...</div>;

  const isShortlisted = shortlist.includes(model.uid);
  const mainImage = model.media?.images?.[0] || 'https://via.placeholder.com/400x600';

  // Helper to extract YouTube ID
  const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return null;
    let videoId = '';
    // Handle standard watch?v= format
    if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('v=')[1];
      const ampersandPosition = videoId.indexOf('&');
      if (ampersandPosition !== -1) {
        videoId = videoId.substring(0, ampersandPosition);
      }
    } 
    // Handle short youtu.be/ format
    else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1];
    }
    
    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
    }
    return null;
  };

  const videoEmbedUrl = model.media.videos?.[0] ? getYouTubeEmbedUrl(model.media.videos[0]) : null;

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const title = `${model.displayName} on Malawi Models`;

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `View ${model.displayName}'s portfolio on Malawi Models.`,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      addNotification('success', 'Profile link copied.');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        addNotification('error', 'Could not share this profile.');
      }
    }
  };

  return (
    <div className="bg-brand-bg min-h-screen text-brand-text">
      
      {/* Header Image Background - Blurry */}
      <div className="relative h-64 md:h-96 w-full overflow-hidden">
        <div className="absolute inset-0 bg-brand-bg/60 z-10"></div>
        <OptimizedImage src={mainImage} variant="hero" className="w-full h-full object-cover filter blur-xl scale-110 opacity-50" alt="background" loading="eager" />
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-brand-bg to-transparent z-20"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-30 -mt-20 md:-mt-48 pb-16">
        <div className="flex flex-col md:flex-row gap-10 items-start">
          
          {/* Main Avatar Card */}
          <div className="w-full md:w-1/3 max-w-md flex-shrink-0 mx-auto md:mx-0">
             <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-brand-surface relative group">
               <button
                 type="button"
                 onClick={() => setFullscreenImage({ src: mainImage, alt: model.displayName })}
                 className="aspect-[3/4] w-full block relative text-left"
                 aria-label={`Open ${model.displayName} photo fullscreen`}
               >
                 <OptimizedImage src={mainImage} alt={model.displayName} variant="card" className="w-full h-full object-cover" loading="eager" />
                 <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-md px-3 py-2 text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                   <Maximize2 className="w-4 h-4" /> View
                 </span>
               </button>
               
               <div className="absolute top-4 right-4 flex flex-col gap-3">
                 <button onClick={handleShare} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-brand-primary transition-colors" aria-label="Share profile">
                   <Share2 className="w-5 h-5" />
                 </button>
               </div>
             </div>
             
             {/* Mobile-Visible Save Button (Under Image) */}
             <button 
                onClick={() => toggleShortlist(model.uid)}
                className={`flex md:hidden w-full items-center justify-center mt-4 px-6 py-3 rounded-xl border transition-all ${isShortlisted ? 'bg-brand-primary border-brand-primary text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'border-white/20 text-white hover:border-brand-primary hover:text-brand-primary'}`}
              >
                <Heart className={`w-5 h-5 mr-2 ${isShortlisted ? 'fill-current' : ''}`} />
                {isShortlisted ? 'Saved to Shortlist' : 'Save to Shortlist'}
              </button>
          </div>

          {/* Detailed Info */}
          <div className="flex-grow w-full pt-4 md:pt-20">
            <div className="flex flex-col md:flex-row justify-between items-start mb-6">
              <div className="w-full">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${model.availability ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-red-500/30 text-red-400 bg-red-500/10'}`}>
                    {model.availability ? 'Available' : 'Booked'}
                  </span>
                  {model.agencyId && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-blue-500/30 text-blue-400 bg-blue-500/10 flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" /> Agency Signed
                    </span>
                  )}
                </div>
                <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 flex items-center flex-wrap">
                  {model.displayName}
                  {model.verified && (
                    <span title="Verified Talent">
                      <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-blue-500 ml-2 md:ml-3 fill-blue-500/10" />
                    </span>
                  )}
                </h1>
                
                {/* RATING DISPLAY */}
                {userStats?.averageRating ? (
                    <div className="flex items-center mb-4">
                        <div className="flex text-brand-primary">
                            {[1,2,3,4,5].map(star => (
                                <Star key={star} className={`w-5 h-5 ${star <= Math.round(userStats.averageRating || 0) ? 'fill-current' : 'text-gray-600'}`} />
                            ))}
                        </div>
                        <span className="ml-2 text-white font-bold">{userStats.averageRating.toFixed(1)}</span>
                        <span className="ml-2 text-brand-muted text-sm">({userStats.reviewsCount} reviews)</span>
                    </div>
                ) : (
                    <div className="flex items-center mb-4 text-brand-muted text-sm">
                        <Star className="w-4 h-4 mr-1 text-gray-600" /> No reviews yet
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-brand-muted text-base md:text-lg">
                  <span className="flex items-center">
                     <MapPin className="w-5 h-5 mr-2 text-brand-primary" />
                     {model.location}, Malawi
                  </span>
                  {model.agencyName && (
                    <span className="flex items-center text-sm border-l border-white/10 pl-4">
                        <Building className="w-4 h-4 mr-2 text-brand-muted" />
                        Under {model.agencyName}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Desktop Save Button */}
              <button 
                onClick={() => toggleShortlist(model.uid)}
                className={`hidden md:flex items-center px-6 py-3 rounded-xl border transition-all ${isShortlisted ? 'bg-brand-primary border-brand-primary text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'border-white/20 text-white hover:border-brand-primary hover:text-brand-primary'}`}
              >
                <Heart className={`w-5 h-5 mr-2 ${isShortlisted ? 'fill-current' : ''}`} />
                {isShortlisted ? 'Saved' : 'Save Model'}
              </button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <div className="bg-brand-surface border border-white/5 p-4 rounded-xl text-center hover:border-brand-primary/30 transition-colors">
                <div className="text-xs text-brand-muted uppercase tracking-widest mb-1">Height</div>
                <div className="text-2xl font-bold text-white">{model.height} <span className="text-sm font-normal text-brand-muted">cm</span></div>
              </div>
              <div className="bg-brand-surface border border-white/5 p-4 rounded-xl text-center hover:border-brand-primary/30 transition-colors">
                <div className="text-xs text-brand-muted uppercase tracking-widest mb-1">Gender</div>
                <div className="text-2xl font-bold text-white">{model.gender}</div>
              </div>
              <div className="bg-brand-surface border border-white/5 p-4 rounded-xl text-center hover:border-brand-primary/30 transition-colors">
                <div className="text-xs text-brand-muted uppercase tracking-widest mb-1">Skin Tone</div>
                <div className="text-2xl font-bold text-white">{model.skinTone}</div>
              </div>
              <div className="bg-brand-surface border border-white/5 p-4 rounded-xl text-center hover:border-brand-primary/30 transition-colors">
                <div className="text-xs text-brand-muted uppercase tracking-widest mb-1">Views</div>
                <div className="text-2xl font-bold text-brand-primary">{model.views}</div>
              </div>
            </div>

            {/* Content Tabs */}
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                  <span className="w-1 h-6 bg-brand-primary mr-3 rounded-full"></span>
                  Specialties
                </h3>
                <div className="flex flex-wrap gap-3">
                  {model.categories.map(cat => (
                    <span key={cat} className="px-4 py-2 bg-brand-surface border border-white/10 text-white text-sm rounded-lg hover:border-brand-primary/50 transition-colors cursor-default">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>

               {model.bio && (
                <div>
                   <h3 className="text-xl font-bold text-white mb-4">About</h3>
                   <p className="text-brand-muted leading-relaxed">
                     {model.bio}
                   </p>
                </div>
               )}
            </div>
          </div>
        </div>

        {/* Video Reel Section - Only shows if video is available */}
        {videoEmbedUrl && (
            <div className="mt-20">
               <h2 className="text-3xl font-bold text-white mb-8 flex items-center">
                   <PlayCircle className="w-8 h-8 mr-3 text-red-500" /> Featured Video
               </h2>
               <div className="w-full max-w-4xl mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 aspect-video">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src={videoEmbedUrl} 
                    title="YouTube video player" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                  ></iframe>
               </div>
            </div>
        )}

        {/* Portfolio Gallery */}
        <div className="mt-20">
           <h2 className="text-3xl font-bold text-white mb-8">Visual Portfolio</h2>
           {model.media?.images?.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
                {model.media?.images?.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => img && setFullscreenImage({ src: img, alt: `${model.displayName} portfolio ${idx + 1}` })}
                    className="relative group overflow-hidden rounded-2xl cursor-pointer bg-brand-surface text-left"
                    aria-label={`Open portfolio image ${idx + 1} fullscreen`}
                  >
                    {img ? (
                         <OptimizedImage src={img} variant="gallery" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Portfolio" />
                    ) : (
                         <div className="w-full h-full flex items-center justify-center text-brand-muted">
                             No Image
                         </div>
                    )}
                     <div className="absolute inset-0 bg-black/0 group-hover:bg-white/10 transition-colors"></div>
                  </button>
                ))}
             </div>
           ) : (
             <div className="text-center py-10 text-brand-muted border border-white/10 rounded-xl border-dashed">
                <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No portfolio images uploaded yet.
             </div>
           )}
        </div>
      </div>

      {fullscreenImage && (
        <div className="fixed inset-0 z-[90] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <button
            type="button"
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close fullscreen image"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={fullscreenImage.src}
            alt={fullscreenImage.alt}
            className="max-w-full max-h-full object-contain"
            decoding="async"
          />
        </div>
      )}
    </div>
  );
};

export default Profile;
