import React, { useEffect, useState } from 'react';
import { db, auth, secondaryAuth, formatDate, logActivity } from '../lib/firebase';
import { ref, onValue, set, update, remove } from 'firebase/database';
import { UserProfile, UserRole, UserStatus } from '../types';
import { Users, PlusCircle, Edit2, Snowflake, Trash2, Shield, X, Mail, KeyRound } from 'lucide-react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';

interface MembersViewProps {
  currentUser: UserProfile;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const MembersView: React.FC<MembersViewProps> = ({ currentUser, showToast }) => {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<{ id: string; name: string } | null>(null);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [status, setStatus] = useState<UserStatus>('main');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(db, 'users'), (snapshot) => {
      const val = snapshot.val();
      const list: UserProfile[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
      setMembers(list);
      setLoading(false);
    }, (err) => {
      console.warn('Members listener notice:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const resetForm = () => {
    setShowAddForm(false);
    setName('');
    setEmail('');
    setPassword('');
    setRole('member');
    setStatus('main');
    setEditingId(null);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      showToast('يرجى إدخال الاسم والبريد الإلكتروني', 'error');
      return;
    }

    setSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      if (editingId) {
        // Protect main owner account
        const targetMember = members.find((m) => m.id === editingId);
        if (targetMember?.email?.toLowerCase() === 'artiatechstudio@gmail.com') {
          if (role !== 'admin' || status !== 'main' || cleanEmail !== 'artiatechstudio@gmail.com') {
            showToast('حساب مالك الاستوديو (artiatechstudio@gmail.com) محمي من تغيير الدور أو البريد أو التجميد!', 'error');
            setSubmitting(false);
            return;
          }
        }

        // Edit existing member
        await update(ref(db, `users/${editingId}`), {
          name: name.trim(),
          email: cleanEmail,
          role,
          status,
        });

        await logActivity(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          'تعديل عضو',
          `${currentUser.name} عدّل بيانات العضو: ${name.trim()}`
        );

        showToast('تمت تحديث بيانات العضو بنجاح ✓', 'success');
      } else {
        // Add new member
        if (!password || password.length < 6) {
          showToast('يرجى إدخال كلمة مرور من 6 أحرف على الأقل', 'error');
          setSubmitting(false);
          return;
        }

        let newUid = `user_${Date.now()}`;
        try {
          // Attempt creating user in secondaryAuth so Admin's primary auth session is preserved
          const newAuthUser = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
          newUid = newAuthUser.user.uid;
          // Sign out of secondaryAuth immediately so it doesn't hold secondary auth state
          await signOut(secondaryAuth);
        } catch (authErr: any) {
          console.warn('Auth account creation note:', authErr.message);
        }

        const todayStr = new Date().toISOString().split('T')[0];
        await set(ref(db, `users/${newUid}`), {
          id: newUid,
          name: name.trim(),
          email: cleanEmail,
          role,
          status,
          joinDate: todayStr,
          sliceBalances: {},
        });

        await logActivity(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          'إضافة عضو',
          `${currentUser.name} أضاف عضواً جديداً: ${name.trim()} (${cleanEmail})`
        );

        showToast('تمت إضافة العضو بنجاح ✓', 'success');
      }

      resetForm();
    } catch (err: any) {
      console.error('Member save error:', err);
      showToast(err.message || 'حدث خطأ أثناء حفظ البيانات.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Freeze Status
  const handleToggleFreeze = async (m: UserProfile) => {
    if (m.email?.toLowerCase() === 'artiatechstudio@gmail.com') {
      showToast('حساب مالك الاستوديو الرئيسي محمي ولا يمكن تجميده!', 'error');
      return;
    }

    const newStatus: UserStatus = m.status === 'frozen' ? 'main' : 'frozen';
    const actionText = newStatus === 'frozen' ? 'تجميد' : 'إلغاء تجميد';

    if (!window.confirm(`هل أنت تأكد من ${actionText} حساب العضو "${m.name}"؟`)) return;

    try {
      await update(ref(db, `users/${m.id}`), {
        status: newStatus,
      });

      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        `${actionText} عضو`,
        `${currentUser.name} قام بـ ${actionText} حساب العضو: ${m.name}`
      );

      showToast(`تم ${actionText} حساب العضو بنجاح ✓`, 'success');
    } catch (err) {
      showToast('حدث خطأ. حاول مرة أخرى.', 'error');
    }
  };

  // Delete Member
  const handleDeleteMember = async (id: string, name: string) => {
    if (id === currentUser.id) {
      showToast('لا يمكنك حذف حسابك الحالي', 'error');
      return;
    }

    const targetMember = members.find((m) => m.id === id);
    if (targetMember?.email?.toLowerCase() === 'artiatechstudio@gmail.com') {
      showToast('حساب مالك الاستوديو الرئيسي محمي ولا يمكن حذفه!', 'error');
      return;
    }

    try {
      await remove(ref(db, `users/${id}`));
      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'حذف عضو',
        `${currentUser.name} حذف العضو: ${name}`
      );
      showToast('تم حذف العضو بنجاح ✓', 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء الحذف.', 'error');
    }
  };

  const getStatusBadge = (st: UserStatus) => {
    switch (st) {
      case 'main':
        return <span className="text-slate-800 font-bold text-[11px]">أساسي</span>;
      case 'participant':
        return <span className="text-slate-800 font-bold text-[11px]">مشارك</span>;
      case 'frozen':
        return <span className="text-slate-800 font-bold text-[11px]">مجمد</span>;
      default:
        return <span className="text-slate-800 font-bold text-[11px]">أساسي</span>;
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-500 font-bold">جاري تحميل قائمة الأعضاء...</div>;
  }

  return (
    <div className="space-y-6 font-['Cairo',sans-serif]">
      {/* Top Header & Admin Add Member Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-[#0f172a] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#1e293b]" />
            أعضاء الاستوديو
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
            <span>{showAddForm ? 'إلغاء' : 'إضافة عضو جديد'}</span>
          </button>
        )}
      </div>

      {/* Inline Form: Add / Edit Member */}
      {showAddForm && (
        <form onSubmit={handleSaveMember} className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-xs font-black text-[#0f172a] uppercase tracking-wider">
              {editingId ? 'تعديل بيانات العضو' : 'إضافة عضو جديد للاستوديو'}
            </h3>
            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الاسم الكامل</label>
              <input
                type="text"
                required
                placeholder="الاسم الثلاثي"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                required
                placeholder="email@artiatech.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            {!editingId && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">كلمة المرور الإبتدائية</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الدور (الصلاحيات)</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              >
                <option value="member">عضو (عرض فقط)</option>
                <option value="admin">أدمن (إدارة كاملة)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الوضع/الحالة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              >
                <option value="main">أساسي</option>
                <option value="participant">مشارك</option>
                <option value="frozen">مجمد</option>
              </select>
            </div>
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
              حفظ بيانات العضو
            </button>
          </div>
        </form>
      )}

      {/* Members Table */}
      {members.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-xs font-bold">
          لا توجد بيانات بعد
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase tracking-wider">
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3">الاسم</th>
                <th className="p-3">البريد الإلكتروني</th>
                <th className="p-3">الدور</th>
                <th className="p-3">الوضع/الحالة</th>
                <th className="p-3">تاريخ الانضمام</th>
                {currentUser.role === 'admin' && <th className="p-3 text-center">إجراءات (أدمن)</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {members.map((m, idx) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono font-bold text-slate-500 text-center">{idx + 1}</td>
                  <td className="p-3 font-black text-[#0f172a] flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-[#1e293b] text-amber-400 font-black flex items-center justify-center text-xs shrink-0">
                      {m.name ? m.name.charAt(0) : 'ع'}
                    </div>
                    <span>{m.name}</span>
                  </td>
                  <td className="p-3 text-slate-600 dir-ltr text-right font-mono font-bold">{m.email}</td>
                  <td className="p-3">
                    <span className="text-slate-800 font-bold text-[11px]">
                      {m.role === 'admin' ? 'أدمن' : 'عضو'}
                    </span>
                  </td>
                  <td className="p-3">{getStatusBadge(m.status)}</td>
                  <td className="p-3 text-slate-500 font-mono font-bold">{formatDate(m.joinDate)}</td>

                  {currentUser.role === 'admin' && (
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Edit Button */}
                        <button
                          onClick={() => {
                            setEditingId(m.id);
                            setName(m.name);
                            setEmail(m.email);
                            setRole(m.role);
                            setStatus(m.status);
                            setShowAddForm(true);
                          }}
                          className="p-1 text-slate-600 hover:bg-slate-200 rounded"
                          title="تعديل البيانات"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Freeze / Unfreeze Toggle Button */}
                        <button
                          onClick={() => handleToggleFreeze(m)}
                          className={`p-1 rounded ${
                            m.status === 'frozen'
                              ? 'text-emerald-700 hover:bg-emerald-100'
                              : 'text-amber-700 hover:bg-amber-100'
                          }`}
                          title={m.status === 'frozen' ? 'إلغاء التجميد' : 'تجميد الحساب'}
                        >
                          <Snowflake className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmMember({ id: m.id, name: m.name })}
                          className="p-1 text-rose-600 hover:bg-rose-100 rounded cursor-pointer"
                          title="حذف العضو"
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
      {deleteConfirmMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-black text-sm text-slate-900">تأكيد حذف العضو</h3>
            <p className="text-xs text-slate-600 font-bold leading-relaxed">
              هل أنت متأكد من رغبتك في حذف العضو "{deleteConfirmMember.name}"؟ لا يمكن التراجع عن هذه الخطوة.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmMember(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteConfirmMember;
                  setDeleteConfirmMember(null);
                  await handleDeleteMember(target.id, target.name);
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
