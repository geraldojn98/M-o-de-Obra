import React, { createContext, useContext } from 'react';
import type { User, UserRole } from '../types';

export type AuthValue = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isLoading: boolean;
  isGuestMode: boolean;
  setIsGuestMode: React.Dispatch<React.SetStateAction<boolean>>;
  effectiveUser: User;
  isGuest: boolean;
  fetchProfileAndSetUser: (userId: string) => Promise<void>;
  setShowEditProfile: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPointsModal: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDrawerOpen: boolean;
  setShowWorkerSpecialty: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCompleteProfile: React.Dispatch<React.SetStateAction<boolean>>;
  handleSwitchRole: (newRole: 'client' | 'worker') => void;
  handleAddRole: (newRole: 'client' | 'worker') => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const AuthProvider = AuthContext.Provider;
