/** Emblème de bratMap : roue de caravane, œil de l'illusion et flammes — clin d'œil aux Ravnos (dessin original). */
export function RavnosMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="rv-ember-ui" cx="50%" cy="85%" r="75%">
          <stop offset="0" stopColor="#f6d08a" />
          <stop offset=".5" stopColor="#d9643f" />
          <stop offset="1" stopColor="#7d1f26" />
        </radialGradient>
      </defs>
      <g className="rv-flames" fill="url(#rv-ember-ui)">
        <path d="M32 2c3.4 5 6.6 7.6 4.4 13-1-2.2-2.4-3.4-4.4-4.4-2 1-3.4 2.2-4.4 4.4C25.4 9.6 28.6 7 32 2z" />
        <path d="M15 9.5c4.4 1.6 7.8 3.2 7.6 8.4-2-1-3.6-1.2-5.4-1-1-2.2-1.4-4.4-2.2-7.4z" />
        <path d="M49 9.5c-4.4 1.6-7.8 3.2-7.6 8.4 2-1 3.6-1.2 5.4-1 1-2.2 1.4-4.4 2.2-7.4z" />
      </g>
      <g className="rv-wheel" fill="none" stroke="#c9564a" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="32" cy="36" r="22" />
        <circle cx="32" cy="36" r="18.6" strokeWidth=".8" opacity=".55" />
        <line x1="44.00" y1="36.00" x2="54.00" y2="36.00" />
        <line x1="40.49" y1="44.49" x2="47.56" y2="51.56" />
        <line x1="32.00" y1="48.00" x2="32.00" y2="58.00" />
        <line x1="23.51" y1="44.49" x2="16.44" y2="51.56" />
        <line x1="20.00" y1="36.00" x2="10.00" y2="36.00" />
        <line x1="23.51" y1="27.51" x2="16.44" y2="20.44" />
        <line x1="32.00" y1="24.00" x2="32.00" y2="14.00" />
        <line x1="40.49" y1="27.51" x2="47.56" y2="20.44" />
      </g>
      <path className="rv-eye" d="M20.5 36q11.5-10.5 23 0q-11.5 10.5-23 0z" fill="#140d0f" stroke="#e8c27a" strokeWidth="1.6" strokeLinejoin="round" />
      <ellipse className="rv-pupil" cx="32" cy="36" rx="1.9" ry="5.2" fill="#e8c27a" />
    </svg>
  );
}
