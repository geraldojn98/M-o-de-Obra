/**
 * Avatar padrão para usuários sem foto: silhueta de pessoa (estilo Instagram/Google).
 * SVG em data URI para não depender de rede.
 */
const silhouetteSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <circle cx="50" cy="50" r="50" fill="#e2e8f0"/>
  <circle cx="50" cy="38" r="14" fill="#94a3b8"/>
  <path fill="#94a3b8" d="M28 92c0-12 10-22 22-22s22 10 22 22v2H28v-2z"/>
</svg>`;

export const DEFAULT_AVATAR =
  'data:image/svg+xml,' + encodeURIComponent(silhouetteSvg);
