import React, { useState } from 'react';
import { Download, Upload, Database, RefreshCw, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { exportFullBackup, restoreFullBackup } from '../lib/firebase';
import { UserProfile } from '../types';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  showToast
}) => {
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [selectedFileContent, setSelectedFileContent] = useState<any>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setLoadingExport(true);
      await exportFullBackup();
      showToast('تم تصدير النسخة الاحتياطية وتنزيل الملف بنجاح ✓', 'success');
    } catch (err: any) {
      showToast('فشل تصدير النسخة الاحتياطية', 'error');
    } finally {
      setLoadingExport(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setSelectedFileContent(json);
        setConfirmRestore(true);
      } catch (err) {
        showToast('ملف النسخة الاحتياطية غير صالح أو تالف (JSON غير مطابق)', 'error');
        setSelectedFileContent(null);
        setSelectedFileName('');
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!selectedFileContent) return;
    try {
      setLoadingRestore(true);
      const res = await restoreFullBackup(selectedFileContent);
      if (res.success) {
        showToast(res.message, 'success');
        setConfirmRestore(false);
        setSelectedFileContent(null);
        setSelectedFileName('');
        onClose();
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('حدث خطأ أثناء استرجاع النسخة الاحتياطية', 'error');
    } finally {
      setLoadingRestore(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl font-['Cairo',sans-serif] animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-300">النسخ الاحتياطي والاسترجاع (Full Backup)</h3>
              <p className="text-xs text-slate-400">حفظ كامل بيانات المنظومة والمستخدمين واسترجاعها بنقرة زر</p>
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
        <div className="p-6 space-y-6">
          {/* Section 1: One-Click Export */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>تصدير نسخة احتياطية (One-Click Backup)</span>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed font-medium">
              يتضمن هذا الخيار تنزيل ملف JSON يحتوي على كامل قاعدة البيانات (المستخدمين، الخزائن، الحركات، الشرائح، كتيبات المشاريع، والخطط).
            </p>
            <button
              onClick={handleExport}
              disabled={loadingExport}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loadingExport ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء النسخة...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>تنزيل النسخة الاحتياطية الكاملة الآن (.json)</span>
                </>
              )}
            </button>
          </div>

          {/* Section 2: One-Click Restore */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
              <Upload className="w-4 h-4 text-amber-600" />
              <span>استرجاع نسخة احتياطية سابقاً</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed font-medium">
              استورد ملف JSON تم تصديره سابقاً لإعادة بناء كافة البيانات وحسابات الأعضاء.
            </p>

            <label className="block w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer text-center border border-slate-700">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <span className="flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                <span>اختر ملف النسخة الاحتياطية لاسترجاعها...</span>
              </span>
            </label>

            {selectedFileName && (
              <div className="p-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>الملف المحدد: {selectedFileName}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
            )}

            {confirmRestore && (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-rose-800 font-black text-xs">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>تأكيد الاسترجاع الشامل</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed">
                  تنبيه: سيتم كتابة وتحديث البيانات بالحالة الموجودة في ملف النسخة الاحتياطية. هل أنت متأكد من المتابعة؟
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleExecuteRestore}
                    disabled={loadingRestore}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {loadingRestore ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري الاسترجاع...</span>
                      </>
                    ) : (
                      <span>نعم، تأكيد الاسترجاع</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setConfirmRestore(false);
                      setSelectedFileContent(null);
                      setSelectedFileName('');
                    }}
                    className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 p-3 border-t border-slate-200 text-center">
          <button
            onClick={onClose}
            className="px-6 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-lg transition-colors cursor-pointer"
          >
            إغلاق Window
          </button>
        </div>
      </div>
    </div>
  );
};
