import React from 'react';
import { IMAGES } from '../logos';

interface MascotProps {
    className?: string;
    variant?: 'full' | 'face';
}

export const Mascot: React.FC<MascotProps> = ({ className, variant = 'full' }) => {
  const src = variant === 'face' 
    ? IMAGES.MASCOT_FACE_TRANSPARENT
    : IMAGES.MASCOT_TRANSPARENT;

  return (
    <img 
      src={src} 
      alt="MÃO DE OBRA Mascote" 
      className={`object-contain ${className}`}
    />
  );
};