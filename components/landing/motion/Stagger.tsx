"use client";
import { Children, isValidElement, type ReactNode } from "react";
import { Reveal } from "../Reveal";

// Staggered section entrance (Sprint XXIII motion primitive). Wraps each child in a
// scroll-triggered Reveal with an incrementing delay, so a grid/list cascades in
// instead of appearing all at once. Reduced-motion is handled by Reveal/.reveal
// (content shows immediately, no transition). Replaces hand-written `delay={i*n}`.
//
//   <Stagger step={80} className="grid gap-5 md:grid-cols-4">
//     {items.map((x) => <Card key={x.id} {...x} />)}
//   </Stagger>
//
// The wrapper renders as a plain <div> so it can BE the grid/flex container.
export function Stagger({
  children,
  step = 80,
  start = 0,
  as: As = "div",
  className = "",
}: {
  children: ReactNode;
  step?: number;      // ms between each child
  start?: number;     // ms before the first child
  as?: "div" | "ul" | "ol";
  className?: string;
}) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <As className={className}>
      {items.map((child, i) => (
        <Reveal key={i} delay={start + i * step}>{child}</Reveal>
      ))}
    </As>
  );
}
