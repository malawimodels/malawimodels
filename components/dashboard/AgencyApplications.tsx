
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { AgencyApplication } from '../../types';
import { subscribeToAgencyIncomingApplications, respondToAgencyApplication } from '../../services/supabase.service';
import { Inbox, CheckCircle, XCircle, User } from 'lucide-react';
import OptimizedImage from '../OptimizedImage';

const AgencyApplications: React.FC = () => {
    const { user } = useAuth();
    const [applications, setApplications] = useState<AgencyApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const unsub = subscribeToAgencyIncomingApplications(user.uid, (apps) => {
            setApplications(apps);
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    const handleResponse = async (app: AgencyApplication, accept: boolean) => {
        if (!user) return;
        setProcessing(app.id);
        try {
            await respondToAgencyApplication(app.id, accept, user.uid, app.modelUid, user.displayName || 'Agency');
        } catch (e) {
            console.error("Failed to respond", e);
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return <div className="text-center p-10 text-brand-muted animate-pulse">Loading applications...</div>;

    return (
        <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <Inbox className="w-5 h-5 mr-3 text-brand-primary" />
                Incoming Applications ({applications.length})
            </h2>

            {applications.length === 0 ? (
                <div className="text-center py-10 border border-white/5 border-dashed rounded-xl text-brand-muted">
                    No pending applications from models.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {applications.map(app => (
                        <div key={app.id} className="bg-black/20 border border-white/5 rounded-xl p-5 hover:border-brand-primary/20 transition-all">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-white/5 overflow-hidden flex-shrink-0 border border-white/10">
                                    {app.modelPhoto ? (
                                        <OptimizedImage src={app.modelPhoto} variant="avatar" className="w-full h-full object-cover" alt={app.modelName} />
                                    ) : (
                                        <User className="w-6 h-6 m-auto h-full text-brand-muted" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{app.modelName}</h3>
                                    <p className="text-xs text-brand-muted mt-1">Applied: {new Date(app.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            
                            {app.note && (
                                <div className="bg-white/5 p-3 rounded-lg text-sm text-brand-muted mb-4 italic">
                                    "{app.note}"
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={() => handleResponse(app, true)}
                                    disabled={processing === app.id}
                                    className="flex-1 py-2 bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" /> Accept
                                </button>
                                <button 
                                    onClick={() => handleResponse(app, false)}
                                    disabled={processing === app.id}
                                    className="flex-1 py-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                                >
                                    <XCircle className="w-4 h-4 mr-2" /> Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AgencyApplications;
