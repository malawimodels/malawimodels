
import React, { useState, useEffect } from 'react';
import { getAgencies, getAllUsers, getModelProfile } from '../services/supabase.service';
import { supabase } from '../supabase';
import { UserData, UserRole, ModelProfile, AgencySortOption } from '../types';
import { Search, Filter, ArrowUpDown, Building, Users, Star, Info } from 'lucide-react';
import AgencyCard from '../components/AgencyCard';

interface AgencyWithStats extends UserData {
  modelCount: number;
  avgModelRating: number;
  score: number;
  models: ModelProfile[];
}

const Agencies: React.FC = () => {
  const [agencies, setAgencies] = useState<AgencyWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<AgencySortOption>('highest_rated');

  useEffect(() => {
    const fetchAgenciesAndStats = async () => {
      setLoading(true);
      try {
        // 1. Fetch all agencies
        const agencyUsers = await getAgencies();

        // 2. Fetch all models (for calculation)
        // Get all models that belong to an agency
        const { data: modelsData, error: modelsError } = await supabase
          .from('models')
          .select('*')
          .not('agency_id', 'is', null);

        if (modelsError) {
          console.error('Error fetching models:', modelsError);
          setLoading(false);
          return;
        }

        const allModels = modelsData.map((m: any) => ({
          uid: m.id,
          agencyId: m.agency_id,
          agencyName: m.agency_name,
          displayName: '', // Will be filled from user data
          averageRating: 0, // Will be filled from user data
        })) as any[];

        // 3. Fetch user ratings for these models to calculate average
        // (ModelProfile contains basic info, UserData contains the actual rating stats)
        // We'll optimistically use the models we have and try to map ratings if available in model object
        // NOTE: The getModelProfile merger logic puts averageRating onto the returned object. 
        // We need to do that for batch models. 
        // For simplicity and performance in this "Add Only" task without creating new indexes:
        // We will fetch UserData for all users to get ratings.
        const allUsers = await getAllUsers();
        const userMap = new Map(allUsers.map(u => [u.uid, u]));

        // 4. Calculate Stats per Agency
        const enhancedAgencies = agencyUsers.map(agency => {
          const agencyModels = allModels.filter(m => m.agencyId === agency.uid);
          
          // Calculate Average Rating weighted by validity
          let totalRating = 0;
          let ratedCount = 0;

          agencyModels.forEach(m => {
            const uData = userMap.get(m.uid);
            if (uData && uData.averageRating && uData.averageRating > 0) {
              totalRating += uData.averageRating;
              ratedCount++;
            }
          });

          const avgRating = ratedCount > 0 ? totalRating / ratedCount : 0;
          const count = agencyModels.length;

          // --- RANKING LOGIC (Part 2) ---
          // Formula: (Quality * 70%) + (Quantity Log * 30%)
          // Quality: 0-5 stars mapped to 0-100
          // Quantity: Log scale to prevent massive agencies dominating purely on size
          const qualityScore = (avgRating / 5) * 100; 
          const quantityScore = Math.min(Math.log2(count + 1) * 20, 100); // Cap effect of size
          
          // Weighted Score
          // If no rated models, penalty applies
          const baseScore = (qualityScore * 0.7) + (quantityScore * 0.3);
          const score = ratedCount === 0 && count > 0 ? baseScore * 0.5 : baseScore; // Penalty for unrated roster

          return {
            ...agency,
            modelCount: count,
            avgModelRating: avgRating,
            score: score,
            models: agencyModels
          };
        });

        setAgencies(enhancedAgencies);
      } catch (error) {
        console.error("Error fetching agencies", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgenciesAndStats();
  }, []);

  const filteredAndSortedAgencies = agencies
    .filter(a => a.displayName?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'popularity') return b.modelCount - a.modelCount; // Simple popularity by size
      if (sortBy === 'highest_rated') return b.score - a.score; // Our weighted logic
      if (sortBy === 'most_models') return b.modelCount - a.modelCount;
      return 0;
    });

  return (
    <div className="min-h-screen bg-brand-bg px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 border-b border-white/10 pb-6 gap-6">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full border border-brand-primary/30 bg-brand-primary/10 text-brand-primary text-xs font-bold uppercase tracking-widest mb-3">
              <Building className="w-3 h-3 mr-2" /> Verified Partners
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Modeling Agencies</h1>
            <p className="text-brand-muted max-w-xl">
              Discover top-rated agencies in Malawi. Ranked by talent quality and professional reputation.
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative flex-grow">
              <input 
                type="text" 
                placeholder="Search agencies..." 
                className="w-full bg-brand-surface border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-brand-primary focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3.5 text-brand-muted w-5 h-5" />
            </div>
            
            <div className="relative min-w-[180px]">
              <select 
                className="w-full bg-brand-surface border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white focus:border-brand-primary focus:outline-none appearance-none cursor-pointer"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as AgencySortOption)}
              >
                <option value="highest_rated">Highest Rated</option>
                <option value="popularity">Most Popular</option>
                <option value="most_models">Largest Roster</option>
              </select>
              <ArrowUpDown className="absolute right-3 top-3.5 text-brand-muted w-4 h-4 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Ranking Explanation */}
        <div className="mb-8 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
           <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
           <div className="text-sm text-brand-muted">
             <span className="text-blue-400 font-bold">How we rank:</span> Agencies are ranked primarily by the <span className="text-white">quality ratings</span> of their models, ensuring that boutique agencies with high-performing talent get the visibility they deserve, regardless of size.
           </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-brand-surface rounded-xl border border-white/5 animate-pulse"></div>
            ))}
          </div>
        ) : filteredAndSortedAgencies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedAgencies.map((agency, index) => (
              <AgencyCard 
                key={agency.uid} 
                agency={agency}
                modelCount={agency.modelCount}
                avgModelRating={agency.avgModelRating}
                calculatedScore={agency.score}
                rankIndex={index}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-brand-surface rounded-2xl border border-white/5 border-dashed">
            <Building className="w-12 h-12 text-brand-muted mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">No agencies found</h3>
            <p className="text-brand-muted">Try adjusting your search terms.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Agencies;
