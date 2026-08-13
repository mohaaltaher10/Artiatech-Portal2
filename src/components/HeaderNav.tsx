import React, { useState, useEffect } from 'react';
import { LogOut, Bell, X, Check } from 'lucide-react';
import { TabType, UserProfile } from '../types';
import { isNotificationSupported, getNotificationPermission, requestNotificationPermission } from '../lib/notifications';

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
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(getNotificationPermission());
  const [notifDismissedSession, setNotifDismissedSession] = useState<boolean>(
    sessionStorage.getItem('notif_prompt_dismissed_session') === 'true'
  );

  useEffect(() => {
    // Keep notification permission state in sync
    const checkPermission = () => {
      setNotifPermission(getNotificationPermission());
    };
    checkPermission();
    window.addEventListener('focus', checkPermission);
    return () => window.removeEventListener('focus', checkPermission);
  }, []);

  const handleEnableNotifications = async () => {
    if (getNotificationPermission() === 'denied') {
      alert('تم حظر الإشعارات من إعدادات المتصفح سابقاً. يرجى السماح بها من إعدادات الموقع/المتصفح (رمز القفل بجانب الرابط).');
      setNotifDismissedSession(true);
      sessionStorage.setItem('notif_prompt_dismissed_session', 'true');
      return;
    }
    const granted = await requestNotificationPermission();
    setNotifPermission(getNotificationPermission());
    setNotifDismissedSession(true);
    sessionStorage.setItem('notif_prompt_dismissed_session', 'true');
  };

  const handleDismissPrompt = () => {
    setNotifDismissedSession(true);
    sessionStorage.setItem('notif_prompt_dismissed_session', 'true');
  };

  // Show prompt if notifications are supported AND not granted AND not dismissed in current session
  const shouldShowPrompt =
    isNotificationSupported() &&
    notifPermission !== 'granted' &&
    !notifDismissedSession;

  return (
    <>
      <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-40 font-['Cairo',sans-serif]">
        {/* Top Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center justify-between gap-4">
            {/* Right Side in RTL: User Name, Email, and Logout Button */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-sm font-black text-[#1e293b] block leading-tight">{currentUser.name}</span>
                <p className="text-xs text-slate-500 font-medium">{currentUser.email}</p>
              </div>

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

      {/* Floating Bottom Popup Modal for Enabling Notifications */}
      {shouldShowPrompt && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-xs z-50 bg-[#0f172a] text-white rounded-2xl p-3.5 shadow-2xl border border-amber-500/30 font-['Cairo',sans-serif] dir-rtl animate-bounce-subtle">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl shrink-0">
                <Bell className="w-4 h-4 animate-pulse" />
              </div>
              <h4 className="text-sm font-black text-amber-300">الإشعارات</h4>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleEnableNotifications}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-md shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>تفعيل</span>
              </button>
              <button
                onClick={handleDismissPrompt}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


