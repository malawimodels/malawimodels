import React, { useState } from 'react';
import { submitAccountAppeal } from '../services/supabase.service';
import { useNotification } from '../components/NotificationSystem';
import { ShieldAlert, Send } from 'lucide-react';

const Appeal: React.FC = () => {
  const { addNotification } = useNotification();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await submitAccountAppeal(email, message);
      setEmail('');
      setMessage('');
      addNotification('success', 'Appeal submitted. The admin team will review it.');
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Could not submit appeal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 min-h-screen text-brand-text">
      <div className="bg-brand-surface border border-white/5 rounded-xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Account Appeal</h1>
            <p className="text-sm text-brand-muted">Use this if your account was removed and you need admin review.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-brand-muted mb-2">Email used on the deleted account</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-brand-primary"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-brand-muted mb-2">Appeal details</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              rows={7}
              className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-brand-primary"
              placeholder="Explain why the account should be reviewed. Include booking/project context if relevant."
            />
          </div>
          <button disabled={submitting} className="w-full md:w-auto px-6 py-3 bg-brand-primary hover:bg-brand-accent disabled:opacity-50 text-white rounded-lg font-bold flex items-center justify-center">
            <Send className="w-4 h-4 mr-2" /> {submitting ? 'Submitting...' : 'Submit Appeal'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Appeal;