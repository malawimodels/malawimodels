
import React, { useState, useEffect, useRef } from 'react';
import { ModelProfile, Category, District, Gender, SkinTone } from '../types';
import { subscribeToSearchModels } from '../services/supabase.service';
import { useAuth } from '../auth/AuthContext';
import { Link } from 'react-router-dom';
import ModelCard from '../components/ModelCard';
import { Search, Sparkles, ChevronDown, Lock } from 'lucide-react';

const Home: React.FC = () => {
  const { role, user, loading: authLoading } = useAuth();
  const LOGGED_IN_PAGE_SIZE = 12;
  
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMoreModels, setHasMoreModels] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(LOGGED_IN_PAGE_SIZE);
  
  // Filters State
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [selectedSkinTone, setSelectedSkinTone] = useState<string>('');
  
  const heroRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const isGuest = !user;

  useEffect(() => {
    setVisibleLimit(LOGGED_IN_PAGE_SIZE);
  }, [selectedCategory, selectedDistrict, selectedGender, selectedSkinTone, isGuest]);

  useEffect(() => {
    setLoading(true);
    
    // Guest Restriction: Only fetch if we are allowed or if it's the limited query
    // We reuse the subscription but process results differently based on auth
    const unsubscribe = subscribeToSearchModels({
        categories: isGuest ? [] : (selectedCategory ? [selectedCategory as Category] : []),
        locations: isGuest ? [] : (selectedDistrict ? [selectedDistrict as District] : []),
        minHeight: 0,
        maxHeight: 300,
        gender: isGuest ? null : (selectedGender ? (selectedGender as Gender) : null),
        skinTones: isGuest ? [] : (selectedSkinTone ? [selectedSkinTone as SkinTone] : []),
        onlyAvailable: false,
        page: 0,
        limit: isGuest ? 10 : visibleLimit
    }, (results, meta) => {
        if (isGuest) {
            // GUEST LOGIC: Top 10 Rated Only
            const topRated = [...results]
                .sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0))
                .slice(0, 10);
            setModels(topRated);
            setHasMoreModels(false);
        } else {
            // LOGGED IN: Full Results
            setModels(results);
            setHasMoreModels(Boolean(meta?.hasMore));
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedCategory, selectedDistrict, selectedGender, selectedSkinTone, isGuest, visibleLimit]);

  useEffect(() => {
    if (isGuest || !hasMoreModels || loading) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleLimit((current) => current + LOGGED_IN_PAGE_SIZE);
      }
    }, { rootMargin: '400px 0px' });

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreModels, isGuest, loading]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* HERO SECTION - Immersive Search */}
      <div ref={heroRef} className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center filter brightness-[0.4] scale-105 animate-[zoom-in_20s_infinite_alternate]"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-brand-bg via-brand-bg/50 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-5xl w-full px-4 sm:px-6 flex flex-col items-center text-center animate-fade-in">
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-brand-primary/30 bg-brand-primary/10 text-brand-primary text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md">
            <Sparkles className="w-3 h-3 mr-2" /> Premier Talent Directory
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight leading-tight">
            Find the Perfect <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-orange-200">Face for Your Brand</span>
          </h1>
          
          {isGuest ? (
             /* GUEST VIEW - Locked Search */
             <div className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl animate-slide-up flex flex-col items-center">
                 <Lock className="w-8 h-8 text-brand-primary mb-3" />
                 <h3 className="text-xl font-bold text-white mb-2">Exclusive Talent Database</h3>
                 <p className="text-brand-muted mb-6">Sign in to search, filter, and view our complete roster of verified models.</p>
                 <div className="flex gap-4 w-full">
                     <Link to="/register" state={{ isLogin: false }} className="flex-1 py-3 bg-brand-primary hover:bg-brand-accent text-white font-bold rounded-xl transition-colors text-center">
                        Sign Up Free
                     </Link>
                     <Link to="/register" state={{ isLogin: true }} className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors text-center">
                        Login
                     </Link>
                 </div>
             </div>
          ) : (
             /* LOGGED IN - Active Search */
             <div className="w-full max-w-4xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl animate-slide-up">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                     <select
                      className="block w-full px-4 py-3 border border-white/10 rounded-xl bg-brand-bg/50 text-white appearance-none focus:outline-none focus:border-brand-primary"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                     >
                       <option value="">Any Category</option>
                       {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                     </select>
                     <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-brand-muted pointer-events-none" />
                  </div>

                  <div className="relative">
                     <select
                      className="block w-full px-4 py-3 border border-white/10 rounded-xl bg-brand-bg/50 text-white appearance-none focus:outline-none focus:border-brand-primary"
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                     >
                       <option value="">Any Location</option>
                       {Object.values(District).map(dist => <option key={dist} value={dist}>{dist}</option>)}
                     </select>
                     <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-brand-muted pointer-events-none" />
                  </div>

                   <div className="relative">
                     <select
                      className="block w-full px-4 py-3 border border-white/10 rounded-xl bg-brand-bg/50 text-white appearance-none focus:outline-none focus:border-brand-primary"
                      value={selectedGender}
                      onChange={(e) => setSelectedGender(e.target.value)}
                     >
                       <option value="">Any Gender</option>
                       {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                     </select>
                     <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-brand-muted pointer-events-none" />
                  </div>

                  <div className="flex items-center justify-center text-xs font-bold text-brand-muted uppercase tracking-wide">
                     Live Results
                  </div>
                </div>
             </div>
          )}
        </div>
      </div>

      {/* RESULTS GRID */}
      <div className="flex-grow bg-brand-bg relative z-10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-3xl font-bold text-white">
                {isGuest ? "Top Rated Talent" : "Featured Talent"}
            </h2>
            <p className="text-brand-muted text-sm">
                {isGuest ? "Displaying Top 10" : `${models.length} profiles matched`}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-[3/4] bg-brand-surface rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : models.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {models.map(model => (
                <ModelCard key={model.uid} model={model} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-brand-surface/30 rounded-2xl border border-white/5 border-dashed">
              <h3 className="text-xl font-bold text-white mb-2">No models found</h3>
              <p className="text-brand-muted">Try broadening your filters.</p>
            </div>
          )}

            {!isGuest && models.length > 0 && (
              <div ref={loadMoreRef} className="mt-10 flex justify-center">
                {hasMoreModels ? (
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((current) => current + LOGGED_IN_PAGE_SIZE)}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-lg transition-colors"
                  >
                    Load More Talent
                  </button>
                ) : (
                  <span className="text-sm text-brand-muted">All matching talent loaded</span>
                )}
              </div>
            )}
          
          {isGuest && (
              <div className="mt-12 text-center">
                  <div className="inline-block p-6 bg-brand-surface border border-white/10 rounded-2xl max-w-2xl">
                      <Lock className="w-8 h-8 text-brand-primary mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-white mb-2">Want to see more?</h3>
                      <p className="text-brand-muted mb-6">Join Malawi's fastest growing talent network to access unlimited profiles, filtering, and direct booking.</p>
                      <Link to="/register" state={{ isLogin: false }} className="px-8 py-3 bg-brand-primary hover:bg-brand-accent text-white font-bold rounded-lg transition-colors inline-block">
                          Register Now
                      </Link>
                  </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
