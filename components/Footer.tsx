import React from 'react';

const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export const Footer: React.FC = () => (
  <footer className="py-4 text-center text-xs text-slate-400 mt-auto">
    Mão de Obra © 2026 — v{version}
  </footer>
);
