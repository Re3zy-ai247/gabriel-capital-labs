/* eslint-disable @next/next/no-img-element */
// CreditVector mark — the owner's actual 3D shield art (blue/green beveled shield,
// green chevron + blue rising arrow, green spark), extracted to a transparent PNG
// with its drop-shadow removed. Sized via className (e.g. "h-9 w-9").
export function BrandLogo({ className = "h-8 w-8" }: { className?: string }) {
  return <img src="/logo-mark.png" alt="CreditVector" className={`${className} object-contain`} />;
}
