import React from 'react';

interface MascotProps {
    className?: string;
    variant?: 'full' | 'face';
}

export const Mascot: React.FC<MascotProps> = ({ className, variant = 'full' }) => {
  const src = variant === 'face' 
    ? "/icon.png" // Usando o ícone do app como "Rosto" conforme solicitado (solução mais segura sem URL externa nova)
    : "https://i.ibb.co/rR6fBCxg/MASCOTE-FUNDO-TRANSPARENTE.png";

  return (
    <img 
      src={src} 
      alt="MÃO DE OBRA Mascote" 
      className={`object-contain ${className}`}
    />
  );
};