import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, set, push, get, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDLYifYJstznc00o_3WcvM_PqtGeTZLCGo",
  authDomain: "artiatech-management.firebaseapp.com",
  databaseURL: "https://artiatech-management-default-rtdb.firebaseio.com",
  projectId: "artiatech-management",
  storageBucket: "artiatech-management.firebasestorage.app",
  messagingSenderId: "212665480212",
  appId: "1:212665480212:web:9df26e2d5a081d5dc26301",
  measurementId: "G-QG9JZGREK0"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Secondary Firebase app instance for creating new users without signing out the active Admin session
const secondaryApp = getApps().find(a => a.name === "SecondaryApp") || initializeApp(firebaseConfig, "SecondaryApp");
export const secondaryAuth = getAuth(secondaryApp);

export const db = getDatabase(app);

// Helper to format currency: e.g. "1,333 د.ل"
export function formatCurrency(amount: number, currency: string = 'د.ل'): string {
  const formatted = new Intl.NumberFormat('ar-LY', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(amount || 0);
  return `${formatted} ${currency}`;
}

// Helper to format date: e.g. "01/08/2026"
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Helper to format current timestamp string in YYYY-MM-DD HH:mm:ss
export function getCurrentTimestampStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Helper to generate clear, readable IDs instead of random firebase hashes
export function generateReadableId(prefix: string, nameOrTitle?: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900 + 100);

  let namePart = '';
  if (nameOrTitle) {
    const clean = nameOrTitle
      .trim()
      .replace(/[\s\/\-\\._,]+/g, '_')
      .replace(/[^\u0600-\u06FF\w]/g, '')
      .substring(0, 18);
    if (clean) namePart = `_${clean}`;
  }

  return `${prefix}_${yyyy}${mm}${dd}_${hh}${min}${ss}_${rand}${namePart}`;
}

// Activity Logging helper
export async function logActivity(
  userId: string,
  userName: string,
  userRole: string,
  action: string,
  details: string
) {
  try {
    const timestamp = getCurrentTimestampStr();
    const newLogId = generateReadableId('log', action);
    await set(ref(db, `activity_logs/${newLogId}`), {
      id: newLogId,
      userId,
      userName,
      userRole,
      action,
      details,
      timestamp,
      createdAt: Date.now()
    });
  } catch (err) {
    console.error("Error logging activity:", err);
  }
}

export interface RepairNodeSummary {
  nodeName: string;
  nodeKey: string;
  count: number;
  renamed: number;
}

export interface RepairResult {
  fixedCount: number;
  renamedCount: number;
  defaultFilledCount: number;
  usersUntouchedCount: number;
  nodeSummaries: RepairNodeSummary[];
  details: string;
}

