
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { createUserProfile, enforceRateLimit, getUserRole } from '../services/supabase.service';
import { UserRole } from '../types';
import { useAuth } from '../auth/AuthContext';
import { Sparkles, User, Mail, Lock, Briefcase, Camera, LogIn } from 'lucide-react';
import { useNotification } from '../components/NotificationSystem';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshRole, user } = useAuth();
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: UserRole.MODEL 
  });
  
  // Set initial state based on navigation state (from Home page buttons)
  useEffect(() => {
    if (location.state && typeof location.state.isLogin === 'boolean') {
      setIsLogin(location.state.isLogin);
    }
  }, [location.state]);

  useEffect(() => {
    const href = window.location.href;
    if (href.includes('type=recovery') || href.includes('reset=1')) {
      setIsPasswordRecovery(true);
      setIsLogin(true);
    }
  }, []);

  // Optional: Redirect if already logged in, but allowing manual auth for now
  useEffect(() => {
    if (user && !loading) {
       // logic can be expanded here if we want to auto-redirect users visiting /register while logged in
    }
  }, [user, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const email = formData.email.trim();
    const displayName = formData.name.trim();

    if (!isLogin && !displayName) {
      addNotification('error', 'Please enter your name or company name.');
      return;
    }

    if (formData.password.length < 6) {
      addNotification('error', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    
    try {
      if (isPasswordRecovery) {
        const { error } = await supabase.auth.updateUser({
          password: formData.password,
        });

        if (error) throw error;
        addNotification('success', 'Password updated successfully. Please log in with your new password.');
        await supabase.auth.signOut();
        setIsPasswordRecovery(false);
        setIsLogin(true);
        setFormData(prev => ({ ...prev, password: '' }));
        navigate('/register', { replace: true, state: { isLogin: true } });
        return;
      }

      if (isLogin) {
        // --- LOGIN LOGIC ---
        await enforceRateLimit('login_attempt', email, 8, 900);

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: formData.password,
        });

        if (error) throw error;
        if (!data.user) throw new Error('No user returned');
        
        // Force refresh the role in AuthContext so the UI updates immediately
        await refreshRole();
        
        // Get the specific role to decide where to navigate
        const fetchedRole = await getUserRole(data.user.id);
        
        addNotification('success', `Welcome back!`);

        if (fetchedRole === UserRole.MODEL) {
          navigate('/dashboard');
        } else if (fetchedRole === UserRole.AGENCY) {
          navigate('/agency-dashboard');
        } else if (fetchedRole === UserRole.CLIENT) {
          navigate('/client-dashboard');
        } else if (fetchedRole === UserRole.ADMIN) {
          navigate('/admin');
        } else {
          navigate('/');
        }
      } else {
        // --- REGISTER LOGIC ---
        const { data, error } = await supabase.auth.signUp({
          email,
          password: formData.password,
          options: {
            data: {
              display_name: displayName,
              role: formData.role,
            },
          },
        });

        if (error) throw error;
        if (!data.user) throw new Error('No user returned');

        // Create user profile in Supabase database
        await createUserProfile(data.user.id, data.user.email || email, formData.role, displayName);

        // Refresh role context
        await refreshRole();
        
        addNotification('success', 'Account created successfully!');

        if (formData.role === UserRole.MODEL) {
          navigate('/dashboard');
        } else if (formData.role === UserRole.AGENCY) {
          navigate('/agency-dashboard');
        } else if (formData.role === UserRole.CLIENT) {
          navigate('/client-dashboard');
        } else {
          navigate('/');
        }
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'An error occurred';
      if (msg.includes('already registered')) msg = "That email is already registered.";
      if (msg.includes('Invalid login')) msg = "Invalid email or password.";
      if (msg.includes('Email not confirmed')) msg = "Please check your email to confirm your account.";
      
      addNotification('error', msg);
      setLoading(false);
    }
  };

  const handlePasswordResetRequest = async () => {
    const email = formData.email.trim();
    if (!email) {
      addNotification('error', 'Enter your email address first.');
      return;
    }

    setLoading(true);
    try {
      await enforceRateLimit('password_reset', email, 3, 3600);
      const redirectTo = `${window.location.origin}${window.location.pathname}#/register?reset=1`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setResetSent(true);
      addNotification('success', 'Password reset link sent. Check your email.');
    } catch (err: any) {
      addNotification('error', err.message || 'Failed to send password reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-lg bg-brand-surface border border-white/10 rounded-2xl shadow-2xl relative z-10 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-primary to-orange-500 mb-4 shadow-lg shadow-brand-primary/30">
            {isLogin ? <LogIn className="w-6 h-6 text-white" /> : <Sparkles className="w-6 h-6 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isPasswordRecovery ? "Set New Password" : isLogin ? "Welcome Back" : "Join Malawi Models"}
          </h1>
          <p className="text-brand-muted mt-2 text-sm">
            {isPasswordRecovery ? "Enter a new password for your account." : isLogin ? "Enter your credentials to access your dashboard." : "Create an account to get started."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Role Selection - Only for Registration */}
          {!isLogin && (
            <div className="grid grid-cols-2 gap-4">
              <button 
                type="button"
                className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group ${formData.role === UserRole.MODEL ? 'bg-brand-primary/10 border-brand-primary' : 'bg-black/20 border-white/10 hover:border-white/30'}`}
                onClick={() => setFormData({...formData, role: UserRole.MODEL})}
              >
                <Camera className={`w-6 h-6 mb-2 ${formData.role === UserRole.MODEL ? 'text-brand-primary' : 'text-brand-muted'}`} />
                <h3 className={`font-bold ${formData.role === UserRole.MODEL ? 'text-white' : 'text-brand-muted'}`}>As Talent</h3>
                <p className="text-[10px] text-brand-muted mt-1">Models, Actors, Dancers</p>
              </button>

              <button 
                type="button"
                className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group ${formData.role === UserRole.CLIENT ? 'bg-brand-primary/10 border-brand-primary' : 'bg-black/20 border-white/10 hover:border-white/30'}`}
                onClick={() => setFormData({...formData, role: UserRole.CLIENT})}
              >
                <Briefcase className={`w-6 h-6 mb-2 ${formData.role === UserRole.CLIENT ? 'text-brand-primary' : 'text-brand-muted'}`} />
                <h3 className={`font-bold ${formData.role === UserRole.CLIENT ? 'text-white' : 'text-brand-muted'}`}>As Client</h3>
                <p className="text-[10px] text-brand-muted mt-1">Agencies, Companies</p>
              </button>
            </div>
          )}

          {resetSent && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              Reset link sent. Open the link from your email to choose a new password.
            </div>
          )}

          <div className="space-y-4">
            {/* Name - Only for Registration */}
            {!isLogin && (
              <div className="relative group animate-slide-up">
                 <User className="absolute left-3 top-3.5 w-5 h-5 text-brand-muted group-focus-within:text-brand-primary transition-colors" />
                 <input 
                   type="text" 
                   placeholder="Full Name / Company Name"
                   required={!isLogin}
                   className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-primary transition-colors"
                   value={formData.name}
                   onChange={(e) => setFormData({...formData, name: e.target.value})}
                 />
              </div>
            )}
            
            <div className="relative group">
               <Mail className="absolute left-3 top-3.5 w-5 h-5 text-brand-muted group-focus-within:text-brand-primary transition-colors" />
               <input 
                 type="email" 
                 placeholder="Email Address"
                 required={!isPasswordRecovery}
                 disabled={isPasswordRecovery}
                 className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-primary transition-colors disabled:opacity-60"
                 value={formData.email}
                 onChange={(e) => setFormData({...formData, email: e.target.value})}
               />
            </div>

            <div className="relative group">
               <Lock className="absolute left-3 top-3.5 w-5 h-5 text-brand-muted group-focus-within:text-brand-primary transition-colors" />
               <input 
                 type="password" 
                 placeholder="Password"
                 required
                 minLength={6}
                 className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-primary transition-colors"
                 value={formData.password}
                 onChange={(e) => setFormData({...formData, password: e.target.value})}
               />
            </div>
          </div>

          {isLogin && !isPasswordRecovery && (
            <button
              type="button"
              onClick={handlePasswordResetRequest}
              disabled={loading}
              className="text-xs text-brand-primary hover:text-brand-accent transition-colors"
            >
              Forgot password?
            </button>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-accent text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-brand-primary/25 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
             {loading ? (
               <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
             ) : (
               isPasswordRecovery ? "Update Password" : isLogin ? "Sign In" : "Create Account"
             )}
          </button>
        </form>

        <div className="mt-6 text-center pt-6 border-t border-white/5">
          <p className="text-brand-muted text-sm">
            {isPasswordRecovery ? "Remember your password?" : isLogin ? "Don't have an account?" : "Already have an account?"}
            <button 
              onClick={() => {
                setIsPasswordRecovery(false);
                setIsLogin(!isLogin);
              }}
              className="ml-2 text-brand-primary hover:text-brand-accent font-bold transition-colors"
            >
              {isPasswordRecovery ? "Sign In" : isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
