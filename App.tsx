import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { User, UserRole, ServiceCategory } from './types';
import { Mascot } from './components/Mascot';
import { Button } from './components/Button';
import { AuthProvider, useAuth, type AuthValue } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { 
    LogOut, Settings, User as UserIcon, Save, HelpCircle, X, Phone, Mail, 
    Store, Edit, Check, AlertTriangle, Menu, Home, Coins, ArrowRight, History, Camera, Upload,
    MapPin, Bell, Navigation, MessageCircle, Calendar
} from 'lucide-react';
import { AdminDashboard } from './pages/AdminDashboard';
import { ClientDashboard } from './pages/ClientDashboard';
import { WorkerDashboard } from './pages/WorkerDashboard';
import { PartnersPage } from './pages/PartnersPage';
import { PartnerDashboard } from './pages/PartnerDashboard';
import { supabase } from './services/supabase';
import { NotificationBell } from './components/NotificationBell';
import { AppBottomNav } from './components/AppBottomNav';
import { SupportChat } from './components/SupportChat';
import { Footer } from './components/Footer';
import { IMAGES } from './logos';
import { DEFAULT_AVATAR } from './constants/defaultAvatar';

const roleToPath = (role: UserRole) =>
  role === 'admin' ? '/admin' : role === 'partner' ? '/partner' : role === 'worker' ? '/worker' : '/client';

// --- UTILS ---
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

const reverseGeocode = async (lat: number, lng: number) => {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
            headers: { 'User-Agent': 'AppMaoNaRoda/1.0' }
        });
        const data = await res.json();
        return {
            city: data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || 'Desconhecido',
            state: data.address?.state || ''
        };
    } catch (e) {
        console.error("Erro geocoding", e);
        return null;
    }
};

const inputClass = "w-full px-4 py-3 bg-slate-50 border-0 rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-brand-orange outline-none transition-all shadow-sm";

// --- MODALS ---

