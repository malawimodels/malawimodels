import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, title, message, confirmLabel = 'Confirm', onConfirm, onCancel, isDestructive = false 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-brand-surface border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl transform scale-100 transition-all">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-brand-primary/10 text-brand-primary'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        
        <p className="text-brand-muted mb-8 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3 justify-end">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-brand-muted hover:bg-white/5 hover:text-white transition-colors font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className={`px-6 py-2 rounded-lg font-bold text-white shadow-lg transition-all ${
              isDestructive 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-brand-primary hover:bg-brand-accent'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;