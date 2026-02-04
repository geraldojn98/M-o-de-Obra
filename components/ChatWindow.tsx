import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Message, User } from '../types';
import { Button } from './Button';
import { Send, X, ArrowLeft } from 'lucide-react';

interface ChatWindowProps {
  jobId: string;
  currentUser: User;
  otherUserName: string;
  onClose: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ jobId, currentUser, otherUserName, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let isSubscribed = true;

    // 1. Fetch History
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      
      if (data && isSubscribed) {
        setMessages(data.map((m: any) => ({
          id: m.id,
          jobId: m.job_id,
          senderId: m.sender_id,
          content: m.content,
          createdAt: m.created_at
        })));
      }
    };

    fetchMessages();

    // 2. Real-time Subscription (For incoming messages from others)
    const channel = supabase
      .channel(`chat_room_${jobId}`) 
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `job_id=eq.${jobId}` 
      }, (payload) => {
        const newMsg = payload.new as any;
        
        // Only add if it's NOT from me (because I handle my own messages optimistically/immediately)
        // OR if it is from me but I don't have it in state yet (fallback)
        if (newMsg.sender_id !== currentUser.id) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, {
                id: newMsg.id,
                jobId: newMsg.job_id,
                senderId: newMsg.sender_id,
                content: newMsg.content,
                createdAt: newMsg.created_at
              }];
            });
        }
      })
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [jobId, currentUser.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    const text = newMessage.trim();
    setNewMessage(''); 

    // 1. Insert and SELECT the return data immediately
    const { data, error } = await supabase
      .from('messages')
      .insert({
        job_id: jobId,
        sender_id: currentUser.id,
        content: text
      })
      .select()
      .single();

    if (error) {
        console.error("Error sending message:", error);
        alert("Erro ao enviar mensagem.");
        setNewMessage(text); // Restore text on error
    } else if (data) {
        // 2. Update Local State Immediately
        const newMsgObj: Message = {
            id: data.id,
            jobId: data.job_id,
            senderId: data.sender_id,
            content: data.content,
            createdAt: data.created_at
        };

        setMessages(prev => [...prev, newMsgObj]);

        // 3. Notification logic (Fire and forget)
        const { data: job } = await supabase.from('jobs').select('client_id, worker_id').eq('id', jobId).single();
        if (job) {
            const receiverId = job.client_id === currentUser.id ? job.worker_id : job.client_id;
            if (receiverId) {
                // IMPORTANT: Add action_link for redirection
                const actionLink = JSON.stringify({
                    screen: 'chat',
                    id: jobId,
                    name: currentUser.name
                });

                await supabase.from('notifications').insert({
                    user_id: receiverId,
                    title: `Nova mensagem de ${currentUser.name}`,
                    message: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                    type: 'chat',
                    action_link: actionLink
                });
            }
        }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] sm:p-4">
      <div className="bg-white w-full h-[100dvh] sm:h-[600px] sm:max-w-md sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-fade-in sm:border-4 sm:border-brand-orange/20">
        
        {/* Header */}
        <div className="bg-brand-orange p-3 sm:p-4 flex justify-between items-center text-white shadow-md z-20 shrink-0 safe-top">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full"><ArrowLeft size={20} /></button>
            <div>
                <h3 className="font-bold text-sm sm:text-base">{otherUserName}</h3>
                <p className="text-xs opacity-80">Negociando serviço</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full hidden sm:block"><X size={20} /></button>
        </div>

        {/* Messages Area */}
        <div 
            className="flex-1 overflow-y-auto bg-slate-50 relative flex flex-col"
            ref={scrollContainerRef}
        > 
          <div className="flex-1 min-h-0" /> {/* Spacer to push messages down if few */}
          
          <div className="p-4 space-y-3 pb-4">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 space-y-2 opacity-60">
                    <div className="bg-slate-200 p-3 rounded-full"><Send size={24} className="opacity-50"/></div>
                    <p className="text-sm">Envie a primeira mensagem...</p>
                </div>
            )}
            
            {messages.map(msg => {
                const isMe = msg.senderId === currentUser.id;
                return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm relative ${
                    isMe ? 'bg-brand-blue text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                    }`}>
                    {msg.content}
                    <span className={`block text-[10px] text-right mt-1 ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    </div>
                </div>
                );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center pb-5 sm:pb-3 shrink-0 z-20 safe-bottom">
          <input 
            type="text" 
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-slate-100 border-0 rounded-full px-4 py-3 focus:ring-2 focus:ring-brand-orange outline-none text-sm"
          />
          <Button type="submit" size="sm" className="rounded-full w-10 h-10 p-0 flex items-center justify-center bg-brand-orange text-white shadow-md">
            <Send size={18} />
          </Button>
        </form>

      </div>
    </div>
  );
};