// Database Repair & Cleanup Tool (EXCLUDING 'users')
export async function repairDatabase(): Promise<RepairResult> {
  const dbRef = ref(db);
  const snapshot = await get(dbRef);
  if (!snapshot.exists()) {
    return {
      fixedCount: 0,
      renamedCount: 0,
      defaultFilledCount: 0,
      usersUntouchedCount: 0,
      nodeSummaries: [],
      details: "قاعدة البيانات فارغة"
    };
  }

  const rootData = snapshot.val();
  let fixedCount = 0;
  let renamedCount = 0;
  let defaultFilledCount = 0;
  const nowStr = new Date().toISOString().split('T')[0];

  const usersCount = rootData['users'] && typeof rootData['users'] === 'object'
    ? Object.keys(rootData['users']).length
    : 0;

  const isRandomKey = (key: string) => {
    return key.startsWith('-') || key.length > 20 || !key.includes('_');
  };

  const nodesToRepair: Array<{
    nodeKey: string;
    nodeName: string;
    prefix: string;
    titleField: string;
    fixItem: (item: any) => { item: any; hadMissing: boolean };
  }> = [
    {
      nodeKey: 'treasury_transactions',
      nodeName: 'الحركات والعمليات المالية',
      prefix: 'tx',
      titleField: 'description',
      fixItem: (item) => {
        let hadMissing = false;
        if (typeof item.amount !== 'number' || isNaN(item.amount)) hadMissing = true;
        if (!item.type) hadMissing = true;
        if (!item.date) hadMissing = true;
        if (!item.description) hadMissing = true;
        return {
          item: {
            ...item,
            amount: typeof item.amount === 'number' && !isNaN(item.amount) ? item.amount : 0,
            type: item.type || 'expense',
            date: item.date || nowStr,
            description: item.description || 'عملية مالية',
            locationId: item.locationId || 'default',
            locationName: item.locationName || 'الخزينة الرئيسية',
            sources: Array.isArray(item.sources) ? item.sources : [],
          },
          hadMissing
        };
      },
    },
    {
      nodeKey: 'treasury_locations',
      nodeName: 'خزائن الحسابات والأرصدة',
      prefix: 'loc',
      titleField: 'name',
      fixItem: (item) => {
        let hadMissing = false;
        if (!item.name) hadMissing = true;
        if (typeof item.balance !== 'number' || isNaN(item.balance)) hadMissing = true;
        return {
          item: {
            ...item,
            name: item.name || 'خزانة',
            type: item.type || 'safe',
            balance: typeof item.balance === 'number' && !isNaN(item.balance) ? item.balance : 0,
          },
          hadMissing
        };
      },
    },
    {
      nodeKey: 'assets',
      nodeName: 'سجل الأصول والممتلكات',
      prefix: 'asset',
      titleField: 'name',
      fixItem: (item) => {
        let hadMissing = false;
        if (!item.name) hadMissing = true;
        if (typeof item.value !== 'number' || isNaN(item.value)) hadMissing = true;
        return {
          item: {
            ...item,
            name: item.name || 'أصل',
            value: typeof item.value === 'number' && !isNaN(item.value) ? item.value : 0,
            count: typeof item.count === 'number' && !isNaN(item.count) ? item.count : 1,
            locationId: item.locationId || 'default',
            locationName: item.locationName || 'الخزينة الرئيسية',
          },
          hadMissing
        };
      },
    },
    {
      nodeKey: 'project_booklets',
      nodeName: 'كتيبات ومشاريع الاستوديو',
      prefix: 'booklet',
      titleField: 'name',
      fixItem: (item) => {
        let hadMissing = false;
        if (!item.name) hadMissing = true;
        if (typeof item.budget !== 'number' || isNaN(item.budget)) hadMissing = true;
        return {
          item: {
            ...item,
            name: item.name || 'كتيب مشروع',
            budget: typeof item.budget === 'number' && !isNaN(item.budget) ? item.budget : 0,
            expectedReturn: typeof item.expectedReturn === 'number' && !isNaN(item.expectedReturn) ? item.expectedReturn : 0,
            actualExpense: typeof item.actualExpense === 'number' && !isNaN(item.actualExpense) ? item.actualExpense : 0,
            actualIncome: typeof item.actualIncome === 'number' && !isNaN(item.actualIncome) ? item.actualIncome : 0,
            status: item.status || 'active',
            content: item.content || '<h1>كتيب المشروع</h1>',
            teamMembers: Array.isArray(item.teamMembers) ? item.teamMembers : [],
          },
          hadMissing
        };
      },
    },
    {
      nodeKey: 'plans',
      nodeName: 'الخطط وخارطة الطريق',
      prefix: 'plan',
      titleField: 'title',
      fixItem: (item) => {
        let hadMissing = false;
        if (!item.title) hadMissing = true;
        if (typeof item.progress !== 'number' || isNaN(item.progress)) hadMissing = true;
        return {
          item: {
            ...item,
            title: item.title || 'خطة عمل',
            progress: typeof item.progress === 'number' && !isNaN(item.progress) ? item.progress : 0,
            status: item.status || 'in_progress',
            steps: Array.isArray(item.steps) ? item.steps.map((s: any) => ({
              ...s,
              completed: Boolean(s.completed),
              cost: typeof s.cost === 'number' && !isNaN(s.cost) ? s.cost : 0
            })) : [],
          },
          hadMissing
        };
      },
    },
    {
      nodeKey: 'distribution_fund',
      nodeName: 'صندوق الشرائح والتوزيعات',
      prefix: 'slice',
      titleField: 'name',
      fixItem: (item) => {
        let hadMissing = false;
        if (!item.name) hadMissing = true;
        if (typeof item.totalPool !== 'number' || isNaN(item.totalPool)) hadMissing = true;
        return {
          item: {
            ...item,
            name: item.name || 'شريحة توزيعات',
            totalPool: typeof item.totalPool === 'number' && !isNaN(item.totalPool) ? item.totalPool : 0,
            members: Array.isArray(item.members) ? item.members.map((m: any) => ({
              ...m,
              shares: typeof m.shares === 'number' && !isNaN(m.shares) ? m.shares : 0,
              balance: typeof m.balance === 'number' && !isNaN(m.balance) ? m.balance : 0,
            })) : [],
          },
          hadMissing
        };
      },
    },
    {
      nodeKey: 'announcements',
      nodeName: 'الإعلانات الإدارية',
      prefix: 'ann',
      titleField: 'title',
      fixItem: (item) => {
        let hadMissing = false;
        if (!item.title) hadMissing = true;
        return {
          item: {
            ...item,
            title: item.title || 'إعلان إداري',
            content: item.content || 'تفاصيل الإعلان...',
            date: item.date || nowStr,
            authorName: item.authorName || 'الإدارة',
          },
          hadMissing
        };
      },
    },
    {
      nodeKey: 'activity_logs',
      nodeName: 'سجل النشاطات والحركات',
      prefix: 'log',
      titleField: 'action',
      fixItem: (item) => {
        let hadMissing = false;
        if (!item.action) hadMissing = true;
        return {
          item: {
            ...item,
            action: item.action || 'إجراء',
            details: item.details || 'تفاصيل الإجراء',
            userName: item.userName || 'عضو',
            timestamp: item.timestamp || getCurrentTimestampStr(),
          },
          hadMissing
        };
      },
    },
    {
      nodeKey: 'unfreeze_requests',
      nodeName: 'طلبات فك التجميد',
      prefix: 'req',
      titleField: 'userName',
      fixItem: (item) => {
        let hadMissing = false;
        if (!item.userName) hadMissing = true;
        return {
          item: {
            ...item,
            note: item.note || 'طلب فك التجميد',
            status: item.status || 'pending',
            requestedAt: item.requestedAt || new Date().toISOString(),
          },
          hadMissing
        };
      },
    },
  ];

  const nodeSummaries: RepairNodeSummary[] = [];

  for (const config of nodesToRepair) {
    const nodeVal = rootData[config.nodeKey];
    if (!nodeVal || typeof nodeVal !== 'object') {
      nodeSummaries.push({
        nodeName: config.nodeName,
        nodeKey: config.nodeKey,
        count: 0,
        renamed: 0,
      });
      continue;
    }

    let nodeCount = 0;
    let nodeRenamed = 0;

    for (const key of Object.keys(nodeVal)) {
      const originalItem = nodeVal[key];
      if (!originalItem || typeof originalItem !== 'object') continue;

      const { item: fixedItem, hadMissing } = config.fixItem(originalItem);
      if (hadMissing) defaultFilledCount++;

      const needsKeyRename = isRandomKey(key);

      let newId = key;
      if (needsKeyRename) {
        const titleText = originalItem[config.titleField] || '';
        newId = generateReadableId(config.prefix, titleText);
        renamedCount++;
        nodeRenamed++;
      }

      fixedItem.id = newId;

      await set(ref(db, `${config.nodeKey}/${newId}`), fixedItem);

      if (needsKeyRename && newId !== key) {
        await remove(ref(db, `${config.nodeKey}/${key}`));
      }

      fixedCount++;
      nodeCount++;
    }

    nodeSummaries.push({
      nodeName: config.nodeName,
      nodeKey: config.nodeKey,
      count: nodeCount,
      renamed: nodeRenamed,
    });
  }

  return {
    fixedCount,
    renamedCount,
    defaultFilledCount,
    usersUntouchedCount: usersCount,
    nodeSummaries,
    details: `تم فحص وإصلاح ${fixedCount} سجلاً بنجاح! تم استبدال ${renamedCount} معرفاً بأسماء واضحة، وتصحيح الحقول الناقصة بقيم افتراضية.`
  };
}
