export type UserRole = 'admin' | 'member';
export type UserStatus = 'main' | 'participant' | 'frozen';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  joinDate: string; // YYYY-MM-DD
  sliceBalances?: Record<string, number>;
}

export interface TreasuryLocation {
  id: string;
  name: string;
  description: string;
  balance: number;
  currency: string; // 'د.ل' | 'USD' | etc.
  responsibleBy: string;
}

export interface AssetItem {
  id: string;
  name: string;
  category?: string;
  location: string;
  acquisitionDate: string;
  purchaseValue?: string; // number string or "مجاني" / "مساهمة"
  notes?: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface TreasuryTransaction {
  id: string;
  date: string; // YYYY-MM-DD HH:mm
  amount: number;
  type: TransactionType;
  locationId: string;
  locationName?: string;
  toLocationId?: string;
  toLocationName?: string;
  category?: string;
  recipient?: string;
  description: string;
  sources?: string[];
  createdBy: string;
}

export interface SliceMember {
  userId: string;
  userName: string;
  shares: number;
  balance: number;
}

export interface DistributionFundSlice {
  id: string;
  name: string;
  description: string;
  totalAmount: number;
  createdDate: string;
  members: SliceMember[];
}

export type BookletStatus = 'active' | 'archived' | 'under_study' | 'under_revision';
export type BookletType = 'extended' | 'non_extended';

export interface BookletTeamMember {
  userId: string;
  name: string;
  shares: number;
}

export interface ProjectBooklet {
  id: string;
  name: string;
  status: BookletStatus;
  type: BookletType;
  content: string;
  startDate: string;
  teamMembers: BookletTeamMember[];
  createdBy: string;
  lastModified: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdBy: string;
  createdDate: string; // YYYY-MM-DD HH:mm
}

export type PlanStatus = 'planned' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';

export interface PlanItem {
  id: string;
  title: string;
  description: string;
  status: PlanStatus;
  deadline: string; // YYYY-MM-DD
  responsible: string;
  createdBy: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  details: string;
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  createdAt?: number | string;
}

export type TabType = 
  | 'dashboard' 
  | 'profile' 
  | 'treasury' 
  | 'distribution' 
  | 'booklets' 
  | 'announcements' 
  | 'plans' 
  | 'activity' 
  | 'members'
  | 'bylaws';
