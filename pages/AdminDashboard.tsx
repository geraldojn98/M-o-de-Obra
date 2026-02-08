import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Button } from '../components/Button';
import { 
    Users, Briefcase, Store, Search, Trash2, Edit, 
    X, BellRing, Send, ChevronRight, CheckSquare, Square, Calendar, DollarSign, Lightbulb,
    ShieldAlert, AlertTriangle, CheckCircle, Ban, FileText, Clock
} from 'lucide-react';
import { Partner, CategorySuggestion, POINTS_RULES } from '../types';

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
            const updates: Record<string, unknown> = { 
                full_name: name, 
                points: points, 
                allowed_roles: [role] 
            };
            if (isWorker) {
                updates.level = level;
                updates.level_admin_override = levelOverride;
            }
            const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
            
            if (error) throw error;
            
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

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Data
  const [users, setUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);

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

  useEffect(() => {
    fetchData();
  }, [activeTab]);

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
      .select('*, user:user_id(full_name), job:job_id(title, client_id, worker_id)')
      .order('created_at', { ascending: false });
    if (appData) setAppeals(appData);

    if(u) setUsers(u);
    if(j) setJobs(j);
    if(p) setPartners(p);
    if(s) setSuggestions(s.map((i:any) => ({ id: i.id, userId: i.user_id, userName: i.user?.full_name, suggestion: i.suggestion, createdAt: i.created_at })));
    
    setLoading(false);
  };

  const handleAbsolve = async (job: any) => {
    if (!confirm('Absolver este caso? A flag de suspeita será removida e os pontos validados.')) return;
    setLoading(true);
    try {
      await supabase.from('profiles').update({ suspicious_flag: false }).eq('id', job.client_id);
      if (job.worker_id) await supabase.from('profiles').update({ suspicious_flag: false }).eq('id', job.worker_id);
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

  const handlePunish = async (job: any) => {
    if (!confirm('Punir/Banir por 7 dias? Cliente e profissional não poderão criar/aceitar serviços e os pontos deste serviço serão zerados.')) return;
    setLoading(true);
    try {
      const until = new Date();
      until.setDate(until.getDate() + 7);
      await supabase.from('profiles').update({ active: false, punishment_until: until.toISOString() }).eq('id', job.client_id);
      if (job.worker_id) await supabase.from('profiles').update({ active: false, punishment_until: until.toISOString() }).eq('id', job.worker_id);
      await supabase.from('jobs').update({ admin_verdict: 'punished', points_awarded: 0 }).eq('id', job.id);
      fetchData();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppealApprove = async (appeal: any) => {
    if (!confirm('Aprovar recurso? O usuário voltará a poder usar o app.')) return;
    setLoading(true);
    try {
      await supabase.from('profiles').update({ active: true, punishment_until: null }).eq('id', appeal.user_id);
      await supabase.from('punishment_appeals').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', appeal.id);
      fetchData();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppealReject = async (appeal: any) => {
    if (!confirm('Rejeitar recurso? O usuário permanecerá banido até o fim do período.')) return;
    setLoading(true);
    try {
      await supabase.from('punishment_appeals').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', appeal.id);
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
          const { error } = await supabase.from('jobs').delete().eq('id', id);
          if (error) throw error;
          setJobs(prev => prev.filter(j => j.id !== id));
      } catch (e: any) {
          alert("Erro: " + e.message);
      }
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

  const filteredUsers = users.filter(u => 
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-24 md:pb-6 w-full max-w-full overflow-hidden">
      <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel Admin</h2>
          
          <div className="relative w-full overflow-x-auto no-scrollbar pb-2">
             <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 w-max">
                  {[
                      { id: 'overview', label: 'Início', icon: ChevronRight },
                      { id: 'users', label: 'Usuários', icon: Users },
                      { id: 'jobs', label: 'Serviços', icon: Briefcase },
                      { id: 'redlist', label: 'Lista Vermelha', icon: ShieldAlert },
                      { id: 'replies', label: 'Tréplicas', icon: FileText },
                      { id: 'partners', label: 'Parceiros', icon: Store },
                      { id: 'suggestions', label: 'Sugestões', icon: Lightbulb },
                      { id: 'notifications', label: 'Avisos', icon: BellRing }
                  ].map(tab => (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as AdminTab)} 
                        className={`px-4 sm:px-5 py-2.5 text-sm rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-brand-orange text-white shadow-lg shadow-orange-200' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {activeTab === tab.id && <tab.icon size={16} />}
                        {tab.label}
                      </button>
                  ))}
              </div>
          </div>
      </div>

      {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="bg-orange-100 text-brand-orange p-4 rounded-2xl"><Users size={32}/></div>
                  <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Usuários</p>
                      <p className="text-3xl font-black text-slate-800">{users.length}</p>
                  </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="bg-blue-100 text-brand-blue p-4 rounded-2xl"><Briefcase size={32}/></div>
                  <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Jobs</p>
                      <p className="text-3xl font-black text-slate-800">{jobs.length}</p>
                  </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="bg-purple-100 text-purple-600 p-4 rounded-2xl"><Store size={32}/></div>
                  <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Parceiros</p>
                      <p className="text-3xl font-black text-slate-800">{partners.length}</p>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'users' && (
          <div className="space-y-4 animate-fade-in">
              <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                  <input 
                    className="w-full pl-12 pr-4 py-4 bg-white border-0 shadow-sm rounded-2xl focus:ring-2 focus:ring-brand-orange outline-none" 
                    placeholder="Buscar por nome ou email..."
                    value={searchTerm}
                    onChange={e=>setSearchTerm(e.target.value)}
                  />
              </div>
              <div className="grid grid-cols-1 gap-3">
                  {filteredUsers.map(u => (
                      <div key={u.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                              <img src={u.avatar_url} className="w-12 h-12 rounded-2xl bg-slate-100 shrink-0"/>
                              <div className="min-w-0">
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
                                      {u.allowed_roles?.includes('worker') && (
                                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                              u.level === 'diamond' ? 'bg-cyan-400/30 text-cyan-800' :
                                              u.level === 'gold' ? 'bg-amber-400/30 text-amber-800' :
                                              u.level === 'silver' ? 'bg-slate-400/30 text-slate-700' :
                                              'bg-amber-800/30 text-amber-900'
                                          }`} title={u.level_admin_override ? 'Nível definido pelo admin' : ''}>
                                              {u.level === 'diamond' ? '◆Diamante' : u.level === 'gold' ? '★Ouro' : u.level === 'silver' ? '●Prata' : '◆Bronze'}
                                          </span>
                                      )}
                                      <span className="text-[10px] text-slate-400 font-bold">{u.points} pts</span>
                                  </div>
                              </div>
                          </div>
                          <button 
                            onClick={() => setEditingUser(u)}
                            className="p-3 bg-slate-50 text-slate-400 hover:text-brand-orange hover:bg-orange-50 rounded-xl transition-colors"
                          >
                              <Edit size={20}/>
                          </button>
                      </div>
                  ))}
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
                                      <div><span className="font-bold uppercase text-[10px] text-slate-400">Cliente</span><p className="font-bold">{job.client?.full_name || '—'}</p></div>
                                      <div><span className="font-bold uppercase text-[10px] text-slate-400">Profissional</span><p className="font-bold">{job.worker?.full_name || '—'}</p></div>
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
                                      <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 rounded-xl" onClick={() => handlePunish(job)} disabled={loading}><Ban size={16} className="mr-1"/> Punir/Banir</Button>
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
                              <p className="text-xs text-slate-500 mb-2">Serviço: {a.job?.title || '—'}</p>
                              <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg mb-3">{a.appeal_text}</p>
                              {a.status === 'pending' && (
                                  <div className="flex gap-2">
                                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-xl" onClick={() => handleAppealApprove(a)} disabled={loading}><CheckCircle size={14} className="mr-1"/> Aprovar</Button>
                                      <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 rounded-xl" onClick={() => handleAppealReject(a)} disabled={loading}>Rejeitar</Button>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              )}
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

      {editingUser && (
          <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={fetchData} />
      )}
    </div>
  );
};