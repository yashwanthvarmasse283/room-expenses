export type UserRole = 'admin' | 'user';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  adminId?: string;
  approved: boolean;
  createdAt: string;
}

export interface RoomExpense {
  id: string;
  date: string;
  category: 'Food' | 'Rent' | 'Electricity' | 'Internet' | 'Misc';
  amount: number;
  description: string;
  paidBy: string;
  splitAmong: string[];
  imageUrl?: string;
  createdAt: string;
}

export interface PersonalExpense {
  id: string;
  userId: string;
  date: string;
  category: 'Travel' | 'Shopping' | 'Food' | 'Health' | 'Entertainment' | 'Others';
  amount: number;
  description: string;
  createdAt: string;
}

export interface PurseTransaction {
  id: string;
  type: 'inflow' | 'outflow';
  amount: number;
  date: string;
  description: string;
  createdAt: string;
}

export interface Message {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toAdminId: string;
  content: string;
  read: boolean;
  reply?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type ExpenseCategory = RoomExpense['category'];
export type PersonalCategory = PersonalExpense['category'];