const WorkerSpecialtyModal: React.FC<{ user: User, onUpdate: () => void }> = ({ user, onUpdate }) => {
    const [specialties, setSpecialties] = useState<string[]>([]);
    const [categories, setCategories] = useState<ServiceCategory[]>([]);
    const [suggestion, setSuggestion] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        supabase.from('service_categories').select('*').order('name').then(({ data }) => {
            if (data) {
                // Ensure Outros is at the end or present
                if(!data.find(c => c.name === 'Outros')) data.push({id:'outros', name:'Outros', icon:'HelpCircle'});
                setCategories(data);
            }
        });
    }, []);

    const toggleSpecialty = (catName: string) => {
        setSpecialties(prev => {
            if(prev.includes(catName)) return prev.filter(c => c !== catName);
            if(prev.length >= 3) return prev; // Max 3
            return [...prev, catName];
        });
    };

    const handleSave = async () => {
        if(specialties.length === 0) return alert("Selecione pelo menos uma especialidade.");
        
        setLoading(true);
        let finalSpecialties = [...specialties];
        
        // Handle "Outros" logic
        if (specialties.includes('Outros')) {
            if (suggestion.trim()) {
                // Send to admin dashboard
                await supabase.from('category_suggestions').insert({
                    user_id: user.id,
                    suggestion: suggestion.trim()
                });
                
                finalSpecialties = finalSpecialties.filter(s => s !== 'Outros');
                finalSpecialties.push(suggestion.trim());
            } else {
                alert("Por favor, especifique qual é a sua categoria em 'Outros'.");
                setLoading(false);
                return;
            }
        }

        const { error } = await supabase.from('profiles').update({ 
            specialty: finalSpecialties.join(', ') 
        }).eq('id', user.id);

        if (!error) {
            onUpdate();
        } else {
            alert("Erro ao salvar: " + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[160] flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative text-center max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-black text-brand-blue mb-2">Bem-vindo, Profissional!</h2>
                <p className="text-slate-500 mb-4 text-sm">
                    Para começar, diga-nos o que você faz.
                </p>
                <div className="bg-yellow-50 text-yellow-800 p-3 rounded-xl text-xs font-bold mb-6 border border-yellow-200">
                    Você pode escolher até 3 opções, mas recomendamos apenas uma para que você seja melhor avaliado.
                </div>

                <div className="grid grid-cols-2 gap-2 mb-6">
                    {categories.map(cat => (
                        <button 
                            key={cat.id}
                            onClick={() => toggleSpecialty(cat.name)}
                            className={`p-3 rounded-xl text-xs font-bold border transition-all ${
                                specialties.includes(cat.name) 
                                ? 'bg-brand-blue text-white border-brand-blue shadow-lg scale-105' 
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {specialties.includes('Outros') && (
                    <div className="mb-6 text-left animate-fade-in">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Qual sua categoria?</label>
                        <input 
                            className={inputClass} 
                            placeholder="Ex: Designer de Interiores" 
                            value={suggestion}
                            onChange={e => setSuggestion(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Isso será enviado para análise da nossa equipe.</p>
                    </div>
                )}

                <Button fullWidth onClick={handleSave} disabled={loading} size="lg">Concluir Cadastro</Button>
            </div>
        </div>
    );
};

const LocationPermissionModal: React.FC<{ onAllow: () => void }> = ({ onAllow }) => (
    <div className="fixed inset-0 bg-brand-orange/90 z-[150] flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl relative text-center">
            <div className="w-20 h-20 bg-blue-100 text-brand-blue rounded-full flex items-center justify-center mx-auto mb-6">
                <MapPin size={40} className="animate-bounce" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Onde você está?</h2>
            <p className="text-slate-500 mb-6 leading-relaxed">
                Para conectar você aos melhores profissionais e serviços da sua região, precisamos saber sua localização.
            </p>
            <Button fullWidth onClick={onAllow} size="lg" className="rounded-2xl shadow-xl shadow-blue-200 bg-brand-blue hover:bg-blue-700">
                Permitir Localização
            </Button>
        </div>
    </div>
);

const NotificationPermissionModal: React.FC<{ onAllow: () => void, onSkip: () => void }> = ({ onAllow, onSkip }) => (
    <div className="fixed inset-0 bg-black/60 z-[160] flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl relative text-center">
            <button onClick={onSkip} className="absolute top-4 right-4 text-slate-400"><X size={20}/></button>
            <div className="w-20 h-20 bg-orange-100 text-brand-orange rounded-full flex items-center justify-center mx-auto mb-6">
                <Bell size={40} className="animate-pulse-fast" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Não perca nada!</h2>
            <p className="text-slate-500 mb-6 leading-relaxed">
                Ative as notificações para saber quando um profissional aceitar seu pedido ou quando surgir um serviço perto de você.
            </p>
            <Button fullWidth onClick={onAllow} size="lg" className="rounded-2xl shadow-xl shadow-orange-200 mb-3">
                Ativar Notificações
            </Button>
            <button onClick={onSkip} className="text-sm text-slate-400 font-bold hover:text-slate-600">Agora não</button>
        </div>
    </div>
);

const CityChangeModal: React.FC<{ currentCity: string, newCity: string, onUpdate: () => void, onCancel: () => void }> = ({ currentCity, newCity, onUpdate, onCancel }) => (
    <div className="fixed inset-0 bg-black/60 z-[155] flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl relative text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Navigation size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2">Mudou de cidade?</h2>
            <p className="text-slate-500 mb-6 text-sm">
                Percebemos que você está em <b>{newCity}</b>, mas seu perfil está configurado para <b>{currentCity}</b>. Deseja atualizar para ver serviços locais?
            </p>
            <div className="flex gap-2">
                <Button variant="outline" fullWidth onClick={onCancel}>Manter {currentCity}</Button>
                <Button fullWidth onClick={onUpdate}>Mudar para {newCity}</Button>
            </div>
        </div>
    </div>
);

// --- HELPER MODALS ---

const HelpModal: React.FC<{ onClose: () => void; onOpenSupportChat?: () => void }> = ({ onClose, onOpenSupportChat }) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-6 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button>
            <Mascot className="w-32 h-32 mx-auto mb-4 drop-shadow-xl" variant="full" />
            <h3 className="font-black text-2xl text-slate-800 mb-2">Precisa de Ajuda?</h3>
            <p className="text-slate-500 mb-6 leading-relaxed">Nossa equipe de suporte está pronta para te atender!</p>
            
            <div className="space-y-3">
                {onOpenSupportChat && (
                    <button type="button" onClick={() => { onClose(); onOpenSupportChat(); }} className="flex items-center justify-center gap-3 w-full bg-brand-orange hover:bg-orange-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-orange-200">
                        <MessageCircle size={24} /> Falar com o suporte (chat)
                    </button>
                )}
                <p className="text-xs text-slate-500">Ou entre em contato pelo e-mail:</p>
                <a href="mailto:suporte@appmaodeobra.com" className="flex items-center justify-center gap-3 w-full border-2 border-slate-200 hover:border-brand-orange text-slate-700 font-bold py-4 rounded-2xl transition-all">
                    <Mail size={24} /> suporte@appmaodeobra.com
                </a>
            </div>
        </div>
    </div>
);

const PointsModal: React.FC<{ user: User, onClose: () => void }> = ({ user, onClose }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            // Fetch Jobs (Earnings)
            const { data: jobs } = await supabase
                .from('jobs')
                .select('title, points_awarded, created_at')
                .eq('worker_id', user.id)
                .eq('status', 'waiting_verification') // Or completed
                .gt('points_awarded', 0);

            // Fetch Redemptions (Spendings)
            const { data: redemptions } = await supabase
                .from('coupon_redemptions')
                .select('cost_paid, redeemed_at, coupon:coupon_id(title)')
                .eq('user_id', user.id);

            const earnings = (jobs || []).map((j: any) => ({
                id: `job-${j.created_at}`,
                type: 'earn',
                title: `Serviço: ${j.title}`,
                amount: j.points_awarded,
                date: j.created_at
            }));

            const spendings = (redemptions || []).map((r: any) => ({
                id: `redemption-${r.redeemed_at}`,
                type: 'spend',
                title: `Resgate: ${r.coupon?.title}`,
                amount: -r.cost_paid,
                date: r.redeemed_at
            }));

            // Merge and Sort
            const all = [...earnings, ...spendings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setHistory(all);
            setLoading(false);
        };
        fetchHistory();
    }, [user.id]);

    return (
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-fade-in backdrop-blur-sm">
             <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] shadow-2xl relative">
                 <div className="bg-yellow-400 p-6 text-center relative shrink-0">
                     <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white"><X size={24}/></button>
                     <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 backdrop-blur-sm">
                        <Coins size={32} className="text-white"/>
                     </div>
                     <h2 className="text-4xl font-black text-white">{user.points}</h2>
                     <p className="text-white/80 font-bold uppercase text-xs tracking-widest">Seus Pontos</p>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                     <h3 className="font-bold text-slate-500 text-sm mb-4 uppercase tracking-wider flex items-center gap-2">
                         <History size={16}/> Histórico de Transações
                     </h3>
                     {loading ? (
                         <div className="text-center py-10 text-slate-400">Carregando...</div>
                     ) : history.length === 0 ? (
                         <div className="text-center py-10 text-slate-400">Nenhuma movimentação ainda.</div>
                     ) : (
                         <div className="space-y-3">
                             {history.map(item => (
                                 <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
                                     <div>
                                         <p className="font-bold text-slate-800 text-sm">{item.title}</p>
                                         <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                             <Calendar size={10}/> {new Date(item.date).toLocaleDateString()}
                                         </p>
                                     </div>
                                     <span className={`font-black text-sm ${item.type === 'earn' ? 'text-green-500' : 'text-red-500'}`}>
                                         {item.type === 'earn' ? '+' : ''}{item.amount}
                                     </span>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
             </div>
         </div>
    );
};

const CompleteProfileModal: React.FC<{ user: User, onUpdate: () => void }> = ({ user, onUpdate }) => {
    const [phone, setPhone] = useState(user.phone || '');
    const [cpf, setCpf] = useState(user.cpf || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (phone.length < 14) return setError("Digite um celular válido com DDD.");
        if (cpf.length < 14) return setError("Digite um CPF válido.");
        setError('');
        setLoading(true);

        try {
            const { data: existingCpf } = await supabase.from('profiles').select('id').eq('cpf', cpf).neq('id', user.id).maybeSingle();
            if (existingCpf) throw new Error("Este CPF já está cadastrado em outra conta.");

            const { error: updateError } = await supabase.from('profiles').update({ phone, cpf }).eq('id', user.id);
            if (updateError) throw updateError;
            onUpdate();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-brand-orange/90 z-[150] flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl relative text-center">
                <div className="w-16 h-16 bg-orange-100 text-brand-orange rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                    <AlertTriangle size={32} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">Falta pouco!</h2>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    Para garantir a segurança, complete seu cadastro.
                </p>
                <div className="space-y-4 text-left">
                    <input className={inputClass} value={phone} onChange={e => setPhone(maskPhone(e.target.value))} placeholder="Celular (WhatsApp)" />
                    <input className={inputClass} value={cpf} onChange={e => setCpf(maskCpf(e.target.value))} placeholder="CPF" />
                    {error && <div className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-xl text-center">{error}</div>}
                    <Button fullWidth onClick={handleSave} disabled={loading} size="lg" className="rounded-2xl">Concluir Cadastro</Button>
                </div>
            </div>
        </div>
    );
};

const EditProfileModal: React.FC<{ user: User, onClose: () => void, onUpdate: () => void }> = ({ user, onClose, onUpdate }) => {
    const [name, setName] = useState(user.name);
    const [phone, setPhone] = useState(user.phone || '');
    const [bio, setBio] = useState(user.bio || '');
    const [specialties, setSpecialties] = useState<string[]>(user.specialty ? user.specialty.split(',').map(s=>s.trim()) : []);
    
    // Location Fields
    const [city, setCity] = useState(user.city || '');
    const [state, setState] = useState(user.state || '');
    const [locLoading, setLocLoading] = useState(false);

    const [allCategories, setAllCategories] = useState<ServiceCategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    useEffect(() => {
        if(user.role === 'worker') {
            supabase.from('service_categories').select('*').order('name').then(({data}) => {
                if(data) setAllCategories(data);
            });
        }
    }, [user.role]);

    const toggleSpecialty = (catName: string) => {
        setSpecialties(prev => {
            if(prev.includes(catName)) return prev.filter(c => c !== catName);
            if(prev.length >= 3) return prev;
            return [...prev, catName];
        });
    };

    const handleUpdateLocation = () => {
        setLocLoading(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                const addr = await reverseGeocode(latitude, longitude);
                if (addr) {
                    setCity(addr.city);
                    setState(addr.state);
                }
                setLocLoading(false);
            }, (error) => {
                alert("Erro ao obter localização: " + error.message);
                setLocLoading(false);
            });
        } else {
            alert("Geolocalização não suportada.");
            setLocLoading(false);
        }
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
          setUploadingAvatar(true);
          if (!event.target.files || event.target.files.length === 0) throw new Error('Selecione uma imagem.');
          const file = event.target.files[0];
          const fileName = `${user.id}_${Date.now()}.${file.name.split('.').pop()}`;
          let { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
          if (data) {
             const { error: updateError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id);
             if(updateError) throw updateError;
             onUpdate();
          }
        } catch (error: any) {
          alert('Erro: ' + error.message);
        } finally {
          setUploadingAvatar(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        const updates: any = { full_name: name, phone: phone, bio: bio, city: city, state: state };
        if(user.role === 'worker') updates.specialty = specialties.join(', ');

        const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
        if(!error) {
            onUpdate();
            onClose();
        } else {
            alert("Erro: " + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-xl text-slate-800">Editar Perfil</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X size={24}/></button>
                </div>

                <div className="flex flex-col items-center mb-6">
                    <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 mb-2 group">
                         <img src={user.avatar || DEFAULT_AVATAR} className="w-full h-full object-cover" />
                         {uploadingAvatar && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs">...</div>}
                         {!uploadingAvatar && (
                             <label className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                <Upload className="text-white" size={24} />
                                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar}/>
                             </label>
                         )}
                    </div>
                    <p className="text-xs text-slate-400 font-bold">Toque na foto para alterar</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Nome Completo</label>
                        <input className={inputClass} value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    
                    {/* Location Section */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                             <label className="text-xs font-bold text-slate-400 uppercase">Localização</label>
                             <button onClick={handleUpdateLocation} className="text-xs font-bold text-brand-blue flex items-center gap-1">
                                {locLoading ? 'Buscando...' : <><Navigation size={12}/> Atualizar GPS</>}
                             </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <input className="bg-white p-2 rounded-lg border text-sm" value={city} onChange={e => setCity(e.target.value)} placeholder="Cidade" />
                            <input className="bg-white p-2 rounded-lg border text-sm" value={state} onChange={e => setState(e.target.value)} placeholder="Estado" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Celular</label>
                        <input className={inputClass} value={phone} onChange={e => setPhone(maskPhone(e.target.value))} />
                    </div>
                    
                    {user.role === 'worker' && (
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Especialidades (Máx. 3)</label>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                                {allCategories.map(cat => (
                                    <button 
                                        key={cat.id}
                                        onClick={() => toggleSpecialty(cat.name)}
                                        className={`p-2 rounded-lg text-xs font-bold text-left flex items-center justify-between border transition-all ${
                                            specialties.includes(cat.name) 
                                            ? 'bg-brand-blue text-white border-brand-blue' 
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                        disabled={!specialties.includes(cat.name) && specialties.length >= 3}
                                    >
                                        {cat.name}
                                        {specialties.includes(cat.name) && <Check size={14}/>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Bio / Sobre Você</label>
                        <textarea className={inputClass} value={bio} onChange={e => setBio(e.target.value)} rows={3} />
                    </div>

                    <Button fullWidth onClick={handleSave} disabled={loading} size="lg">Salvar Alterações</Button>
                </div>
            </div>
        </div>
    );
};

// --- LOGIN PAGE ---
const LOGIN_AS_KEY = 'loginAs';
const GOOGLE_ROLE_KEY = 'googleRolePending';

const GoogleRoleModal: React.FC<{ onSelect: (role: 'client' | 'worker') => void }> = ({ onSelect }) => {
    const [selectedRole, setSelectedRole] = useState<'client' | 'worker'>('client');

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserIcon size={32} className="text-brand-blue" />
                    </div>
                    <h3 className="font-black text-xl text-slate-800 mb-2">Escolha o tipo de conta</h3>
                    <p className="text-sm text-slate-600">Como você quer usar o app?</p>
                </div>
                <div className="space-y-3 mb-6">
                    <button
                        onClick={() => setSelectedRole('client')}
                        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                            selectedRole === 'client'
                                ? 'border-brand-orange bg-orange-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                selectedRole === 'client' ? 'border-brand-orange bg-brand-orange' : 'border-slate-300'
                            }`}>
                                {selectedRole === 'client' && <Check size={12} className="text-white" />}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">Cliente</p>
                                <p className="text-xs text-slate-500">Contratar profissionais para serviços</p>
                            </div>
                        </div>
                    </button>
                    <button
                        onClick={() => setSelectedRole('worker')}
                        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                            selectedRole === 'worker'
                                ? 'border-brand-blue bg-blue-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                selectedRole === 'worker' ? 'border-brand-blue bg-brand-blue' : 'border-slate-300'
                            }`}>
                                {selectedRole === 'worker' && <Check size={12} className="text-white" />}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">Profissional</p>
                                <p className="text-xs text-slate-500">Oferecer serviços e ganhar pontos</p>
                            </div>
                        </div>
                    </button>
                </div>
                <Button fullWidth onClick={() => onSelect(selectedRole)} size="lg" className="rounded-xl">
                    Continuar
                </Button>
            </div>
        </div>
    );
};

const LoginPage: React.FC<{ onLogin: (user: User) => void; onGuest?: () => void }> = ({ onLogin, onGuest }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [activeTab, setActiveTab] = useState<'client' | 'worker'>('client');
    const [loginAs, setLoginAs] = useState<'client' | 'worker'>('client');
    const [regName, setRegName] = useState('');
    const [showGoogleRoleModal, setShowGoogleRoleModal] = useState(false);

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            sessionStorage.setItem(LOGIN_AS_KEY, loginAs);
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: regName, role: activeTab, avatar_url: DEFAULT_AVATAR } }
            });
            if (!error) {
                alert("Cadastro realizado! Faça login.");
                setIsRegistering(false);
            } else {
                alert(error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            sessionStorage.setItem(GOOGLE_ROLE_KEY, 'pending');
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    }
                }
            });
            if (error) {
                alert(error.message);
                sessionStorage.removeItem(GOOGLE_ROLE_KEY);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleRoleSelect = async (role: 'client' | 'worker') => {
        setShowGoogleRoleModal(false);
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
                if (profile) {
                    const currentRoles = profile.allowed_roles || [];
                    if (!currentRoles.includes(role)) {
                        const newRoles = [...new Set([...currentRoles, role])];
                        await supabase.from('profiles').update({ allowed_roles: newRoles }).eq('id', user.id);
                    }
                    sessionStorage.setItem(LOGIN_AS_KEY, role);
                    sessionStorage.removeItem(GOOGLE_ROLE_KEY);
                    window.location.reload();
                } else {
                    await supabase.from('profiles').insert({
                        id: user.id,
                        email: user.email,
                        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
                        allowed_roles: [role],
                        avatar_url: user.user_metadata?.avatar_url || DEFAULT_AVATAR,
                        points: 50
                    });
                    sessionStorage.setItem(LOGIN_AS_KEY, role);
                    sessionStorage.removeItem(GOOGLE_ROLE_KEY);
                    window.location.reload();
                }
            }
        } catch (err: any) {
            alert('Erro ao configurar conta: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const checkGoogleLogin = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user && sessionStorage.getItem(GOOGLE_ROLE_KEY) === 'pending') {
                const { data: profile } = await supabase.from('profiles').select('allowed_roles').eq('id', session.user.id).maybeSingle();
                if (profile && profile.allowed_roles && profile.allowed_roles.length > 0) {
                    sessionStorage.removeItem(GOOGLE_ROLE_KEY);
                    sessionStorage.setItem(LOGIN_AS_KEY, profile.allowed_roles[0]);
                    window.location.reload();
                } else {
                    setShowGoogleRoleModal(true);
                }
            }
        };
        checkGoogleLogin();
    }, []);

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-4">
        <div className="flex-1 flex flex-col justify-center items-center">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in p-8">
            <div className="text-center mb-6">
                <img src={IMAGES.LOGO_TRANSPARENT} className="w-32 mx-auto" alt="Logo" />
                <h2 className="text-xl font-bold mt-2">{isRegistering ? 'Criar Conta' : 'Bem-vindo'}</h2>
            </div>
            {!isRegistering ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Entrar como</label>
                        <div className="flex bg-slate-100 rounded-xl p-1">
                            <button
                                type="button"
                                onClick={() => setLoginAs('client')}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${loginAs === 'client' ? 'bg-white shadow text-brand-orange' : 'text-slate-500'}`}
                            >
                                Cliente
                            </button>
                            <button
                                type="button"
                                onClick={() => setLoginAs('worker')}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${loginAs === 'worker' ? 'bg-white shadow text-brand-blue' : 'text-slate-500'}`}
                            >
                                Profissional
                            </button>
                        </div>
                    </div>
                    <input value={email} onChange={e=>setEmail(e.target.value)} className={inputClass} placeholder="Email" type="email" required />
                    <input value={password} onChange={e=>setPassword(e.target.value)} className={inputClass} placeholder="Senha" type="password" required />
                    <Button fullWidth disabled={loading}>Entrar</Button>
                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-slate-500 font-bold">ou</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Entrar com Google
                    </button>
                    <button type="button" onClick={()=>setIsRegistering(true)} className="w-full text-center text-sm text-slate-500">Criar conta</button>
                    {onGuest && (
                        <button type="button" onClick={onGuest} className="w-full text-center text-sm text-brand-orange font-bold pt-2 border-t border-slate-100 mt-2">
                            Continuar como visitante
                        </button>
                    )}
                </form>
            ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Cadastrar como</label>
                        <div className="flex bg-slate-100 rounded-xl p-1">
                            <button type="button" onClick={()=>setActiveTab('client')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${activeTab==='client'?'bg-white shadow text-brand-orange':'text-slate-500'}`}>Cliente</button>
                            <button type="button" onClick={()=>setActiveTab('worker')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${activeTab==='worker'?'bg-white shadow text-brand-blue':'text-slate-500'}`}>Profissional</button>
                        </div>
                    </div>
                    <input value={regName} onChange={e=>setRegName(e.target.value)} className={inputClass} placeholder="Nome" required />
                    <input value={email} onChange={e=>setEmail(e.target.value)} className={inputClass} placeholder="Email" type="email" required />
                    <input value={password} onChange={e=>setPassword(e.target.value)} className={inputClass} placeholder="Senha" type="password" required />
                    <Button fullWidth disabled={loading}>Cadastrar</Button>
                    <button type="button" onClick={()=>setIsRegistering(false)} className="w-full text-center text-sm text-slate-500">Voltar</button>
                </form>
            )}
        </div>
        {showGoogleRoleModal && <GoogleRoleModal onSelect={handleGoogleRoleSelect} />}
        </div>
        <Footer />
      </div>
    );
};

