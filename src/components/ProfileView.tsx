import React, { useEffect, useState } from 'react';
import { db, auth, formatCurrency, formatDate, logActivity, repairDatabase, RepairResult } from '../lib/firebase';
import { isNotificationsEnabled, requestNotificationPermission, setNotificationsEnabled, getNotificationPermission } from '../lib/notifications';
import { ref, onValue, update } from 'firebase/database';
import { updatePassword, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { UserProfile, DistributionFundSlice, ProjectBooklet } from '../types';
import {
  User,
  Shield,
  Calendar,
  PieChart,
  KeyRound,
  Mail,
  AlertCircle,
  Snowflake,
  Eye,
  EyeOff,
  BookOpen,
  FileCheck,
  Database,
  Wrench,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Bell,
  X
} from 'lucide-react';

interface ProfileViewProps {
  currentUser: UserProfile;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

interface UnfreezeRequestItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  note: string;
  requestedAt: string;
  status: string;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, showToast }) => {
  const [slices, setSlices] = useState<DistributionFundSlice[]>([]);
  const [assignedBooklets, setAssignedBooklets] = useState<ProjectBooklet[]>([]);
  const [unfreezeRequests, setUnfreezeRequests] = useState<UnfreezeRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for account update
  const [newName, setNewName] = useState(currentUser.name || '');
  const [newEmail, setNewEmail] = useState(currentUser.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [freezeRequested, setFreezeRequested] = useState(!!currentUser.freezeRequested);
  const [showConfirmFreezeModal, setShowConfirmFreezeModal] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairReport, setRepairReport] = useState<RepairResult | null>(null);
  const [showConfirmRepairModal, setShowConfirmRepairModal] = useState(false);
  const [notifActive, setNotifActive] = useState<boolean>(isNotificationsEnabled());

  const [selectedBooklet, setSelectedBooklet] = useState<ProjectBooklet | null>(null);

  const stripHtml = (html: string) => {
    if (!html) return '';
    return html
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleToggleNotifications = async () => {
    if (notifActive) {
      setNotificationsEnabled(false);
      setNotifActive(false);
      showToast('تم تعطيل الإشعارات على هذا الجهاز', 'success');
    } else {
      if (getNotificationPermission() === 'denied') {
        alert('الإشعارات محظورة في إعدادات المتصفح لهذا الموقع. يرجى السماح بها بالنقر على أيقونة القفل 🔒 بجانب رابط الموقع.');
        showToast('يرجى السماح بالإشعارات من إعدادات المتصفح أولاً', 'error');
        return;
      }
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotifActive(true);
        showToast('تم تفعيل الإشعارات بنجاح 🔔', 'success');
      } else {
        setNotifActive(false);
        showToast('لم يتم إعطاء إذن الإشعارات', 'error');
      }
    }
  };

  const executeDatabaseRepair = async () => {
    setShowConfirmRepairModal(false);
    setRepairing(true);
    try {
      const result = await repairDatabase();
      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'إصلاح قاعدة البيانات',
        `${currentUser.name} قام بتشغيل أداة إصلاح وتنظيف قاعدة البيانات (تم معالجة ${result.fixedCount} سجل)`
      );
      setRepairReport(result);
      showToast(result.details, 'success');
    } catch (err: any) {
      console.error('Database repair error:', err);
      showToast('حدث خطأ أثناء إصلاح قاعدة البيانات: ' + (err.message || ''), 'error');
    } finally {
      setRepairing(false);
    }
  };

  useEffect(() => {
    // 1. Listen to distribution fund
    const unsubSlices = onValue(ref(db, 'distribution_fund'), (snapshot) => {
      const val = snapshot.val();
      const list: DistributionFundSlice[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      setSlices(list);
    }, (err) => console.warn('Distribution fund listener notice in profile:', err));

    // 2. Listen to assigned booklets
    const unsubBooklets = onValue(ref(db, 'project_booklets'), (snapshot) => {
      const val = snapshot.val();
      const list: ProjectBooklet[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      const assigned = list.filter((b) =>
        b.teamMembers?.some((m) => m.userId === currentUser.id)
      );
      setAssignedBooklets(assigned);
      setLoading(false);
    }, (err) => {
      console.warn('Project booklets listener in profile:', err);
      setLoading(false);
    });

    // 3. Listen to unfreeze requests if admin
    let unsubUnfreeze = () => {};
    if (currentUser.role === 'admin') {
      unsubUnfreeze = onValue(ref(db, 'unfreeze_requests'), (snapshot) => {
        const val = snapshot.val();
        const list: UnfreezeRequestItem[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
        list.sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
        setUnfreezeRequests(list);
      }, (err) => console.warn('Unfreeze requests listener in profile:', err));
    }

    return () => {
      unsubSlices();
      unsubBooklets();
      unsubUnfreeze();
    };
  }, [currentUser.id, currentUser.role]);

  // Filter slices where current user is a member
  const mySlicesData = slices
    .map((slice) => {
      const mem = slice.members?.find((m) => m.userId === currentUser.id);
      if (!mem) return null;
      return {
        sliceId: slice.id,
        sliceName: slice.name,
        sliceDesc: slice.description,
        shares: mem.shares,
        balance: mem.balance,
      };
    })
    .filter(Boolean) as {
    sliceId: string;
    sliceName: string;
    sliceDesc: string;
    shares: number;
    balance: number;
  }[];

  const totalMyBalance = mySlicesData.reduce((sum, item) => sum + item.balance, 0);

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);

    try {
      const user = auth.currentUser;
      const isEmailChanging = newEmail.trim().toLowerCase() !== (currentUser.email || '').toLowerCase();
      const isPasswordChanging = newPassword.trim().length > 0;

      if ((isEmailChanging || isPasswordChanging) && !user) {
        throw new Error('انتهت جلسة أمان الفايربيس. يرجى تسجيل الخروج ثم إعادة تسجيل الدخول لمتابعة تعديل الحساب.');
      }

      // Re-authenticate if modifying password or email and current user exists
      if ((isEmailChanging || isPasswordChanging) && user) {
        if (!currentPassword.trim()) {
          throw new Error('يرجى كتابة كلمة المرور الحالية');
        }

        try {
          const credential = EmailAuthProvider.credential(user.email || currentUser.email, currentPassword.trim());
          await reauthenticateWithCredential(user, credential);
        } catch (reauthErr: any) {
          console.error('Re-authentication failed:', reauthErr);
          if (reauthErr.code === 'auth/wrong-password' || reauthErr.code === 'auth/invalid-credential') {
            throw new Error('كلمة المرور الحالية غير صحيحة');
          }
          throw new Error('كلمة المرور الحالية غير صحيحة');
        }
      }

      // Update Name if changed
      if (newName.trim() !== currentUser.name) {
        await update(ref(db, `users/${currentUser.id}`), {
          name: newName.trim(),
        });
      }

      // Update email if changed
      if (isEmailChanging && user) {
        await updateEmail(user, newEmail.trim().toLowerCase());
        await update(ref(db, `users/${currentUser.id}`), {
          email: newEmail.trim().toLowerCase(),
        });
      }

      // Update password if provided
      if (isPasswordChanging && user) {
        if (newPassword.trim().length < 6) {
          throw new Error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
        }
        if (newPassword !== confirmPassword) {
          throw new Error('كلمة المرور الجديدة وتأكيد كلمة المرور غير متطابقين');
        }
        await updatePassword(user, newPassword.trim());
      }

      showToast('تم تحديث بيانات الحساب بنجاح ✓', 'success');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (err: any) {
      console.error('Account update error:', err);
      let errMsg = err.message || 'حدث خطأ. حاول مرة أخرى.';
      if (err.code === 'auth/requires-recent-login') {
        errMsg = 'يتطلب إجراء هذه العملية إدخال كلمة المرور الحالية لتأكيد الأمان.';
      }
      showToast(errMsg, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const executeFreezeRequest = async () => {
    setShowConfirmFreezeModal(false);
    try {
      await update(ref(db, `users/${currentUser.id}`), {
        freezeRequested: true,
        freezeRequestedAt: new Date().toISOString(),
      });

      setFreezeRequested(true);
      showToast('تم تقديم طلب التجميد للأدمن بنجاح ✓', 'success');
    } catch (err: any) {
      showToast('حدث خطأ أثناء تقديم الطلب. حاول مرة أخرى.', 'error');
    }
  };

  const handleFreezeRequest = () => {
    setShowConfirmFreezeModal(true);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'main':
        return 'عضو أساسي';
      case 'participant':
        return 'عضو مشارك';
      case 'frozen':
        return 'عضو مجمد';
      default:
        return 'عضو أساسي';
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-500 font-bold">جاري تحميل الملف الشخصي...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-['Cairo',sans-serif]">
      {/* Large Profile Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded bg-[#1e293b] text-amber-400 font-black text-2xl flex items-center justify-center border border-slate-800 shrink-0">
              {currentUser.name ? currentUser.name.charAt(0) : 'أ'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-[#0f172a]">{currentUser.name}</h1>
              </div>
              <p className="text-xs text-slate-500 font-bold">{currentUser.email}</p>
              <div className="flex items-center gap-4 text-xs text-slate-500 font-bold pt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  تاريخ الانضمام: {formatDate(currentUser.joinDate)}
                </span>
                <span className="font-extrabold text-slate-800">
                  الحالة: {getStatusLabel(currentUser.status)}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-md p-4 text-center sm:text-left">
            <span className="text-xs text-slate-500 font-black uppercase tracking-wider block mb-1">إجمالي رصيدك في الشرائح</span>
            <span className="text-2xl font-black text-[#1e293b] dir-ltr block">
              {formatCurrency(totalMyBalance)}
            </span>
          </div>
        </div>

        {/* Action button for freeze request */}
        <div className="pt-4 flex justify-end">
          <button
            onClick={handleFreezeRequest}
            disabled={freezeRequested || currentUser.freezeRequested || currentUser.status === 'frozen'}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border border-slate-300 hover:border-rose-300 rounded text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Snowflake className="w-4 h-4 text-slate-500" />
            <span>
              {currentUser.status === 'frozen'
                ? 'الحساب مُجمّد حالياً'
                : freezeRequested || currentUser.freezeRequested
                ? 'تم تقديم طلب التجميد للإدارة ⏳'
                : 'طلب تجميد الحساب ❄️'}
            </span>
          </button>
        </div>
      </div>

      {/* Assigned Plans & Booklets Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#1e293b]" />
            <h2 className="text-base font-black text-[#0f172a]">الخطط والكتيبات المكلف بها</h2>
          </div>
          <span className="text-xs text-slate-500 font-bold">{assignedBooklets.length} مشروع</span>
        </div>

        {assignedBooklets.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 font-medium">غير مكلف بأي خطط أو كتيبات حالياً</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assignedBooklets.map((b) => (
              <div
                key={b.id}
                onClick={() => setSelectedBooklet(b)}
                className="p-3 bg-slate-50 border border-slate-200 hover:border-[#1e293b] rounded-lg space-y-1.5 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xs text-[#0f172a] group-hover:text-amber-800 transition-colors flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                    <span>{b.name}</span>
                  </h3>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-[10px]">
                    {b.status === 'active' ? 'نشط' : b.status === 'under_study' ? 'قيد الدراسة' : 'مؤرشف'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium line-clamp-2 leading-relaxed">
                  {stripHtml(b.content) || 'اضغط لاستعراض التفاصيل والمهام الكاملة...'}
                </p>
                <div className="text-[10px] text-amber-700 font-bold text-left pt-1 flex items-center justify-end gap-1">
                  <span>عرض التفاصيل الكاملة 📄</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: View Full Assigned Booklet */}
      {selectedBooklet && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#1e293b] text-amber-400 rounded-lg">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">{selectedBooklet.name}</h2>
                  <p className="text-xs text-slate-500 font-bold">كتيب مشروع مكلف به - أرتياتك</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBooklet(null)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
              <div className="booklet-html-content text-xs text-slate-800 leading-relaxed font-medium dir-rtl overflow-x-auto space-y-2 [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:border [&_th]:border-slate-300 [&_th]:p-2.5 [&_th]:bg-slate-100 [&_th]:text-[#0f172a] [&_th]:font-black [&_td]:border [&_td]:border-slate-200 [&_td]:p-2.5 [&_h1]:text-base [&_h1]:font-black [&_h2]:text-sm [&_h2]:font-black [&_h3]:text-xs [&_h3]:font-black [&_ul]:list-disc [&_ul]:pr-5 [&_ol]:list-decimal [&_ol]:pr-5 [&_li]:my-1 [&_p]:my-1.5"
                dangerouslySetInnerHTML={{ __html: selectedBooklet.content || 'لا يوجد محتوى مدرج حالياً.' }}
              />
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-200">
              <button
                onClick={() => setSelectedBooklet(null)}
                className="px-4 py-2 bg-[#1e293b] text-amber-400 hover:bg-slate-800 font-black text-xs rounded-lg transition-colors cursor-pointer"
              >
                إغلاق الكتيب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slices Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#1e293b]" />
            <h2 className="text-base font-black text-[#0f172a]">شرائحك في صندوق التوزيعات</h2>
          </div>
          <span className="text-xs text-slate-500 font-bold">{mySlicesData.length} شرائح</span>
        </div>

        {mySlicesData.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 font-medium">لا توجد بيانات بعد (لم تُدرج في شرائح توزيعات حتى الآن)</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 font-black uppercase tracking-wider">
                  <th className="p-2.5">الشريحة</th>
                  <th className="p-2.5">الوصف</th>
                  <th className="p-2.5 text-center">أسهمك</th>
                  <th className="p-2.5 text-left">رصيدك</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {mySlicesData.map((item) => (
                  <tr key={item.sliceId} className="hover:bg-slate-50">
                    <td className="p-2.5 font-black text-[#0f172a]">{item.sliceName}</td>
                    <td className="p-2.5 text-slate-600 font-medium">{item.sliceDesc || '—'}</td>
                    <td className="p-2.5 text-center font-bold text-slate-800">{item.shares}</td>
                    <td className="p-2.5 text-left font-black text-[#1e293b] dir-ltr">
                      {formatCurrency(item.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Update Account & Security Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 mb-4">
          <KeyRound className="w-4 h-4 text-[#1e293b]" />
          <h2 className="text-base font-black text-[#0f172a]">تعديل بيانات الحساب والأمان</h2>
        </div>

        <form onSubmit={handleUpdateAccount} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1 uppercase tracking-wider">
              الاسم الكامل
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 mb-1 uppercase tracking-wider">
              كلمة المرور الحالية
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="أدخل كلمة المرور الحالية..."
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pr-9 pl-10 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 mb-1 uppercase tracking-wider">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 mb-1 uppercase tracking-wider">
              كلمة المرور الجديدة
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pr-9 pl-10 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {newPassword.trim().length > 0 && (
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1 uppercase tracking-wider">
                تأكيد كلمة المرور الجديدة
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="أعد كتابة كلمة المرور..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pr-9 pl-10 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={updating}
            className="px-4 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 font-black rounded text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
          >
            {updating ? 'جاري التحديث...' : 'تحديث البيانات'}
          </button>
        </form>
      </div>

      {/* Simplified Notification Settings Card with Toggle Switch */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
        <label
          htmlFor="notif-toggle"
          className="text-sm font-black text-slate-800 cursor-pointer flex items-center gap-2.5"
        >
          <Bell className={`w-4 h-4 ${notifActive ? 'text-amber-500' : 'text-slate-400'}`} />
          <span>الإشعارات</span>
        </label>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500">
            {notifActive ? 'مفعّلة' : 'معطلة'}
          </span>
          <button
            id="notif-toggle"
            type="button"
            role="switch"
            aria-checked={notifActive}
            onClick={handleToggleNotifications}
            className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center cursor-pointer shadow-inner ${
              notifActive ? 'bg-amber-500 justify-start' : 'bg-slate-300 justify-end'
            }`}
            title={notifActive ? 'تعطيل الإشعارات' : 'تفعيل الإشعارات'}
          >
            <span className="w-5 h-5 bg-white rounded-full shadow-md block transform transition-all duration-200" />
          </button>
        </div>
      </div>

      {/* Special Admin Section: Unfreeze Requests and Member Notes */}
      {currentUser.role === 'admin' && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-blue-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
                <Snowflake className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">طلبات فك التجميد والملاحظات (خاص بالأدمن)</h2>
                <p className="text-xs text-slate-500 font-bold">الأسباب والملاحظات المقدمة من الأعضاء لفك تجميد حساباتهم</p>
              </div>
            </div>
            <span className="text-xs font-black px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
              {unfreezeRequests.length} طلبات
            </span>
          </div>

          {unfreezeRequests.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-xl border border-dashed border-slate-200">
              لا توجد طلبات فك تجميد معلقة حالياً.
            </div>
          ) : (
            <div className="space-y-3">
              {unfreezeRequests.map((req) => (
                <div key={req.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-black text-slate-900">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-slate-500" />
                      {req.userName} ({req.userEmail})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {req.requestedAt ? new Date(req.requestedAt).toLocaleString('ar-LY') : ''}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 leading-relaxed font-medium">
                    <strong className="text-blue-900 block text-[11px] mb-1">السبب / الملاحظة المدونة:</strong>
                    {req.note || 'لم يُدخل العضو ملاحظة مدونة'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin Database Repair Tool Card */}
      {currentUser.role === 'admin' && (
        <div className="bg-amber-50/70 border border-amber-300 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-800" />
              <h2 className="text-base font-black text-slate-900">إعدادات الأدمن - إصلاح وصيانة قاعدة البيانات</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px]">
              صلاحيات الأدمن
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <h3 className="text-xs font-black text-slate-800">أداة فحص وتنظيف البيانات (Database Health & Fix)</h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                نقرة واحدة تقوم بتعبئة كافة المربعات والبيانات الناقصة بقيم افتراضية صفرية، وإعادة تسمية معرفات العناصر العشوائية القديمة إلى أسماء وتواريخ واضحة ومباشرة مع استثناء معرفات حسابات المستخدمين (Users).
              </p>
            </div>

            <button
              onClick={() => setShowConfirmRepairModal(true)}
              disabled={repairing}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg text-xs transition-all shadow-sm shrink-0 disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Wrench className={`w-4 h-4 ${repairing ? 'animate-spin' : ''}`} />
              <span>{repairing ? 'جاري الفحص والإصلاح...' : 'إصلاح الداتا بيس'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Database Repair */}
      {showConfirmRepairModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-800 pb-2 border-b border-slate-100">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">تأكيد تشغيل إصلاح قاعدة البيانات</h3>
                <p className="text-xs font-bold text-amber-700">صلاحيات الإدارة - الأدمن</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium leading-relaxed bg-amber-50/70 p-3 rounded-xl border border-amber-200">
              هل أنت متأكد من تشغيل أداة الفحص والإصلاح الشاملة؟
              <br />
              <strong className="font-black text-slate-900 block mt-1">ما الذي ستقوم به الأداة؟</strong>
              • تعبئة المربعات والحقول الفارغة بقيم افتراضية صفرية وسليمة.
              <br />
              • إعادة تسمية معرفات العناصر القديمة إلى معرفات واضحة مدمجة بالتاريخ.
              <br />
              • <span className="text-emerald-700 font-bold">الحفاظ الكامل على حسابات المستخدمين (Users) بدون أي تغيير.</span>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowConfirmRepairModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={executeDatabaseRepair}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow transition-colors cursor-pointer active:scale-95 flex items-center gap-2"
              >
                <Wrench className="w-4 h-4" />
                <span>تأكيد وبدء الإصلاح الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Repair Result Modal */}
      {repairReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">تقرير نتيجة إصلاح قاعدة البيانات</h2>
                  <p className="text-xs text-slate-500 font-bold">تم الانتهاء من الفحص والمعالجة الفورية بنجاح</p>
                </div>
              </div>
              <button
                onClick={() => setRepairReport(null)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-slate-500 block">إجمالي المسجلات</span>
                <span className="text-lg font-black text-slate-900">{repairReport.fixedCount}</span>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-amber-800 block">ID معاد تسميتها</span>
                <span className="text-lg font-black text-amber-900">{repairReport.renamedCount}</span>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-blue-800 block">حقول تم تعبئتها</span>
                <span className="text-lg font-black text-blue-900">{repairReport.defaultFilledCount}</span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-emerald-800 block">حسابات اليوزرس المحمية</span>
                <span className="text-lg font-black text-emerald-900">{repairReport.usersUntouchedCount}</span>
              </div>
            </div>

            {/* Preserved Users Banner */}
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-3 text-xs text-emerald-900 font-bold">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                تم استثناء {repairReport.usersUntouchedCount} حساباً للمستخدمين (Users) بنجاح والمحافظة على معرفاتهم وصلاحياتهم دون أي تغيير.
              </span>
            </div>

            {/* Section Summaries */}
            <div className="space-y-2">
              <h3 className="text-xs font-black text-slate-800">تفاصيل الأقسام المعالجة:</h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {repairReport.nodeSummaries.map((s, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                    <span className="font-bold text-slate-800">{s.nodeName}</span>
                    <div className="flex items-center gap-3 font-bold">
                      <span className="text-slate-600">{s.count} عنصر</span>
                      {s.renamed > 0 ? (
                        <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[10px]">
                          تم تحديث {s.renamed} ID
                        </span>
                      ) : (
                        <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                          IDs سليمة
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Close */}
            <div className="pt-2 text-left border-t border-slate-200">
              <button
                onClick={() => setRepairReport(null)}
                className="px-5 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black rounded-xl transition-colors cursor-pointer"
              >
                موافق وإغلاق التقرير
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Freeze Request */}
      {showConfirmFreezeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-cyan-800 pb-2 border-b border-slate-100">
              <div className="p-2.5 bg-cyan-100 rounded-xl">
                <Snowflake className="w-6 h-6 text-cyan-700" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">تأكيد تقديم طلب تجميد الحساب</h3>
                <p className="text-xs font-bold text-slate-500">إشعار إدارة أرتياتك</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              هل أنت متأكد من تقديم طلب لتجميد حسابك الشخصي؟
              <br />
              <strong className="font-black text-slate-900 block mt-1">ماذا يحدث بعد تقديم الطلب؟</strong>
              • سيظهر شريط (طلب تجميد ⏳) لدى إدارة الاستوديو في قائمة الأعضاء.
              <br />
              • سيتلقى الأدمن إشعاراً وبنداً في سجل الأحداث لمراجعة وتأكيد طلب التجميد.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowConfirmFreezeModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={executeFreezeRequest}
                className="px-5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-black text-xs rounded-xl shadow transition-colors cursor-pointer active:scale-95 flex items-center gap-2"
              >
                <Snowflake className="w-4 h-4" />
                <span>تأكيد وتقديم الطلب</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
