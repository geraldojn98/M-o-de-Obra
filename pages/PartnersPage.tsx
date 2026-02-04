import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Partner, Coupon } from '../types';
import { Button } from '../components/Button';
import { Store, MapPin, Ticket, QrCode, X, Camera } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

// Custom Camera Permission Modal
const CameraPermissionModal: React.FC<{ onGrant: () => void, onClose: () => void }> = ({ onGrant, onClose }) => (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-3xl w-full max-w-sm p-8 text-center shadow-2xl relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button>
            <div className="w-20 h-20 bg-orange-100 text-brand-orange rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Permitir Câmera?</h3>
            <p className="text-slate-500 mb-8 leading-relaxed">
                Para escanear o QR Code e resgatar seu desconto, precisamos de acesso à câmera do seu celular.
            </p>
            <Button fullWidth size="lg" onClick={onGrant} className="rounded-2xl shadow-xl shadow-brand-orange/20">
                Permitir Acesso
            </Button>
            <p className="text-[10px] text-slate-400 mt-4">Nenhuma imagem será salva em nossos servidores.</p>
        </div>
    </div>
);

export const PartnersPage: React.FC = () => {
    const [partners, setPartners] = useState<Partner[]>([]);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [scanStatus, setScanStatus] = useState<'idle'|'processing'|'success'|'error'>('idle');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: pData } = await supabase.from('partners').select('*').eq('active', true);
        const { data: cData } = await supabase.from('coupons').select('*').eq('active', true).gt('available_quantity', 0);

        if (pData) setPartners(pData);
        if (cData) setCoupons(cData.map((c:any) => ({
            id: c.id,
            partnerId: c.partner_id,
            title: c.title,
            description: c.description,
            cost: c.cost,
            totalQuantity: c.total_quantity,
            availableQuantity: c.available_quantity,
            active: c.active
        })));
        setLoading(false);
    };

    const getCategoryStyle = (cat: string) => {
        switch (cat) {
            case 'Construção': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'Alimentação': return 'bg-red-100 text-red-700 border-red-200';
            case 'Agro': return 'bg-green-100 text-green-700 border-green-200';
            case 'Combustível': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Ferramentas': return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'Casa e Decoração': return 'bg-purple-100 text-purple-700 border-purple-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const handleRequestCamera = async () => {
        try {
            // Tenta câmera traseira primeiro
            await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" } 
            });
            setShowPermissionModal(false);
            setScannerOpen(true);
            setScanResult(null);
            setScanStatus('idle');
        } catch (err: any) {
            console.warn("Falha ao abrir câmera traseira, tentando fallback...", err);
            try {
                // Fallback: Tenta qualquer câmera
                await navigator.mediaDevices.getUserMedia({ video: true });
                setShowPermissionModal(false);
                setScannerOpen(true);
                setScanResult(null);
                setScanStatus('idle');
            } catch (err2) {
                console.error(err2);
                alert("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
                setShowPermissionModal(false);
            }
        }
    };

    // QR Code Handling
    useEffect(() => {
        if (scannerOpen && !scanResult) {
            // Wait for modal transition
            const timer = setTimeout(() => {
                const scanner = new Html5QrcodeScanner(
                    "reader",
                    { 
                        fps: 10, 
                        qrbox: { width: 250, height: 250 }, 
                        aspectRatio: 1.0,
                        // MODIFICADO: Removido 'exact' para evitar OverconstrainedError
                        videoConstraints: {
                            facingMode: "environment" 
                        }
                    },
                    false
                );
                
                scanner.render((decodedText) => {
                    handleScanSuccess(decodedText, scanner);
                }, (error) => {
                    // ignore errors during scanning
                });

                // Cleanup function inside the effect
                return () => {
                    try { scanner.clear(); } catch(e) {}
                };
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [scannerOpen]);

    const handleScanSuccess = async (data: string, scanner: any) => {
        scanner.clear();
        setScanResult(data);
        setScannerOpen(false);
        setScanStatus('processing');
        
        try {
            // Data format: coupon_id
            const couponId = data;
            const { data: session } = await supabase.auth.getSession();
            const userId = session.session?.user.id;

            if(!userId) throw new Error("Usuário não identificado");

            const { data: res, error } = await supabase.rpc('redeem_coupon', {
                p_coupon_id: couponId,
                p_user_id: userId
            });

            if(error) throw error;

            if(res.success) {
                setScanStatus('success');
                fetchData(); // Refresh points/coupons
            } else {
                setScanStatus('error');
                alert(res.message);
            }

        } catch (e: any) {
            setScanStatus('error');
            alert("Erro ao processar cupom: " + e.message);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in relative w-full overflow-hidden">
            
            {/* Header / CTA */}
            <div className="bg-brand-orange rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                        <Store size={28} /> Clube de Parceiros
                    </h2>
                    <p className="opacity-90 max-w-lg text-sm md:text-base">
                        Troque seus pontos por descontos reais! Vá até a loja, escolha o cupom e escaneie o QR Code no balcão para pagar com pontos.
                    </p>
                </div>
                <div className="relative z-10 w-full md:w-auto">
                    <button 
                        onClick={() => setShowPermissionModal(true)}
                        className="bg-white text-brand-orange px-6 py-3 rounded-xl font-bold shadow-md hover:bg-orange-50 transition-colors flex items-center justify-center gap-2 w-full md:w-auto"
                    >
                        <QrCode size={20} /> Escanear QR Code
                    </button>
                </div>
                
                {/* Decorative circles */}
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            </div>

            {/* Permission Modal */}
            {showPermissionModal && (
                <CameraPermissionModal 
                    onGrant={handleRequestCamera} 
                    onClose={() => setShowPermissionModal(false)} 
                />
            )}

            {/* Scanner Modal */}
            {scannerOpen && (
                <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md overflow-hidden flex flex-col h-[80vh] sm:h-auto">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="font-bold text-slate-800">Escanear QR Code</h3>
                            <button onClick={() => setScannerOpen(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                             <div id="reader" className="w-full h-full"></div>
                        </div>
                        <div className="p-4 bg-slate-50 text-center">
                             <p className="text-xs text-slate-500">Aponte a câmera para o código gerado pelo lojista.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {scanStatus === 'success' && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-8 text-center animate-bounce-slow max-w-sm w-full">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Ticket size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">Sucesso!</h3>
                        <p className="text-slate-600 mt-2 text-sm">Seus pontos foram debitados e o desconto aplicado.</p>
                        <Button fullWidth className="mt-6" onClick={() => setScanStatus('idle')}>Fechar</Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {partners.map(partner => {
                    const partnerCoupons = coupons.filter(c => c.partnerId === partner.id);
                    return (
                        <div key={partner.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                            <div className="flex p-4 gap-4 items-center border-b border-slate-50">
                                <img 
                                    src={partner.logoUrl || 'https://via.placeholder.com/60'} 
                                    className="w-16 h-16 object-contain border border-slate-100 rounded-lg bg-white"
                                />
                                <div>
                                    <div className={`text-[10px] px-2 py-0.5 rounded inline-block font-bold mb-1 ${getCategoryStyle(partner.category)}`}>
                                        {partner.category}
                                    </div>
                                    <h3 className="font-bold text-slate-900">{partner.name}</h3>
                                    <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={10}/> {partner.address}</p>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-slate-50/50 flex-1">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Cupons Disponíveis</h4>
                                {partnerCoupons.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">Nenhum cupom ativo no momento.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {partnerCoupons.map(coupon => (
                                            <div key={coupon.id} className="bg-white border border-slate-200 rounded-lg p-3 flex justify-between items-center shadow-sm">
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800">{coupon.title}</p>
                                                    <p className="text-xs text-slate-500">{coupon.description}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block font-bold text-brand-orange">{coupon.cost} pts</span>
                                                    <span className="text-[10px] text-slate-400">{coupon.availableQuantity} rest.</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {partners.length === 0 && !loading && (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                    <Store size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">Nenhum parceiro disponível no momento.</p>
                </div>
            )}
        </div>
    );
};