function Landing() {
  const auth = useAuth();
  const navigate = useNavigate();
  if (!auth.user && !auth.isGuestMode)
    return (
      <LoginPage
        onLogin={(u) => { auth.setUser(u); navigate(roleToPath(u.role)); }}
        onGuest={() => { auth.setIsGuestMode(true); navigate('/client'); }}
      />
    );
  return <Navigate to={roleToPath(auth.effectiveUser.role)} replace />;
}

function AuthLoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  return (
    <LoginPage
      onLogin={(u) => { auth.setUser(u); navigate(roleToPath(u.role)); }}
      onGuest={() => { auth.setIsGuestMode(true); navigate('/client'); }}
    />
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin': return { label: 'Admin', bg: 'bg-red-100 text-red-600' };
      case 'partner': return { label: 'Parceiro', bg: 'bg-purple-100 text-purple-600' };
      case 'worker': return { label: 'Profissional', bg: 'bg-blue-100 text-blue-600' };
      default: return { label: 'Cliente', bg: 'bg-orange-100 text-brand-orange' };
    }
  };
  const roleInfo = getRoleBadge(auth.effectiveUser.role);
  const allowedRoles = auth.effectiveUser.allowed_roles || [];
  const hasClient = allowedRoles.includes('client');
  const hasWorker = allowedRoles.includes('worker');
  const canSwitchRole = !auth.isGuest && hasClient && hasWorker && auth.effectiveUser.role !== 'admin' && auth.effectiveUser.role !== 'partner';
  const canAddWorker = hasClient && !hasWorker;
  const canAddClient = hasWorker && !hasClient;
  const isDashboardPath = pathname.startsWith('/client') || pathname.startsWith('/worker') || pathname.startsWith('/admin') || pathname.startsWith('/partner');
  const isPartnersPath = pathname === '/partners';
  const showBottomNav = ['client', 'worker', 'partner'].includes(auth.effectiveUser.role);

  const DrawerMenu = () => (
    <div className="fixed inset-0 z-[100] flex">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => auth.setIsDrawerOpen(false)} />
      <div className="relative bg-white w-72 h-full shadow-2xl animate-fade-in flex flex-col">
        <div className="p-6 border-b border-slate-100 bg-orange-50/50">
          <div className="flex items-center gap-3 mb-2">
            <img src={auth.effectiveUser.avatar} className="w-14 h-14 rounded-full border-2 border-white shadow-md bg-white object-cover" alt="" />
            <div className="min-w-0">
              <p className="font-bold text-slate-800 text-lg truncate">{auth.effectiveUser.name}</p>
              <p className="text-xs text-slate-500 truncate">{auth.effectiveUser.city || 'Local não definido'}</p>
            </div>
          </div>
          <button onClick={() => { auth.setShowEditProfile(true); auth.setIsDrawerOpen(false); }} className="text-xs font-bold text-brand-orange hover:text-orange-700 flex items-center gap-1">
            <Edit size={12} /> Editar Perfil
          </button>
        </div>
        <div className="flex-1 p-4 space-y-2 overflow-y-auto">
          {canSwitchRole && (
            <div className="bg-slate-50 rounded-xl p-3 mb-2 border border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Usar conta como</p>
              <div className="flex gap-2">
                {auth.effectiveUser.role === 'worker' && <button onClick={() => auth.handleSwitchRole('client')} className="flex-1 py-2 rounded-lg text-xs font-bold bg-brand-orange text-white">Cliente</button>}
                {auth.effectiveUser.role === 'client' && <button onClick={() => auth.handleSwitchRole('worker')} className="flex-1 py-2 rounded-lg text-xs font-bold bg-brand-blue text-white">Profissional</button>}
              </div>
            </div>
          )}
          {(canAddWorker || canAddClient) && (
            <div className="bg-blue-50 rounded-xl p-3 mb-2 border border-blue-100">
              <p className="text-xs font-bold text-slate-600 mb-2">Adicionar outro perfil</p>
              {canAddWorker && <button onClick={() => auth.handleAddRole('worker')} className="w-full py-2 rounded-lg text-xs font-bold bg-brand-blue text-white">Também quero atuar como Profissional</button>}
              {canAddClient && <button onClick={() => auth.handleAddRole('client')} className="w-full py-2 rounded-lg text-xs font-bold bg-brand-orange text-white">Também quero atuar como Cliente</button>}
            </div>
          )}
          <button onClick={() => { auth.setIsDrawerOpen(false); navigate(roleToPath(auth.effectiveUser.role)); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${isDashboardPath ? 'bg-orange-50 text-brand-orange' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Home size={20} /> Início
          </button>
          {auth.effectiveUser.role !== 'partner' && (
            <button onClick={() => { auth.setIsDrawerOpen(false); navigate('/partners'); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${isPartnersPath ? 'bg-orange-50 text-brand-orange' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Store size={20} /> Lojas Parceiras
            </button>
          )}
          <button onClick={() => { auth.setShowHelp(true); auth.setIsDrawerOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors text-slate-600 hover:bg-slate-50">
            <HelpCircle size={20} /> Ajuda
          </button>
        </div>
        <div className="p-4 border-t border-slate-100">
          <button onClick={async () => { await supabase.auth.signOut(); auth.setUser(null); auth.setIsDrawerOpen(false); navigate('/'); }} className="w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors text-red-500 hover:bg-red-50">
            <LogOut size={20} /> Sair do App
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-orange-100 overflow-x-hidden w-full">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-[80] px-4 py-3 w-full shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center w-full">
          <div className="flex items-center gap-3">
            {auth.isGuest ? (
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600 text-sm">Visitante</span>
                <button onClick={() => { auth.setIsGuestMode(false); auth.setUser(null); navigate('/'); }} className="text-xs font-bold text-brand-orange bg-orange-50 px-3 py-1.5 rounded-full">Fazer login</button>
              </div>
            ) : (
              <button onClick={() => auth.setIsDrawerOpen(true)} className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border-2 border-slate-200 group-hover:border-brand-orange transition-colors">
                  <img src={auth.effectiveUser.avatar} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-black text-slate-800 text-sm leading-tight truncate max-w-[120px] sm:max-w-none">{auth.effectiveUser.name.split(' ')[0]}</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full w-fit ${roleInfo.bg}`}>{roleInfo.label}</span>
                  </div>
                </div>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {!auth.isGuest && <NotificationBell userId={auth.effectiveUser.id} />}
            {!auth.isGuest && auth.effectiveUser.role !== 'admin' && auth.effectiveUser.role !== 'partner' && (
              <button onClick={() => auth.setShowPointsModal(true)} className="bg-yellow-50 hover:bg-yellow-100 px-2 sm:px-3 py-1.5 rounded-2xl flex items-center gap-1.5 border border-yellow-200 transition-colors">
                <Coins size={16} className="text-yellow-500 fill-yellow-500" />
                <span className="text-slate-700 font-black text-xs">{auth.effectiveUser.points}</span>
              </button>
            )}
            {!auth.isGuest && (
              <button onClick={() => auth.setShowHelp(true)} className="active:scale-95 transition-transform hover:opacity-80 relative" title="Ajuda">
                <Mascot className="w-10 h-10 object-contain rounded-full border-2 border-white shadow-sm" variant="face" />
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-brand-orange text-white flex items-center justify-center text-xs font-black shadow">?</span>
              </button>
            )}
          </div>
        </div>
      </header>
      {!auth.isGuest && auth.isDrawerOpen && <DrawerMenu />}
      <main className={`flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 overflow-x-hidden ${showBottomNav ? 'pb-24' : ''}`}>
        {children}
      </main>
      {showBottomNav && (
        <AppBottomNav role={auth.effectiveUser.role} isGuest={auth.isGuest} />
      )}
    </div>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSupportChat, setShowSupportChat] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const GUEST_USER: User = {
    id: '',
    email: '',
    name: 'Visitante',
    role: 'client',
    points: 0,
    allowed_roles: ['client'],
    avatar: DEFAULT_AVATAR,
    city: undefined,
    state: undefined,
    latitude: undefined,
    longitude: undefined,
  };
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [showWorkerSpecialty, setShowWorkerSpecialty] = useState(false);

  const [showLocModal, setShowLocModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showCityChangeModal, setShowCityChangeModal] = useState<{current: string, new: string, lat: number, lng: number} | null>(null);
  const [showGoogleRoleModal, setShowGoogleRoleModal] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<string | null>(null);

  const handleGoogleRoleSelect = async (role: 'client' | 'worker') => {
    if (!pendingGoogleUser) return;
    setShowGoogleRoleModal(false);
    setIsLoading(true);
    try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', pendingGoogleUser).maybeSingle();
        if (profile) {
            const currentRoles = profile.allowed_roles || [];
            if (!currentRoles.includes(role)) {
                const newRoles = [...new Set([...currentRoles, role])];
                await supabase.from('profiles').update({ allowed_roles: newRoles }).eq('id', pendingGoogleUser);
            }
            sessionStorage.setItem(LOGIN_AS_KEY, role);
            sessionStorage.removeItem(GOOGLE_ROLE_KEY);
            await fetchProfileAndSetUser(pendingGoogleUser);
        } else {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('profiles').insert({
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
                    allowed_roles: [role],
                    avatar_url: user.user_metadata?.avatar_url || DEFAULT_AVATAR,
                    points: 50
                });
                sessionStorage.setItem(LOGIN_AS_KEY, role);
                sessionStorage.removeItem(GOOGLE_ROLE_KEY);
                await fetchProfileAndSetUser(user.id);
            }
        }
    } catch (err: any) {
        alert('Erro ao configurar conta: ' + err.message);
    } finally {
        setIsLoading(false);
        setPendingGoogleUser(null);
    }
  };

  const fetchProfileAndSetUser = async (userId: string) => {
    const preferredRole = sessionStorage.getItem(LOGIN_AS_KEY) as 'client' | 'worker' | null;
    const googleRolePending = sessionStorage.getItem(GOOGLE_ROLE_KEY) === 'pending';
    
    if (preferredRole && !googleRolePending) sessionStorage.removeItem(LOGIN_AS_KEY);

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    
    if (googleRolePending && (!profile || !profile.allowed_roles || profile.allowed_roles.length === 0)) {
        setPendingGoogleUser(userId);
        setShowGoogleRoleModal(true);
        return;
    }

    if (profile) {
        const roles = profile.allowed_roles || [];
        let role: UserRole;
        if (roles.includes('admin')) role = 'admin';
        else if (roles.includes('partner')) role = 'partner';
        else if (preferredRole && roles.includes(preferredRole)) role = preferredRole;
        else role = (roles[0] || 'client') as UserRole;

        const userObj: User = {
            id: profile.id, email: profile.email, name: profile.full_name, role,
            points: profile.points, avatar: profile.avatar_url || DEFAULT_AVATAR, completedJobs: profile.completed_jobs,
            rating: profile.rating, phone: profile.phone, cpf: profile.cpf, specialty: profile.specialty, bio: profile.bio,
            city: profile.city, state: profile.state, latitude: profile.latitude, longitude: profile.longitude,
            suspicious_flag: profile.suspicious_flag, active: profile.active !== false, punishment_until: profile.punishment_until,
            allowed_roles: (roles as UserRole[]),
            level: profile.level || 'bronze',
            verified_count: profile.verified_count ?? 0
        };
        setCurrentUser(userObj);

        if (!profile.phone || !profile.cpf) {
            setShowCompleteProfile(true);
        } else if (role === 'worker' && !profile.specialty) {
            setShowCompleteProfile(false);
            setShowWorkerSpecialty(true);
        } else {
            setShowCompleteProfile(false);
            setShowWorkerSpecialty(false);
        }
    } else if (!googleRolePending) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setPendingGoogleUser(userId);
            setShowGoogleRoleModal(true);
        }
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const applySession = async (session: { user: { id: string } } | null) => {
      if (!session?.user || !isMounted) return;
      await fetchProfileAndSetUser(session.user.id);
      if (isMounted) setTimeout(() => checkPermissionsAndLocation(session.user.id), 1000);
    };

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await applySession(session);
      } else {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        if (refreshed?.user) await applySession(refreshed);
      }
      if (isMounted) setIsLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!isMounted) return;
          if (event === 'INITIAL_SESSION' && session?.user) {
            await applySession(session);
            setIsLoading(false);
          } else if (event === 'SIGNED_IN' && session?.user) {
            await fetchProfileAndSetUser(session.user.id);
            setTimeout(() => checkPermissionsAndLocation(session.user.id), 1000);
          } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setIsLoading(false);
            setShowCompleteProfile(false);
            setShowWorkerSpecialty(false);
          }
      });
      return () => { subscription.unsubscribe(); };
    };

    init();
    return () => { isMounted = false; };
  }, []);

  const effectiveUser = currentUser || GUEST_USER;
  const isGuest = !currentUser && isGuestMode;
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (currentUser && (location.pathname === '/' || location.pathname === '/auth'))
      navigate(roleToPath(currentUser.role), { replace: true });
  }, [currentUser, location.pathname, navigate]);

  const checkPermissionsAndLocation = async (userId: string) => {
      if ("geolocation" in navigator) {
          navigator.permissions.query({ name: 'geolocation' }).then(result => {
              if (result.state === 'prompt') setShowLocModal(true);
              else if (result.state === 'granted') verifyLocationConsistency(userId);
          });
      }
      if ("Notification" in window && Notification.permission === 'default') setShowNotifModal(true);
  };

  const verifyLocationConsistency = (userId: string) => {
      navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          const addr = await reverseGeocode(latitude, longitude);
          if (addr) {
              const { data: profile } = await supabase.from('profiles').select('city, state').eq('id', userId).single();
              if (profile) {
                  if (!profile.city) {
                      await supabase.from('profiles').update({ city: addr.city, state: addr.state, latitude, longitude }).eq('id', userId);
                      await fetchProfileAndSetUser(userId);
                  } 
                  else if (profile.city.toLowerCase() !== addr.city.toLowerCase()) {
                      setShowCityChangeModal({ current: profile.city, new: addr.city, lat: latitude, lng: longitude });
                  }
              }
          }
      }, (err) => console.log("Erro de localizacao background:", err));
  };

  const handleGrantLocation = () => {
      navigator.geolocation.getCurrentPosition((pos) => {
              setShowLocModal(false);
              if (currentUser) verifyLocationConsistency(currentUser.id);
          }, (err) => alert("Precisamos da permissão para continuar.")
      );
  };

  const handleGrantNotification = () => {
      Notification.requestPermission().then(permission => {
          setShowNotifModal(false);
          if (permission === 'granted') {
              new Notification("Notificações Ativadas!", { body: "Agora você receberá alertas de serviços.", icon: '/icon.png' });
          }
      });
  };

  const handleUpdateCity = async () => {
      if (showCityChangeModal && currentUser) {
          const { new: newCity, lat, lng } = showCityChangeModal;
          const addr = await reverseGeocode(lat, lng);
          await supabase.from('profiles').update({ city: newCity, state: addr?.state || '', latitude: lat, longitude: lng }).eq('id', currentUser.id);
          await fetchProfileAndSetUser(currentUser.id);
          setShowCityChangeModal(null);
      }
  };

  if (isLoading) return (
      <div className="min-h-screen bg-brand-orange flex flex-col items-center justify-center p-6 overflow-hidden">
        <Mascot className="w-64 h-64 animate-bounce-slow drop-shadow-2xl" variant="full" />
        <div className="mt-8 text-white font-black text-xl tracking-tighter animate-pulse">CARREGANDO...</div>
        <Footer />
      </div>
  );

  const handleSwitchRole = (newRole: 'client' | 'worker') => {
    setCurrentUser(prev => prev ? { ...prev, role: newRole } : null);
    setIsDrawerOpen(false);
    navigate(roleToPath(newRole));
  };

  const handleAddRole = async (newRole: 'client' | 'worker') => {
    if (!currentUser) return;
    const newRoles = [...new Set([...(currentUser.allowed_roles || []), newRole])];
    const { error } = await supabase.from('profiles').update({ allowed_roles: newRoles }).eq('id', currentUser.id);
    if (error) { alert(error.message); return; }
    setIsDrawerOpen(false);
    sessionStorage.setItem(LOGIN_AS_KEY, newRole);
    await fetchProfileAndSetUser(currentUser.id);
    if (newRole === 'worker') {
      const { data: p } = await supabase.from('profiles').select('specialty').eq('id', currentUser.id).single();
      if (p && !p.specialty) setShowWorkerSpecialty(true);
    }
  };

  const authValue: AuthValue = {
    user: currentUser,
    setUser: setCurrentUser,
    isLoading,
    isGuestMode,
    setIsGuestMode,
    effectiveUser,
    isGuest,
    fetchProfileAndSetUser,
    setShowEditProfile,
    setShowHelp,
    setShowPointsModal,
    setIsDrawerOpen,
    isDrawerOpen,
    setShowWorkerSpecialty,
    setShowCompleteProfile,
    handleSwitchRole,
    handleAddRole,
  };

  return (
    <AuthProvider value={authValue}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthLoginPage />} />
        <Route path="/partners" element={<ProtectedRoute allowedRoles={['client', 'worker', 'admin', 'partner']}><AppLayout><PartnersPage /></AppLayout></ProtectedRoute>} />
        <Route path="/client/*" element={<ProtectedRoute allowedRoles={['client']} allowGuest><AppLayout><ClientDashboard user={effectiveUser} isGuest={isGuest} /></AppLayout></ProtectedRoute>} />
        <Route path="/worker/*" element={<ProtectedRoute allowedRoles={['worker']}><AppLayout><WorkerDashboard user={effectiveUser} /></AppLayout></ProtectedRoute>} />
        <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminDashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/partner/*" element={<ProtectedRoute allowedRoles={['partner']}><AppLayout><PartnerDashboard user={effectiveUser} /></AppLayout></ProtectedRoute>} />
      </Routes>

      {(currentUser || isGuestMode) && (
        <>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} onOpenSupportChat={() => setShowSupportChat(true)} />}
      {showSupportChat && currentUser && !isGuestMode && <SupportChat user={currentUser} onClose={() => setShowSupportChat(false)} />}
      {showPointsModal && currentUser && <PointsModal user={currentUser} onClose={() => setShowPointsModal(false)} />}
      
      {showEditProfile && currentUser && (
          <EditProfileModal user={currentUser} onClose={() => setShowEditProfile(false)} onUpdate={() => fetchProfileAndSetUser(currentUser.id)} />
      )}
      {showCompleteProfile && currentUser && (
          <CompleteProfileModal user={currentUser} onUpdate={() => fetchProfileAndSetUser(currentUser.id)} />
      )}
      {showWorkerSpecialty && currentUser && (
          <WorkerSpecialtyModal user={currentUser} onUpdate={() => fetchProfileAndSetUser(currentUser.id)} />
      )}
      
      {showLocModal && <LocationPermissionModal onAllow={handleGrantLocation} />}
      {showNotifModal && <NotificationPermissionModal onAllow={handleGrantNotification} onSkip={() => setShowNotifModal(false)} />}
      {showCityChangeModal && (
          <CityChangeModal 
            currentCity={showCityChangeModal.current} 
            newCity={showCityChangeModal.new} 
            onUpdate={handleUpdateCity} 
            onCancel={() => setShowCityChangeModal(null)}
          />
      )}
      {showGoogleRoleModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 animate-fade-in backdrop-blur-sm">
              <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <UserIcon size={32} className="text-brand-blue" />
                      </div>
                      <h3 className="font-black text-xl text-slate-800 mb-2">Escolha o tipo de conta</h3>
                      <p className="text-sm text-slate-600">Como você quer usar o app?</p>
                  </div>
                  <div className="space-y-3 mb-6">
                      <button
                          onClick={() => handleGoogleRoleSelect('client')}
                          className="w-full p-4 rounded-xl border-2 border-brand-orange bg-orange-50 transition-all text-left hover:bg-orange-100"
                      >
                          <div className="flex items-center gap-3">
                              <div className="w-5 h-5 rounded-full border-2 border-brand-orange bg-brand-orange flex items-center justify-center">
                                  <Check size={12} className="text-white" />
                              </div>
                              <div>
                                  <p className="font-bold text-slate-800">Cliente</p>
                                  <p className="text-xs text-slate-500">Contratar profissionais para serviços</p>
                              </div>
                          </div>
                      </button>
                      <button
                          onClick={() => handleGoogleRoleSelect('worker')}
                          className="w-full p-4 rounded-xl border-2 border-brand-blue bg-blue-50 transition-all text-left hover:bg-blue-100"
                      >
                          <div className="flex items-center gap-3">
                              <div className="w-5 h-5 rounded-full border-2 border-brand-blue bg-brand-blue flex items-center justify-center">
                                  <Check size={12} className="text-white" />
                              </div>
                              <div>
                                  <p className="font-bold text-slate-800">Profissional</p>
                                  <p className="text-xs text-slate-500">Oferecer serviços e ganhar pontos</p>
                              </div>
                          </div>
                      </button>
                  </div>
              </div>
          </div>
      )}
      <Footer />
        </>
      )}
    </AuthProvider>
  );
}