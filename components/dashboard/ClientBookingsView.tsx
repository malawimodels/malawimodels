
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { subscribeToBookings, updateBookingStatus, updateBookingOffer, acceptPreviousOffer, cancelBookingWithReason, completeBooking, archiveBooking, submitReview, deleteBooking, blockBookingUser, uploadPaymentProof } from '../../services/supabase.service';
import { Booking, BookingStatus, UserRole } from '../../types';
import { Search, Filter, ArrowUpDown, Calendar, CheckCircle, X, MessageSquare, Star, Clock, AlertTriangle, Users, DollarSign, Archive, Upload, FileText, Handshake, ExternalLink } from 'lucide-react';
import BookingActionModal, { ActionType } from '../BookingActionModal';
import ConfirmationModal from '../ConfirmationModal';
import { useNotification } from '../NotificationSystem';
import { uploadImage } from '../../services/cloudinary';
import { Link } from 'react-router-dom';

type ViewMode = 'list' | 'talent_pool';
type SortOption = 'date_desc' | 'date_asc' | 'price_high' | 'price_low';

const ClientBookingsView: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View Controls
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');

  // Modals
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; type: ActionType; bookingId: string; title: string }>({ isOpen: false, type: 'review', bookingId: '', title: '' });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; isDestructive?: boolean; confirmLabel?: string }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  // Negotiation State
  const [negotiatingBooking, setNegotiatingBooking] = useState<Booking | null>(null);
  const [counterOfferAmount, setCounterOfferAmount] = useState<string>('');
  const [negotiationNote, setNegotiationNote] = useState<string>('');
  const [uploadingProofId, setUploadingProofId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToBookings(user.uid, UserRole.CLIENT, (data) => {
      setBookings(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // --- Derived Data ---
  
  const filteredBookings = bookings.filter(b => {
    if (b.hiddenBy?.includes(user?.uid || '')) return false;
    
    const searchMatch = 
      b.modelName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.projectTitle.toLowerCase().includes(searchTerm.toLowerCase());
    if (!searchMatch) return false;

    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && !['scheduled', 'negotiating'].includes(b.status)) return false;
      if (statusFilter === 'completed' && b.status !== 'completed') return false;
      if (statusFilter === 'cancelled' && b.status !== 'cancelled') return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'date_desc') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (sortBy === 'date_asc') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    if (sortBy === 'price_high') return b.currentOffer - a.currentOffer;
    if (sortBy === 'price_low') return a.currentOffer - b.currentOffer;
    return 0;
  });

  const talentPool = Array.from(new Set(
    bookings.filter(b => b.status === 'completed').map(b => b.modelId)
  )).map(modelId => {
    const modelBookings = bookings.filter(b => b.modelId === modelId && b.status === 'completed');
    const latestBooking = modelBookings.sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    
    return {
      modelId,
      modelName: latestBooking.modelName,
      projectCount: modelBookings.length,
      latestBooking,
      lastWorked: latestBooking.updatedAt
    };
  }).filter(m => 
    m.modelName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Actions ---

  const handleAction = async (data: any) => {
    if (!user) return;
    try {
        const { type, bookingId } = actionModal;
        const booking = bookings.find(b => b.id === bookingId);
        
        if (type === 'review' && booking) {
            await submitReview(bookingId, { 
                authorId: user.uid, 
                targetId: booking.modelId, 
                targetRole: UserRole.MODEL,
                rating: data.rating, 
                comment: data.comment 
            }, UserRole.CLIENT);
            addNotification('success', "Review submitted!");
        } else if (type === 'cancel') {
            await cancelBookingWithReason(bookingId, data.reason, user.uid);
            addNotification('success', "Booking cancelled.");
        } else if (type === 'report') {
            // report logic
        }
        setActionModal({ ...actionModal, isOpen: false });
    } catch (e: any) {
        addNotification('error', e.message);
    }
  };

  const handleAcceptOffer = async (booking: Booking) => {
      try {
          await updateBookingStatus(booking.id, 'scheduled', booking.currentOffer, UserRole.CLIENT);
          addNotification('success', "Scheduled!");
      } catch (e) { addNotification('error', "Error accepting offer."); }
  };

  const handleCounterOffer = async () => {
      if (!negotiatingBooking) return;
      try {
          await updateBookingOffer(negotiatingBooking.id, {
              role: 'client',
              amount: parseInt(counterOfferAmount),
              timestamp: new Date().toISOString(),
              note: negotiationNote
          });
          setNegotiatingBooking(null);
          addNotification('success', "Counter sent.");
      } catch (e) { addNotification('error', "Error sending counter."); }
  };

  const handleCompleteProject = async (bookingId: string) => {
      try {
          await completeBooking(bookingId);
          addNotification('success', "Marked as complete.");
      } catch (e) { addNotification('error', "Error completing project."); }
  };

  const handlePaymentProof = async (e: React.ChangeEvent<HTMLInputElement>, bookingId: string) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              setUploadingProofId(bookingId);
              const uploaded = await uploadImage(file, 'payment');
              await uploadPaymentProof(bookingId, uploaded.url);
              addNotification('success', "Payment proof uploaded.");
          } catch (e) { addNotification('error', e instanceof Error ? e.message : "Upload failed."); }
          finally {
              setUploadingProofId(null);
              e.target.value = '';
          }
      }
  };

  const handleArchive = (id: string) => {
      if (!user) return;
      setConfirmModal({
          isOpen: true,
          title: "Archive Booking",
          message: "Remove from active view?",
          confirmLabel: "Archive",
          onConfirm: async () => {
              await archiveBooking(id, user.uid);
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  if (loading) return <div className="p-10 text-center text-brand-muted animate-pulse">Loading bookings...</div>;

  return (
    <div className="space-y-6">
      <BookingActionModal 
        isOpen={actionModal.isOpen} 
        onClose={() => setActionModal({ ...actionModal, isOpen: false })}
        actionType={actionModal.type}
        title={actionModal.title}
        onSubmit={handleAction}
        isProcessing={false}
      />
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        isDestructive={confirmModal.isDestructive}
        confirmLabel={confirmModal.confirmLabel}
      />

      {/* --- Toolbar --- */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-brand-surface p-4 rounded-xl border border-white/5">
         <div className="flex flex-wrap justify-center bg-black/30 p-1 rounded-lg gap-1 w-full md:w-auto">
            <button 
                onClick={() => setViewMode('list')}
                className={`flex-grow md:flex-grow-0 px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-brand-primary text-white shadow-lg' : 'text-brand-muted hover:text-white'}`}
            >
                <Handshake className="w-4 h-4 mr-2" /> Bookings & Negotiations
            </button>
            <button 
                onClick={() => setViewMode('talent_pool')}
                className={`flex-grow md:flex-grow-0 px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center ${viewMode === 'talent_pool' ? 'bg-brand-primary text-white shadow-lg' : 'text-brand-muted hover:text-white'}`}
            >
                <Users className="w-4 h-4 mr-2" /> My Talent Pool
            </button>
         </div>

         <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0">
                <input 
                    type="text" 
                    placeholder="Search model or project..." 
                    className="w-full md:w-48 bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-brand-primary focus:outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-brand-muted" />
            </div>
            
            {viewMode === 'list' && (
                <>
                    <div className="relative flex-grow md:flex-grow-0">
                        <select 
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:border-brand-primary focus:outline-none appearance-none cursor-pointer"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <Filter className="absolute right-3 top-2.5 w-3 h-3 text-brand-muted pointer-events-none" />
                    </div>
                    <div className="relative flex-grow md:flex-grow-0">
                        <select 
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:border-brand-primary focus:outline-none appearance-none cursor-pointer"
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as SortOption)}
                        >
                            <option value="date_desc">Newest First</option>
                            <option value="date_asc">Oldest First</option>
                            <option value="price_high">Highest Price</option>
                            <option value="price_low">Lowest Price</option>
                        </select>
                        <ArrowUpDown className="absolute right-3 top-2.5 w-3 h-3 text-brand-muted pointer-events-none" />
                    </div>
                </>
            )}
         </div>
      </div>

      {/* --- CONTENT --- */}
      
      {viewMode === 'talent_pool' ? (
          /* TALENT POOL VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {talentPool.length === 0 ? (
                  <div className="col-span-full text-center py-20 text-brand-muted border border-white/5 border-dashed rounded-xl">
                      You haven't completed any projects with models yet.
                  </div>
              ) : (
                  talentPool.map(model => (
                      <div key={model.modelId} className="bg-brand-surface border border-white/10 rounded-xl p-6 shadow-lg hover:border-brand-primary/30 transition-all">
                          <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-full flex items-center justify-center text-white font-bold text-lg border border-white/10">
                                      {model.modelName.charAt(0)}
                                  </div>
                                  <div>
                                      <h3 className="text-lg font-bold text-white leading-tight">{model.modelName}</h3>
                                      <Link to={`/profile/${model.modelId}`} target="_blank" className="text-xs text-brand-primary hover:underline flex items-center mt-1">
                                          View Profile <ExternalLink className="w-3 h-3 ml-1" />
                                      </Link>
                                  </div>
                              </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mb-4">
                              <div className="bg-white/5 rounded-lg p-2 text-center">
                                  <span className="block text-xl font-bold text-white">{model.projectCount}</span>
                                  <span className="text-[10px] text-brand-muted uppercase">Projects</span>
                              </div>
                              <div className="bg-white/5 rounded-lg p-2 text-center">
                                  <span className="block text-xl font-bold text-green-400">
                                      {new Date(model.lastWorked).toLocaleDateString(undefined, {month: 'short', year: '2-digit'})}
                                  </span>
                                  <span className="text-[10px] text-brand-muted uppercase">Last Job</span>
                              </div>
                          </div>
                          
                          <div className="flex gap-2">
                              <button 
                                  onClick={() => {
                                      setActionModal({
                                          isOpen: true,
                                          type: 'review',
                                          bookingId: model.latestBooking.id,
                                          title: `Rate ${model.modelName}`
                                      });
                                  }}
                                  className="flex-1 py-2 bg-white/5 hover:bg-brand-primary/20 hover:text-brand-primary text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center"
                              >
                                  <Star className="w-3 h-3 mr-1" /> {model.latestBooking.clientReviewId ? 'Update Rating' : 'Rate Model'}
                              </button>
                          </div>
                      </div>
                  ))
              )}
          </div>
      ) : (
          /* LIST VIEW */
          <div className="space-y-4 animate-slide-up">
              {filteredBookings.length === 0 ? (
                  <div className="text-center py-20 text-brand-muted border border-white/5 border-dashed rounded-xl">
                      No active bookings found. Start by casting a project!
                  </div>
              ) : (
                  filteredBookings.map(booking => {
                      const lastOfferRole = booking.history[booking.history.length - 1].role;
                      const isMyTurn = lastOfferRole !== 'client';

                      return (
                      <div key={booking.id} className="bg-brand-surface border border-white/10 rounded-xl p-6 hover:border-brand-primary/20 transition-all shadow-md">
                          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                              <div className="flex-grow w-full">
                                  <div className="flex items-center gap-3 mb-2">
                                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                          booking.status === 'scheduled' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                          booking.status === 'negotiating' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                          booking.status === 'completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                          'bg-red-500/10 text-red-400 border-red-500/20'
                                      }`}>
                                          {booking.status}
                                      </span>
                                      <span className="text-xs text-brand-muted flex items-center">
                                          <Clock className="w-3 h-3 mr-1" /> Updated {new Date(booking.updatedAt).toLocaleDateString()}
                                      </span>
                                  </div>
                                  <h3 className="text-xl font-bold text-white mb-1">{booking.modelName}</h3>
                                  <p className="text-sm text-brand-muted mb-3">Project: <span className="text-white">{booking.projectTitle}</span></p>
                                  
                                  {/* Negotiation History Chat */}
                                  {booking.status === 'negotiating' && (
                                      <div className="bg-black/30 p-3 rounded-lg mt-2 border border-white/5 w-full max-w-xl">
                                          <h4 className="text-[10px] uppercase font-bold text-brand-muted mb-2 tracking-wider">Negotiation History</h4>
                                          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                              {booking.history.map((offer, idx) => (
                                                  <div key={idx} className={`flex flex-col ${offer.role === 'client' ? 'items-end' : 'items-start'}`}>
                                                      <div className={`p-2 rounded-lg text-xs max-w-[85%] ${
                                                          offer.role === 'client' 
                                                          ? 'bg-brand-primary/20 text-white border border-brand-primary/30 rounded-tr-none' 
                                                          : 'bg-white/10 text-brand-muted border border-white/5 rounded-tl-none'
                                                      }`}>
                                                          <div className="font-bold mb-0.5">
                                                              {offer.role === 'client' ? 'You' : 'Model'}: MWK {offer.amount.toLocaleString()}
                                                          </div>
                                                          {offer.note && (
                                                              <div className="italic opacity-80 border-t border-white/10 pt-1 mt-1">
                                                                  "{offer.note}"
                                                              </div>
                                                          )}
                                                      </div>
                                                      <span className="text-[9px] text-brand-muted mt-0.5 px-1">
                                                          {new Date(offer.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                      </span>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  )}
                              </div>

                              <div className="flex flex-col items-end gap-3 min-w-[200px]">
                                  {/* Action Buttons Container */}
                                  <div className="flex flex-col gap-2 w-full">
                                      {booking.status === 'negotiating' && (
                                          <>
                                              {isMyTurn ? (
                                                  <button 
                                                      onClick={() => handleAcceptOffer(booking)}
                                                      className="w-full py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg"
                                                  >
                                                      Accept Model's Offer
                                                  </button>
                                              ) : (
                                                  <div className="text-xs text-center text-brand-muted bg-white/5 py-2 rounded-lg italic">
                                                      Waiting for model...
                                                  </div>
                                              )}
                                              <button 
                                                  onClick={() => {
                                                      setNegotiatingBooking(booking);
                                                      setCounterOfferAmount('');
                                                      setNegotiationNote('');
                                                  }}
                                                  className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors"
                                              >
                                                  Counter Offer
                                              </button>
                                          </>
                                      )}
                                      
                                      {booking.status === 'scheduled' && (
                                          <div className="space-y-2">
                                              {booking.paymentProofUrl ? (
                                                  <a 
                                                      href={booking.paymentProofUrl} 
                                                      target="_blank" 
                                                      className="block w-full py-2 text-center text-green-400 border border-green-500/30 rounded-lg text-xs font-bold hover:bg-green-500/10 transition-colors"
                                                  >
                                                      Proof Uploaded
                                                  </a>
                                              ) : (
                                                  <label className="block w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold text-center cursor-pointer transition-colors">
                                                      {uploadingProofId === booking.id ? 'Uploading...' : 'Upload Payment'}
                                                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePaymentProof(e, booking.id)} disabled={uploadingProofId === booking.id} />
                                                  </label>
                                              )}
                                              <button 
                                                  onClick={() => handleCompleteProject(booking.id)}
                                                  className="w-full py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg"
                                              >
                                                  Mark Complete
                                              </button>
                                              <button 
                                                  onClick={() => setActionModal({ isOpen: true, type: 'cancel', bookingId: booking.id, title: 'Cancel Booking' })}
                                                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-colors"
                                              >
                                                  Cancel
                                              </button>
                                          </div>
                                      )}

                                      {['completed', 'cancelled', 'reported'].includes(booking.status) && (
                                          <div className="flex gap-2 justify-end w-full">
                                              {booking.status === 'completed' && (
                                                  <button 
                                                      onClick={() => setActionModal({ isOpen: true, type: 'review', bookingId: booking.id, title: 'Rate Model' })}
                                                      className="flex-grow py-2 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white text-xs font-bold rounded-lg transition-colors"
                                                  >
                                                      Review
                                                  </button>
                                              )}
                                              <button 
                                                  onClick={() => handleArchive(booking.id)}
                                                  className="p-2 bg-white/5 hover:bg-white/10 text-brand-muted hover:text-white rounded-lg transition-colors"
                                                  title="Archive"
                                              >
                                                  <Archive className="w-4 h-4" />
                                              </button>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          </div>

                          {/* Negotiation Drawer */}
                          {negotiatingBooking?.id === booking.id && (
                              <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in">
                                  <div className="bg-black/40 p-4 rounded-xl border border-brand-primary/20">
                                      <div className="flex justify-between mb-3">
                                          <h4 className="text-sm font-bold text-white">Send Counter Offer</h4>
                                          <button 
                                              onClick={() => { setCounterOfferAmount('0'); setNegotiationNote('Portfolio Collaboration / Trade'); }}
                                              className="text-[10px] text-brand-primary hover:underline"
                                          >
                                              Suggest TFP / Free
                                          </button>
                                      </div>
                                      <div className="flex flex-col gap-3">
                                          <div className="flex gap-2">
                                              <div className="w-1/3">
                                                  <label className="text-[10px] text-brand-muted uppercase font-bold mb-1 block">Amount (MWK)</label>
                                                  <input 
                                                      type="number" 
                                                      className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-primary focus:outline-none"
                                                      value={counterOfferAmount}
                                                      onChange={e => setCounterOfferAmount(e.target.value)}
                                                  />
                                              </div>
                                          </div>
                                          <div>
                                              <label className="text-[10px] text-brand-muted uppercase font-bold mb-1 block">Note</label>
                                              <textarea 
                                                  placeholder="Add a note about the offer..."
                                                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-primary focus:outline-none resize-none h-20"
                                                  value={negotiationNote}
                                                  onChange={e => setNegotiationNote(e.target.value)}
                                              />
                                          </div>
                                      </div>
                                      <div className="flex gap-2 justify-end mt-3">
                                          <button 
                                              onClick={() => setNegotiatingBooking(null)}
                                              className="px-3 py-1.5 text-xs font-bold text-brand-muted hover:text-white"
                                          >
                                              Cancel
                                          </button>
                                          <button 
                                              onClick={handleCounterOffer}
                                              className="px-4 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-lg hover:bg-brand-accent"
                                          >
                                              Send Offer
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  );
              })
              )}
          </div>
      )}
    </div>
  );
};

export default ClientBookingsView;
