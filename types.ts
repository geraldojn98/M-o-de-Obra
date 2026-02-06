
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

  // Security / Anti-fraud
  suspicious_flag?: boolean;
  active?: boolean;
  punishment_until?: string | null;

  /** Roles permitidos para esta conta (ex.: ['client'], ['worker'], ['client','worker']) */
  allowed_roles?: UserRole[];
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
}

export interface AuditData {
    worker_q1?: string; // Material usado
    worker_q2?: string; // Resultado
    client_q1?: string; // Material usado
    client_q2?: string; // Resultado
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
  status: 'pending' | 'in_progress' | 'waiting_verification' | 'completed' | 'cancelled' | 'audited';
  price: number;
  date: string;
  
  // Location
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  
  // Business Rules
  estimatedHours: number; // 1, 2, 4, 8
  pointsAwarded?: number;
  acceptedAt?: string; // quando o profissional aceitou (para auditoria)

  // Completion Fields
  rating?: number;
  durationHours?: number; // Real duration logged
  workerEvidence?: string;
  clientEvidence?: string;
  
  // Anti-Fraud
  isAudited?: boolean;
  auditData?: AuditData;
  
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
  
  // Frontend Joined Data
  partnerName?: string;
  partnerLogo?: string;
}

export interface CategorySuggestion {
    id: string;
    userId: string;
    userName?: string;
    suggestion: string;
    createdAt: string;
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
  CLIENT_FIXED: 10, // Pontos fixos para cliente
  WORKER_PER_HOUR: 10, // Pontos por hora para trabalhador
  WORKER_DAILY_CAP: 80, // Máximo por dia
};