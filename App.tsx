import React, { useState, useEffect } from 'react';
import { User, UserRole, ServiceCategory } from './types';
import { Mascot } from './components/Mascot';
import { Button } from './components/Button';
import { LogOut, Settings, User as UserIcon, Save, CircleHelp, X, Phone, Mail, Store } from 'lucide-react';
import { AdminDashboard } from './pages/AdminDashboard';
import { ClientDashboard } from './pages/ClientDashboard';
import { WorkerDashboard } from './pages/WorkerDashboard';
import { PartnersPage } from './pages/PartnersPage';
import { PartnerDashboard } from './pages/PartnerDashboard';
import { supabase } from './services/supabase';
import { NotificationBell } from './components/NotificationBell';

const maskPhone = (value: string) => {
  let v = value.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 7) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  else if (v.length > 2) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  return v;
};

const maskCpf = (value: string) => {
  let v = value.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 9) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
  else if (v.length > 6) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
  else if (v.length > 3) v = `${v.slice(0, 3)}.${v.slice(3)}`;
  return v;
};

const inputClass = "w-full px-4 py-3 bg-slate-50 border-0 rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-brand-orange outline-none transition-all shadow-sm";

const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[100] p-4 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-slide-up sm:animate-fade-in">
            <div className="bg-brand-orange p-5 flex justify-between items-center text-white">
                <h3 className="font-black text-lg flex items-center gap-2">Central de Ajuda</h3>
                <button onClick={onClose} className="bg-white/20 p-1 rounded-full hover:bg-white/30"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-6">
                <div className="text-center">
                    <img src="https://i.ibb.co/Zpwrnpr9/ROSTO-MASCOTE-TRANSPARENTE.png" className="w-16 h-16 mx-auto mb-3" />
                    <p className="text-slate-600 text-sm font-medium">Como podemos facilitar seu dia?</p>
                </div>
                <div className="space-y-3">
                    <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-4 border border-slate-100">
                        <div className="bg-green-100 p-2 rounded-xl text-green-600"><Phone size={24}/></div>
                        <div><p className="text-[10px] text-slate-400 font-black uppercase">WhatsApp</p><p className="text-sm font-bold">(11) 99999-9999</p></div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-4 border border-slate-100">
                        <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><Mail size={24}/></div>
                        <div><p className="text-[10px] text-slate-400 font-black uppercase">Email</p><p className="text-sm font-bold">ajuda@maodeobra.com</p></div>
                    </div>
                </div>
                <Button fullWidth size="lg" onClick={onClose} className="rounded-2xl">Fechar</Button>
            </div>
        </div>
    </div>
);

