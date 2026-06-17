// Kai — the founder's Shiba Inu, rendered as the master agent's avatar. Pure
// inline SVG so it's crisp at any size and needs no asset pipeline.
export function KaiAvatar({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Kai the Shiba Inu">
      <defs>
        <linearGradient id="kaiFur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2AC6B" />
          <stop offset="1" stopColor="#D67F34" />
        </linearGradient>
      </defs>
      {/* ears */}
      <path d="M14 27 L9 5 L30 18 Z" fill="url(#kaiFur)" />
      <path d="M50 27 L55 5 L34 18 Z" fill="url(#kaiFur)" />
      <path d="M16 23 L13 10 L25 18 Z" fill="#C0652A" />
      <path d="M48 23 L51 10 L39 18 Z" fill="#C0652A" />
      {/* head */}
      <circle cx="32" cy="36" r="21" fill="url(#kaiFur)" />
      {/* cream muzzle + cheeks */}
      <path d="M32 22 C20 22 14 34 16 44 C18 53 26 56 32 56 C38 56 46 53 48 44 C50 34 44 22 32 22 Z" fill="#FFF4E6" />
      <ellipse cx="15.5" cy="40" rx="6" ry="8" fill="#FFF4E6" />
      <ellipse cx="48.5" cy="40" rx="6" ry="8" fill="#FFF4E6" />
      {/* eyes */}
      <ellipse cx="24" cy="35" rx="2.6" ry="3.4" fill="#2A2018" />
      <ellipse cx="40" cy="35" rx="2.6" ry="3.4" fill="#2A2018" />
      <circle cx="25" cy="33.7" r="0.8" fill="#fff" />
      <circle cx="41" cy="33.7" r="0.8" fill="#fff" />
      {/* nose + smile */}
      <path d="M29 42 Q32 45.5 35 42 Q34 39.8 32 39.8 Q30 39.8 29 42 Z" fill="#2A2018" />
      <path d="M32 44.5 L32 47.5 M32 47.5 Q28 50.5 25 47.2 M32 47.5 Q36 50.5 39 47.2" stroke="#2A2018" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Avatar in a soft amber halo — for headers and Kai reply rows.
export function KaiBadge({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-b from-amber-400/25 to-amber-600/10 ring-1 ring-amber-400/30 ${className}`}>
      <KaiAvatar className="h-[78%] w-[78%]" />
    </span>
  );
}
