
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getClientPublicStats, subscribeToBookings } from '../../services/supabase.service';
import { Project, Booking, UserRole } from '../../types';
import { Briefcase, Users, DollarSign, Clock, CheckCircle, TrendingUp } from 'lucide-react';

const ClientOverview: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalProjects: 0,
        completedProjects: 0,
        totalHired: 0
    });
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        
        const fetchStats = async () => {
            try {
                const s = await getClientPublicStats(user.uid);
                setStats({
                    totalProjects: s.totalProjects,
                    completedProjects: s.completedProjects,
                    totalHired: s.totalHired
                });
            } catch (e) {
                console.error("Error fetching stats", e);
            }
        };

        const unsubBookings = subscribeToBookings(user.uid, UserRole.CLIENT, (data) => {
            setBookings(data);
            setLoading(false);
        });

        fetchStats();
        return () => unsubBookings();
    }, [user]);

    // Calculate spend (mock logic based on completed bookings)
    const estimatedSpend = bookings
        .filter(b => b.status === 'completed')
        .reduce((acc, curr) => acc + curr.currentOffer, 0);

    const activeBookings = bookings.filter(b => ['scheduled', 'negotiating'].includes(b.status)).length;

    if (loading) return <div className="text-brand-muted p-10 text-center animate-pulse">Loading overview...</div>;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 hover:border-brand-primary/20 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                            <Briefcase className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{stats.totalProjects}</div>
                    <div className="text-sm text-brand-muted">Total Projects</div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 hover:border-brand-primary/20 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-500/10 rounded-xl text-green-400 group-hover:bg-green-500 group-hover:text-white transition-colors">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{stats.totalHired}</div>
                    <div className="text-sm text-brand-muted">Talent Hired</div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 hover:border-brand-primary/20 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{activeBookings}</div>
                    <div className="text-sm text-brand-muted">Active Bookings</div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5 hover:border-brand-primary/20 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-brand-muted font-bold">Est.</span>
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">MWK {estimatedSpend.toLocaleString()}</div>
                    <div className="text-sm text-brand-muted">Total Spend</div>
                </div>
            </div>

            <div className="bg-brand-surface p-8 rounded-2xl border border-white/5">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                    <TrendingUp className="w-6 h-6 mr-2 text-brand-primary" /> Recent Activity
                </h3>
                {bookings.length === 0 ? (
                    <div className="text-center py-10 text-brand-muted border border-white/5 border-dashed rounded-xl">
                        No recent activity. Start a project to get going!
                    </div>
                ) : (
                    <div className="space-y-4">
                        {bookings.slice(0, 5).map(booking => (
                            <div key={booking.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                        booking.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                        booking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {booking.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <div className="text-white font-bold text-sm">{booking.projectTitle}</div>
                                        <div className="text-xs text-brand-muted">Model: {booking.modelName}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-white">{booking.status}</div>
                                    <div className="text-xs text-brand-muted">{new Date(booking.updatedAt).toLocaleDateString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientOverview;
