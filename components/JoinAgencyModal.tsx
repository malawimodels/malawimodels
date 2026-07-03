
import React, { useState } from 'react';
import { X, Send, User, AlertCircle, CheckCircle } from 'lucide-react';
import { UserData, UserRole } from '../types';
import { useAuth } from '../auth/AuthContext';
import { applyToJoinAgency } from '../services/supabase.service';
import { useNotification } from './NotificationSystem';
import { useNavigate } from 'react-router-dom';
import OptimizedImage from './OptimizedImage';

interface JoinAgencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  agency: UserData;
}

const JoinAgencyModal: React.FC<JoinAgencyModalProps> = ({ isOpen, onClose, agency }) => {
  const { user, role } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const userPhoto = (user?.user_metadata?.avatar_url as string | undefined) || (user?.user_metadata?.picture as string | undefined);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!user) {
        navigate('/register');
        return;
    }
    
    if (role !== UserRole.MODEL) {
        addNotification('error', "Only models can apply to join agencies.");
        return;
    }

    setLoading(true);
    try {
        await applyToJoinAgency({
            agencyId: agency.uid,
            modelUid: user.uid,
            modelName: user.displayName || 'Applicant',
            modelPhoto: userPhoto,
            note: note,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        setSuccess(true);
        setTimeout(() => {
            onClose();
            setSuccess(false);
            setNote('');
        }, 2000);
    } catch (error) {
        console.error(error);
        addNotification('error', "Failed to submit application.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-brand-surface border border-white/10 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-brand-bg">
          <h3 className="text-xl font-bold text-white flex items-center">
             Join {agency.displayName}
          </h3>
          <button onClick={onClose} className="text-brand-muted hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
            {success ? (
                <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
                    <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                    <h4 className="text-xl font-bold text-white">Application Sent!</h4>
                    <p className="text-brand-muted mt-2">The agency will review your profile shortly.</p>
                </div>
            ) : !user ? (
                <div className="text-center py-6">
                    <AlertCircle className="w-12 h-12 text-brand-primary mx-auto mb-3" />
                    <p className="text-white font-bold mb-2">Login Required</p>
                    <p className="text-sm text-brand-muted mb-4">You need to have a model profile to apply.</p>
                    <button onClick={() => navigate('/register')} className="px-6 py-2 bg-brand-primary text-white rounded-lg font-bold">
                        Login / Sign Up
                    </button>
                </div>
            ) : role !== UserRole.MODEL ? (
                <div className="text-center py-6 text-red-400">
                    <p>Only registered models can apply to join agencies.</p>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="w-10 h-10 rounded-full bg-black overflow-hidden border border-white/10">
                            {userPhoto ? (
                                <OptimizedImage src={userPhoto} variant="avatar" className="w-full h-full object-cover" alt="Me" />
                            ) : (
                                <User className="w-6 h-6 text-brand-muted m-auto h-full" />
                            )}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white">Applying as {user.displayName}</div>
                            <div className="text-xs text-brand-muted">Your full profile will be shared.</div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-brand-muted mb-2">Note to Agency (Optional)</label>
                        <textarea 
                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none resize-none h-32 text-sm"
                            placeholder="Tell them why you're a good fit..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </div>
                </>
            )}
        </div>

        {/* Footer */}
        {!success && user && role === UserRole.MODEL && (
            <div className="p-6 pt-0 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 bg-white/5 text-brand-muted font-bold rounded-lg hover:bg-white/10 transition-colors">
                Cancel
            </button>
            <button 
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-brand-primary hover:bg-brand-accent text-white font-bold rounded-lg transition-colors flex items-center justify-center shadow-lg disabled:opacity-50"
            >
                {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <>Submit Application <Send className="w-4 h-4 ml-2" /></>
                )}
            </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default JoinAgencyModal;
