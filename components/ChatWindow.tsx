import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Message, User } from '../types';
import { Button } from './Button';
import { Send, X, ArrowLeft, Paperclip, Mic } from 'lucide-react';

interface ChatWindowProps {
  jobId: string;
  currentUser: User;
  otherUserName: string;
  onClose: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ jobId, currentUser, otherUserName, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const mapRowToMessage = (m: any): Message => ({
    id: m.id,
    jobId: m.job_id,
    senderId: m.sender_id,
    content: m.content ?? '',
    createdAt: m.created_at,
    messageType: (m.message_type === 'image' || m.message_type === 'audio' ? m.message_type : 'text') as 'text' | 'image' | 'audio',
    mediaUrl: m.media_url ?? undefined,
  });

  useEffect(() => {
    let isSubscribed = true;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      if (data && isSubscribed) {
        setMessages(data.map(mapRowToMessage));
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat_room_${jobId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `job_id=eq.${jobId}`,
      }, (payload) => {
        const newMsg = payload.new as any;
        if (newMsg.sender_id !== currentUser.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, mapRowToMessage(newMsg)];
          });
        }
      })
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [jobId, currentUser.id]);

  const insertMessageAndNotify = async (msg: Message, previewForNotification: string) => {
    setMessages(prev => [...prev, msg]);
    const { data: job } = await supabase.from('jobs').select('client_id, worker_id').eq('id', jobId).single();
    if (job) {
      const receiverId = job.client_id === currentUser.id ? job.worker_id : job.client_id;
      if (receiverId) {
        const actionLink = JSON.stringify({ screen: 'chat', id: jobId, name: currentUser.name });
        await supabase.from('notifications').insert({
          user_id: receiverId,
          title: `Nova mensagem de ${currentUser.name}`,
          message: previewForNotification,
          type: 'chat',
          action_link: actionLink,
        });
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const text = newMessage.trim();
    setNewMessage('');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        job_id: jobId,
        sender_id: currentUser.id,
        content: text,
        message_type: 'text',
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      alert('Erro ao enviar mensagem.');
      setNewMessage(text);
    } else if (data) {
      const newMsgObj: Message = mapRowToMessage(data);
      await insertMessageAndNotify(newMsgObj, text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = '';
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${jobId}/${currentUser.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { data, error } = await supabase
        .from('messages')
        .insert({
          job_id: jobId,
          sender_id: currentUser.id,
          content: '',
          message_type: 'image',
          media_url: publicUrl,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const newMsgObj: Message = mapRowToMessage(data);
        await insertMessageAndNotify(newMsgObj, '📷 Foto');
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Erro ao enviar imagem.');
    } finally {
      setUploadingImage(false);
    }
  };

  const startRecording = () => {
    audioChunksRef.current = [];
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `${jobId}/${currentUser.id}/${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from('chat-audio')
          .upload(fileName, blob, { contentType: 'audio/webm', upsert: false });
        if (uploadError) {
          alert(uploadError.message || 'Erro ao enviar áudio.');
          return;
        }
        const { data: urlData } = supabase.storage.from('chat-audio').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        const { data, error } = await supabase
          .from('messages')
          .insert({
            job_id: jobId,
            sender_id: currentUser.id,
            content: '',
            message_type: 'audio',
            media_url: publicUrl,
          })
          .select()
          .single();

        if (!error && data) {
          const newMsgObj: Message = mapRowToMessage(data);
          await insertMessageAndNotify(newMsgObj, '🎤 Áudio');
        }
      };
      recorder.start();
      setRecording(true);
    }).catch(() => alert('Não foi possível acessar o microfone.'));
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setRecording(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] sm:p-4">
      <div className="bg-white w-full h-[100dvh] sm:h-[600px] sm:max-w-md sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-fade-in sm:border-4 sm:border-brand-orange/20">

        <div className="bg-brand-orange p-3 sm:p-4 flex justify-between items-center text-white shadow-md z-20 shrink-0 safe-top">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full"><ArrowLeft size={20} /></button>
            <div>
              <h3 className="font-bold text-sm sm:text-base">{otherUserName}</h3>
              <p className="text-xs opacity-80">Conversa no app</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full hidden sm:block"><X size={20} /></button>
        </div>

        <div
          className="flex-1 overflow-y-auto bg-slate-50 relative flex flex-col"
          ref={scrollContainerRef}
        >
          <div className="flex-1 min-h-0" />
          <div className="p-4 space-y-3 pb-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 space-y-2 opacity-60">
                <div className="bg-slate-200 p-3 rounded-full"><Send size={24} className="opacity-50" /></div>
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
                    {msg.messageType === 'image' && msg.mediaUrl ? (
                      <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden max-w-[240px]">
                        <img src={msg.mediaUrl} alt="Enviada no chat" className="w-full h-auto object-cover" />
                      </a>
                    ) : msg.messageType === 'audio' && msg.mediaUrl ? (
                      <audio src={msg.mediaUrl} controls className="max-w-full h-9" />
                    ) : (
                      <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    )}
                    <span className={`block text-[10px] text-right mt-1 ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center pb-5 sm:pb-3 shrink-0 z-20 safe-bottom">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleImageSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            title="Enviar imagem"
          >
            <Paperclip size={20} />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-slate-100 border-0 rounded-full px-4 py-3 focus:ring-2 focus:ring-brand-orange outline-none text-sm"
          />
          <button
            type="button"
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            className={`p-2 rounded-full ${recording ? 'bg-red-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Segure para gravar áudio"
          >
            <Mic size={20} />
          </button>
          <Button type="submit" size="sm" className="rounded-full w-10 h-10 p-0 flex items-center justify-center bg-brand-orange text-white shadow-md">
            <Send size={18} />
          </Button>
        </form>
      </div>
    </div>
  );
};
