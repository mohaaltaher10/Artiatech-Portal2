import React, { useEffect, useState } from 'react';
import { db, formatCurrency, logActivity, generateReadableId } from '../lib/firebase';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { DistributionFundSlice, SliceMember, UserProfile } from '../types';
import { PieChart, PlusCircle, Users, Trash2, X, Plus } from 'lucide-react';

interface DistributionFundViewProps {
  currentUser: UserProfile;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const DistributionFundView: React.FC<DistributionFundViewProps> = ({
  currentUser,
  showToast,
}) => {
  const [slices, setSlices] = useState<DistributionFundSlice[]>([]);
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

  // Submitting state
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // 1. Listen to distribution fund
    const unsubSlices = onValue(ref(db, 'distribution_fund'), (snapshot) => {
      const val = snapshot.val();
      const list: DistributionFundSlice[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      setSlices(list);
    }, (err) => console.warn('Distribution fund listener notice:', err));

    // 2. Listen to users to select members for slices
    const unsubUsers = onValue(ref(db, 'users'), (snapshot) => {
      const val = snapshot.val();
      const list: UserProfile[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      setAllUsers(list);
      setLoading(false);
    }, (err) => {
      console.warn('Users listener notice:', err);
      setLoading(false);
    });

    return () => {
      unsubSlices();
      unsubUsers();
    };
  }, []);

  const totalFund = slices.reduce((sum, sl) => sum + (sl.totalAmount || 0), 0);

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

      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'إنشاء شريحة توزيعات',
        `${currentUser.name} أنشأ شريحة جديدة: ${sliceName.trim()} بقيمة ${sliceTotalAmount} د.ل`
      );

      showToast('تمت إضافة شريحة التوزيعات بنجاح ✓', 'success');
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

  // Delete Slice (Admin)
  const handleDeleteSlice = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت تأكد من حذف الشريحة "${name}"؟`)) return;
    try {
      await remove(ref(db, `distribution_fund/${id}`));
      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'حذف شريحة',
        `${currentUser.name} حذف شريحة التوزيعات: ${name}`
      );
      showToast('تم حذف الشريحة بنجاح ✓', 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء الحذف.', 'error');
    }
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
            <h1 className="text-xl font-black text-white tracking-tight">صندوق التوزيعات والشرائح</h1>
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 px-5 py-3 rounded text-center">
          <span className="text-xs text-slate-400 block font-black uppercase tracking-wider mb-0.5">إجمالي الصندوق</span>
          <span className="text-2xl font-black text-amber-400 dir-ltr block">
            {formatCurrency(totalFund)}
          </span>
        </div>
      </div>

      {/* Admin Button & Add Form */}
      <div className="flex justify-between items-center">
        <h2 className="text-base font-black text-[#0f172a] flex items-center gap-2">
          <span>شرائح التوزيعات الحالية</span>
          <span className="text-xs text-slate-500 font-bold">({slices.length} شريحة)</span>
        </h2>

        {currentUser.role === 'admin' && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 font-black text-xs uppercase tracking-wider rounded border border-[#1e293b] transition-colors"
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
                        className="text-rose-600 hover:text-rose-800 p-1"
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
              className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black rounded disabled:opacity-50 uppercase tracking-wider"
            >
              إنشاء الشريحة
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
                className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-black text-[#0f172a]">{slice.name}</h3>
                    <p className="text-xs text-slate-600 mt-0.5 font-medium">
                      الوصف: <span className="text-slate-800 font-bold">{slice.description || 'بدون وصف'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-slate-500 font-black uppercase tracking-wider block">المبلغ الإجمالي</span>
                      <span className="text-lg font-black text-[#1e293b] dir-ltr block">
                        {formatCurrency(slice.totalAmount)}
                      </span>
                    </div>

                    {currentUser.role === 'admin' && (
                      <button
                        onClick={() => handleDeleteSlice(slice.id, slice.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                        title="حذف الشريحة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Members list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-700 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      الأشخاص المندرجون ({memberCount}):
                    </span>
                  </div>

                  {memberCount === 0 ? (
                    <p className="text-xs text-slate-400 font-medium">لا يوجد أعضاء في هذه الشريحة</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {slice.members.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-black text-[#0f172a] block">{m.userName}</span>
                            <span className="text-[11px] text-slate-500 font-bold">
                              ({m.shares} {m.shares === 1 ? 'سهم' : 'أسهم'})
                            </span>
                          </div>
                          <span className="font-black text-[#1e293b] dir-ltr">
                            {formatCurrency(m.balance)}
                          </span>
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
    </div>
  );
};
