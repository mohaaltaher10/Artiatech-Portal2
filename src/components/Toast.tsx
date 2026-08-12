import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string | null;
  type: 'success' | 'error';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  const isSuccess = type === 'success';

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4">
      <div
        className={`flex items-center justify-between px-5 py-2.5 rounded-full border text-xs font-bold shadow-xl transition-all duration-200 ${
          isSuccess
            ? 'bg-[#1e293b] text-white border-slate-700'
            : 'bg-rose-950 text-rose-100 border-rose-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{message}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
          title="إغلاق"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
