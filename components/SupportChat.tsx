import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { Button } from './Button';
import { Send, X, MessageCircle } from 'lucide-react';

interface SupportChatProps {
  user: User;
  onClose: () => void;
}

export const SupportChat: React.FC<SupportChatProps> = ({ user, onClose }) => {
  const [messages, setMessages] = useState<{ id: string; sender_id: string; content: string; created_at: string }[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('support_messages')
        .select('id, sender_id, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    };
    load();

    const channel = supabase
      .channel(`support_${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `user_id=eq.${user.id}` }, (payload) => {
        const m = payload.new as any;
        setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, { id: m.id, sender_id: m.sender_id, content: m.content, created_at: m.created_at }]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user.id]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const { error } = await supabase.from('support_messages').insert({ user_id: user.id, sender_id: user.id, content: text });
    if (!error) setInput('');
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-white flex flex-col animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <MessageCircle size={24} className="text-brand-orange" />
          <h2 className="font-bold text-lg text-slate-800">Chat com Suporte</h2>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500"><X size={22} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">Envie uma mensagem. Nossa equipe responderá em breve.</p>
        )}
        {messages.map(m => {
          const isMe = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${isMe ? 'bg-brand-orange text-white' : 'bg-slate-100 text-slate-800'}`}>
                <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`text-[10px] mt-1 ${isMe ? 'text-orange-100' : 'text-slate-400'}`}>
                  {new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-slate-100 flex gap-2 bg-white safe-bottom">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          className="flex-1 bg-slate-100 border-0 rounded-full px-4 py-3 text-sm focus:ring-2 focus:ring-brand-orange outline-none"
        />
        <Button type="submit" size="sm" disabled={!input.trim() || sending} className="rounded-full w-10 h-10 p-0 flex items-center justify-center">
          <Send size={18} />
        </Button>
      </form>
    </div>
  );
};
