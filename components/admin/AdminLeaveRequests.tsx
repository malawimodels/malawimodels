
import React, { useState, useEffect } from 'react';
import { LeaveRequest } from '../../types';
import { subscribeToAdminLeaveRequests, processLeaveRequest } from '../../services/supabase.service';
import { LogOut, CheckCircle, XCircle } from 'lucide-react';
import { useNotification } from '../NotificationSystem';

const AdminLeaveRequests: React.FC = () => {
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const { addNotification, confirmAction } = useNotification();

    useEffect(() => {
        const unsub = subscribeToAdminLeaveRequests((data) => {
            setRequests(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleProcess = async (req: LeaveRequest, approved: boolean) => {
        const confirmed = await confirmAction({
            title: approved ? 'Approve Leave Request' : 'Reject Leave Request',
            message: `Are you sure you want to ${approved ? 'approve' : 'reject'} this request?`,
            confirmLabel: approved ? 'Approve' : 'Reject',
            isDestructive: !approved,
        });
        if (!confirmed) return;
        try {
            await processLeaveRequest(req.id, approved, req.modelUid);
            addNotification('success', approved ? 'Leave request approved.' : 'Leave request rejected.');
        } catch (e) {
            addNotification('error', 'Failed to process request.');
        }
    };

    if (loading) return <div className="text-center p-10 text-white">Loading requests...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-white flex items-center">
                <LogOut className="w-6 h-6 mr-3 text-orange-500" />
                Agency Leave Requests ({requests.length})
            </h2>

            {requests.length === 0 ? (
                <div className="text-center py-20 bg-brand-surface rounded-xl border border-white/5 text-brand-muted">
                    No pending leave requests.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {requests.map(req => (
                        <div key={req.id} className="bg-brand-surface border border-white/5 rounded-xl p-6 shadow-lg">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-white text-lg">{req.modelName}</h3>
                                    <p className="text-xs text-brand-muted">wants to leave</p>
                                    <h4 className="font-bold text-brand-primary">{req.agencyName}</h4>
                                </div>
                                <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-brand-muted">
                                    {new Date(req.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            
                            <div className="bg-black/30 p-4 rounded-lg text-sm text-brand-muted italic mb-6 border border-white/5">
                                "{req.reason}"
                            </div>

                            <div className="flex gap-4">
                                <button 
                                    onClick={() => handleProcess(req, true)}
                                    className="flex-1 py-3 bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" /> Approve Leave
                                </button>
                                <button 
                                    onClick={() => handleProcess(req, false)}
                                    className="flex-1 py-3 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center"
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

export default AdminLeaveRequests;
