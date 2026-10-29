import React, { useState } from 'react';
import { LogOut, Search, Database } from 'lucide-react';
import { TabType, UserProfile } from '../types';
import { GlobalSearchModal } from './GlobalSearchModal';
import { BackupRestoreModal } from './BackupRestoreModal';

interface HeaderNavProps {
  currentUser: UserProfile;
  activeTab: TabType | null;
  setActiveTab: (tab: TabType | null) => void;
  onLogout: () => void;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onLogout,
  showToast = () => {},
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-40 font-['Cairo',sans-serif]">
        {/* Top Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
            {/* Right Side in RTL: User Name, Email, and Actions */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="text-right">
                <span className="text-sm font-black text-[#1e293b] block leading-tight">{currentUser.name}</span>
                <p className="text-xs text-slate-500 font-medium">{currentUser.email}</p>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2">
                {/* Search Button */}
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="البحث الشامل في المنظومة"
                >
                  <Search className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">بحث شامل</span>
                </button>

                {/* Backup & Restore Button (Only for Admin) */}
                {currentUser.role === 'admin' && (
                  <button
                    onClick={() => setIsBackupOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="النسخ الاحتياطي والاسترجاع"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">نسخة احتياطية</span>
                  </button>
                )}

                {/* Logout Button */}
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>خروج</span>
                </button>
              </div>
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

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
      />

      {/* Backup and Restore Modal */}
      <BackupRestoreModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        currentUser={currentUser}
        showToast={showToast}
      />
    </>
  );
};
