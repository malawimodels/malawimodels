
import React from 'react';
import { UserData } from '../types';
import { Building, Star, Users, CheckCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import OptimizedImage from './OptimizedImage';

interface AgencyCardProps {
  agency: UserData;
  modelCount: number;
  avgModelRating: number;
  calculatedScore: number;
  rankIndex: number;
}

const AgencyCard: React.FC<AgencyCardProps> = ({ agency, modelCount, avgModelRating, calculatedScore, rankIndex }) => {
  const isTopRated = rankIndex < 3 && avgModelRating > 4.0;
  const isPopular = modelCount > 10;

  return (
    <div className="group relative w-full bg-brand-surface rounded-xl border border-white/5 overflow-hidden transition-all duration-300 hover:border-brand-primary/50 hover:shadow-2xl">
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
            <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
              {agency.photoUrl ? (
                <OptimizedImage src={agency.photoUrl} variant="avatar" alt={agency.displayName} className="w-full h-full object-cover" />
              ) : (
                <Building className="w-8 h-8 text-brand-muted m-auto h-full" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-white flex items-center" title={agency.displayName}>
                <span className="truncate">{agency.displayName || 'Agency'}</span>
                {agency.verified && <CheckCircle className="w-4 h-4 text-blue-500 ml-2 fill-blue-500/10 flex-shrink-0" />}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {isTopRated && (
                  <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] font-bold uppercase rounded border border-yellow-500/20 whitespace-nowrap">
                    Top Rated
                  </span>
                )}
                {isPopular && (
                  <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase rounded border border-purple-500/20 whitespace-nowrap">
                    Popular
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
             <div className="flex items-center justify-end text-brand-primary font-bold text-lg">
                <Star className="w-4 h-4 fill-current mr-1" />
                {avgModelRating > 0 ? avgModelRating.toFixed(1) : '-'}
             </div>
             <div className="text-[10px] text-brand-muted uppercase tracking-wider">Model Quality</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 border-t border-white/5 pt-4">
           <div className="text-center">
              <div className="text-2xl font-bold text-white">{modelCount}</div>
              <div className="text-[10px] text-brand-muted uppercase flex items-center justify-center">
                 <Users className="w-3 h-3 mr-1" /> Models
              </div>
           </div>
           <div className="text-center border-l border-white/5">
              <div className="text-2xl font-bold text-green-400">
                 {calculatedScore > 0 ? Math.round(calculatedScore) : '-'}
              </div>
              <div className="text-[10px] text-brand-muted uppercase">Agency Score</div>
           </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
           {agency.gallery?.slice(0, 3).map((img, idx) => (
              <div key={idx} className="h-12 w-12 rounded-lg bg-black/40 border border-white/5 overflow-hidden">
                 <OptimizedImage src={img} variant="avatar" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={`Agency gallery ${idx + 1}`} />
              </div>
           ))}
           {agency.gallery && agency.gallery.length > 3 && (
              <div className="h-12 w-12 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-xs text-brand-muted font-bold">
                 +{agency.gallery.length - 3}
              </div>
           )}
        </div>

        <Link 
          to={`/agency/${agency.uid}`}
          className="w-full flex items-center justify-center py-3 bg-white/5 hover:bg-white/10 text-white font-bold text-sm rounded-lg transition-colors group-hover:bg-brand-primary group-hover:text-white"
        >
          View Agency Profile <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>
    </div>
  );
};

export default AgencyCard;
