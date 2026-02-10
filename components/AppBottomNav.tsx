import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MessageCircle, Plus, Store, History, ImagePlus, Ticket, QrCode, Briefcase } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '../types';

interface AppBottomNavProps {
  role: UserRole;
  isGuest?: boolean;
}

export const AppBottomNav: React.FC<AppBottomNavProps> = ({ role, isGuest }) => {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;

  const isClient = role === 'client';
  const isWorker = role === 'worker';
  const isPartner = role === 'partner';

  const navItem = (path: string, Icon: LucideIcon, label: string, isCenter = false) => {
    const active = pathname === path || (path !== '/client' && path !== '/worker' && path !== '/partner' && pathname.startsWith(path));
    return (
      <button
        key={path}
        type="button"
        onClick={() => navigate(path)}
        className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-2 ${
          isCenter ? 'flex-[1.2]' : ''
        } ${active ? 'text-brand-orange' : 'text-slate-400'}`}
        aria-label={label}
      >
        {isCenter ? (
          <div className="w-12 h-12 rounded-full bg-brand-orange text-white flex items-center justify-center shadow-lg -mt-6">
            <Icon size={26} />
          </div>
        ) : (
          <Icon size={24} className="shrink-0" />
        )}
        <span className="text-[10px] font-bold truncate max-w-full">{label}</span>
      </button>
    );
  };

  if (isClient) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-pb flex items-end justify-around h-20 pt-2 pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {navItem('/client', Home, 'Início')}
        {navItem('/client/chat', MessageCircle, 'Chat')}
        <button
          type="button"
          onClick={() => { if (isGuest) return; navigate('/client/openservice'); }}
          className="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-[1.2] py-2 text-brand-orange"
          aria-label="Novo pedido"
        >
          <div className="w-12 h-12 rounded-full bg-brand-orange text-white flex items-center justify-center shadow-lg -mt-6">
            <Plus size={26} />
          </div>
          <span className="text-[10px] font-bold">Novo</span>
        </button>
        {navItem('/partners', Store, 'Lojas')}
        {navItem('/client/myservices', History, 'Pedidos')}
      </nav>
    );
  }

  if (isWorker) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-pb flex items-end justify-around h-20 pt-2 pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {navItem('/worker', Home, 'Início')}
        {navItem('/worker/chat', MessageCircle, 'Chat')}
        {navItem('/worker/portfolio', ImagePlus, 'Portfólio', true)}
        {navItem('/partners', Store, 'Lojas')}
        {navItem('/worker/history', History, 'Histórico')}
      </nav>
    );
  }

  if (isPartner) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-pb flex items-end justify-around h-20 pt-2 pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {navItem('/partner/coupons', Ticket, 'Cupons')}
        {navItem('/partner/pos', QrCode, 'PDV')}
        <button
          type="button"
          onClick={() => navigate('/partner/coupons')}
          className="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-[1.2] py-2 text-brand-orange"
          aria-label="Novo cupom"
        >
          <div className="w-12 h-12 rounded-full bg-brand-orange text-white flex items-center justify-center shadow-lg -mt-6">
            <Plus size={26} />
          </div>
          <span className="text-[10px] font-bold">Novo</span>
        </button>
        {navItem('/partner/history', History, 'Histórico')}
        {navItem('/partner/hire', Briefcase, 'Contratar')}
      </nav>
    );
  }

  return null;
};
