
import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ShortlistContext } from '../App';
import { UserRole } from '../types';
import { Menu, X, User, LogOut, Sparkles, PlusCircle, Shield, Building } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, user, logout } = useAuth();
  const { shortlist } = useContext(ShortlistContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Scroll reset on route change to fix mobile navigation issues
    window.scrollTo(0, 0);
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  const isHome = location.pathname === '/';
  const isAuthPage = location.pathname === '/register';
  const isClient = role === UserRole.CLIENT;
  const isTalent = role === UserRole.MODEL || role === UserRole.AGENCY;
  
  const isAdmin = role === UserRole.ADMIN;

  // Determine Logo Link destination based on role
  const logoLink = isTalent ? '/dashboard' : '/';

  if (isAuthPage) {
    return <div className="min-h-screen bg-brand-bg text-brand-text font-sans overflow-x-hidden">{children}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg text-brand-text font-sans overflow-x-hidden w-full">
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 w-full ${
          scrolled || !isHome 
            ? 'bg-brand-bg/95 backdrop-blur-md border-b border-white/10 shadow-lg py-3' 
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center cursor-pointer group" onClick={() => navigate(logoLink)}>
              <div className="w-10 h-10 bg-gradient-to-tr from-brand-primary to-orange-400 rounded-xl flex items-center justify-center mr-3 shadow-[0_0_15px_rgba(245,158,11,0.3)] flex-shrink-0">
                <span className="text-white font-bold text-xl tracking-tighter">M</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl tracking-tight text-white leading-none">
                  MALAWI<span className="text-brand-primary">MODELS</span>
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-brand-muted">Directory</span>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              
              {/* Only Guests and Clients see Search */}
              {!isTalent && (
                <Link to="/" className="text-sm font-medium text-brand-muted hover:text-white transition-colors uppercase tracking-wide">
                  Talent Search
                </Link>
              )}

              {/* Agencies Discovery Link */}
              <Link to="/agencies" className="text-sm font-medium text-brand-muted hover:text-white transition-colors uppercase tracking-wide">
                Agencies
              </Link>
              
              {/* Client Specific Links */}
              {isClient && (
                 <>
                   <Link to="/client-dashboard" className="text-sm font-bold text-white transition-colors uppercase tracking-wide">
                     Client Portal
                   </Link>
                   <Link to="/casting" className="text-sm font-medium text-brand-muted hover:text-white transition-colors uppercase tracking-wide flex items-center">
                     <PlusCircle className="w-4 h-4 mr-1.5" /> Start Project
                   </Link>
                 </>
              )}

              {/* Admin Link - Only for specific email */}
              {isAdmin && (
                <Link to="/admin" className="text-sm font-bold text-red-500 hover:text-red-400 transition-colors uppercase tracking-wide flex items-center bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                  <Shield className="w-4 h-4 mr-1.5" /> Admin
                </Link>
              )}
              
              {/* Common Shortlist for non-talent */}
              {!isTalent && (
                   <Link to="/shortlist" className="relative text-sm font-medium text-brand-muted hover:text-white transition-colors uppercase tracking-wide group">
                     Shortlist
                     {shortlist.length > 0 && (
                       <span className="absolute -top-3 -right-4 bg-brand-primary text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md animate-pulse">
                         {shortlist.length}
                       </span>
                     )}
                   </Link>
              )}
              
              {/* Talent Specific Links */}
              {isTalent && (
                <Link to="/dashboard" className="text-sm font-bold text-white transition-colors uppercase tracking-wide">
                  My Dashboard
                </Link>
              )}

              <div className="w-px h-6 bg-white/10 mx-2"></div>

              {!user ? (
                <div className="flex items-center space-x-3">
                  <Link to="/register" className="px-5 py-2 bg-brand-primary hover:bg-brand-accent text-white text-xs font-bold uppercase tracking-wider rounded-full transition-all shadow-lg hover:shadow-brand-primary/25">
                    Sign Up / Login
                  </Link>
                </div>
              ) : (
                <div className="relative group h-full flex items-center">
                  <button className="flex items-center space-x-2 text-xs font-semibold px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all backdrop-blur-sm">
                    <span>{role.toUpperCase()}</span>
                    <User className="w-3 h-3" />
                  </button>
                  {/* Dropdown with larger padding bridge to prevent hover loss */}
                  <div className="absolute right-0 top-full pt-4 w-48 hidden group-hover:block z-[60]">
                    <div className="bg-brand-surface border border-white/10 rounded-xl shadow-2xl py-2 backdrop-blur-xl">
                      <div className="px-4 py-2 border-b border-white/5 text-xs text-brand-muted truncate">
                         {user.email}
                      </div>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 flex items-center">
                        <LogOut className="w-4 h-4 mr-2" /> Logout
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
             <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-white hover:text-brand-primary focus:outline-none transition-colors"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden bg-brand-surface border-t border-white/10 absolute top-full left-0 right-0 shadow-2xl">
            <div className="px-4 pt-4 pb-6 space-y-2">
               
               {isAdmin && (
                  <Link to="/admin" className="block px-3 py-3 rounded-lg text-base font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20" onClick={() => setIsMenuOpen(false)}>Admin Dashboard</Link>
               )}

               {!isTalent && (
                  <Link to="/" className="block px-3 py-3 rounded-lg text-base font-medium text-brand-text hover:bg-white/5 hover:text-brand-primary" onClick={() => setIsMenuOpen(false)}>Talent Search</Link>
               )}

               <Link to="/agencies" className="block px-3 py-3 rounded-lg text-base font-medium text-brand-text hover:bg-white/5 hover:text-brand-primary" onClick={() => setIsMenuOpen(false)}>Agencies</Link>

               {isClient && (
                  <Link to="/client-dashboard" className="block px-3 py-3 rounded-lg text-base font-bold text-brand-primary hover:bg-white/5" onClick={() => setIsMenuOpen(false)}>Client Portal</Link>
               )}
               {isTalent && (
                  <Link to="/dashboard" className="block px-3 py-3 rounded-lg text-base font-bold text-brand-primary hover:bg-white/5" onClick={() => setIsMenuOpen(false)}>My Dashboard</Link>
               )}
               {!user && (
                 <Link to="/register" className="block px-3 py-3 rounded-lg text-base font-medium text-white bg-brand-primary/10 border border-brand-primary/50 text-center mt-4" onClick={() => setIsMenuOpen(false)}>
                   Join Now
                 </Link>
               )}
               {user && (
                 <button onClick={handleLogout} className="w-full text-left px-3 py-3 text-base text-red-500 hover:bg-white/5">Logout</button>
               )}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content Area - Added padding top to account for fixed header on non-home pages */}
      <main className={`flex-grow w-full ${isHome ? 'pt-0' : 'pt-24 md:pt-28'}`}>
        {children}
      </main>

      <footer className="bg-brand-bg border-t border-white/5 py-16 relative overflow-hidden w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center mb-6">
                 <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center mr-2 flex-shrink-0">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <span className="font-bold text-xl text-white">
                  MALAWI<span className="text-brand-primary">MODELS</span>
                </span>
              </div>
              <p className="text-sm text-brand-muted leading-relaxed mb-6">
                The definitive digital directory for Malawi's fashion and entertainment industry. 
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-6 uppercase tracking-wider text-xs">Platform</h3>
              <ul className="space-y-4 text-sm text-brand-muted">
                {!isTalent && <li><Link to="/" className="hover:text-brand-primary transition-colors">Talent Search</Link></li>}
                <li><Link to="/agencies" className="hover:text-brand-primary transition-colors">Agencies</Link></li>
                {isTalent && <li><Link to="/dashboard" className="hover:text-brand-primary transition-colors">My Dashboard</Link></li>}
                {!isTalent && <li><Link to="/shortlist" className="hover:text-brand-primary transition-colors">My Shortlist</Link></li>}
              </ul>
            </div>
             <div>
              <h3 className="text-white font-semibold mb-6 uppercase tracking-wider text-xs">Support</h3>
              <ul className="space-y-4 text-sm text-brand-muted">
                <li><Link to="/help" className="hover:text-brand-primary transition-colors">Help Center</Link></li>
                <li><Link to="/safety" className="hover:text-brand-primary transition-colors">Safety & Trust</Link></li>
                <li><Link to="/contact" className="hover:text-brand-primary transition-colors">Contact Us</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-6 uppercase tracking-wider text-xs">Stay Updated</h3>
              <div className="flex">
                <input type="email" placeholder="Email Address" className="bg-white/5 border border-white/10 rounded-l-md px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-primary w-full" />
                <button className="bg-brand-primary hover:bg-brand-accent text-white px-4 py-2 rounded-r-md transition-colors">
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
