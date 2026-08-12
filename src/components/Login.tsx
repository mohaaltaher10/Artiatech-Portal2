import React, { useState } from 'react';
import { auth, db, logActivity } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { Building2, Lock, Mail, KeyRound, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('يرجى كتابة البريد الإلكتروني أولاً في الحقل المخصص أعلاه لإرسال رابط إعادة تعيين كلمة المرور');
      setResetMessage(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setResetMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.');
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('لم يتم العثور على حساب بهذا البريد الإلكتروني.');
      } else if (err.code === 'auth/invalid-email') {
        setError('البريد الإلكتروني غير صالحة صيغته.');
      } else {
        setError('تعذر إرسال رابط إعادة تعيين كلمة المرور: ' + (err.message || 'خطأ غير معروف'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('الرجاء إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);
    setError(null);
    setResetMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      let userCred;
      try {
        userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (authErr: any) {
        // Special auto-setup handling for default admin if account doesn't exist yet in Auth
        if (cleanEmail === 'artiatechstudio@gmail.com' && password === 'mohamed#2007') {
          try {
            userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          } catch (createErr: any) {
            // If creation failed because user exists but wrong password was typed
            throw authErr;
          }
        } else {
          throw authErr;
        }
      }

      const uid = userCred.user.uid;
      let userName = cleanEmail === 'artiatechstudio@gmail.com' ? 'إدارة استوديو أرتياتك' : 'عضو أرتياتك';
      let userRole: 'admin' | 'member' = cleanEmail === 'artiatechstudio@gmail.com' ? 'admin' : 'member';

      try {
        const userRef = ref(db, `users/${uid}`);
        const userSnap = await get(userRef);

        if (!userSnap.exists()) {
          // Create initial user doc in RTDB if it doesn't exist
          const initialUserData = {
            id: uid,
            name: userName,
            email: cleanEmail,
            role: userRole,
            status: 'main',
            joinDate: new Date().toISOString().split('T')[0],
            sliceBalances: {}
          };
          await set(userRef, initialUserData);
        } else {
          const data = userSnap.val();
          userName = data?.name || userName;
          userRole = data?.role || userRole;
        }

        // Log login activity
        await logActivity(
          uid,
          userName,
          userRole,
          'تسجيل دخول',
          `${userName} سجّل دخولاً إلى بوابة أرتياتك`
        );
      } catch (dbErr) {
        console.warn('RTDB post-login activity/user profile creation notice:', dbErr);
      }

      onSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('بيانات الدخول غير صحيحة. يرجى التأكد من البريد وكلمة المرور.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('تم حظر المحاولات مؤقتاً بسبب كثرة الطلبات. حاول مجدداً بعد قليل.');
      } else {
        setError(err.message || 'حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-['Cairo',sans-serif]">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#1e293b] text-white p-6 text-center border-b border-slate-800">
          <div className="w-14 h-14 bg-slate-800/80 border border-slate-700 rounded-lg flex items-center justify-center mx-auto mb-3 text-amber-400 shadow-sm">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">بوابة أرتياتك</h1>
        </div>

        {/* Login Form */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resetMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs font-bold flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{resetMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wider">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="البريد الإلكتروني"
                  className="w-full pr-9 pl-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  كلمة المرور
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700 hover:underline transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-9 pl-10 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                  title={showPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#1e293b] hover:bg-slate-800 text-amber-400 font-black rounded text-xs tracking-wider uppercase border border-[#1e293b] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

