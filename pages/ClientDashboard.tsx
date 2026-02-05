import React, { useState, useEffect, useRef } from 'react';
import { User, Job, ServiceCategory } from '../types';
import { Button } from '../components/Button';
import * as Icons from 'lucide-react';
import { supabase } from '../services/supabase';
import { ChatWindow } from '../components/ChatWindow';

interface ClientDashboardProps {
  user: User;
}

// Simple Toast Notification Component
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[100] flex items-center gap-3 animate-fade-in ${
        type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
        <span>{message}</span>
        <button onClick={onClose}><Icons.X size={16} /></button>
    </div>
);

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'jobs'>('home');
  const [viewMode, setViewMode] = useState<'selection' | 'post_job' | 'find_pro'>('selection');
  
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  
  // UI State
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [loading, setLoading] = useState(false);

  // Job Post State
  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobPrice, setJobPrice] = useState('');
  // Multi-Select Categories
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [otherCategoryInput, setOtherCategoryInput] = useState('');
  const [isAllCategories, setIsAllCategories] = useState(true);

  // Find Pro State
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Chat State
  const [activeChatJobId, setActiveChatJobId] = useState<string | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState('');

  // Modals
  const [modalType, setModalType] = useState<'hire' | 'cancel' | 'rate' | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null); // Can be Worker or Job
  
  // Form States for Modals
  const [hireDescription, setHireDescription] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingDuration, setRatingDuration] = useState('');

  // Camera State
  const [showCameraPermission, setShowCameraPermission] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchData();
  }, [user.id, activeTab]);

  useEffect(() => {
      // Listen for chat redirects from Notifications
      const handleOpenChat = (e: CustomEvent) => {
          setActiveChatJobId(e.detail.jobId);
          setChatPartnerName(e.detail.partnerName);
      };
      window.addEventListener('openChat', handleOpenChat as EventListener);
      return () => window.removeEventListener('openChat', handleOpenChat as EventListener);
  }, []);

  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 4000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  // Race Condition Fix: Effect to attach stream when video element is ready
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
    if (cats) setCategories(cats);

    // Jobs
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
        rating: j.rating
      })));
    }
    setLoading(false);
  };

  // --- CAMERA FUNCTIONS ---

  const handleStartCamera = async () => {
    try {
        // Attempt 1: Prefer rear camera
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        setMediaStream(stream);
        setCameraActive(true);
        setShowCameraPermission(false);
    } catch (err) {
        // Attempt 2: Fallback to any camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setMediaStream(stream);
            setCameraActive(true);
            setShowCameraPermission(false);
        } catch (err2) {
            alert("Erro ao acessar câmera. Verifique permissões.");
            setShowCameraPermission(false);
        }
    }
  };

  const handleCapture = () => {
    if (videoRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            const dataUrl = canvas.toDataURL("image/jpeg");
            setCapturedImage(dataUrl);
            stopCamera();
        }
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    setMediaStream(null);
    setCameraActive(false);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    handleStartCamera();
  };

  // --- CATEGORY HANDLER ---
  const toggleCategory = (catName: string) => {
      setSelectedCategories(prev => {
          if (prev.includes(catName)) return prev.filter(c => c !== catName);
          return [...prev, catName];
      });
      if(isAllCategories) setIsAllCategories(false);
  };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let finalCategoryString = '';
    
    if (isAllCategories) {
        finalCategoryString = ''; // Empty means visible to all
    } else {
        const cats = [...selectedCategories];
        // Handle "Outros"
        if (cats.includes('Outros')) {
             const othersIndex = cats.indexOf('Outros');
             if (othersIndex > -1) cats.splice(othersIndex, 1); // Remove raw "Outros"
             if (otherCategoryInput.trim()) {
                 cats.push(`Sugestão: ${otherCategoryInput.trim()}`);
             } else {
                 cats.push('Outros');
             }
        }
        if (cats.length === 0) {
            showToast("Selecione pelo menos uma categoria.", 'error');
            setLoading(false);
            return;
        }
        finalCategoryString = cats.join(', ');
    }

    const { error } = await supabase.from('jobs').insert({
        title: jobTitle,
        description: jobDesc,
        client_id: user.id,
        category_name: finalCategoryString,
        price: jobPrice ? parseFloat(jobPrice) : null,
        status: 'pending'
    });

    if (error) {
        showToast(error.message, 'error');
    } else {
        showToast('Pedido publicado com sucesso!', 'success');
        setJobTitle(''); setJobDesc(''); setJobPrice(''); 
        setSelectedCategories([]); setOtherCategoryInput(''); setIsAllCategories(true);
        setViewMode('selection');
        fetchData();
    }
    setLoading(false);
  };

  // --- ACTIONS ---

  const confirmHireDirect = async () => {
      if (!selectedItem || !hireDescription.trim()) {
          showToast("Descreva o serviço.", 'error');
          return;
      }
      setLoading(true);
      const worker = selectedItem;

      const { error } = await supabase.from('jobs').insert({
          title: `Serviço Direto: ${worker.full_name}`,
          description: hireDescription,
          client_id: user.id,
          worker_id: worker.id,
          status: 'pending'
      });

      if (error) {
          showToast(error.message, 'error');
      } else {
           // With new RLS, this will work
           await supabase.from('notifications').insert({
                 user_id: worker.id,
                 title: 'Nova Proposta Direta',
                 message: `${user.name} quer te contratar: ${hireDescription}`,
                 type: 'job_update',
                 action_link: JSON.stringify({screen: 'jobs'})
             });
          showToast(`Solicitação enviada para ${worker.full_name}!`, 'success');
          closeModal();
          setActiveTab('jobs');
          fetchData();
      }
      setLoading(false);
  };

  const confirmCancelJob = async () => {
    if (!selectedItem || !cancelReason.trim()) {
        showToast("Informe o motivo.", 'error');
        return;
    }

    setLoading(true);
    const jobId = selectedItem.id;

    const { error } = await supabase
      .from('jobs')
      .update({ 
          status: 'cancelled',
          cancellation_reason: cancelReason,
          cancelled_by: user.id
      })
      .eq('id', jobId);

    if (error) {
        showToast(error.message, 'error');
    } else {
        const job = jobs.find(j => j.id === jobId);
        if (job && job.workerId) {
            // With new RLS, this will work
            await supabase.from('notifications').insert({
                 user_id: job.workerId,
                 title: 'Serviço Cancelado pelo Cliente',
                 message: `O cliente cancelou o serviço: ${cancelReason}`,
                 type: 'info',
                 action_link: JSON.stringify({screen: 'history'})
             });
        }
        showToast('Serviço cancelado.', 'success');
        closeModal();
        fetchData();
    }
    setLoading(false);
  };

  const confirmRating = async () => {
      if (!selectedItem || !ratingDuration) {
          showToast("Informe o tempo de duração.", 'error');
          return;
      }
      
      setLoading(true);
      const job = selectedItem;
      
      const { error: jobError } = await supabase
        .from('jobs')
        .update({
            status: 'completed',
            rating: ratingScore,
            duration_hours: parseFloat(ratingDuration),
            client_evidence_url: capturedImage || 'https://via.placeholder.com/300?text=No+Photo'
        })
        .eq('id', job.id);

      if (jobError) {
          showToast(jobError.message, 'error');
          setLoading(false);
          return;
      }

      showToast("Avaliação enviada! Pontos creditados automaticamente.", 'success');
      closeModal();
      fetchData();
      setLoading(false);
  };

  // --- MODAL HELPERS ---
  const openHireModal = (worker: any) => {
      setSelectedItem(worker);
      setModalType('hire');
      setHireDescription('');
  };

  const openCancelModal = (job: any) => {
      setSelectedItem(job);
      setModalType('cancel');
      setCancelReason('');
  };

  const openRatingModal = (job: any) => {
      setSelectedItem(job);
      setModalType('rate');
      setRatingScore(5);
      setRatingDuration('');
      setCapturedImage(null);
      stopCamera();
  };

  const closeModal = () => {
      setModalType(null);
      setSelectedItem(null);
      stopCamera();
      setShowCameraPermission(false);
  };

  const fetchWorkersByCategory = async (category: string) => {
      setLoading(true);
      setSelectedCategory(category);
      // Filter logic: worker specialty contains the category
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .contains('allowed_roles', ['worker'])
        .ilike('specialty', `%${category}%`); // Simple matching
      
      setWorkers(data || []);
      setLoading(false);
  };

  const openChat = (jobId: string, partnerName: string) => {
    setActiveChatJobId(jobId);
    setChatPartnerName(partnerName);
  };

  // Filter Jobs
  const activeJobs = jobs.filter(j => ['pending', 'in_progress', 'waiting_verification'].includes(j.status));
  const historyJobs = jobs.filter(j => ['completed', 'cancelled'].includes(j.status));

  return (
    <div className="space-y-6 pb-20 sm:pb-0 relative">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
        <Button variant={activeTab === 'home' ? 'primary' : 'outline'} onClick={() => setActiveTab('home')} size="sm" className="whitespace-nowrap">Início</Button>
        <Button variant={activeTab === 'jobs' ? 'primary' : 'outline'} onClick={() => setActiveTab('jobs')} size="sm" className="whitespace-nowrap">Meus Pedidos</Button>
      </div>

      {activeTab === 'home' && (
          <>
            {viewMode === 'selection' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-brand-orange text-white p-6 rounded-2xl shadow-lg">
                        <h2 className="text-2xl font-bold leading-tight">O que vamos resolver hoje?</h2>
                        <div className="flex flex-col sm:flex-row gap-4 mt-6">
                            <button 
                                onClick={() => setViewMode('post_job')}
                                className="flex-1 bg-white text-brand-orange py-5 px-6 rounded-xl font-bold hover:bg-orange-50 transition shadow-md flex flex-col items-center sm:items-start text-center sm:text-left"
                            >
                                <span className="text-lg">Pedido Aberto</span>
                                <span className="text-xs font-normal opacity-80 mt-1">Visível para profissionais</span>
                            </button>
                            <button 
                                onClick={() => setViewMode('find_pro')}
                                className="flex-1 bg-brand-blue text-white py-5 px-6 rounded-xl font-bold hover:bg-blue-700 transition shadow-md border border-white/20 flex flex-col items-center sm:items-start text-center sm:text-left"
                            >
                                <span className="text-lg">Escolher Profissional</span>
                                <span className="text-xs font-normal opacity-80 mt-1">Busque por categoria específica</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'post_job' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg">Criar Pedido</h3>
                        <button onClick={() => setViewMode('selection')} className="text-sm text-slate-500 hover:text-brand-orange">Cancelar</button>
                    </div>
                    <form onSubmit={handlePostJob} className="space-y-4">
                        <input value={jobTitle} onChange={e=>setJobTitle(e.target.value)} placeholder="Título do Pedido (Ex: Consertar pia)" className="w-full px-4 py-3 bg-slate-50 border rounded-lg" required />
                        
                        {/* Category Selection */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                             <p className="text-sm font-bold text-slate-700 mb-2">Para quem este pedido deve aparecer?</p>
                             
                             <button 
                                type="button" 
                                onClick={() => { setIsAllCategories(true); setSelectedCategories([]); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold mb-2 flex items-center gap-2 ${isAllCategories ? 'bg-brand-orange text-white' : 'bg-white text-slate-500 border'}`}
                             >
                                <Icons.Globe size={16}/> Qualquer Categoria (Visível para todos)
                             </button>

                             <button 
                                type="button" 
                                onClick={() => setIsAllCategories(false)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold mb-3 flex items-center gap-2 ${!isAllCategories ? 'bg-brand-orange text-white' : 'bg-white text-slate-500 border'}`}
                             >
                                <Icons.Filter size={16}/> Categorias Específicas
                             </button>
                             
                             {!isAllCategories && (
                                 <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto p-1">
                                     {categories.map(cat => (
                                         <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => toggleCategory(cat.name)}
                                            className={`text-xs p-2 rounded border text-left flex items-center gap-2 ${selectedCategories.includes(cat.name) ? 'bg-blue-100 border-blue-300 text-blue-800 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}
                                         >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedCategories.includes(cat.name) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                                {selectedCategories.includes(cat.name) && <Icons.Check size={12} className="text-white"/>}
                                            </div>
                                            {cat.name}
                                         </button>
                                     ))}
                                 </div>
                             )}

                             {!isAllCategories && selectedCategories.includes('Outros') && (
                                 <div className="mt-3 animate-fade-in">
                                     <label className="text-xs font-bold text-slate-500 uppercase">Qual categoria seria apropriada?</label>
                                     <input 
                                        className="w-full mt-1 p-2 text-sm border rounded focus:ring-1 focus:ring-brand-orange outline-none" 
                                        placeholder="Ex: Piscineiro, Vidraceiro..."
                                        value={otherCategoryInput}
                                        onChange={e => setOtherCategoryInput(e.target.value)}
                                        required
                                     />
                                     <p className="text-[10px] text-slate-400 mt-1">Essa informação será enviada como sugestão ao administrador.</p>
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
                            {categories.filter(c => c.name !== 'Outros').map(cat => {
                                const Icon = (Icons as any)[cat.icon] || Icons.HelpCircle;
                                return (
                                    <button key={cat.id} onClick={() => fetchWorkersByCategory(cat.name)} className="bg-white p-4 rounded-xl shadow-sm border hover:border-brand-orange flex flex-col items-center gap-2 transition-all active:scale-95">
                                        <div className="bg-brand-lightOrange p-3 rounded-full text-brand-orange"><Icon size={24}/></div>
                                        <span className="font-medium text-xs sm:text-sm text-center">{cat.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <button onClick={() => setSelectedCategory(null)} className="text-sm text-brand-orange mb-2 font-medium">Alterar Categoria</button>
                            {workers.length === 0 && !loading && <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl">Nenhum profissional encontrado.</div>}
                            {workers.map(w => (
                                <div key={w.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                                    <img src={w.avatar_url} className="w-12 h-12 rounded-full bg-slate-200 object-cover" />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold truncate">{w.full_name}</h4>
                                        <p className="text-xs text-slate-500 truncate">{w.specialty}</p>
                                        <div className="flex items-center gap-1 text-xs text-yellow-600 mt-1"><Icons.Star size={12}/> {w.rating}</div>
                                    </div>
                                    <Button size="sm" onClick={() => openHireModal(w)}>Contratar</Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
          </>
      )}

      {activeTab === 'jobs' && (
        <div className="space-y-8 animate-fade-in">
           {/* SECTION 1: ACTIVE JOBS */}
           <div>
               <h3 className="font-bold text-lg text-brand-blue mb-4 flex items-center gap-2">
                    <Icons.Briefcase size={20}/> Em Andamento
               </h3>
               {activeJobs.length === 0 ? (
                   <div className="text-center p-6 bg-slate-50 rounded-lg text-slate-400 text-sm">Nenhum pedido em andamento.</div>
               ) : (
                   <div className="space-y-4">
                       {activeJobs.map(job => (
                           <div key={job.id} className="bg-white p-4 rounded-xl shadow-sm border border-brand-blue/30">
                               <div className="flex justify-between items-start">
                                   <div>
                                       <h4 className="font-bold text-lg">{job.title}</h4>
                                       <p className="text-sm text-slate-600 mb-2 line-clamp-2">{job.description}</p>
                                       <p className="text-xs text-slate-400">Profissional: <span className="font-bold text-slate-700">{job.workerName || 'Aguardando...'}</span></p>
                                   </div>
                                   <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ml-2 ${
                                       job.status === 'waiting_verification' ? 'bg-purple-100 text-purple-700' :
                                       job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                       'bg-yellow-100 text-yellow-700'
                                   }`}>
                                       {job.status === 'waiting_verification' ? 'Verificar' :
                                        job.status === 'in_progress' ? 'Andamento' : 'Pendente'}
                                   </span>
                               </div>
                               
                               {/* Verification Action */}
                               {job.status === 'waiting_verification' && (
                                   <div className="mt-4 bg-purple-50 p-4 rounded-lg border border-purple-100">
                                       <p className="text-sm font-bold text-purple-800 mb-2">Serviço Finalizado!</p>
                                       <p className="text-xs text-purple-600 mb-4">O profissional marcou como concluído. Avalie para liberar os pontos.</p>
                                       <Button fullWidth onClick={() => openRatingModal(job)}>Confirmar e Avaliar</Button>
                                   </div>
                               )}

                               <div className="mt-4 pt-4 border-t border-slate-50 flex flex-wrap justify-end gap-2">
                                   <Button 
                                    type="button"
                                    variant="danger" 
                                    size="sm" 
                                    onClick={() => openCancelModal(job)} 
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2"
                                    disabled={loading}
                                   >
                                       <Icons.XCircle size={16} /> Cancelar
                                   </Button>
                                   {job.workerId && (
                                       <Button variant="secondary" size="sm" onClick={() => openChat(job.id, job.workerName!)} className="flex-1 sm:flex-none flex items-center justify-center gap-2">
                                           <Icons.MessageCircle size={16} /> Chat
                                       </Button>
                                   )}
                               </div>
                           </div>
                       ))}
                   </div>
               )}
           </div>

           {/* SECTION 2: HISTORY */}
           <div>
               <h3 className="font-bold text-lg text-slate-500 mb-4 flex items-center gap-2">
                    <Icons.Archive size={20}/> Histórico
               </h3>
               {historyJobs.length === 0 ? (
                   <div className="text-center p-6 bg-slate-50 rounded-lg text-slate-400 text-sm">Nenhum pedido no histórico.</div>
               ) : (
                   <div className="space-y-4 opacity-80 hover:opacity-100 transition-opacity">
                       {historyJobs.map(job => (
                           <div key={job.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                               <div className="flex justify-between items-start">
                                   <div>
                                       <h4 className="font-bold text-base text-slate-700">{job.title}</h4>
                                       <p className="text-xs text-slate-500">
                                           {job.status === 'completed' ? `Concluído em ${new Date(job.date).toLocaleDateString()}` : `Cancelado em ${new Date(job.date).toLocaleDateString()}`}
                                       </p>
                                   </div>
                                   <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ml-2 ${
                                       job.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                   }`}>
                                       {job.status === 'completed' ? 'Concluído' : 'Cancelado'}
                                   </span>
                               </div>
                           </div>
                       ))}
                   </div>
               )}
           </div>
        </div>
      )}

      {/* MODALS */}
      {modalType === 'hire' && selectedItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
               <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl">
                   <h3 className="text-lg font-bold text-slate-800 mb-2">Contratar Profissional</h3>
                   <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
                       <img src={selectedItem.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                       <div>
                           <p className="font-bold text-sm">{selectedItem.full_name}</p>
                           <p className="text-xs text-slate-500">{selectedItem.specialty}</p>
                       </div>
                   </div>
                   <p className="text-sm text-slate-600 mb-2">Descreva o que você precisa:</p>
                   <textarea 
                        className="w-full p-3 bg-slate-100 rounded-lg text-sm mb-4 outline-none focus:ring-2 focus:ring-brand-blue"
                        placeholder="Ex: Preciso instalar um ventilador de teto..."
                        rows={3}
                        value={hireDescription}
                        onChange={e => setHireDescription(e.target.value)}
                   />
                   <div className="flex gap-2">
                       <Button variant="outline" fullWidth onClick={closeModal}>Voltar</Button>
                       <Button fullWidth onClick={confirmHireDirect} disabled={loading}>
                           {loading ? '...' : 'Enviar Proposta'}
                       </Button>
                   </div>
               </div>
          </div>
      )}

      {modalType === 'cancel' && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
               <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl">
                   <h3 className="text-lg font-bold text-red-600 mb-2">Cancelar Pedido?</h3>
                   <p className="text-sm text-slate-600 mb-4">Essa ação é irreversível. Diga o motivo:</p>
                   <textarea 
                        className="w-full p-3 bg-slate-100 rounded-lg text-sm mb-4 outline-none focus:ring-2 focus:ring-red-200"
                        placeholder="Motivo..."
                        rows={3}
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                   />
                   <div className="flex gap-2">
                       <Button variant="outline" fullWidth onClick={closeModal}>Voltar</Button>
                       <Button variant="danger" fullWidth onClick={confirmCancelJob} disabled={loading}>
                           {loading ? '...' : 'Confirmar'}
                       </Button>
                   </div>
               </div>
           </div>
      )}

      {modalType === 'rate' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
              <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4 my-auto">
                  <h3 className="text-lg font-bold text-slate-800">Avaliar Serviço</h3>
                  
                  {!cameraActive && !showCameraPermission && !capturedImage && (
                    <>
                        <div className="flex justify-center gap-2 my-4">
                            {[1,2,3,4,5].map(s => (
                                <button key={s} onClick={() => setRatingScore(s)} className={`text-3xl ${s <= ratingScore ? 'text-yellow-400' : 'text-slate-200'}`}>★</button>
                            ))}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Duração Real (Horas)</label>
                            <input type="number" value={ratingDuration} onChange={e => setRatingDuration(e.target.value)} className="w-full border rounded p-3" placeholder="Ex: 2.5" />
                        </div>
                        
                        <div 
                            className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center text-slate-400 bg-slate-50 cursor-pointer hover:bg-slate-100 transition"
                            onClick={() => setShowCameraPermission(true)}
                        >
                            <Icons.Camera size={24} className="mb-2"/>
                            <span className="text-xs">Foto do Resultado (Opcional)</span>
                        </div>
                    </>
                  )}

                   {showCameraPermission && (
                       <div className="animate-fade-in text-center">
                           <div className="w-16 h-16 bg-orange-100 text-brand-orange rounded-full flex items-center justify-center mx-auto mb-4">
                                <Icons.Camera size={32} />
                            </div>
                           <h3 className="text-xl font-bold mb-2">Permitir Câmera?</h3>
                           <p className="text-slate-500 text-sm mb-6">Precisamos acessar sua câmera para registrar a foto do serviço.</p>
                           <div className="space-y-2">
                               <Button fullWidth onClick={handleStartCamera}>Permitir Acesso</Button>
                               <Button variant="outline" fullWidth onClick={() => setShowCameraPermission(false)}>Voltar</Button>
                           </div>
                       </div>
                   )}

                   {cameraActive && (
                       <div className="relative bg-black rounded-xl overflow-hidden aspect-[3/4] mb-4">
                           <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>
                           <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                               <button onClick={handleCapture} className="w-16 h-16 bg-white rounded-full border-4 border-slate-300 shadow-lg active:scale-95 transition-transform"></button>
                           </div>
                       </div>
                   )}

                   {capturedImage && (
                       <div className="relative aspect-square rounded-xl overflow-hidden border border-slate-200">
                            <img src={capturedImage} className="w-full h-full object-cover" />
                            <button onClick={handleRetake} className="absolute bottom-2 right-2 bg-white/90 p-2 rounded-full shadow text-slate-700 font-bold text-xs flex items-center gap-1">
                                <Icons.RefreshCw size={14}/> Refazer
                            </button>
                       </div>
                   )}

                  <div className="flex gap-2 pt-2">
                      <Button variant="outline" fullWidth onClick={closeModal}>Voltar</Button>
                      <Button fullWidth onClick={confirmRating} disabled={loading || cameraActive || showCameraPermission}>
                        {loading ? '...' : 'Confirmar'}
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {activeChatJobId && (
          <ChatWindow 
            jobId={activeChatJobId} 
            currentUser={user} 
            otherUserName={chatPartnerName} 
            onClose={() => setActiveChatJobId(null)} 
          />
      )}
    </div>
  );
};