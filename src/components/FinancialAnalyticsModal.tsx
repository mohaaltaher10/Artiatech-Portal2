import React from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TreasuryTransaction, TreasuryLocation } from '../types';
import { formatCurrency } from '../lib/firebase';

interface FinancialAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: TreasuryTransaction[];
  locations: TreasuryLocation[];
}

export const FinancialAnalyticsModal: React.FC<FinancialAnalyticsModalProps> = ({
  isOpen,
  onClose,
  transactions,
  locations,
}) => {
  if (!isOpen) return null;

  // Compute analytics
  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransfer = 0;

  const categoryExpenses: Record<string, number> = {};
  const locationBalances: Record<string, number> = {};

  locations.forEach((loc) => {
    locationBalances[loc.name || 'خزانة'] = loc.balance || 0;
  });

  transactions.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amt;
    } else if (tx.type === 'expense') {
      totalExpense += amt;
      const cat = tx.category || 'مصروفات عامة';
      categoryExpenses[cat] = (categoryExpenses[cat] || 0) + amt;
    } else if (tx.type === 'transfer') {
      totalTransfer += amt;
    }
  });

  const netBalance = totalIncome - totalExpense;
  const totalAssetsBalance = locations.reduce((acc, l) => acc + (l.balance || 0), 0);
  const maxExpenseCat = Math.max(...Object.values(categoryExpenses), 1);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl font-['Cairo',sans-serif] animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-300">التحليلات المالية والرسوم البيانية المقارنة</h3>
              <p className="text-xs text-slate-400">ملخص وشاشات تتبع الإيرادات، المصروفات، وتوزيع السيولة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Summary Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-emerald-800 font-bold text-xs">
                <span>إجمالي الإيرادات المسجلة</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-lg font-black text-emerald-900">{formatCurrency(totalIncome)}</p>
              <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>المقبوضات المالية</span>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-rose-800 font-bold text-xs">
                <span>إجمالي المصروفات والنفقات</span>
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-lg font-black text-rose-900">{formatCurrency(totalExpense)}</p>
              <div className="flex items-center gap-1 text-[11px] text-rose-700 font-medium">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>المدفوعات والمصارف</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-amber-800 font-bold text-xs">
                <span>الرصيد الفعلي الحالي بالأرصدة</span>
                <DollarSign className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-lg font-black text-slate-900">{formatCurrency(totalAssetsBalance)}</p>
              <p className="text-[11px] text-slate-600 font-bold">صافي الفارق (إيراد - مصروف): {formatCurrency(netBalance)}</p>
            </div>
          </div>

          {/* Income vs Expenses Comparative Bar */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-600" />
              <span>مقارنة نسبة الإيراد إلى المصروف</span>
            </h4>
            {totalIncome + totalExpense === 0 ? (
              <p className="text-xs text-slate-500 font-medium text-center py-4">لا توجد حركات مالية مسجلة بعد للحساب.</p>
            ) : (
              <div className="space-y-2">
                <div className="h-6 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    style={{
                      width: `${Math.round((totalIncome / (totalIncome + totalExpense)) * 100)}%`
                    }}
                    className="bg-emerald-500 text-white font-black text-[10px] flex items-center justify-center transition-all"
                  >
                    {Math.round((totalIncome / (totalIncome + totalExpense)) * 100)}% إيرادات
                  </div>
                  <div
                    style={{
                      width: `${Math.round((totalExpense / (totalIncome + totalExpense)) * 100)}%`
                    }}
                    className="bg-rose-500 text-white font-black text-[10px] flex items-center justify-center transition-all"
                  >
                    {Math.round((totalExpense / (totalIncome + totalExpense)) * 100)}% مصروفات
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Expenses Breakdown Graph */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-xs">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">توزيع المصروفات حسب التصنيف / البند</h4>
            {Object.keys(categoryExpenses).length === 0 ? (
              <p className="text-xs text-slate-400 font-medium py-3 text-center">لم يتم تسجيل أية مصروفات مبوبة حتى الآن.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(categoryExpenses).map(([cat, amt]) => {
                  const pct = Math.round((amt / maxExpenseCat) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>{cat}</span>
                        <span className="text-rose-600">{formatCurrency(amt)}</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-rose-500 rounded-full transition-all"
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 p-3 border-t border-slate-200 text-center">
          <button
            onClick={onClose}
            className="px-6 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-lg transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
