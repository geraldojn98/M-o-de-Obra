import React, { useState, useEffect, useRef } from 'react';
import { User, Job, ServiceCategory, POINTS_RULES, Coupon } from '../types';
import { Button } from '../components/Button';
import * as Icons from 'lucide-react';
import { supabase } from '../services/supabase';
import { ChatWindow } from '../components/ChatWindow';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import { WorkerProfileModal } from '../components/WorkerProfileModal';
import { LevelBadge } from '../components/LevelBadge';
import { EmptyState } from '../components/EmptyState';
import * as NotificationService from '../services/notifications';

/** Distância em km entre dois pontos (Fórmula de Haversine). */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

interface ClientDashboardProps {
  user: User;
  onNavigateToPartners: () => void;
  isGuest?: boolean;
}

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[100] flex items-center gap-3 animate-fade-in ${
        type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
        <span>{message}</span>
        <button onClick={onClose}><Icons.X size={16} /></button>
    </div>
);

const AuditModal: React.FC<{ onConfirm: (data: {q1: string, q2: string}) => void, onCancel: () => void }> = ({ onConfirm, onCancel }) => {
    const [q1, setQ1] = useState('');
    const [q2, setQ2] = useState('');

    return (
        <div className="fixed inset-0 bg-red-900/80 z-[200] flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                <div className="flex items-center gap-3 mb-4 text-red-600">
                    <Icons.ShieldAlert size={32} />
                    <h3 className="font-black text-xl">Verificação de Segurança</h3>
                </div>
                <p className="text-slate-600 text-sm mb-6">
                    Detectamos atividades atípicas entre você e este profissional (serviços consecutivos). 
                    Para validar este serviço e evitar bloqueios, responda:
                </p>
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Que materiais foram usados no serviço?</label>
                        <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-red-500" value={q1} onChange={e => setQ1(e.target.value)} placeholder="Ex: Fios, Cano PVC, Tinta..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descreva o resultado final</label>
                        <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-red-500" rows={2} value={q2} onChange={e => setQ2(e.target.value)} placeholder="Ex: Parede pintada de branco..." />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" fullWidth onClick={onCancel}>Cancelar</Button>
                    <Button fullWidth onClick={() => onConfirm({q1, q2})} disabled={!q1.trim() || !q2.trim()} className="bg-red-600 hover:bg-red-700 text-white">
                        Confirmar Veracidade
                    </Button>
                </div>
            </div>
        </div>
    );
};

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ user, onNavigateToPartners, isGuest }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'jobs'>('home');
  const [viewMode, setViewMode] = useState<'selection' | 'post_job' | 'find_pro'>('selection');
  
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [featuredCoupons, setFeaturedCoupons] = useState<Coupon[]>([]);
  
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [loading, setLoading] = useState(false);

  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobPrice, setJobPrice] = useState('');
  const [estimatedHours, setEstimatedHours] = useState<number>(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [otherCategoryInput, setOtherCategoryInput] = useState('');
  const [isAllCategories, setIsAllCategories] = useState(true);

  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState<number | null>(10); // 5, 10, 50, null = cidade toda
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);

  const [activeChatJobId, setActiveChatJobId] = useState<string | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState('');
  const [modalType, setModalType] = useState<'hire' | 'cancel' | 'rate' | 'audit' | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [hireTitle, setHireTitle] = useState('');
  const [hireDescription, setHireDescription] = useState('');
  const [hireEstimatedHours, setHireEstimatedHours] = useState<number>(1);
  const [cancelReason, setCancelReason] = useState('');
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingDuration, setRatingDuration] = useState('');
  const [ratingComment, setRatingComment] = useState('');
  const [profileModalWorker, setProfileModalWorker] = useState<any>(null);
  const [workerReviews, setWorkerReviews] = useState<any[]>([]);

  const [showCameraPermission, setShowCameraPermission] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [appealJobId, setAppealJobId] = useState<string | null>(null);
  const isPunished = user.active === false && user.punishment_until && new Date(user.punishment_until) > new Date();

  useEffect(() => {
    fetchData();
  }, [user.id, activeTab]);

  useEffect(() => {
      const handleOpenChat = (e: CustomEvent) => {
          if (isGuest) { setShowLoginRequiredModal(true); return; }
          setActiveChatJobId(e.detail.jobId);
          setChatPartnerName(e.detail.partnerName);
      };
      window.addEventListener('openChat', handleOpenChat as EventListener);
      return () => window.removeEventListener('openChat', handleOpenChat as EventListener);
  }, [isGuest]);

  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 4000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  useEffect(() => {
      if (cameraActive && mediaStream && videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(e => console.error("Error playing video:", e));
      }
  }, [cameraActive, mediaStream]);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  const fetchData = async () => {
    setLoading(true);
    // Categories
    const { data: cats } = await supabase.from('service_categories').select('*').order('name');
    if (cats) {
        // Ensure 'Outros' exists in the list for logic purposes
        const hasOutros = cats.some(c => c.name === 'Outros');
        if (!hasOutros) {
            cats.push({ id: 'custom-outros', name: 'Outros', icon: 'HelpCircle' });
        }
        setCategories(cats);
    }

    // Coupons (Active & Available) with Partner Info
    const { data: cData } = await supabase.from('coupons').select('*, partner:partners(name, logo_url, email)').eq('active', true).gt('available_quantity', 0).limit(3);
    
    if(cData) {
        // Obter avatares atualizados do profile
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

    // Jobs (apenas se logado)
    if (!user.id) {
      setJobs([]);
    } else {
    const { data: jobData } = await supabase
      .from('jobs')
      .select('*, worker:worker_id(full_name)')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false });

    if (jobData) {
      setJobs(jobData.map((j: any) => ({
        id: j.id,
        title: j.title,
        description: j.description,
        clientName: user.name,
        clientId: user.id,
        workerName: j.worker?.full_name,
        workerId: j.worker_id,
        status: j.status,
        price: j.price || 0,
        date: j.created_at,
        rating: j.rating,
        workerEvidence: j.worker_evidence_url,
        estimatedHours: j.estimated_hours || 1,
        isAudited: j.is_audited,
        auditData: j.audit_data
      })));
    } else {
      setJobs([]);
    }
    }
    setLoading(false);
  };

  const handleStartCamera = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setMediaStream(stream); setCameraActive(true); setShowCameraPermission(false);
    } catch (err) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setMediaStream(stream); setCameraActive(true); setShowCameraPermission(false);
        } catch (err2) { alert("Erro ao acessar câmera."); setShowCameraPermission(false); }
    }
  };

  const handleCapture = () => { if (videoRef.current) { const canvas = document.createElement("canvas"); canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight; const ctx = canvas.getContext("2d"); if (ctx) { ctx.drawImage(videoRef.current, 0, 0); setCapturedImage(canvas.toDataURL("image/jpeg")); stopCamera(); } } };
  const stopCamera = () => { if (mediaStream) mediaStream.getTracks().forEach(track => track.stop()); setMediaStream(null); setCameraActive(false); };
  const toggleCategory = (catName: string) => { setSelectedCategories(prev => { if (prev.includes(catName)) return prev.filter(c => c !== catName); return [...prev, catName]; }); if(isAllCategories) setIsAllCategories(false); };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPunished) return showToast('Sua conta está suspensa. Recorra à punição se achar injusto.', 'error');
    setLoading(true);

    let finalCategoryString = '';
    if (!isAllCategories) {
        const cats = [...selectedCategories];
        // Handle "Outros" logic: remove keyword "Outros" and replace with input text
        if (cats.includes('Outros')) {
             const othersIndex = cats.indexOf('Outros');
             if (othersIndex > -1) cats.splice(othersIndex, 1);
             cats.push(otherCategoryInput.trim() ? `Sugestão: ${otherCategoryInput.trim()}` : 'Outros');
        }
        if (cats.length === 0) {
            showToast("Selecione pelo menos uma categoria.", 'error');
            setLoading(false);
            return;
        }
        finalCategoryString = cats.join(', ');
    }

    const { data: insertedJob, error } = await supabase.from('jobs').insert({
        title: jobTitle,
        description: jobDesc,
        client_id: user.id,
        category_name: finalCategoryString,
        price: jobPrice ? parseFloat(jobPrice) : null,
        status: 'pending',
        city: user.city,
        state: user.state,
        latitude: user.latitude,
        longitude: user.longitude,
        estimated_hours: estimatedHours
    }).select().single();

    if (error) {
        showToast(error.message, 'error');
    } else if (insertedJob) {
        showToast('Pedido publicado com sucesso!', 'success');
        // Notificar todos os profissionais sobre o novo pedido
        await NotificationService.notifyWorkersNewJob(insertedJob.id, jobTitle, user.name, user.city);
        setJobTitle(''); setJobDesc(''); setJobPrice(''); setEstimatedHours(1);
        setSelectedCategories([]); setOtherCategoryInput(''); setIsAllCategories(true);
        setViewMode('selection');
        fetchData();
    }
    setLoading(false);
  };

  // ... (Other handlers unchanged: confirmHireDirect, confirmRating, processCompletion, modals)
  const confirmHireDirect = async () => {
    if (!selectedItem) return showToast("Selecione um profissional.", 'error');
    if (!hireTitle.trim()) return showToast("Informe o título do serviço.", 'error');
    if (!hireDescription.trim()) return showToast("Descreva o serviço.", 'error');
    setLoading(true);
    const worker = selectedItem;
    const { data: insertedJob, error } = await supabase.from('jobs').insert({
      title: hireTitle.trim(),
      description: hireDescription.trim(),
      client_id: user.id,
      worker_id: worker.id,
      status: 'pending',
      city: user.city,
      state: user.state,
      latitude: user.latitude,
      longitude: user.longitude,
      estimated_hours: hireEstimatedHours
    }).select().single();
    if (error) { 
      showToast(error.message, 'error'); 
    } else { 
      showToast(`Solicitação enviada para ${worker.full_name}!`, 'success');
      // Notificar o profissional sobre a proposta direta
      await NotificationService.notifyClientJobAccepted(worker.id, user.name, hireTitle.trim(), insertedJob.id);
      closeModal(); 
      setActiveTab('jobs'); 
      fetchData(); 
    }
    setLoading(false);
  };
  const confirmRating = async () => { if(selectedItem?.isAudited) { setModalType('audit'); return; } await processCompletion(); };
  const processCompletion = async (auditAnswers?: {q1: string, q2: string}) => {
    if (!selectedItem || !ratingDuration) return showToast("Informe o tempo de duração.", 'error');
    if (!ratingComment.trim()) return showToast("O comentário da avaliação é obrigatório.", 'error');
    setLoading(true);
    const job = selectedItem;
    const updates: any = { 
      status: 'completed', 
      rating: ratingScore, 
      review_comment: ratingComment.trim(), 
      duration_hours: parseFloat(ratingDuration), 
      client_evidence_url: capturedImage || 'https://via.placeholder.com/300?text=No+Photo', 
      completed_at: new Date().toISOString(),
      // Apagar a foto do profissional após avaliação
      worker_evidence_url: null
    };
    if (auditAnswers) {
      updates.audit_data = { ...job.auditData, client_q1: auditAnswers.q1, client_q2: auditAnswers.q2 };
      await supabase.from('profiles').update({ suspicious_flag: true }).eq('id', user.id);
    }
    const { error: pointsError } = await supabase.rpc('increment_points', { user_id: user.id, amount: POINTS_RULES.CLIENT_FIXED });
    if (pointsError) { await supabase.from('profiles').update({ points: user.points + POINTS_RULES.CLIENT_FIXED }).eq('id', user.id); }
    const { error: jobError } = await supabase.from('jobs').update(updates).eq('id', job.id);
    if (jobError) { showToast(jobError.message, 'error'); setLoading(false); return; }
    // Notificar o profissional sobre a confirmação e avaliação
    if (job.workerId && job.workerName) {
      await NotificationService.notifyWorkerJobCompleted(job.workerId, user.name, job.title, ratingScore);
    }
    showToast("Avaliação enviada!", 'success');
    closeModal();
    fetchData();
    setLoading(false);
  };
  const openRatingModal = (job: any) => { setSelectedItem(job); setModalType('rate'); setRatingScore(5); setRatingDuration(''); setRatingComment(''); setCapturedImage(null); stopCamera(); };
  const closeModal = () => { setModalType(null); setSelectedItem(null); stopCamera(); setShowCameraPermission(false); setRatingComment(''); };
  const LEVEL_ORDER: Record<string, number> = { diamond: 4, gold: 3, silver: 2, bronze: 1 };
  const fetchWorkersByCategory = async (category: string) => {
    setLoading(true); setSelectedCategory(category);
    let query = supabase.from('profiles').select('*').contains('allowed_roles', ['worker']).ilike('specialty', `%${category}%`);
    if (user.city) query = query.ilike('city', user.city);
    const { data } = await query;
    const list = (data || []).sort((a, b) => {
      const levelA = LEVEL_ORDER[a.level || 'bronze'] ?? 0;
      const levelB = LEVEL_ORDER[b.level || 'bronze'] ?? 0;
      if (levelB !== levelA) return levelB - levelA;
      return (b.rating ?? 0) - (a.rating ?? 0);
    });
    setWorkers(list); setLoading(false);
  };
  const openProfileModal = async (worker: any) => {
    setProfileModalWorker(worker);
    const { data } = await supabase.from('jobs').select('id, rating, review_comment, title, created_at').eq('worker_id', worker.id).eq('status', 'completed').not('rating', 'is', null).order('created_at', { ascending: false }).limit(20);
    setWorkerReviews(data || []);
  };
  const openChat = (jobId: string, partnerName: string) => {
    if (isGuest) { setShowLoginRequiredModal(true); return; }
    setActiveChatJobId(jobId); setChatPartnerName(partnerName);
  };
  const openHireModal = (worker: any) => {
    if (isGuest) { setShowLoginRequiredModal(true); return; }
    setSelectedItem(worker); setModalType('hire'); setHireTitle(''); setHireDescription(''); setHireEstimatedHours(1);
  };
  const openCancelModal = (job: any) => { setSelectedItem(job); setModalType('cancel'); setCancelReason(''); };
  const confirmCancelJob = async () => {
    if (!selectedItem || !cancelReason.trim()) return showToast("Informe o motivo.", 'error');
    setLoading(true);
    const job = selectedItem;
    const { error } = await supabase.from('jobs').update({ status: 'cancelled', cancellation_reason: cancelReason, cancelled_by: user.id }).eq('id', job.id);
    if (error) {
      showToast(error.message, 'error');
    } else {
      // Notificar o profissional sobre o cancelamento
      if (job.workerId && job.workerName) {
        await NotificationService.notifyWorkerJobCancelled(job.workerId, user.name, job.title, cancelReason);
      }
      closeModal();
      fetchData();
    }
    setLoading(false);
  };

  const openAppealModal = async () => {
    const { data: byClient } = await supabase.from('jobs').select('id').eq('client_id', user.id).eq('admin_verdict', 'punished').limit(1).maybeSingle();
    const { data: byWorker } = byClient ? { data: null } : await supabase.from('jobs').select('id').eq('worker_id', user.id).eq('admin_verdict', 'punished').limit(1).maybeSingle();
    const punishedJob = byClient || byWorker;
    setAppealJobId(punishedJob?.id || null);
    setAppealText('');
    setAppealModalOpen(true);
  };
  const submitAppeal = async () => {
    if (!appealText.trim()) return showToast('Descreva o que aconteceu.', 'error');
    if (!appealJobId) return showToast('Não foi possível vincular ao serviço.', 'error');
    setLoading(true);
    const { error } = await supabase.from('punishment_appeals').insert({ user_id: user.id, job_id: appealJobId, appeal_text: appealText.trim() });
    if (error) showToast(error.message, 'error');
    else { showToast('Recurso enviado. O admin analisará em breve.', 'success'); setAppealModalOpen(false); }
    setLoading(false);
  };
  
  const activeJobs = jobs.filter(j => ['pending', 'in_progress', 'waiting_verification'].includes(j.status));

  const filteredWorkers = React.useMemo(() => {
    if (!searchRadiusKm || user.latitude == null || user.longitude == null) return workers;
    return workers.filter((w: any) => {
      const wLat = w.latitude; const wLon = w.longitude;
      if (wLat == null || wLon == null) return true;
      return haversineKm(user.latitude!, user.longitude!, wLat, wLon) <= searchRadiusKm;
    });
  }, [workers, searchRadiusKm, user.latitude, user.longitude]);

  return (
    <div className="space-y-6 pb-20 sm:pb-0 relative">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {isPunished && (
        <div className="bg-red-100 text-red-800 p-4 rounded-xl border border-red-200 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="font-bold">Conta temporariamente suspensa</p>
            <p className="text-xs">Você não pode criar pedidos até {user.punishment_until ? new Date(user.punishment_until).toLocaleDateString() : ''}. Acha que foi um engano? Recorra.</p>
          </div>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-xl shrink-0" onClick={openAppealModal}>Recorrer punição</Button>
        </div>
      )}

      <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
        <Button variant={activeTab === 'home' ? 'primary' : 'outline'} onClick={() => setActiveTab('home')} size="sm" className="whitespace-nowrap">Início</Button>
        <Button variant={activeTab === 'jobs' ? 'primary' : 'outline'} onClick={() => setActiveTab('jobs')} size="sm" className="whitespace-nowrap">Meus Pedidos</Button>
      </div>

      {activeTab === 'home' && (
          <>
            {viewMode === 'selection' && (
                <div className="space-y-6 animate-fade-in">
                    
                    {/* Hero Section */}
                    <div className="bg-brand-orange text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2 text-white/80 text-xs uppercase font-bold"><Icons.MapPin size={14}/> {user.city}</div>
                            <h2 className="text-2xl font-bold leading-tight">O que vamos resolver hoje?</h2>
                            <div className="flex flex-col sm:flex-row gap-4 mt-6">
                                <button onClick={() => { if (isGuest) setShowLoginRequiredModal(true); else setViewMode('post_job'); }} className="flex-1 bg-white text-brand-orange py-5 px-6 rounded-xl font-bold hover:bg-orange-50 transition shadow-md flex flex-col items-center sm:items-start text-center sm:text-left"><span className="text-lg">Pedido Aberto</span></button>
                                <button onClick={() => setViewMode('find_pro')} className="flex-1 bg-brand-blue text-white py-5 px-6 rounded-xl font-bold hover:bg-blue-700 transition shadow-md border border-white/20 flex flex-col items-center sm:items-start text-center sm:text-left"><span className="text-lg">Escolher Profissional</span></button>
                            </div>
                        </div>
                    </div>

                    {/* COUPONS BANNER (Moved below buttons) */}
                    {featuredCoupons.length > 0 && (
                        <div className="overflow-x-auto no-scrollbar pb-2">
                            <h3 className="font-bold text-slate-500 text-xs uppercase mb-2">Descontos em Parceiros</h3>
                            <div className="flex gap-4 w-max">
                                {featuredCoupons.map(coupon => (
                                    <button 
                                        key={coupon.id} 
                                        onClick={onNavigateToPartners}
                                        className="w-72 bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 hover:border-brand-orange transition-colors text-left"
                                    >
                                        <div className="bg-white border border-slate-100 w-14 h-14 rounded-lg flex items-center justify-center shrink-0 p-1">
                                            {coupon.partnerLogo ? (
                                                <img src={coupon.partnerLogo} className="w-full h-full object-contain" />
                                            ) : (
                                                <Icons.Store size={24} className="text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-xs text-brand-orange truncate">{coupon.partnerName}</p>
                                            <p className="font-bold text-sm text-slate-800 line-clamp-1">{coupon.title}</p>
                                            <p className="text-xs text-slate-500 font-bold flex items-center gap-1"><Icons.Ticket size={10}/> {coupon.cost} pts</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {viewMode === 'post_job' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg">Criar Pedido</h3>
                        <button onClick={() => setViewMode('selection')} className="text-sm text-slate-500 hover:text-brand-orange">Cancelar</button>
                    </div>
                    <form onSubmit={handlePostJob} className="space-y-4">
                        <input value={jobTitle} onChange={e=>setJobTitle(e.target.value)} placeholder="Título (Ex: Consertar pia)" className="w-full px-4 py-3 bg-slate-50 border rounded-lg" required />
                        
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <label className="block text-xs font-bold text-blue-800 uppercase mb-2">Duração Estimada</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[1, 2, 4, 8].map(h => (
                                    <button key={h} type="button" onClick={() => setEstimatedHours(h)} className={`py-2 rounded-lg font-bold text-sm border transition-colors ${estimatedHours === h ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-blue-50'}`}>{h}h {h===8 ? '(Diária)' : ''}</button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                             <p className="text-sm font-bold text-slate-700 mb-2">Categoria</p>
                             <button type="button" onClick={() => { setIsAllCategories(true); setSelectedCategories([]); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold mb-2 flex items-center gap-2 ${isAllCategories ? 'bg-brand-orange text-white' : 'bg-white text-slate-500 border'}`}>
                                <Icons.Globe size={16}/> Qualquer Categoria
                             </button>
                             <button type="button" onClick={() => setIsAllCategories(false)} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold mb-3 flex items-center gap-2 ${!isAllCategories ? 'bg-brand-orange text-white' : 'bg-white text-slate-500 border'}`}>
                                <Icons.Filter size={16}/> Específicas
                             </button>
                             {!isAllCategories && (
                                 <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto p-1">
                                     {categories.map(cat => (
                                         <button key={cat.id} type="button" onClick={() => toggleCategory(cat.name)} className={`text-xs p-2 rounded border text-left flex items-center gap-2 ${selectedCategories.includes(cat.name) ? 'bg-blue-100 border-blue-300 text-blue-800 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>
                                            {selectedCategories.includes(cat.name) && <Icons.Check size={12}/>} {cat.name}
                                         </button>
                                     ))}
                                 </div>
                             )}
                             {!isAllCategories && selectedCategories.includes('Outros') && (
                                 <div className="mt-3 animate-fade-in">
                                     <input className="w-full mt-1 p-2 text-sm border rounded" placeholder="Qual a categoria?" value={otherCategoryInput} onChange={e => setOtherCategoryInput(e.target.value)} required />
                                 </div>
                             )}
                        </div>

                        <textarea value={jobDesc} onChange={e=>setJobDesc(e.target.value)} placeholder="Descreva detalhadamente..." className="w-full px-4 py-3 bg-slate-50 border rounded-lg h-32" required />
                        <input type="number" value={jobPrice} onChange={e=>setJobPrice(e.target.value)} placeholder="Orçamento (Opcional)" className="w-full px-4 py-3 bg-slate-50 border rounded-lg" />
                        <Button type="submit" fullWidth disabled={loading} size="lg">Publicar Pedido</Button>
                    </form>
                </div>
            )}
            
             {viewMode === 'find_pro' && (
                <div className="animate-fade-in space-y-4">
                     <div className="flex items-center gap-2 mb-4">
                        <button onClick={() => { setViewMode('selection'); setSelectedCategory(null); }} className="text-slate-500 hover:bg-slate-100 p-2 rounded-full"><Icons.ArrowLeft size={20}/></button>
                        <h3 className="font-bold text-lg">Encontrar Especialista</h3>
                    </div>
                     {!selectedCategory ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                            {categories.filter(c => c.name !== 'Outros').map(cat => (
                                <button key={cat.id} onClick={() => fetchWorkersByCategory(cat.name)} className="bg-white p-4 rounded-xl shadow-sm border hover:border-brand-orange flex flex-col items-center gap-2"><span className="font-medium text-xs">{cat.name}</span></button>
                            ))}
                        </div>
                    ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-500 uppercase">Raio de busca:</span>
                            {[
                              { value: 5, label: '5 km' },
                              { value: 10, label: '10 km' },
                              { value: 50, label: '50 km' },
                              { value: null, label: 'Cidade toda' },
                            ].map(({ value, label }) => (
                              <button
                                key={label}
                                type="button"
                                onClick={() => setSearchRadiusKm(value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${searchRadiusKm === value ? 'bg-brand-orange text-white border-brand-orange' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {loading ? (
                            <div className="py-8 text-center text-slate-400 text-sm">Carregando...</div>
                          ) : filteredWorkers.length === 0 ? (
                            <EmptyState icon={Icons.UserX} title="Nenhum profissional encontrado" description="Tente outro raio de busca ou outra categoria." />
                          ) : (
                            filteredWorkers.map((w: any) => {
                              const level = w.level || 'bronze';
                              return (
                                <div key={w.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                                  <button type="button" onClick={() => openProfileModal(w)} className="shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-orange rounded-full relative">
                                    <img src={w.avatar_url} alt="" className="w-12 h-12 rounded-full bg-slate-200 object-cover" />
                                    <div className="absolute -bottom-0.5 -right-0.5">
                                      <LevelBadge level={level} size="sm" />
                                    </div>
                                  </button>
                                  <button type="button" onClick={() => openProfileModal(w)} className="flex-1 min-w-0 text-left focus:outline-none focus:ring-0">
                                    <h4 className="font-bold truncate hover:text-brand-orange transition-colors">{w.full_name}</h4>
                                    <p className="text-xs text-slate-500 truncate">{w.specialty}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <StarRatingDisplay rating={w.rating ?? 0} size={14} />
                                      <span className="text-xs font-bold text-slate-600">{(w.rating ?? 0).toFixed(1)}</span>
                                    </div>
                                  </button>
                                  <Button size="sm" onClick={() => openHireModal(w)}>Contratar</Button>
                                </div>
                              );
                            })
                          )}
                        </>
                    )}
                </div>
            )}
          </>
      )}

      {activeTab === 'jobs' && (
        <div className="space-y-8 animate-fade-in">
           <div>
               <h3 className="font-bold text-lg text-brand-blue mb-4 flex items-center gap-2"><Icons.Briefcase size={20}/> Em Andamento</h3>
               {activeJobs.length === 0 ? (
                 <EmptyState icon={Icons.Briefcase} title="Nenhum pedido em andamento" description="Seus pedidos aparecerão aqui." />
               ) : activeJobs.map(job => (
                   <div key={job.id} className="bg-white p-4 rounded-xl shadow-sm border border-brand-blue/30 mb-4">
                       <div className="flex justify-between items-start">
                            <div><h4 className="font-bold text-lg">{job.title}</h4><p className="text-xs text-slate-400">{job.estimatedHours}h estimadas</p></div>
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">{job.status === 'waiting_verification' ? 'Verificar' : 'Andamento'}</span>
                       </div>
                       {job.status === 'waiting_verification' && (
                           <div className="mt-4 bg-purple-50 p-4 rounded-lg border border-purple-100">
                               <p className="text-sm font-bold text-purple-800 mb-2">Serviço Finalizado!</p>
                               {job.isAudited && <p className="text-xs text-red-500 font-bold mb-2 flex items-center gap-1"><Icons.AlertTriangle size={12}/> Auditoria Necessária</p>}
                               <Button fullWidth onClick={() => openRatingModal(job)}>Confirmar e Avaliar</Button>
                           </div>
                       )}
                       {job.status !== 'waiting_verification' && (
                            <div className="mt-4 pt-4 border-t border-slate-50 flex flex-wrap justify-end gap-2">
                                <Button type="button" variant="danger" size="sm" onClick={() => openCancelModal(job)} className="flex items-center gap-2"><Icons.XCircle size={16} /> Cancelar</Button>
                                {job.workerId && <Button variant="secondary" size="sm" onClick={() => openChat(job.id, job.workerName!)} className="flex items-center gap-2"><Icons.MessageCircle size={16} /> Chat</Button>}
                            </div>
                       )}
                   </div>
               ))}
           </div>
        </div>
      )}

      {showLoginRequiredModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl text-center">
            <Icons.LogIn size={40} className="mx-auto text-brand-orange mb-3" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">Faça login para continuar</h3>
            <p className="text-sm text-slate-600 mb-4">Entre na sua conta para contratar ou conversar com profissionais.</p>
            <Button fullWidth onClick={() => setShowLoginRequiredModal(false)}>Entendi</Button>
          </div>
        </div>
      )}

      {modalType === 'hire' && selectedItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
               <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl my-auto">
                   <h3 className="text-lg font-bold text-slate-800 mb-4">Contratar {selectedItem.full_name}</h3>
                   <div className="space-y-4 mb-4">
                     <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título do serviço</label>
                       <input className="w-full p-3 bg-slate-50 border rounded-lg outline-none focus:ring-2 focus:ring-brand-orange" placeholder="Ex: Consertar pia da cozinha" value={hireTitle} onChange={e => setHireTitle(e.target.value)} />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição do serviço</label>
                       <textarea className="w-full p-3 bg-slate-50 border rounded-lg outline-none focus:ring-2 focus:ring-brand-orange" placeholder="Descreva o que precisa ser feito..." rows={3} value={hireDescription} onChange={e => setHireDescription(e.target.value)} />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tempo estimado</label>
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                         {[
                           { h: 1, label: '1h' },
                           { h: 2, label: '2h' },
                           { h: 4, label: '4h' },
                           { h: 8, label: '8h' },
                           { h: 24, label: 'Mais de 1 dia' }
                         ].map(({ h, label }) => (
                           <button key={h} type="button" onClick={() => setHireEstimatedHours(h)} className={`py-2 rounded-lg font-bold text-sm border transition-colors ${hireEstimatedHours === h ? 'bg-brand-orange text-white border-brand-orange' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{label}</button>
                         ))}
                       </div>
                     </div>
                   </div>
                   <div className="flex gap-2"><Button variant="outline" fullWidth onClick={closeModal}>Voltar</Button><Button fullWidth onClick={confirmHireDirect} disabled={loading || !hireTitle.trim() || !hireDescription.trim()}>Enviar Proposta</Button></div>
               </div>
          </div>
      )}
      {modalType === 'rate' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
              <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4 my-auto">
                  <h3 className="text-lg font-bold text-slate-800">Avaliar Serviço</h3>
                  
                  {/* Foto do profissional */}
                  {selectedItem?.workerEvidence && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <p className="text-xs font-bold text-slate-600 mb-2 uppercase">Foto do Serviço Finalizado</p>
                      <div className="relative w-full aspect-video bg-slate-100 rounded-lg overflow-hidden">
                        <img 
                          src={selectedItem.workerEvidence} 
                          alt="Foto do serviço finalizado pelo profissional" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Foto enviada pelo profissional ao finalizar o serviço</p>
                    </div>
                  )}
                  
                  <div className="flex justify-center gap-2 my-4">
                        {[1,2,3,4,5].map(s => (<button key={s} onClick={() => setRatingScore(s)} className={`text-3xl ${s <= ratingScore ? 'text-yellow-400' : 'text-slate-200'}`}>★</button>))}
                    </div>
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Duração Real (Horas)</label><input type="number" value={ratingDuration} onChange={e => setRatingDuration(e.target.value)} className="w-full border rounded p-3" placeholder="Ex: 2.5" /></div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Comentário <span className="text-red-500">*</span></label>
                      <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)} className="w-full border rounded p-3 outline-none focus:ring-2 focus:ring-brand-orange" placeholder="Como foi o serviço? Deixe um comentário..." rows={3} required />
                    </div>
                  <div className="flex gap-2 pt-2"><Button variant="outline" fullWidth onClick={closeModal}>Voltar</Button><Button fullWidth onClick={() => confirmRating()} disabled={loading || !ratingComment.trim()}>Confirmar</Button></div>
              </div>
          </div>
      )}
      {modalType === 'audit' && (
          <AuditModal onConfirm={(answers) => processCompletion(answers)} onCancel={closeModal} />
      )}
      {appealModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Recorrer punição</h3>
                  <p className="text-sm text-slate-600 mb-4">Descreva o que aconteceu. Nossa equipe analisará seu recurso.</p>
                  <textarea className="w-full p-3 bg-slate-100 rounded-lg text-sm mb-4 outline-none focus:ring-2 focus:ring-brand-orange" placeholder="Sua justificativa..." rows={4} value={appealText} onChange={e => setAppealText(e.target.value)} />
                  <div className="flex gap-2"><Button variant="outline" fullWidth onClick={() => setAppealModalOpen(false)}>Cancelar</Button><Button fullWidth onClick={submitAppeal} disabled={loading}>Enviar recurso</Button></div>
              </div>
          </div>
      )}
      {activeChatJobId && !isGuest && <ChatWindow jobId={activeChatJobId} currentUser={user} otherUserName={chatPartnerName} onClose={() => setActiveChatJobId(null)} />}
      {profileModalWorker && (
        <WorkerProfileModal
          worker={profileModalWorker}
          reviews={workerReviews}
          onHire={() => { setProfileModalWorker(null); openHireModal(profileModalWorker); }}
          onClose={() => { setProfileModalWorker(null); setWorkerReviews([]); }}
        />
      )}
    </div>
  );
};