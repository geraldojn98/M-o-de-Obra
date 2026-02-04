import React, { useState, useEffect, useRef } from 'react';
import { User, Job } from '../types';
import { Button } from '../components/Button';
import { Camera, CheckCircle, MessageCircle, XCircle, Clock, AlertTriangle, X, RefreshCw } from 'lucide-react';
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

  // Modals State
  const [modalType, setModalType] = useState<'cancel' | 'finish' | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Camera State
  const [showCameraPermission, setShowCameraPermission] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchData();
  }, [user.id, activeTab]);

  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 4000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  const fetchData = async () => {
    // 1. Available Open Jobs
    const { data: openData } = await supabase
        .from('jobs')
        .select('*, client:client_id(full_name)')
        .eq('status', 'pending');
    
    if (openData) {
        const filtered = openData.filter((j: any) => j.worker_id === null || j.worker_id === user.id);
        setAvailableJobs(filtered.map((j:any) => ({
            id: j.id,
            title: j.title,
            description: j.description,
            clientName: j.client?.full_name || 'Cliente',
            clientId: j.client_id,
            status: 'pending',
            price: j.price || 0,
            date: j.created_at,
            workerId: j.worker_id
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
          const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: "environment" } 
          });
          setCameraActive(true);
          setShowCameraPermission(false);
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play();
          }
      } catch (err) {
          alert("Erro ao acessar câmera. Verifique permissões.");
          setShowCameraPermission(false);
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
      if (videoRef.current && videoRef.current.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null;
      }
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

      const { error } = await supabase
        .from('jobs')
        .update({ worker_id: user.id, status: 'in_progress' })
        .eq('id', jobId);
      
      if (error) {
          showToast(error.message, 'error');
          setLoadingAction(false);
      } else {
          // Notify Client
          const job = availableJobs.find(j => j.id === jobId);
          if (job) {
             await supabase.from('notifications').insert({
                 user_id: job.clientId,
                 title: 'Profissional a caminho!',
                 message: `${user.name} aceitou seu pedido: ${job.title}`,
                 type: 'job_update'
             });
          }
          showToast('Serviço aceito com sucesso!', 'success');
          setActiveTab('my_jobs');
          fetchData();
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

       {!user.specialty && (
           <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 text-sm mb-4">
               Configure sua especialidade no perfil para aparecer nas buscas!
           </div>
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
           {availableJobs.length === 0 && <p className="text-slate-500 text-center py-4">Nenhum serviço disponível.</p>}
           
           {availableJobs.map(job => (
             <div key={job.id} className={`bg-white p-5 rounded-xl border shadow-sm transition-shadow ${job.workerId === user.id ? 'border-brand-blue ring-1 ring-brand-blue' : 'border-slate-200'}`}>
               <div className="flex justify-between items-start mb-2">
                 <div>
                   {job.workerId === user.id && <span className="bg-brand-blue text-white text-[10px] px-2 py-0.5 rounded-full mb-1 inline-block">Proposta Direta</span>}
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