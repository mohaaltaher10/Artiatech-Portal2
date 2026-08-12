import React, { useEffect, useState } from 'react';
import { db, formatDate, logActivity, generateReadableId } from '../lib/firebase';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { PlanItem, PlanStatus, UserProfile } from '../types';
import { MapPin, PlusCircle, Clock, Trash2, Edit2, X } from 'lucide-react';

interface PlansViewProps {
  currentUser: UserProfile;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const PlansView: React.FC<PlansViewProps> = ({ currentUser, showToast }) => {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmPlan, setDeleteConfirmPlan] = useState<{ id: string; title: string } | null>(null);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<PlanStatus>('planned');
  const [deadline, setDeadline] = useState('');
  const [responsible, setResponsible] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(db, 'plans'), (snapshot) => {
      const val = snapshot.val();
      const list: PlanItem[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      setPlans(list);
      setLoading(false);
    }, (err) => {
      console.warn('Plans listener notice:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const resetForm = () => {
    setShowAddForm(false);
    setTitle('');
    setDescription('');
    setStatus('planned');
    setDeadline('');
    setResponsible('');
    setEditingId(null);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      showToast('يرجى إدخال اسم الخطة', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await update(ref(db, `plans/${editingId}`), {
          title: title.trim(),
          description: description.trim(),
          status,
          deadline: deadline || new Date().toISOString().split('T')[0],
          responsible: responsible.trim() || currentUser.name,
        });

        await logActivity(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          'تعديل خطة',
          `${currentUser.name} عدّل الخطة: ${title.trim()}`
        );

        showToast('تم تعديل الخطة بنجاح ✓', 'success');
      } else {
        const newPlanId = generateReadableId('plan', title);
        await set(ref(db, `plans/${newPlanId}`), {
          id: newPlanId,
          title: title.trim(),
          description: description.trim(),
          status,
          deadline: deadline || new Date().toISOString().split('T')[0],
          responsible: responsible.trim() || currentUser.name,
          createdBy: currentUser.name,
        });

        await logActivity(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          'إضافة خطة',
          `${currentUser.name} أضاف خطة جديدة: ${title.trim()}`
        );

        showToast('تمت إضافة الخطة بنجاح ✓', 'success');
      }

      resetForm();
    } catch (err) {
      showToast('حدث خطأ أثناء الحفظ.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlan = async (id: string, title: string) => {
    try {
      await remove(ref(db, `plans/${id}`));
      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'حذف خطة',
        `${currentUser.name} حذف الخطة: ${title}`
      );
      showToast('تم حذف الخطة بنجاح ✓', 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء الحذف.', 'error');
    }
  };

  const getStatusBadge = (st: PlanStatus) => {
    switch (st) {
      case 'completed':
        return <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">مكتملة ✅</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold">جارية 🔄</span>;
      case 'postponed':
        return <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">مؤجلة ⏸️</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold">ملغية ❌</span>;
      case 'planned':
      default:
        return <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 font-bold">مخططة 📋</span>;
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-500 font-bold">جاري تحميل الخطط وخارطة الطريق...</div>;
  }

  return (
    <div className="space-y-6 font-['Cairo',sans-serif]">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-[#0f172a] flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#1e293b]" />
            الخطط وخارطة الطريق
          </h2>
        </div>

        {currentUser.role === 'admin' && (
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 font-black text-xs uppercase tracking-wider rounded border border-[#1e293b] transition-colors self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showAddForm ? 'إلغاء' : 'إضافة خطة جديدة'}</span>
          </button>
        )}
      </div>

      {/* Inline Form: Add/Edit Plan */}
      {showAddForm && (
        <form onSubmit={handleSavePlan} className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-xs font-black text-[#0f172a] uppercase tracking-wider">
              {editingId ? 'تعديل بيانات الخطة' : 'إضافة خطة عمل جديدة'}
            </h3>
            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الخطة / الهدف</label>
              <input
                type="text"
                required
                placeholder="اسم الخطة"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الحالة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PlanStatus)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              >
                <option value="planned">مخططة 📋</option>
                <option value="in_progress">جارية 🔄</option>
                <option value="completed">مكتملة ✅</option>
                <option value="postponed">مؤجلة ⏸️</option>
                <option value="cancelled">ملغية ❌</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الموعد النهائي</label>
              <input
                type="date"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">المسؤول عن التنفيذ</label>
              <input
                type="text"
                placeholder="اسم العضو المسؤول"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">وصف الخطة والخطوات</label>
            <input
              type="text"
              placeholder="توضيح التفاصيل والمهام الرئيسية..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black uppercase tracking-wider rounded disabled:opacity-50"
            >
              حفظ الخطة
            </button>
          </div>
        </form>
      )}

      {/* Plans Table */}
      {plans.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-xs font-bold">
          لا توجد بيانات بعد
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase tracking-wider">
                <th className="p-3">الخطة</th>
                <th className="p-3">الوصف</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">الديدلاين</th>
                <th className="p-3">المسؤول</th>
                {currentUser.role === 'admin' && <th className="p-3 text-center">إجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-black text-[#0f172a]">{plan.title}</td>
                  <td className="p-3 text-slate-600 font-medium max-w-xs truncate">{plan.description || '—'}</td>
                  <td className="p-3">{getStatusBadge(plan.status)}</td>
                  <td className="p-3 text-slate-600 font-mono font-bold">{formatDate(plan.deadline)}</td>
                  <td className="p-3 font-bold text-slate-800">{plan.responsible || 'غير محدد'}</td>
                  {currentUser.role === 'admin' && (
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingId(plan.id);
                            setTitle(plan.title);
                            setDescription(plan.description || '');
                            setStatus(plan.status);
                            setDeadline(plan.deadline || '');
                            setResponsible(plan.responsible || '');
                            setShowAddForm(true);
                          }}
                          className="p-1 text-slate-600 hover:bg-slate-200 rounded"
                          title="تعديل"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmPlan({ id: plan.id, title: plan.title })}
                          className="p-1 text-rose-600 hover:bg-rose-100 rounded cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-black text-sm text-slate-900">تأكيد حذف الخطة</h3>
            <p className="text-xs text-slate-600 font-bold leading-relaxed">
              هل أنت تأكيد من رغبتك في حذف الخطة "{deleteConfirmPlan.title}"؟ لا يمكن التراجع عن هذه الخطوة.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmPlan(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteConfirmPlan;
                  setDeleteConfirmPlan(null);
                  await handleDeletePlan(target.id, target.title);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer"
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
