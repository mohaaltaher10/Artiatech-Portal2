import React, { useEffect, useState, useMemo } from 'react';
import { db, formatCurrency, logActivity, generateReadableId } from '../lib/firebase';
import { sendAppNotification } from '../lib/notifications';
import { ref, onValue, set, remove, update, runTransaction } from 'firebase/database';
import {
  DistributionFundSlice,
  SliceMember,
  UserProfile,
  DistributionFundLog,
  DistributionBasePool
} from '../types';
import {
  PieChart,
  PlusCircle,
  Users,
  Trash2,
  X,
  Plus,
  Printer,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  History,
  FileText,
  Copy,
  Edit2,
  Wallet,
  Coins,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Building,
  Filter
} from 'lucide-react';

interface DistributionFundViewProps {
  currentUser: UserProfile;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const DistributionFundView: React.FC<DistributionFundViewProps> = ({
  currentUser,
  showToast,
}) => {
  const [slices, setSlices] = useState<DistributionFundSlice[]>([]);
  const [basePool, setBasePool] = useState<DistributionBasePool>({ balance: 0, updatedAt: '' });
  const [logs, setLogs] = useState<DistributionFundLog[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search for Audit Log
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logFilterType, setLogFilterType] = useState('all');
  const [logsPage, setLogsPage] = useState(1);
  const logsPerPage = 10;

  // Form State: New Slice
  const [showAddForm, setShowAddForm] = useState(false);
  const [sliceName, setSliceName] = useState('');
  const [sliceDescription, setSliceDescription] = useState('');
  const [sliceTotalAmount, setSliceTotalAmount] = useState<number>(0);
  const [selectedMembers, setSelectedMembers] = useState<
    { userId: string; userName: string; userEmail?: string; shares: number }[]
  >([]);

  // Base Pool Operations Modals
  const [showBaseDepositModal, setShowBaseDepositModal] = useState(false);
  const [baseDepositAmount, setBaseDepositAmount] = useState<number>(0);
  const [baseDepositNote, setBaseDepositNote] = useState('');

  const [showBaseWithdrawModal, setShowBaseWithdrawModal] = useState(false);
  const [baseWithdrawAmount, setBaseWithdrawAmount] = useState<number>(0);
  const [baseWithdrawNote, setBaseWithdrawNote] = useState('');

  const [showBaseTransferModal, setShowBaseTransferModal] = useState(false);
  const [transferTargetSliceId, setTransferTargetSliceId] = useState('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferNote, setTransferNote] = useState('');

  // Edit Slice & Shares Modal
  const [editingSlice, setEditingSlice] = useState<DistributionFundSlice | null>(null);
  const [editSliceName, setEditSliceName] = useState('');
  const [editSliceDescription, setEditSliceDescription] = useState('');
  const [editMembers, setEditMembers] = useState<SliceMember[]>([]);
  const [editRecalculateMode, setEditRecalculateMode] = useState<'recalculate' | 'keep_balances'>('recalculate');

  // Recharge Modal State
  const [rechargeSlice, setRechargeSlice] = useState<DistributionFundSlice | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState<number>(0);
  const [rechargeSource, setRechargeSource] = useState<'external' | 'base_pool'>('external');
  const [rechargeNote, setRechargeNote] = useState<string>('');

  // Withdrawal Modal State
  const [withdrawModal, setWithdrawModal] = useState<{ slice: DistributionFundSlice; member: SliceMember } | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [withdrawNote, setWithdrawNote] = useState<string>('');

  // Submitting state & Modals
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmSlice, setDeleteConfirmSlice] = useState<{ id: string; name: string } | null>(null);

  // PDF Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [copiedReportText, setCopiedReportText] = useState(false);

  useEffect(() => {
    // 1. Listen to distribution slices
    const unsubSlices = onValue(
      ref(db, 'distribution_fund'),
      (snapshot) => {
        const val = snapshot.val();
        const list: DistributionFundSlice[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
        setSlices(list);
      },
      (err) => console.warn('Distribution fund listener notice:', err)
    );

    // 2. Listen to Base Pool
    const unsubBasePool = onValue(
      ref(db, 'distribution_base_pool'),
      (snapshot) => {
        const val = snapshot.val();
        setBasePool(val || { balance: 0, updatedAt: '', description: 'الوعاء المالي العام' });
      },
      (err) => console.warn('Base pool listener notice:', err)
    );

    // 3. Listen to distribution fund financial logs
    const unsubLogs = onValue(
      ref(db, 'distribution_fund_logs'),
      (snapshot) => {
        const val = snapshot.val();
        const list: DistributionFundLog[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
        list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        setLogs(list);
      },
      (err) => console.warn('Distribution logs listener notice:', err)
    );

    // 4. Listen to users to dynamically resolve member names & profiles
    const unsubUsers = onValue(
      ref(db, 'users'),
      (snapshot) => {
        const val = snapshot.val();
        const list: UserProfile[] = val ? Object.keys(val).map((k) => ({ id: k, ...val[k] })) : [];
        setAllUsers(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Users listener notice:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubSlices();
      unsubBasePool();
      unsubLogs();
      unsubUsers();
    };
  }, []);

  // Calculate Totals
  const slicesTotalAmount = slices.reduce((sum, sl) => sum + (sl.totalAmount || 0), 0);
  const totalFund = (basePool.balance || 0) + slicesTotalAmount;
  const totalMembersCount = slices.reduce((sum, sl) => sum + (sl.members?.length || 0), 0);

  // Helper to dynamically get latest member name from allUsers list
  const getLatestUserName = (userId?: string, userEmail?: string, fallbackName?: string) => {
    if (userId) {
      const found = allUsers.find((u) => u.id === userId);
      if (found?.name) return found.name;
    }
    if (userEmail) {
      const found = allUsers.find((u) => u.email?.toLowerCase() === userEmail.toLowerCase());
      if (found?.name) return found.name;
    }
    return fallbackName || 'عضو غير معرف';
  };

  // Helper to log fund transactions
  const logFundTx = async (
    sliceId: string,
    sliceName: string,
    type: 'CREATE_SLICE' | 'RECHARGE_SLICE' | 'WITHDRAW_MEMBER' | 'DELETE_SLICE' | 'UPDATE_SHARES' | 'BASE_POOL_DEPOSIT' | 'BASE_POOL_TRANSFER' | 'BASE_POOL_WITHDRAW',
    typeNameAr: string,
    amount: number,
    details: string,
    memberName?: string,
    memberId?: string
  ) => {
    try {
      const logId = generateReadableId('dflog', sliceName || 'base');
      const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      await set(ref(db, `distribution_fund_logs/${logId}`), {
        id: logId,
        sliceId,
        sliceName,
        type,
        typeNameAr,
        amount: Number(amount) || 0,
        memberName: memberName || '',
        memberId: memberId || '',
        details,
        date: dateStr,
        performedBy: currentUser.name,
        performedById: currentUser.id,
      });

      await logActivity(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        `صندوق التوزيعات: ${typeNameAr}`,
        `${currentUser.name} قام بـ ${typeNameAr}: ${details}`
      );
    } catch (err) {
      console.warn('Error logging fund transaction:', err);
    }
  };

  // Helper: Draft member additions
  const handleAddMemberToDraft = (userId: string) => {
    if (!userId) return;
    const existing = selectedMembers.find((m) => m.userId === userId);
    if (existing) return;

    const userObj = allUsers.find((u) => u.id === userId);
    if (!userObj) return;

    setSelectedMembers([
      ...selectedMembers,
      { userId: userObj.id, userName: userObj.name, userEmail: userObj.email, shares: 1 },
    ]);
  };

  const handleUpdateDraftShares = (userId: string, shares: number) => {
    setSelectedMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, shares: Math.max(1, shares) } : m))
    );
  };

  const handleRemoveMemberFromDraft = (userId: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  // 1. Create New Slice (Supports 0 LYD initial amount)
  const handleCreateSlice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'admin') {
      showToast('عذراً، هذه العملية متاحة للمشرف فقط', 'error');
      return;
    }
    if (!sliceName.trim()) {
      showToast('يرجى إدخال اسم الشريحة', 'error');
      return;
    }
    if (sliceTotalAmount < 0) {
      showToast('المبلغ الإجمالي لا يمكن أن يكون سالباً', 'error');
      return;
    }
    if (selectedMembers.length === 0) {
      showToast('يرجى إضافة عضو واحد على الأقل', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const totalShares = selectedMembers.reduce((sum, m) => sum + (m.shares || 1), 0);
      const initialAmount = Number(sliceTotalAmount) || 0;

      // Calculate member balance proportionally (or 0 if initialAmount is 0)
      const finalMembers: SliceMember[] = selectedMembers.map((m) => {
        const memberBalance = initialAmount > 0 ? (initialAmount * (m.shares || 1)) / totalShares : 0;
        return {
          userId: m.userId,
          userName: m.userName,
          userEmail: m.userEmail || '',
          shares: m.shares || 1,
          balance: Math.round(memberBalance * 100) / 100,
        };
      });

      const todayStr = new Date().toISOString().split('T')[0];
      const newSliceId = generateReadableId('slice', sliceName);

      await set(ref(db, `distribution_fund/${newSliceId}`), {
        id: newSliceId,
        name: sliceName.trim(),
        description: sliceDescription.trim(),
        totalAmount: initialAmount,
        createdDate: todayStr,
        members: finalMembers,
      });

      await logFundTx(
        newSliceId,
        sliceName.trim(),
        'CREATE_SLICE',
        'إنشاء شريحة',
        initialAmount,
        `إنشاء الشريحة بمبلغ (${formatCurrency(initialAmount)}) موزعة على ${selectedMembers.length} أعضاء بإجمالي ${totalShares} سهم.`
      );

      sendAppNotification(`شريحة جديدة: ${sliceName.trim()}`, {
        body: `تم إدراج شريحة جديدة برصيد ${formatCurrency(initialAmount)}`,
        tag: `slice-${newSliceId}`
      });

      showToast('تمت إضافة الشريحة بنجاح ✓', 'success');
      setShowAddForm(false);
      setSliceName('');
      setSliceDescription('');
      setSliceTotalAmount(0);
      setSelectedMembers([]);
    } catch (err: any) {
      console.error('Create slice error:', err);
      showToast('حدث خطأ أثناء إنشاء الشريحة', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Base Pool Operations (Deposit, Withdraw, Transfer to Slice)
  const handleBasePoolDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'admin') {
      showToast('عذراً، هذه العملية متاحة للمشرف فقط', 'error');
      return;
    }
    if (!baseDepositAmount || baseDepositAmount <= 0) {
      showToast('يرجى إدخال مبلغ إيداع صحيح', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const basePoolRef = ref(db, 'distribution_base_pool');
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      
      await runTransaction(basePoolRef, (current) => {
        const curBal = current?.balance || 0;
        return {
          balance: curBal + Number(baseDepositAmount),
          updatedAt: nowStr,
          description: 'الشريحة الأساسية'
        };
      });

      await logFundTx(
        'base_pool',
        'الشريحة الأساسية',
        'BASE_POOL_DEPOSIT',
        'إيداع بالأساسية',
        baseDepositAmount,
        baseDepositNote.trim() || `إيداع مبلغ ${formatCurrency(baseDepositAmount)} بالأساسية.`
      );

      showToast('تم الإيداع بنجاح ✓', 'success');
      setShowBaseDepositModal(false);
      setBaseDepositAmount(0);
      setBaseDepositNote('');
    } catch (err) {
      showToast('حدث خطأ أثناء الإيداع', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBasePoolWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'admin') {
      showToast('عذراً، هذه العملية متاحة للمشرف فقط', 'error');
      return;
    }
    if (!baseWithdrawAmount || baseWithdrawAmount <= 0) {
      showToast('يرجى إدخال مبلغ سحب صحيح', 'error');
      return;
    }
    if (baseWithdrawAmount > (basePool.balance || 0)) {
      showToast('المبلغ المطلوب أكبر من رصيد الشريحة الأساسية', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const basePoolRef = ref(db, 'distribution_base_pool');
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      
      await runTransaction(basePoolRef, (current) => {
        const curBal = current?.balance || 0;
        return {
          balance: Math.max(0, curBal - Number(baseWithdrawAmount)),
          updatedAt: nowStr,
          description: 'الشريحة الأساسية'
        };
      });

      await logFundTx(
        'base_pool',
        'الشريحة الأساسية',
        'BASE_POOL_WITHDRAW',
        'سحب من الأساسية',
        baseWithdrawAmount,
        baseWithdrawNote.trim() || `سحب ${formatCurrency(baseWithdrawAmount)} من الشريحة الأساسية.`
      );

      showToast('تم السحب بنجاح ✓', 'success');
      setShowBaseWithdrawModal(false);
      setBaseWithdrawAmount(0);
      setBaseWithdrawNote('');
    } catch (err) {
      showToast('حدث خطأ أثناء السحب', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBasePoolTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'admin') {
      showToast('عذراً، هذه العملية متاحة للمشرف فقط', 'error');
      return;
    }
    if (!transferTargetSliceId) {
      showToast('يرجى اختيار الشريحة المستهدفة', 'error');
      return;
    }
    if (!transferAmount || transferAmount <= 0) {
      showToast('يرجى إدخال مبلغ تحويل صحيح', 'error');
      return;
    }
    if (transferAmount > (basePool.balance || 0)) {
      showToast('المبلغ المطلوب أكبر من رصيد الشريحة الأساسية', 'error');
      return;
    }

    const targetSlice = slices.find((s) => s.id === transferTargetSliceId);
    if (!targetSlice) {
      showToast('الشريحة المستهدفة غير موجودة', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

      // 1. Deduct from Base Pool
      const basePoolRef = ref(db, 'distribution_base_pool');
      await runTransaction(basePoolRef, (current) => {
        const curBal = current?.balance || 0;
        return {
          balance: Math.max(0, curBal - Number(transferAmount)),
          updatedAt: nowStr,
          description: 'الشريحة الأساسية'
        };
      });

      // 2. Add and distribute proportionally to the target slice members
      const totalShares = (targetSlice.members || []).reduce((sum, m) => sum + (m.shares || 1), 0);
      const updatedMembers = (targetSlice.members || []).map((m) => {
        const addedBalance = totalShares > 0 ? (transferAmount * (m.shares || 1)) / totalShares : 0;
        const newBalance = (m.balance || 0) + addedBalance;
        return {
          ...m,
          balance: Math.round(newBalance * 100) / 100,
        };
      });

      const newTotalAmount = (targetSlice.totalAmount || 0) + transferAmount;

      await update(ref(db, `distribution_fund/${targetSlice.id}`), {
        totalAmount: newTotalAmount,
        members: updatedMembers,
      });

      await logFundTx(
        targetSlice.id,
        targetSlice.name,
        'BASE_POOL_TRANSFER',
        'تخصيص لشريحة',
        transferAmount,
        transferNote.trim() || `تخصيص ${formatCurrency(transferAmount)} إلى شريحة (${targetSlice.name}) وتوزيعها على الأسهم.`
      );

      sendAppNotification(`توزيع أرباح: ${targetSlice.name}`, {
        body: `تم تخصيص ${formatCurrency(transferAmount)} للشريحة`,
        tag: `transfer-${targetSlice.id}`
      });

      showToast('تم التخصيص والتوزيع بنجاح ✓', 'success');
      setShowBaseTransferModal(false);
      setTransferTargetSliceId('');
      setTransferAmount(0);
      setTransferNote('');
    } catch (err) {
      showToast('حدث خطأ أثناء التخصيص', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Edit Slice & Shares Modal Handlers
  const handleOpenEditSlice = (slice: DistributionFundSlice) => {
    if (currentUser.role !== 'admin') {
      showToast('عذراً، التعديل متاح للمشرف فقط', 'error');
      return;
    }
    setEditingSlice(slice);
    setEditSliceName(slice.name);
    setEditSliceDescription(slice.description || '');
    setEditMembers(
      (slice.members || []).map((m) => ({
        userId: m.userId,
        userName: m.userName,
        userEmail: m.userEmail || '',
        shares: m.shares || 1,
        balance: m.balance || 0,
      }))
    );
    setEditRecalculateMode('recalculate');
  };

  const handleAddMemberToEdit = (userId: string) => {
    if (!userId) return;
    const existing = editMembers.find((m) => m.userId === userId);
    if (existing) return;

    const userObj = allUsers.find((u) => u.id === userId);
    if (!userObj) return;

    setEditMembers([
      ...editMembers,
      { userId: userObj.id, userName: userObj.name, userEmail: userObj.email, shares: 1, balance: 0 },
    ]);
  };

  const handleUpdateEditShares = (userId: string, shares: number) => {
    setEditMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, shares: Math.max(1, shares) } : m))
    );
  };

  const handleRemoveMemberFromEdit = (userId: string) => {
    setEditMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const handleSaveEditedSlice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'admin') {
      showToast('عذراً، هذه العملية متاحة للمشرف فقط', 'error');
      return;
    }
    if (!editingSlice) return;
    if (!editSliceName.trim()) {
      showToast('يرجى إدخال اسم الشريحة', 'error');
      return;
    }
    if (editMembers.length === 0) {
      showToast('يجب أن تحتوي الشريحة على عضو واحد على الأقل', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const totalShares = editMembers.reduce((sum, m) => sum + (m.shares || 1), 0);
      const currentTotalAmount = editingSlice.totalAmount || 0;

      let finalMembers: SliceMember[] = [];

      if (editRecalculateMode === 'recalculate' && currentTotalAmount > 0) {
        finalMembers = editMembers.map((m) => {
          const newBal = totalShares > 0 ? (currentTotalAmount * (m.shares || 1)) / totalShares : 0;
          return {
            userId: m.userId,
            userName: getLatestUserName(m.userId, m.userEmail, m.userName),
            userEmail: m.userEmail || '',
            shares: m.shares || 1,
            balance: Math.round(newBal * 100) / 100,
          };
        });
      } else {
        finalMembers = editMembers.map((m) => ({
          userId: m.userId,
          userName: getLatestUserName(m.userId, m.userEmail, m.userName),
          userEmail: m.userEmail || '',
          shares: m.shares || 1,
          balance: m.balance || 0,
        }));
      }

      await update(ref(db, `distribution_fund/${editingSlice.id}`), {
        name: editSliceName.trim(),
        description: editSliceDescription.trim(),
        members: finalMembers,
      });

      await logFundTx(
        editingSlice.id,
        editSliceName.trim(),
        'UPDATE_SHARES',
        'تعديل الأسهم',
        0,
        `تعديل الشريحة والأسهم (${editMembers.length} أعضاء، ${totalShares} سهم).`
      );

      showToast('تم حفظ التعديلات بنجاح ✓', 'success');
      setEditingSlice(null);
    } catch (err) {
      console.error('Save edit slice error:', err);
      showToast('حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Recharge Slice Directly
  const handleExecuteRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'admin') {
      showToast('عذراً، الشحن متاح للمشرف فقط', 'error');
      return;
    }
    if (!rechargeSlice || !rechargeAmount || rechargeAmount <= 0) {
      showToast('يرجى تحديد مبلغ الشحن', 'error');
      return;
    }

    if (rechargeSource === 'base_pool' && rechargeAmount > (basePool.balance || 0)) {
      showToast('المبلغ المطلوب أكبر من رصيد الشريحة الأساسية', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const totalShares = (rechargeSlice.members || []).reduce((sum, m) => sum + (m.shares || 1), 0);
      
      const updatedMembers = (rechargeSlice.members || []).map((m) => {
        const addedBalance = totalShares > 0 ? (rechargeAmount * (m.shares || 1)) / totalShares : 0;
        const newBalance = (m.balance || 0) + addedBalance;
        return {
          ...m,
          balance: Math.round(newBalance * 100) / 100,
        };
      });

      const newTotalAmount = (rechargeSlice.totalAmount || 0) + rechargeAmount;

      if (rechargeSource === 'base_pool') {
        const basePoolRef = ref(db, 'distribution_base_pool');
        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
        await runTransaction(basePoolRef, (current) => {
          const curBal = current?.balance || 0;
          return {
            balance: Math.max(0, curBal - Number(rechargeAmount)),
            updatedAt: nowStr,
            description: 'الشريحة الأساسية'
          };
        });
      }

      await update(ref(db, `distribution_fund/${rechargeSlice.id}`), {
        totalAmount: newTotalAmount,
        members: updatedMembers,
      });

      await logFundTx(
        rechargeSlice.id,
        rechargeSlice.name,
        'RECHARGE_SLICE',
        rechargeSource === 'base_pool' ? 'شحن من الأساسية' : 'شحن مباشر',
        rechargeAmount,
        rechargeNote.trim() || `شحن ${formatCurrency(rechargeAmount)} وتوزيعها حسب الأسهم.`
      );

      sendAppNotification(`شحن شريحة: ${rechargeSlice.name}`, {
        body: `تم شحن ${formatCurrency(rechargeAmount)} للشريحة`,
        tag: `recharge-${rechargeSlice.id}`
      });

      showToast('تم الشحن بنجاح ✓', 'success');
      setRechargeSlice(null);
      setRechargeAmount(0);
      setRechargeNote('');
      setRechargeSource('external');
    } catch (err) {
      showToast('حدث خطأ أثناء الشحن', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Withdraw Member Balance (Strictly Admin-only)
  const handleExecuteWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'admin') {
      showToast('عذراً، السحب متاح للمشرف فقط', 'error');
      return;
    }
    if (!withdrawModal || !withdrawAmount || withdrawAmount <= 0) {
      showToast('يرجى تحديد مبلغ السحب', 'error');
      return;
    }

    const { slice, member } = withdrawModal;

    if (withdrawAmount > member.balance) {
      showToast(`المبلغ أكبر من رصيد العضو (${formatCurrency(member.balance)})`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const updatedMembers = slice.members.map((m) => {
        if (m.userId === member.userId) {
          return {
            ...m,
            balance: Math.max(0, Math.round((m.balance - withdrawAmount) * 100) / 100),
          };
        }
        return m;
      });

      const newTotalAmount = Math.max(0, (slice.totalAmount || 0) - withdrawAmount);

      await update(ref(db, `distribution_fund/${slice.id}`), {
        totalAmount: newTotalAmount,
        members: updatedMembers,
      });

      const activeMemberName = getLatestUserName(member.userId, member.userEmail, member.userName);

      await logFundTx(
        slice.id,
        slice.name,
        'WITHDRAW_MEMBER',
        'سحب أرباح',
        withdrawAmount,
        withdrawNote.trim() || `سحب ${formatCurrency(withdrawAmount)} للعضو (${activeMemberName}).`,
        activeMemberName,
        member.userId
      );

      sendAppNotification(`عملية سحب`, {
        body: `سحب ${formatCurrency(withdrawAmount)} للعضو ${activeMemberName}`,
        tag: `withdraw-${slice.id}`
      });

      showToast('تم السحب بنجاح ✓', 'success');
      setWithdrawModal(null);
      setWithdrawAmount(0);
      setWithdrawNote('');
    } catch (err) {
      showToast('حدث خطأ أثناء السحب', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Delete Slice (Strictly Admin-only)
  const handleDeleteSlice = (id: string, name: string) => {
    if (currentUser.role !== 'admin') {
      showToast('عذراً، الحذف متاح للمشرف فقط', 'error');
      return;
    }
    setDeleteConfirmSlice({ id, name });
  };

  const executeDeleteSlice = async () => {
    if (currentUser.role !== 'admin') {
      showToast('عذراً، الحذف متاح للمشرف فقط', 'error');
      return;
    }
    if (!deleteConfirmSlice) return;
    const { id, name } = deleteConfirmSlice;
    setDeleteConfirmSlice(null);

    try {
      await remove(ref(db, `distribution_fund/${id}`));
      await logFundTx(
        id,
        name,
        'DELETE_SLICE',
        'حذف شريحة',
        0,
        `حذف الشريحة.`
      );
      showToast('تم الحذف بنجاح ✓', 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء الحذف', 'error');
    }
  };

  // Filtered Audit Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const q = logSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (l.sliceName && l.sliceName.toLowerCase().includes(q)) ||
        (l.memberName && l.memberName.toLowerCase().includes(q)) ||
        (l.details && l.details.toLowerCase().includes(q)) ||
        (l.performedBy && l.performedBy.toLowerCase().includes(q));

      const matchesType =
        logFilterType === 'all' ||
        (logFilterType === 'recharge' && (l.type === 'RECHARGE_SLICE' || l.type === 'BASE_POOL_TRANSFER')) ||
        (logFilterType === 'withdraw' && (l.type === 'WITHDRAW_MEMBER' || l.type === 'BASE_POOL_WITHDRAW')) ||
        (logFilterType === 'base_pool' && (l.type === 'BASE_POOL_DEPOSIT' || l.type === 'BASE_POOL_TRANSFER' || l.type === 'BASE_POOL_WITHDRAW')) ||
        (logFilterType === 'slice_ops' && (l.type === 'CREATE_SLICE' || l.type === 'UPDATE_SHARES' || l.type === 'DELETE_SLICE'));

      return matchesSearch && matchesType;
    });
  }, [logs, logSearchQuery, logFilterType]);

  const totalLogPages = Math.ceil(filteredLogs.length / logsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (logsPage - 1) * logsPerPage;
    return filteredLogs.slice(start, start + logsPerPage);
  }, [filteredLogs, logsPage]);

  // Print PDF Report
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة', 'error');
      return;
    }

    const todayStr = new Date().toLocaleDateString('ar-LY', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const slicesHtml = slices
      .map(
        (s, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 10px; font-weight: bold; border: 1px solid #cbd5e1;">${s.name}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1;">${s.description || '—'}</td>
        <td style="padding: 10px; font-weight: bold; border: 1px solid #cbd5e1; text-align: center;">${formatCurrency(s.totalAmount)}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1;">
          <ul style="margin: 0; padding-right: 18px; font-size: 11px;">
            ${(s.members || [])
              .map((m) => {
                const name = getLatestUserName(m.userId, m.userEmail, m.userName);
                return `<li><b>${name}</b> (${m.shares} سهم) - <span style="color: #0f172a; font-weight: bold;">${formatCurrency(m.balance)}</span></li>`;
              })
              .join('')}
          </ul>
        </td>
      </tr>
    `
      )
      .join('');

    const logsHtml = filteredLogs
      .map(
        (l, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${l.date || '—'}</td>
        <td style="padding: 8px; font-weight: bold; border: 1px solid #cbd5e1;">${l.sliceName}</td>
        <td style="padding: 8px; font-weight: bold; border: 1px solid #cbd5e1; color: ${
          l.type === 'RECHARGE_SLICE' || l.type === 'BASE_POOL_DEPOSIT' ? '#047857' : l.type === 'WITHDRAW_MEMBER' || l.type === 'BASE_POOL_WITHDRAW' ? '#be123c' : '#1e293b'
        };">${l.typeNameAr}</td>
        <td style="padding: 8px; font-weight: bold; border: 1px solid #cbd5e1;">${l.amount > 0 ? formatCurrency(l.amount) : '—'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${l.memberName || '—'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${l.details || '—'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${l.performedBy || '—'}</td>
      </tr>
    `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>تقرير صندوق التوزيعات والشرائح المعتمد - أرتياتك</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
          body { font-family: 'Cairo', system-ui, sans-serif; padding: 25px; color: #0f172a; line-height: 1.5; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { margin: 0; font-size: 22px; color: #0f172a; font-weight: 900; }
          .stats-grid { display: flex; gap: 16px; margin-bottom: 24px; text-align: center; }
          .stat-card { flex: 1; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; }
          .stat-title { font-size: 11px; color: #64748b; font-weight: bold; display: block; }
          .stat-val { font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 4px; display: block; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
          th { background-color: #1e293b; color: #ffffff; text-align: right; padding: 10px; border: 1px solid #1e293b; font-size: 11px; }
          .section-title { font-size: 14px; font-weight: 900; color: #0f172a; margin-bottom: 10px; border-right: 4px solid #1e293b; padding-right: 10px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>استوديو أرتياتك - تقرير صندوق التوزيعات والشرائح</h1>
            <p style="margin: 3px 0 0 0; font-size: 12px; font-weight: bold; color: #475569;">التقرير المالي المعتمد للوعاء الأساسي وشرائح التوزيعات والأسهم</p>
          </div>
          <div style="text-align: left; font-size: 11px; color: #64748b; font-weight: bold;">
            <p style="margin:0;">تاريخ التقرير: ${todayStr}</p>
            <p style="margin:0;">المستخرج بواسطة: ${currentUser.name}</p>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-title">إجمالي الصندوق العام</span>
            <span class="stat-val">${formatCurrency(totalFund)}</span>
          </div>
          <div class="stat-card">
            <span class="stat-title">رصيد الشريحة الأساسية (الوعاء العام)</span>
            <span class="stat-val" style="color: #b45309;">${formatCurrency(basePool.balance || 0)}</span>
          </div>
          <div class="stat-card">
            <span class="stat-title">إجمالي الشرائح النشطة</span>
            <span class="stat-val">${formatCurrency(slicesTotalAmount)} (${slices.length} شريحة)</span>
          </div>
          <div class="stat-card">
            <span class="stat-title">إجمالي العمليات الموثقة</span>
            <span class="stat-val">${logs.length} حركة</span>
          </div>
        </div>

        <div class="section-title">أولاً: بيانات الشرائح والأسهم والأعضاء المشاركين</div>
        <table>
          <thead>
            <tr>
              <th>اسم الشريحة</th>
              <th>الوصف والتفاصيل</th>
              <th style="text-align: center;">إجمالي الشريحة</th>
              <th>الأعضاء المشاركون والأسهم والأرصدة</th>
            </tr>
          </thead>
          <tbody>
            ${slicesHtml || '<tr><td colspan="4" style="text-align:center; padding: 20px; border: 1px solid #cbd5e1;">لا توجد شرائح حالية</td></tr>'}
          </tbody>
        </table>

        <div class="section-title">ثانياً: سجل المعاملات والعمليات المالية للشرائح (Audit Trail)</div>
        <table>
          <thead>
            <tr>
              <th>التاريخ والوقت</th>
              <th>الشريحة</th>
              <th>نوع العملية</th>
              <th>المبلغ</th>
              <th>العضو المستهدف</th>
              <th>البيان والتفاصيل</th>
              <th>بواسطة</th>
            </tr>
          </thead>
          <tbody>
            ${logsHtml || '<tr><td colspan="7" style="text-align:center; padding: 20px; border: 1px solid #cbd5e1;">لا توجد حركات مسجلة بعد</td></tr>'}
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
    `);
    printWindow.document.close();
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-500 font-bold">جاري تحميل بيانات صندوق التوزيعات...</div>;
  }

  return (
    <div className="space-y-8">
      {/* 1. Header & Actions Bar (Classical Dark Navy matching Treasury) */}
      <div className="bg-[#1e293b] text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <PieChart className="w-6 h-6 text-amber-400" />
            صندوق التوزيعات والشرائح
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-1">
            إدارة الشريحة الأساسية وتقسيم الأرباح بنظام الأسهم
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {currentUser.role === 'admin' && (
            <>
              <button
                onClick={() => setShowBaseDepositModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <Coins className="w-4 h-4" />
                <span>إيداع بالأساسية</span>
              </button>

              <button
                onClick={() => setShowBaseTransferModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>تخصيص لشريحة</span>
              </button>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{showAddForm ? 'إلغاء' : 'إضافة شريحة'}</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>طباعة تقرير</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Classical Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Total Fund Balance */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">إجمالي الصندوق</span>
          <div className="text-2xl font-black text-[#1e293b] dir-ltr text-right">
            {formatCurrency(totalFund)}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-bold">
            شامل الأساسية والشرائح
          </p>
        </div>

        {/* Base Pool Balance (الشريحة الأساسية) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-1">الشريحة الأساسية</span>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">قبل التوزيع</span>
          </div>
          <div className="text-2xl font-black text-amber-900 dir-ltr text-right">
            {formatCurrency(basePool.balance || 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-bold">جاهز للتخصيص</p>
        </div>

        {/* Active Slices & Allocated Balance */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">الشرائح الموزعة</span>
          <div className="text-2xl font-black text-[#1e293b]">
            {slices.length} <span className="text-xs font-bold text-slate-500">شريحة ({formatCurrency(slicesTotalAmount)})</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-bold">{totalMembersCount} حصة للأعضاء</p>
        </div>

        {/* Audit Logs Count */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">سجل العمليات</span>
          <div className="text-2xl font-black text-[#1e293b]">
            {logs.length} <span className="text-xs font-bold text-slate-500">حركة معتمدة</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-bold">توثيق العمليات المالية</p>
        </div>
      </div>

      {/* 3. SECTION 1: الشريحة الأساسية */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-black text-[#0f172a] flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-600" />
              الشريحة الأساسية
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              رصيد غير موزع جاهز للتخصيص للشرائح
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {currentUser.role === 'admin' && (
              <>
                <button
                  onClick={() => setShowBaseDepositModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-xs cursor-pointer transition-colors"
                >
                  <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>إيداع</span>
                </button>

                <button
                  onClick={() => setShowBaseTransferModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded font-bold text-xs cursor-pointer transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                  <span>تخصيص لشريحة</span>
                </button>

                <button
                  onClick={() => setShowBaseWithdrawModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded font-bold text-xs cursor-pointer transition-colors"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>سحب</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-lg">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">الرصيد المتاح</span>
            <span className="text-2xl font-black text-amber-900 dir-ltr block mt-1">
              {formatCurrency(basePool.balance || 0)}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">الحالة</span>
            <span className="text-xs font-bold text-slate-800 block mt-1">
              {(basePool.balance || 0) > 0 ? 'جاهز للتوزيع' : 'الرصيد 0.00 د.ل'}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">آخر حركة</span>
            <span className="text-xs font-bold text-slate-600 block mt-1">
              {basePool.updatedAt || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Form: Add New Slice */}
      {showAddForm && (
        <form onSubmit={handleCreateSlice} className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-sm no-print">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-xs font-black text-[#0f172a] uppercase tracking-wider flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-amber-600" />
              <span>إضافة شريحة جديدة</span>
            </h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الشريحة *</label>
              <input
                type="text"
                required
                placeholder="اسم الشريحة أو المشروع"
                value={sliceName}
                onChange={(e) => setSliceName(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                المبلغ الابتدائي (د.ل)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                placeholder="0.00"
                value={sliceTotalAmount}
                onChange={(e) => setSliceTotalAmount(Number(e.target.value))}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الوصف</label>
              <input
                type="text"
                placeholder="وصف مختصر"
                value={sliceDescription}
                onChange={(e) => setSliceDescription(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
              />
            </div>
          </div>

          {/* Member Selection Section */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                الأعضاء المشاركون والأسهم *
              </label>
              <span className="text-[11px] text-slate-500 font-bold">
                إجمالي الأسهم: {selectedMembers.reduce((sum, m) => sum + (m.shares || 1), 0)} سهم
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  handleAddMemberToDraft(e.target.value);
                  e.target.value = '';
                }}
                className="p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none w-full sm:w-80"
              >
                <option value="">+ إضافة عضو للشريحة...</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.email ? `(${u.email})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedMembers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                {selectedMembers.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">{m.userName}</span>
                      {m.userEmail && <span className="text-[10px] text-slate-400 block">{m.userEmail}</span>}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 font-bold">الأسهم:</span>
                        <input
                          type="number"
                          min="1"
                          value={m.shares}
                          onChange={(e) => handleUpdateDraftShares(m.userId, Number(e.target.value))}
                          className="w-14 p-1 bg-white border border-slate-300 rounded text-center font-bold text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMemberFromDraft(m.userId)}
                        className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                        title="إزالة"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-bold rounded disabled:opacity-50 cursor-pointer"
            >
              حفظ الشريحة
            </button>
          </div>
        </form>
      )}

      {/* 5. SECTION 2: قائمة شرائح التوزيعات */}
      <div className="space-y-4 no-print">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <h2 className="text-base font-black text-[#0f172a] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#1e293b]" />
            <span>شرائح التوزيعات</span>
            <span className="text-xs text-slate-500 font-bold">({slices.length} شريحة)</span>
          </h2>
        </div>

        {slices.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-xs font-bold">
            لا توجد شرائح حالياً
          </div>
        ) : (
          <div className="space-y-4">
            {slices.map((slice) => {
              const memberCount = slice.members?.length || 0;
              const totalSharesInSlice = (slice.members || []).reduce((sum, m) => sum + (m.shares || 1), 0);

              return (
                <div
                  key={slice.id}
                  className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4"
                >
                  {/* Slice Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-[#0f172a]">{slice.name}</h3>
                        {slice.createdDate && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                            {slice.createdDate}
                          </span>
                        )}
                      </div>
                      {slice.description && (
                        <p className="text-xs text-slate-600 mt-1 font-medium">
                          {slice.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left sm:text-right pl-2 sm:pl-0 sm:border-none border-l border-slate-200">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">إجمالي الشريحة</span>
                        <span className="text-lg font-black text-[#1e293b] dir-ltr block">
                          {formatCurrency(slice.totalAmount)}
                        </span>
                      </div>

                      {currentUser.role === 'admin' && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => {
                              setRechargeSlice(slice);
                              setRechargeAmount(0);
                              setRechargeNote('');
                              setRechargeSource('external');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-xs cursor-pointer transition-colors"
                          >
                            <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>شحن</span>
                          </button>

                          <button
                            onClick={() => handleOpenEditSlice(slice)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded font-bold text-xs cursor-pointer transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                            <span>تعديل</span>
                          </button>

                          <button
                            onClick={() => handleDeleteSlice(slice.id, slice.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Members Grid */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-black text-slate-700 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        الأعضاء والأسهم ({memberCount} أعضاء - {totalSharesInSlice} سهم):
                      </span>
                    </div>

                    {memberCount === 0 ? (
                      <p className="text-xs text-slate-400 font-medium">لا يوجد أعضاء</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {slice.members.map((m, idx) => {
                          const activeMemberName = getLatestUserName(m.userId, m.userEmail, m.userName);
                          const sharePct = totalSharesInSlice > 0 ? ((m.shares || 1) / totalSharesInSlice) * 100 : 0;

                          return (
                            <div
                              key={idx}
                              className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2 hover:bg-slate-100/70 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <span className="font-black text-[#0f172a] block">{activeMemberName}</span>
                                  <span className="text-[10px] text-slate-500 font-bold block">
                                    {m.shares} {m.shares === 1 ? 'سهم' : 'أسهم'} ({sharePct.toFixed(1)}%)
                                  </span>
                                </div>
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-black">
                                  #{idx + 1}
                                </span>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                                <div>
                                  <span className="text-[9px] text-slate-500 font-bold uppercase block">الرصيد</span>
                                  <span className="font-black text-[#1e293b] dir-ltr text-sm block">
                                    {formatCurrency(m.balance)}
                                  </span>
                                </div>

                                {currentUser.role === 'admin' && m.balance > 0 && (
                                  <button
                                    onClick={() => {
                                      setWithdrawModal({ slice, member: m });
                                      setWithdrawAmount(0);
                                      setWithdrawNote('');
                                    }}
                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <ArrowUpCircle className="w-3 h-3 text-rose-600" />
                                    <span>سحب</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. SECTION 3: Financial Transaction Audit Trail */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#1e293b]" />
            <div>
              <h2 className="text-base font-black text-[#0f172a]">سجل العمليات والتدقيق</h2>
              <p className="text-xs text-slate-500 font-medium">سجل الحركات المالية المعتمد</p>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-bold">{filteredLogs.length} حركة</span>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث في السجل..."
              value={logSearchQuery}
              onChange={(e) => {
                setLogSearchQuery(e.target.value);
                setLogsPage(1);
              }}
              className="w-full pr-9 pl-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={logFilterType}
              onChange={(e) => {
                setLogFilterType(e.target.value);
                setLogsPage(1);
              }}
              className="p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none w-full sm:w-48"
            >
              <option value="all">جميع العمليات</option>
              <option value="recharge">الشحن والتمويل</option>
              <option value="withdraw">السحب</option>
              <option value="base_pool">الأساسية</option>
              <option value="slice_ops">الشرائح</option>
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 font-medium">لا توجد حركات مسجلة</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="bg-[#1e293b] text-white font-bold">
                  <th className="p-2.5">التاريخ</th>
                  <th className="p-2.5">الشريحة</th>
                  <th className="p-2.5">النوع</th>
                  <th className="p-2.5">المبلغ</th>
                  <th className="p-2.5">العضو</th>
                  <th className="p-2.5">البيان</th>
                  <th className="p-2.5">بواسطة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-600 text-[11px] whitespace-nowrap">{log.date}</td>
                    <td className="p-2.5 font-black text-slate-900">{log.sliceName}</td>
                    <td className="p-2.5 font-bold whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          log.type === 'RECHARGE_SLICE' || log.type === 'BASE_POOL_DEPOSIT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.type === 'WITHDRAW_MEMBER' || log.type === 'BASE_POOL_WITHDRAW'
                            ? 'bg-rose-100 text-rose-800'
                            : log.type === 'BASE_POOL_TRANSFER'
                            ? 'bg-blue-100 text-blue-800'
                            : log.type === 'UPDATE_SHARES'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {log.typeNameAr}
                      </span>
                    </td>
                    <td className="p-2.5 font-black text-slate-900 dir-ltr whitespace-nowrap">
                      {log.amount > 0 ? formatCurrency(log.amount) : '—'}
                    </td>
                    <td className="p-2.5 font-bold text-slate-700">{log.memberName || '—'}</td>
                    <td className="p-2.5 text-slate-600 font-medium">{log.details}</td>
                    <td className="p-2.5 text-slate-500 font-bold whitespace-nowrap">{log.performedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalLogPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
                <span className="text-slate-500 font-bold">
                  الصفحة {logsPage} من {totalLogPages}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                    disabled={logsPage === 1}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setLogsPage((p) => Math.min(totalLogPages, p + 1))}
                    disabled={logsPage === totalLogPages}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ----------------- MODALS ----------------- */}

      {/* Modal: Base Pool Deposit */}
      {showBaseDepositModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl">
          <form
            onSubmit={handleBasePoolDeposit}
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-600" />
                <span>إيداع في الشريحة الأساسية</span>
              </h3>
              <button type="button" onClick={() => setShowBaseDepositModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (د.ل) *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                placeholder="0.00"
                value={baseDepositAmount || ''}
                onChange={(e) => setBaseDepositAmount(Number(e.target.value))}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">البيان</label>
              <input
                type="text"
                placeholder="بيان الإيداع"
                value={baseDepositNote}
                onChange={(e) => setBaseDepositNote(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBaseDepositModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded shadow cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <Coins className="w-4 h-4" />
                <span>تأكيد الإيداع</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Base Pool Transfer to Slice */}
      {showBaseTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl">
          <form
            onSubmit={handleBasePoolTransfer}
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                <span>تخصيص لشريحة</span>
              </h3>
              <button type="button" onClick={() => setShowBaseTransferModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs flex justify-between items-center">
              <span className="text-slate-600 font-bold">الرصيد المتاح:</span>
              <span className="font-black text-amber-800 text-sm dir-ltr">{formatCurrency(basePool.balance || 0)}</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الشريحة المستهدفة *</label>
              <select
                required
                value={transferTargetSliceId}
                onChange={(e) => setTransferTargetSliceId(e.target.value)}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-blue-600 focus:outline-none"
              >
                <option value="">-- اختر الشريحة --</option>
                {slices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({formatCurrency(s.totalAmount)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (د.ل) *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                max={basePool.balance || 0}
                required
                placeholder="0.00"
                value={transferAmount || ''}
                onChange={(e) => setTransferAmount(Number(e.target.value))}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظة</label>
              <input
                type="text"
                placeholder="بيان اختياري"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBaseTransferModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting || (basePool.balance || 0) <= 0}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>تأكيد التخصيص</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Base Pool Withdraw */}
      {showBaseWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl">
          <form
            onSubmit={handleBasePoolWithdraw}
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5 text-rose-600" />
                <span>سحب من الشريحة الأساسية</span>
              </h3>
              <button type="button" onClick={() => setShowBaseWithdrawModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs flex justify-between items-center">
              <span className="text-slate-600 font-bold">الرصيد المتاح:</span>
              <span className="font-black text-amber-800 text-sm dir-ltr">{formatCurrency(basePool.balance || 0)}</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (د.ل) *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                max={basePool.balance || 0}
                required
                placeholder="0.00"
                value={baseWithdrawAmount || ''}
                onChange={(e) => setBaseWithdrawAmount(Number(e.target.value))}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-rose-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">السبب / البيان</label>
              <input
                type="text"
                placeholder="بيان السحب"
                value={baseWithdrawNote}
                onChange={(e) => setBaseWithdrawNote(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-rose-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBaseWithdrawModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting || (basePool.balance || 0) <= 0}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>تأكيد السحب</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Slice & Shares */}
      {editingSlice && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl">
          <form
            onSubmit={handleSaveEditedSlice}
            className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="font-black text-sm text-slate-900">تعديل الشريحة والأسهم</h3>
                  <p className="text-[11px] text-slate-500 font-bold">{editingSlice.name}</p>
                </div>
              </div>
              <button type="button" onClick={() => setEditingSlice(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الشريحة</label>
                <input
                  type="text"
                  required
                  value={editSliceName}
                  onChange={(e) => setEditSliceName(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الوصف</label>
                <input
                  type="text"
                  value={editSliceDescription}
                  onChange={(e) => setEditSliceDescription(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none"
                />
              </div>
            </div>

            {/* Recalculation Mode */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700">معالجة الأرصدة الحالية:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-300 cursor-pointer font-bold text-slate-800">
                  <input
                    type="radio"
                    name="recalcMode"
                    value="recalculate"
                    checked={editRecalculateMode === 'recalculate'}
                    onChange={() => setEditRecalculateMode('recalculate')}
                  />
                  <span>إعادة تقسيم الرصيد الحالي</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-300 cursor-pointer font-bold text-slate-800">
                  <input
                    type="radio"
                    name="recalcMode"
                    value="keep_balances"
                    checked={editRecalculateMode === 'keep_balances'}
                    onChange={() => setEditRecalculateMode('keep_balances')}
                  />
                  <span>الاحتفاظ بالأرصدة الحالية</span>
                </label>
              </div>
            </div>

            {/* Members & Shares List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                  الأعضاء والأسهم:
                </label>
                <span className="text-xs text-slate-500 font-bold">
                  إجمالي الأسهم: {editMembers.reduce((sum, m) => sum + (m.shares || 1), 0)} سهم
                </span>
              </div>

              {/* Add more members select */}
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    handleAddMemberToEdit(e.target.value);
                    e.target.value = '';
                  }}
                  className="p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#1e293b] focus:outline-none w-full sm:w-72"
                >
                  <option value="">+ إضافة عضو للشريحة...</option>
                  {allUsers
                    .filter((u) => !editMembers.some((m) => m.userId === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.email ? `(${u.email})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Members table/grid */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {editMembers.map((m) => {
                  const activeMemberName = getLatestUserName(m.userId, m.userEmail, m.userName);
                  return (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 block">{activeMemberName}</span>
                        <span className="text-[10px] text-slate-500 block">الرصيد: {formatCurrency(m.balance || 0)}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-600 font-bold">الأسهم:</span>
                          <input
                            type="number"
                            min="1"
                            value={m.shares}
                            onChange={(e) => handleUpdateEditShares(m.userId, Number(e.target.value))}
                            className="w-16 p-1.5 bg-white border border-slate-300 rounded text-center font-bold text-xs"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveMemberFromEdit(m.userId)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                          title="إزالة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingSlice(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#1e293b] hover:bg-slate-800 text-amber-400 text-xs font-bold rounded-lg shadow cursor-pointer disabled:opacity-50"
              >
                حفظ التعديلات
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Recharge Slice */}
      {rechargeSlice && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl">
          <form
            onSubmit={handleExecuteRecharge}
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
                <span>شحن شريحة: {rechargeSlice.name}</span>
              </h3>
              <button type="button" onClick={() => setRechargeSlice(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Source Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">مصدر التمويل</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRechargeSource('external')}
                  className={`p-2 rounded border font-bold text-center cursor-pointer transition-colors ${
                    rechargeSource === 'external' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                >
                  إيداع خارجي
                </button>
                <button
                  type="button"
                  onClick={() => setRechargeSource('base_pool')}
                  className={`p-2 rounded border font-bold text-center cursor-pointer transition-colors ${
                    rechargeSource === 'base_pool' ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                >
                  من الأساسية ({formatCurrency(basePool.balance || 0)})
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (د.ل) *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                max={rechargeSource === 'base_pool' ? basePool.balance || 0 : undefined}
                required
                placeholder="0.00"
                value={rechargeAmount || ''}
                onChange={(e) => setRechargeAmount(Number(e.target.value))}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">البيان</label>
              <input
                type="text"
                placeholder="بيان اختياري"
                value={rechargeNote}
                onChange={(e) => setRechargeNote(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRechargeSlice(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting || (rechargeSource === 'base_pool' && (basePool.balance || 0) <= 0)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>تأكيد الشحن</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Withdraw Member Balance */}
      {withdrawModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl">
          <form
            onSubmit={handleExecuteWithdrawal}
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5 text-rose-600" />
                <span>سحب أرباح: {getLatestUserName(withdrawModal.member.userId, withdrawModal.member.userEmail, withdrawModal.member.userName)}</span>
              </h3>
              <button type="button" onClick={() => setWithdrawModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-slate-700">الشريحة: <span className="text-slate-900 font-black">{withdrawModal.slice.name}</span></p>
              <p className="font-bold text-slate-700">الرصيد المتاح: <span className="text-emerald-700 font-black dir-ltr">{formatCurrency(withdrawModal.member.balance)}</span></p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (د.ل) *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                max={withdrawModal.member.balance}
                required
                placeholder="0.00"
                value={withdrawAmount || ''}
                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-rose-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">البيان</label>
              <input
                type="text"
                placeholder="طريقة التسليم أو البيان"
                value={withdrawNote}
                onChange={(e) => setWithdrawNote(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-rose-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWithdrawModal(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>تأكيد السحب</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: PDF / Printable Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#1e293b] text-amber-400 rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">تقرير وتوثيق صندوق التوزيعات المالي</h2>
                  <p className="text-xs text-slate-500 font-bold">استوديو أرتياتك - المعاملات والشرائح المعتمدة</p>
                </div>
              </div>

              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Report Content Preview */}
            <div className="space-y-4 border border-slate-200 p-4 rounded-xl bg-slate-50/50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">إجمالي الصندوق</span>
                  <span className="text-lg font-black text-slate-900 dir-ltr block">{formatCurrency(totalFund)}</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-amber-700 block">الوعاء الأساسي</span>
                  <span className="text-lg font-black text-amber-800 dir-ltr block">{formatCurrency(basePool.balance || 0)}</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">عدد الشرائح</span>
                  <span className="text-lg font-black text-slate-900">{slices.length} شريحة</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">إجمالي العمليات الموثقة</span>
                  <span className="text-lg font-black text-slate-900">{logs.length} حركة</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-800">بيانات الشرائح والأسهم:</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#1e293b] text-white font-bold">
                      <tr>
                        <th className="p-2">اسم الشريحة</th>
                        <th className="p-2">الإجمالي</th>
                        <th className="p-2">الأعضاء والأسهم والأرصدة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {slices.map((s) => (
                        <tr key={s.id}>
                          <td className="p-2 font-black text-slate-900">{s.name}</td>
                          <td className="p-2 font-black text-[#1e293b] dir-ltr">{formatCurrency(s.totalAmount)}</td>
                          <td className="p-2 text-slate-700">
                            {(s.members || [])
                              .map((m) => {
                                const name = getLatestUserName(m.userId, m.userEmail, m.userName);
                                return `${name} (${m.shares} أسهم: ${formatCurrency(m.balance)})`;
                              })
                              .join(' • ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                onClick={async () => {
                  const plainText =
                    `تقرير صندوق التوزيعات - أرتياتك\n` +
                    `إجمالي الصندوق العام: ${formatCurrency(totalFund)}\n` +
                    `الشريحة الأساسية (الوعاء العام): ${formatCurrency(basePool.balance || 0)}\n\nالشرائح:\n` +
                    slices.map((s) => `${s.name}: ${formatCurrency(s.totalAmount)}`).join('\n');
                  await navigator.clipboard.writeText(plainText);
                  setCopiedReportText(true);
                  showToast('تم نسخ التقرير للحافظة ✓', 'success');
                  setTimeout(() => setCopiedReportText(false), 3000);
                }}
                className={`px-4 py-2 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  copiedReportText ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedReportText ? 'تم النسخ ✓' : 'نسخ النص'}</span>
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
                  <span>طباعة / حفظ كـ PDF المعتمد</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmSlice && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-black text-sm text-slate-900">تأكيد حذف الشريحة</h3>
            <p className="text-xs text-slate-600 font-bold leading-relaxed">
              هل أنت متأكد من رغبتك في حذف شريحة التوزيعات "{deleteConfirmSlice.name}"؟ سيتم توثيق هذه العملية في سجل التدقيق المالي.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmSlice(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeDeleteSlice}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow cursor-pointer active:scale-95"
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
