// Expense Types
export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  payerId?: string;
  imageId?: string;
  splitType: 'equal' | 'full' | 'custom';
  splitWith?: string[];
  splitDetails?: Record<string, number>;
  recurring?: 'weekly' | 'monthly' | 'yearly' | '';
  tags?: string;
  notes?: string;
  syncId: string;
  syncStatus: 'pending' | 'synced';
  yearMonth: string; // YYYY-MM for indexing
  createdAt: number;
  updatedAt?: number;
}

// Person Types
export interface Person {
  id: string;
  name: string;
  syncId: string;
  createdAt: number;
  updatedAt?: number;
  claimedBy?: string; // deviceId that claimed this person as their identity
}

// Account Types
export interface Account {
  id: string;
  name: string;
  mode: 'single' | 'shared';
  currency: string;
  createdAt: number;
  /** For shared: deviceId of the peer others connect to (creator). Set when creating or when joining from QR/link. */
  hostDeviceId?: string;
}

// Image Types
export interface ImageRecord {
  id: string;
  data: Blob;
  thumbnail: Blob;
  syncId: string;
  createdAt: number;
}

// Recurring Expense Types
export interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'yearly';
  nextDue: string;
  payerId?: string;
  active: boolean;
  createdAt: number;
  lastProcessed?: string;
}

// Category Budget Types
export interface CategoryBudget {
  category: string;
  amount: number;
  updatedAt: number;
}

// Payment/Settlement Types
export interface Payment {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  date: string;
  syncId: string;
  createdAt: number;
}

// Template Types
export interface Template {
  id: string;
  description: string;
  amount?: number;
  payerId?: string;
  useCount: number;
  createdAt: number;
}

// Split Preset Types
export interface SplitPreset {
  id: string;
  name: string;
  splits: Record<string, number>;
  createdAt: number;
}

// Tombstone for sync deletions
export interface Tombstone {
  syncId: string;
  type: 'expense' | 'person' | 'image' | 'payment';
  deletedAt: number;
}

// Sync Types
export interface SyncMessage {
  type: 'sync_request' | 'sync_response' | 'sync_rejected';
  accountId?: string;
  accountName?: string;
  data?: SyncData;
  reason?: string;
}

export interface SyncData {
  expenses: Expense[];
  people: Person[];
  images: { id: string; syncId: string; data?: string; thumbnail?: string }[];
  tombstones: Tombstone[];
  payments: Payment[];
}

// Settings Types
export interface Settings {
  currency: string;
  monthlyBudget: number;
  darkMode: boolean;
  categoryBudgets: Record<string, number>;
}

// Balance Types
export interface Balance {
  personId: string;
  personName: string;
  amount: number; // positive = owed to them, negative = they owe
}

export interface Settlement {
  from: Person;
  to: Person;
  amount: number;
}

// Category Icons
export const CATEGORY_ICONS: Record<string, string[]> = {
  '☕': ['coffee', 'cafe', 'starbucks', 'tim hortons', 'latte', 'espresso', 'tea'],
  '🍔': ['food', 'lunch', 'dinner', 'breakfast', 'meal', 'restaurant', 'pizza', 'burger', 'snack', 'eat', 'bar', 'pub'],
  '🍺': ['drink', 'drinks', 'beer', 'wine', 'alcohol', 'cocktail'],
  '🛒': ['grocery', 'groceries', 'supermarket', 'market', 'shopping', 'store', 'walmart', 'costco', 'target'],
  '🚗': ['gas', 'fuel', 'petrol', 'uber', 'lyft', 'taxi', 'car', 'parking', 'toll', 'transport', 'bus', 'train', 'metro', 'subway'],
  '✈️': ['flight', 'airline', 'airport', 'travel', 'trip', 'hotel', 'airbnb', 'booking', 'vacation'],
  '🏠': ['rent', 'mortgage', 'utilities', 'electric', 'electricity', 'water', 'internet', 'wifi', 'cable', 'home'],
  '📱': ['phone', 'mobile', 'cell', 'data', 'subscription', 'netflix', 'spotify', 'apple', 'google'],
  '🏥': ['doctor', 'hospital', 'medical', 'medicine', 'pharmacy', 'health', 'dental', 'dentist', 'insurance'],
  '🎬': ['movie', 'cinema', 'theater', 'concert', 'show', 'ticket', 'entertainment', 'game', 'sport'],
  '👕': ['clothes', 'clothing', 'shoes', 'fashion', 'dress', 'shirt', 'pants', 'jacket'],
  '🎁': ['gift', 'present', 'birthday', 'christmas', 'holiday'],
  '📚': ['book', 'books', 'education', 'course', 'class', 'school', 'tuition'],
  '💇': ['haircut', 'salon', 'spa', 'beauty', 'grooming'],
  '🐕': ['pet', 'dog', 'cat', 'vet', 'veterinary'],
  '💡': ['bill', 'bills', 'utility', 'payment']
};

/** Label for category filter display (icons are not shown in UI) */
export const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  '🍔': 'Food',
  '☕': 'Coffee',
  '🛒': 'Shop',
  '🚗': 'Travel',
  '🏠': 'Home',
  '🎬': 'Fun',
  '💵': 'Other'
};

export function getCategoryLabel(icon: string): string {
  return CATEGORY_LABELS[icon] ?? 'Other';
}

// Currency Options
export const CURRENCIES = [
  { symbol: '$', name: 'US Dollar', code: 'USD' },
  { symbol: '€', name: 'Euro', code: 'EUR' },
  { symbol: '£', name: 'British Pound', code: 'GBP' },
  { symbol: '¥', name: 'Japanese Yen', code: 'JPY' },
  { symbol: '₹', name: 'Indian Rupee', code: 'INR' },
  { symbol: 'C$', name: 'Canadian Dollar', code: 'CAD' },
  { symbol: 'A$', name: 'Australian Dollar', code: 'AUD' },
  { symbol: '₿', name: 'Bitcoin', code: 'BTC' },
];

// Helper function to get category icon
export function getCategoryIcon(description: string): string {
  const desc = description.toLowerCase();
  for (const [icon, keywords] of Object.entries(CATEGORY_ICONS)) {
    if (keywords.some(keyword => desc.includes(keyword))) {
      return icon;
    }
  }
  return '💵'; // Default
}

// Helper to format amount
export function formatAmount(amount: number, currency: string = '$'): string {
  return `${currency}${amount.toFixed(2)}`;
}

// Helper to format date
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateFull(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Generate UUID
export function generateId(): string {
  return crypto.randomUUID();
}

// Get today's date in YYYY-MM-DD format
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

// Get year-month string from date
export function getYearMonth(date: string): string {
  return date.substring(0, 7);
}
