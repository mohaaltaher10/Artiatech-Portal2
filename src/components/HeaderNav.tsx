import React, { useState, useEffect } from 'react';
import { LogOut, Download } from 'lucide-react';
import { TabType, UserProfile } from '../types';

interface HeaderNavProps {
  currentUser: UserProfile;
  activeTab: TabType | null;
  setActiveTab: (tab: TabType | null) => void;
  onLogout: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onLogout,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-40 font-['Cairo',sans-serif]">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-4">
          {/* Right Side in RTL: User Name, Email, Install Button, and Logout Button */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-sm font-black text-[#1e293b] block leading-tight">{currentUser.name}</span>
              <p className="text-xs text-slate-500 font-medium">{currentUser.email}</p>
            </div>

            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-amber-900 bg-amber-40 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer shrink-0 animate-bounce"
                title="تثبيت التطبيق على جهازك"
              >
                <Download className="w-3.5 h-3.5 text-amber-700" />
                <span>تثبيت التطبيق</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer shrink-0"
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>

          {/* Left Side in RTL: Logo Image */}
          <div
            onClick={() => setActiveTab(null)}
            className="cursor-pointer group shrink-0"
            title="العودة للبطاقات الرئيسية"
          >
            <img
              src="/logo.png"
              alt="استوديو أرتياتك - Artiatech Studio"
              className="h-10 sm:h-12 w-auto object-contain transition-opacity group-hover:opacity-85"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

