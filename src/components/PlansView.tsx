import React, { useEffect, useState } from 'react';
import { db, formatDate, logActivity, generateReadableId } from '../lib/firebase';
import { ref, onValue, set, update, remove } from 'firebase/database';
import { PlanItem, PlanStatus, UserProfile } from '../types';
import {
  MapPin,
  PlusCircle,
  Trash2,
  Edit2,
  X,
  Archive,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Lock,
  Kanban,
  Table,
  GripVertical,
  Calendar,
  User,
  Clock
} from 'lucide-react';

interface PlansViewProps {
  currentUser: UserProfile;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const PlansView: React.FC<PlansViewProps> = ({ currentUser, showToast }) => {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmPlan, setDeleteConfirmPlan] = useState<{ id: string; title: string } | null>(null);

  // View Mode: 'kanban' or 'table'
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<PlanStatus>('planned');
  const [deadline, setDeadline] = useState('');
  const [responsible, setResponsible] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'admin';

  useEffect(() => {
    const unsub = onValue(
      ref(db, 'plans'),
      (snapshot) => {
        const val = snapshot.val();
        const list: PlanItem[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
        setPlans(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Plans listener notice:', err);
        setLoading(false);
      }
    );

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
    if (!isAdmin) {
      showToast('عفواً، يتطلب إضافة وتعديل الخطط صلاحيات المشرف (Admin) فقط.', 'error');
      return;
    }

    if (!title.trim()) {
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
    if (!isAdmin) {
      showToast('عفواً، لا يملك صلاحية الحذف سوى المشرف (Admin).', 'error');
      return;
    }

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

  // Drag and Drop Status Change
  const handleDropStatusChange = async (planId: string, newStatus: PlanStatus) => {
    if (!isAdmin) {
      showToast('عفواً، لا يملك صلاحية سحب ونقل الخطط سوى المشرف (Admin).', 'error');
      return;
    }

    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan || targetPlan.status === newStatus) return;

    try {
      await update(ref(db, `plans/${planId}`), {
        status: newStatus,
      });

      const statusNamesAr: Record<PlanStatus, string> = {
        planned: 'مخططة 📋',
        in_progress: 'جارية 🔄',
        completed: 'مكتملة ✅ (الأرشيف)',
        postponed: 'مؤجلة ⏸️',
        cancelled: 'ملغية ❌',
      };

      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'تغيير حالة خطة',
        `${currentUser.name} نقل الخطة "${targetPlan.title}" إلى (${statusNamesAr[newStatus]})`
      );

      showToast(`تم نقل الخطة إلى قسم (${statusNamesAr[newStatus]}) بنجاح ✓`, 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء نقل الخطة.', 'error');
    } finally {
      setDraggedPlanId(null);
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

  // Kanban Columns Definition
  const kanbanColumns: { id: PlanStatus; title: string; badgeColor: string; bgHeader: string; borderCol: string }[] = [
    {
      id: 'planned',
      title: 'مخططة 📋',
      badgeColor: 'bg-slate-100 text-slate-800',
      bgHeader: 'bg-slate-100 border-slate-300 text-slate-900',
      borderCol: 'border-slate-200 bg-slate-50/50',
    },
    {
      id: 'in_progress',
      title: 'جارية 🔄',
      badgeColor: 'bg-blue-100 text-blue-900',
      bgHeader: 'bg-blue-100/80 border-blue-300 text-blue-950',
      borderCol: 'border-blue-200 bg-blue-50/30',
    },
    {
      id: 'postponed',
      title: 'مؤجلة ⏸️',
      badgeColor: 'bg-amber-100 text-amber-900',
      bgHeader: 'bg-amber-100/80 border-amber-300 text-amber-950',
      borderCol: 'border-amber-200 bg-amber-50/30',
    },
    {
      id: 'cancelled',
      title: 'ملغية ❌',
      badgeColor: 'bg-rose-100 text-rose-900',
      bgHeader: 'bg-rose-100/80 border-rose-300 text-rose-950',
      borderCol: 'border-rose-200 bg-rose-50/30',
    },
    {
      id: 'completed',
      title: 'مكتملة (الأرشيف) ✅',
      badgeColor: 'bg-emerald-100 text-emerald-900',
      bgHeader: 'bg-emerald-100/80 border-emerald-300 text-emerald-950',
      borderCol: 'border-emerald-200 bg-emerald-50/30',
    },
  ];

  // Active vs Completed Plans
  const activePlans = plans.filter((p) => p.status !== 'completed');
  const completedPlans = plans.filter((p) => p.status === 'completed');

  return (
    <div className="space-y-6 font-['Cairo',sans-serif]">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-[#0f172a] flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#1e293b]" />
            الخطط وخارطة الطريق (Kanban & Drag-and-Drop)
          </h2>
          {!isAdmin && (
            <p className="text-xs text-amber-700 font-medium flex items-center gap-1 mt-0.5">
              <Lock className="w-3 h-3" />
              صلاحيات العرض فقط (سحب وإفلات وتعديل الخطط مقتصر على المشرفين Admins)
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* View Toggle Buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white text-[#1e293b] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="لوحة كانبان بالسحب والإفلات"
            >
              <Kanban className="w-3.5 h-3.5 text-amber-600" />
              <span>لوحة كانبان (سحب وإفلات)</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-[#1e293b] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="عرض الجدول التقليدي"
            >
              <Table className="w-3.5 h-3.5 text-slate-600" />
              <span>الجدول التقليدي</span>
            </button>
          </div>

          {/* Add Plan Button (Admin Only) */}
          {isAdmin && (
            <button
              onClick={() => {
                resetForm();
                setShowAddForm(!showAddForm);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 font-black text-xs uppercase tracking-wider rounded border border-[#1e293b] transition-colors cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{showAddForm ? 'إلغاء' : 'إضافة خطة جديدة'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Form: Add/Edit Plan (Admin Only) */}
      {isAdmin && showAddForm && (
        <form onSubmit={handleSavePlan} className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-md animate-fadeIn">
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
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الحالة البدائية</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PlanStatus)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#1e293b] focus:outline-none"
              >
                <option value="planned">مخططة 📋</option>
                <option value="in_progress">جارية 🔄</option>
                <option value="completed">مكتملة ✅ (الأرشيف)</option>
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
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">المسؤول عن التنفيذ</label>
              <input
                type="text"
                placeholder="اسم العضو المسؤول"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#1e293b] focus:outline-none"
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
              className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#1e293b] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black uppercase tracking-wider rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
            >
              حفظ الخطة
            </button>
          </div>
        </form>
      )}

      {/* VIEW MODE 1: KANBAN BOARD WITH DRAG & DROP */}
      {viewMode === 'kanban' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 font-bold flex items-center gap-1.5 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
            <Kanban className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              💡 <b>ميزة السحب والإفلات:</b> يمكنك سحب أي بطاقة خطة وإفلاتها مباشرة في الأعمود المكتمل أو الجاري أو المؤجل لتحديث حالتها فورياً!
            </span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-start overflow-x-auto pb-4">
            {kanbanColumns.map((col) => {
              const colPlans = plans.filter((p) => p.status === col.id);

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const planId = e.dataTransfer.getData('planId');
                    if (planId) {
                      handleDropStatusChange(planId, col.id);
                    }
                  }}
                  className={`border rounded-2xl p-3 flex flex-col space-y-3 min-h-[420px] transition-colors ${col.borderCol}`}
                >
                  {/* Column Header */}
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between font-black text-xs shadow-2xs ${col.bgHeader}`}>
                    <span>{col.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${col.badgeColor}`}>
                      {colPlans.length}
                    </span>
                  </div>

                  {/* Column Cards */}
                  <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[600px] pr-0.5">
                    {colPlans.length === 0 ? (
                      <div className="h-28 flex items-center justify-center text-center p-3 border-2 border-dashed border-slate-200 rounded-xl text-[11px] text-slate-400 font-bold">
                        اسحب بطاقة الخطة وأفلتها هنا
                      </div>
                    ) : (
                      colPlans.map((plan) => (
                        <div
                          key={plan.id}
                          draggable={isAdmin}
                          onDragStart={(e) => {
                            if (isAdmin) {
                              setDraggedPlanId(plan.id);
                              e.dataTransfer.setData('planId', plan.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }
                          }}
                          onDragEnd={() => setDraggedPlanId(null)}
                          className={`bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-all space-y-2 font-['Cairo',sans-serif] ${
                            draggedPlanId === plan.id ? 'opacity-40 scale-95 border-amber-400' : 'border-slate-200'
                          } ${isAdmin ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="font-black text-xs text-[#0f172a] leading-tight flex items-center gap-1">
                              {isAdmin && <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                              <span>{plan.title}</span>
                            </h4>

                            {isAdmin && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingId(plan.id);
                                    setTitle(plan.title);
                                    setDescription(plan.description || '');
                                    setStatus(plan.status);
                                    setDeadline(plan.deadline || '');
                                    setResponsible(plan.responsible || '');
                                    setShowAddForm(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors"
                                  title="تعديل"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmPlan({ id: plan.id, title: plan.title })}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {plan.description && (
                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed line-clamp-2">
                              {plan.description}
                            </p>
                          )}

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500 gap-1 flex-wrap">
                            <span className="flex items-center gap-1 text-slate-700">
                              <User className="w-3 h-3 text-slate-400" />
                              {plan.responsible || 'غير محدد'}
                            </span>
                            <span className="flex items-center gap-1 text-slate-500 font-mono">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formatDate(plan.deadline)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800">الخطط النشطة في الجدول</h3>
            <button
              onClick={() => setShowArchive(!showArchive)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-xs rounded-lg border border-emerald-200 transition-colors cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 text-emerald-600" />
              <span>أرشيف الخطط المكتملة ({completedPlans.length})</span>
            </button>
          </div>

          {activePlans.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs font-bold">
              لا توجد خطط نشطة حالياً (جميع الخطط مكتملة أو في الأرشيف)
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase tracking-wider">
                    <th className="p-3">الخطة</th>
                    <th className="p-3">الوصف</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">الديدلاين</th>
                    <th className="p-3">المسؤول</th>
                    {isAdmin && <th className="p-3 text-center">إجراءات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activePlans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-black text-[#0f172a]">{plan.title}</td>
                      <td className="p-3 text-slate-600 font-medium max-w-xs truncate">{plan.description || '—'}</td>
                      <td className="p-3">{getStatusBadge(plan.status)}</td>
                      <td className="p-3 text-slate-600 font-mono font-bold">{formatDate(plan.deadline)}</td>
                      <td className="p-3 font-bold text-slate-800">{plan.responsible || 'غير محدد'}</td>
                      {isAdmin && (
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
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="p-1 text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                              title="تعديل الخطة"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmPlan({ id: plan.id, title: plan.title })}
                              className="p-1 text-rose-600 hover:bg-rose-100 rounded cursor-pointer"
                              title="حذف الخطة"
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

          {/* Archive Table inside Table View */}
          {showArchive && (
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                <h3 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>أرشيف الخطط والمهام المكتملة</span>
                </h3>
                <button
                  onClick={() => setShowArchive(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                >
                  إخفاء الأرشيف ✕
                </button>
              </div>

              {completedPlans.length === 0 ? (
                <p className="text-xs text-emerald-800/70 font-bold py-4 text-center">
                  لا توجد خطط مكتملة في الأرشيف حالياً
                </p>
              ) : (
                <div className="bg-white border border-emerald-200 rounded-xl overflow-x-auto shadow-2xs">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="bg-emerald-100/60 text-emerald-900 font-black uppercase tracking-wider border-b border-emerald-200">
                        <th className="p-3">اسم الخطة</th>
                        <th className="p-3">الوصف</th>
                        <th className="p-3">الحالة</th>
                        <th className="p-3">تاريخ الإنجاز / الموعد</th>
                        <th className="p-3">المسؤول</th>
                        {isAdmin && <th className="p-3 text-center">إجراءات</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {completedPlans.map((plan) => (
                        <tr key={plan.id} className="hover:bg-emerald-50/40 transition-colors">
                          <td className="p-3 font-black text-slate-900 line-through decoration-emerald-500/70">{plan.title}</td>
                          <td className="p-3 text-slate-600 font-medium max-w-xs truncate">{plan.description || '—'}</td>
                          <td className="p-3">{getStatusBadge(plan.status)}</td>
                          <td className="p-3 text-slate-600 font-mono font-bold">{formatDate(plan.deadline)}</td>
                          <td className="p-3 font-bold text-slate-800">{plan.responsible || 'غير محدد'}</td>
                          {isAdmin && (
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
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="p-1 text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                                  title="تعديل الخطة"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmPlan({ id: plan.id, title: plan.title })}
                                  className="p-1 text-rose-600 hover:bg-rose-100 rounded cursor-pointer"
                                  title="حذف الخطة"
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
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal (Admin Only) */}
      {isAdmin && deleteConfirmPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-black text-sm text-slate-900">تأكيد حذف الخطة</h3>
            <p className="text-xs text-slate-600 font-bold leading-relaxed">
              هل أنت تأكيد من رغبتك في حذف الخطة "{deleteConfirmPlan.title}"؟ لا يمكن التراجع عن هذه الخطوة.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmPlan(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
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
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
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
