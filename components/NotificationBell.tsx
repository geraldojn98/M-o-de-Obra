import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Notification as AppNotification } from '../types';
import { EmptyState } from './EmptyState';

interface NotificationBellProps {
    userId: string;
    onAction?: (actionLink: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ userId, onAction }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel(`notifs_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        const newNotif = payload.new as any;
        
        // Add to list
        setNotifications(prev => [
            {
                id: newNotif.id,
                userId: newNotif.user_id,
                title: newNotif.title,
                message: newNotif.message,
                read: newNotif.read,
                type: newNotif.type,
                actionLink: newNotif.action_link,
                createdAt: newNotif.created_at,
                readAt: newNotif.read_at
            }, 
            ...prev
        ]);
        setUnreadCount(c => c + 1);

        // SYSTEM NOTIFICATION TRIGGER
        // Agora 'Notification' refere-se corretamente à API global do navegador
        if ("Notification" in window && Notification.permission === 'granted' && document.hidden) {
            try {
                new Notification(newNotif.title, {
                    body: newNotif.message,
                    icon: '/icon.png' 
                });
            } catch (e) {
                console.error("Erro ao enviar notificação do sistema", e);
            }
        }
      })
      .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchNotifications = async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoISO = threeDaysAgo.toISOString();
    
    // Buscar todas as notificações do usuário
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50); // Buscar mais para filtrar depois

    if (data) {
        // Filtrar: mostrar apenas não lidas OU lidas há menos de 3 dias
        const filtered = data.filter((n: any) => {
          if (!n.read) return true; // Sempre mostrar não lidas
          if (n.read && n.read_at) {
            return new Date(n.read_at) >= threeDaysAgo;
          }
          return false; // Se está lida mas não tem read_at, não mostrar (caso antigo)
        });
        
        const parsed = filtered.slice(0, 20).map((n:any) => ({
            id: n.id,
            userId: n.user_id,
            title: n.title,
            message: n.message,
            read: n.read,
            type: n.type,
            actionLink: n.action_link,
            createdAt: n.created_at,
            readAt: n.read_at
        }));
        setNotifications(parsed);
        setUnreadCount(parsed.filter(n => !n.read).length);
    }
  };

  const handleOpen = async () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
        const now = new Date().toISOString();
        setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: now })));
        setUnreadCount(0);
        // O trigger no banco vai atualizar read_at automaticamente, mas garantimos aqui também
        await supabase.from('notifications').update({ read: true, read_at: now }).eq('user_id', userId).eq('read', false);
    }
  };

  const handleClickNotif = async (n: AppNotification) => {
      setIsOpen(false);
      
      // Marcar como lida se ainda não estiver lida
      if (!n.read) {
          const now = new Date().toISOString();
          setNotifications(prev => prev.map(notif => 
              notif.id === n.id ? { ...notif, read: true, readAt: now } : notif
          ));
          setUnreadCount(prev => Math.max(0, prev - 1));
          await supabase.from('notifications').update({ read: true, read_at: now }).eq('id', n.id);
      }
      
      // Logic for specific action links (e.g., open chat)
      if (n.actionLink) {
          try {
              const action = JSON.parse(n.actionLink);
              // Dispatch event for other components to listen or use callback
              if (onAction) onAction(n.actionLink);
              
              // If it's a chat notification, we might want to trigger a custom event
              if (action.screen === 'chat') {
                  window.dispatchEvent(new CustomEvent('openChat', { detail: { jobId: action.id, partnerName: action.name || 'Chat' } }));
              }
          } catch(e) {}
      }
  };

  return (
    <div className="relative">
      <button 
        onClick={handleOpen}
        className="p-2 text-slate-500 hover:text-brand-orange hover:bg-orange-50 rounded-full transition-colors relative"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <>
            <div className="fixed inset-0 bg-black/20 z-40 sm:hidden" onClick={() => setIsOpen(false)}></div>
            <div className="
                fixed top-16 left-4 right-4 
                sm:absolute sm:top-full sm:right-0 sm:left-auto sm:w-80 
                bg-white rounded-xl shadow-xl border border-slate-100 
                z-50 animate-fade-in origin-top-right overflow-hidden
            ">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                    <span className="font-bold text-sm text-slate-700">Notificações</span>
                    <button onClick={() => setIsOpen(false)} className="sm:hidden text-slate-400">
                        <X size={16} />
                    </button>
                </div>
                <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <EmptyState icon={Bell} title="Nenhuma notificação recente" description="Suas notificações aparecerão aqui." className="py-6" />
                    ) : (
                        notifications.map(n => (
                            <div 
                                key={n.id} 
                                onClick={() => handleClickNotif(n)}
                                className={`p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${!n.read ? 'bg-orange-50/50' : ''}`}
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <h4 className="font-bold text-sm text-slate-800 flex-1">{n.title}</h4>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(n.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.message}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
      )}
    </div>
  );
};