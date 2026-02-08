import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingDisplayProps {
  rating: number;
  maxStars?: number;
  size?: number;
  className?: string;
}

/** Exibe estrelas fracionadas (ex: 4.5 = 4 cheias + 1 metade) */
export const StarRatingDisplay: React.FC<StarRatingDisplayProps> = ({
  rating,
  maxStars = 5,
  size = 20,
  className = '',
}) => {
  const clampedRating = Math.min(Math.max(rating, 0), maxStars);
  const fullStars = Math.floor(clampedRating);
  const hasHalf = clampedRating % 1 >= 0.25 && clampedRating % 1 < 0.75;
  const halfStar = clampedRating % 1 >= 0.75 ? 1 : hasHalf ? 1 : 0;
  const emptyStars = maxStars - fullStars - halfStar;

  return (
    <div className={`flex items-center gap-0.5 ${className}`} title={`${rating.toFixed(1)} estrelas`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`full-${i}`} size={size} className="fill-amber-400 text-amber-400 shrink-0" />
      ))}
      {halfStar > 0 && (
        <div className="relative shrink-0 inline-flex" style={{ width: size, height: size }}>
          <Star size={size} className="text-slate-200" />
          <div
            className="absolute inset-0 flex items-center justify-start overflow-hidden"
            style={{ clipPath: 'inset(0 50% 0 0)' }}
          >
            <Star size={size} className="fill-amber-400 text-amber-400 shrink-0" />
          </div>
        </div>
      )}
      {Array.from({ length: Math.max(0, emptyStars) }).map((_, i) => (
        <Star key={`empty-${i}`} size={size} className="text-slate-200 shrink-0" />
      ))}
    </div>
  );
};
