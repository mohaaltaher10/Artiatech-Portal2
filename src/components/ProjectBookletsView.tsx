import React, { useEffect, useState } from 'react';
import { db, formatDate, logActivity, generateReadableId } from '../lib/firebase';
import { sendAppNotification } from '../lib/notifications';
import { ref, onValue, set, update, remove } from 'firebase/database';
import { ProjectBooklet, BookletStatus, BookletType, UserProfile } from '../types';
import {
  BookOpen,
  PlusCircle,
  Save,
  Trash2,
  Calendar,
  Users,
  X,
  Search,
  Eye,
  Edit,
  CheckCircle2,
  Clock,
  Archive,
  Filter
} from 'lucide-react';

interface ProjectBookletsViewProps {
  currentUser: UserProfile;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

// Component to render formatted booklet text gracefully (supports both Markdown/Plain text and HTML)
const FormattedBookletContent: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return <p className="text-slate-400 italic text-xs">لا يوجد محتوى في هذا الكتيب بعد.</p>;

  // Check if content contains HTML tags (e.g., <main>, <h2>, <table>, <div>, etc.)
  const isHtml = /<[a-z][\s\S]*>/i.test(content.trim());

  if (isHtml) {
    return (
      <div
        className="booklet-html-content text-xs text-slate-800 leading-relaxed font-medium dir-rtl overflow-x-auto space-y-2 [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:border [&_th]:border-slate-300 [&_th]:p-2.5 [&_th]:bg-slate-100/90 [&_th]:text-[#0f172a] [&_th]:font-black [&_td]:border [&_td]:border-slate-200 [&_td]:p-2.5 [&_h1]:text-base [&_h1]:font-black [&_h1]:text-[#0f172a] [&_h2]:text-sm [&_h2]:font-black [&_h2]:text-[#0f172a] [&_h2]:border-b [&_h2]:border-slate-200 [&_h2]:pb-1 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-black [&_h3]:text-slate-900 [&_ul]:list-disc [&_ul]:pr-5 [&_ol]:list-decimal [&_ol]:pr-5 [&_li]:my-1 [&_p]:my-1.5 [&_div]:my-2"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let tableRows: string[] = [];
  let inTable = false;

  const flushTable = (keyIndex: number) => {
    if (tableRows.length === 0) return;
    const headerLine = tableRows[0];
    const dataLines = tableRows.slice(1).filter((l) => !l.includes('---'));
    const headers = headerLine.split('|').map((s) => s.trim()).filter(Boolean);

    renderedElements.push(
      <div key={`table-${keyIndex}`} className="overflow-x-auto my-3 border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-right">
          <thead className="bg-slate-100 text-[#0f172a] font-black border-b border-slate-200">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="p-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {dataLines.map((line, rowIndex) => {
              const cells = line.split('|').map((s) => s.trim()).filter(Boolean);
              return (
                <tr key={rowIndex} className="hover:bg-slate-50/80">
                  {cells.map((c, colIndex) => (
                    <td key={colIndex} className="p-2.5 text-slate-800">{c}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableRows.push(trimmed);
    } else {
      if (inTable) {
        flushTable(index);
      }
      if (!trimmed) {
        renderedElements.push(<div key={index} className="h-2" />);
      } else if (trimmed.startsWith('###') || trimmed.startsWith('■')) {
        const text = trimmed.replace(/^(###|■)\s*/, '');
        renderedElements.push(
          <h4 key={index} className="font-black text-sm text-[#0f172a] mt-4 mb-2 pb-1 border-b border-slate-200 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-amber-500 rounded-full inline-block shrink-0"></span>
            <span>{text}</span>
          </h4>
        );
      } else if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        const text = trimmed.replace(/^([•\-]|(\d+\.))\s*/, '');
        renderedElements.push(
          <li key={index} className="text-xs text-slate-700 leading-relaxed mr-4 list-disc font-medium my-1">
            {text}
          </li>
        );
      } else {
        renderedElements.push(
          <p key={index} className="text-xs text-slate-700 leading-relaxed font-medium my-1">
            {trimmed}
          </p>
        );
      }
    }
  });

  if (inTable) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{renderedElements}</div>;
};

export const ProjectBookletsView: React.FC<ProjectBookletsViewProps> = ({
  currentUser,
  showToast,
}) => {
  const [booklets, setBooklets] = useState<ProjectBooklet[]>([]);
  const [selectedBooklet, setSelectedBooklet] = useState<ProjectBooklet | null>(null);
  const [modalTab, setModalTab] = useState<'view' | 'edit'>('view');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookletStatus>('all');

  // Edit State for Selected Booklet
  const [bookletName, setBookletName] = useState('');
  const [bookletStatus, setBookletStatus] = useState<BookletStatus>('active');
  const [bookletType, setBookletType] = useState<BookletType>('non_extended');
  const [bookletContent, setBookletContent] = useState('');
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([]);
  const [deleteConfirmBooklet, setDeleteConfirmBooklet] = useState<{ id: string; name: string } | null>(null);

  // Add Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStatus, setNewStatus] = useState<BookletStatus>('active');
  const [newType, setNewType] = useState<BookletType>('non_extended');
  const [newContent, setNewContent] = useState('');
  const [newAssignedIds, setNewAssignedIds] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // 1. Fetch Booklets
    const unsubBooklets = onValue(ref(db, 'project_booklets'), (snapshot) => {
      const val = snapshot.val();
      const list: ProjectBooklet[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      setBooklets(list);
      setLoading(false);
    }, (err) => {
      console.warn('Project booklets listener notice:', err);
      setLoading(false);
    });

    // 2. Fetch Members List for assignment
    const unsubUsers = onValue(ref(db, 'users'), (snapshot) => {
      const val = snapshot.val();
      const list: UserProfile[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      setUsersList(list);
    }, (err) => console.warn('Users listener notice:', err));

    return () => {
      unsubBooklets();
      unsubUsers();
    };
  }, []);

  // Open Booklet Modal
  const handleOpenBooklet = (b: ProjectBooklet, mode: 'view' | 'edit' = 'view') => {
    setSelectedBooklet(b);
    setModalTab(mode === 'edit' && currentUser.role !== 'admin' ? 'view' : mode);
    setBookletName(b.name);
    setBookletStatus(b.status || 'active');
    setBookletType(b.type || 'non_extended');

    const defaultTemplate = `• اسم المشروع: ${b.name}
• الحالة: ${b.status === 'active' ? 'نشط' : b.status === 'under_study' ? 'قيد الدراسة' : 'مؤرشف'}
• النوع: ${b.type === 'extended' ? 'ممتد' : 'غير ممتد'}
• تاريخ البدء: ${b.startDate || new Date().toISOString().split('T')[0]}

■ نطاق العمل والأهداف:
اكتب تفاصيل نطاق العمل والمهام المطلوبة للمشروع هنا...

| ميزانية المشروع والبنود | التفاصيل | التكلفة التقديرية (د.ل) |
|---|---|---|
| بند 1 | إعداد وتصوير | 1,500 |
| بند 2 | مونتاج وتصميم | 1,000 |

■ الفريق المكلف والأسهم:
- الأعضاء المكلفين بالتنفيذ والمتابعة`;

    setBookletContent(b.content || defaultTemplate);
    const memberIds = b.teamMembers ? b.teamMembers.map((m) => m.userId) : [];
    setAssignedMemberIds(memberIds);
  };

  // Save Booklet Changes (Admin)
  const handleSaveBookletContent = async () => {
    if (!selectedBooklet) return;
    setSubmitting(true);

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const teamMembers = assignedMemberIds.map((id) => {
        const u = usersList.find((usr) => usr.id === id);
        return {
          userId: id,
          name: u ? u.name : id,
          shares: 1,
        };
      });

      await update(ref(db, `project_booklets/${selectedBooklet.id}`), {
        name: bookletName.trim(),
        status: bookletStatus,
        type: bookletType,
        content: bookletContent,
        teamMembers,
        lastModified: todayStr,
      });

      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'تعديل كتيب مشروع',
        `${currentUser.name} عدّل كتيب مشروع ${bookletName.trim()}`
      );

      // Update selectedBooklet state
      setSelectedBooklet({
        ...selectedBooklet,
        name: bookletName.trim(),
        status: bookletStatus,
        type: bookletType,
        content: bookletContent,
        teamMembers,
        lastModified: todayStr,
      });

      showToast('تم حفظ التغييرات بنجاح ✓', 'success');
      setModalTab('view');
    } catch (err) {
      showToast('حدث خطأ أثناء الحفظ. حاول مرة أخرى.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Create Booklet
  const handleCreateBooklet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) {
      showToast('يرجى إدخال اسم المشروع', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const initialContent = newContent || `• اسم المشروع: ${newName}
• الحالة: ${newStatus === 'active' ? 'نشط' : newStatus === 'under_study' ? 'قيد الدراسة' : 'مؤرشف'}
• النوع: ${newType === 'extended' ? 'ممتد' : 'غير ممتد'}
• تاريخ البدء: ${todayStr}

■ نطاق العمل:
تفاصيل نطاق العمل والمهام...

| جدول الميزانية والبنود | الوصف | المبلغ (د.ل) |
|---|---|---|
| بند 1 | إعداد وتجهيز | 1,000 |

■ الفريق المكلف:
- الأعضاء المكلفين`;

      const teamMembers = newAssignedIds.map((id) => {
        const u = usersList.find((usr) => usr.id === id);
        return {
          userId: id,
          name: u ? u.name : id,
          shares: 1,
        };
      });

      const newBookletId = generateReadableId('booklet', newName);
      await set(ref(db, `project_booklets/${newBookletId}`), {
        id: newBookletId,
        name: newName.trim(),
        status: newStatus,
        type: newType,
        content: initialContent,
        startDate: todayStr,
        teamMembers,
        createdBy: currentUser.name,
        lastModified: todayStr,
      });

      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'إضافة كتيب مشروع',
        `${currentUser.name} أنشأ كتيب مشروع جديد: ${newName.trim()}`
      );

      sendAppNotification(`📁 كتيب مشروع جديد: ${newName.trim()}`, {
        body: `تم إضافة كتيب مشروع جديد وإسناده للفريق المعني`,
        tag: `booklet-${newBookletId}`
      });

      showToast('تمت إضافة الكتيب بنجاح ✓', 'success');
      setShowAddForm(false);
      setNewName('');
      setNewContent('');
      setNewAssignedIds([]);
    } catch (err) {
      showToast('حدث خطأ. حاول مرة أخرى.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Booklet
  const handleDeleteBooklet = async (id: string, name: string) => {
    try {
      await remove(ref(db, `project_booklets/${id}`));
      if (selectedBooklet?.id === id) {
        setSelectedBooklet(null);
      }
      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'حذف كتيب مشروع',
        `${currentUser.name} حذف الكتيب: ${name}`
      );
      showToast('تم حذف الكتيب بنجاح ✓', 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء الحذف.', 'error');
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status: BookletStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-black">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            نشط
          </span>
        );
      case 'under_study':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-black">
            <Clock className="w-3 h-3 text-amber-600" />
            قيد الدراسة
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-black">
            <Archive className="w-3 h-3 text-rose-600" />
            مؤرشف
          </span>
        );
    }
  };

  const toggleMemberSelection = (userId: string, isNewForm: boolean = false) => {
    if (isNewForm) {
      setNewAssignedIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    } else {
      setAssignedMemberIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    }
  };

  // Filtered Booklets
  const filteredBooklets = booklets.filter((b) => {
    const matchesSearch = b.name?.includes(searchQuery) || b.content?.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="py-12 text-center text-slate-500 font-bold">جاري تحميل كتيبات المشاريع...</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-['Cairo',sans-serif]">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-800">
            <BookOpen className="w-5 h-5 text-slate-800" />
          </div>
          <div>
            <h2 className="text-base font-black text-[#0f172a]">كتيبات المشاريع</h2>
          </div>
        </div>

        {currentUser.role === 'admin' && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 font-black text-xs rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showAddForm ? 'إلغاء' : 'إضافة كتيب جديد'}</span>
          </button>
        )}
      </div>

      {/* Add Booklet Form Modal / Section */}
      {showAddForm && (
        <form onSubmit={handleCreateBooklet} className="bg-white border border-slate-200 p-5 rounded-xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-xs font-black text-[#0f172a]">إضافة كتيب مشروع جديد</h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم المشروع</label>
              <input
                type="text"
                required
                placeholder="اسم الكتيب / المشروع"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الحالة</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as BookletStatus)}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#1e293b] focus:outline-none"
              >
                <option value="active">نشط</option>
                <option value="under_study">قيد الدراسة</option>
                <option value="archived">مؤرشف</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نوع المشروع</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as BookletType)}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#1e293b] focus:outline-none"
              >
                <option value="non_extended">غير ممتد</option>
                <option value="extended">ممتد</option>
              </select>
            </div>
          </div>

          {/* Member Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">الأعضاء المكلفون بالكتيب:</label>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              {usersList.length === 0 ? (
                <span className="text-xs text-slate-400 font-bold">لا يوجد أعضاء في القائمة</span>
              ) : (
                usersList.map((usr) => {
                  const isChecked = newAssignedIds.includes(usr.id);
                  return (
                    <label
                      key={usr.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer border transition-colors ${
                        isChecked
                          ? 'bg-[#1e293b] text-amber-400 border-[#1e293b]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleMemberSelection(usr.id, true)}
                        className="hidden"
                      />
                      <span>{usr.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">نص وتفاصيل الكتيب:</label>
            <textarea
              rows={6}
              placeholder="اكتب التفاصيل هنا..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#1e293b] focus:outline-none font-medium leading-relaxed"
            />
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
              إنشاء الكتيب
            </button>
          </div>
        </form>
      )}

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="البحث في كتيبات المشاريع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:border-[#1e293b] focus:outline-none shadow-2xs"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-white p-1 border border-slate-200 rounded-lg text-xs font-bold self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-[#1e293b] text-amber-400'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            الكل ({booklets.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'active'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            النشطة
          </button>
          <button
            onClick={() => setStatusFilter('under_study')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'under_study'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            قيد الدراسة
          </button>
          <button
            onClick={() => setStatusFilter('archived')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'archived'
                ? 'bg-rose-700 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            المؤرشفة
          </button>
        </div>
      </div>

      {/* Booklets Grid */}
      {filteredBooklets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs font-bold">
          لا توجد كتيبات مشاريع مطابقة
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBooklets.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-black text-[#0f172a] text-sm leading-snug">{b.name}</h3>
                  {renderStatusBadge(b.status || 'active')}
                </div>

                {/* Sub Meta */}
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] text-slate-700">
                    {b.type === 'extended' ? 'مشروع ممتد' : 'غير ممتد'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    بدء: {formatDate(b.startDate)}
                  </span>
                </div>

                {/* Team Members Count */}
                {b.teamMembers && b.teamMembers.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-bold bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>
                      المكلفون: {b.teamMembers.map((m) => m.name).join('، ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenBooklet(b, 'view')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                  <span>استعراض الكتيب</span>
                </button>

                <div className="flex items-center gap-1">
                  {currentUser.role === 'admin' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenBooklet(b, 'edit')}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="تعديل الكتيب"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmBooklet({ id: b.id, name: b.name })}
                        className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف الكتيب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booklet View/Edit Modal */}
      {selectedBooklet && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-[#1e293b] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg">
                  <BookOpen className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">{selectedBooklet.name}</h3>
                  <p className="text-[11px] text-slate-300 font-bold">كتيب مشروع رسمي</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBooklet(null)}
                className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub Bar */}
            <div className="bg-slate-100 px-5 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                <BookOpen className="w-4 h-4 text-slate-600" />
                <span>{modalTab === 'edit' ? 'تعديل بيانات الكتيب (أدمن)' : 'قراءة محتوى الكتيب'}</span>
              </div>

              {/* Status Indicator */}
              <div>{renderStatusBadge(bookletStatus)}</div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {modalTab === 'view' ? (
                /* CLEAN VIEW MODE */
                <div className="space-y-5">
                  {/* Metadata Header Box */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-bold text-slate-700">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold mb-0.5">نوع المشروع</span>
                      <span className="text-slate-900">{bookletType === 'extended' ? 'ممتد / مستمر' : 'محدد / غير ممتد'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold mb-0.5">تاريخ البدء</span>
                      <span className="text-slate-900">{formatDate(selectedBooklet.startDate)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold mb-0.5">آخر تحديث</span>
                      <span className="text-slate-900">{formatDate(selectedBooklet.lastModified)}</span>
                    </div>
                  </div>

                  {/* Team Members */}
                  {selectedBooklet.teamMembers && selectedBooklet.teamMembers.length > 0 && (
                    <div className="bg-amber-50/50 border border-amber-200 p-3.5 rounded-xl space-y-1.5">
                      <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-amber-700" />
                        <span>الأعضاء المكلفون بهذا المشروع:</span>
                      </h4>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {selectedBooklet.teamMembers.map((m) => (
                          <span
                            key={m.userId}
                            className="px-2.5 py-1 bg-white text-slate-800 border border-amber-300 rounded-lg text-xs font-bold"
                          >
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Formatted Book Content */}
                  <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-2xs space-y-2">
                    <FormattedBookletContent content={bookletContent} />
                  </div>
                </div>
              ) : (
                /* EDIT FORM MODE (Admin) */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">اسم الكتيب</label>
                      <input
                        type="text"
                        value={bookletName}
                        onChange={(e) => setBookletName(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold focus:bg-white focus:border-[#1e293b]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الحالة</label>
                      <select
                        value={bookletStatus}
                        onChange={(e) => setBookletStatus(e.target.value as BookletStatus)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold focus:bg-white focus:border-[#1e293b]"
                      >
                        <option value="active">نشط</option>
                        <option value="under_study">قيد الدراسة</option>
                        <option value="archived">مؤرشف</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">النوع</label>
                      <select
                        value={bookletType}
                        onChange={(e) => setBookletType(e.target.value as BookletType)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold focus:bg-white focus:border-[#1e293b]"
                      >
                        <option value="non_extended">غير ممتد</option>
                        <option value="extended">ممتد</option>
                      </select>
                    </div>
                  </div>

                  {/* Team Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">تحديث المكلفين بالكتيب:</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      {usersList.map((usr) => {
                        const isChecked = assignedMemberIds.includes(usr.id);
                        return (
                          <label
                            key={usr.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer border transition-colors ${
                              isChecked
                                ? 'bg-[#1e293b] text-amber-400 border-[#1e293b]'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleMemberSelection(usr.id, false)}
                              className="hidden"
                            />
                            <span>{usr.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Textarea */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نص وتفاصيل الكتيب الكاملة:</label>
                    <textarea
                      rows={12}
                      value={bookletContent}
                      onChange={(e) => setBookletContent(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs leading-relaxed font-medium focus:bg-white focus:border-[#1e293b]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedBooklet(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg cursor-pointer"
              >
                إغلاق
              </button>

              {modalTab === 'edit' && currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={handleSaveBookletContent}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmBooklet && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-black text-sm text-slate-900">تأكيد حذف الكتيب</h3>
            <p className="text-xs text-slate-600 font-bold leading-relaxed">
              هل أنت تأكيد من رغبتك في حذف الكتيب "{deleteConfirmBooklet.name}"؟ لا يمكن التراجع عن هذه الخطوة.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmBooklet(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteConfirmBooklet;
                  setDeleteConfirmBooklet(null);
                  await handleDeleteBooklet(target.id, target.name);
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
