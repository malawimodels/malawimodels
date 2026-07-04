import React, { useEffect, useMemo, useState } from 'react';
import { Star, MessageSquare, UserCheck, Flag } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Review } from '../../types';
import { disputeReview, ReviewListMode, subscribeToUserReviews } from '../../services/supabase.service';
import { useNotification } from '../NotificationSystem';

interface ReviewHistoryViewProps {
  mode: ReviewListMode;
  userId?: string;
  title: string;
  emptyText: string;
}

const ReviewHistoryView: React.FC<ReviewHistoryViewProps> = ({ mode, userId, title, emptyText }) => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [disputeTarget, setDisputeTarget] = useState<Review | null>(null);
  const [disputeDetails, setDisputeDetails] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const resolvedUserId = userId || user?.uid || '';

  useEffect(() => {
    if (!resolvedUserId) {
      setReviews([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToUserReviews(
      resolvedUserId,
      mode,
      (data) => {
        setReviews(data);
        setLoading(false);
      },
      user?.uid
    );

    return () => unsubscribe();
  }, [mode, resolvedUserId, user?.uid]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
  }, [reviews]);

  const canDisputeReview = (review: Review) => {
    return mode === 'received' && ['cancelled', 'reported'].includes(review.bookingStatus || '') || (mode === 'received' && review.rating <= 2);
  };

  const handleSubmitDispute = async () => {
    if (!user || !disputeTarget) return;
    setSubmittingDispute(true);
    try {
      await disputeReview(disputeTarget.id, user.uid, disputeDetails);
      addNotification('success', 'Review dispute sent to admins.');
      setDisputeTarget(null);
      setDisputeDetails('');
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Could not submit dispute.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-brand-muted animate-pulse">Loading reviews...</div>;
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {disputeTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="w-full max-w-md bg-brand-surface border border-white/10 rounded-xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Dispute Review</h3>
            <p className="text-sm text-brand-muted mb-4">
              Send this review to admins for moderation. Include what happened and why the review is unfair or abusive.
            </p>
            <textarea
              className="w-full h-32 bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none resize-none"
              placeholder="Explain the issue..."
              value={disputeDetails}
              onChange={(event) => setDisputeDetails(event.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setDisputeTarget(null);
                  setDisputeDetails('');
                }}
                className="flex-1 py-3 bg-white/5 text-brand-muted font-bold rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitDispute}
                disabled={submittingDispute}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors disabled:opacity-60"
              >
                {submittingDispute ? 'Sending...' : 'Submit Dispute'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-brand-surface border border-white/10 rounded-xl p-5">
          <div className="text-xs text-brand-muted uppercase font-bold tracking-wider mb-2">Reviews</div>
          <div className="text-3xl font-bold text-white">{reviews.length}</div>
        </div>
        <div className="bg-brand-surface border border-white/10 rounded-xl p-5">
          <div className="text-xs text-brand-muted uppercase font-bold tracking-wider mb-2">Average Rating</div>
          <div className="flex items-center gap-2">
            <Star className="w-6 h-6 text-brand-primary fill-brand-primary" />
            <span className="text-3xl font-bold text-white">{averageRating ? averageRating.toFixed(1) : '-'}</span>
          </div>
        </div>
        <div className="bg-brand-surface border border-white/10 rounded-xl p-5">
          <div className="text-xs text-brand-muted uppercase font-bold tracking-wider mb-2">
            {mode === 'authored' ? 'People Rated' : 'People Reviewed'}
          </div>
          <div className="text-3xl font-bold text-white">
            {new Set(reviews.map((review) => (mode === 'authored' ? review.targetId : review.authorId))).size}
          </div>
        </div>
      </div>

      <div className="bg-brand-surface border border-white/10 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-brand-primary" />
            {title}
          </h2>
        </div>

        {reviews.length === 0 ? (
          <div className="text-center py-16 text-brand-muted border border-white/5 border-dashed m-5 rounded-xl">
            {emptyText}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {reviews.map((review) => {
              const name = mode === 'authored' ? review.targetName : review.authorName;
              const role = mode === 'authored' ? review.targetRole : review.authorRole;

              return (
                <div key={review.id} className="p-5 hover:bg-white/5 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white flex-shrink-0">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-white font-bold">{name}</h3>
                          {role && (
                            <span className="text-[10px] uppercase font-bold text-brand-muted bg-white/5 px-2 py-0.5 rounded">
                              {role}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-brand-muted mt-1">
                          {review.projectTitle || 'Booking review'} • {new Date(review.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col items-center md:items-end gap-2">
                      <div className="flex text-brand-primary">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${star <= review.rating ? 'fill-current' : 'text-gray-600'}`}
                          />
                        ))}
                      </div>
                      {mode === 'authored' && (
                        <span className={`text-[10px] font-bold ${review.canEdit ? 'text-green-400' : 'text-brand-muted'}`}>
                          {review.canEdit ? 'One edit available' : 'Final'}
                        </span>
                      )}
                      {canDisputeReview(review) && (
                        <button
                          type="button"
                          onClick={() => setDisputeTarget(review)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-300"
                        >
                          <Flag className="w-3 h-3" /> Dispute
                        </button>
                      )}
                    </div>
                  </div>

                  {review.comment && (
                    <p className="text-sm text-brand-muted leading-relaxed mt-4 pl-0 md:pl-[52px]">
                      {review.comment}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewHistoryView;
