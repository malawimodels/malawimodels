
import React, { useState } from 'react';
import { X, AlertTriangle, MessageSquare, Star, ShieldAlert, Check, Ban } from 'lucide-react';
import { ReportReason } from '../types';

export type ActionType = 'cancel' | 'report' | 'review' | 'complete' | 'block';

interface BookingActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: ActionType;
  title: string;
  onSubmit: (data: any) => void;
  isProcessing: boolean;
}

const BookingActionModal: React.FC<BookingActionModalProps> = ({
  isOpen, onClose, actionType, title, onSubmit, isProcessing
}) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [rating, setRating] = useState(5);
  const [reportReason, setReportReason] = useState<ReportReason>(ReportReason.VIOLATION);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (actionType === 'cancel') {
      onSubmit({ reason });
    } else if (actionType === 'report') {
      onSubmit({ reason: reportReason, details });
    } else if (actionType === 'review') {
      onSubmit({ rating, comment: details });
    } else if (actionType === 'complete') {
        onSubmit({});
    } else if (actionType === 'block') {
        onSubmit({ reason });
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-brand-surface border border-white/10 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className={`p-6 border-b border-white/10 flex items-center justify-between ${
            actionType === 'report' || actionType === 'block' ? 'bg-red-500/10' : 
            actionType === 'cancel' ? 'bg-orange-500/10' : 
            actionType === 'complete' ? 'bg-green-500/10' : 
            'bg-brand-bg'
        }`}>
          <div className="flex items-center gap-3">
            {actionType === 'report' && <ShieldAlert className="w-6 h-6 text-red-500" />}
            {actionType === 'block' && <Ban className="w-6 h-6 text-red-500" />}
            {actionType === 'cancel' && <AlertTriangle className="w-6 h-6 text-orange-500" />}
            {actionType === 'review' && <Star className="w-6 h-6 text-brand-primary" />}
            {actionType === 'complete' && <Check className="w-6 h-6 text-green-500" />}
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {actionType === 'cancel' && (
            <>
              <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-lg text-orange-200 text-sm font-bold">
                Are you sure you want to cancel this booking? This action cannot be undone.
              </div>
              <div>
                <label className="block text-sm text-brand-muted mb-2">Reason (Optional)</label>
                <textarea 
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none resize-none h-24"
                  placeholder="Why are you cancelling?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </>
          )}

          {actionType === 'block' && (
            <>
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-red-200 text-sm font-bold">
                Are you sure you want to block this user? You will no longer receive messages or bookings from them.
              </div>
              <div>
                <label className="block text-sm text-brand-muted mb-2">Reason (Optional)</label>
                <textarea 
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none resize-none h-24"
                  placeholder="Reason for blocking..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </>
          )}

          {actionType === 'report' && (
            <>
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-red-200 text-sm">
                This report will be sent to the administration team for review. Please provide accurate details.
              </div>
              <div>
                <label className="block text-sm text-brand-muted mb-2">Issue Type</label>
                <select 
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as ReportReason)}
                >
                  {Object.values(ReportReason).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-brand-muted mb-2">Details / Evidence</label>
                <textarea 
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none resize-none h-32"
                  placeholder="Describe what happened..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
              </div>
            </>
          )}

          {actionType === 'review' && (
            <>
              <div className="flex justify-center gap-2 py-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setRating(star)} className="focus:outline-none transition-transform hover:scale-110">
                    <Star className={`w-8 h-8 ${star <= rating ? 'fill-brand-primary text-brand-primary' : 'text-brand-muted'}`} />
                  </button>
                ))}
              </div>
              <div className="text-center text-sm font-bold text-white mb-4">
                {rating === 5 ? "Excellent" : rating === 4 ? "Good" : rating === 3 ? "Average" : rating === 2 ? "Poor" : "Terrible"}
              </div>
              <div>
                <label className="block text-sm text-brand-muted mb-2">Your Review</label>
                <textarea 
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none resize-none h-32"
                  placeholder="Share your experience..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
              </div>
            </>
          )}

          {actionType === 'complete' && (
              <p className="text-brand-muted text-sm leading-relaxed">
                  Marking this booking as complete indicates that the work has been performed. 
                  This will unlock the ability to leave a review.
              </p>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-white/5 text-brand-muted font-bold rounded-lg hover:bg-white/10 transition-colors">
            Back
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isProcessing}
            className={`flex-1 py-3 text-white font-bold rounded-lg transition-colors flex items-center justify-center ${
                actionType === 'report' || actionType === 'block' ? 'bg-red-600 hover:bg-red-500' :
                actionType === 'cancel' ? 'bg-orange-600 hover:bg-orange-500' :
                actionType === 'complete' ? 'bg-green-600 hover:bg-green-500' :
                'bg-brand-primary hover:bg-brand-accent'
            }`}
          >
            {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
                actionType === 'report' ? 'Submit Report' :
                actionType === 'cancel' ? 'Confirm Cancel' :
                actionType === 'block' ? 'Block User' :
                actionType === 'complete' ? 'Mark Complete' :
                'Post Review'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingActionModal;
