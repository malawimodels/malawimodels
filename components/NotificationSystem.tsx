
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationContextType {
  addNotification: (type: NotificationType, message: string) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
}

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
};

type ConfirmState = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const addNotification = useCallback((type: NotificationType, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, type, message }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const confirmAction = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const closeConfirm = (confirmed: boolean) => {
    setConfirmState((current) => {
      current?.resolve(confirmed);
      return null;
    });
  };

  return (
    <NotificationContext.Provider value={{ addNotification, confirmAction }}>
      {children}
      <ConfirmationModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        isDestructive={confirmState?.isDestructive}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-[100] flex flex-col gap-3 pointer-events-none items-center md:items-end">
        {notifications.map(n => (
          <div 
            key={n.id} 
            className={`pointer-events-auto w-full md:w-auto md:min-w-[300px] max-w-md p-4 rounded-xl shadow-2xl border flex items-start gap-3 animate-slide-up backdrop-blur-md ${
              n.type === 'success' ? 'bg-brand-surface/90 border-green-500/50 text-white shadow-green-900/20' :
              n.type === 'error' ? 'bg-brand-surface/90 border-red-500/50 text-white shadow-red-900/20' :
              'bg-brand-surface/90 border-brand-primary/50 text-white shadow-amber-900/20'
            }`}
          >
            {n.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />}
            {n.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
            {n.type === 'info' && <Info className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" />}
            
            <p className="text-sm font-medium flex-grow">{n.message}</p>
            
            <button onClick={() => removeNotification(n.id)} className="text-brand-muted hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
