
import React, { useContext } from 'react';
import { ModelProfile } from '../types';
import { Link } from 'react-router-dom';
import { Heart, MapPin, CheckCircle, ArrowRight, Building, Star } from 'lucide-react';
import { ShortlistContext } from '../App';
import OptimizedImage from './OptimizedImage';

interface ModelCardProps {
  model: ModelProfile;
}

const ModelCard: React.FC<ModelCardProps> = ({ model }) => {
  const { shortlist, toggleShortlist } = useContext(ShortlistContext);
  
  const isShortlisted = shortlist.includes(model.uid);
  const imageSrc = model.media?.images?.[0] || 'https://via.placeholder.com/400x600?text=No+Image';

  return (
    <div className="group relative w-full break-inside-avoid mb-6">
      <div className="relative overflow-hidden rounded-xl bg-brand-surface shadow-2xl border border-white/5 transition-all duration-500 hover:border-brand-primary/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]">
        
        <div className="relative aspect-[3/4] overflow-hidden">
          <OptimizedImage
            src={imageSrc} 
            alt={model.displayName} 
            variant="card"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 filter brightness-[0.95] group-hover:brightness-100"
            loading="lazy"
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-300"></div>

          {model.availability && (
            <div className="absolute top-4 left-4 flex items-center space-x-2">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </div>
            </div>
          )}

          <div className="absolute top-4 right-4 translate-x-12 group-hover:translate-x-0 transition-transform duration-300">
             <button 
              onClick={(e) => {
                e.preventDefault();
                toggleShortlist(model.uid);
              }}
              className={`p-3 rounded-full backdrop-blur-md border border-white/10 shadow-lg transition-all hover:scale-110 ${
                isShortlisted 
                  ? 'bg-brand-primary text-white border-brand-primary' 
                  : 'bg-black/40 text-white hover:bg-brand-primary hover:border-brand-primary'
              }`}
            >
              <Heart className={`w-5 h-5 ${isShortlisted ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="absolute bottom-0 left-0 w-full p-5 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
             <div className="flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-bold text-white tracking-tight flex items-center">
                    {model.displayName}
                    {model.verified && (
                      <span title="Verified Talent">
                        <CheckCircle className="w-4 h-4 text-blue-500 ml-2 fill-blue-500/10" />
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center text-brand-muted text-xs uppercase tracking-widest mt-1">
                    <MapPin className="w-3 h-3 mr-1" />
                    {model.location}
                  </div>
                  {/* Agency Indicator */}
                  {model.agencyName && (
                    <div className="flex items-center text-xs text-brand-muted mt-1 font-medium">
                      <Building className="w-3 h-3 mr-1" />
                      Under {model.agencyName}
                    </div>
                  )}
                  {/* RATING DISPLAY */}
                    {model.averageRating ? (
                      <div className="flex items-center mt-2 bg-brand-primary/10 w-fit px-2 py-0.5 rounded backdrop-blur-sm">
                          <Star className="w-3 h-3 text-brand-primary fill-brand-primary mr-1" />
                        <span className="text-xs font-bold text-brand-primary">{model.averageRating.toFixed(1)}</span>
                        <span className="text-[10px] text-brand-muted ml-1">({model.reviewsCount})</span>
                      </div>
                  ) : null}
                </div>
             </div>

             <div className="h-0 group-hover:h-auto overflow-hidden transition-all duration-500 opacity-0 group-hover:opacity-100 mt-0 group-hover:mt-4">
                <div className="grid grid-cols-2 gap-4 text-center border-t border-white/20 pt-4 mb-4">
                  <div>
                    <span className="block text-[10px] text-brand-muted uppercase">Height</span>
                    <span className="block text-sm font-semibold text-white">{model.height}cm</span>
                  </div>
                  <div>
                     <span className="block text-[10px] text-brand-muted uppercase">Role</span>
                    <span className="block text-sm font-semibold text-white truncate">{model.categories[0]}</span>
                  </div>
                </div>
                <Link 
                  to={`/profile/${model.uid}`}
                  className="w-full flex items-center justify-center py-3 bg-white text-black font-bold text-sm rounded hover:bg-brand-primary hover:text-white transition-colors uppercase tracking-wide"
                >
                  View Portfolio <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelCard;
