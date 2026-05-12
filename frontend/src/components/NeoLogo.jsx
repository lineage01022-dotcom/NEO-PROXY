/**
 * NeoLogo — dynamic, animated SVG mark for NEO PROXY.
 *  - Hex ring with a neon cyan→electric-blue gradient stroke
 *  - Stylised "N" inside, drawn from two stroked diagonals
 *  - Orbital pulse-dot spinning around the ring (SMIL animateTransform)
 *  - Subtle Gaussian-blur glow filter for the high-tech neon feel
 */
export default function NeoLogo({ size = 40, className = "", spinning = true }) {
  const uid = `neo-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <span
      className={`relative inline-flex items-center justify-center neo-logo-wrap ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
      data-testid="neo-logo"
    >
      <svg viewBox="0 0 64 64" width={size} height={size} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${uid}-stroke`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="55%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1E40AF" />
          </linearGradient>
          <radialGradient id={`${uid}-bg`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0b0f19" stopOpacity="0" />
          </radialGradient>
          <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* soft inner glow */}
        <circle cx="32" cy="32" r="28" fill={`url(#${uid}-bg)`} />

        {/* outer hex ring */}
        <polygon
          points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5"
          fill="none"
          stroke={`url(#${uid}-stroke)`}
          strokeWidth="2.2"
          strokeLinejoin="round"
          filter={`url(#${uid}-glow)`}
          className="neo-logo-ring"
        />

        {/* stylised N: left bar / diagonal / right bar */}
        <g filter={`url(#${uid}-glow)`} strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="18" x2="22" y2="46" stroke={`url(#${uid}-stroke)`} strokeWidth="4" />
          <line x1="22" y1="18" x2="42" y2="46" stroke={`url(#${uid}-stroke)`} strokeWidth="4" />
          <line x1="42" y1="18" x2="42" y2="46" stroke={`url(#${uid}-stroke)`} strokeWidth="4" />
        </g>

        {/* orbital dot */}
        <g>
          <circle cx="32" cy="3" r="2.6" fill="#67E8F9" filter={`url(#${uid}-glow)`} />
          {spinning && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 32 32"
              to="360 32 32"
              dur="6s"
              repeatCount="indefinite"
            />
          )}
        </g>
      </svg>
    </span>
  );
}
