import React, { useState } from 'react';
import { Snowflake, Send, CheckCircle2, ShieldAlert, LogOut } from 'lucide-react';
import { ref, set } from 'firebase/database';
import { db, generateReadableId, auth } from '../lib/firebase';
import { sendAppNotification } from '../lib/notifications';
import { signOut } from 'firebase/auth';
import { UserProfile } from '../types';

interface FrozenOverlayProps {
  currentUser: UserProfile;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const FrozenOverlay: React.FC<FrozenOverlayProps> = ({ currentUser, showToast }) => {
  const [requested, setRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');

  const handleSendUnfreezeRequest = async () => {
    setSubmitting(true);
    try {
      const newReqId = generateReadableId('req', currentUser.name);
      await set(ref(db, `unfreeze_requests/${newReqId}`), {
        id: newReqId,
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        note: note.trim() || 'طلب فك التجميد من العضو',
        requestedAt: new Date().toISOString(),
        status: 'pending',
      });

      setRequested(true);
      sendAppNotification('❄️ طلب فك تجميد جديد', {
        body: `قام العضو ${currentUser.name} بتقديم طلب فك تجميد الحساب`,
        tag: `unfreeze-req-${newReqId}`
      });
      showToast('تم إرسال طلب فك التجميد إلى الأدمن بنجاح ✓', 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء إرسال الطلب', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-blue-950/60 backdrop-blur-md flex items-center justify-center p-4 dir-rtl font-sans">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-blue-200 text-center space-y-5 animate-in fade-in zoom-in duration-200">
        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
          <Snowflake className="w-9 h-9 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-[#0f172a] flex items-center justify-center gap-2">
            <span>حسابك مجمد حالياً</span>
            <ShieldAlert className="w-5 h-5 text-amber-500" />
          </h2>
          <p className="text-xs text-slate-600 font-bold leading-relaxed">
            تم تجميد حسابك مؤقتاً في نظام استوديو أرتياتك من قبل إدارة النظام.
            لا يمكنك إجراء أي عمليات حتى يتم إلغاء التجميد.
          </p>
        </div>

        {!requested ? (
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 text-right">
                سبب الطلب / ملاحظة للأدمن (اختياري):
              </label>
              <textarea
                rows={2}
                placeholder="اكتب ملاحظتك للإدارة..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none font-bold"
              />
            </div>

            <button
              onClick={handleSendUnfreezeRequest}
              disabled={submitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'جاري الإرسال...' : 'إرسال طلب فك التجميد للإدارة'}</span>
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 text-xs font-bold space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
            <p>تم إرسال طلبك بنجاح!</p>
            <p className="text-[11px] text-emerald-700 font-normal">سيتم مراجعة طلبك وتنشيط حسابك من قبل الأدمن قريباً.</p>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100">
          <button
            onClick={() => signOut(auth)}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
          >
            <LogOut className="w-4 h-4 text-slate-600" />
            <span>تسجيل الخروج من الحساب</span>
          </button>
        </div>
      </div>
    </div>
  );
};
