import React, { useRef } from 'react';
import {
  Wallet,
  PieChart,
  BookOpen,
  Megaphone,
  MapPin,
  History,
  Users,
  LayoutDashboard,
  User,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Building2,
  Sparkles,
  ShieldCheck,
  ScrollText
} from 'lucide-react';
import { TabType, UserProfile } from '../types';
import { motion } from 'motion/react';

interface TabCardsViewProps {
  currentUser: UserProfile;
  onSelectTab: (tab: TabType) => void;
}

export interface TabCardItem {
  id: TabType;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badge: string;
  accentColor: string;
  bgGradient: string;
}

export const tabCardsData: TabCardItem[] = [
  {
    id: 'dashboard',
    title: 'الصفحة الرئيسية',
    subtitle: '',
    icon: LayoutDashboard,
    badge: 'الرئيسية',
    accentColor: 'text-indigo-600 border-indigo-200 bg-indigo-50',
    bgGradient: 'from-indigo-500/10 via-slate-50 to-white'
  },
  {
    id: 'treasury',
    title: 'الخزينة والميزانية',
    subtitle: '',
    icon: Wallet,
    badge: 'المالية',
    accentColor: 'text-emerald-600 border-emerald-200 bg-emerald-50',
    bgGradient: 'from-emerald-500/10 via-slate-50 to-white'
  },
  {
    id: 'distribution',
    title: 'صندوق التوزيعات والشرائح',
    subtitle: '',
    icon: PieChart,
    badge: 'الشرائح',
    accentColor: 'text-amber-600 border-amber-200 bg-amber-50',
    bgGradient: 'from-amber-500/10 via-slate-50 to-white'
  },
  {
    id: 'booklets',
    title: 'كتيبات المشاريع',
    subtitle: '',
    icon: BookOpen,
    badge: 'المشاريع',
    accentColor: 'text-blue-600 border-blue-200 bg-blue-50',
    bgGradient: 'from-blue-500/10 via-slate-50 to-white'
  },
  {
    id: 'plans',
    title: 'الخطط وخارطة الطريق',
    subtitle: '',
    icon: MapPin,
    badge: 'خارطة الطريق',
    accentColor: 'text-purple-600 border-purple-200 bg-purple-50',
    bgGradient: 'from-purple-500/10 via-slate-50 to-white'
  },
  {
    id: 'announcements',
    title: 'الإعلانات الرسمية',
    subtitle: '',
    icon: Megaphone,
    badge: 'التنويهات',
    accentColor: 'text-rose-600 border-rose-200 bg-rose-50',
    bgGradient: 'from-rose-500/10 via-slate-50 to-white'
  },
  {
    id: 'members',
    title: 'أعضاء الاستوديو',
    subtitle: '',
    icon: Users,
    badge: 'الفريق',
    accentColor: 'text-cyan-600 border-cyan-200 bg-cyan-50',
    bgGradient: 'from-cyan-500/10 via-slate-50 to-white'
  },
  {
    id: 'activity',
    title: 'سجل النشاطات',
    subtitle: '',
    icon: History,
    badge: 'الرقابة',
    accentColor: 'text-[#1e293b] border-slate-300 bg-slate-100',
    bgGradient: 'from-slate-500/10 via-slate-50 to-white'
  },
  {
    id: 'bylaws',
    title: 'اللائحة الداخلية',
    subtitle: '',
    icon: ScrollText,
    badge: 'اللوائح',
    accentColor: 'text-amber-700 border-amber-300 bg-amber-50',
    bgGradient: 'from-amber-500/10 via-slate-50 to-white'
  },
  {
    id: 'profile',
    title: 'الملف الشخصي',
    subtitle: '',
    icon: User,
    badge: 'حسابي',
    accentColor: 'text-teal-600 border-teal-200 bg-teal-50',
    bgGradient: 'from-teal-500/10 via-slate-50 to-white'
  }
];

export const TabCardsView: React.FC<TabCardsViewProps> = ({ currentUser, onSelectTab }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6 py-2 font-['Cairo',sans-serif]">
      {/* Banner Intro */}
      <div className="bg-[#1e293b] text-white rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              أهلاً بك، {currentUser.name}
            </h1>
          </div>
        </div>
      </div>

      {/* Section Header & Control Buttons */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-lg font-black text-[#0f172a] flex items-center gap-2">
            <span>التبويبات والأقسام الرئيسية</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('right')}
            className="p-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl shadow-sm transition-all duration-150 active:scale-95 cursor-pointer"
            title="تمرير لليمين"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll('left')}
            className="p-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl shadow-sm transition-all duration-150 active:scale-95 cursor-pointer"
            title="تمرير لليسار"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Large Horizontal Scroll Cards Container */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-5 overflow-x-auto pb-6 pt-2 scrollbar-none snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabCardsData.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              onClick={() => onSelectTab(card.id)}
              className={`snap-start min-w-[290px] sm:min-w-[340px] max-w-[360px] bg-white border-2 border-slate-200 hover:border-[#1e293b] rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden bg-gradient-to-br ${card.bgGradient}`}
            >
              <div className="space-y-4">
                {/* Top Badge & Icon */}
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-xl border ${card.accentColor} shrink-0 group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 bg-white/80 border border-slate-200 px-3 py-1 rounded-full shadow-2xs">
                    {card.badge}
                  </span>
                </div>

                {/* Title */}
                <div>
                  <h3 className="text-lg font-black text-[#0f172a] group-hover:text-amber-600 transition-colors leading-snug">
                    {card.title}
                  </h3>
                  {card.subtitle && (
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      {card.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Button at bottom */}
              <div className="pt-5 mt-4 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-xs font-black text-[#1e293b] group-hover:text-amber-600 transition-colors">
                  افتح الصفحة الآن
                </span>
                <div className="w-8 h-8 rounded-full bg-[#1e293b] text-amber-400 group-hover:bg-amber-400 group-hover:text-[#1e293b] flex items-center justify-center transition-all duration-200 shadow-sm">
                  <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-0.5 transition-transform" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
