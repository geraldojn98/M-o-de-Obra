
export type UserRole = 'worker' | 'client' | 'admin' | 'partner';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  points: number;
  avatar?: string;
  profession?: string;
  specialty?: string;
  bio?: string;
  rating?: number;
  completedJobs?: number;
  phone?: string;
  cpf?: string;
  
  // Location
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
}

export interface Job {
  id: string;
  title: string;
  description?: string;
  clientName: string;
  clientId: string;
  workerName?: string;
  workerId?: string;
  category?: string;
  status: 'pending' | 'in_progress' | 'waiting_verification' | 'completed' | 'cancelled';
  price: number;
  date: string;
  
  // Location
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  
  // Completion Fields
  rating?: number;
  durationHours?: number;
  workerEvidence?: string;
  clientEvidence?: string;
  
  // Cancellation
  cancellationReason?: string;
}

export interface Message {
  id: string;
  jobId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type: 'info' | 'job_update' | 'chat' | 'promo';
  actionLink?: string; // JSON string: { screen: 'chat', id: '123' }
  createdAt: string;
}

export interface Partner {
  id: string;
  name: string;
  category: string;
  logoUrl: string;
  whatsapp: string;
  address?: string;
  active: boolean;
  email?: string; // For linking with auth
}

export interface Coupon {
  id: string;
  partnerId: string;
  title: string;
  description: string;
  cost: number;
  totalQuantity: number;
  availableQuantity: number;
  active: boolean;
}

// Added Reward interface to support mockData usage
export interface Reward {
  id: string;
  title: string;
  cost: number;
  type: 'discount' | 'product';
  image: string;
  partnerName: string;
}

export const POINTS_RULES = {
  REGISTER: 50,
  JOB_COMPLETED: 10,
  JOB_RATED: 5,
};
