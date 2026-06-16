// CreditVector mark — green "C" cradling a blue "V" that rises into an arrow.
// Pure vector, theme-independent (works on light and dark). Size via className.
export function BrandLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="CreditVector" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cvGreenMark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3fd886" />
          <stop offset="1" stopColor="#0c9a55" />
        </linearGradient>
        <linearGradient id="cvBlueMark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1e40af" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path d="M 346 142 A 158 158 0 1 0 346 370" fill="none" stroke="url(#cvGreenMark)" strokeWidth="58" strokeLinecap="round" />
      <path d="M 208 210 L 250 392 L 455 118" fill="none" stroke="url(#cvBlueMark)" strokeWidth="58" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 455 118 L 392 150 M 455 118 L 447 192" fill="none" stroke="url(#cvBlueMark)" strokeWidth="58" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
