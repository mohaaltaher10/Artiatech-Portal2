import React, { useEffect, useState } from 'react';
import { db, formatDate, logActivity, generateReadableId } from '../lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';
import { Announcement, UserProfile } from '../types';
import { Megaphone, PlusCircle, Pin, Trash2, Search, X, Eye, Calendar, User } from 'lucide-react';

interface AnnouncementsViewProps {
  currentUser: UserProfile;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

// Formatted Announcement Content Component (supports HTML & formatted text)
const FormattedAnnouncementContent: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return <p className="text-slate-400 italic text-xs">لا يوجد نص في هذا الإعلان.</p>;

  const isHtml = /<[a-z][\s\S]*>/i.test(content.trim());

  if (isHtml) {
    return (
      <div
        className="announcement-html-content text-xs text-slate-800 leading-relaxed font-medium dir-rtl overflow-x-auto space-y-2 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pr-5 [&_ol]:list-decimal [&_ol]:pr-5 [&_li]:my-1 [&_h1]:text-base [&_h1]:font-black [&_h2]:text-sm [&_h2]:font-black [&_h3]:text-xs [&_h3]:font-black"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <div className="text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-wrap break-words space-y-2">
      {content}
    </div>
  );
};

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({
  currentUser,
  showToast,
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  const [deleteConfirmAnn, setDeleteConfirmAnn] = useState<Announcement | null>(null);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pinned' | 'normal'>('all');

  useEffect(() => {
    const annRef = ref(db, 'announcements');
    const unsub = onValue(annRef, (snapshot) => {
      const val = snapshot.val();
      const list: Announcement[] = [];
      if (val) {
        Object.keys(val).forEach((k) => {
          list.push({ id: k, ...val[k] });
        });
      }
      // Sort pinned first, then by createdDate desc
      list.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime();
      });
      setAnnouncements(list);
      setLoading(false);
    }, (err) => {
      console.warn('Announcements listener notice:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      showToast('يرجى كتابة عنوان ونص الإعلان', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const newAnnId = generateReadableId('ann', title);
      await set(ref(db, `announcements/${newAnnId}`), {
        id: newAnnId,
        title: title.trim(),
        content: content.trim(),
        isPinned,
        createdBy: currentUser.name,
        createdDate: nowStr,
      });

      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'إنشاء إعلان',
        `${currentUser.name} أنشأ إعلاناً جديداً: ${title.trim()}`
      );

      showToast('تم نشر الإعلان بنجاح ✓', 'success');
      setShowAddForm(false);
      setTitle('');
      setContent('');
      setIsPinned(false);
    } catch (err) {
      showToast('حدث خطأ أثناء النشر.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string, annTitle: string) => {
    try {
      await remove(ref(db, `announcements/${id}`));
      if (selectedAnn?.id === id) {
        setSelectedAnn(null);
      }
      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'حذف إعلان',
        `${currentUser.name} حذف الإعلان: ${annTitle}`
      );
      showToast('تم حذف الإعلان بنجاح ✓', 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء الحذف.', 'error');
    }
  };

  const filteredAnnouncements = announcements.filter((a) => {
    const matchesSearch =
      a.title?.includes(searchQuery) ||
      a.content?.includes(searchQuery) ||
      a.createdBy?.includes(searchQuery);

    if (!matchesSearch) return false;
    if (filterType === 'pinned') return a.isPinned;
    if (filterType === 'normal') return !a.isPinned;
    return true;
  });

  if (loading) {
    return <div className="py-12 text-center text-slate-500 font-bold">جاري تحميل الإعلانات والتنويهات...</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-['Cairo',sans-serif]">
      {/* Top Header & Admin Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-800">
            <Megaphone className="w-5 h-5 text-slate-800" />
          </div>
          <div>
            <h2 className="text-base font-black text-[#0f172a]">الإعلانات والتنويهات الرسمية</h2>
            <p className="text-xs text-slate-500 font-bold">عرض القرارات والتنويهات الصادرة عن إدارة الاستوديو</p>
          </div>
        </div>

        {currentUser.role === 'admin' && (
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 font-black text-xs rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showAddForm ? 'إلغاء' : 'نشر إعلان جديد'}</span>
          </button>
        )}
      </div>

      {/* Inline Add Announcement Form */}
      {showAddForm && (
        <form onSubmit={handleCreateAnnouncement} className="bg-white border border-slate-200 p-5 rounded-xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-xs font-black text-[#0f172a]">نشر إعلان جديد</h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">عنوان الإعلان</label>
            <input
              type="text"
              required
              placeholder="اكتب عنوان الإعلان..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#1e293b] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">تفاصيل ومحتوى الإعلان</label>
            <textarea
              rows={5}
              required
              placeholder="اكتب تفاصيل الإعلان..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#1e293b] focus:outline-none leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pinCheck"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="w-4 h-4 text-slate-900 rounded border-slate-300 cursor-pointer"
            />
            <label htmlFor="pinCheck" className="text-xs font-bold text-slate-800 flex items-center gap-1 cursor-pointer">
              <Pin className="w-3.5 h-3.5 text-amber-600" />
              تثبيت الإعلان في أعلى القائمة 📌
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black rounded-lg disabled:opacity-50 cursor-pointer"
            >
              نشر الإعلان
            </button>
          </div>
        </form>
      )}

      {/* Search Bar & Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="البحث في الإعلانات والتنويهات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:border-[#1e293b] focus:outline-none shadow-2xs"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-white p-1 border border-slate-200 rounded-lg text-xs font-bold self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-[#1e293b] text-amber-400'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            الكل ({announcements.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('pinned')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterType === 'pinned'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            المثبتة 📌
          </button>
          <button
            type="button"
            onClick={() => setFilterType('normal')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterType === 'normal'
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            العادية
          </button>
        </div>
      </div>

      {/* Announcements Card Grid (identical to Project Booklets layout) */}
      {filteredAnnouncements.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs font-bold">
          لا توجد إعلانات مطابقة حالياً
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAnnouncements.map((ann) => (
            <div
              key={ann.id}
              className={`rounded-xl border p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${
                ann.isPinned
                  ? 'bg-amber-50/50 border-amber-300'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-black text-[#0f172a] text-sm leading-snug line-clamp-2">
                    {ann.title}
                  </h3>
                  {ann.isPinned && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black shrink-0">
                      <Pin className="w-3 h-3 text-amber-700" />
                      مثبت
                    </span>
                  )}
                </div>

                {/* Snippet Preview */}
                <p className="text-xs text-slate-600 font-medium line-clamp-3 leading-relaxed">
                  {ann.content}
                </p>

                {/* Sub Meta */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>الناشر: <strong className="text-slate-800">{ann.createdBy || 'الإدارة'}</strong></span>
                  </span>
                  <span className="text-slate-400 font-mono">{ann.createdDate}</span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAnn(ann)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-amber-400 rounded-lg text-xs font-black transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>استعراض الإعلان</span>
                </button>

                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmAnn(ann)}
                    className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="حذف الإعلان"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Announcement Detail Reader Modal (matching Booklet Reader Modal) */}
      {selectedAnn && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-[#1e293b] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-5 h-5 text-amber-400 shrink-0" />
                <h3 className="font-black text-sm text-white line-clamp-1">{selectedAnn.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnn(null)}
                className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub Meta */}
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600">
              <div className="flex items-center gap-2">
                <span>الناشر: <strong className="text-slate-900">{selectedAnn.createdBy || 'الإدارة'}</strong></span>
                {selectedAnn.isPinned && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-black">
                    إعلان مثبت 📌
                  </span>
                )}
              </div>
              <span className="text-slate-400 font-mono">تاريخ النشر: {selectedAnn.createdDate}</span>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              <FormattedAnnouncementContent content={selectedAnn.content} />
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedAnn;
                    setSelectedAnn(null);
                    setDeleteConfirmAnn(target);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف الإعلان</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedAnn(null)}
                className="px-5 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black rounded-lg cursor-pointer mr-auto"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmAnn && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-black text-sm text-slate-900">تأكيد حذف الإعلان</h3>
            <p className="text-xs text-slate-600 font-bold leading-relaxed">
              هل أنت تأكيد من رغبتك في حذف الإعلان "{deleteConfirmAnn.title}"؟ لا يمكن التراجع عن هذه الخطوة.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmAnn(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteConfirmAnn;
                  setDeleteConfirmAnn(null);
                  await handleDeleteAnnouncement(target.id, target.title);
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
