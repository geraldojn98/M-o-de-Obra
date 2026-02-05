import React, { useState, useEffect } from 'react';
import { User, Coupon } from '../types';
import { supabase } from '../services/supabase';
import { Button } from '../components/Button';
import { Plus, Trash2, X, Lock, History, Ticket, CheckCircle, ArrowLeft } from 'lucide-react';

// QR Code Generator
const QRCodeDisplay: React.FC<{ value: string }> = ({ value }) => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(value)}`;
    return <img src={url} alt="QR Code" className="w-full max-w-[250px] object-contain border-4 border-white shadow-lg rounded-xl" />;
};

export const PartnerDashboard: React.FC<{ user: User }> = ({ user }) => {
    const [partnerId, setPartnerId] = useState<string | null>(null);
    const [isPinSet, setIsPinSet] = useState(false);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [redemptions, setRedemptions] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'coupons' | 'pos' | 'history'>('coupons');
    
    // Create Coupon State
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newCost, setNewCost] = useState('');
    const [newQty, setNewQty] = useState('');

    // Security & Modals
    const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null); // For POS
    const [showPinModal, setShowPinModal] = useState<'set' | 'auth' | null>(null); // 'set' = first time setup, 'auth' = creating coupon
    const [pinInput, setPinInput] = useState('');
    
    // Realtime Redemption State
    const [redemptionSuccess, setRedemptionSuccess] = useState(false);

    useEffect(() => {
        const fetchPartner = async () => {
            const { data } = await supabase.from('partners').select('id, coupon_pin').eq('email', user.email).single();
            if (data) {
                setPartnerId(data.id);
                setIsPinSet(!!data.coupon_pin);
                fetchCoupons(data.id);
            }
        };
        fetchPartner();
    }, [user.email]);

    useEffect(() => {
        if(partnerId && activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, partnerId]);

    // Realtime Listener for Redemptions
    useEffect(() => {
        let channel: any;

        if (selectedCoupon && !redemptionSuccess) {
            channel = supabase
                .channel(`redemption_watch_${selectedCoupon.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'coupon_redemptions',
                    filter: `coupon_id=eq.${selectedCoupon.id}`
                }, (payload) => {
                    // Redemption detected!
                    setRedemptionSuccess(true);
                })
                .subscribe();
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [selectedCoupon, redemptionSuccess]);

    // Reset success state when closing POS or changing coupon
    useEffect(() => {
        if (!selectedCoupon) {
            setRedemptionSuccess(false);
        }
    }, [selectedCoupon]);

    const fetchCoupons = async (pid: string) => {
        const { data } = await supabase.from('coupons').select('*').eq('partner_id', pid);
        if (data) setCoupons(data.map((c: any) => ({
            id: c.id,
            partnerId: c.partner_id,
            title: c.title,
            description: c.description,
            cost: c.cost,
            totalQuantity: c.total_quantity,
            availableQuantity: c.available_quantity,
            active: c.active
        })));
    };

    const fetchHistory = async () => {
        if(!partnerId) return;
        // Join profiles to get user name
        const { data } = await supabase
            .from('coupon_redemptions')
            .select('*, user:user_id(full_name), coupon:coupon_id(title)')
            .order('redeemed_at', { ascending: false });
        
        if (data) setRedemptions(data);
    };

    const handleCreateCouponClick = (e: React.FormEvent) => {
        e.preventDefault();
        if(!isPinSet) {
            setShowPinModal('set');
        } else {
            setShowPinModal('auth');
        }
    };

    const handlePinSubmit = async () => {
        if (showPinModal === 'set') {
            if (pinInput.length < 4) return alert("PIN deve ter 4 dígitos");
            const { error } = await supabase.from('partners').update({ coupon_pin: pinInput }).eq('id', partnerId);
            if (!error) {
                setIsPinSet(true);
                setShowPinModal(null);
                setPinInput('');
                alert("Senha definida com sucesso!");
            } else {
                alert("Erro ao salvar senha");
            }
        } else if (showPinModal === 'auth') {
             // Verify PIN against DB
             const { data } = await supabase.from('partners').select('coupon_pin').eq('id', partnerId).single();
             if (data && data.coupon_pin === pinInput) {
                 setShowPinModal(null);
                 setPinInput('');
                 submitCouponCreation();
             } else {
                 alert("Senha incorreta!");
                 setPinInput('');
             }
        }
    };

    const submitCouponCreation = async () => {
        if (!partnerId) return;
        const { error } = await supabase.from('coupons').insert({
            partner_id: partnerId,
            title: newTitle,
            description: newDesc,
            cost: parseInt(newCost),
            total_quantity: parseInt(newQty),
            available_quantity: parseInt(newQty)
        });

        if (!error) {
            setNewTitle(''); setNewDesc(''); setNewCost(''); setNewQty('');
            fetchCoupons(partnerId);
            alert("Cupom criado!");
        } else {
            alert("Erro: " + error.message);
        }
    };

    const handleDeleteCoupon = async (id: string) => {
        if(!confirm("Excluir cupom?")) return;
        await supabase.from('coupons').update({ active: false }).eq('id', id);
        if(partnerId) fetchCoupons(partnerId);
    };

    const handleCloseSuccess = () => {
        setRedemptionSuccess(false);
        setSelectedCoupon(null);
        if(partnerId) fetchCoupons(partnerId); // Refresh quantities
    };

    if (!partnerId) return <div className="p-10 text-center">Carregando dados do parceiro...</div>;

    return (
        <div className="space-y-6 w-full max-w-full">
            <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => setActiveTab('coupons')}
                    className={`px-4 py-2 font-bold whitespace-nowrap ${activeTab === 'coupons' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-slate-500'}`}
                >
                    Gerenciar Cupons
                </button>
                <button 
                    onClick={() => setActiveTab('pos')}
                    className={`px-4 py-2 font-bold whitespace-nowrap ${activeTab === 'pos' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-slate-500'}`}
                >
                    Ponto de Venda (QR)
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 font-bold whitespace-nowrap ${activeTab === 'history' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-slate-500'}`}
                >
                    Histórico
                </button>
            </div>

            {activeTab === 'coupons' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    {/* List */}
                    <div className="space-y-4 order-2 md:order-1">
                        <h3 className="font-bold text-lg text-slate-700">Seus Cupons Ativos</h3>
                        {coupons.filter(c => c.active).length === 0 && <p className="text-slate-400 italic">Nenhum cupom criado.</p>}
                        {coupons.filter(c => c.active).map(coupon => (
                            <div key={coupon.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold">{coupon.title}</h4>
                                    <p className="text-xs text-slate-500">{coupon.description}</p>
                                    <div className="flex gap-2 mt-2 text-xs font-bold text-slate-600">
                                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{coupon.cost} pts</span>
                                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{coupon.availableQuantity}/{coupon.totalQuantity} rest.</span>
                                    </div>
                                </div>
                                <button onClick={() => handleDeleteCoupon(coupon.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>

                    {/* Create Form */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit order-1 md:order-2">
                        <h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center gap-2"><Plus size={20}/> Novo Cupom</h3>
                        {!isPinSet && <div className="bg-yellow-50 text-yellow-700 p-3 rounded-lg text-xs mb-3 font-bold">Você precisará definir uma senha de segurança (PIN) no primeiro cadastro.</div>}
                        <form onSubmit={handleCreateCouponClick} className="space-y-3">
                            <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Título (Ex: Vale R$ 50)" className="w-full p-2 border rounded" required />
                            <textarea value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="Regras de uso..." className="w-full p-2 border rounded" required />
                            <div className="flex gap-2">
                                <input type="number" value={newCost} onChange={e=>setNewCost(e.target.value)} placeholder="Custo em Pontos" className="w-full p-2 border rounded" required />
                                <input type="number" value={newQty} onChange={e=>setNewQty(e.target.value)} placeholder="Qtd. Mensal" className="w-full p-2 border rounded" required />
                            </div>
                            <Button fullWidth>Criar Cupom</Button>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === 'pos' && (
                <div className="text-center animate-fade-in w-full">
                    {!selectedCoupon ? (
                        <div className="max-w-md mx-auto">
                            <h3 className="text-xl font-bold mb-4">O que o cliente vai resgatar?</h3>
                            <p className="text-slate-500 mb-6">Selecione o cupom para gerar o QR Code que o cliente deve escanear.</p>
                            <div className="space-y-3">
                                {coupons.filter(c => c.active && c.availableQuantity > 0).map(c => (
                                    <button 
                                        key={c.id} 
                                        onClick={() => setSelectedCoupon(c)}
                                        className="w-full bg-white p-4 rounded-xl border border-slate-200 hover:border-brand-orange hover:shadow-md transition-all text-left group"
                                    >
                                        <span className="font-bold text-lg group-hover:text-brand-orange">{c.title}</span>
                                        <div className="flex justify-between text-sm text-slate-500 mt-1">
                                            <span>{c.cost} Pontos</span>
                                            <span>{c.availableQuantity} un. disponíveis</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="w-full flex justify-center">
                            {redemptionSuccess ? (
                                <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-green-100 animate-bounce-slow max-w-sm w-full flex flex-col items-center">
                                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                                        <CheckCircle size={48} />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 mb-2">Resgatado!</h3>
                                    <p className="text-slate-500 font-medium mb-8">O cupom foi validado com sucesso.</p>
                                    <Button fullWidth size="lg" onClick={handleCloseSuccess}>
                                        Concluir e Voltar
                                    </Button>
                                </div>
                            ) : (
                                <div className="bg-brand-blue/5 p-8 rounded-2xl inline-block border-2 border-brand-blue/20 w-full max-w-sm">
                                    <h3 className="text-2xl font-bold text-brand-blue mb-2">{selectedCoupon.title}</h3>
                                    <p className="text-slate-600 mb-6">Peça para o cliente escanear este código no App.</p>
                                    
                                    <div className="flex justify-center mb-6 bg-white p-2 rounded-xl">
                                        <QRCodeDisplay value={selectedCoupon.id} />
                                    </div>

                                    <div className="flex items-center justify-center gap-2 mb-6 text-sm font-bold text-slate-500 bg-white/50 p-2 rounded-lg">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        Aguardando leitura...
                                    </div>
                                    
                                    <Button variant="outline" onClick={() => setSelectedCoupon(null)} className="flex items-center gap-2 mx-auto">
                                        <ArrowLeft size={18}/> Cancelar
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-4 animate-fade-in">
                     <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2"><History size={20}/> Histórico de Resgates</h3>
                     {redemptions.length === 0 ? (
                         <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl">Nenhum cupom resgatado ainda.</div>
                     ) : (
                         <div className="grid grid-cols-1 gap-3">
                             {redemptions.map(r => (
                                 <div key={r.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                     <div>
                                         <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-800">{r.user?.full_name || 'Usuário Desconhecido'}</span>
                                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{new Date(r.redeemed_at).toLocaleDateString()}</span>
                                         </div>
                                         <p className="text-sm text-brand-orange font-medium flex items-center gap-1"><Ticket size={14}/> {r.coupon?.title}</p>
                                     </div>
                                     <div className="text-right">
                                         <span className="block font-black text-slate-700">-{r.cost_paid} pts</span>
                                         <span className="text-[10px] text-slate-400">{new Date(r.redeemed_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     )}
                </div>
            )}

            {/* PIN MODAL */}
            {showPinModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
                        <div className="text-center mb-4">
                            <div className="w-12 h-12 bg-blue-100 text-brand-blue rounded-full flex items-center justify-center mx-auto mb-2">
                                <Lock size={24}/>
                            </div>
                            <h3 className="font-bold text-lg">
                                {showPinModal === 'set' ? 'Definir Senha de Segurança' : 'Autorizar Criação'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {showPinModal === 'set' 
                                 ? 'Crie um PIN de 4 dígitos para proteger a criação de cupons.' 
                                 : 'Digite sua senha definida anteriormente para continuar.'}
                            </p>
                        </div>
                        <input 
                            type="password" 
                            inputMode="numeric" 
                            maxLength={4}
                            className="w-full text-center text-3xl tracking-[1em] p-3 border-b-2 border-slate-200 focus:border-brand-orange outline-none font-bold text-slate-800 mb-6"
                            placeholder="••••"
                            value={pinInput}
                            onChange={e => setPinInput(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <Button variant="outline" fullWidth onClick={() => { setShowPinModal(null); setPinInput(''); }}>Cancelar</Button>
                            <Button fullWidth onClick={handlePinSubmit}>Confirmar</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};