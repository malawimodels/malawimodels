const encodeSvg = (svg: string): string => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

export const MODEL_PLACEHOLDER_IMAGE = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" role="img" aria-label="No image available">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#f8fafc"/>
      <stop offset="1" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#bg)"/>
  <circle cx="200" cy="222" r="58" fill="#cbd5e1"/>
  <path d="M94 430c19-70 69-105 106-105s87 35 106 105" fill="#cbd5e1"/>
  <text x="200" y="505" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#64748b">No Image</text>
</svg>`);

export const AVATAR_PLACEHOLDER_IMAGE = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="No avatar available">
  <rect width="160" height="160" rx="24" fill="#f1f5f9"/>
  <circle cx="80" cy="62" r="28" fill="#cbd5e1"/>
  <path d="M34 132c9-35 32-52 46-52s37 17 46 52" fill="#cbd5e1"/>
</svg>`);