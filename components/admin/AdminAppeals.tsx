import React, { useEffect, useState } from 'react';
import { AccountAppeal, AccountAppealStatus } from '../../types';
import { processAccountAppeal, subscribeToAccountAppeals } from '../../services/supabase.service';
import { useNotification } from '../NotificationSystem';
import { CheckCircle, Clock, FileWarning, ShieldCheck, XCircle } from 'lucide-react';

const statusStyles: Record<AccountAppealStatus, string> = {
  pending: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
  under_review: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  approved: 'bg-green-500/10 text-green-400 border-green-500/20',
  denied: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const AdminAppeals: React.FC = () => {
  const { addNotification } = useNotification();
  const [appeals, setAppeals] = useState<AccountAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [warningsById, setWarningsById] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribe = subscribeToAccountAppeals((data) => {
      setAppeals(data);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const updateAppeal = async (appeal: AccountAppeal, status: AccountAppealStatus) => {
    try {
      await processAccountAppeal(
        appeal.id,
        status,
        notesById[appeal.id] || appeal.adminNotes,
        warningsById[appeal.id] || appeal.warningMessage
      );
      addNotification('success', `Appeal marked ${status.replace('_', ' ')}.`);
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Failed to update appeal.');
    }
  };

  if (loading) return <div className="p-10 text-center text-brand-muted animate-pulse">Loading appeals...</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white flex items-center"><FileWarning className="w-6 h-6 mr-3 text-brand-primary" /> Account Appeals</h2>
        <span className="text-xs text-brand-muted">{appeals.filter((appeal) => appeal.status === 'pending').length} pending</span>
      </div>

      {appeals.length === 0 ? (
        <div className="text-center py-16 bg-brand-surface border border-white/5 rounded-xl text-brand-muted">No account appeals yet.</div>
      ) : appeals.map((appeal) => (
        <div key={appeal.id} className="bg-brand-surface border border-white/5 rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
            <div>
              <div className="text-white font-bold break-all">{appeal.contactEmail}</div>
              <div className="text-xs text-brand-muted">Submitted {new Date(appeal.createdAt).toLocaleString()}</div>
            </div>
            <span className={`w-fit text-[11px] uppercase font-bold border rounded-full px-3 py-1 ${statusStyles[appeal.status]}`}>
              {appeal.status.replace('_', ' ')}
            </span>
          </div>

          <p className="text-sm text-brand-muted bg-black/20 border border-white/5 rounded-lg p-4 whitespace-pre-wrap">{appeal.message}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <textarea
              value={notesById[appeal.id] ?? appeal.adminNotes ?? ''}
              onChange={(event) => setNotesById((current) => ({ ...current, [appeal.id]: event.target.value }))}
              rows={3}
              placeholder="Internal admin notes"
              className="bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-brand-primary"
            />
            <textarea
              value={warningsById[appeal.id] ?? appeal.warningMessage ?? ''}
              onChange={(event) => setWarningsById((current) => ({ ...current, [appeal.id]: event.target.value }))}
              rows={3}
              placeholder="Warning or condition if appeal is approved"
              className="bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
            <button onClick={() => updateAppeal(appeal, 'under_review')} className="px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white text-sm font-bold flex items-center"><Clock className="w-4 h-4 mr-2" /> Review</button>
            <button onClick={() => updateAppeal(appeal, 'approved')} className="px-4 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white text-sm font-bold flex items-center"><ShieldCheck className="w-4 h-4 mr-2" /> Approve</button>
            <button onClick={() => updateAppeal(appeal, 'denied')} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white text-sm font-bold flex items-center"><XCircle className="w-4 h-4 mr-2" /> Deny</button>
            <button onClick={() => updateAppeal(appeal, appeal.status)} className="px-4 py-2 rounded-lg bg-white/5 text-brand-muted hover:text-white text-sm font-bold flex items-center"><CheckCircle className="w-4 h-4 mr-2" /> Save Notes</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminAppeals;