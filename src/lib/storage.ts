import { AppUser, RoomExpense, PersonalExpense, PurseTransaction, Message, Notification } from './types';

const get = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
};

const set = <T>(key: string, value: T) => localStorage.setItem(key, JSON.stringify(value));

export const storage = {
  // Users
  getUsers: (): AppUser[] => get('rem_users', []),
  setUsers: (u: AppUser[]) => set('rem_users', u),
  
  // Current user
  getCurrentUser: (): AppUser | null => get('rem_current_user', null),
  setCurrentUser: (u: AppUser | null) => set('rem_current_user', u),

  // Room Expenses
  getRoomExpenses: (): RoomExpense[] => get('rem_room_expenses', []),
  setRoomExpenses: (e: RoomExpense[]) => set('rem_room_expenses', e),

  // Personal Expenses
  getPersonalExpenses: (): PersonalExpense[] => get('rem_personal_expenses', []),
  setPersonalExpenses: (e: PersonalExpense[]) => set('rem_personal_expenses', e),

  // Purse
  getPurseTransactions: (): PurseTransaction[] => get('rem_purse', []),
  setPurseTransactions: (t: PurseTransaction[]) => set('rem_purse', t),

  // Messages
  getMessages: (): Message[] => get('rem_messages', []),
  setMessages: (m: Message[]) => set('rem_messages', m),

  // Notifications
  getNotifications: (): Notification[] => get('rem_notifications', []),
  setNotifications: (n: Notification[]) => set('rem_notifications', n),

  // Settings
  getSettings: () => get('rem_settings', { currency: 'INR', darkMode: false }),
  setSettings: (s: any) => set('rem_settings', s),
};
