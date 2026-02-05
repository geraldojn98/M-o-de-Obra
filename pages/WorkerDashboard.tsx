import React, { useState, useEffect, useRef } from 'react';
import { User, Job, ServiceCategory } from '../types';
import { Button } from '../components/Button';
import { Camera, CheckCircle, MessageCircle, XCircle, Clock, AlertTriangle, X, RefreshCw, Check } from 'lucide-react';
import { supabase } from '../services/supabase';
import { ChatWindow } from '../components/ChatWindow';

interface WorkerDashboardProps {
  user: User;
}

// Simple Toast Notification Component
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[100] flex items-center gap-3 animate-fade-in ${
        type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
        <span>{message}</span>
        <button onClick={onClose}><X size={16} /></button>
    </div>
);

// Specialty Selection Modal for First Time
const SpecialtySelectionModal: React.FC<{ userId: string, onSave: () => void }> = ({ userId, onSave }) => {
    const [categories, setCategories] = useState<ServiceCategory[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [otherText, setOtherText] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch all categories including 'Outros'
        supabase.from('service_categories').select('*').order('name').then(({data}) => {
            if(data) setCategories(data);
        });
    }, []);

    const toggle = (name: string) => {
        if(selected.includes(name)) setSelected(p => p.filter(s => s !== name));
        else if (selected.length < 3) setSelected(p => [...p, name]);
    };

    const handleSave = async () => {
        if(selected.length === 0) return alert("Selecione pelo menos uma especialidade.");
        if(selected.includes('Outros') && !otherText.trim()) return alert("Por favor, digite qual é a sua outra especialidade.");

        setLoading(true);
        
        // Prepare string
        const finalSelection = selected.filter(s => s !== 'Outros');
        if (selected.includes('Outros')) {
            finalSelection.push(`Sugestão: ${otherText.trim()}`);
        }

        const { error } = await supabase.from('profiles').update({ specialty: finalSelection.join(', ') }).eq('id', userId);
        if(!error) {
            onSave();
        } else {
            alert("Erro: " + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-y-auto max-h-[90vh]">
                <h3 className="font-black text-2xl text-slate-800 mb-2">Qual sua especialidade?</h3>
                <p className="text-slate-500 text-sm mb-4">
                    Selecione as categorias de serviço que você realiza.
                </p>
                <div className="bg-orange-50 text-orange-800 text-xs p-3 rounded-xl mb-4 font-bold border border-orange-100">
                    Você pode marcar até 3 especialidades, mas recomendamos apenas uma para que você seja melhor avaliado.
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4 p-1">
                    {categories.map(cat => (
                        <button 
                            key={cat.id}
                            onClick={() => toggle(cat.name)}
                            className={`p-3 rounded-xl text-xs font-bold text-left flex items-center justify-between border transition-all ${
                                selected.includes(cat.name) 
                                ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-blue-200' 
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            } ${(!selected.includes(cat.name) && selected.length >= 3) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!selected.includes(cat.name) && selected.length >= 3}
                        >
                            {cat.name}
                            {selected.includes(cat.name) && <Check size={16}/>}
                        </button>
                    ))}
                </div>

                {selected.includes('Outros') && (
                    <div className="mb-6 animate-fade-in">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Qual sua especialidade?</label>
                        <input 
                            className="w-full p-3 bg-slate-50 border-2 border-brand-blue rounded-xl outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="Digite aqui (ex: Piscineiro)"
                            value={otherText}
                            onChange={e => setOtherText(e.target.value)}
                            autoFocus
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Essa informação será enviada como sugestão.</p>
                    </div>
                )}
                
                <Button fullWidth size="lg" onClick={handleSave} disabled={loading}>
                    {loading ? 'Salvando...' : 'Confirmar e Começar'}
                </Button>
            </div>
        </div>
    );
};

export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'my_jobs' | 'history'>('jobs');
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [hasActiveJob, setHasActiveJob] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  
  // UI States
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [activeChatJobId, setActiveChatJobId] = useState<string | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState('');
  const [showSpecialtyModal, setShowSpecialtyModal] = useState(false);

  // Modals State
  const [modalType, setModalType] = useState<'cancel' | 'finish' | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Camera State
  const [showCameraPermission, setShowCameraPermission] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Check if user has specialties
    // SE O CAMPO ESTIVER VAZIO, O MODAL APARECE. Isso cobre o caso de novos cadastros.
    if (!user.specialty || user.specialty.trim() === '') {
        setShowSpecialtyModal(true);
    }
    fetchData();
  }, [user.id, activeTab, user.specialty]);

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
    // 1. Available Open Jobs
    // IMPORTANT: 'client:client_id(full_name)' requires a Foreign Key between jobs.client_id and profiles.id in Supabase
    const { data: openData } = await supabase
        .from('jobs')
        .select('*, client:client_id(full_name)')
        .eq('status', 'pending');
    
    if (openData) {
        const filtered = openData.filter((j: any) => {
            // Already assigned to me (Direct Hire) OR Not assigned to anyone
            const isAssignedToMe = j.worker_id === user.id;
            const isUnassigned = j.worker_id === null;
            
            if (isAssignedToMe) return true;
            if (!isUnassigned) return false;

            // Category Matching Logic
            // Job Category Name can be: empty (all), "Pedreiro", or "Pedreiro, Pintor", or "Sugestão: ..."
            // User Specialty can be: "Pedreiro, Eletricista"
            
            const jobCats = j.category_name ? j.category_name.split(',').map((s:string) => s.trim()) : [];
            const userSpecs = user.specialty ? user.specialty.split(',').map((s: string) => s.trim()) : [];

            // If job has no category, it's open to all
            if (jobCats.length === 0 || (jobCats.length === 1 && jobCats[0] === '')) return true;

            // Check if ANY of the job categories match ANY of the user specialties
            // Note: simple includes match works for "Sugestão: X" if user has "Sugestão: X"
            const hasMatch = jobCats.some((cat: string) => userSpecs.some((spec: string) => spec.includes(cat) || cat.includes(spec)));
            return hasMatch;
        });

        setAvailableJobs(filtered.map((j:any) => ({
            id: j.id,
            title: j.title,
            description: j.description,
            clientName: j.client?.full_name || 'Cliente',
            clientId: j.client_id,
            status: 'pending',
            price: j.price || 0,
            date: j.created_at,
            workerId: j.worker_id,
            category: j.category_name
        })));
    }

    // 2. My Jobs (Active & History)
    const { data: myData } = await supabase
        .from('jobs')
        .select('*, client:client_id(full_name)')
        .eq('worker_id', user.id)
        .order('created_at', { ascending: false });
    
    if (myData) {
        const parsedJobs = myData.map((j:any) => ({
            id: j.id,
            title: j.title,
            description: j.description,
            clientName: j.client?.full_name || 'Cliente',
            clientId: j.client_id,
            status: j.status,
            price: j.price || 0,
            date: j.created_at
        }));
        setMyJobs(parsedJobs);
        
        const blockingJob = parsedJobs.find((j: any) => j.status === 'in_progress' || j.status === 'waiting_verification');
        setHasActiveJob(!!blockingJob);
    }
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

  // --- ACTIONS ---

  const handleAcceptJob = async (jobId: string) => {
      if (hasActiveJob) {
          showToast("Você já possui um serviço em andamento.", 'error');
          return;
      }
      setLoadingAction(true);

      const jobToAccept = availableJobs.find(j => j.id === jobId);

      const { error } = await supabase
        .from('jobs')
        .update({ worker_id: user.id, status: 'in_progress' })
        .eq('id', jobId);
      
      if (error) {
          console.error("Erro ao aceitar:", error);
          // Show alert to user so they know it's a permission issue
          alert("Não foi possível aceitar: " + error.message + ". Peça ao administrador para rodar o Script SQL de correção.");
          showToast(error.message, 'error');
          setLoadingAction(false);
      } else {
          // Notify Client
          if (jobToAccept) {
             await supabase.from('notifications').insert({
                 user_id: jobToAccept.clientId,
                 title: 'Profissional a caminho!',
                 message: `${user.name} aceitou seu pedido: ${jobToAccept.title}`,
                 type: 'job_update'
             });

             // OPTIMISTIC UPDATE: Move job locally to avoid refetch delay
             const newJobState = {
                 ...jobToAccept,
                 status: 'in_progress' as const,
                 workerId: user.id
             };
             
             // Remove from available and add to myJobs
             setAvailableJobs(prev => prev.filter(j => j.id !== jobId));
             setMyJobs(prev => [newJobState, ...prev]);
             setHasActiveJob(true);
          }

          showToast('Serviço aceito com sucesso!', 'success');
          setActiveTab('my_jobs'); // This switches view to 'My Jobs'
          
          // CRITICAL: Fetch data from server to ensure synchronization in case optimistic update missed something
          await fetchData();
          
          setLoadingAction(false);
      }
  };

  const confirmFinishJob = async () => {
      if (!selectedJobId) return;
      if (!capturedImage) {
          alert("Por favor, adicione uma foto do serviço realizado.");
          return;
      }

      setLoadingAction(true);

      const { error } = await supabase
        .from('jobs')
        .update({ 
            status: 'waiting_verification',
            worker_evidence_url: capturedImage // In production, upload to Storage and save URL
        })
        .eq('id', selectedJobId);

      if (error) {
          showToast(error.message, 'error');
      } else {
          const job = myJobs.find(j => j.id === selectedJobId);
          if (job) {
             await supabase.from('notifications').insert({
                 user_id: job.clientId,
                 title: 'Serviço Finalizado',
                 message: `${user.name} marcou o serviço como concluído. Por favor, verifique e avalie.`,
                 type: 'job_update'
             });
          }
          showToast('Serviço enviado para verificação!', 'success');
          closeModal();
          fetchData();
      }
      setLoadingAction(false);
  };

  const confirmCancelJob = async () => {
      if (!selectedJobId || !cancelReason.trim()) {
          showToast("Informe o motivo.", 'error');
          return;
      }
      setLoadingAction(true);

      const { error } = await supabase
        .from('jobs')
        .update({ 
            status: 'cancelled',
            cancellation_reason: cancelReason,
            cancelled_by: user.id
        })
        .eq('id', selectedJobId);

      if (error) {
          showToast(error.message, 'error');
      } else {
           const job = myJobs.find(j => j.id === selectedJobId);
           if (job) {
             await supabase.from('notifications').insert({
                 user_id: job.clientId,
                 title: 'Serviço Cancelado',
                 message: `O profissional cancelou o serviço: ${cancelReason}`,
                 type: 'info'
             });
          }
          showToast('Serviço cancelado.', 'success');
          closeModal();
          fetchData();
      }
      setLoadingAction(false);
  };

  // --- MODAL HELPERS ---
  const openCancelModal = (e: React.MouseEvent, jobId: string) => {
      e.stopPropagation();
      setSelectedJobId(jobId);
      setModalType('cancel');
      setCancelReason('');
  };

  const openFinishModal = (e: React.MouseEvent, jobId: string) => {
      e.stopPropagation();
      setSelectedJobId(jobId);
      setModalType('finish');
      setCapturedImage(null);
      stopCamera();
  };

  const closeModal = () => {
      setModalType(null);
      setSelectedJobId(null);
      stopCamera();
      setShowCameraPermission(false);
  };

  const openChat = (jobId: string, partnerName: string) => {
    setActiveChatJobId(jobId);
    setChatPartnerName(partnerName);
  };

  const currentActiveJobs = myJobs.filter(j => ['in_progress', 'waiting_verification'].includes(j.status));
  const historyJobs = myJobs.filter(j => ['completed', 'cancelled'].includes(j.status));

  return (
    <div className="space-y-6 relative">
       {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

       {showSpecialtyModal && (
           <SpecialtySelectionModal 
                userId={user.id} 
                onSave={() => { setShowSpecialtyModal(false); window.location.reload(); }} // Reload to refresh profile context in App
           />
       )}

       <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
         <button 
           className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'jobs' ? 'border-b-2 border-brand-orange text-brand-orange' : 'text-slate-500'}`}
           onClick={() => setActiveTab('jobs')}
         >
           Novos Pedidos
         </button>
         <button 
           className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'my_jobs' ? 'border-b-2 border-brand-orange text-brand-orange' : 'text-slate-500'}`}
           onClick={() => setActiveTab('my_jobs')}
         >
           Meus Serviços
         </button>
         <button 
           className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'history' ? 'border-b-2 border-brand-orange text-brand-orange' : 'text-slate-500'}`}
           onClick={() => setActiveTab('history')}
         >
           Histórico
         </button>
       </div>

       {activeTab === 'jobs' && (
         <div className="space-y-4 animate-fade-in">
           {hasActiveJob && (
               <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-2 flex items-center gap-2">
                   <Clock size={16} /> Você tem um serviço ativo. Finalize-o para aceitar novos.
               </div>
           )}
           {availableJobs.length === 0 && (
               <div className="text-center py-10 opacity-60">
                   <p className="text-slate-500">Nenhum serviço disponível para sua especialidade no momento.</p>
                   <p className="text-xs text-slate-400 mt-2">Suas especialidades: {user.specialty}</p>
               </div>
           )}
           
           {availableJobs.map(job => (
             <div key={job.id} className={`bg-white p-5 rounded-xl border shadow-sm transition-shadow ${job.workerId === user.id ? 'border-brand-blue ring-1 ring-brand-blue' : 'border-slate-200'}`}>
               <div className="flex justify-between items-start mb-2">
                 <div>
                   {job.workerId === user.id && <span className="bg-brand-blue text-white text-[10px] px-2 py-0.5 rounded-full mb-1 inline-block">Proposta Direta</span>}
                   {job.category && <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full mb-1 inline-block mr-2 uppercase font-bold">{job.category}</span>}
                   <h3 className="font-bold text-lg text-slate-900">{job.title}</h3>
                   <p className="text-sm text-slate-600 mt-1">{job.description}</p>
                 </div>
                 {job.price > 0 && <span className="font-bold text-xl text-green-600">R$ {job.price.toFixed(2)}</span>}
               </div>
               
               <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                   <span>Cliente: {job.clientName}</span>
               </div>
               
               <Button fullWidth onClick={() => handleAcceptJob(job.id)} disabled={hasActiveJob || loadingAction}>
                   {loadingAction ? 'Processando...' : (hasActiveJob ? 'Indisponível (Serviço em Andamento)' : 'Aceitar Serviço')}
               </Button>
             </div>
           ))}
         </div>
       )}

       {activeTab === 'my_jobs' && (
           <div className="space-y-6 animate-fade-in pb-20">
                {currentActiveJobs.length === 0 && <div className="text-slate-500 text-center py-8 bg-slate-50 rounded-xl">Você não tem serviços em andamento.</div>}
                {currentActiveJobs.map(job => (
                    <div key={job.id} className="bg-white p-5 rounded-xl border border-brand-orange/30 shadow-sm relative overflow-hidden">
                        <div className={`absolute top-0 right-0 text-white text-xs px-2 py-1 rounded-bl-lg font-bold ${
                            job.status === 'waiting_verification' ? 'bg-purple-500' : 'bg-brand-orange'
                        }`}>
                            {job.status === 'waiting_verification' ? 'Aguardando Cliente' : 'Em Andamento'}
                        </div>
                        
                        <div className="mb-4">
                            <h3 className="font-bold text-lg text-slate-900">{job.title}</h3>
                            <p className="text-slate-500 text-sm">Cliente: {job.clientName}</p>
                        </div>
                        
                        <div className="flex gap-2 mb-4">
                            <Button variant="secondary" fullWidth onClick={() => openChat(job.id, job.clientName)} className="flex items-center justify-center gap-2">
                                <MessageCircle size={18} /> Chat
                            </Button>
                        </div>

                        {job.status === 'in_progress' && (
                            <div className="flex gap-2">
                                <Button 
                                    type="button" 
                                    variant="danger" 
                                    fullWidth 
                                    className="flex items-center justify-center gap-2 z-10" 
                                    onClick={(e) => openCancelModal(e, job.id)}
                                    disabled={loadingAction}
                                >
                                    <XCircle size={18} /> Cancelar
                                </Button>
                                <Button 
                                    type="button"
                                    fullWidth 
                                    className="flex items-center justify-center gap-2 z-10" 
                                    onClick={(e) => openFinishModal(e, job.id)}
                                    disabled={loadingAction}
                                >
                                    <CheckCircle size={18} /> Finalizar
                                </Button>
                            </div>
                        )}
                        
                        {job.status === 'waiting_verification' && (
                            <div className="p-3 bg-purple-50 text-purple-700 rounded-lg text-sm text-center">
                                Aguardando cliente confirmar e avaliar.
                            </div>
                        )}
                    </div>
                ))}
           </div>
       )}

       {activeTab === 'history' && (
           <div className="space-y-4 animate-fade-in pb-20">
               {historyJobs.length === 0 && <div className="text-slate-500 text-center py-8 bg-slate-50 rounded-xl">Nenhum serviço no histórico.</div>}
               {historyJobs.map(job => (
                   <div key={job.id} className="bg-slate-50 p-5 rounded-xl border border-slate-200 opacity-90 hover:opacity-100 transition-opacity">
                       <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-base text-slate-700">{job.title}</h3>
                                <p className="text-xs text-slate-500 mt-1">Cliente: {job.clientName}</p>
                                <p className="text-xs text-slate-400">{new Date(job.date).toLocaleDateString()}</p>
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

       {/* MODALS */}
       {modalType === 'cancel' && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
               <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl">
                   <h3 className="text-lg font-bold text-red-600 mb-2">Cancelar Serviço?</h3>
                   <p className="text-sm text-slate-600 mb-4">Essa ação não pode ser desfeita. Por favor, explique o motivo.</p>
                   <textarea 
                        className="w-full p-3 bg-slate-100 rounded-lg text-sm mb-4 outline-none focus:ring-2 focus:ring-red-200"
                        placeholder="Motivo do cancelamento..."
                        rows={3}
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                   />
                   <div className="flex gap-2">
                       <Button variant="outline" fullWidth onClick={closeModal}>Voltar</Button>
                       <Button variant="danger" fullWidth onClick={confirmCancelJob} disabled={loadingAction}>
                           {loadingAction ? '...' : 'Confirmar'}
                       </Button>
                   </div>
               </div>
           </div>
       )}

        {modalType === 'finish' && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
               <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl text-center my-auto">
                   
                   {!capturedImage && !cameraActive && !showCameraPermission && (
                       <>
                        <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                            <CheckCircle size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Finalizar Serviço</h3>
                        <p className="text-sm text-slate-600 mb-6">É obrigatório anexar uma foto do serviço realizado.</p>
                        
                        <Button variant="outline" fullWidth className="mb-4 border-dashed border-2 flex flex-col items-center justify-center py-6 gap-2" onClick={() => setShowCameraPermission(true)}>
                            <Camera size={24} className="text-slate-400"/>
                            <span className="text-sm text-slate-500">Tirar Foto do Serviço</span>
                        </Button>
                        <Button variant="outline" fullWidth onClick={closeModal}>Cancelar</Button>
                       </>
                   )}

                   {showCameraPermission && (
                       <div className="animate-fade-in">
                           <div className="w-16 h-16 bg-orange-100 text-brand-orange rounded-full flex items-center justify-center mx-auto mb-4">
                                <Camera size={32} />
                            </div>
                           <h3 className="text-xl font-bold mb-2">Permitir Câmera?</h3>
                           <p className="text-slate-500 text-sm mb-6">Precisamos acessar sua câmera para registrar a evidência do serviço.</p>
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
                       <div className="space-y-4">
                           <div className="relative aspect-square rounded-xl overflow-hidden border border-slate-200">
                               <img src={capturedImage} className="w-full h-full object-cover" />
                               <button onClick={handleRetake} className="absolute bottom-2 right-2 bg-white/90 p-2 rounded-full shadow text-slate-700 font-bold text-xs flex items-center gap-1">
                                   <RefreshCw size={14}/> Refazer
                               </button>
                           </div>
                           <div className="flex gap-2">
                               <Button variant="outline" fullWidth onClick={closeModal}>Voltar</Button>
                               <Button fullWidth onClick={confirmFinishJob} disabled={loadingAction}>
                                   {loadingAction ? '...' : 'Enviar e Finalizar'}
                               </Button>
                           </div>
                       </div>
                   )}
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