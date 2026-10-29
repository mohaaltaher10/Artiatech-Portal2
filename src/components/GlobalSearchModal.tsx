import React, { useState, useEffect } from 'react';
import { Search, X, FolderKanban, Receipt, Users, Megaphone, FileText, CheckCircle2, PieChart, ArrowLeft } from 'lucide-react';
import { db } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';
import { TabType } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: TabType) => void;
}

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  tab: TabType;
  icon: any;
  colorClass: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allData, setAllData] = useState<{
    transactions: any[];
    booklets: any[];
    plans: any[];
    users: any[];
    announcements: any[];
    slices: any[];
  }>({
    transactions: [],
    booklets: [],
    plans: [],
    users: [],
    announcements: [],
    slices: []
  });

  useEffect(() => {
    if (!isOpen) return;

    // Fetch snapshot of nodes for fast search
    const txRef = ref(db, 'treasury_transactions');
    const bookRef = ref(db, 'project_booklets');
    const planRef = ref(db, 'plans');
    const usersRef = ref(db, 'users');
    const annRef = ref(db, 'announcements');
    const slicesRef = ref(db, 'distribution_fund');

    const unsubs: Array<() => void> = [];

    unsubs.push(onValue(txRef, (snap) => {
      const val = snap.val() || {};
      setAllData(prev => ({ ...prev, transactions: Object.values(val) }));
    }));

    unsubs.push(onValue(bookRef, (snap) => {
      const val = snap.val() || {};
      setAllData(prev => ({ ...prev, booklets: Object.values(val) }));
    }));

    unsubs.push(onValue(planRef, (snap) => {
      const val = snap.val() || {};
      setAllData(prev => ({ ...prev, plans: Object.values(val) }));
    }));

    unsubs.push(onValue(usersRef, (snap) => {
      const val = snap.val() || {};
      setAllData(prev => ({ ...prev, users: Object.values(val) }));
    }));

    unsubs.push(onValue(annRef, (snap) => {
      const val = snap.val() || {};
      setAllData(prev => ({ ...prev, announcements: Object.values(val) }));
    }));

    unsubs.push(onValue(slicesRef, (snap) => {
      const val = snap.val() || {};
      setAllData(prev => ({ ...prev, slices: Object.values(val) }));
    }));

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const query = searchTerm.trim().toLowerCase();
  const results: SearchResultItem[] = [];

  if (query.length >= 1) {
    // Search Transactions
    allData.transactions.forEach((tx) => {
      const text = `${tx.description || ''} ${tx.recipient || ''} ${tx.amount || ''} ${tx.locationName || ''}`.toLowerCase();
      if (text.includes(query)) {
        results.push({
          id: tx.id || Math.random().toString(),
          title: tx.description || 'عملية مالية',
          subtitle: `${tx.amount} د.ل • ${tx.type === 'income' ? 'إيراد' : tx.type === 'expense' ? 'مصروف' : 'تحويل'} • ${tx.date || ''}`,
          category: 'الخزينة والمالية',
          tab: 'treasury',
          icon: Receipt,
          colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200'
        });
      }
    });

    // Search Booklets
    allData.booklets.forEach((b) => {
      const text = `${b.name || ''} ${b.content || ''}`.toLowerCase();
      if (text.includes(query)) {
        results.push({
          id: b.id || Math.random().toString(),
          title: b.name || 'كتيب مشروع',
          subtitle: `الحالة: ${b.status || 'نشط'} • التاريخ: ${b.startDate || ''}`,
          category: 'كتيبات المشاريع',
          tab: 'booklets',
          icon: FolderKanban,
          colorClass: 'text-purple-600 bg-purple-50 border-purple-200'
        });
      }
    });

    // Search Plans
    allData.plans.forEach((p) => {
      const text = `${p.title || ''} ${p.description || ''} ${p.responsible || ''}`.toLowerCase();
      if (text.includes(query)) {
        results.push({
          id: p.id || Math.random().toString(),
          title: p.title || 'خطة عمل',
          subtitle: `المسؤول: ${p.responsible || 'غير محدد'} • الموعد: ${p.deadline || ''}`,
          category: 'الخطط والمهام',
          tab: 'plans',
          icon: CheckCircle2,
          colorClass: 'text-amber-600 bg-amber-50 border-amber-200'
        });
      }
    });

    // Search Users
    allData.users.forEach((u) => {
      const text = `${u.name || ''} ${u.email || ''}`.toLowerCase();
      if (text.includes(query)) {
        results.push({
          id: u.id || Math.random().toString(),
          title: u.name || 'عضو',
          subtitle: `${u.email || ''} • ${u.role === 'admin' ? 'مدير' : 'عضو'}`,
          category: 'إدارة الأعضاء',
          tab: 'members',
          icon: Users,
          colorClass: 'text-blue-600 bg-blue-50 border-blue-200'
        });
      }
    });

    // Search Announcements
    allData.announcements.forEach((a) => {
      const text = `${a.title || ''} ${a.content || ''}`.toLowerCase();
      if (text.includes(query)) {
        results.push({
          id: a.id || Math.random().toString(),
          title: a.title || 'إعلان',
          subtitle: `${a.createdDate || ''} • بواسطة ${a.createdBy || 'الإدارة'}`,
          category: 'الإعلانات',
          tab: 'announcements',
          icon: Megaphone,
          colorClass: 'text-rose-600 bg-rose-50 border-rose-200'
        });
      }
    });

    // Search Slices
    allData.slices.forEach((s) => {
      const text = `${s.name || ''} ${s.description || ''}`.toLowerCase();
      if (text.includes(query)) {
        results.push({
          id: s.id || Math.random().toString(),
          title: s.name || 'شريحة توزيع',
          subtitle: `إجمالي المبلغ: ${s.totalAmount || 0} د.ل`,
          category: 'صندوق التوزيع',
          tab: 'distribution',
          icon: PieChart,
          colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200'
        });
      }
    });
  }

  const handleSelectResult = (tab: TabType) => {
    onNavigate(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4 dir-rtl animate-fadeIn font-['Cairo',sans-serif]">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3 flex-1 bg-slate-800/80 px-3.5 py-2.5 rounded-xl border border-slate-700">
            <Search className="w-5 h-5 text-amber-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث عن أي معاملة مالية، عضو، خطة، مشروع، أو إعلان..."
              className="bg-transparent text-white placeholder-slate-400 text-sm focus:outline-none w-full font-medium"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-white text-xs cursor-pointer p-1"
              >
                تفريغ
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Results Area */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {!searchTerm.trim() ? (
            <div className="text-center py-10 text-slate-400 space-y-2">
              <Search className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="text-sm font-bold text-slate-600">اكتب كلمة البحث لفتح كافة نتائج المنظومة</p>
              <p className="text-xs text-slate-400">مثال: "مصروف"، "أرتياتك"، "سند"، "أحمد"، "مشروع"</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-10 text-slate-400 space-y-2">
              <FileText className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="text-sm font-bold text-slate-700">لم يتم العثور على أي نتائج تطابق "{searchTerm}"</p>
              <p className="text-xs text-slate-400">تأكد من كتابة أصل الكلمة أو جرب مصطلحاً آخر.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-black text-slate-500 mb-2 px-1">
                عثرنا على ({results.length}) نتيجة تطابق بحثك:
              </p>
              {results.slice(0, 30).map((res) => {
                const IconComponent = res.icon;
                return (
                  <div
                    key={res.id + res.category}
                    onClick={() => handleSelectResult(res.tab)}
                    className="p-3.5 bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border ${res.colorClass} shrink-0`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-800 group-hover:text-amber-900">
                            {res.title}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                            {res.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{res.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>الانتقال</span>
                      <ArrowLeft className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 text-center text-[11px] font-bold text-slate-500">
          البحث الشامل يستعرض البيانات من جميع الأقسام فورياً ⚡
        </div>
      </div>
    </div>
  );
};
