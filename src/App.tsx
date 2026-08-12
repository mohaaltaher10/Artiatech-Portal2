import React, { useEffect, useState } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { ref, onValue, set } from 'firebase/database';
import { UserProfile, TabType } from './types';
import { Login } from './components/Login';
import { HeaderNav } from './components/HeaderNav';
import { Toast } from './components/Toast';
import { TabCardsView, tabCardsData } from './components/TabCardsView';
import { ArrowRight, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { DashboardView } from './components/DashboardView';
import { ProfileView } from './components/ProfileView';
import { TreasuryView } from './components/TreasuryView';
import { DistributionFundView } from './components/DistributionFundView';
import { ProjectBookletsView } from './components/ProjectBookletsView';
import { AnnouncementsView } from './components/AnnouncementsView';
import { PlansView } from './components/PlansView';
import { ActivityLogsView } from './components/ActivityLogsView';
import { MembersView } from './components/MembersView';
import { BylawsView } from './components/BylawsView';
import { FrozenOverlay } from './components/FrozenOverlay';

export default function App() {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType | null>(null);

  // Toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setCurrentUserProfile(null);
        setLoading(false);
        return;
      }

      // Listen to RTDB user profile
      const userRef = ref(db, `users/${user.uid}`);
      const unsubscribeDoc = onValue(userRef, async (snap) => {
        const data = snap.val();
        if (data) {
          setCurrentUserProfile({ id: user.uid, ...data } as UserProfile);
        } else {
          // Create default profile if missing
          const cleanEmail = (user.email || '').toLowerCase();
          const isAdmin = cleanEmail === 'artiatechstudio@gmail.com';
          const newProfile: UserProfile = {
            id: user.uid,
            name: isAdmin ? 'إدارة استوديو أرتياتك' : user.displayName || 'عضو أرتياتك',
            email: cleanEmail,
            role: isAdmin ? 'admin' : 'member',
            status: 'main',
            joinDate: new Date().toISOString().split('T')[0],
            sliceBalances: {}
          };
          try {
            await set(userRef, newProfile);
          } catch (e) {
            console.warn('Notice setting initial profile in RTDB:', e);
          }
          setCurrentUserProfile(newProfile);
        }
        setLoading(false);
      }, (error) => {
        console.warn('Notice reading profile from RTDB:', error);
        // Fallback user profile so app remains accessible
        const cleanEmail = (user.email || '').toLowerCase();
        const isAdmin = cleanEmail === 'artiatechstudio@gmail.com';
        setCurrentUserProfile({
          id: user.uid,
          name: isAdmin ? 'إدارة استوديو أرتياتك' : user.displayName || 'عضو أرتياتك',
          email: cleanEmail,
          role: isAdmin ? 'admin' : 'member',
          status: 'main',
          joinDate: new Date().toISOString().split('T')[0],
          sliceBalances: {}
        });
        setLoading(false);
      });

      return () => unsubscribeDoc();
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUserProfile(null);
      setAuthUser(null);
      showToast('تم تسجيل الخروج بنجاح', 'success');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 dir-rtl font-['Cairo',sans-serif]">
        <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm text-center max-w-sm w-full space-y-3">
          <div className="w-10 h-10 border-4 border-[#1e293b] border-t-slate-400 rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-black text-[#0f172a]">بوابة أرتياتك - Artiatech Portal</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Login Page
  if (!authUser || !currentUserProfile) {
    return <Login onSuccess={() => setToastMsg(null)} />;
  }

  const currentTabCard = tabCardsData.find((c) => c.id === activeTab);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] dir-rtl font-['Cairo',sans-serif] pb-12">
      {/* Toast Notification */}
      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />

      {/* Frozen Overlay for Frozen Accounts */}
      {currentUserProfile.status === 'frozen' && (
        <FrozenOverlay currentUser={currentUserProfile} showToast={showToast} />
      )}

      {/* Top Header & Moving Navigation Bar */}
      <HeaderNav
        currentUser={currentUserProfile}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pt-4 sm:pt-6 overflow-x-hidden">
        <AnimatePresence mode="wait">
          {activeTab === null ? (
            <motion.div
              key="cards-overview"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <TabCardsView currentUser={currentUserProfile} onSelectTab={(tab) => setActiveTab(tab)} />
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-4"
            >
              {/* Top Back Navigation Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
                <button
                  onClick={() => setActiveTab(null)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 font-black text-xs rounded-lg transition-all shadow-2xs cursor-pointer group self-start sm:self-auto"
                >
                  <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
                  <span>رجوع إلى التبويبات الرئيسية</span>
                </button>

                {currentTabCard && (
                  <div className="flex items-center gap-2 text-xs font-black text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                    <LayoutGrid className="w-4 h-4 text-slate-500" />
                    <span>القسم المفتوح:</span>
                    <span className="text-slate-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-md font-bold">
                      {currentTabCard.title}
                    </span>
                  </div>
                )}
              </div>

              {/* Opened Page Component */}
              <div>
                {activeTab === 'dashboard' && (
                  <DashboardView currentUser={currentUserProfile} onSelectTab={(tab) => setActiveTab(tab)} />
                )}
                {activeTab === 'profile' && <ProfileView currentUser={currentUserProfile} showToast={showToast} />}
                {activeTab === 'treasury' && <TreasuryView currentUser={currentUserProfile} showToast={showToast} />}
                {activeTab === 'distribution' && (
                  <DistributionFundView currentUser={currentUserProfile} showToast={showToast} />
                )}
                {activeTab === 'booklets' && (
                  <ProjectBookletsView currentUser={currentUserProfile} showToast={showToast} />
                )}
                {activeTab === 'announcements' && (
                  <AnnouncementsView currentUser={currentUserProfile} showToast={showToast} />
                )}
                {activeTab === 'plans' && <PlansView currentUser={currentUserProfile} showToast={showToast} />}
                {activeTab === 'activity' && <ActivityLogsView currentUser={currentUserProfile} />}
                {activeTab === 'members' && <MembersView currentUser={currentUserProfile} showToast={showToast} />}
                {activeTab === 'bylaws' && <BylawsView currentUser={currentUserProfile} showToast={showToast} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

