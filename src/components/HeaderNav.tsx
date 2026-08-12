import React from 'react';
import {
  LogOut,
  Building2,
  ArrowRight
} from 'lucide-react';
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
  return (
    <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-40 font-['Cairo',sans-serif]">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center justify-between gap-4">
          {/* Logo & Portal Name */}
          <div
            onClick={() => setActiveTab(null)}
            className="flex items-center gap-3 cursor-pointer group"
            title="العودة للبطاقات الرئيسية"
          >
            <div className="w-9 h-9 rounded-lg bg-[#1e293b] text-white flex items-center justify-center font-bold text-lg border border-slate-800 shadow-sm shrink-0 group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors">
              <Building2 className="w-5 h-5 text-amber-400 group-hover:text-slate-900 transition-colors" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0f172a] leading-tight group-hover:text-amber-600 transition-colors">
                بوابة أرتياتك
              </h1>
              <p className="text-xs text-slate-500 font-bold">استوديو أرتياتك للأعمال الفنية والتقنية</p>
            </div>
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center gap-3">
            <div className="text-left sm:text-right hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-[#1e293b]">{currentUser.name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${
                    currentUser.role === 'admin'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  {currentUser.role === 'admin' ? 'أدمن' : 'عضو'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">{currentUser.email}</p>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

