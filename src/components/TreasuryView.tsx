import React, { useEffect, useState } from 'react';
import { db, formatCurrency, formatDate, logActivity, generateReadableId } from '../lib/firebase';
import {
  ref,
  onValue,
  push,
  set,
  update,
  remove,
  runTransaction
} from 'firebase/database';
import {
  TreasuryLocation,
  TreasuryTransaction,
  AssetItem,
  UserProfile,
  TransactionType
} from '../types';
import {
  Wallet,
  Building,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Filter,
  Trash2,
  Edit2,
  PackageCheck,
  X,
  Printer,
  ExternalLink,
  Calendar,
  Paperclip,
  FileText,
  Image,
  ChevronRight,
  ChevronLeft,
  Copy
} from 'lucide-react';

interface TreasuryViewProps {
  currentUser: UserProfile;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const TreasuryView: React.FC<TreasuryViewProps> = ({ currentUser, showToast }) => {
  const [locations, setLocations] = useState<TreasuryLocation[]>([]);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Inline Form Visibility states
  const [activeForm, setActiveForm] = useState<'location' | 'income' | 'expense' | 'transfer' | 'asset' | null>(null);

  // Form states: New Storage Location
  const [locName, setLocName] = useState('');
  const [locDesc, setLocDesc] = useState('');
  const [locBalance, setLocBalance] = useState<number>(0);
  const [locCurrency, setLocCurrency] = useState('د.ل');
  const [locResponsible, setLocResponsible] = useState('');

  // Form states: Transaction (Income / Expense / Transfer)
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txLocationId, setTxLocationId] = useState('');
  const [txToLocationId, setTxToLocationId] = useState('');
  const [txCategory, setTxCategory] = useState('عام');
  const [txRecipient, setTxRecipient] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txSources, setTxSources] = useState(''); // Links separated by newline or comma

  // Form states: Asset
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState('معدات وأجهزة');
  const [assetLocation, setAssetLocation] = useState('');
  const [assetValue, setAssetValue] = useState('مجاني');
  const [assetNotes, setAssetNotes] = useState('');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Modal Dialog States
  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState<{ id: string; name: string } | null>(null);
  const [addSourceTxId, setAddSourceTxId] = useState<string | null>(null);
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState<boolean>(true);
  const [copiedReportText, setCopiedReportText] = useState(false);

  // Pagination States
  const [txsPage, setTxsPage] = useState(1);
  const txsPerPage = 8;

  const [assetsPage, setAssetsPage] = useState(1);
  const assetsPerPage = 10;

  const handleOpenAddSourceModal = (txId: string) => {
    setAddSourceTxId(txId);
    setNewSourceUrl('');
  };

  const handleSaveSourceForTx = async () => {
    if (!addSourceTxId || !newSourceUrl.trim()) return;
    const targetTx = transactions.find((t) => t.id === addSourceTxId);
    if (!targetTx) return;

    const currentSources = targetTx.sources || [];
    const updatedSources = [...currentSources, newSourceUrl.trim()];

    try {
      await update(ref(db, `treasury_transactions/${addSourceTxId}`), {
        sources: updatedSources,
      });
      showToast('تم إضافة المصدر بنجاح ✓', 'success');
      setAddSourceTxId(null);
      setNewSourceUrl('');
    } catch (err) {
      showToast('حدث خطأ أثناء إضافة المصدر', 'error');
    }
  };

  const getSourceBadge = (url: string, index: number) => {
    const fullUrl = url.startsWith('http') || url.startsWith('data:') ? url : `https://${url}`;
    const lower = fullUrl.toLowerCase();
    const isImage = 
      lower.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)($|\?|\/)/) ||
      lower.includes('imgur') ||
      lower.includes('googleusercontent') ||
      lower.includes('img/') ||
      lower.includes('image') ||
      lower.includes('photo') ||
      lower.includes('pic') ||
      lower.startsWith('data:image');
    const isDrive = lower.includes('drive.google.com') || lower.includes('docs.google.com');
    const isPdf = lower.includes('.pdf');

    let label = `مستند ${index + 1}`;
    let icon = <FileText className="w-3 h-3 text-slate-600" />;
    let badgeStyle = "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300";

    if (isImage) {
      label = `صورة ${index + 1}`;
      icon = <Image className="w-3 h-3 text-emerald-700" />;
      badgeStyle = "bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300 cursor-pointer";
      return (
        <button
          type="button"
          key={index}
          onClick={() => {
            setImgLoading(true);
            setPreviewImageUrl(fullUrl);
          }}
          className={`inline-flex items-center gap-1 px-2 py-0.5 font-bold text-[10px] rounded border transition-colors ${badgeStyle}`}
          title="معاينة الصورة في النافذة المنبثقة"
        >
          {icon}
          <span>{label}</span>
        </button>
      );
    } else if (isDrive) {
      label = `مستند درايف ${index + 1}`;
      icon = <FileText className="w-3 h-3 text-blue-700" />;
      badgeStyle = "bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-300";
    } else if (isPdf) {
      label = `ملف PDF ${index + 1}`;
      icon = <FileText className="w-3 h-3 text-rose-700" />;
      badgeStyle = "bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-300";
    }

    return (
      <a
        key={index}
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 px-2 py-0.5 font-bold text-[10px] rounded border transition-colors ${badgeStyle}`}
        title="فتح المستند في رابط خارجي"
      >
        {icon}
        <span>{label}</span>
        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
      </a>
    );
  };

  useEffect(() => {
    // 1. Listen to Treasury Locations
    const unsubLocs = onValue(ref(db, 'treasury_locations'), (snapshot) => {
      const val = snapshot.val();
      const list: TreasuryLocation[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      setLocations(list);
    }, (err) => console.warn('Treasury locations listener notice:', err));

    // 2. Listen to Transactions
    const unsubTxs = onValue(ref(db, 'treasury_transactions'), (snapshot) => {
      const val = snapshot.val();
      const list: TreasuryTransaction[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setTransactions(list);
    }, (err) => console.warn('Transactions listener notice:', err));

    // 3. Listen to Assets
    const unsubAssets = onValue(ref(db, 'assets'), (snapshot) => {
      const val = snapshot.val();
      const list: AssetItem[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
      setAssets(list);
      setLoading(false);
    }, (err) => {
      console.warn('Assets listener notice:', err);
      setLoading(false);
    });

    return () => {
      unsubLocs();
      unsubTxs();
      unsubAssets();
    };
  }, []);

  // Stats Calculations
  const totalTreasuryBalance = locations.reduce((sum, l) => sum + (l.balance || 0), 0);

  // Monthly stats
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthlyIncome = transactions
    .filter((t) => t.type === 'income' && t.date.startsWith(currentMonthPrefix))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const monthlyExpense = transactions
    .filter((t) => t.type === 'expense' && t.date.startsWith(currentMonthPrefix))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const assetCount = assets.length;

  // Date Period Helper
  const isDateInPeriod = (dateStr: string) => {
    if (!dateStr) return false;
    const cleanStr = dateStr.includes(' ') ? dateStr.split(' ')[0] : dateStr;
    const txDate = new Date(cleanStr + 'T00:00:00');
    if (isNaN(txDate.getTime())) return true;

    const todayDate = new Date();
    const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
    
    if (filterPeriod === 'today') {
      return cleanStr === todayStr;
    }

    if (filterPeriod === 'yesterday') {
      const yDay = new Date(todayDate);
      yDay.setDate(yDay.getDate() - 1);
      const yStr = `${yDay.getFullYear()}-${String(yDay.getMonth() + 1).padStart(2, '0')}-${String(yDay.getDate()).padStart(2, '0')}`;
      return cleanStr === yStr;
    }

    if (filterPeriod === 'this_week') {
      const startOfWeek = new Date(todayDate);
      const dayOfWeek = todayDate.getDay();
      const diff = todayDate.getDate() - dayOfWeek + (dayOfWeek === 6 ? 0 : -1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      return txDate >= startOfWeek;
    }

    if (filterPeriod === 'this_month') {
      return cleanStr.startsWith(currentMonthPrefix);
    }

    if (filterPeriod === 'custom') {
      if (startDate && cleanStr < startDate) return false;
      if (endDate && cleanStr > endDate) return false;
      return true;
    }

    return true; // 'all'
  };

  // Filtered transactions
  const filteredTxs = transactions.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (!isDateInPeriod(t.date)) return false;
    if (
      searchQuery &&
      !t.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.createdBy?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.recipient?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.category?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // Group filtered transactions by Day (YYYY-MM-DD)
  const groupedTransactions = filteredTxs.reduce<Record<string, TreasuryTransaction[]>>((groups, tx) => {
    const dateKey = tx.date ? tx.date.split(' ')[0] : 'غير مؤرخ';
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(tx);
    return groups;
  }, {});

  const sortedDateKeys = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  // Period stats for reports
  const periodTotalIncome = filteredTxs.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const periodTotalExpense = filteredTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const periodNetBalance = periodTotalIncome - periodTotalExpense;

  // Print Report Generator
  const handlePrintReport = () => {
    try {
      const printWin = window.open('', '_blank', 'width=1000,height=800');
      if (printWin) {
        const rowsHtml = filteredTxs.map(tx => `
          <tr>
            <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: bold;">${tx.date || '-'}</td>
            <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: bold; color: ${tx.type === 'income' ? '#047857' : tx.type === 'expense' ? '#be123c' : '#1d4ed8'};">
              ${tx.type === 'income' ? 'إيراد' : tx.type === 'expense' ? 'مصروف' : 'تحويل'}
            </td>
            <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: bold;">${formatCurrency(tx.amount || 0)}</td>
            <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${tx.locationName || '-'}</td>
            <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${tx.recipient ? tx.recipient + ' - ' : ''}${tx.description || '-'}</td>
          </tr>
        `).join('');

        const html = `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8">
            <title>تقرير الخزينة والعمليات المالية - أرتياتك</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #0f172a; direction: rtl; }
              .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
              .header h1 { margin: 0; font-size: 24px; color: #0f172a; }
              .header p { margin: 6px 0 0 0; font-size: 13px; color: #475569; font-weight: bold; }
              .stats { display: flex; gap: 16px; margin-bottom: 24px; text-align: center; }
              .stat-card { flex: 1; padding: 14px; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc; }
              .stat-title { font-size: 11px; color: #64748b; font-weight: bold; display: block; }
              .stat-val { font-size: 18px; font-weight: bold; margin-top: 4px; display: block; }
              .income { color: #047857; }
              .expense { color: #be123c; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: right; }
              th { background-color: #1e293b; color: white; padding: 10px; border: 1px solid #1e293b; }
              @media print {
                body { padding: 0; }
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>استوديو أرتياتك - تقرير الخزينة والعمليات المالية</h1>
              <p>تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-LY')} | عدد العمليات المدرجة: ${filteredTxs.length}</p>
            </div>

            <div class="stats">
              <div class="stat-card">
                <span class="stat-title">إجمالي الإيرادات</span>
                <span class="stat-val income">${formatCurrency(periodTotalIncome)}</span>
              </div>
              <div class="stat-card">
                <span class="stat-title">إجمالي المصروفات</span>
                <span class="stat-val expense">${formatCurrency(periodTotalExpense)}</span>
              </div>
              <div class="stat-card">
                <span class="stat-title">صافي التدفق المالي</span>
                <span class="stat-val ${periodNetBalance >= 0 ? 'income' : 'expense'}">${formatCurrency(periodNetBalance)}</span>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>المبلغ</th>
                  <th>الخزانة</th>
                  <th>الجهة / البيان</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div style="margin-top: 30px; text-align: center;" class="no-print">
              <button onclick="window.print()" style="padding: 12px 28px; background: #1e293b; color: #fbbf24; border: none; border-radius: 8px; font-weight: bold; font-size: 14px; cursor: pointer;">
                🖨️ اضغط هنا للطباعة أو الحفظ كـ PDF
              </button>
            </div>

            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 400);
              };
            </script>
          </body>
          </html>
        `;

        printWin.document.write(html);
        printWin.document.close();
      } else {
        window.print();
      }
    } catch (err) {
      window.print();
    }
  };

  // Handlers
  const resetForms = () => {
    setActiveForm(null);
    setLocName('');
    setLocDesc('');
    setLocBalance(0);
    setLocCurrency('د.ل');
    setLocResponsible('');

    setTxAmount(0);
    setTxLocationId('');
    setTxToLocationId('');
    setTxCategory('عام');
    setTxRecipient('');
    setTxDescription('');
    setTxSources('');

    setAssetName('');
    setAssetCategory('معدات وأجهزة');
    setAssetLocation('');
    setAssetValue('مجاني');
    setAssetNotes('');
    setEditingAssetId(null);
  };

  // 1. Add Location
  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName) {
      showToast('يرجى إدخال اسم المكان', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const newLocId = generateReadableId('loc', locName);
      await set(ref(db, `treasury_locations/${newLocId}`), {
        id: newLocId,
        name: locName.trim(),
        description: locDesc.trim(),
        balance: Number(locBalance) || 0,
        currency: locCurrency,
        responsibleBy: locResponsible.trim() || currentUser.name
      });

      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'إضافة مكان تخزين',
        `${currentUser.name} أضاف مكان تخزين جديد: ${locName.trim()} برصيد ابتدائي ${locBalance} ${locCurrency}`
      );

      showToast('تمت إضافة مكان التخزين بنجاح ✓', 'success');
      resetForms();
    } catch (err: any) {
      showToast('حدث خطأ. حاول مرة أخرى.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Add Transaction (Income / Expense / Transfer)
  const handleAddTransaction = async (e: React.FormEvent, type: TransactionType) => {
    e.preventDefault();
    if (!txAmount || txAmount <= 0) {
      showToast('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }
    if (!txLocationId) {
      showToast('يرجى اختيار مكان التخزين المالي', 'error');
      return;
    }
    if (type === 'transfer' && !txToLocationId) {
      showToast('يرجى اختيار المكان المحول إليه', 'error');
      return;
    }
    if (type === 'transfer' && txLocationId === txToLocationId) {
      showToast('لا يمكن التحويل إلى نفس المكان', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const sourceLoc = locations.find((l) => l.id === txLocationId);
      const destLoc = locations.find((l) => l.id === txToLocationId);

      if (type === 'income') {
        const sourceRef = ref(db, `treasury_locations/${txLocationId}`);
        await runTransaction(sourceRef, (currentLoc) => {
          if (currentLoc) {
            currentLoc.balance = (currentLoc.balance || 0) + Number(txAmount);
          }
          return currentLoc;
        });
      } else if (type === 'expense') {
        const sourceRef = ref(db, `treasury_locations/${txLocationId}`);
        await runTransaction(sourceRef, (currentLoc) => {
          if (currentLoc) {
            currentLoc.balance = (currentLoc.balance || 0) - Number(txAmount);
          }
          return currentLoc;
        });
      } else if (type === 'transfer') {
        const sourceRef = ref(db, `treasury_locations/${txLocationId}`);
        const destRef = ref(db, `treasury_locations/${txToLocationId}`);

        await runTransaction(sourceRef, (currentLoc) => {
          if (currentLoc) {
            currentLoc.balance = (currentLoc.balance || 0) - Number(txAmount);
          }
          return currentLoc;
        });
        await runTransaction(destRef, (currentLoc) => {
          if (currentLoc) {
            currentLoc.balance = (currentLoc.balance || 0) + Number(txAmount);
          }
          return currentLoc;
        });
      }

      // Parse Sources links
      const parsedSources = txSources
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // Save Transaction Record
      const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const newTxId = generateReadableId('tx', txDescription);
      await set(ref(db, `treasury_transactions/${newTxId}`), {
        id: newTxId,
        date: dateStr,
        amount: Number(txAmount),
        type,
        locationId: txLocationId,
        locationName: sourceLoc?.name || '',
        toLocationId: type === 'transfer' ? txToLocationId : null,
        toLocationName: type === 'transfer' ? destLoc?.name || '' : null,
        category: txCategory,
        recipient: txRecipient.trim(),
        description: txDescription.trim(),
        sources: parsedSources,
        createdBy: currentUser.name
      });

      // Phrased Natural Arabic Activity Log
      let logMsg = '';
      if (type === 'income') {
        logMsg = `${currentUser.name} أضاف إيراداً بقيمة ${txAmount} د.ل إلى ${sourceLoc?.name} - ${txDescription}`;
      } else if (type === 'expense') {
        logMsg = `${currentUser.name} سجل مصروفا بقيمة ${txAmount} د.ل من ${sourceLoc?.name} - ${txDescription}`;
      } else {
        logMsg = `${currentUser.name} قام بتحويل مبلغ ${txAmount} د.ل من ${sourceLoc?.name} إلى ${destLoc?.name}`;
      }

      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        `عملية مالية (${type})`,
        logMsg
      );

      showToast('تم حفظ العملية المالية وتحديث الأرصدة بنجاح ✓', 'success');
      resetForms();
    } catch (err: any) {
      console.error('Transaction error:', err);
      showToast(err.message || 'حدث خطأ أثناء تنفيذ العملية. حاول مرة أخرى.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Add or Edit Asset
  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName) {
      showToast('يرجى إدخال اسم الأصل', 'error');
      return;
    }
    setSubmitting(true);

    try {
      if (editingAssetId) {
        await update(ref(db, `assets/${editingAssetId}`), {
          name: assetName.trim(),
          category: assetCategory,
          location: assetLocation.trim(),
          purchaseValue: assetValue.trim(),
          notes: assetNotes.trim()
        });

        await logActivity(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          'تعديل أصل',
          `${currentUser.name} عدّل بيانات الأصل: ${assetName.trim()}`
        );

        showToast('تم تعديل بيانات الأصل بنجاح ✓', 'success');
      } else {
        const newAssetId = generateReadableId('asset', assetName);
        await set(ref(db, `assets/${newAssetId}`), {
          id: newAssetId,
          name: assetName.trim(),
          category: assetCategory,
          location: assetLocation.trim() || 'المقر الرئيسي',
          acquisitionDate: new Date().toISOString().split('T')[0],
          purchaseValue: assetValue.trim() || 'مجاني',
          notes: assetNotes.trim()
        });

        await logActivity(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          'إضافة أصل',
          `${currentUser.name} أضاف أصلاً جديداً: ${assetName.trim()} (${assetLocation})`
        );

        showToast('تمت إضافة الأصل بنجاح ✓', 'success');
      }
      resetForms();
    } catch (err: any) {
      showToast('حدث خطأ. حاول مرة أخرى.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Asset
  const handleDeleteAsset = (id: string, name: string) => {
    setDeleteConfirmAsset({ id, name });
  };

  const confirmDeleteAsset = async () => {
    if (!deleteConfirmAsset) return;
    const { id, name } = deleteConfirmAsset;
    try {
      await remove(ref(db, `assets/${id}`));
      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'حذف أصل',
        `${currentUser.name} حذف الأصل: ${name}`
      );
      showToast('تم حذف الأصل بنجاح ✓', 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء الحذف.', 'error');
    } finally {
      setDeleteConfirmAsset(null);
    }
  };

  const handlePrintPDF = () => {
    setShowReportModal(true);
    try {
      window.print();
    } catch (e) {
      console.log('Print dialog triggered');
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-500 font-bold">جاري تحميل بيانات الخزينة...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Print CSS for Clean PDF Export */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; font-size: 11pt; }
          .no-print, header, nav, button, input, select { display: none !important; }
          .print-only { display: block !important; }
          .print-container { width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {/* Top Header & Quick Action Buttons Bar */}
      <div className="bg-[#1e293b] text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-amber-400" />
            الخزينة والميزانية والأصول
          </h1>
        </div>

        {currentUser.role === 'admin' && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveForm(activeForm === 'income' ? null : 'income')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>إضافة إيراد</span>
            </button>

            <button
              onClick={() => setActiveForm(activeForm === 'expense' ? null : 'expense')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>إضافة مصروف</span>
            </button>

            <button
              onClick={() => setActiveForm(activeForm === 'transfer' ? null : 'transfer')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>إضافة تحويل</span>
            </button>

            <button
              onClick={() => setActiveForm(activeForm === 'location' ? null : 'location')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة خزانة</span>
            </button>
          </div>
        )}
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Total Treasury */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">إجمالي رصيد الخزينة</span>
          <div className="text-2xl font-black text-[#1e293b] dir-ltr text-right">
            {formatCurrency(totalTreasuryBalance)}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-bold">
            في {locations.length} حسابات/خزائن
          </p>
        </div>

        {/* Assets Count */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">إجمالي الأصول</span>
          <div className="text-2xl font-black text-[#1e293b]">
            {assetCount} <span className="text-xs font-bold text-slate-500">أصل/معدة</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-bold">موجودة في المقار والاستوديو</p>
        </div>

        {/* Monthly Income */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">إيرادات هذا الشهر</span>
          <div className="text-2xl font-black text-emerald-800 dir-ltr text-right">
            {formatCurrency(monthlyIncome)}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-bold">إجمالي المقبوضات</p>
        </div>

        {/* Monthly Expense */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block mb-1">مصاريف هذا الشهر</span>
          <div className="text-2xl font-black text-rose-800 dir-ltr text-right">
            {formatCurrency(monthlyExpense)}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-bold">إجمالي المصروفات</p>
        </div>
      </div>

      {/* SECTION 1: الخزائن */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-black text-[#0f172a] flex items-center gap-2">
              <Building className="w-4 h-4 text-[#1e293b]" />
              الخزائن
            </h2>
          </div>

          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveForm(activeForm === 'location' ? null : 'location')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-amber-400 font-bold text-xs uppercase tracking-wider rounded border border-[#1e293b] transition-colors self-start sm:self-auto"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{activeForm === 'location' ? 'إلغاء' : 'إضافة مكان جديد'}</span>
            </button>
          )}
        </div>

        {/* Inline Form: Add Storage Location */}
        {activeForm === 'location' && (
          <form onSubmit={handleAddLocation} className="bg-slate-50 border border-slate-300 p-4 rounded-md space-y-3">
            <h3 className="text-xs font-black text-[#0f172a] uppercase tracking-wider">إضافة حساب/خزينة جديدة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المكان</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: الخزينة الرئيسية / حساب البنك"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الرصيد الابتدائي</label>
                <input
                  type="number"
                  step="any"
                  value={locBalance}
                  onChange={(e) => setLocBalance(Number(e.target.value))}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">العملة</label>
                <select
                  value={locCurrency}
                  onChange={(e) => setLocCurrency(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                >
                  <option value="د.ل">دينار ليبي (د.ل)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                  <option value="EUR">يورو (EUR)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">المسؤول عنه</label>
                <input
                  type="text"
                  placeholder="اسم المسؤول"
                  value={locResponsible}
                  onChange={(e) => setLocResponsible(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الوصف</label>
              <input
                type="text"
                placeholder="توضيح مختصر لمكان التخزين"
                value={locDesc}
                onChange={(e) => setLocDesc(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForms}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black rounded disabled:opacity-50"
              >
                حفظ المكان
              </button>
            </div>
          </form>
        )}

        {/* Location Cards */}
        {locations.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 font-medium">لا توجد بيانات بعد</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {locations.map((loc) => (
              <div key={loc.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[#0f172a] text-sm">{loc.name}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-800 font-bold rounded">
                    {loc.currency || 'د.ل'}
                  </span>
                </div>
                <div className="text-lg font-black text-[#1e293b] dir-ltr text-right">
                  {formatCurrency(loc.balance || 0, loc.currency)}
                </div>
                {loc.description && <p className="text-[11px] text-slate-600 font-medium">{loc.description}</p>}
                <div className="text-[10px] text-slate-500 font-bold pt-1 border-t border-slate-200">
                  المسؤول: <span className="font-bold text-slate-800">{loc.responsibleBy || 'غير محدد'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: سجل الأصول (Assets) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-black text-[#0f172a] flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-[#1e293b]" />
              سجل الأصول
            </h2>
          </div>

          {currentUser.role === 'admin' && (
            <button
              onClick={() => {
                resetForms();
                setActiveForm(activeForm === 'asset' ? null : 'asset');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-amber-400 font-bold text-xs uppercase tracking-wider rounded border border-[#1e293b] transition-colors self-start sm:self-auto"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{activeForm === 'asset' ? 'إلغاء' : 'إضافة أصل جديد'}</span>
            </button>
          )}
        </div>

        {/* Inline Form: Add/Edit Asset */}
        {activeForm === 'asset' && (
          <form onSubmit={handleSaveAsset} className="bg-slate-50 border border-slate-300 p-4 rounded-md space-y-3">
            <h3 className="text-xs font-black text-[#0f172a] uppercase tracking-wider">
              {editingAssetId ? 'تعديل بيانات الأصل' : 'إضافة أصل جديد'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الأصل</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: كاميرا Sony FX3 / مايك بوي"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">مكان التخزين الحالي</label>
                <input
                  type="text"
                  placeholder="المقر الرئيسي / مع فلان"
                  value={assetLocation}
                  onChange={(e) => setAssetLocation(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">قيمة الشراء / طريقة الاقتناء</label>
                <input
                  type="text"
                  placeholder="1,200 د.ل أو مجاني أو مساهمة"
                  value={assetValue}
                  onChange={(e) => setAssetValue(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الفئة</label>
                <input
                  type="text"
                  value={assetCategory}
                  onChange={(e) => setAssetCategory(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات إضافية (خاصة)</label>
              <input
                type="text"
                placeholder="الحالة الفنية، الضمان، أي تفاصيل"
                value={assetNotes}
                onChange={(e) => setAssetNotes(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForms}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black rounded disabled:opacity-50"
              >
                حفظ الأصل
              </button>
            </div>
          </form>
        )}

        {/* Assets Table */}
        {assets.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 font-medium">لا توجد بيانات بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 font-black uppercase tracking-wider">
                  <th className="p-2.5">الاسم</th>
                  <th className="p-2.5">الفئة</th>
                  <th className="p-2.5">مكان التخزين الحالي</th>
                  <th className="p-2.5">قيمة الشراء / المساهمة</th>
                  <th className="p-2.5">تاريخ الاقتناء</th>
                  <th className="p-2.5">الملاحظات</th>
                  {currentUser.role === 'admin' && <th className="p-2.5 text-center">إجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-black text-[#0f172a]">{asset.name}</td>
                    <td className="p-2.5 text-slate-600 font-medium">{asset.category || 'عام'}</td>
                    <td className="p-2.5 font-bold text-slate-800">{asset.location}</td>
                    <td className="p-2.5 font-black text-[#1e293b]">{asset.purchaseValue || 'مجاني'}</td>
                    <td className="p-2.5 text-slate-500 font-bold">{formatDate(asset.acquisitionDate)}</td>
                    <td className="p-2.5 text-slate-600 font-medium max-w-xs break-words">{asset.notes || '-'}</td>
                    {currentUser.role === 'admin' && (
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditingAssetId(asset.id);
                              setAssetName(asset.name);
                              setAssetCategory(asset.category || 'عام');
                              setAssetLocation(asset.location || '');
                              setAssetValue(asset.purchaseValue || 'مجاني');
                              setAssetNotes(asset.notes || '');
                              setActiveForm('asset');
                            }}
                            className="p-1 hover:bg-slate-200 text-slate-700 rounded"
                            title="تعديل"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAsset(asset.id, asset.name)}
                            className="p-1 hover:bg-rose-100 text-rose-700 rounded"
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
      </div>

      {/* SECTION 3: سجل العمليات المالية والتحويلات والتقارير (Transactions Log & PDF Export) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4 print-container">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-black text-[#0f172a] flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#1e293b]" />
              سجل العمليات المالية والتحويلات
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap no-print">
            {/* Export PDF Button */}
            <button
              onClick={handlePrintPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-amber-400 font-bold text-xs uppercase tracking-wider rounded border border-slate-800 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>تصدير تقرير (PDF / طباعة)</span>
            </button>
          </div>
        </div>

        {/* Header for Printable PDF View */}
        <div className="hidden print:block mb-4 pb-3 border-b-2 border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-[#0f172a]">استوديو أرتياتك - تقرير الحركة المالية</h1>
              <p className="text-xs font-bold text-slate-600">
                فترة التقرير: {filterPeriod === 'today' ? 'عمليات اليوم' : filterPeriod === 'yesterday' ? 'عمليات الأمس' : filterPeriod === 'this_week' ? 'عمليات هذا الأسبوع' : filterPeriod === 'this_month' ? 'عمليات هذا الشهر' : filterPeriod === 'custom' ? `من ${startDate || 'البداية'} إلى ${endDate || 'اليوم'}` : 'جميع الأوقات'}
              </p>
            </div>
            <div className="text-left font-mono text-xs font-bold text-slate-500">
              تاريخ التقرير: {new Date().toLocaleDateString('ar-LY')}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 p-2.5 bg-slate-100 rounded text-xs font-bold">
            <div>إجمالي الإيرادات: <span className="text-emerald-700 dir-ltr">{formatCurrency(periodTotalIncome)}</span></div>
            <div>إجمالي المصروفات: <span className="text-rose-700 dir-ltr">{formatCurrency(periodTotalExpense)}</span></div>
            <div>الصافي: <span className="text-slate-900 dir-ltr">{formatCurrency(periodNetBalance)}</span></div>
          </div>
        </div>

        {/* Inline Form: Income / Expense / Transfer */}
        {(activeForm === 'income' || activeForm === 'expense' || activeForm === 'transfer') && (
          <form
            onSubmit={(e) => handleAddTransaction(e, activeForm as TransactionType)}
            className="bg-slate-50 border border-slate-300 p-4 rounded-md space-y-3 no-print"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-xs font-black text-[#0f172a] uppercase tracking-wider">
                {activeForm === 'income' && 'تسجيل إيراد جديد (+)'}
                {activeForm === 'expense' && 'تسجيل مصروف جديد (-)'}
                {activeForm === 'transfer' && 'تسجيل تحويل بين الحسابات (⇄)'}
              </h3>
              <button onClick={resetForms} type="button" className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">المبلغ (د.ل)</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={txAmount || ''}
                  onChange={(e) => setTxAmount(Number(e.target.value))}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {activeForm === 'transfer' ? 'من مكان' : 'مكان التخزين / الحساب'}
                </label>
                <select
                  required
                  value={txLocationId}
                  onChange={(e) => setTxLocationId(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                >
                  <option value="">اختر مكان التخزين...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.balance} {loc.currency})
                    </option>
                  ))}
                </select>
              </div>

              {activeForm === 'transfer' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">إلى مكان</label>
                  <select
                    required
                    value={txToLocationId}
                    onChange={(e) => setTxToLocationId(e.target.value)}
                    className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                  >
                    <option value="">اختر المكان المحول إليه...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.balance} {loc.currency})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الفئة / التصنيف</label>
                <input
                  type="text"
                  placeholder="مثال: مشروع، صيانة، تشغيلي"
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">المستلم / الجهة</label>
                <input
                  type="text"
                  placeholder="اسم الجهة أو المستلم"
                  value={txRecipient}
                  onChange={(e) => setTxRecipient(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الوصف التفصيلي</label>
              <input
                type="text"
                required
                placeholder="سبب العملية وملاحظات مهمة"
                value={txDescription}
                onChange={(e) => setTxDescription(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                المصادر والوثائق (روابط الإيصالات، الفواتير أو صور المستندات)
              </label>
              <textarea
                rows={2}
                placeholder="ضع كل رابط مستند في سطر مستقل أو افصل بفاصلة (مثال: https://...)"
                value={txSources}
                onChange={(e) => setTxSources(e.target.value)}
                className="w-full p-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:border-[#1e293b] focus:outline-none dir-ltr text-right"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForms}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black rounded disabled:opacity-50"
              >
                تأكيد العملية
              </button>
            </div>
          </form>
        )}

        {/* Filters & Date Options */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded border border-slate-200 text-xs font-bold no-print">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-black text-slate-700 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> تصفية العمليات:
            </span>

            {/* Filter Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="p-1.5 bg-white border border-slate-300 rounded font-bold text-slate-800"
            >
              <option value="all">كل الأنواع</option>
              <option value="income">إيراد</option>
              <option value="expense">مصروف</option>
              <option value="transfer">تحويل</option>
            </select>

            {/* Period Filter */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="p-1.5 bg-white border border-slate-300 rounded font-bold text-slate-800"
              >
                <option value="all">جميع الأوقات</option>
                <option value="today">اليوم</option>
                <option value="yesterday">الأمس</option>
                <option value="this_week">هذا الأسبوع</option>
                <option value="this_month">هذا الشهر</option>
                <option value="custom">مدى محدد</option>
              </select>
            </div>

            {/* Custom Date Inputs */}
            {filterPeriod === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="p-1 bg-white border border-slate-300 rounded font-mono text-xs font-bold"
                  title="من تاريخ"
                />
                <span className="text-slate-400">إلى</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="p-1 bg-white border border-slate-300 rounded font-mono text-xs font-bold"
                  title="إلى تاريخ"
                />
              </div>
            )}
          </div>

          <input
            type="text"
            placeholder="بحث بالوصف، المستلم، أو الكاتب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="p-1.5 bg-white border border-slate-300 rounded w-full sm:w-64 font-bold"
          />
        </div>

        {/* Transactions Grouped by Days with Pagination */}
        {sortedDateKeys.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 font-medium">لا توجد عمليات مطابقة للفلاتر المحددة</p>
        ) : (
          <div className="space-y-6">
            {sortedDateKeys
              .slice((txsPage - 1) * txsPerPage, txsPage * txsPerPage)
              .map((dateKey) => {
              const dayTxs = groupedTransactions[dateKey];
              const dayIncome = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
              const dayExpense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);

              return (
                <div key={dateKey} className="space-y-2">
                  {/* Group Header for Date */}
                  <div className="flex items-center justify-between bg-slate-100 px-3 py-2 rounded border-r-4 border-r-[#1e293b]">
                    <span className="font-black text-[#0f172a] text-xs flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-600" />
                      تاريخ: {formatDate(dateKey)}
                    </span>
                    <div className="flex items-center gap-3 text-[11px] font-bold">
                      {dayIncome > 0 && (
                        <span className="text-emerald-700 dir-ltr">
                          إيرادات: +{formatCurrency(dayIncome)}
                        </span>
                      )}
                      {dayExpense > 0 && (
                        <span className="text-rose-700 dir-ltr">
                          مصروفات: -{formatCurrency(dayExpense)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Transactions Table for the Day */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border border-slate-200">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black uppercase tracking-wider">
                          <th className="p-2">التاريخ والوقت</th>
                          <th className="p-2">المبلغ</th>
                          <th className="p-2">النوع</th>
                          <th className="p-2">المكان</th>
                          <th className="p-2">المستلم / الجهة</th>
                          <th className="p-2">الوصف التفصيلي</th>
                          <th className="p-2">المصادر / المستندات</th>
                          <th className="p-2">بواسطة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {dayTxs.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50">
                            <td className="p-2 font-mono font-bold text-slate-600 dir-ltr text-right">
                              {tx.date}
                            </td>
                            <td className="p-2 font-black text-[#1e293b] dir-ltr text-right">
                              {formatCurrency(tx.amount)}
                            </td>
                            <td className="p-2">
                              {tx.type === 'income' && (
                                <span className="text-emerald-700 font-black">
                                  إيراد
                                </span>
                              )}
                              {tx.type === 'expense' && (
                                <span className="text-rose-700 font-black">
                                  مصروف
                                </span>
                              )}
                              {tx.type === 'transfer' && (
                                <span className="text-blue-700 font-black">
                                  تحويل
                                </span>
                              )}
                            </td>
                            <td className="p-2 font-bold text-slate-800">
                              {tx.type === 'transfer' ? (
                                <span>
                                  {tx.locationName} ← {tx.toLocationName}
                                </span>
                              ) : (
                                tx.locationName
                              )}
                            </td>
                            {/* Display Recipient / Entity */}
                            <td className="p-2 font-bold text-slate-800">
                              {tx.recipient || '-'}
                            </td>
                            <td className="p-2 text-slate-700 font-medium">
                              {tx.description}
                            </td>
                            {/* Display Proof Sources & Document Links */}
                            <td className="p-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {tx.sources && tx.sources.length > 0 ? (
                                  tx.sources.map((url, idx) => getSourceBadge(url, idx))
                                ) : currentUser.role !== 'admin' ? (
                                  <span className="text-slate-400 font-normal text-[11px]">(لا مصادر)</span>
                                ) : null}
                                {currentUser.role === 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddSourceModal(tx.id)}
                                    className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline transition-colors cursor-pointer px-1"
                                    title="إضافة رابط إيصال أو مستند"
                                  >
                                    + إضافة مصدر
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-2 text-slate-600 font-bold">{tx.createdBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* Pagination Controls for Transactions */}
            {Math.ceil(sortedDateKeys.length / txsPerPage) > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 no-print">
                <span className="text-xs text-slate-500 font-bold">
                  الصفحة {txsPage} من {Math.ceil(sortedDateKeys.length / txsPerPage)} ({sortedDateKeys.length} أياّم بها عمليات)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={txsPage === 1}
                    onClick={() => setTxsPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded disabled:opacity-40"
                  >
                    السابق
                  </button>
                  <button
                    disabled={txsPage >= Math.ceil(sortedDateKeys.length / txsPerPage)}
                    onClick={() => setTxsPage(p => p + 1)}
                    className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded disabled:opacity-40"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Modal Dialog for Adding Source Link */}
      {addSourceTxId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-sm text-[#0f172a] flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-amber-600" />
                <span>إضافة مصدر / إيصال للعملية المالية</span>
              </h3>
              <button
                onClick={() => setAddSourceTxId(null)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                رابط المستند / الإيصال (صورة، PDF، Google Drive، أو رابط):
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#1e293b] focus:outline-none font-bold"
                autoFocus
              />
              <p className="text-[11px] text-slate-500 font-medium">
                يمكنك إدخال رابط صورة الإيصال أو ملف PDF أو مستند Google Drive لربطه بالحركة المالية.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setAddSourceTxId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveSourceForTx}
                disabled={!newSourceUrl.trim()}
                className="px-4 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black rounded-xl shadow transition-colors disabled:opacity-50 cursor-pointer"
              >
                حفظ المصدر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Report Export Modal */}
      {showReportModal && (() => {
        const repIncome = filteredTxs.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
        const repExpense = filteredTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl no-print">
            <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col space-y-4">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-black text-[#0f172a] flex items-center gap-2">
                    <Printer className="w-5 h-5 text-amber-600" />
                    <span>تقرير الخزينة والعمليات المالية</span>
                  </h2>
                  <p className="text-xs font-bold text-slate-500 mt-0.5">
                    ملخص وشامل للعمليات حسب الفلاتر المحددة حالياً ({filteredTxs.length} عملية)
                  </p>
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable Report Content Body */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Report Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <span className="text-[11px] font-bold text-slate-500 block">إجمالي الإيرادات</span>
                    <span className="text-sm font-black text-emerald-700">{formatCurrency(repIncome)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <span className="text-[11px] font-bold text-slate-500 block">إجمالي المصروفات</span>
                    <span className="text-sm font-black text-rose-700">{formatCurrency(repExpense)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <span className="text-[11px] font-bold text-slate-500 block">صافي التدفق</span>
                    <span className={`text-sm font-black ${repIncome - repExpense >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(repIncome - repExpense)}
                    </span>
                  </div>
                </div>

                {/* Report Transactions Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#1e293b] text-white font-bold">
                      <tr>
                        <th className="p-2">التاريخ</th>
                        <th className="p-2">النوع</th>
                        <th className="p-2">المبلغ</th>
                        <th className="p-2">الخزانة</th>
                        <th className="p-2">الجهة / البيان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredTxs.slice(0, 50).map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-700">{tx.date}</td>
                          <td className="p-2 font-black">
                            {tx.type === 'income' ? (
                              <span className="text-emerald-700">إيراد</span>
                            ) : tx.type === 'expense' ? (
                              <span className="text-rose-700">مصروف</span>
                            ) : (
                              <span className="text-blue-700">تحويل</span>
                            )}
                          </td>
                          <td className="p-2 font-black text-slate-900">{formatCurrency(tx.amount || 0)}</td>
                          <td className="p-2 text-slate-700">{tx.locationName}</td>
                          <td className="p-2 text-slate-700">{tx.recipient ? `${tx.recipient} - ` : ''}{tx.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredTxs.length > 50 && (
                    <p className="p-2 text-[11px] text-slate-500 font-bold text-center bg-slate-50">
                      يتم عرض أول 50 حركة مالية فقط في هذه المعاينة.
                    </p>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  onClick={async () => {
                    const htmlTable = `<html dir="rtl" lang="ar"><body><h2>📋 تقرير الخزينة والعمليات المالية - استوديو أرتياتك</h2><p><b>تاريخ التقرير:</b> ${new Date().toLocaleDateString('ar-LY')} | <b>عدد العمليات:</b> ${filteredTxs.length}</p><p><b>الملخص المالي:</b> إجمالي الإيرادات: ${formatCurrency(repIncome)} | إجمالي المصروفات: ${formatCurrency(repExpense)} | صافي التدفق: ${formatCurrency(repIncome - repExpense)}</p><table border="1" style="border-collapse: collapse; width: 100%; text-align: right; font-family: sans-serif; font-size: 12px;"><thead><tr style="background-color: #f1f5f9; font-weight: bold;"><th style="padding: 8px;">#</th><th style="padding: 8px;">التاريخ</th><th style="padding: 8px;">النوع</th><th style="padding: 8px;">المبلغ</th><th style="padding: 8px;">المكان</th><th style="padding: 8px;">الجهة/المستلم</th><th style="padding: 8px;">الوصف التفصيلي</th><th style="padding: 8px;">بواسطة</th></tr></thead><tbody>${filteredTxs.map((t, idx) => `<tr><td style="padding: 6px;">${idx + 1}</td><td style="padding: 6px;">${t.date}</td><td style="padding: 6px;">${t.type === 'income' ? 'إيراد' : t.type === 'expense' ? 'مصروف' : 'تحويل'}</td><td style="padding: 6px; font-weight: bold;">${formatCurrency(t.amount || 0)}</td><td style="padding: 6px;">${t.locationName || '-'}</td><td style="padding: 6px;">${t.recipient || '-'}</td><td style="padding: 6px;">${t.description || '-'}</td><td style="padding: 6px;">${t.createdBy || '-'}</td></tr>`).join('')}</tbody></table></body></html>`;
                    
                    const plainText = `#\tالتاريخ\tالنوع\tالمبلغ\tالمكان\tالجهة/المستلم\tالوصف\tبواسطة\n` + filteredTxs.map((t, idx) => `${idx + 1}\t${t.date}\t${t.type === 'income' ? 'إيراد' : t.type === 'expense' ? 'مصروف' : 'تحويل'}\t${t.amount}\t${t.locationName || '-'}\t${t.recipient || '-'}\t${t.description || '-'}\t${t.createdBy || '-'}`).join('\n');

                    try {
                      const blobHtml = new Blob([htmlTable], { type: 'text/html' });
                      const blobText = new Blob([plainText], { type: 'text/plain' });
                      const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
                      await navigator.clipboard.write(data);
                    } catch (e) {
                      await navigator.clipboard.writeText(plainText);
                    }
                    setCopiedReportText(true);
                    showToast('تم نسخ جدول التقرير للحافظة بنجاح ✓', 'success');
                    setTimeout(() => setCopiedReportText(false), 3000);
                  }}
                  className={`px-4 py-2 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    copiedReportText 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedReportText ? 'تم نسخ الجدول بنجاح ✓' : 'نسخ التقرير المنسق'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    إغلاق
                  </button>
                  <button
                    onClick={handlePrintReport}
                    className="px-4 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-black rounded-xl shadow flex items-center gap-2 transition-colors cursor-pointer active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة / حفظ كـ PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Image Preview Modal (Img Tag + Fallback) */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl no-print animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-5 shadow-2xl border border-slate-200 flex flex-col space-y-4 max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Image className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">معاينة صورة المستند / الإيصال</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                >
                  <span>افتح في تبويب جديد</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-950/90 rounded-xl p-3 flex items-center justify-center min-h-[350px] relative">
              {imgLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white z-10">
                  <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold text-slate-300">جاري تحميل الصورة...</span>
                </div>
              )}
              <img
                src={previewImageUrl}
                alt="معاينة الصورة"
                className={`max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg mx-auto transition-opacity duration-300 ${
                  imgLoading ? 'opacity-0' : 'opacity-100'
                }`}
                onLoad={() => setImgLoading(false)}
                onError={(e) => {
                  setImgLoading(false);
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const iframe = target.nextElementSibling as HTMLIFrameElement;
                  if (iframe) iframe.style.display = 'block';
                }}
              />
              <iframe
                src={previewImageUrl}
                title="معاينة الصورة"
                className="w-full h-[60vh] rounded-lg border-0 bg-white hidden"
                onLoad={() => setImgLoading(false)}
              />
            </div>

            <div className="pt-2 text-left border-t border-slate-200">
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Asset Confirm */}
      {deleteConfirmAsset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 text-center border border-slate-100 shadow-2xl">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">حذف الأصل</h3>
            <p className="text-xs text-slate-600 font-bold leading-relaxed">
              هل أنت تأكيد من رغبتك في حذف الأصل "{deleteConfirmAsset.name}"؟ لا يمكن التراجع عن هذه الخطوة.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={confirmDeleteAsset}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                تأكيد الحذف
              </button>
              <button
                onClick={() => setDeleteConfirmAsset(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
