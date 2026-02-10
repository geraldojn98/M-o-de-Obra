import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { ChatWindow } from './ChatWindow';
import { MessageCircle } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { DEFAULT_AVATAR } from '../constants/defaultAvatar';

export interface ConversationRow {
  jobId: string;
  jobTitle: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string;
  lastMessage: string;
  lastAt: string;
}

interface ChatListPageProps {
  user: User;
  role: 'client' | 'worker';
  onBack?: () => void;
}

export const ChatListPage: React.FC<ChatListPageProps> = ({ user, role }) => {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedPartnerName, setSelectedPartnerName] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const col = role === 'client' ? 'client_id' : 'worker_id';
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, client_id, worker_id')
        .eq(col, user.id);

      if (!jobs?.length) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const jobIds = jobs.map((j: any) => j.id);
      const { data: lastMessages } = await supabase
        .from('messages')
        .select('job_id, content, created_at')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false });

      const byJob: Record<string, { content: string; created_at: string }> = {};
      lastMessages?.forEach((m: any) => {
        if (!byJob[m.job_id]) byJob[m.job_id] = { content: m.content || '', created_at: m.created_at };
      });

      const otherUserIds = [...new Set(jobs.map((j: any) => (role === 'client' ? j.worker_id : j.client_id)).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', otherUserIds);

      const profileMap: Record<string, { full_name: string; avatar_url: string }> = {};
      profiles?.forEach((p: any) => {
        profileMap[p.id] = { full_name: p.full_name || '', avatar_url: p.avatar_url || DEFAULT_AVATAR };
      });

      const rows: ConversationRow[] = jobs
        .filter((j: any) => byJob[j.id])
        .map((j: any) => {
          const otherId = role === 'client' ? j.worker_id : j.client_id;
          const profile = otherId ? profileMap[otherId] : null;
          const last = byJob[j.id];
          return {
            jobId: j.id,
            jobTitle: j.title,
            otherUserId: otherId,
            otherUserName: profile?.full_name || 'Usuário',
            otherUserAvatar: profile?.avatar_url || DEFAULT_AVATAR,
            lastMessage: (last.content || '').slice(0, 50) + ((last.content || '').length > 50 ? '...' : ''),
            lastAt: last.created_at,
          };
        })
        .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

      setConversations(rows);
      setLoading(false);
    };
    load();
  }, [user.id, role]);

  if (selectedJobId) {
    return (
      <div className="fixed inset-0 z-[90] bg-white flex flex-col">
        <ChatWindow
          jobId={selectedJobId}
          currentUser={user}
          otherUserName={selectedPartnerName}
          onClose={() => { setSelectedJobId(null); setSelectedPartnerName(''); }}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <MessageCircle size={22} /> Conversas
      </h2>
      {loading ? (
        <div className="py-12 text-center text-slate-400">Carregando...</div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Nenhuma conversa"
          description="Suas conversas com profissionais aparecerão aqui."
        />
      ) : (
        <div className="space-y-1 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {conversations.map((c) => (
            <button
              key={c.jobId}
              type="button"
              onClick={() => { setSelectedJobId(c.jobId); setSelectedPartnerName(c.otherUserName); }}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
            >
              <img src={c.otherUserAvatar} alt="" className="w-12 h-12 rounded-full object-cover bg-slate-200 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">{c.otherUserName}</p>
                <p className="text-sm text-slate-500 truncate">{c.jobTitle}</p>
                {c.lastMessage && (
                  <p className="text-xs text-slate-400 truncate mt-0.5">{c.lastMessage}</p>
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-400 shrink-0">
                {new Date(c.lastAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
