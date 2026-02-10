import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Job, ServiceCategory, POINTS_RULES, Coupon } from '../types';
import { Button } from '../components/Button';
import { Camera, CheckCircle, MessageCircle, XCircle, Clock, AlertTriangle, X, ShieldAlert, Zap, MapPin, Ticket, Store, ImagePlus, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { ChatWindow } from '../components/ChatWindow';
import { ChatListPage } from '../components/ChatListPage';
import { LevelBadge } from '../components/LevelBadge';
import { EmptyState } from '../components/EmptyState';
import * as NotificationService from '../services/notifications';

export interface PortfolioItem {
  id: string;
  image_url: string;
  description?: string | null;
  created_at: string;
}

interface WorkerDashboardProps {
  user: User;
}

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[100] flex items-center gap-3 animate-fade-in ${
        type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
        <span>{message}</span>
        <button onClick={onClose}><X size={16} /></button>
    </div>
);

// Audit Modal for Worker
const WorkerAuditModal: React.FC<{ onConfirm: (data: {q1: string, q2: string}) => void, onCancel: () => void }> = ({ onConfirm, onCancel }) => {
    const [q1, setQ1] = useState('');
    const [q2, setQ2] = useState('');

    return (
        <div className="fixed inset-0 bg-red-900/80 z-[200] flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                <div className="flex items-center gap-3 mb-4 text-red-600">
                    <ShieldAlert size={32} />
                    <h3 className="font-black text-xl">Verificação de Segurança</h3>
                </div>
                <p className="text-slate-600 text-sm mb-6">
                    Para garantir a validade deste serviço consecutivo, responda:
                </p>
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Materiais Utilizados?</label>
                        <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-red-500" value={q1} onChange={e => setQ1(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Resultado Alcançado?</label>
                        <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-red-500" rows={2} value={q2} onChange={e => setQ2(e.target.value)} />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" fullWidth onClick={onCancel}>Cancelar</Button>
                    <Button fullWidth onClick={() => onConfirm({q1, q2})} disabled={!q1.trim() || !q2.trim()} className="bg-red-600 hover:bg-red-700 text-white">
                        Confirmar
                    </Button>
                </div>
            </div>
        </div>
    );
};

export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const activeTab: 'jobs' | 'my_jobs' | 'history' | 'portfolio' =
    pathname.includes('/portfolio') ? 'portfolio' : pathname.includes('/history') ? 'history' : pathname.includes('/myservices') ? 'my_jobs' : 'jobs';
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [featuredCoupons, setFeaturedCoupons] = useState<Coupon[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioUploading, setPortfolioUploading] = useState(false);
  const [hasActiveJob, setHasActiveJob] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [todayPoints, setTodayPoints] = useState(0);
  
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [activeChatJobId, setActiveChatJobId] = useState<string | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState('');
  
  const [modalType, setModalType] = useState<'cancel' | 'finish' | 'audit' | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const portfolioCameraRef = useRef<HTMLInputElement>(null);

  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [appealJobId, setAppealJobId] = useState<string | null>(null);
  const isPunished = user.active === false && user.punishment_until && new Date(user.punishment_until) > new Date();

  const [showCameraPermission, setShowCameraPermission] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchData();
    calculateTodayPoints();
  }, [user.id, activeTab]);

  useEffect(() => { if (toast) setTimeout(() => setToast(null), 4000); }, [toast]);

  useEffect(() => {
    if (cameraActive && mediaStream && videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [cameraActive, mediaStream]);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  const calculateTodayPoints = async () => {
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const { data } = await supabase.from('jobs')
        .select('points_awarded')
        .eq('worker_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', startOfDay.toISOString());
    
    if (data) {
        const total = data.reduce((acc, curr) => acc + (curr.points_awarded || 0), 0);
        setTodayPoints(total);
    }
  };

  const fetchData = async () => {
    // Coupons with Partner Data
    const { data: cData } = await supabase.from('coupons').select('*, partner:partners(name, logo_url, email)').eq('active', true).gt('available_quantity', 0).limit(3);
    
    if(cData) {
        const emails = cData.map((c: any) => c.partner?.email).filter(Boolean);
        let avatarMap: Record<string, string> = {};

        if (emails.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('email, avatar_url').in('email', emails);
            profiles?.forEach(p => { if(p.email) avatarMap[p.email] = p.avatar_url; });
        }

        setFeaturedCoupons(cData.map((c: any) => ({
            id: c.id, partnerId: c.partner_id, title: c.title, description: c.description,
            cost: c.cost, totalQuantity: c.total_quantity, availableQuantity: c.available_quantity, active: c.active,
            partnerName: c.partner?.name, 
            partnerLogo: avatarMap[c.partner?.email] || c.partner?.logo_url
        })));
    }

    // 1. Fetch OPEN jobs
    let query = supabase.from('jobs').select('*, client:client_id(full_name)').eq('status', 'pending');
    if (user.city) query = query.ilike('city', user.city);

    const { data: openData } = await query;
    if (openData) {
        const filtered = openData.filter((j: any) => {
            if (j.worker_id === user.id) return true;
            if (j.worker_id !== null) return false;
            // Category Logic
            const jobCats = j.category_name ? j.category_name.split(',').map((s:string) => s.trim()) : [];
            const userSpecs = user.specialty ? user.specialty.split(',').map((s: string) => s.trim()) : [];
            if (jobCats.length === 0 || (jobCats.length === 1 && jobCats[0] === '')) return true;
            return jobCats.some((cat: string) => userSpecs.some((spec: string) => spec.includes(cat) || cat.includes(spec)));
        });

        setAvailableJobs(filtered.map((j:any) => ({
            id: j.id, title: j.title, description: j.description, clientName: j.client?.full_name || 'Cliente',
            clientId: j.client_id, status: 'pending', price: j.price || 0, date: j.created_at, workerId: j.worker_id, category: j.category_name,
            city: j.city, estimatedHours: j.estimated_hours || 1
        })));
    }

    // 2. Fetch MY jobs
    const { data: myData } = await supabase.from('jobs').select('*, client:client_id(full_name)').eq('worker_id', user.id).order('created_at', { ascending: false });
    if (myData) {
        const parsedJobs = myData.map((j:any) => ({
            id: j.id, title: j.title, description: j.description, clientName: j.client?.full_name || 'Cliente',
            clientId: j.client_id, status: j.status, price: j.price || 0, date: j.created_at, city: j.city, estimatedHours: j.estimated_hours || 1,
            isAudited: j.is_audited, acceptedAt: j.accepted_at
        }));
        setMyJobs(parsedJobs);
        const active = parsedJobs.find((j: any) => j.status === 'in_progress' || j.status === 'waiting_verification');
        setHasActiveJob(!!active);
    }

    // 3. Portfolio
    const { data: portfolioData } = await supabase.from('worker_portfolio').select('id, image_url, description, created_at').eq('worker_id', user.id).order('created_at', { ascending: false });
    setPortfolioItems((portfolioData || []).map((p: any) => ({ id: p.id, image_url: p.image_url, description: p.description, created_at: p.created_at })));
  };

  const handleRefuseDirectProposal = async (jobId: string) => {
    if (!confirm('Recusar esta proposta? O cliente será informado e o serviço voltará a ficar disponível para outros profissionais.')) return;
    setLoadingAction(true);
    const job = availableJobs.find(j => j.id === jobId);
    const { error } = await supabase.from('jobs').update({ worker_id: null }).eq('id', jobId);
    if (error) {
      showToast(error.message, 'error');
    } else {
      // Notificar o cliente sobre a recusa
      if (job?.clientId) {
        const { data: clientData } = await supabase.from('profiles').select('full_name').eq('id', job.clientId).single();
        if (clientData) {
          await NotificationService.createNotification({
            userId: job.clientId,
            title: 'Proposta Recusada',
            message: `${user.name} recusou sua proposta para "${job.title}". O serviço voltou a ficar disponível.`,
            type: 'job_update',
          });
        }
      }
      showToast('Proposta recusada.', 'success');
      await fetchData();
    }
    setLoadingAction(false);
  };

  const handleAcceptJob = async (jobId: string) => {
      if (isPunished) return showToast("Sua conta está suspensa. Recorra à punição se achar injusto.", 'error');
      if (hasActiveJob) return showToast("Você tem um serviço ativo. Termine-o primeiro.", 'error');
      
      const jobToAccept = availableJobs.find(j => j.id === jobId);
      if(!jobToAccept) return;

      if (todayPoints >= POINTS_RULES.WORKER_DAILY_CAP) {
          return showToast("Você atingiu o limite diário de pontos (80). Volte amanhã!", 'error');
      }

      setLoadingAction(true);

      const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
      const { data: jobsWithClientToday } = await supabase.from('jobs')
        .select('id')
        .eq('client_id', jobToAccept.clientId)
        .eq('worker_id', user.id)
        .gte('created_at', startOfDay.toISOString());
      
      const isRepetition = jobsWithClientToday && jobsWithClientToday.length > 0;
      if (isRepetition) {
           if(!confirm("Atenção: Este é seu segundo serviço para o mesmo cliente hoje. Por regras de segurança, este serviço valerá 0 pontos. Deseja continuar?")) {
               setLoadingAction(false);
               return;
           }
      }

      if(!confirm(`Este serviço tem duração estimada de ${jobToAccept.estimatedHours}h. Você ficará indisponível para novos chamados durante este período. Confirmar?`)) {
          setLoadingAction(false);
          return;
      }

      const { error } = await supabase.from('jobs').update({ worker_id: user.id, status: 'in_progress', accepted_at: new Date().toISOString() }).eq('id', jobId);
      
      if (error) { 
        showToast(error.message, 'error'); 
        setLoadingAction(false); 
      } else {
        // Buscar dados do cliente para notificação
        const { data: jobData } = await supabase.from('jobs').select('client_id, title').eq('id', jobId).single();
        if (jobData?.client_id) {
          const { data: clientData } = await supabase.from('profiles').select('full_name').eq('id', jobData.client_id).single();
          if (clientData) {
            await NotificationService.notifyClientJobAccepted(jobData.client_id, user.name, jobData.title || jobToAccept.title, jobId);
          }
        }
        showToast('Serviço aceito!', 'success'); 
        navigate('/worker/myservices'); 
        await fetchData(); 
        setLoadingAction(false);
      }
  };

  const confirmFinishJob = async (auditAnswers?: {q1: string, q2: string}) => {
      if (!selectedJobId || !capturedImage) return alert("Adicione a foto.");
      setLoadingAction(true);
      
      const job = myJobs.find(j => j.id === selectedJobId);
      if (!job) return;

      if (!auditAnswers) {
        let needAudit = false;

        // 1) Serviço terminado antes do prazo estipulado (tempo desde aceite < estimated_hours)
        if (job.acceptedAt && job.estimatedHours) {
          const acceptedMs = new Date(job.acceptedAt).getTime();
          const elapsedHours = (Date.now() - acceptedMs) / (1000 * 60 * 60);
          if (elapsedHours < job.estimatedHours) needAudit = true;
        }

        // 2) Mais de um serviço com mesmo cliente e mesmo profissional no mesmo dia
        if (!needAudit) {
          const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
          const { data: jobsTodaySame } = await supabase.from('jobs')
            .select('id')
            .eq('client_id', job.clientId)
            .eq('worker_id', user.id)
            .gte('created_at', startOfDay.toISOString());
          if (jobsTodaySame && jobsTodaySame.length > 1) needAudit = true;
        }

        // 3) Mesmo cliente e mesmo profissional em dois dias consecutivos
        if (!needAudit) {
          const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0, 0, 0, 0);
          const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
          const { data: consecutiveJobs } = await supabase.from('jobs')
            .select('id')
            .eq('client_id', job.clientId)
            .eq('worker_id', user.id)
            .gte('created_at', yesterday.toISOString())
            .lt('created_at', todayStart.toISOString());
          if (consecutiveJobs && consecutiveJobs.length > 0) needAudit = true;
        }

        if (needAudit) {
          setModalType('audit');
          setLoadingAction(false);
          return;
        }
      }

      let pointsToAward = job.estimatedHours * POINTS_RULES.WORKER_PER_HOUR;
      
      const potentialTotal = todayPoints + pointsToAward;
      if (potentialTotal > POINTS_RULES.WORKER_DAILY_CAP) {
          pointsToAward = Math.max(0, POINTS_RULES.WORKER_DAILY_CAP - todayPoints);
      }

      const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
      const { data: jobsToday } = await supabase.from('jobs').select('id').eq('client_id', job.clientId).eq('worker_id', user.id).gte('created_at', startOfDay.toISOString());
      if (jobsToday && jobsToday.length > 1) {
          pointsToAward = 0;
      }
      
      let isAudited = false;
      let auditData = null;
      if (auditAnswers) {
          pointsToAward = 0;
          isAudited = true;
          auditData = { worker_q1: auditAnswers.q1, worker_q2: auditAnswers.q2 };
          await supabase.from('profiles').update({ suspicious_flag: true }).eq('id', user.id);
          if (job.clientId) await supabase.from('profiles').update({ suspicious_flag: true }).eq('id', job.clientId);
      }

      const updates: any = { 
          status: 'waiting_verification', 
          worker_evidence_url: capturedImage,
          points_awarded: pointsToAward,
          is_audited: isAudited
      };
      if(auditData) updates.audit_data = auditData;

      if (pointsToAward > 0 && !isAudited) {
           const { error: rpcError } = await supabase.rpc('increment_points', { user_id: user.id, amount: pointsToAward });
           if (rpcError) {
                const {data:prof} = await supabase.from('profiles').select('points').eq('id', user.id).single();
                if(prof) await supabase.from('profiles').update({ points: prof.points + pointsToAward }).eq('id', user.id);
           }
      }

      const { error } = await supabase.from('jobs').update(updates).eq('id', selectedJobId);

      if (error) {
        showToast(error.message, 'error');
      } else {
        // Notificar o cliente que o serviço foi finalizado
        if (job.clientId) {
          const { data: clientData } = await supabase.from('profiles').select('full_name').eq('id', job.clientId).single();
          if (clientData) {
            await NotificationService.notifyClientJobFinished(job.clientId, user.name, job.title, selectedJobId);
          }
        }
        showToast('Enviado para verificação!', 'success'); 
        closeModal(); 
        fetchData(); 
        calculateTodayPoints();
      }
      setLoadingAction(false);
  };
  
  const handleStartCamera = async () => { try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); setMediaStream(stream); setCameraActive(true); setShowCameraPermission(false); } catch (err) { try { const stream = await navigator.mediaDevices.getUserMedia({ video: true }); setMediaStream(stream); setCameraActive(true); setShowCameraPermission(false); } catch (err2) { alert("Erro ao acessar câmera."); setShowCameraPermission(false); } } };
  const handleCapture = () => { if (videoRef.current) { const canvas = document.createElement("canvas"); canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight; const ctx = canvas.getContext("2d"); if (ctx) { ctx.drawImage(videoRef.current, 0, 0); setCapturedImage(canvas.toDataURL("image/jpeg")); stopCamera(); } } };
  const stopCamera = () => { if (mediaStream) mediaStream.getTracks().forEach(track => track.stop()); setMediaStream(null); setCameraActive(false); };
  const handleRetake = () => { setCapturedImage(null); handleStartCamera(); };
  const openCancelModal = (e: React.MouseEvent, jobId: string) => { e.stopPropagation(); setSelectedJobId(jobId); setModalType('cancel'); setCancelReason(''); };
  const openFinishModal = (e: React.MouseEvent, jobId: string) => { e.stopPropagation(); setSelectedJobId(jobId); setModalType('finish'); setCapturedImage(null); stopCamera(); };
  const closeModal = () => { setModalType(null); setSelectedJobId(null); stopCamera(); setShowCameraPermission(false); };
  const confirmCancelJob = async () => {
    if (!selectedJobId || !cancelReason.trim()) return showToast("Informe o motivo.", 'error');
    setLoadingAction(true);
    const job = myJobs.find(j => j.id === selectedJobId);
    const { error } = await supabase.from('jobs').update({ status: 'cancelled', cancellation_reason: cancelReason, cancelled_by: user.id }).eq('id', selectedJobId);
    if (error) {
      showToast(error.message, 'error');
    } else {
      // Notificar o cliente sobre o cancelamento
      if (job?.clientId) {
        const { data: clientData } = await supabase.from('profiles').select('full_name').eq('id', job.clientId).single();
        if (clientData) {
          await NotificationService.notifyClientJobCancelled(job.clientId, user.name, job.title, cancelReason);
        }
      }
      closeModal();
      fetchData();
    }
    setLoadingAction(false);
  };
  const openChat = (jobId: string, partnerName: string) => { setActiveChatJobId(jobId); setChatPartnerName(partnerName); };

  const handlePortfolioImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = '';
    setPortfolioUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('worker-portfolio').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('worker-portfolio').getPublicUrl(path);
      const { data, error } = await supabase.from('worker_portfolio').insert({ worker_id: user.id, image_url: urlData.publicUrl }).select().single();
      if (error) throw error;
      if (data) setPortfolioItems(prev => [{ id: data.id, image_url: data.image_url, description: data.description, created_at: data.created_at }, ...prev]);
      showToast('Foto adicionada ao portfólio!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao enviar foto.', 'error');
    } finally {
      setPortfolioUploading(false);
    }
  };

  const removePortfolioItem = async (id: string) => {
    if (!confirm('Remover esta foto do portfólio?')) return;
    const { error } = await supabase.from('worker_portfolio').delete().eq('id', id);
    if (error) showToast(error.message, 'error');
    else { setPortfolioItems(prev => prev.filter(p => p.id !== id)); showToast('Foto removida.', 'success'); }
  };

  const openAppealModal = async () => {
    const { data: punishedJob } = await supabase.from('jobs').select('id').eq('worker_id', user.id).eq('admin_verdict', 'punished').limit(1).maybeSingle();
    setAppealJobId(punishedJob?.id || null);
    setAppealText('');
    setAppealModalOpen(true);
  };
  const submitAppeal = async () => {
    if (!appealText.trim()) return showToast('Descreva o que aconteceu.', 'error');
    if (!appealJobId) return showToast('Não foi possível vincular ao serviço.', 'error');
    setLoadingAction(true);
    const { error } = await supabase.from('punishment_appeals').insert({ user_id: user.id, job_id: appealJobId, appeal_text: appealText.trim() });
    if (error) showToast(error.message, 'error');
    else { showToast('Recurso enviado. O admin analisará em breve.', 'success'); setAppealModalOpen(false); }
    setLoadingAction(false);
  };

  const currentActiveJobs = myJobs.filter(j => ['in_progress', 'waiting_verification'].includes(j.status));
  const historyJobs = myJobs.filter(j => ['completed', 'cancelled'].includes(j.status));

  return (
    <div className="space-y-6 relative">
       {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
       {isPunished && (
           <div className="bg-red-100 text-red-800 p-4 rounded-xl border border-red-200 flex flex-col sm:flex-row sm:items-center gap-3">
               <div className="flex-1">
                   <p className="font-bold">Conta temporariamente suspensa</p>
                   <p className="text-xs">Você não pode aceitar serviços até {user.punishment_until ? new Date(user.punishment_until).toLocaleDateString() : ''}. Acha que foi um engano? Recorra.</p>
               </div>
               <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-xl shrink-0" onClick={openAppealModal}>Recorrer punição</Button>
           </div>
       )}
       
       {/* PROFILE HEADER COM NÍVEL */}
       <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="w-14 h-14 rounded-full shadow-md flex items-center justify-center bg-white shrink-0 relative">
                <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover bg-slate-200" />
                <div className="absolute -top-1 -right-1">
                  <LevelBadge level={user.level || 'bronze'} size="sm" />
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.specialty || 'Profissional'}</p>
            </div>
       </div>

       {/* DAILY CAP BANNER */}
       {todayPoints >= POINTS_RULES.WORKER_DAILY_CAP && (
           <div className="bg-red-100 text-red-700 p-4 rounded-xl flex items-center gap-3 border border-red-200 shadow-sm animate-pulse">
               <AlertTriangle size={24} className="shrink-0" />
               <div>
                   <p className="font-black">Teto Diário Atingido!</p>
                   <p className="text-xs">Você já fez 80 pontos hoje. Novos serviços não renderão pontos até amanhã.</p>
               </div>
           </div>
       )}
       <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <span className="text-sm font-bold text-slate-500">Ganhos Hoje:</span>
            <div className="flex items-center gap-2">
                <span className={`text-xl font-black ${todayPoints >= 80 ? 'text-red-500' : 'text-green-600'}`}>{todayPoints}/80</span>
                <Zap size={16} className="text-yellow-500 fill-yellow-500"/>
            </div>
       </div>

       {pathname.includes('/chat') ? (
         <ChatListPage user={user} role="worker" />
       ) : (
         <>
       {/* Tabs */}
       <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
         <button className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'jobs' ? 'border-b-2 border-brand-orange text-brand-orange' : 'text-slate-500'}`} onClick={() => navigate('/worker')}>Novos Pedidos</button>
         <button className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'my_jobs' ? 'border-b-2 border-brand-orange text-brand-orange' : 'text-slate-500'}`} onClick={() => navigate('/worker/myservices')}>Meus Serviços</button>
         <button className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'history' ? 'border-b-2 border-brand-orange text-brand-orange' : 'text-slate-500'}`} onClick={() => navigate('/worker/history')}>Histórico</button>
         <button className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'portfolio' ? 'border-b-2 border-brand-orange text-brand-orange' : 'text-slate-500'}`} onClick={() => navigate('/worker/portfolio')}>Meu Portfólio</button>
       </div>

       {activeTab === 'jobs' && (
         <div className="space-y-4 animate-fade-in">
           {hasActiveJob && <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-2 flex items-center gap-2"><Clock size={16} /> Você tem um serviço ativo. Termine-o para pegar outro.</div>}
           {availableJobs.length === 0 && (
               <EmptyState icon={Clock} title="Nenhum serviço disponível" description={user.city ? `Em ${user.city} no momento.` : 'Nenhum pedido novo no momento.'} />
           )}
           {availableJobs.map(job => {
             const isDirectProposal = job.workerId === user.id;
             return (
             <div key={job.id} className={`bg-white p-5 rounded-xl border shadow-sm transition-shadow ${isDirectProposal ? 'border-brand-blue ring-1 ring-brand-blue' : 'border-slate-200'}`}>
               <div className="flex justify-between items-start mb-2">
                 <div>
                   {isDirectProposal && <span className="bg-brand-blue text-white text-[10px] px-2 py-0.5 rounded-full mb-1 inline-block">Proposta Direta</span>}
                   <h3 className="font-bold text-lg text-slate-900">{job.title}</h3>
                   <div className="flex items-center gap-2 mt-1">
                       <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1"><Clock size={12}/> {job.estimatedHours}h estimadas</span>
                       <span className="text-green-600 text-xs font-bold flex items-center gap-1">+{job.estimatedHours * 10} pts</span>
                   </div>
                 </div>
                 {job.price > 0 && <span className="font-bold text-xl text-green-600">R$ {job.price.toFixed(2)}</span>}
               </div>
               <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                   <span>{job.clientName}</span>
                   {job.city && <span className="flex items-center gap-1"><MapPin size={10}/> {job.city}</span>}
               </div>
               {isDirectProposal ? (
                 <div className="flex flex-col gap-2">
                   <div className="flex gap-2">
                     <Button fullWidth onClick={() => handleAcceptJob(job.id)} disabled={isPunished || hasActiveJob || loadingAction}>{loadingAction ? 'Processando...' : (isPunished ? 'Conta suspensa' : hasActiveJob ? 'Indisponível' : 'Aceitar')}</Button>
                     <Button variant="danger" fullWidth onClick={() => handleRefuseDirectProposal(job.id)} disabled={loadingAction}>Recusar</Button>
                   </div>
                   <Button variant="secondary" fullWidth onClick={() => openChat(job.id, job.clientName)} className="flex items-center justify-center gap-2"><MessageCircle size={18} /> Chat</Button>
                 </div>
               ) : (
                 <Button fullWidth onClick={() => handleAcceptJob(job.id)} disabled={isPunished || hasActiveJob || loadingAction}>{loadingAction ? 'Processando...' : (isPunished ? 'Conta suspensa' : hasActiveJob ? 'Indisponível' : 'Aceitar Serviço')}</Button>
               )}
             </div>
           );})}

           {/* COUPONS BANNER (Below Jobs) */}
           {featuredCoupons.length > 0 && (
                <div className="overflow-x-auto no-scrollbar pb-2 pt-4 border-t border-slate-100">
                    <h3 className="font-bold text-slate-500 text-xs uppercase mb-2">Descontos em Parceiros</h3>
                    <div className="flex gap-4 w-max">
                        {featuredCoupons.map(coupon => (
                            <button 
                                key={coupon.id} 
                                onClick={() => navigate('/partners')}
                                className="w-72 bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 hover:border-brand-orange transition-colors text-left"
                            >
                                <div className="bg-white border border-slate-100 w-14 h-14 rounded-lg flex items-center justify-center shrink-0 p-1">
                                    {coupon.partnerLogo ? (
                                        <img src={coupon.partnerLogo} className="w-full h-full object-contain" />
                                    ) : (
                                        <Store size={24} className="text-slate-300" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-xs text-brand-orange truncate">{coupon.partnerName}</p>
                                    <p className="font-bold text-sm text-slate-800 line-clamp-1">{coupon.title}</p>
                                    <p className="text-xs text-slate-500 font-bold flex items-center gap-1"><Ticket size={10}/> {coupon.cost} pts</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
           )}
         </div>
       )}

       {/* My Jobs & History remain largely similar, reused from previous state logic */}
       {activeTab === 'my_jobs' && (
           <div className="space-y-6 animate-fade-in pb-20">
                {currentActiveJobs.length === 0 ? (
                  <EmptyState icon={CheckCircle} title="Nenhum serviço em andamento" description="Aceite um pedido para ver aqui." />
                ) : currentActiveJobs.map(job => (
                    <div key={job.id} className="bg-white p-5 rounded-xl border border-brand-orange/30 shadow-sm relative overflow-hidden">
                        <div className={`absolute top-0 right-0 text-white text-xs px-2 py-1 rounded-bl-lg font-bold ${job.status === 'waiting_verification' ? 'bg-purple-500' : 'bg-brand-orange'}`}>{job.status === 'waiting_verification' ? 'Aguardando Cliente' : 'Em Andamento'}</div>
                        <div className="mb-4">
                            <h3 className="font-bold text-lg text-slate-900">{job.title}</h3>
                            <p className="text-slate-500 text-sm">Cliente: {job.clientName}</p>
                            <p className="text-xs font-bold text-slate-400 mt-1">Duração Est: {job.estimatedHours}h</p>
                        </div>
                        <div className="flex gap-2 mb-4"><Button variant="secondary" fullWidth onClick={() => openChat(job.id, job.clientName)} className="flex items-center justify-center gap-2"><MessageCircle size={18} /> Chat</Button></div>
                        {job.status === 'in_progress' && (
                            <div className="flex gap-2">
                                <Button type="button" variant="danger" fullWidth className="flex items-center justify-center gap-2 z-10" onClick={(e) => openCancelModal(e, job.id)} disabled={loadingAction}><XCircle size={18} /> Cancelar</Button>
                                <Button type="button" fullWidth className="flex items-center justify-center gap-2 z-10" onClick={(e) => openFinishModal(e, job.id)} disabled={loadingAction}><CheckCircle size={18} /> Finalizar</Button>
                            </div>
                        )}
                    </div>
                ))}
           </div>
       )}
        
       {activeTab === 'history' && (
           <div className="space-y-4 animate-fade-in pb-20">
               {historyJobs.length === 0 ? (
                 <EmptyState icon={Clock} title="Nenhum histórico ainda" description="Serviços concluídos ou cancelados aparecerão aqui." />
               ) : historyJobs.map(job => (
                   <div key={job.id} className="bg-slate-50 p-5 rounded-xl border border-slate-200 opacity-90 hover:opacity-100 transition-opacity">
                       <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-base text-slate-700">{job.title}</h3>
                                {job.isAudited && <span className="text-red-500 text-[10px] font-bold flex items-center gap-1"><ShieldAlert size={10}/> Auditado</span>}
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ml-2 ${job.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{job.status === 'completed' ? 'Concluído' : 'Cancelado'}</span>
                       </div>
                   </div>
               ))}
           </div>
       )}

       {activeTab === 'portfolio' && (
           <div className="animate-fade-in pb-20 space-y-4">
             <input ref={portfolioInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handlePortfolioImageSelect} />
             <input ref={portfolioCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePortfolioImageSelect} />
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               <Button type="button" onClick={() => portfolioInputRef.current?.click()} disabled={portfolioUploading} className="w-full flex items-center justify-center gap-2" variant="outline">
                 <ImagePlus size={18} /> {portfolioUploading ? 'Enviando...' : 'Escolher do dispositivo'}
               </Button>
               <Button type="button" onClick={() => portfolioCameraRef.current?.click()} disabled={portfolioUploading} className="w-full flex items-center justify-center gap-2">
                 <Camera size={18} /> {portfolioUploading ? 'Enviando...' : 'Tirar foto agora'}
               </Button>
             </div>
             {portfolioItems.length === 0 ? (
               <EmptyState icon={ImagePlus} title="Nenhuma foto no portfólio" description="Adicione fotos dos seus trabalhos para clientes verem." />
             ) : (
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                 {portfolioItems.map(item => (
                   <div key={item.id} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-square">
                     <img src={item.image_url} alt={item.description || 'Portfólio'} className="w-full h-full object-cover" />
                     <button type="button" onClick={() => removePortfolioItem(item.id)} className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remover"><Trash2 size={14} /></button>
                   </div>
                 ))}
               </div>
             )}
           </div>
       )}
         </>
       )}

        {modalType === 'finish' && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
               <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl text-center my-auto">
                   {!capturedImage && !cameraActive && !showCameraPermission && (
                       <>
                        <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600"><CheckCircle size={32} /></div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Finalizar Serviço</h3>
                        <p className="text-sm text-slate-600 mb-6">É obrigatório anexar uma foto.</p>
                        <Button variant="outline" fullWidth className="mb-4 border-dashed border-2 flex flex-col items-center justify-center py-6 gap-2" onClick={() => setShowCameraPermission(true)}><Camera size={24} className="text-slate-400"/><span className="text-sm text-slate-500">Tirar Foto</span></Button>
                        <Button variant="outline" fullWidth onClick={closeModal}>Cancelar</Button>
                       </>
                   )}
                   {showCameraPermission && (
                       <div className="animate-fade-in">
                           <h3 className="text-xl font-bold mb-2">Permitir Câmera?</h3>
                           <Button fullWidth onClick={handleStartCamera}>Permitir</Button>
                       </div>
                   )}
                   {cameraActive && (
                       <div className="relative bg-black rounded-xl overflow-hidden aspect-[3/4] mb-4">
                           <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>
                           <div className="absolute bottom-4 left-0 right-0 flex justify-center"><button onClick={handleCapture} className="w-16 h-16 bg-white rounded-full border-4 border-slate-300 shadow-lg"></button></div>
                       </div>
                   )}
                   {capturedImage && (
                       <div className="space-y-4">
                           <img src={capturedImage} className="w-full rounded-xl border border-slate-200" />
                           <div className="flex gap-2"><Button variant="outline" fullWidth onClick={handleRetake}>Refazer</Button><Button fullWidth onClick={() => confirmFinishJob()} disabled={loadingAction}>Enviar</Button></div>
                       </div>
                   )}
               </div>
           </div>
       )}
       
       {modalType === 'audit' && (
           <WorkerAuditModal onConfirm={(answers) => confirmFinishJob(answers)} onCancel={closeModal} />
       )}
       {modalType === 'cancel' && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
               <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl">
                   <h3 className="text-lg font-bold text-red-600 mb-2">Cancelar Serviço?</h3>
                   <textarea className="w-full p-3 bg-slate-100 rounded-lg text-sm mb-4 outline-none focus:ring-2 focus:ring-red-200" placeholder="Motivo..." rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                   <div className="flex gap-2"><Button variant="outline" fullWidth onClick={closeModal}>Voltar</Button><Button variant="danger" fullWidth onClick={confirmCancelJob} disabled={loadingAction}>Confirmar</Button></div>
               </div>
           </div>
       )}

       {appealModalOpen && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
               <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl">
                   <h3 className="text-lg font-bold text-slate-800 mb-2">Recorrer punição</h3>
                   <p className="text-sm text-slate-600 mb-4">Descreva o que aconteceu. Nossa equipe analisará seu recurso.</p>
                   <textarea className="w-full p-3 bg-slate-100 rounded-lg text-sm mb-4 outline-none focus:ring-2 focus:ring-red-200" placeholder="Sua justificativa..." rows={4} value={appealText} onChange={e => setAppealText(e.target.value)} />
                   <div className="flex gap-2"><Button variant="outline" fullWidth onClick={() => setAppealModalOpen(false)}>Cancelar</Button><Button fullWidth onClick={submitAppeal} disabled={loadingAction}>Enviar recurso</Button></div>
               </div>
           </div>
       )}
       {activeChatJobId && <ChatWindow jobId={activeChatJobId} currentUser={user} otherUserName={chatPartnerName} onClose={() => setActiveChatJobId(null)} />}
    </div>
  );
};