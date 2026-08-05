"use client";

import { useEffect, useState } from "react";
import { REDUCED_MOTION_QUERY } from "@/lib/gsap";

const LINKS: { href: string; label: string }[] = [
  { href: "#institution", label: "Institution" },
  { href: "#mission", label: "Mission" },
  { href: "#ecosystem", label: "Ecosystem" },
  { href: "#lab", label: "Lab" },
  { href: "#principles", label: "Principles" },
  { href: "#contact", label: "Contact" },
];

const NAV_OFFSET = 84; // matches scroll-margin-top in globals.css

export default function Nav() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reveal = () => setVisible(true);

    window.addEventListener("gcl:arrival-complete", reveal);

    const onScroll = () => {
      if (window.scrollY > 60) setVisible(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("gcl:arrival-complete", reveal);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // A large instant hash-jump can land inside a still-pinned scene before
  // ScrollTrigger has a chance to update its pin state. A native smooth
  // scroll fires incremental scroll events instead, so pins release
  // correctly along the way — same reason we handle it here rather than
  // letting the browser's default anchor jump run.
  const handleNavClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.querySelector(href);
    if (!target) return;
    event.preventDefault();
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    const top = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
    window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
    history.pushState(null, "", href);
  };

  return (
    <header className={`nav${visible ? " nav--visible" : ""}`}>
      <a className="nav__brand" href="#top" aria-label="Gabriel Capital Labs — back to top">
        <img
          className="nav__brand-mark"
          src="/img/gateway-g-480.webp"
          width={480}
          height={520}
          alt=""
          aria-hidden="true"
        />
        <span className="nav__brand-word">Gabriel Capital Labs</span>
      </a>
      <nav className="nav__links" aria-label="Primary">
        {LINKS.map((link) => (
          <a
            key={link.href}
            className="nav__link"
            href={link.href}
            onClick={(e) => handleNavClick(e, link.href)}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
