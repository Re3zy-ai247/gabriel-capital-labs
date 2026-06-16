/* eslint-disable @next/next/no-img-element */
// CreditVector mark — the brand's 3D shield, isolated on transparency from the
// official logo art. Sized via className (e.g. "h-9 w-9").
export function BrandLogo({ className = "h-8 w-8" }: { className?: string }) {
  return <img src="/logo-mark.png" alt="CreditVector" className={`${className} object-contain`} />;
}
