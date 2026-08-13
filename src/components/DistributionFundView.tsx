import React, { useEffect, useState } from 'react';
import { db, formatCurrency, logActivity, generateReadableId } from '../lib/firebase';
import { sendAppNotification } from '../lib/notifications';
import { ref, onValue, set, remove, update } from 'firebase/database';
import { DistributionFundSlice, SliceMember, UserProfile, DistributionFundLog } from '../types';
import {
  PieChart,
  PlusCircle,
  Users,
  Trash2,
  X,
  Plus,
  Printer,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  FileText,
  Copy,
  CheckCircle2,
  Coins
} from 'lucide-react';

interface DistributionFundViewProps {
  currentUser: UserProfile;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const DistributionFundView: React.FC<DistributionFundViewProps> = ({
  currentUser,
  showToast,
}) => {
  const [slices, setSlices] = useState<DistributionFundSlice[]>([]);
  const [logs, setLogs] = useState<DistributionFundLog[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State: New Slice
  const [showAddForm, setShowAddForm] = useState(false);
  const [sliceName, setSliceName] = useState('');
  const [sliceDescription, setSliceDescription] = useState('');
  const [sliceTotalAmount, setSliceTotalAmount] = useState<number>(0);
  const [selectedMembers, setSelectedMembers] = useState<
    { userId: string; userName: string; shares: number }[]
  >([]);

  // Submitting state & Modals
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmSlice, setDeleteConfirmSlice] = useState<{ id: string; name: string } | null>(null);

  // Recharge Modal State
  const [rechargeSlice, setRechargeSlice] = useState<DistributionFundSlice | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState<number>(0);
  const [rechargeNote, setRechargeNote] = useState<string>('');

  // Withdrawal Modal State
  const [withdrawModal, setWithdrawModal] = useState<{ slice: DistributionFundSlice; member: SliceMember } | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [withdrawNote, setWithdrawNote] = useState<string>('');

  // PDF Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [copiedReportText, setCopiedReportText] = useState(false);

  useEffect(() => {
    // 1. Listen to distribution fund
    const unsubSlices = onValue(
      ref(db, 'distribution_fund'),
      (snapshot) => {
        const val = snapshot.val();
        const list: DistributionFundSlice[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
        setSlices(list);
      },
      (err) => console.warn('Distribution fund listener notice:', err)
    );

    // 2. Listen to distribution fund financial logs
    const unsubLogs = onValue(
      ref(db, 'distribution_fund_logs'),
      (snapshot) => {
        const val = snapshot.val();
        const list: DistributionFundLog[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
        list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        setLogs(list);
      },
      (err) => console.warn('Distribution logs listener notice:', err)
    );

    // 3. Listen to users to select members for slices
    const unsubUsers = onValue(
      ref(db, 'users'),
      (snapshot) => {
        const val = snapshot.val();
        const list: UserProfile[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
        setAllUsers(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Users listener notice:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubSlices();
      unsubLogs();
      unsubUsers();
    };
  }, []);

  const totalFund = slices.reduce((sum, sl) => sum + (sl.totalAmount || 0), 0);

  // Log distribution fund financial activity
  const logFundTx = async (
    sliceId: string,
    sliceName: string,
    type: 'CREATE_SLICE' | 'RECHARGE_SLICE' | 'WITHDRAW_MEMBER' | 'DELETE_SLICE' | 'UPDATE_SHARES',
    typeNameAr: string,
    amount: number,
    details: string,
    memberName?: string,
    memberId?: string
  ) => {
    try {
      const logId = generateReadableId('dflog', sliceName);
      const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      await set(ref(db, `distribution_fund_logs/${logId}`), {
        id: logId,
        sliceId,
        sliceName,
        type,
        typeNameAr,
        amount,
        memberName: memberName || '',
        memberId: memberId || '',
        details,
        date: dateStr,
        performedBy: currentUser.name,
        performedById: currentUser.id,
      });

      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        `توزيعات: ${typeNameAr}`,
        `${currentUser.name} قام بـ ${typeNameAr} لشريحة (${sliceName}): ${details}`
      );
    } catch (err) {
      console.warn('Error logging fund transaction:', err);
    }
  };

  // Helper to add member to form draft
  const handleAddMemberToDraft = (userId: string) => {
    if (!userId) return;
    const existing = selectedMembers.find((m) => m.userId === userId);
    if (existing) return;

    const userObj = allUsers.find((u) => u.id === userId);
    if (!userObj) return;

    setSelectedMembers([
      ...selectedMembers,
      { userId: userObj.id, userName: userObj.name, shares: 1 },
    ]);
  };

  const handleUpdateShares = (userId: string, shares: number) => {
    setSelectedMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, shares: Math.max(1, shares) } : m))
    );
  };

  const handleRemoveMemberFromDraft = (userId: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  // Submit new slice
  const handleCreateSlice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sliceName || !sliceTotalAmount || sliceTotalAmount <= 0) {
      showToast('يرجى إدخال اسم الشريحة والمبلغ الإجمالي الصحيح', 'error');
      return;
    }
    if (selectedMembers.length === 0) {
      showToast('يرجى إضافة عضو واحد على الأقل للشريحة', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const totalShares = selectedMembers.reduce((sum, m) => sum + m.shares, 0);

      // Calculate member balance proportionally
      const finalMembers: SliceMember[] = selectedMembers.map((m) => {
        const memberBalance = (sliceTotalAmount * m.shares) / totalShares;
        return {
          userId: m.userId,
          userName: m.userName,
          shares: m.shares,
          balance: Math.round(memberBalance * 100) / 100,
        };
      });

      const todayStr = new Date().toISOString().split('T')[0];

      const newSliceId = generateReadableId('slice', sliceName);
      await set(ref(db, `distribution_fund/${newSliceId}`), {
        id: newSliceId,
        name: sliceName.trim(),
        description: sliceDescription.trim(),
        totalAmount: Number(sliceTotalAmount),
        createdDate: todayStr,
        members: finalMembers,
      });

      await logFundTx(
        newSliceId,
        sliceName.trim(),
        'CREATE_SLICE',
        'إنشاء شريحة توزيعات جديدة',
        Number(sliceTotalAmount),
        `تم إضافة الشريحة بمبلغ إجمالي ${sliceTotalAmount} د.ل موزعة على ${selectedMembers.length} أعضاء.`
      );

      sendAppNotification(`💰 شريحة توزيعات جديدة: ${sliceName.trim()}`, {
        body: `تم إدراج شريحة جديدة بقيمة ${sliceTotalAmount} د.ل`,
        tag: `slice-${newSliceId}`
      });

      showToast('تمت إضافة شريحة التوزيعات وتدوين العملية المالي بنجاح ✓', 'success');
      setShowAddForm(false);
      setSliceName('');
      setSliceDescription('');
      setSliceTotalAmount(0);
      setSelectedMembers([]);
    } catch (err: any) {
      console.error('Create slice error:', err);
      showToast('حدث خطأ. حاول مرة أخرى.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Recharge Slice
  const handleExecuteRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargeSlice || !rechargeAmount || rechargeAmount <= 0) {
      showToast('يرجى تحديد مبلغ الشحن الصحيح', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const totalShares = rechargeSlice.members.reduce((sum, m) => sum + (m.shares || 1), 0);
      
      const updatedMembers = rechargeSlice.members.map((m) => {
        const addedBalance = (rechargeAmount * (m.shares || 1)) / (totalShares || 1);
        const newBalance = (m.balance || 0) + addedBalance;
        return {
          ...m,
          balance: Math.round(newBalance * 100) / 100,
        };
      });

      const newTotalAmount = (rechargeSlice.totalAmount || 0) + rechargeAmount;

      await update(ref(db, `distribution_fund/${rechargeSlice.id}`), {
        totalAmount: newTotalAmount,
        members: updatedMembers,
      });

      await logFundTx(
        rechargeSlice.id,
        rechargeSlice.name,
        'RECHARGE_SLICE',
        'شحن / إضافة أموال للشريحة',
        rechargeAmount,
        rechargeNote.trim() || `شحن بقيمة ${rechargeAmount} د.ل تم توزيعها تناسبياً حسب الأسهم.`
      );

      sendAppNotification(`💵 شحن شريحة توزيعات: ${rechargeSlice.name}`, {
        body: `تم إضافة ${rechargeAmount} د.ل لشريحة "${rechargeSlice.name}"`,
        tag: `recharge-${rechargeSlice.id}`
      });

      showToast('تم شحن الشريحة وتحديث أرصدة الأعضاء وتدوين العملية المالي بنجاح ✓', 'success');
      setRechargeSlice(null);
      setRechargeAmount(0);
      setRechargeNote('');
    } catch (err) {
      showToast('حدث خطأ أثناء شحن الشريحة', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Withdrawal for Member
  const handleExecuteWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawModal || !withdrawAmount || withdrawAmount <= 0) {
      showToast('يرجى تحديد مبلغ السحب الصحيح', 'error');
      return;
    }

    const { slice, member } = withdrawModal;

    if (withdrawAmount > member.balance) {
      showToast(`مبلغ السحب المكتوب أكبر من رصيد العضو المتاح (${formatCurrency(member.balance)})`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const updatedMembers = slice.members.map((m) => {
        if (m.userId === member.userId) {
          return {
            ...m,
            balance: Math.max(0, Math.round((m.balance - withdrawAmount) * 100) / 100),
          };
        }
        return m;
      });

      const newTotalAmount = Math.max(0, (slice.totalAmount || 0) - withdrawAmount);

      await update(ref(db, `distribution_fund/${slice.id}`), {
        totalAmount: newTotalAmount,
        members: updatedMembers,
      });

      await logFundTx(
        slice.id,
        slice.name,
        'WITHDRAW_MEMBER',
        'سحب أرباح / رصيد عضو',
        withdrawAmount,
        withdrawNote.trim() || `سحب بمبلغ ${withdrawAmount} د.ل من رصيد العضو (${member.userName}).`,
        member.userName,
        member.userId
      );

      sendAppNotification(`💸 عملية سحب من الشريحة`, {
        body: `تم تسجيل سحب بمبلغ ${withdrawAmount} د.ل لحساب العضو ${member.userName}`,
        tag: `withdraw-${slice.id}`
      });

      showToast('تم تسجيل سحب المبلغ وتدوين الحركة المالية بنجاح ✓', 'success');
      setWithdrawModal(null);
      setWithdrawAmount(0);
      setWithdrawNote('');
    } catch (err) {
      showToast('حدث خطأ أثناء تسجيل عملية السحب', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Slice (Admin)
  const handleDeleteSlice = (id: string, name: string) => {
    setDeleteConfirmSlice({ id, name });
  };

  const executeDeleteSlice = async () => {
    if (!deleteConfirmSlice) return;
    const { id, name } = deleteConfirmSlice;
    setDeleteConfirmSlice(null);

    try {
      await remove(ref(db, `distribution_fund/${id}`));
      await logFundTx(
        id,
        name,
        'DELETE_SLICE',
        'حذف شريحة توزيعات',
        0,
        `تم حذف شريحة التوزيعات بالكامل.`
      );
      showToast('تم حذف الشريحة وتسجيل العملية بنجاح ✓', 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء الحذف.', 'error');
    }
  };

  // Print PDF Function
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة', 'error');
      return;
    }

    const todayStr = new Date().toLocaleDateString('ar-LY', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const slicesHtml = slices
      .map(
        (s, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${s.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${s.description || '—'}</td>
        <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #e2e8f0; text-align: center;">${s.totalAmount} د.ل</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
          <ul style="margin: 0; padding-right: 18px; font-size: 11px;">
            ${(s.members || [])
              .map(
                (m) =>
                  `<li><b>${m.userName}</b> (${m.shares} سهم) - <span style="color: #0f172a; font-weight: bold;">${m.balance} د.ل</span></li>`
              )
              .join('')}
          </ul>
        </td>
      </tr>
    `
      )
      .join('');

    const logsHtml = logs
      .map(
        (l, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${l.date || '—'}</td>
        <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${l.sliceName}</td>
        <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e2e8f0; color: ${
          l.type === 'RECHARGE_SLICE' ? '#047857' : l.type === 'WITHDRAW_MEMBER' ? '#b91c1c' : '#1e293b'
        };">${l.typeNameAr}</td>
        <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${l.amount ? l.amount + ' د.ل' : '—'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${l.memberName || '—'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${l.details || '—'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${l.performedBy || '—'}</td>
      </tr>
    `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>تقرير صندوق التوزيعات والشرائح - أرتياتك</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
          body { font-family: 'Cairo', sans-serif; padding: 25px; color: #0f172a; line-height: 1.5; }
          .header { border-bottom: 3px solid #1e293b; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { margin: 0; font-size: 22px; color: #1e293b; font-weight: 900; }
          .summary-box { background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 20px; margin-bottom: 25px; display: flex; gap: 30px; font-size: 13px; }
          .summary-item { display: flex; flex-direction: column; }
          .summary-item label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .summary-item span { font-size: 18px; font-weight: 900; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
          th { background-color: #1e293b; color: #ffffff; text-align: right; padding: 10px; font-size: 11px; }
          .section-title { font-size: 15px; font-weight: 900; color: #1e293b; margin-bottom: 10px; border-right: 4px solid #1e293b; padding-right: 10px; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>استوديو أرتياتك - Artiatech Studio</h1>
            <p style="margin: 3px 0 0 0; font-size: 13px; font-weight: bold; color: #475569;">تقرير المعاملات المالية المعتمد لصندوق التوزيعات والشرائح</p>
          </div>
          <div style="text-align: left; font-size: 11px; color: #64748b; font-weight: bold;">
            <p style="margin:0;">تاريخ التقرير: ${todayStr}</p>
            <p style="margin:0;">بواسطة: ${currentUser.name}</p>
          </div>
        </div>

        <div class="summary-box">
          <div class="summary-item">
            <label>إجمالي الصندوق</label>
            <span>${formatCurrency(totalFund)}</span>
          </div>
          <div class="summary-item">
            <label>عدد الشرائح النشطة</label>
            <span>${slices.length} شريحة</span>
          </div>
          <div class="summary-item">
            <label>إجمالي العمليات الموثقة</label>
            <span>${logs.length} عملية</span>
          </div>
        </div>

        <div class="section-title">أولاً: بيانات الشرائح والأسهم والأعضاء المشاركين</div>
        <table>
          <thead>
            <tr>
              <th>اسم الشريحة</th>
              <th>الوصف والتفاصيل</th>
              <th style="text-align: center;">إجمالي الشريحة</th>
              <th>الأعضاء المشاركون والأسهم والأرصدة</th>
            </tr>
          </thead>
          <tbody>
            ${slicesHtml || '<tr><td colspan="4" style="text-align:center; padding: 20px;">لا توجد شرائح حالية</td></tr>'}
          </tbody>
        </table>

        <div class="section-title">ثانياً: سجل المعاملات والعمليات المالية للشرائح (Financial Audit Logs)</div>
        <table>
          <thead>
            <tr>
              <th>التاريخ والوقت</th>
              <th>الشريحة</th>
              <th>نوع العملية</th>
              <th>المبلغ</th>
              <th>العضو المستهدف</th>
              <th>البيان والتفاصيل</th>
              <th>بواسطة</th>
            </tr>
          </thead>
          <tbody>
            ${logsHtml || '<tr><td colspan="7" style="text-align:center; padding: 20px;">لا توجد حركات مسجلة بعد</td></tr>'}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-500 font-bold">جاري تحميل بيانات صندوق التوزيعات...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-['Cairo',sans-serif]">
      {/* Large Top Card */}
      <div className="bg-[#1e293b] border border-slate-800 text-white rounded-lg p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-800 border border-slate-700 text-amber-400 rounded flex items-center justify-center shrink-0">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">صندوق التوزيعات والشرائح المالي</h1>
            <p className="text-xs text-slate-300 font-bold mt-0.5">متابعة الأسهم والأرصدة وسجل الحركات المالية المعتمد</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded transition-colors shadow cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>تصدير تقرير PDF / طباعة</span>
          </button>

          <div className="bg-slate-800/80 border border-slate-700 px-5 py-2.5 rounded text-center">
            <span className="text-[10px] text-slate-400 block font-black uppercase tracking-wider mb-0.5">إجمالي الصندوق</span>
            <span className="text-xl font-black text-amber-400 dir-ltr block">
              {formatCurrency(totalFund)}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Button & Add Form Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-base font-black text-[#0f172a] flex items-center gap-2">
          <span>شرائح التوزيعات الحالية</span>
          <span className="text-xs text-slate-500 font-bold">({slices.length} شريحة)</span>
        </h2>

        {currentUser.role === 'admin' && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 font-black text-xs uppercase tracking-wider rounded border border-[#1e293b] transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showAddForm ? 'إلغاء' : 'إضافة شريحة جديدة'}</span>
          </button>
        )}
      </div>

      {/* Inline Form: Add New Slice */}
      {showAddForm && (
        <form onSubmit={handleCreateSlice} className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-xs font-black text-[#0f172a] uppercase tracking-wider">إنشاء شريحة توزيعات جديدة</h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الشريحة</label>
              <input
                type="text"
                required
                placeholder="مثال: كورس C++ - دفعة يناير"
                value={sliceName}
                onChange={(e) => setSliceName(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">المبلغ الإجمالي (د.ل)</label>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={sliceTotalAmount || ''}
                onChange={(e) => setSliceTotalAmount(Number(e.target.value))}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الوصف (من، متى، لماذا)</label>
              <input
                type="text"
                placeholder="توضيح خلفية الشريحة"
                value={sliceDescription}
                onChange={(e) => setSliceDescription(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>
          </div>

          {/* Member Selection Section */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">تحديد الأشخاص وأسهمهم</label>

            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  handleAddMemberToDraft(e.target.value);
                  e.target.value = '';
                }}
                className="p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none w-full sm:w-64"
              >
                <option value="">+ اختيار عضو وإضافته للشريحة...</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            {selectedMembers.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {selectedMembers.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded text-xs"
                  >
                    <span className="font-bold text-slate-800">{m.userName}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-bold">عدد الأسهم:</span>
                        <input
                          type="number"
                          min="1"
                          value={m.shares}
                          onChange={(e) => handleUpdateShares(m.userId, Number(e.target.value))}
                          className="w-16 p-1 bg-white border border-slate-300 rounded text-center font-bold"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMemberFromDraft(m.userId)}
                        className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black rounded disabled:opacity-50 uppercase tracking-wider cursor-pointer"
            >
              إنشاء الشريحة وتدوين العملية
            </button>
          </div>
        </form>
      )}

      {/* Slices Grid / List */}
      {slices.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-xs font-bold">
          لا توجد بيانات بعد
        </div>
      ) : (
        <div className="space-y-4">
          {slices.map((slice) => {
            const memberCount = slice.members?.length || 0;
            return (
              <div
                key={slice.id}
                className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-black text-[#0f172a]">{slice.name}</h3>
                    <p className="text-xs text-slate-600 mt-0.5 font-medium">
                      الوصف: <span className="text-slate-800 font-bold">{slice.description || 'بدون وصف'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left sm:text-right pl-2 sm:pl-0 sm:border-none border-l border-slate-200">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">إجمالي الشريحة</span>
                      <span className="text-lg font-black text-[#1e293b] dir-ltr block">
                        {formatCurrency(slice.totalAmount)}
                      </span>
                    </div>

                    {currentUser.role === 'admin' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setRechargeSlice(slice);
                            setRechargeAmount(0);
                            setRechargeNote('');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-xs cursor-pointer transition-colors"
                          title="شحن الشريحة بمبلغ إضافي"
                        >
                          <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>شحن 💵</span>
                        </button>

                        <button
                          onClick={() => handleDeleteSlice(slice.id, slice.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="حذف الشريحة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Members list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-700 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      الأعضاء والأسهم المندرجة ({memberCount}):
                    </span>
                  </div>

                  {memberCount === 0 ? (
                    <p className="text-xs text-slate-400 font-medium">لا يوجد أعضاء في هذه الشريحة</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {slice.members.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-[#0f172a]">{m.userName}</span>
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                              {m.shares} {m.shares === 1 ? 'سهم' : 'أسهم'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                            <span className="font-black text-[#1e293b] dir-ltr text-sm">
                              {formatCurrency(m.balance)}
                            </span>

                            {(currentUser.role === 'admin' || currentUser.id === m.userId) && m.balance > 0 && (
                              <button
                                onClick={() => {
                                  setWithdrawModal({ slice, member: m });
                                  setWithdrawAmount(0);
                                  setWithdrawNote('');
                                }}
                                className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer"
                              >
                                <ArrowUpCircle className="w-3 h-3 text-rose-600" />
                                <span>سحب 💸</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Financial Transaction Audit Log Table (سجل المعاملات المعتمد) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#1e293b]" />
            <h2 className="text-base font-black text-[#0f172a]">سجل العمليات والمعاملات المالية للشرائح (Audit Trail)</h2>
          </div>
          <span className="text-xs text-slate-500 font-bold">{logs.length} حركة مسجلة</span>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 font-medium">لا توجد حركات مالية مدونة بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="bg-[#1e293b] text-white font-bold">
                  <th className="p-2.5">التاريخ والوقت</th>
                  <th className="p-2.5">الشريحة</th>
                  <th className="p-2.5">نوع العملية</th>
                  <th className="p-2.5">المبلغ</th>
                  <th className="p-2.5">العضو المستهدف</th>
                  <th className="p-2.5">التفاصيل والبيان</th>
                  <th className="p-2.5">بواسطة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-600 text-[11px]">{log.date}</td>
                    <td className="p-2.5 font-black text-slate-900">{log.sliceName}</td>
                    <td className="p-2.5 font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          log.type === 'RECHARGE_SLICE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.type === 'WITHDRAW_MEMBER'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {log.typeNameAr}
                      </span>
                    </td>
                    <td className="p-2.5 font-black text-slate-900 dir-ltr">
                      {log.amount > 0 ? formatCurrency(log.amount) : '—'}
                    </td>
                    <td className="p-2.5 font-bold text-slate-700">{log.memberName || '—'}</td>
                    <td className="p-2.5 text-slate-600 font-medium">{log.details}</td>
                    <td className="p-2.5 text-slate-500 font-bold">{log.performedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Recharge Slice */}
      {rechargeSlice && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl">
          <form
            onSubmit={handleExecuteRecharge}
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
                <span>شحن شريحة: {rechargeSlice.name}</span>
              </h3>
              <button type="button" onClick={() => setRechargeSlice(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed bg-emerald-50 p-2.5 rounded border border-emerald-200">
              سيتم إضافة المبلغ وتوزيعه أوتوماتيكياً على أرصدة أعضاء الشريحة بنسبة أسهم كل منهم.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ الشحن (د.ل)</label>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={rechargeAmount || ''}
                onChange={(e) => setRechargeAmount(Number(e.target.value))}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظة / بيان الشحن (اختياري)</label>
              <input
                type="text"
                placeholder="مثال: إضافة أرباح الدفعة الثالثة"
                value={rechargeNote}
                onChange={(e) => setRechargeNote(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRechargeSlice(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded shadow cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>تأكيد الشحن وتدوين الحركة</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Withdraw Member Balance */}
      {withdrawModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl">
          <form
            onSubmit={handleExecuteWithdrawal}
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5 text-rose-600" />
                <span>سحب أرباح العضو: {withdrawModal.member.userName}</span>
              </h3>
              <button type="button" onClick={() => setWithdrawModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-slate-700">الشريحة: <span className="text-slate-900 font-black">{withdrawModal.slice.name}</span></p>
              <p className="font-bold text-slate-700">رصيد العضو المتاح في الشريحة: <span className="text-emerald-700 font-black dir-ltr">{formatCurrency(withdrawModal.member.balance)}</span></p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المراد سحبه (د.ل)</label>
              <input
                type="number"
                step="any"
                max={withdrawModal.member.balance}
                required
                placeholder="0.00"
                value={withdrawAmount || ''}
                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-rose-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">بيان / طريقة السحب</label>
              <input
                type="text"
                placeholder="مثال: تسليم نقدي / تحويل بنكي"
                value={withdrawNote}
                onChange={(e) => setWithdrawNote(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-rose-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWithdrawModal(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded shadow cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>تأكيد السحب والتسجيل المالي</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: PDF / Printable Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#1e293b] text-amber-400 rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">تقرير وتوثيق صندوق التوزيعات المالي</h2>
                  <p className="text-xs text-slate-500 font-bold">استوديو أرتياتك - المعاملات والشرائح المعتمدة</p>
                </div>
              </div>

              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Report Content Preview */}
            <div className="space-y-4 border border-slate-200 p-4 rounded-xl bg-slate-50/50">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">إجمالي الصندوق</span>
                  <span className="text-lg font-black text-amber-600 dir-ltr block">{formatCurrency(totalFund)}</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">عدد الشرائح</span>
                  <span className="text-lg font-black text-slate-900">{slices.length} شريحة</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">إجمالي الحركات المالية</span>
                  <span className="text-lg font-black text-slate-900">{logs.length} حركة</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-800">بيانات الشرائح والأسهم:</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#1e293b] text-white font-bold">
                      <tr>
                        <th className="p-2">اسم الشريحة</th>
                        <th className="p-2">الإجمالي</th>
                        <th className="p-2">الأعضاء والأسهم الأرصدة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {slices.map((s) => (
                        <tr key={s.id}>
                          <td className="p-2 font-black text-slate-900">{s.name}</td>
                          <td className="p-2 font-black text-amber-700 dir-ltr">{formatCurrency(s.totalAmount)}</td>
                          <td className="p-2 text-slate-700">
                            {(s.members || []).map((m) => `${m.userName} (${m.shares} أسهم: ${formatCurrency(m.balance)})`).join(' • ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                onClick={async () => {
                  const plainText = `تقرير صندوق التوزيعات - أرتياتك\nإجمالي الصندوق: ${formatCurrency(totalFund)}\n\nالشرائح:\n` + slices.map(s => `${s.name}: ${formatCurrency(s.totalAmount)}`).join('\n');
                  await navigator.clipboard.writeText(plainText);
                  setCopiedReportText(true);
                  showToast('تم نسخ التقرير للحافظة ✓', 'success');
                  setTimeout(() => setCopiedReportText(false), 3000);
                }}
                className={`px-4 py-2 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  copiedReportText ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedReportText ? 'تم النسخ ✓' : 'نسخ النص'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  onClick={handlePrintReport}
                  className="px-4 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black rounded-xl shadow flex items-center gap-2 transition-colors cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة / حفظ كـ PDF المعتمد</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmSlice && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-black text-sm text-slate-900">تأكيد حذف الشريحة</h3>
            <p className="text-xs text-slate-600 font-bold leading-relaxed">
              هل أنت متأكد من رغبتك في حذف شريحة التوزيعات "{deleteConfirmSlice.name}"؟ سيتم تدوين هذه العملية في السجل المالي.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmSlice(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeDeleteSlice}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow cursor-pointer active:scale-95"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
