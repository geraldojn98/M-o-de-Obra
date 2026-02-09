import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { StarRatingDisplay } from './StarRatingDisplay';
import { Button } from './Button';
import { LevelBadge } from './LevelBadge';
import { supabase } from '../services/supabase';

export type WorkerLevel = 'bronze' | 'silver' | 'gold' | 'diamond';

const LEVEL_STYLES: Record<WorkerLevel, { border: string; badge: string; label: string }> = {
  bronze: { border: 'border-amber-800/80 shadow-amber-900/30', badge: 'bg-amber-800 text-amber-100', label: 'Bronze' },
  silver: { border: 'border-slate-400 shadow-slate-500/30', badge: 'bg-slate-500 text-white', label: 'Prata' },
  gold: { border: 'border-amber-400 shadow-amber-500/40', badge: 'bg-amber-400 text-amber-900', label: 'Ouro' },
  diamond: { border: 'border-cyan-400 shadow-cyan-500/40', badge: 'bg-cyan-400 text-cyan-900', label: 'Diamante' },
};

export interface WorkerProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  specialty?: string;
  level?: WorkerLevel | string;
  rating?: number;
  verified_count?: number;
}

export interface ReviewItem {
  id: string;
  rating: number;
  review_comment?: string;
  title?: string;
  created_at?: string;
}

interface WorkerProfileModalProps {
  worker: WorkerProfile;
  reviews: ReviewItem[];
  onHire: () => void;
  onClose: () => void;
  loading?: boolean;
}

interface PortfolioItem {
  id: string;
  image_url: string;
  description?: string | null;
}

export const WorkerProfileModal: React.FC<WorkerProfileModalProps> = ({
  worker,
  reviews,
  onHire,
  onClose,
  loading = false,
}) => {
  const level = (worker.level || 'bronze') as WorkerLevel;
  const style = LEVEL_STYLES[level] || LEVEL_STYLES.bronze;
  const avgRating = worker.rating ?? 0;
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!worker.id) return;
    supabase
      .from('worker_portfolio')
      .select('id, image_url, description')
      .eq('worker_id', worker.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPortfolioItems(data || []));
  }, [worker.id]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div
        className="bg-white w-full max-w-md max-h-[90vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com foto e borda do nível */}
        <div className="relative pt-6 pb-4 px-6 flex flex-col items-center bg-gradient-to-b from-slate-50 to-white">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
            aria-label="Fechar"
          >
            <Icons.X size={20} />
          </button>

          <div
            className={`w-24 h-24 rounded-full p-1.5 shadow-lg ${style.border} border-4 bg-white flex items-center justify-center relative`}
          >
            <img
              src={worker.avatar_url || 'https://via.placeholder.com/96?text=?'}
              alt={worker.full_name}
              className="w-full h-full rounded-full object-cover bg-slate-200"
            />
            <div className="absolute -bottom-1 -right-1">
              <LevelBadge level={level} size="md" />
            </div>
          </div>

          <h2 className="font-black text-xl text-slate-800 mt-3 truncate max-w-full text-center">
            {worker.full_name}
          </h2>

          <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${style.badge}`}
            >
              {style.label}
            </span>
            {worker.specialty && (
              <span className="text-xs text-slate-500 truncate max-w-[180px]">
                {worker.specialty}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <StarRatingDisplay rating={avgRating} size={18} />
            <span className="text-sm font-bold text-slate-700">
              {avgRating > 0 ? avgRating.toFixed(1) : '—'}
            </span>
            {worker.verified_count != null && worker.verified_count > 0 && (
              <span className="text-xs text-slate-500">
                ({worker.verified_count} verificados)
              </span>
            )}
          </div>
        </div>

        {/* Bio */}
        {worker.bio && (
          <div className="px-6 py-3 border-b border-slate-100">
            <p className="text-sm text-slate-600 leading-relaxed">{worker.bio}</p>
          </div>
        )}

        {/* Galeria do portfólio */}
        {portfolioItems.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
              <Icons.Image size={16} />
              Galeria
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {portfolioItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setExpandedImageUrl(item.image_url)}
                  className="aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 focus:ring-2 focus:ring-brand-orange focus:outline-none"
                >
                  <img
                    src={item.image_url}
                    alt={item.description || 'Trabalho'}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lista de comentários */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
            <Icons.MessageSquare size={16} />
            Avaliações anteriores
          </h3>
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nenhuma avaliação ainda.</p>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto no-scrollbar">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="bg-slate-50 rounded-xl p-3 border border-slate-100"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <StarRatingDisplay rating={r.rating} size={14} />
                    {r.title && (
                      <span className="text-xs font-medium text-slate-600 truncate">
                        {r.title}
                      </span>
                    )}
                  </div>
                  {r.review_comment && (
                    <p className="text-sm text-slate-700 leading-relaxed">
                      &quot;{r.review_comment}&quot;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botão fixo */}
        <div className="p-4 pt-3 border-t border-slate-100 bg-white shrink-0">
          <Button fullWidth size="lg" onClick={onHire} disabled={loading}>
            Contratar Este Profissional
          </Button>
        </div>
      </div>

      {/* Overlay: foto expandida */}
      {expandedImageUrl && (
        <div
          className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setExpandedImageUrl(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setExpandedImageUrl(null)}
          aria-label="Fechar"
        >
          <button
            type="button"
            onClick={() => setExpandedImageUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/30"
            aria-label="Fechar"
          >
            <Icons.X size={24} />
          </button>
          <img
            src={expandedImageUrl}
            alt="Ampliada"
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
