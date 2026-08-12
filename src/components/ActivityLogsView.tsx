import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';
import { ActivityLog, UserProfile } from '../types';
import { History, Filter, Search, ChevronRight, ChevronLeft } from 'lucide-react';

interface ActivityLogsViewProps {
  currentUser: UserProfile;
}

export const ActivityLogsView: React.FC<ActivityLogsViewProps> = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  useEffect(() => {
    const logsRef = ref(db, 'activity_logs');
    const unsub = onValue(logsRef, (snapshot) => {
      const val = snapshot.val();
      const list: ActivityLog[] = [];
      if (val) {
        Object.keys(val).forEach((k) => {
          list.push({ id: k, ...val[k] });
        });
      }
      list.sort((a, b) => {
        const tA = typeof a.createdAt === 'number' ? a.createdAt : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const tB = typeof b.createdAt === 'number' ? b.createdAt : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return tB - tA;
      });
      setLogs(list);
      setLoading(false);
    }, (err) => {
      console.warn('Activity logs listener error notice:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Get unique members and actions for filters
  const uniqueUsers = Array.from(new Set(logs.map((l) => l.userName).filter(Boolean)));
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action).filter(Boolean)));

  const filteredLogs = logs.filter((log) => {
    if (selectedUser !== 'all' && log.userName !== selectedUser) return false;
    if (selectedAction !== 'all' && log.action !== selectedAction) return false;
    if (
      searchQuery &&
      !log.details?.includes(searchQuery) &&
      !log.userName?.includes(searchQuery)
    ) {
      return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return <div className="py-12 text-center text-slate-500 font-bold">جاري تحميل سجل النشاطات...</div>;
  }

  return (
    <div className="space-y-6 font-['Cairo',sans-serif]">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
        <div>
          <h2 className="text-base font-black text-[#0f172a] flex items-center gap-2">
            <History className="w-5 h-5 text-[#1e293b]" />
            سجل النشاطات والعمليات
          </h2>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-black text-[#0f172a] uppercase tracking-wider flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> الفلاتر:
          </span>

          <select
            value={selectedUser}
            onChange={(e) => {
              setSelectedUser(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-800 focus:outline-none focus:border-[#1e293b]"
          >
            <option value="all">كل الأعضاء</option>
            {uniqueUsers.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-800 focus:outline-none focus:border-[#1e293b]"
          >
            <option value="all">كل الإجراءات</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث بالوصف أو اسم العضو..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none font-bold"
          />
        </div>
      </div>

      {/* Logs Table */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-xs font-bold">
          لا توجد بيانات بعد
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto space-y-3 p-1">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase tracking-wider">
                <th className="p-3">التاريخ والوقت</th>
                <th className="p-3">العضو</th>
                <th className="p-3">الدور</th>
                <th className="p-3">نوع الحدث</th>
                <th className="p-3">التفاصيل الكاملة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono font-bold text-slate-500 whitespace-nowrap dir-ltr text-right">
                    {log.timestamp}
                  </td>
                  <td className="p-3 font-black text-[#0f172a] whitespace-nowrap">{log.userName}</td>
                  <td className="p-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider ${
                        log.userRole === 'admin'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {log.userRole === 'admin' ? 'أدمن' : 'عضو'}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-slate-700 whitespace-nowrap">{log.action}</td>
                  <td className="p-3 text-slate-800 leading-relaxed font-semibold">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-slate-200 text-xs font-bold text-slate-600">
              <span>
                صفحة {currentPage} من {totalPages} (إجمالي {filteredLogs.length} سجل)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-40"
                  title="الصفحة السابقة"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-40"
                  title="الصفحة التالية"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
