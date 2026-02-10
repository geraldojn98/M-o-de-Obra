import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Button } from '../components/Button';
import { 
    Users, Briefcase, Store, Search, Trash2, Edit, 
    X, BellRing, Send, ChevronRight, CheckSquare, Square, Calendar, DollarSign, Lightbulb,
    ShieldAlert, AlertTriangle, CheckCircle, Ban, FileText, Clock, Filter
} from 'lucide-react';
import { Partner, CategorySuggestion, POINTS_RULES } from '../types';
import { LevelBadge } from '../components/LevelBadge';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import * as NotificationService from '../services/notifications';
import { DEFAULT_AVATAR } from '../constants/defaultAvatar';

type AdminTab = 'overview' | 'users' | 'jobs' | 'partners' | 'notifications' | 'suggestions' | 'redlist' | 'replies';

const LEVELS = [
    { id: 'bronze', label: 'Bronze', class: 'bg-amber-800 text-amber-100' },
    { id: 'silver', label: 'Prata', class: 'bg-slate-500 text-white' },
    { id: 'gold', label: 'Ouro', class: 'bg-amber-400 text-amber-900' },
    { id: 'diamond', label: 'Diamante', class: 'bg-cyan-400 text-cyan-900' },
] as const;

const EditUserModal: React.FC<{ user: any, onClose: () => void, onSave: () => void }> = ({ user, onClose, onSave }) => {
    const [name, setName] = useState(user.full_name || '');
    const [points, setPoints] = useState<number>(user.points || 0);
    const [role, setRole] = useState(user.allowed_roles?.[0] || 'client');
    const [level, setLevel] = useState<string>(user.level || 'bronze');
    const [levelOverride, setLevelOverride] = useState<boolean>(!!user.level_admin_override);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const isWorker = role === 'worker';

    const handleSave = async () => {
        setLoading(true);
        setErrorMsg('');
        
        try {
            const changes: string[] = [];
            const updates: Record<string, unknown> = {};
            
            if (name !== user.full_name) {
                updates.full_name = name;
                changes.push('nome');
            }
            if (points !== user.points) {
                updates.points = points;
                changes.push(`pontos (${user.points} → ${points})`);
            }
            if (role !== user.allowed_roles?.[0]) {
                updates.allowed_roles = [role];
                changes.push(`permissão (${user.allowed_roles?.[0]} → ${role})`);
            }
            if (isWorker) {
                if (level !== (user.level || 'bronze')) {
                    updates.level = level;
                    changes.push(`nível (${user.level || 'bronze'} → ${level})`);
                }
                if (levelOverride !== !!user.level_admin_override) {
                    updates.level_admin_override = levelOverride;
                    changes.push(levelOverride ? 'nível definido pelo admin' : 'nível automático');
                }
            }
            
            if (Object.keys(updates).length === 0) {
                onClose();
                setLoading(false);
                return;
            }
            
            const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
            
            if (error) throw error;
            
            // Notificar o usuário sobre as mudanças
            if (changes.length > 0) {
                await NotificationService.notifyUserProfileUpdated(user.id, changes);
            }
            
            onSave();
            onClose();
        } catch (err: any) {
            console.error("Erro ao atualizar:", err);
            setErrorMsg(err.message || "Erro ao atualizar usuário.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-xl text-slate-800">Gerenciar Usuário</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X size={24}/></button>
                </div>
                
                {errorMsg && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold text-center">
                        {errorMsg}
                    </div>
                )}
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nome Completo</label>
                        <input 
                            className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none text-slate-800 font-medium" 
                            value={name} 
                            onChange={e=>setName(e.target.value)} 
                        />
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Permissão do Sistema</label>
                        <div className="relative">
                            <select 
                                className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none appearance-none font-medium text-slate-800" 
                                value={role} 
                                onChange={e=>setRole(e.target.value)}
                            >
                                <option value="client">Cliente</option>
                                <option value="worker">Profissional</option>
                                <option value="partner">Parceiro (Lojista)</option>
                                <option value="admin">Administrador</option>
                            </select>
                            <ChevronRight className="absolute right-3 top-3.5 text-slate-400 rotate-90 pointer-events-none" size={16}/>
                        </div>
                        {role === 'partner' && (
                            <p className="text-[10px] text-brand-orange mt-2 bg-orange-50 p-2 rounded-lg font-bold">
                                ℹ️ Ao salvar como 'Parceiro', o sistema criará automaticamente a loja na aba Parceiros.
                            </p>
                        )}
                    </div>

                    {isWorker && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
                                Nível do Profissional
                            </label>
                            <p className="text-[11px] text-slate-500 mb-3">
                                O admin define o nível. Se &quot;Admin define&quot; estiver ativo, o sistema não recalculará automaticamente.
                            </p>
                            <div className="flex gap-2 mb-3 flex-wrap">
                                {LEVELS.map(l => (
                                    <button
                                        key={l.id}
                                        type="button"
                                        onClick={() => setLevel(l.id)}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition ${level === l.id ? l.class : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        {l.label}
                                    </button>
                                ))}
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={levelOverride} onChange={e => setLevelOverride(e.target.checked)} className="rounded border-slate-300" />
                                <span className="text-xs font-bold text-slate-600">Admin define (não recalcular automaticamente)</span>
                            </label>
                        </div>
                    )}

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-3">Saldo de Pontos</label>
                        <div className="flex flex-col gap-3">
                            <input 
                                type="number" 
                                className="w-full p-3 text-center text-3xl font-black text-brand-orange bg-white rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-orange" 
                                value={points}
                                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                            />
                            
                            <div className="grid grid-cols-4 gap-2">
                                <button onClick={() => setPoints(p => Math.max(0, p - 50))} className="bg-white border border-slate-200 text-slate-500 rounded-lg py-2 font-bold text-xs hover:bg-slate-50">-50</button>
                                <button onClick={() => setPoints(p => Math.max(0, p - 1))} className="bg-white border border-slate-200 text-slate-500 rounded-lg py-2 font-bold text-xs hover:bg-slate-50">-1</button>
                                <button onClick={() => setPoints(p => p + 1)} className="bg-white border border-slate-200 text-brand-orange rounded-lg py-2 font-bold text-xs hover:bg-orange-50">+1</button>
                                <button onClick={() => setPoints(p => p + 50)} className="bg-white border border-slate-200 text-brand-orange rounded-lg py-2 font-bold text-xs hover:bg-orange-50">+50</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <Button fullWidth onClick={handleSave} disabled={loading} size="lg" className="rounded-2xl shadow-xl shadow-brand-orange/20">
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const ADMIN_TAB_IDS: AdminTab[] = ['overview', 'users', 'jobs', 'partners', 'notifications', 'suggestions', 'redlist', 'replies'];

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const pathSeg = pathname.replace(/^\/admin\/?/, '') || 'overview';
  const activeTab: AdminTab = (ADMIN_TAB_IDS.includes(pathSeg as AdminTab) ? pathSeg : 'overview') as AdminTab;

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');

  // Data
  const [users, setUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banType, setBanType] = useState<'7days' | 'indefinite' | null>(null);

  // Notificações por aba
  const [notifications, setNotifications] = useState<Record<string, number>>({
    users: 0,
    jobs: 0,
    redlist: 0,
    replies: 0,
    partners: 0,
    suggestions: 0,
  });

  // Função para obter última contagem salva
  const getLastCount = (tab: string): number => {
    const saved = localStorage.getItem(`admin_last_count_${tab}`);
    return saved ? parseInt(saved, 10) : 0;
  };

  // Função para salvar contagem atual
  const saveLastCount = (tab: string, count: number) => {
    localStorage.setItem(`admin_last_count_${tab}`, count.toString());
  };

  // Função para calcular notificações
  const calculateNotifications = () => {
    const newNotifications: Record<string, number> = {
      users: 0,
      jobs: 0,
      redlist: 0,
      replies: 0,
      partners: 0,
      suggestions: 0,
    };

    // Verificar se já foi inicializado (se não, salvar contagens atuais como baseline)
    const isInitialized = localStorage.getItem('admin_notifications_initialized') === 'true';

    if (!isInitialized) {
      // Primeira vez: salvar contagens atuais como baseline
      saveLastCount('users', users.length);
      saveLastCount('jobs', jobs.length);
      saveLastCount('redlist', redlistJobs.length);
      const pendingReplies = appeals.filter((a: any) => a.status === 'pending').length;
      saveLastCount('replies', pendingReplies);
      saveLastCount('partners', partners.length);
      const pendingSuggestions = suggestions.filter((s: any) => !s.reviewed).length;
      saveLastCount('suggestions', pendingSuggestions);
      localStorage.setItem('admin_notifications_initialized', 'true');
      return; // Não mostrar notificações na primeira vez
    }

    const currentUsers = users.length;
    const lastUsers = getLastCount('users');
    if (currentUsers > lastUsers) {
      newNotifications.users = Math.min(currentUsers - lastUsers, 99);
    }

    const currentJobs = jobs.length;
    const lastJobs = getLastCount('jobs');
    if (currentJobs > lastJobs) {
      newNotifications.jobs = Math.min(currentJobs - lastJobs, 99);
    }

    const currentRedlist = redlistJobs.length;
    const lastRedlist = getLastCount('redlist');
    if (currentRedlist > lastRedlist) {
      newNotifications.redlist = Math.min(currentRedlist - lastRedlist, 99);
    }

    const currentReplies = appeals.filter((a: any) => a.status === 'pending').length;
    const lastReplies = getLastCount('replies');
    if (currentReplies > lastReplies) {
      newNotifications.replies = Math.min(currentReplies - lastReplies, 99);
    }

    const currentPartners = partners.length;
    const lastPartners = getLastCount('partners');
    if (currentPartners > lastPartners) {
      newNotifications.partners = Math.min(currentPartners - lastPartners, 99);
    }

    const currentSuggestions = suggestions.filter((s: any) => !s.reviewed).length;
    const lastSuggestions = getLastCount('suggestions');
    if (currentSuggestions > lastSuggestions) {
      newNotifications.suggestions = Math.min(currentSuggestions - lastSuggestions, 99);
    }

    setNotifications(newNotifications);
  };

  // Função para resetar notificação ao visualizar aba e navegar
  const handleTabChange = (tab: AdminTab) => {
    navigate(tab === 'overview' ? '/admin' : `/admin/${tab}`);

    // Resetar contador quando visualizar a aba
    if (tab === 'users') {
      saveLastCount('users', users.length);
      setNotifications(prev => ({ ...prev, users: 0 }));
    } else if (tab === 'jobs') {
      saveLastCount('jobs', jobs.length);
      setNotifications(prev => ({ ...prev, jobs: 0 }));
    } else if (tab === 'redlist') {
      saveLastCount('redlist', redlistJobs.length);
      setNotifications(prev => ({ ...prev, redlist: 0 }));
    } else if (tab === 'replies') {
      const pendingReplies = appeals.filter((a: any) => a.status === 'pending').length;
      saveLastCount('replies', pendingReplies);
      setNotifications(prev => ({ ...prev, replies: 0 }));
    } else if (tab === 'partners') {
      saveLastCount('partners', partners.length);
      setNotifications(prev => ({ ...prev, partners: 0 }));
    } else if (tab === 'suggestions') {
      const pendingSuggestions = suggestions.filter((s: any) => !s.reviewed).length;
      saveLastCount('suggestions', pendingSuggestions);
      setNotifications(prev => ({ ...prev, suggestions: 0 }));
    }
  };

  // Notifications State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [targetAudiences, setTargetAudiences] = useState({
      client: true,
      worker: true,
      partner: false
  });

  // Lista Vermelha: jobs auditados não resolvidos
  const [redlistJobs, setRedlistJobs] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  // Recorrência: quantas vezes cada usuário entrou na lista vermelha / fez tréplica
  const [redlistRecurrence, setRedlistRecurrence] = useState<Record<string, number>>({});
  const [appealsRecurrence, setAppealsRecurrence] = useState<Record<string, number>>({});
  // Modal de aprovar recurso: escolher nível (bronze ou anterior)
  const [appealApproveModal, setAppealApproveModal] = useState<{ appeal: any; levelBeforeBan: string | null } | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    if (users.length > 0 || jobs.length > 0 || redlistJobs.length > 0 || appeals.length > 0 || partners.length > 0 || suggestions.length > 0) {
      calculateNotifications();
    }
  }, [users.length, jobs.length, redlistJobs.length, appeals.length, partners.length, suggestions.length]);

  const fetchData = async () => {
    setLoading(true);
    const { data: u } = await supabase.from('profiles').select('*').order('created_at', {ascending: false});
    const { data: j } = await supabase.from('jobs').select('*, client:client_id(full_name), worker:worker_id(full_name)').order('created_at', {ascending: false});
    const { data: p } = await supabase.from('partners').select('*').order('created_at', {ascending: false});
    
    // Suggestions
    const { data: s } = await supabase.from('category_suggestions').select('*, user:user_id(full_name)').order('created_at', {ascending: false});

    // Lista Vermelha: is_audited = true e ainda não resolvido
    const { data: red } = await supabase.from('jobs')
      .select('*, client:client_id(full_name), worker:worker_id(full_name)')
      .eq('is_audited', true)
      .order('created_at', { ascending: false });
    if (red) setRedlistJobs(red.filter((j: any) => j.admin_verdict !== 'absolved' && j.admin_verdict !== 'punished'));

    // Tréplicas (recursos de punição)
    const { data: appData } = await supabase.from('punishment_appeals')
      .select('*, user:user_id(full_name, level_before_ban), job:job_id(title, client_id, worker_id)')
      .order('created_at', { ascending: false });
    if (appData) setAppeals(appData);

    // Recorrência lista vermelha: contar quantas vezes cada usuário apareceu em jobs auditados
    const { data: auditedJobs } = await supabase.from('jobs').select('client_id, worker_id').eq('is_audited', true);
    const redCount: Record<string, number> = {};
    (auditedJobs || []).forEach((j: any) => {
      if (j.client_id) { redCount[j.client_id] = (redCount[j.client_id] || 0) + 1; }
      if (j.worker_id) { redCount[j.worker_id] = (redCount[j.worker_id] || 0) + 1; }
    });
    setRedlistRecurrence(redCount);

    // Recorrência tréplicas: quantas vezes cada usuário abriu recurso
    const appealCount: Record<string, number> = {};
    (appData || []).forEach((a: any) => {
      if (a.user_id) { appealCount[a.user_id] = (appealCount[a.user_id] || 0) + 1; }
    });
    setAppealsRecurrence(appealCount);

    if(u) setUsers(u);
    if(j) setJobs(j);
    if(p) setPartners(p);
    if(s) setSuggestions(s.map((i:any) => ({ id: i.id, userId: i.user_id, userName: i.user?.full_name, suggestion: i.suggestion, createdAt: i.created_at, reviewed: i.reviewed })));
    
    setLoading(false);
  };

  const handleAbsolve = async (job: any) => {
    if (!confirm('Absolver este caso? A flag de suspeita será removida e os pontos validados.')) return;
    setLoading(true);
    try {
      await supabase.from('profiles').update({ suspicious_flag: false }).eq('id', job.client_id);
      await NotificationService.createNotification({
        userId: job.client_id,
        title: 'Caso Absolvido',
        message: 'O caso foi analisado e absolvido. Os pontos foram validados.',
        type: 'admin_action',
      });
      
      if (job.worker_id) {
        await supabase.from('profiles').update({ suspicious_flag: false }).eq('id', job.worker_id);
        await NotificationService.createNotification({
          userId: job.worker_id,
          title: 'Caso Absolvido',
          message: 'O caso foi analisado e absolvido. Os pontos foram validados.',
          type: 'admin_action',
        });
      }
      
      const pointsToAward = (job.estimated_hours || 1) * POINTS_RULES.WORKER_PER_HOUR;
      await supabase.from('jobs').update({
        admin_verdict: 'absolved',
        points_awarded: pointsToAward
      }).eq('id', job.id);
      
      if (job.worker_id) {
        const { data: prof } = await supabase.from('profiles').select('points').eq('id', job.worker_id).single();
        if (prof) await supabase.from('profiles').update({ points: (prof.points || 0) + pointsToAward }).eq('id', job.worker_id);
      }
      fetchData();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const saveLevelBeforeBanAndPunish = async (profileId: string, punishmentUntil: string | null, isWorker: boolean) => {
    if (!isWorker) {
      await supabase.from('profiles').update({ active: false, punishment_until: punishmentUntil }).eq('id', profileId);
      return;
    }
    const { data: prof } = await supabase.from('profiles').select('level').eq('id', profileId).single();
    const levelBefore = (prof?.level && prof.level !== 'bronze') ? prof.level : null;
    await supabase.from('profiles').update({
      active: false,
      punishment_until: punishmentUntil,
      level: 'bronze',
      level_admin_override: true,
      level_before_ban: levelBefore,
    }).eq('id', profileId);
  };

  const handlePunish = async (job: any) => {
    if (!confirm('Punir/Banir por 7 dias? Cliente e profissional não poderão criar/aceitar serviços, os pontos deste serviço serão zerados e o nível do profissional será resetado para Bronze.')) return;
    setLoading(true);
    try {
      const until = new Date();
      until.setDate(until.getDate() + 7);
      await saveLevelBeforeBanAndPunish(job.client_id, until.toISOString(), false);
      await NotificationService.notifyUserBanned(job.client_id, '7days', until.toISOString());
      if (job.worker_id) {
        await saveLevelBeforeBanAndPunish(job.worker_id, until.toISOString(), true);
        await NotificationService.notifyUserBanned(job.worker_id, '7days', until.toISOString());
      }
      await supabase.from('jobs').update({ admin_verdict: 'punished', points_awarded: 0 }).eq('id', job.id);
      fetchData();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePunishIndefinite = async (job: any) => {
    if (!confirm('Punir/Banir por tempo indeterminado? Cliente e profissional não poderão usar o app até você remover o banimento. Pontos zerados e nível do profissional resetado para Bronze.')) return;
    setLoading(true);
    try {
      await saveLevelBeforeBanAndPunish(job.client_id, null, false);
      await NotificationService.notifyUserBanned(job.client_id, 'indefinite');
      if (job.worker_id) {
        await saveLevelBeforeBanAndPunish(job.worker_id, null, true);
        await NotificationService.notifyUserBanned(job.worker_id, 'indefinite');
      }
      await supabase.from('jobs').update({ admin_verdict: 'punished', points_awarded: 0 }).eq('id', job.id);
      fetchData();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const openAppealApproveModal = (appeal: any) => {
    const levelBeforeBan = appeal.user?.level_before_ban || null;
    setAppealApproveModal({ appeal, levelBeforeBan });
  };

  const handleAppealApprove = async (restoreLevel: 'bronze' | 'previous') => {
    const modal = appealApproveModal;
    if (!modal) return;
    const { appeal, levelBeforeBan } = modal;
    setAppealApproveModal(null);
    setLoading(true);
    try {
      const updates: any = { active: true, punishment_until: null };
      if (restoreLevel === 'previous' && levelBeforeBan) {
        updates.level = levelBeforeBan;
        updates.level_admin_override = false;
        updates.level_before_ban = null;
      } else {
        updates.level_before_ban = null;
      }
      await supabase.from('profiles').update(updates).eq('id', appeal.user_id);
      await supabase.from('punishment_appeals').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', appeal.id);
      await NotificationService.notifyAppealApproved(appeal.user_id);
      fetchData();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppealReject = async (appeal: any, makeIndefinite?: boolean) => {
    const msg = makeIndefinite
      ? 'Rejeitar recurso e converter banimento para tempo indeterminado?'
      : 'Rejeitar recurso? O usuário permanecerá banido até o fim do período.';
    if (!confirm(msg)) return;
    setLoading(true);
    try {
      await supabase.from('punishment_appeals').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', appeal.id);
      if (makeIndefinite) {
        await supabase.from('profiles').update({ punishment_until: null }).eq('id', appeal.user_id);
        await NotificationService.notifyUserBanned(appeal.user_id, 'indefinite');
      } else {
        await NotificationService.notifyAppealRejected(appeal.user_id);
      }
      fetchData();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePartner = async (id: string) => {
      if(!confirm("Remover este parceiro? Ele perderá acesso ao painel de cupons.")) return;
      await supabase.from('partners').delete().eq('id', id);
      fetchData();
  };

  const handleDeleteJob = async (id: string) => {
      if(!confirm("Tem certeza que deseja apagar este serviço e todas as mensagens vinculadas a ele?")) return;
      try {
          await supabase.from('messages').delete().eq('job_id', id);
          const { data: deleted, error } = await supabase.from('jobs').delete().eq('id', id).select('id');
          if (error) throw error;
          if (!deleted?.length) {
            alert("O serviço não pôde ser apagado (nenhuma linha afetada). Verifique se a política RLS permite que o admin delete jobs.");
            return;
          }
          setJobs(prev => prev.filter(j => j.id !== id));
      } catch (e: any) {
          alert("Erro: " + (e?.message ?? e));
      }
  };

  const fetchUserDetails = async (userId: string) => {
    setLoadingDetails(true);
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      const details: any = {
        ...user,
        jobsAsWorker: 0,
        jobsAsClient: 0,
        workerRating: null,
        clientRatingAverage: null,
        couponsCreated: 0,
        couponsRedeemed: 0,
      };

      // Buscar serviços como worker
      const { data: workerJobs } = await supabase
        .from('jobs')
        .select('id, rating, status')
        .eq('worker_id', userId);
      
      if (workerJobs) {
        details.jobsAsWorker = workerJobs.length;
        const completedWithRating = workerJobs.filter(j => j.status === 'completed' && j.rating != null);
        if (completedWithRating.length > 0) {
          const avg = completedWithRating.reduce((sum, j) => sum + j.rating, 0) / completedWithRating.length;
          details.workerRating = Math.round(avg * 10) / 10;
        }
      }

      // Buscar serviços como client
      const { data: allClientJobs } = await supabase
        .from('jobs')
        .select('id, rating, status')
        .eq('client_id', userId);
      
      if (allClientJobs) {
        details.jobsAsClient = allClientJobs.length;
        // Média de avaliações dadas pelo cliente (apenas serviços completados com rating)
        const ratedJobs = allClientJobs.filter(j => j.status === 'completed' && j.rating != null);
        if (ratedJobs.length > 0) {
          const avg = ratedJobs.reduce((sum, j) => sum + j.rating, 0) / ratedJobs.length;
          details.clientRatingAverage = Math.round(avg * 10) / 10;
        }
      }

      // Buscar cupons resgatados pelo usuário (qualquer tipo de usuário)
      const { data: userRedemptions } = await supabase
        .from('coupon_redemptions')
        .select('id')
        .eq('user_id', userId);
      
      if (userRedemptions) {
        details.couponsRedeemed = userRedemptions.length;
      }

      // Se for parceiro, buscar cupons criados
      if (user.allowed_roles?.includes('partner')) {
        const { data: partnerData } = await supabase
          .from('partners')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        
        if (partnerData) {
          const { data: coupons } = await supabase
            .from('coupons')
            .select('id')
            .eq('partner_id', partnerData.id);
          
          if (coupons) {
            details.couponsCreated = coupons.length;
          }
        }
      }

      setUserDetails(details);
    } catch (err: any) {
      console.error('Erro ao buscar detalhes:', err);
      alert('Erro ao carregar detalhes: ' + err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewUser = async (user: any) => {
    setViewingUser(user);
    await fetchUserDetails(user.id);
  };

  const handleSendNotification = async () => {
      if(!notifTitle || !notifMsg) return alert("Preencha título e mensagem");
      const rolesToTarget: string[] = [];
      if (targetAudiences.client) rolesToTarget.push('client');
      if (targetAudiences.worker) rolesToTarget.push('worker');
      if (targetAudiences.partner) rolesToTarget.push('partner');

      if(rolesToTarget.length === 0) return alert("Selecione pelo menos um tipo de usuário.");

      setLoading(true);
      try {
        const targetUsers = users.filter(u => u.allowed_roles && Array.isArray(u.allowed_roles) && u.allowed_roles.some((r: string) => rolesToTarget.includes(r)));
        const notifications = targetUsers.map(u => ({ user_id: u.id, title: notifTitle, message: notifMsg, type: 'info' }));

        if(notifications.length > 0) {
            await supabase.from('notifications').insert(notifications);
            alert(`Enviado para ${notifications.length} usuários.`);
            setNotifTitle('');
            setNotifMsg('');
        } else {
            alert("Nenhum usuário encontrado com esses perfis.");
        }
      } catch (err: any) {
          alert("Erro ao enviar: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const filteredUsers = users.filter(u => {
    // Busca por nome/email
    const matchesSearch = !searchTerm || 
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro de tipo
    const matchesRole = filterRole === 'all' || 
      (filterRole === 'client' && u.allowed_roles?.includes('client') && !u.allowed_roles?.includes('worker') && !u.allowed_roles?.includes('admin') && !u.allowed_roles?.includes('partner')) ||
      (filterRole === 'worker' && u.allowed_roles?.includes('worker')) ||
      (filterRole === 'partner' && u.allowed_roles?.includes('partner')) ||
      (filterRole === 'admin' && u.allowed_roles?.includes('admin'));
    
    // Filtro de nível (só aplica para workers)
    const matchesLevel = filterLevel === 'all' || 
      !u.allowed_roles?.includes('worker') || // Se não é worker, passa no filtro de nível
      (u.level || 'bronze') === filterLevel;
    
    return matchesSearch && matchesRole && matchesLevel;
  });

  return (
    <div className="space-y-6 pb-24 md:pb-6 w-full max-w-full overflow-hidden">
      <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel Admin</h2>
          
          <div className="relative w-full overflow-x-auto no-scrollbar pb-2">
             <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 w-max">
                  {[
                      { id: 'overview', label: 'Início', icon: ChevronRight, badgeKey: null },
                      { id: 'users', label: 'Usuários', icon: Users, badgeKey: 'users' },
                      { id: 'jobs', label: 'Serviços', icon: Briefcase, badgeKey: 'jobs' },
                      { id: 'redlist', label: 'Lista Vermelha', icon: ShieldAlert, badgeKey: 'redlist' },
                      { id: 'replies', label: 'Tréplicas', icon: FileText, badgeKey: 'replies' },
                      { id: 'partners', label: 'Parceiros', icon: Store, badgeKey: 'partners' },
                      { id: 'suggestions', label: 'Sugestões', icon: Lightbulb, badgeKey: 'suggestions' },
                      { id: 'notifications', label: 'Avisos', icon: BellRing, badgeKey: null }
                  ].map(tab => {
                    const badgeCount = tab.badgeKey ? notifications[tab.badgeKey] : 0;
                    return (
                      <button 
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id as AdminTab)} 
                        className={`px-4 sm:px-5 py-2.5 text-sm rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap relative ${activeTab === tab.id ? 'bg-brand-orange text-white shadow-lg shadow-orange-200' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {activeTab === tab.id && <tab.icon size={16} />}
                        {tab.label}
                        {badgeCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                            {badgeCount > 99 ? '+99' : badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
          </div>
      </div>

      {activeTab === 'overview' && (
          <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <button 
                    onClick={() => handleTabChange('users')}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-brand-orange hover:shadow-md transition-all cursor-pointer text-left"
                  >
                      <div className="bg-orange-100 text-brand-orange p-4 rounded-2xl shrink-0"><Users size={32}/></div>
                      <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-400 uppercase">Usuários</p>
                          <p className="text-3xl font-black text-slate-800">{users.length}</p>
                          {notifications.users > 0 && (
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full mt-1">
                                  {notifications.users > 99 ? '+99' : notifications.users}
                              </span>
                          )}
                      </div>
                  </button>
                  <button 
                    onClick={() => handleTabChange('jobs')}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-brand-blue hover:shadow-md transition-all cursor-pointer text-left"
                  >
                      <div className="bg-blue-100 text-brand-blue p-4 rounded-2xl shrink-0"><Briefcase size={32}/></div>
                      <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-400 uppercase">Serviços</p>
                          <p className="text-3xl font-black text-slate-800">{jobs.length}</p>
                          {notifications.jobs > 0 && (
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full mt-1">
                                  {notifications.jobs > 99 ? '+99' : notifications.jobs}
                              </span>
                          )}
                      </div>
                  </button>
                  <button 
                    onClick={() => handleTabChange('redlist')}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-red-500 hover:shadow-md transition-all cursor-pointer text-left"
                  >
                      <div className="bg-red-100 text-red-600 p-4 rounded-2xl shrink-0"><ShieldAlert size={32}/></div>
                      <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-400 uppercase">Lista Vermelha</p>
                          <p className="text-3xl font-black text-slate-800">{redlistJobs.length}</p>
                          {notifications.redlist > 0 && (
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full mt-1">
                                  {notifications.redlist > 99 ? '+99' : notifications.redlist}
                              </span>
                          )}
                      </div>
                  </button>
                  <button 
                    onClick={() => handleTabChange('replies')}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-slate-500 hover:shadow-md transition-all cursor-pointer text-left"
                  >
                      <div className="bg-slate-100 text-slate-600 p-4 rounded-2xl shrink-0"><FileText size={32}/></div>
                      <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-400 uppercase">Tréplicas</p>
                          <p className="text-3xl font-black text-slate-800">{appeals.filter((a: any) => a.status === 'pending').length}</p>
                          {notifications.replies > 0 && (
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full mt-1">
                                  {notifications.replies > 99 ? '+99' : notifications.replies}
                              </span>
                          )}
                      </div>
                  </button>
                  <button 
                    onClick={() => handleTabChange('partners')}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-purple-500 hover:shadow-md transition-all cursor-pointer text-left"
                  >
                      <div className="bg-purple-100 text-purple-600 p-4 rounded-2xl shrink-0"><Store size={32}/></div>
                      <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-400 uppercase">Parceiros</p>
                          <p className="text-3xl font-black text-slate-800">{partners.length}</p>
                          {notifications.partners > 0 && (
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full mt-1">
                                  {notifications.partners > 99 ? '+99' : notifications.partners}
                              </span>
                          )}
                      </div>
                  </button>
                  <button 
                    onClick={() => handleTabChange('suggestions')}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-yellow-500 hover:shadow-md transition-all cursor-pointer text-left"
                  >
                      <div className="bg-yellow-100 text-yellow-600 p-4 rounded-2xl shrink-0"><Lightbulb size={32}/></div>
                      <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-400 uppercase">Sugestões</p>
                          <p className="text-3xl font-black text-slate-800">{suggestions.filter((s: any) => !s.reviewed).length}</p>
                          {notifications.suggestions > 0 && (
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full mt-1">
                                  {notifications.suggestions > 99 ? '+99' : notifications.suggestions}
                              </span>
                          )}
                      </div>
                  </button>
              </div>
          </div>
      )}

      {activeTab === 'users' && (
          <div className="space-y-4 animate-fade-in">
              {/* Barra de Busca */}
              <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                  <input 
                    className="w-full pl-12 pr-4 py-4 bg-white border-0 shadow-sm rounded-2xl focus:ring-2 focus:ring-brand-orange outline-none" 
                    placeholder="Buscar por nome ou email..."
                    value={searchTerm}
                    onChange={e=>setSearchTerm(e.target.value)}
                  />
              </div>

              {/* Filtros Avançados */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                      <Filter size={16} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-500 uppercase">Filtros</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Filtro de Tipo */}
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tipo</label>
                          <div className="relative">
                              <select 
                                  className="w-full p-2.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none appearance-none text-sm font-medium text-slate-800" 
                                  value={filterRole}
                                  onChange={e => setFilterRole(e.target.value)}
                              >
                                  <option value="all">Todos</option>
                                  <option value="client">Clientes</option>
                                  <option value="worker">Profissionais</option>
                                  <option value="partner">Parceiros</option>
                                  <option value="admin">Admins</option>
                              </select>
                              <ChevronRight className="absolute right-3 top-3 text-slate-400 rotate-90 pointer-events-none" size={14}/>
                          </div>
                      </div>

                      {/* Filtro de Nível */}
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nível</label>
                          <div className="relative">
                              <select 
                                  className="w-full p-2.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none appearance-none text-sm font-medium text-slate-800" 
                                  value={filterLevel}
                                  onChange={e => setFilterLevel(e.target.value)}
                              >
                                  <option value="all">Todos</option>
                                  <option value="bronze">Bronze</option>
                                  <option value="silver">Prata</option>
                                  <option value="gold">Ouro</option>
                                  <option value="diamond">Diamante</option>
                              </select>
                              <ChevronRight className="absolute right-3 top-3 text-slate-400 rotate-90 pointer-events-none" size={14}/>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Lista de Usuários */}
              <div className="grid grid-cols-1 gap-3">
                  {filteredUsers.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-400">
                          <Users size={40} className="mx-auto mb-2 text-slate-300" />
                          <p className="font-bold">Nenhum usuário encontrado</p>
                          <p className="text-xs mt-1">Tente ajustar os filtros</p>
                      </div>
                  ) : (
                      filteredUsers.map(u => (
                          <div 
                            key={u.id} 
                            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:border-brand-orange transition-colors"
                            onClick={() => handleViewUser(u)}
                          >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="relative shrink-0">
                                      <img src={u.avatar_url || DEFAULT_AVATAR} className="w-12 h-12 rounded-2xl bg-slate-100 shrink-0 object-cover"/>
                                      {u.allowed_roles?.includes('worker') && (
                                          <div className="absolute -bottom-1 -right-1">
                                              <LevelBadge level={u.level || 'bronze'} size="sm" />
                                          </div>
                                      )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                      <p className="font-black text-slate-800 truncate text-sm">{u.full_name}</p>
                                      <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                                              u.allowed_roles?.includes('admin') ? 'bg-red-100 text-red-600' :
                                              u.allowed_roles?.includes('partner') ? 'bg-purple-100 text-purple-600' :
                                              u.allowed_roles?.includes('worker') ? 'bg-blue-100 text-blue-600' :
                                              'bg-orange-100 text-brand-orange'
                                          }`}>
                                              {u.allowed_roles?.[0]}
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-bold">{u.points} pts</span>
                                      </div>
                                  </div>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setEditingUser(u); }}
                                className="p-3 bg-slate-50 text-slate-400 hover:text-brand-orange hover:bg-orange-50 rounded-xl transition-colors shrink-0"
                              >
                                  <Edit size={20}/>
                              </button>
                          </div>
                      ))
                  )}
              </div>
          </div>
      )}

      {activeTab === 'jobs' && (
          <div className="space-y-4 animate-fade-in">
              <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl mb-4 border border-blue-100">
                  <h3 className="font-bold flex items-center gap-2 text-sm"><Briefcase size={16}/> Gerenciar Serviços</h3>
                  <p className="text-xs mt-1">Veja todos os serviços cadastrados na plataforma.</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                  {jobs.map(job => (
                      <div key={job.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 relative">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <h4 className="font-black text-slate-800 text-lg">{job.title}</h4>
                                  <p className="text-xs text-slate-500 line-clamp-2">{job.description}</p>
                              </div>
                              <div className="text-right">
                                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                      job.status === 'completed' ? 'bg-green-100 text-green-700' :
                                      job.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                      job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                      'bg-yellow-100 text-yellow-700'
                                  }`}>
                                      {job.status === 'waiting_verification' ? 'Aguardando' : 
                                       job.status === 'in_progress' ? 'Em Andamento' :
                                       job.status === 'completed' ? 'Concluído' :
                                       job.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                                  </span>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mt-4 bg-slate-50 p-3 rounded-xl">
                              <div className="flex flex-col">
                                  <span className="font-bold uppercase text-[10px] text-slate-400">Cliente</span>
                                  <span>{job.client?.full_name || 'Desconhecido'}</span>
                              </div>
                              <div className="flex flex-col">
                                  <span className="font-bold uppercase text-[10px] text-slate-400">Profissional</span>
                                  <span>{job.worker?.full_name || '—'}</span>
                              </div>
                              <div className="flex flex-col">
                                  <span className="font-bold uppercase text-[10px] text-slate-400">Data</span>
                                  <span className="flex items-center gap-1"><Calendar size={10}/> {new Date(job.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="flex flex-col">
                                  <span className="font-bold uppercase text-[10px] text-slate-400">Valor</span>
                                  <span className="flex items-center gap-1 text-green-600 font-bold"><DollarSign size={10}/> R$ {job.price || 'A combinar'}</span>
                              </div>
                          </div>
                          <div className="mt-4 flex justify-end">
                                <button onClick={() => handleDeleteJob(job.id)} className="text-red-400 hover:text-red-600 text-xs font-bold flex items-center gap-1 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"><Trash2 size={14}/> Apagar Serviço</button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'redlist' && (
          <div className="space-y-4 animate-fade-in">
              <div className="bg-red-50 text-red-800 p-4 rounded-2xl border border-red-100 flex items-center gap-3">
                  <ShieldAlert className="text-red-600" size={24} />
                  <div>
                      <h3 className="font-bold text-sm">Lista Vermelha – Auditoria Anti-Fraude</h3>
                      <p className="text-xs mt-1">Casos com mesmo profissional + mesmo cliente em 2 dias consecutivos. Compare as respostas e decida.</p>
                  </div>
              </div>
              {redlistJobs.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-500">
                      <AlertTriangle size={40} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold">Nenhuma atividade suspeita detectada</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 gap-4">
                      {redlistJobs.map((job: any) => {
                          const ad = job.audit_data || {};
                          return (
                              <div key={job.id} className="bg-white p-5 rounded-3xl shadow-sm border border-red-100">
                                  <div className="flex justify-between items-start mb-4">
                                      <div>
                                          <h4 className="font-black text-slate-800 text-lg">{job.title}</h4>
                                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                                              <span className="flex items-center gap-1"><Clock size={12}/> <strong>Aberto:</strong> {job.created_at ? new Date(job.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                                              <span className="flex items-center gap-1"><Clock size={12}/> <strong>Aceito:</strong> {job.accepted_at ? new Date(job.accepted_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                                              <span className="flex items-center gap-1"><Clock size={12}/> <strong>Concluído:</strong> {job.completed_at ? new Date(job.completed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl">
                                      <div>
                                          <span className="font-bold uppercase text-[10px] text-slate-400">Cliente</span>
                                          <p className="font-bold">{job.client?.full_name || '—'}</p>
                                          {(redlistRecurrence[job.client_id] || 0) > 1 && (
                                            <span className="text-amber-600 font-bold" title="Recorrência na lista vermelha">{redlistRecurrence[job.client_id]}ª vez na lista</span>
                                          )}
                                      </div>
                                      <div>
                                          <span className="font-bold uppercase text-[10px] text-slate-400">Profissional</span>
                                          <p className="font-bold">{job.worker?.full_name || '—'}</p>
                                          {job.worker_id && (redlistRecurrence[job.worker_id] || 0) > 1 && (
                                            <span className="text-amber-600 font-bold" title="Recorrência na lista vermelha">{redlistRecurrence[job.worker_id]}ª vez na lista</span>
                                          )}
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 mb-4">
                                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                          <p className="text-xs font-bold text-blue-700 uppercase mb-2">Respostas do Profissional</p>
                                          <p className="text-xs text-slate-700"><span className="font-bold">Materiais:</span> {ad.worker_q1 || '—'}</p>
                                          <p className="text-xs text-slate-700 mt-1"><span className="font-bold">Resultado:</span> {ad.worker_q2 || '—'}</p>
                                      </div>
                                      <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                          <p className="text-xs font-bold text-brand-orange uppercase mb-2">Respostas do Cliente</p>
                                          <p className="text-xs text-slate-700"><span className="font-bold">Materiais:</span> {ad.client_q1 || '—'}</p>
                                          <p className="text-xs text-slate-700 mt-1"><span className="font-bold">Resultado:</span> {ad.client_q2 || '—'}</p>
                                      </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-xl" onClick={() => handleAbsolve(job)} disabled={loading}><CheckCircle size={16} className="mr-1"/> Absolver</Button>
                                      <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 rounded-xl" onClick={() => handlePunish(job)} disabled={loading}><Ban size={16} className="mr-1"/> Punir 7 dias</Button>
                                      <Button size="sm" variant="outline" className="border-red-500 text-red-700 hover:bg-red-50 rounded-xl" onClick={() => handlePunishIndefinite(job)} disabled={loading}><Ban size={16} className="mr-1"/> Punir indefinido</Button>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      )}

      {activeTab === 'replies' && (
          <div className="space-y-4 animate-fade-in">
              <div className="bg-slate-100 text-slate-700 p-4 rounded-2xl border border-slate-200">
                  <h3 className="font-bold flex items-center gap-2 text-sm"><FileText size={16}/> Tréplicas – Recursos de Punição</h3>
                  <p className="text-xs mt-1">Usuários punidos podem recorrer. Aprove para reativar a conta ou rejeite para manter o banimento.</p>
              </div>
              {appeals.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-500">Nenhum recurso pendente.</div>
              ) : (
                  <div className="grid grid-cols-1 gap-4">
                      {appeals.map((a: any) => (
                          <div key={a.id} className="bg-white p-5 rounded-2xl border border-slate-100">
                              <div className="flex justify-between items-start mb-2">
                                  <span className="font-bold text-slate-800">{a.user?.full_name || 'Usuário'}</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : a.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{a.status === 'pending' ? 'Pendente' : a.status === 'approved' ? 'Aprovado' : 'Rejeitado'}</span>
                              </div>
                              {(appealsRecurrence[a.user_id] || 0) > 1 && (
                                  <p className="text-xs text-amber-600 font-bold mb-1">{appealsRecurrence[a.user_id]}ª tréplica deste usuário</p>
                              )}
                              <p className="text-xs text-slate-500 mb-2">Serviço: {a.job?.title || '—'}</p>
                              <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg mb-3">{a.appeal_text}</p>
                              {a.status === 'pending' && (
                                  <div className="flex flex-wrap gap-2">
                                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-xl" onClick={() => openAppealApproveModal(a)} disabled={loading}><CheckCircle size={14} className="mr-1"/> Aprovar</Button>
                                      <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 rounded-xl" onClick={() => handleAppealReject(a, false)} disabled={loading}>Rejeitar</Button>
                                      <Button size="sm" variant="outline" className="border-red-500 text-red-700 hover:bg-red-50 rounded-xl" onClick={() => handleAppealReject(a, true)} disabled={loading}>Rejeitar e banir indefinido</Button>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* Modal: Aprovar recurso e escolher nível */}
      {appealApproveModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <h3 className="font-bold text-lg text-slate-800 mb-2">Aprovar recurso</h3>
                  <p className="text-sm text-slate-600 mb-4">O usuário voltará a poder usar o app. Escolha o nível do profissional:</p>
                  <div className="space-y-2 mb-4">
                      <button
                          type="button"
                          onClick={() => handleAppealApprove('bronze')}
                          className="w-full p-3 rounded-xl border-2 border-slate-200 hover:border-brand-orange hover:bg-orange-50 text-left font-bold text-slate-800"
                      >
                          Manter em Bronze
                      </button>
                      {appealApproveModal.levelBeforeBan && (
                          <button
                              type="button"
                              onClick={() => handleAppealApprove('previous')}
                              className="w-full p-3 rounded-xl border-2 border-slate-200 hover:border-green-500 hover:bg-green-50 text-left font-bold text-slate-800"
                          >
                              Restaurar para {appealApproveModal.levelBeforeBan === 'diamond' ? 'Diamante' : appealApproveModal.levelBeforeBan === 'gold' ? 'Ouro' : appealApproveModal.levelBeforeBan === 'silver' ? 'Prata' : 'Bronze'}
                          </button>
                      )}
                  </div>
                  <Button variant="outline" fullWidth onClick={() => setAppealApproveModal(null)}>Cancelar</Button>
              </div>
          </div>
      )}

      {activeTab === 'partners' && (
          <div className="space-y-4 animate-fade-in">
              <div className="bg-brand-orange/10 p-4 rounded-2xl border border-brand-orange/20">
                  <p className="text-xs font-bold text-brand-orange">DICA:</p>
                  <p className="text-xs text-slate-600">Para adicionar um parceiro, localize o usuário na aba "Usuários" e mude a Permissão dele para "Parceiro".</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {partners.map(p => (
                      <div key={p.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                              <img src={p.logoUrl} className="w-14 h-14 object-contain bg-slate-50 rounded-2xl border p-1"/>
                              <div>
                                  <h4 className="font-black text-slate-800">{p.name}</h4>
                                  <p className="text-xs text-slate-500">{p.email}</p>
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">{p.category}</span>
                              </div>
                          </div>
                          <button onClick={() => handleDeletePartner(p.id)} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl"><Trash2 size={20}/></button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'suggestions' && (
          <div className="space-y-4 animate-fade-in">
              <div className="bg-yellow-50 text-yellow-800 p-4 rounded-2xl border border-yellow-200">
                  <h3 className="font-bold flex items-center gap-2 text-sm"><Lightbulb size={16}/> Sugestões de Categoria</h3>
                  <p className="text-xs mt-1">Profissionais sugeriram essas categorias ao se cadastrarem.</p>
              </div>
              {suggestions.length === 0 && <div className="p-8 text-center text-slate-400 bg-white rounded-2xl">Nenhuma sugestão pendente.</div>}
              <div className="grid grid-cols-1 gap-3">
                  {suggestions.map(s => (
                      <div key={s.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                          <div className="flex justify-between items-start">
                              <div>
                                  <span className="text-xs font-bold text-slate-400 uppercase">Sugestão</span>
                                  <h4 className="font-black text-lg text-slate-800">{s.suggestion}</h4>
                              </div>
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold">{new Date(s.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-50 text-xs text-slate-500 flex items-center gap-2">
                              <Users size={12} /> Sugerido por: <span className="font-bold">{s.userName}</span>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'notifications' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 animate-fade-in space-y-4 w-full">
              <h3 className="font-black text-xl text-slate-800 flex items-center gap-2"><BellRing className="text-brand-orange"/> Enviar Notificação</h3>
              <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase">Enviar para:</p>
                  <div className="flex flex-wrap gap-2">
                      <button onClick={() => setTargetAudiences(p => ({...p, client: !p.client}))} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border transition-colors ${targetAudiences.client ? 'bg-orange-50 border-brand-orange text-brand-orange' : 'bg-white border-slate-200 text-slate-500'}`}> {targetAudiences.client ? <CheckSquare size={16}/> : <Square size={16}/>} Clientes </button>
                      <button onClick={() => setTargetAudiences(p => ({...p, worker: !p.worker}))} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border transition-colors ${targetAudiences.worker ? 'bg-blue-50 border-brand-blue text-brand-blue' : 'bg-white border-slate-200 text-slate-500'}`}> {targetAudiences.worker ? <CheckSquare size={16}/> : <Square size={16}/>} Profissionais </button>
                      <button onClick={() => setTargetAudiences(p => ({...p, partner: !p.partner}))} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border transition-colors ${targetAudiences.partner ? 'bg-purple-50 border-purple-500 text-purple-600' : 'bg-white border-slate-200 text-slate-500'}`}> {targetAudiences.partner ? <CheckSquare size={16}/> : <Square size={16}/>} Parceiros </button>
                  </div>
              </div>
              <div className="space-y-4 pt-2">
                  <input className="w-full p-4 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-brand-orange" placeholder="Título do Aviso" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} />
                  <textarea className="w-full p-4 bg-slate-50 border-0 rounded-2xl h-32 outline-none focus:ring-2 focus:ring-brand-orange" placeholder="Sua mensagem para os usuários..." value={notifMsg} onChange={e => setNotifMsg(e.target.value)} />
                  <Button fullWidth size="lg" className="rounded-2xl shadow-lg shadow-orange-200" onClick={handleSendNotification} disabled={loading}> <Send size={18} className="mr-2"/> {loading ? 'Enviando...' : 'Disparar Notificação'} </Button>
              </div>
          </div>
      )}

      {viewingUser && userDetails && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-fade-in backdrop-blur-sm overflow-y-auto">
              <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl my-8 animate-fade-in">
                  <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                          <div className="relative shrink-0">
                              <img src={userDetails.avatar_url || DEFAULT_AVATAR} className="w-16 h-16 rounded-2xl bg-slate-100 object-cover"/>
                              {userDetails.allowed_roles?.includes('worker') && (
                                  <div className="absolute -bottom-1 -right-1">
                                      <LevelBadge level={userDetails.level || 'bronze'} size="md" />
                                  </div>
                              )}
                          </div>
                          <div>
                              <h3 className="font-black text-xl text-slate-800">{userDetails.full_name}</h3>
                              <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-xs font-black uppercase ${
                                  userDetails.allowed_roles?.includes('admin') ? 'bg-red-100 text-red-600' :
                                  userDetails.allowed_roles?.includes('partner') ? 'bg-purple-100 text-purple-600' :
                                  userDetails.allowed_roles?.includes('worker') ? 'bg-blue-100 text-blue-600' :
                                  'bg-orange-100 text-brand-orange'
                              }`}>
                                  {userDetails.allowed_roles?.[0]}
                              </span>
                          </div>
                      </div>
                      <button onClick={() => { setViewingUser(null); setUserDetails(null); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X size={24}/></button>
                  </div>

                  {loadingDetails ? (
                      <div className="text-center py-8 text-slate-400">Carregando detalhes...</div>
                  ) : (
                      <div className="space-y-4">
                          {/* Informações Básicas */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2"><Users size={16}/> Informações Básicas</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                  <div>
                                      <span className="text-xs font-bold text-slate-400 uppercase block">Nome</span>
                                      <span className="text-slate-800 font-medium">{userDetails.full_name || '—'}</span>
                                  </div>
                                  <div>
                                      <span className="text-xs font-bold text-slate-400 uppercase block">Email</span>
                                      <span className="text-slate-800 font-medium">{userDetails.email || '—'}</span>
                                  </div>
                                  <div>
                                      <span className="text-xs font-bold text-slate-400 uppercase block">Celular</span>
                                      <span className="text-slate-800 font-medium">{userDetails.phone || '—'}</span>
                                  </div>
                                  <div>
                                      <span className="text-xs font-bold text-slate-400 uppercase block">CPF</span>
                                      <span className="text-slate-800 font-medium">{userDetails.cpf || '—'}</span>
                                  </div>
                                  <div>
                                      <span className="text-xs font-bold text-slate-400 uppercase block">Pontos</span>
                                      <span className="text-slate-800 font-medium">{userDetails.points || 0} pts</span>
                                  </div>
                                  <div>
                                      <span className="text-xs font-bold text-slate-400 uppercase block">Cupons Resgatados</span>
                                      <span className="text-slate-800 font-medium">{userDetails.couponsRedeemed || 0}</span>
                                  </div>
                                  {userDetails.city && (
                                      <div>
                                          <span className="text-xs font-bold text-slate-400 uppercase block">Localização</span>
                                          <span className="text-slate-800 font-medium">{userDetails.city}{userDetails.state ? `, ${userDetails.state}` : ''}</span>
                                      </div>
                                  )}
                                  {userDetails.active === false && (
                                      <div className="sm:col-span-2">
                                          <span className="text-xs font-bold text-red-600 uppercase block">Status da Conta</span>
                                          <span className="text-red-600 font-bold">
                                              {userDetails.punishment_until 
                                                ? `Banido até ${new Date(userDetails.punishment_until).toLocaleDateString('pt-BR')}`
                                                : 'Banido indefinidamente'}
                                          </span>
                                      </div>
                                  )}
                              </div>
                          </div>

                          {/* Estatísticas como Profissional */}
                          {userDetails.allowed_roles?.includes('worker') && (
                              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                  <h4 className="font-bold text-blue-700 text-sm mb-3 flex items-center gap-2"><Briefcase size={16}/> Estatísticas como Profissional</h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                      <div>
                                          <span className="text-xs font-bold text-blue-600 uppercase block">Serviços Realizados</span>
                                          <span className="text-slate-800 font-bold text-lg">{userDetails.jobsAsWorker || 0}</span>
                                      </div>
                                      <div>
                                          <span className="text-xs font-bold text-blue-600 uppercase block mb-1">Avaliação Média</span>
                                          {userDetails.workerRating ? (
                                              <div className="flex items-center gap-2">
                                                  <StarRatingDisplay rating={userDetails.workerRating} size={18} />
                                                  <span className="text-slate-800 font-bold text-lg">{userDetails.workerRating.toFixed(1)}</span>
                                              </div>
                                          ) : (
                                              <span className="text-slate-500">Sem avaliações ainda</span>
                                          )}
                                      </div>
                                      {userDetails.level && (
                                          <div>
                                              <span className="text-xs font-bold text-blue-600 uppercase block">Nível</span>
                                              <span className="text-slate-800 font-medium capitalize">{userDetails.level === 'diamond' ? 'Diamante' : userDetails.level === 'gold' ? 'Ouro' : userDetails.level === 'silver' ? 'Prata' : 'Bronze'}</span>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}

                          {/* Estatísticas como Cliente */}
                          {userDetails.allowed_roles?.includes('client') && (
                              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                  <h4 className="font-bold text-brand-orange text-sm mb-3 flex items-center gap-2"><Users size={16}/> Estatísticas como Cliente</h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                      <div>
                                          <span className="text-xs font-bold text-brand-orange uppercase block">Serviços Solicitados</span>
                                          <span className="text-slate-800 font-bold text-lg">{userDetails.jobsAsClient || 0}</span>
                                      </div>
                                      <div>
                                          <span className="text-xs font-bold text-brand-orange uppercase block mb-1">Média de Avaliações Dadas</span>
                                          {userDetails.clientRatingAverage ? (
                                              <div className="flex items-center gap-2">
                                                  <StarRatingDisplay rating={userDetails.clientRatingAverage} size={18} />
                                                  <span className="text-slate-800 font-bold text-lg">{userDetails.clientRatingAverage.toFixed(1)}</span>
                                              </div>
                                          ) : (
                                              <span className="text-slate-500">Sem avaliações dadas ainda</span>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          )}

                          {/* Estatísticas como Parceiro */}
                          {userDetails.allowed_roles?.includes('partner') && (
                              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                  <h4 className="font-bold text-purple-600 text-sm mb-3 flex items-center gap-2"><Store size={16}/> Estatísticas como Parceiro</h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                      <div>
                                          <span className="text-xs font-bold text-purple-600 uppercase block">Cupons Criados</span>
                                          <span className="text-slate-800 font-bold text-lg">{userDetails.couponsCreated || 0}</span>
                                      </div>
                                      <div>
                                          <span className="text-xs font-bold text-purple-600 uppercase block">Cupons Resgatados</span>
                                          <span className="text-slate-800 font-bold text-lg">{userDetails.couponsRedeemed || 0}</span>
                                      </div>
                                  </div>
                              </div>
                          )}

                          {/* Botões de Ação */}
                          <div className="flex flex-col sm:flex-row gap-2 pt-2">
                              <Button variant="outline" fullWidth onClick={() => { setViewingUser(null); setUserDetails(null); }}>Fechar</Button>
                              <Button fullWidth onClick={() => { setViewingUser(null); setUserDetails(null); setEditingUser(userDetails); }}>Editar Usuário</Button>
                              {userDetails.allowed_roles?.includes('admin') ? null : (
                                  <Button 
                                    variant="danger" 
                                    fullWidth 
                                    onClick={() => setShowBanModal(true)}
                                    className="flex items-center justify-center gap-2"
                                  >
                                      <Ban size={18} />
                                      {userDetails.active === false ? 'Gerenciar Banimento' : 'Banir Usuário'}
                                  </Button>
                              )}
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Modal de Banimento */}
      {showBanModal && userDetails && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 animate-fade-in backdrop-blur-sm">
              <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
                  <div className="flex justify-between items-start mb-4">
                      <div>
                          <h3 className="font-bold text-xl text-slate-800">Banir Usuário</h3>
                          <p className="text-sm text-slate-600 mt-1">{userDetails.full_name}</p>
                      </div>
                      <button onClick={() => { setShowBanModal(false); setBanType(null); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X size={24}/></button>
                  </div>

                  {userDetails.active === false ? (
                      <div className="space-y-4">
                          <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
                              <p className="text-sm font-bold text-red-800 mb-2">Usuário está banido</p>
                              <p className="text-xs text-red-700">
                                  {userDetails.punishment_until 
                                    ? `Banimento expira em: ${new Date(userDetails.punishment_until).toLocaleDateString('pt-BR')}`
                                    : 'Banimento indefinido'}
                              </p>
                          </div>
                          <div className="space-y-2">
                              <button
                                  onClick={async () => {
                                      if (!confirm('Remover banimento deste usuário?')) return;
                                      setLoading(true);
                                      try {
                                          await supabase.from('profiles').update({ active: true, punishment_until: null }).eq('id', userDetails.id);
                                          await NotificationService.notifyUserUnbanned(userDetails.id);
                                          alert('Banimento removido com sucesso!');
                                          setShowBanModal(false);
                                          setBanType(null);
                                          await fetchUserDetails(userDetails.id);
                                          fetchData();
                                      } catch (e: any) {
                                          alert('Erro: ' + e.message);
                                      } finally {
                                          setLoading(false);
                                      }
                                  }}
                                  className="w-full p-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors"
                              >
                                  Remover Banimento
                              </button>
                              <button
                                  onClick={async () => {
                                      if (!confirm('Alterar para banimento indefinido? O nível do profissional será resetado para Bronze.')) return;
                                      setLoading(true);
                                      try {
                                          const updates: any = { active: false, punishment_until: null };
                                          if (userDetails.allowed_roles?.includes('worker')) {
                                              updates.level = 'bronze';
                                              updates.level_admin_override = true;
                                          }
                                          await supabase.from('profiles').update(updates).eq('id', userDetails.id);
                                          await NotificationService.notifyUserBanned(userDetails.id, 'indefinite');
                                          alert('Banimento alterado para indefinido!');
                                          setShowBanModal(false);
                                          setBanType(null);
                                          await fetchUserDetails(userDetails.id);
                                          fetchData();
                                      } catch (e: any) {
                                          alert('Erro: ' + e.message);
                                      } finally {
                                          setLoading(false);
                                      }
                                  }}
                                  className="w-full p-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors"
                              >
                                  Alterar para Banimento Indefinido
                              </button>
                          </div>
                      </div>
                  ) : banType === null ? (
                      <div className="space-y-3">
                          <p className="text-sm text-slate-600 mb-4">Escolha o tipo de banimento:</p>
                          <button
                              onClick={() => setBanType('7days')}
                              className="w-full p-4 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-brand-orange rounded-xl text-left transition-colors"
                          >
                              <div className="font-bold text-slate-800 mb-1">Banir por 7 dias</div>
                              <div className="text-xs text-slate-600">
                                  O banimento será removido automaticamente após 7 dias
                                  {userDetails.allowed_roles?.includes('worker') && (
                                    <span className="block mt-1 font-bold text-red-600">Nível será resetado para Bronze</span>
                                  )}
                              </div>
                          </button>
                          <button
                              onClick={() => setBanType('indefinite')}
                              className="w-full p-4 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-red-500 rounded-xl text-left transition-colors"
                          >
                              <div className="font-bold text-slate-800 mb-1">Banir indefinidamente</div>
                              <div className="text-xs text-slate-600">
                                  O banimento só será removido manualmente pelo admin
                                  {userDetails.allowed_roles?.includes('worker') && (
                                    <span className="block mt-1 font-bold text-red-600">Nível será resetado para Bronze</span>
                                  )}
                              </div>
                          </button>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
                              <p className="text-sm font-bold text-red-800 mb-2">Confirmar banimento?</p>
                              <p className="text-xs text-red-700">
                                  {banType === '7days' 
                                    ? 'O usuário será banido por 7 dias e não poderá criar/aceitar serviços durante este período.'
                                    : 'O usuário será banido indefinidamente até que você remova o banimento manualmente.'}
                                  {userDetails.allowed_roles?.includes('worker') && (
                                    <span className="block mt-2 font-bold">O nível do profissional será resetado para Bronze.</span>
                                  )}
                              </p>
                          </div>
                          <div className="flex gap-2">
                              <Button variant="outline" fullWidth onClick={() => setBanType(null)}>Voltar</Button>
                              <Button 
                                  variant="danger" 
                                  fullWidth 
                                  onClick={async () => {
                                      setLoading(true);
                                      try {
                                          const until = banType === '7days' 
                                            ? (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString(); })()
                                            : null;
                                          
                                          const updates: any = { active: false, punishment_until: until };
                                          if (userDetails.allowed_roles?.includes('worker')) {
                                              const cur = (userDetails.level || 'bronze');
                                              updates.level = 'bronze';
                                              updates.level_admin_override = true;
                                              updates.level_before_ban = cur !== 'bronze' ? cur : null;
                                          }
                                          await supabase.from('profiles').update(updates).eq('id', userDetails.id);
                                          
                                          // Notificar o usuário sobre o banimento
                                          await NotificationService.notifyUserBanned(userDetails.id, banType, until || undefined);
                                          
                                          alert('Usuário banido com sucesso!');
                                          setShowBanModal(false);
                                          setBanType(null);
                                          await fetchUserDetails(userDetails.id);
                                          fetchData();
                                      } catch (e: any) {
                                          alert('Erro: ' + e.message);
                                      } finally {
                                          setLoading(false);
                                      }
                                  }}
                                  disabled={loading}
                              >
                                  {loading ? 'Processando...' : 'Confirmar Banimento'}
                              </Button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {editingUser && (
          <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={fetchData} />
      )}
    </div>
  );
};