const LoginPage: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'client' | 'worker'>('client');
    const [isRegistering, setIsRegistering] = useState(false);
    
    // Register Fields
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPhone, setRegPhone] = useState('');
    const [regCpf, setRegCpf] = useState('');
    const [regPass, setRegPass] = useState('');
    const [regSpecialty, setRegSpecialty] = useState('');

    const [categories, setCategories] = useState<ServiceCategory[]>([]);

    useEffect(() => {
        if(isRegistering && activeTab === 'worker') {
            supabase.from('service_categories').select('*').then(({data}) => {
                if(data) setCategories(data);
            });
        }
    }, [isRegistering, activeTab]);
  
    const handleLoginSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(''); setSuccess(''); setLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        if (!authData.user) throw new Error("Erro user");
  
        let { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).maybeSingle();
        
        if (!profile) {
            const { data: userMeta } = await supabase.auth.getUser();
            const meta = userMeta.user?.user_metadata || {};
            const { data: partnerData } = await supabase.from('partners').select('id').eq('email', authData.user.email).maybeSingle();
            const isPartner = !!partnerData;

            const newProfile = {
                id: authData.user.id,
                email: authData.user.email,
                full_name: meta.full_name || 'Usuário Recuperado',
                allowed_roles: isPartner ? ['partner'] : [meta.role || 'client'],
                points: isPartner ? 0 : 50,
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${authData.user.email}`,
                phone: meta.phone || '',
                cpf: meta.cpf || '',
                specialty: meta.specialty || ''
            };
            await supabase.from('profiles').insert(newProfile);
            profile = newProfile;
        }

        const allowedRoles = profile.allowed_roles || [];
        let currentRole: UserRole = activeTab;

        if (allowedRoles.includes('partner')) {
            currentRole = 'partner';
        } else if (allowedRoles.includes('admin')) {
            currentRole = 'admin';
        } else if (!allowedRoles.includes(activeTab)) {
             await supabase.auth.signOut();
             throw new Error(`Esta conta não está habilitada para entrar como ${activeTab === 'client' ? 'Cliente' : 'Profissional'}.`);
        }
  
        onLogin({
          id: profile.id, email: profile.email, name: profile.full_name, role: currentRole,
          points: profile.points, avatar: profile.avatar_url, completedJobs: profile.completed_jobs,
          rating: profile.rating, profession: profile.specialty, specialty: profile.specialty, bio: profile.bio,
          phone: profile.phone, cpf: profile.cpf
        });
      } catch (err: any) { 
        setError(err.message); 
      } finally { setLoading(false); }
    };
  
    const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault(); setError(''); setSuccess(''); setLoading(true);
      try {
        const metaData = { 
            full_name: regName, 
            role: activeTab, 
            phone: regPhone, 
            cpf: activeTab === 'worker' ? regCpf : null,
            specialty: activeTab === 'worker' ? regSpecialty : null
        };
        const { error } = await supabase.auth.signUp({ email: regEmail, password: regPass, options: { data: metaData } });
        if (error) throw error;
        setTimeout(async () => { toggleMode(); setSuccess('Conta criada com sucesso! Faça login.'); }, 1500);
      } catch (err: any) { setError(err.message); } finally { setLoading(false); }
    };
  
    const toggleMode = () => { setIsRegistering(!isRegistering); setError(''); setRegName(''); setRegEmail(''); setRegPhone(''); setRegCpf(''); setRegPass(''); setRegSpecialty(''); };
  
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-orange-100 overflow-x-hidden">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in">
          <div className="bg-brand-orange/5 p-8 flex flex-col items-center relative">
            {isRegistering && <button onClick={toggleMode} className="absolute left-6 top-6 text-brand-orange flex gap-1 items-center font-bold text-sm hover:underline"><Settings size={16}/> Voltar</button>}
            <img src="https://i.ibb.co/jv1sVsmT/LOGO-FUNDO-TRANSPARENTE.png" alt="Logo" className="w-48 h-48 object-contain drop-shadow-xl" />
            <h2 className="text-2xl font-black text-slate-800 mt-4 tracking-tight">{isRegistering ? 'Criar Nova Conta' : 'Acessar Plataforma'}</h2>
          </div>
          <div className="p-8">
            <div className="flex mb-6 bg-slate-100 rounded-xl p-1.5">
              <button className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'client' ? 'bg-white text-brand-orange shadow-md' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('client')}>Cliente</button>
              <button className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'worker' ? 'bg-white text-brand-blue shadow-md' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('worker')}>Profissional</button>
            </div>
            
            {!isRegistering ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {success && <div className="text-green-600 bg-green-50 p-3 text-center rounded-xl font-bold text-sm flex items-center justify-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"/>{success}</div>}
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className={inputClass} placeholder="Email" required />
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className={inputClass} placeholder="Senha" required />
                {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}
                <Button type="submit" fullWidth size="lg" className="rounded-2xl shadow-lg shadow-orange-200">{loading ? 'Entrando...' : 'Entrar Agora'}</Button>
                <div className="text-center pt-4"><button type="button" onClick={toggleMode} className="text-slate-400 font-bold hover:text-brand-orange text-sm">Não tem conta? Cadastre-se</button></div>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                 <input value={regName} onChange={e=>setRegName(e.target.value)} className={inputClass} placeholder="Nome Completo" required />
                 <input value={regEmail} onChange={e=>setRegEmail(e.target.value)} className={inputClass} placeholder="Email" required />
                 <input value={regPhone} onChange={e=>setRegPhone(maskPhone(e.target.value))} className={inputClass} placeholder="Celular" required />
                 {activeTab === 'worker' && <input value={regCpf} onChange={e=>setRegCpf(maskCpf(e.target.value))} className={inputClass} placeholder="CPF" required />}
                 
                 {activeTab === 'worker' && (
                     <select value={regSpecialty} onChange={e=>setRegSpecialty(e.target.value)} className={inputClass} required>
                         <option value="">Selecione sua Especialidade</option>
                         {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                     </select>
                 )}

                 <input type="password" value={regPass} onChange={e=>setRegPass(e.target.value)} className={inputClass} placeholder="Senha" required />
                 {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}
                 <Button type="submit" fullWidth size="lg" className="rounded-2xl shadow-lg shadow-orange-200">{loading ? 'Criando...' : 'Finalizar Cadastro'}</Button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'partners'>('dashboard');

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && isMounted) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          if (profile) {
              const role = profile.allowed_roles.includes('admin') ? 'admin' : profile.allowed_roles.includes('partner') ? 'partner' : profile.allowed_roles[0];
              setCurrentUser({
                  id: profile.id, email: profile.email, name: profile.full_name, role: role as UserRole,
                  points: profile.points, avatar: profile.avatar_url, completedJobs: profile.completed_jobs,
                  rating: profile.rating, phone: profile.phone, cpf: profile.cpf
              });
          }
      }
      if(isMounted) setTimeout(() => setIsLoading(false), 3000);
    };
    init();
    return () => { isMounted = false; };
  }, []);

  if (isLoading) return (
      <div className="min-h-screen bg-brand-orange flex flex-col items-center justify-center p-6 overflow-hidden">
        <Mascot className="w-64 h-64 animate-bounce-slow drop-shadow-2xl" />
        <div className="mt-8 text-white font-black text-xl tracking-tighter animate-pulse">CARREGANDO...</div>
      </div>
  );

  if (!currentUser) return <LoginPage onLogin={setCurrentUser} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-orange-100 overflow-x-hidden w-full">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-[80] px-4 py-3 w-full">
        <div className="max-w-7xl mx-auto flex justify-between items-center w-full">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentPage('dashboard')}>
            <img src="https://i.ibb.co/Zpwrnpr9/ROSTO-MASCOTE-TRANSPARENTE.png" className="w-9 h-9" />
            <div className="flex flex-col -space-y-1">
                <span className="font-black text-brand-orange text-sm tracking-tighter">MÃO DE OBRA</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{currentUser.role}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-3">
            {currentUser.role !== 'partner' && (
                <button onClick={() => setCurrentPage('partners')} className={`p-2.5 rounded-2xl transition-all ${currentPage === 'partners' ? 'bg-orange-100 text-brand-orange' : 'text-slate-400 hover:bg-slate-50'}`}><Store size={22} /></button>
            )}
            <button onClick={() => setShowHelp(true)} className="p-2.5 text-slate-400 hover:bg-slate-50 rounded-2xl"><CircleHelp size={22} /></button>
            <NotificationBell userId={currentUser.id} />

            {currentUser.role !== 'admin' && currentUser.role !== 'partner' && (
                <div className="bg-orange-50 px-3 py-1.5 rounded-2xl flex items-center gap-1.5 border border-orange-100">
                    <span className="text-brand-orange font-black text-xs">{currentUser.points}</span>
                    <span className="text-orange-300 text-[10px] font-black">★</span>
                </div>
            )}
            
            <div className="relative ml-1">
                <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="w-10 h-10 rounded-2xl bg-slate-100 overflow-hidden border-2 border-white ring-2 ring-slate-100">
                    <img src={currentUser.avatar} className="w-full h-full object-cover"/>
                </button>
                {showProfileMenu && (
                    <div className="absolute right-0 mt-3 w-56 bg-white rounded-3xl shadow-2xl border border-slate-100 py-2 z-[90] animate-fade-in origin-top-right">
                        <div className="px-5 py-3 border-b border-slate-50">
                            <p className="font-black text-slate-800 text-sm truncate">{currentUser.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold truncate">{currentUser.email}</p>
                        </div>
                        <button 
                            onClick={async () => {
                                await supabase.auth.signOut();
                                setCurrentUser(null);
                                setShowProfileMenu(false);
                            }} 
                            className="w-full text-left px-5 py-3 text-sm text-red-500 font-bold hover:bg-red-50 flex items-center gap-2"
                        >
                            <LogOut size={16} /> Sair do App
                        </button>
                    </div>
                )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 overflow-x-hidden">
        {currentUser.role === 'partner' ? <PartnerDashboard user={currentUser} /> :
         currentPage === 'partners' ? <PartnersPage /> : (
            <>
                {currentUser.role === 'admin' && <AdminDashboard />}
                {currentUser.role === 'client' && <ClientDashboard user={currentUser} />}
                {currentUser.role === 'worker' && <WorkerDashboard user={currentUser} />}
            </>
         )}
      </main>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}