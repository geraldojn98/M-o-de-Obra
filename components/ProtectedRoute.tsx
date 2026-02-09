import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Mascot } from './Mascot';
import { Footer } from './Footer';

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-brand-orange flex flex-col items-center justify-center p-6 overflow-hidden">
    <Mascot className="w-64 h-64 animate-bounce-slow drop-shadow-2xl" variant="full" />
    <div className="mt-8 text-white font-black text-xl tracking-tighter animate-pulse">CARREGANDO...</div>
    <Footer />
  </div>
);

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  allowGuest?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, allowGuest = false }) => {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) return <LoadingScreen />;
  if (!auth.user && !auth.isGuestMode) return <Navigate to="/" state={{ from: location }} replace />;
  if (allowGuest && auth.isGuest) return <>{children}</>;
  const role = auth.effectiveUser.role;
  if (allowedRoles.includes(role)) return <>{children}</>;
  return <Navigate to="/" replace />;
};
