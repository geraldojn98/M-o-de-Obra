import React from 'react';

export const Mascot: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <img 
      src="https://i.ibb.co/rR6fBCxg/MASCOTE-FUNDO-TRANSPARENTE.png" 
      alt="MÃO DE OBRA Logo" 
      className={`object-contain ${className}`}
    />
  );
};