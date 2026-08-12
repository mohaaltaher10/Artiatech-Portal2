import React, { useEffect, useState } from 'react';
import { db, formatCurrency, formatDate } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';
import {
  TabType,
  UserProfile,
  TreasuryLocation,
  DistributionFundSlice,
  ProjectBooklet,
  Announcement,
  PlanItem,
  ActivityLog
} from '../types';
import {
  Wallet,
  PieChart,
  BookOpen,
  Megaphone,
  History,
  ArrowLeft,
  Pin,
  MapPin,
  Clock,
  Eye,
  X
} from 'lucide-react';

interface DashboardViewProps {
  currentUser: UserProfile;
  onSelectTab?: (tab: TabType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ currentUser, onSelectTab }) => {
  const [locations, setLocations] = useState<TreasuryLocation[]>([]);
  const [slices, setSlices] = useState<DistributionFundSlice[]>([]);
  const [booklets, setBooklets] = useState<ProjectBooklet[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    // 1. Fetch Treasury Locations
    const unsubTreasury = onValue(ref(db, 'treasury_locations'), (snapshot) => {
      const val = snapshot.val();
      const list: TreasuryLocation[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      setLocations(list);
    }, (err) => console.warn('Treasury locations read notice:', err));

    // 2. Fetch Distribution Slices
    const unsubSlices = onValue(ref(db, 'distribution_fund'), (snapshot) => {
      const val = snapshot.val();
      const list: DistributionFundSlice[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      setSlices(list);
    }, (err) => console.warn('Distribution fund read notice:', err));

    // 3. Fetch Booklets
    const unsubBooklets = onValue(ref(db, 'project_booklets'), (snapshot) => {
      const val = snapshot.val();
      const list: ProjectBooklet[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      setBooklets(list);
    }, (err) => console.warn('Project booklets read notice:', err));

    // 4. Fetch Latest 5 Announcements
    const unsubAnn = onValue(ref(db, 'announcements'), (snapshot) => {
      const val = snapshot.val();
      const list: Announcement[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      list.sort((a, b) => new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime());
      setAnnouncements(list.slice(0, 5));
    }, (err) => console.warn('Announcements read notice:', err));

    // 5. Fetch Plans
    const unsubPlans = onValue(ref(db, 'plans'), (snapshot) => {
      const val = snapshot.val();
      const list: PlanItem[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      setPlans(list);
    }, (err) => console.warn('Plans read notice:', err));

    // 6. Fetch Last 10 Activity Logs
    const unsubAct = onValue(ref(db, 'activity_logs'), (snapshot) => {
      const val = snapshot.val();
      const list: ActivityLog[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      list.sort((a, b) => {
        const tA = typeof a.createdAt === 'number' ? a.createdAt : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const tB = typeof b.createdAt === 'number' ? b.createdAt : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return tB - tA;
      });
      setActivities(list.slice(0, 10));
      setLoading(false);
    }, (err) => {
      console.warn('Activity logs read notice:', err);
      setLoading(false);
    });

    return () => {
      unsubTreasury();
      unsubSlices();
      unsubBooklets();
      unsubAnn();
      unsubPlans();
      unsubAct();
    };
  }, []);

  const totalTreasuryBalance = locations.reduce((sum, loc) => sum + (loc.balance || 0), 0);
  const totalFundBalance = slices.reduce((sum, sl) => sum + (sl.totalAmount || 0), 0);
  const myBookletsCount = booklets.filter((b) =>
    b.teamMembers?.some((m) => m.userId === currentUser.id)
  ).length;
  const activeBookletsTotal = booklets.filter((b) => b.status === 'active').length;
  const latestAnnouncement = announcements[0];

  const activePlans = plans.filter((p) => p.status === 'in_progress' || p.status === 'planned').slice(0, 5);

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-500 font-bold">
        جاري تحميل بيانات لوحة التحكم...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4 Stat Cards in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Treasury */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">إجمالي الخزينة</span>
            <div className="p-2 bg-slate-100 border border-slate-200 rounded text-slate-800">
              <Wallet className="w-4 h-4 text-[#1e293b]" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#1e293b] dir-ltr text-right">
            {formatCurrency(totalTreasuryBalance)}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-bold">
            موزعة على {locations.length} حساب وخزينة
          </p>
        </div>

        {/* Card 2: Distribution Fund */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">إجمالي صندوق التوزيعات</span>
            <div className="p-2 bg-slate-100 border border-slate-200 rounded text-slate-800">
              <PieChart className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#1e293b] dir-ltr text-right">
            {formatCurrency(totalFundBalance)}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-bold">
            مقسمة في {slices.length} شرائح
          </p>
        </div>

        {/* Card 3: Assigned Booklets */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">كتيبات المشاريع</span>
            <div className="p-2 bg-slate-100 border border-slate-200 rounded text-slate-800">
              <BookOpen className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#1e293b]">
            {myBookletsCount} <span className="text-xs font-bold text-slate-500">مسندة لك</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-bold">
            إجمالي المشاريع النشطة: {activeBookletsTotal}
          </p>
        </div>

        {/* Card 4: Plans (استبدال مربع آخر الإعلانات) */}
        <div
          onClick={() => onSelectTab && onSelectTab('plans')}
          className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">الخطط وخارطة الطريق</span>
            <div className="p-2 bg-slate-100 border border-slate-200 rounded text-slate-800">
              <MapPin className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#1e293b]">
            {activePlans.length} <span className="text-xs font-bold text-slate-500">خطة نشطة</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-bold">
            إجمالي الخطط: {plans.length}
          </p>
        </div>
      </div>

      {/* Middle Grid: Activity Logs (60%) & Announcements (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Right Section (60%): Activity Logs */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#1e293b]" />
              <h2 className="text-base font-black text-[#0f172a]">آخر الأحداث</h2>
            </div>
            {onSelectTab && (
              <button
                onClick={() => onSelectTab('activity')}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-xs font-black transition-colors cursor-pointer"
              >
                <span>عرض الكل</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {activities.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6 font-medium">لا توجد بيانات بعد</p>
          ) : (
            <div className="space-y-2.5">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 bg-slate-50 border-r-4 border-[#1e293b] border-y border-l border-slate-200 rounded-sm text-xs flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#0f172a]">{act.details}</div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      بواسطة: <span className="font-bold text-slate-800">{act.userName}</span> ({act.userRole === 'admin' ? 'أدمن' : 'عضو'})
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-bold whitespace-nowrap dir-ltr">
                    {act.timestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Left Section (40%): Announcements */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#1e293b]" />
              <h2 className="text-base font-black text-[#0f172a]">آخر الإعلانات الرسمية</h2>
            </div>
            {onSelectTab && (
              <button
                onClick={() => onSelectTab('announcements')}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-xs font-black transition-colors cursor-pointer"
              >
                <span>عرض الكل</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {announcements.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6 font-medium">لا توجد بيانات بعد</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  onClick={() => setSelectedAnnouncement(ann)}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-xs space-y-1.5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-[#0f172a] flex items-center gap-1.5">
                      {ann.isPinned && <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                      {ann.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                      {ann.createdDate}
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs line-clamp-2 leading-relaxed font-medium">
                    {ann.content}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 font-bold">
                    <span>الناشر: {ann.createdBy || 'الإدارة'}</span>
                    <span className="text-slate-700 font-bold hover:underline">عرض التفاصيل ←</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Active Plans */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#1e293b]" />
            <h2 className="text-base font-black text-[#0f172a]">الخطط النشطة والجارية</h2>
          </div>
          <span className="text-xs text-slate-500 font-bold">خارطة الطريق</span>
        </div>

        {activePlans.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 font-medium">لا توجد بيانات بعد</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activePlans.map((plan) => (
              <div
                key={plan.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-[#0f172a]">{plan.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                      plan.status === 'in_progress'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {plan.status === 'in_progress' ? 'جارية 🔄' : 'مخططة 📋'}
                  </span>
                </div>
                <p className="text-slate-600 font-medium line-clamp-2">{plan.description}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200 font-bold">
                  <span>المسؤول: {plan.responsible || 'غير محدد'}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(plan.deadline)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-[#1e293b] text-white p-4 flex items-center justify-between">
              <h3 className="font-black text-sm flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-400" />
                <span>{selectedAnnouncement.title}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="text-xs text-slate-500 font-bold border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>الناشر: <strong className="text-slate-900">{selectedAnnouncement.createdBy || 'الإدارة'}</strong></span>
                <span>التاريخ: {selectedAnnouncement.createdDate}</span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                {selectedAnnouncement.content}
              </p>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="px-4 py-1.5 bg-[#1e293b] text-amber-400 text-xs font-black rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
