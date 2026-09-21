export type Page =
  | 'dashboard'
  | 'finance'
  | 'documents'
  | 'clients'
  | 'tasks'
  | 'employees'
  | 'calendar'
  | 'specialists'
  | 'subscription'
  | 'settings';

export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionStatus = 'completed' | 'pending' | 'failed';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  status: TransactionStatus;
  account?: string;
}

export type DocumentStatus = 'draft' | 'signing' | 'signed' | 'paid';

export interface DocumentItem {
  id: string;
  name: string;
  type: 'contract' | 'invoice' | 'act' | 'proposal' | 'template';
  client: string;
  date: string;
  status: DocumentStatus;
  amount: number;
  number: string;
  content?: string;
}

export type ClientStatus = 'active' | 'potential' | 'archived';

export interface ClientNote {
  id: string;
  text: string;
  date: string;
}

export interface ClientActivity {
  id: string;
  type: 'call' | 'meeting' | 'email' | 'deal' | 'payment';
  text: string;
  date: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: ClientStatus;
  dealValue: number;
  lastActivity: string;
  notes: ClientNote[];
  activities: ClientActivity[];
  avatarColor: string;
}

export type TaskStatus = 'new' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  dueTime?: string;
  assignee?: string;
  completed: boolean;
  category?: string;
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  status: 'active' | 'vacation' | 'inactive';
  salary: number;
  tasksCount: number;
  nextPayment: string;
  email: string;
  phone: string;
  joinDate: string;
  avatarColor: string;
  department: string;
}

export interface Specialist {
  id: string;
  name: string;
  profession: string;
  category: string;
  rating: number;
  projects: number;
  price: number;
  location: string;
  bio: string;
  avatarColor: string;
}

export type NotificationType = 'payment' | 'task' | 'client' | 'document' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  date: string;
  read: boolean;
}

export interface BusinessProfile {
  name: string;
  industry: string;
  city: string;
  employeesCount: string;
  modules: string[];
}

export interface UserProfile {
  name: string;
  email: string;
  plan: 'free' | 'business' | 'pro';
}

export type PaymentStatus =
  | 'awaiting_payment'
  | 'navigated_to_kaspi'
  | 'awaiting_confirmation'
  | 'under_review'
  | 'confirmed'
  | 'rejected';

export interface PaymentRequest {
  id: string;
  userId: string;
  plan: 'business' | 'pro';
  amount: number;
  status: PaymentStatus;
  createdAt: string;
  customerName: string;
  customerPhone: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'task' | 'payment' | 'document' | 'employee';
  color: string;
}

export interface AppState {
  user: UserProfile | null;
  business: BusinessProfile | null;
  onboardingComplete: boolean;
  transactions: Transaction[];
  documents: DocumentItem[];
  clients: Client[];
  tasks: Task[];
  employees: Employee[];
  notifications: AppNotification[];
  events: CalendarEvent[];
  specialists: Specialist[];
  payments: PaymentRequest[];
}
