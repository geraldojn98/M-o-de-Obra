import React, { useState, useEffect, useRef } from 'react';
import { User, Job, ServiceCategory, POINTS_RULES } from '../types';
import { Button } from '../components/Button';
import { Camera, CheckCircle, MessageCircle, XCircle, Clock, AlertTriangle, X, ShieldAlert, Zap, MapPin } from 'lucide-react';
import { supabase } from '../services/supabase';
import { ChatWindow } from '../components/ChatWindow';

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
  const [activeTab, setActiveTab] = useState<'jobs' | 'my_jobs' | 'history'>('jobs');
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [hasActiveJob, setHasActiveJob] = useState(false);
  const [activeJobEndTime, setActiveJobEndTime] = useState<Date | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [todayPoints, setTodayPoints] = useState(0);
  
  // UI States
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [activeChatJobId, setActiveChatJobId] = useState<string | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState('');
  
  // Modals
  const [modalType, setModalType] = useState<'cancel' | 'finish' | 'audit' | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Camera
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

  // Video logic same as previous
  useEffect(() => {
    if (cameraActive && mediaStream && videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [cameraActive, mediaStream]);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  const calculateTodayPoints = async () => {
    // This assumes we have a ledger or we sum from completed jobs today.
    // Since we don't have a ledger table in schema, we sum jobs completed today.
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
            isAudited: j.is_audited
        }));
        setMyJobs(parsedJobs);
        
        // Availability Check Logic
        const active = parsedJobs.find((j: any) => j.status === 'in_progress' || j.status === 'waiting_verification');
        setHasActiveJob(!!active);
        
        if (active && active.status === 'in_progress') {
            // "Disponibilidade": Assuming availability locks for estimated duration?
            // The prompt says "intervalo mínimo de o tempo estimado".
            // We can calculate logic here, but simpler is: If has active job, can't take another.
            // Advanced: If active job started 2 hours ago and was 1 hour estimate? 
            // Let's stick to "Busy if In Progress" for robustness.
        }
    }
  };

  const handleAcceptJob = async (jobId: string) => {
      if (hasActiveJob) return showToast("Você tem um serviço ativo. Termine-o primeiro.", 'error');
      
      const jobToAccept = availableJobs.find(j => j.id === jobId);
      if(!jobToAccept) return;

      // RULE: DAILY CAP
      if (todayPoints >= POINTS_RULES.WORKER_DAILY_CAP) {
          return showToast("Você atingiu o limite diário de pontos (80). Volte amanhã!", 'error');
      }

      setLoadingAction(true);

      // RULE: REPETITION (Same Client / Same Day)
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

      // WARNING: AVAILABILITY
      if(!confirm(`Este serviço tem duração estimada de ${jobToAccept.estimatedHours}h. Você ficará indisponível para novos chamados durante este período. Confirmar?`)) {
          setLoadingAction(false);
          return;
      }

      const { error } = await supabase.from('jobs').update({ worker_id: user.id, status: 'in_progress' }).eq('id', jobId);
      
      if (error) { showToast(error.message, 'error'); setLoadingAction(false); }
      else {
          // Notify ...
          showToast('Serviço aceito!', 'success'); setActiveTab('my_jobs'); await fetchData(); setLoadingAction(false);
      }
  };

  const confirmFinishJob = async (auditAnswers?: {q1: string, q2: string}) => {
      if (!selectedJobId || !capturedImage) return alert("Adicione a foto.");
      setLoadingAction(true);
      
      const job = myJobs.find(j => j.id === selectedJobId);
      if (!job) return;

      // RULE: CONSECUTIVE DAYS (Audit Trigger)
      if (!auditAnswers) {
        // Check for job yesterday with same client
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0,0,0,0);
        const today = new Date(); today.setHours(0,0,0,0);
        
        const { data: consecutiveJobs } = await supabase.from('jobs')
            .select('id')
            .eq('client_id', job.clientId)
            .eq('worker_id', user.id)
            .gte('created_at', yesterday.toISOString())
            .lt('created_at', today.toISOString());
        
        if (consecutiveJobs && consecutiveJobs.length > 0) {
            setModalType('audit'); // Open Audit Modal
            setLoadingAction(false);
            return;
        }
      }

      // Calculate Points
      // 1. Basic: 10 * Hours
      let pointsToAward = job.estimatedHours * POINTS_RULES.WORKER_PER_HOUR;
      
      // 2. Cap Check
      const potentialTotal = todayPoints + pointsToAward;
      if (potentialTotal > POINTS_RULES.WORKER_DAILY_CAP) {
          pointsToAward = Math.max(0, POINTS_RULES.WORKER_DAILY_CAP - todayPoints);
      }

      // 3. Repetition Check (Same Day = 0) - Recalculate to be sure
      const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
      const { data: jobsToday } = await supabase.from('jobs').select('id').eq('client_id', job.clientId).eq('worker_id', user.id).gte('created_at', startOfDay.toISOString());
      // Logic: If there is another job created today that is NOT this one, then this is repetition.
      // But we are updating status. 'jobsToday' includes the current one because we accepted it.
      // If length > 1, it's repetition.
      if (jobsToday && jobsToday.length > 1) {
          pointsToAward = 0;
      }
      
      // 4. Audit Check
      let isAudited = false;
      let auditData = null;
      if (auditAnswers) {
          pointsToAward = 0; // Suspend points until admin review or strictly zero
          isAudited = true;
          auditData = { worker_q1: auditAnswers.q1, worker_q2: auditAnswers.q2 };
          // Flag User
          await supabase.from('profiles').update({ suspicious_flag: true }).eq('id', user.id);
      }

      // Apply Updates
      // We store points_awarded in job. We add to profile points using RPC to be safe, or direct update
      const updates: any = { 
          status: 'waiting_verification', 
          worker_evidence_url: capturedImage,
          points_awarded: pointsToAward,
          is_audited: isAudited
      };
      if(auditData) updates.audit_data = auditData;

      // Update Points (Only if > 0 and not audited - if audited, we hold)
      if (pointsToAward > 0 && !isAudited) {
           const { error: rpcError } = await supabase.rpc('increment_points', { user_id: user.id, amount: pointsToAward });
           
           if (rpcError) {
                const {data:prof} = await supabase.from('profiles').select('points').eq('id', user.id).single();
                if(prof) await supabase.from('profiles').update({ points: prof.points + pointsToAward }).eq('id', user.id);
           }
      }

      const { error } = await supabase.from('jobs').update(updates).eq('id', selectedJobId);

      if (error) showToast(error.message, 'error');
      else {
          showToast('Enviado para verificação!', 'success'); closeModal(); fetchData(); calculateTodayPoints();
      }
      setLoadingAction(false);
  };
  
  // Helpers
  const handleStartCamera = async () => { /* ... */ 
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
  const handleRetake = () => { setCapturedImage(null); handleStartCamera(); };
  
  const openCancelModal = (e: React.MouseEvent, jobId: string) => { e.stopPropagation(); setSelectedJobId(jobId); setModalType('cancel'); setCancelReason(''); };
  const openFinishModal = (e: React.MouseEvent, jobId: string) => { e.stopPropagation(); setSelectedJobId(jobId); setModalType('finish'); setCapturedImage(null); stopCamera(); };
  const closeModal = () => { setModalType(null); setSelectedJobId(null); stopCamera(); setShowCameraPermission(false); };
  const confirmCancelJob = async () => { /* ... */ 
    if (!selectedJobId || !cancelReason.trim()) return showToast("Informe o motivo.", 'error');
    setLoadingAction(true);
    const { error } = await supabase.from('jobs').update({ status: 'cancelled', cancellation_reason: cancelReason, cancelled_by: user.id }).eq('id', selectedJobId);
    if (error) showToast(error.message, 'error');
    else { closeModal(); fetchData(); }
    setLoadingAction(false);
  };
  const openChat = (jobId: string, partnerName: string) => { setActiveChatJobId(jobId); setChatPartnerName(partnerName); };

  const currentActiveJobs = myJobs.filter(j => ['in_progress', 'waiting_verification'].includes(j.status));
  const historyJobs = myJobs.filter(j => ['completed', 'cancelled'].includes(j.status));

  return (
    <div className="space-y-6 relative">
       {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
       
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

       {/* Tabs */}
       <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
         <button className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'jobs' ? 'border-b-2 border-brand-orange text-brand-orange' : 'text-slate-500'}`} onClick={() => setActiveTab('jobs')}>Novos Pedidos</button>
         <button className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'my_jobs' ? 'border-b-2 border-brand-orange text-brand-orange' : 'text-slate-500'}`} onClick={() => setActiveTab('my_jobs')}>Meus Serviços</button>
         <button className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'history' ? 'border-b-2 border-brand-orange text-brand-orange' : 'text-slate-500'}`} onClick={() => setActiveTab('history')}>Histórico</button>
       </div>

       {activeTab === 'jobs' && (
         <div className="space-y-4 animate-fade-in">
           {hasActiveJob && <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-2 flex items-center gap-2"><Clock size={16} /> Você tem um serviço ativo. Termine-o para pegar outro.</div>}
           {availableJobs.length === 0 && (
               <div className="text-center py-10 opacity-60">
                   <p className="text-slate-500">Nenhum serviço disponível em {user.city}.</p>
               </div>
           )}
           {availableJobs.map(job => (
             <div key={job.id} className={`bg-white p-5 rounded-xl border shadow-sm transition-shadow ${job.workerId === user.id ? 'border-brand-blue ring-1 ring-brand-blue' : 'border-slate-200'}`}>
               <div className="flex justify-between items-start mb-2">
                 <div>
                   {job.workerId === user.id && <span className="bg-brand-blue text-white text-[10px] px-2 py-0.5 rounded-full mb-1 inline-block">Proposta Direta</span>}
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
               <Button fullWidth onClick={() => handleAcceptJob(job.id)} disabled={hasActiveJob || loadingAction}>{loadingAction ? 'Processando...' : (hasActiveJob ? 'Indisponível' : 'Aceitar Serviço')}</Button>
             </div>
           ))}
         </div>
       )}

       {/* My Jobs Tab ... (Kept existing visual structure) */}
       {activeTab === 'my_jobs' && (
           <div className="space-y-6 animate-fade-in pb-20">
                {currentActiveJobs.map(job => (
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
        
       {/* History Tab ... */}
       {activeTab === 'history' && (
           <div className="space-y-4 animate-fade-in pb-20">
               {historyJobs.map(job => (
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

       {/* Finish Modal */}
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
       {/* Cancel Modal (Existing) */}
       {modalType === 'cancel' && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
               <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl">
                   <h3 className="text-lg font-bold text-red-600 mb-2">Cancelar Serviço?</h3>
                   <textarea className="w-full p-3 bg-slate-100 rounded-lg text-sm mb-4 outline-none focus:ring-2 focus:ring-red-200" placeholder="Motivo..." rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                   <div className="flex gap-2"><Button variant="outline" fullWidth onClick={closeModal}>Voltar</Button><Button variant="danger" fullWidth onClick={confirmCancelJob} disabled={loadingAction}>Confirmar</Button></div>
               </div>
           </div>
       )}

       {activeChatJobId && <ChatWindow jobId={activeChatJobId} currentUser={user} otherUserName={chatPartnerName} onClose={() => setActiveChatJobId(null)} />}
    </div>
  );
};