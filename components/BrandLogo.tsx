// CreditVector mark — a blue→green shield with a green chevron and a blue arrow
// rising through the top, plus a green spark. Pure vector, works on any background.
export function BrandLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="CreditVector" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cvShieldMk" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#1e40af" />
          <stop offset="1" stopColor="#0c9a55" />
        </linearGradient>
        <linearGradient id="cvGrnMk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3fd886" />
          <stop offset="1" stopColor="#0c9a55" />
        </linearGradient>
        <linearGradient id="cvBluMk" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1e40af" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path d="M 256 80 L 400 116 L 400 256 C 400 350 340 408 256 446 C 172 408 112 350 112 256 L 112 116 Z" fill="none" stroke="url(#cvShieldMk)" strokeWidth="32" strokeLinejoin="round" />
      <path d="M 192 300 L 252 196 L 300 262" fill="none" stroke="url(#cvGrnMk)" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 214 322 L 268 366 L 414 150" fill="none" stroke="url(#cvBluMk)" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 414 150 L 350 168 M 414 150 L 404 214" fill="none" stroke="url(#cvBluMk)" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 446 92 L 455 120 L 483 129 L 455 138 L 446 166 L 437 138 L 409 129 L 437 120 Z" fill="#34c46f" />
    </svg>
  );
}
