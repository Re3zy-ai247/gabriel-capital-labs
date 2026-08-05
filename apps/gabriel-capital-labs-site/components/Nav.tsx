"use client";

import { useEffect, useRef, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);

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

  // D7 — full-bleed chapter index overlay for <860px: focus-trapped, closes
  // on Escape, returns focus to the toggle button on close.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const toggleButton = toggleButtonRef.current;
    const header = headerRef.current;

    closeButtonRef.current?.focus();
    document.body.style.overflow = "hidden";
    // Belt-and-suspenders on top of the CSS focus-trap query below: keep
    // the fixed header (still visible underneath the full-bleed overlay)
    // out of the tab order entirely while the dialog is open.
    header?.setAttribute("inert", "");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab" || !overlayRef.current) return;

      const focusables = overlayRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      header?.removeAttribute("inert");
      toggleButton?.focus();
    };
  }, [menuOpen]);

  // A large instant hash-jump can land inside a still-pinned scene before
  // ScrollTrigger has a chance to update its pin state. A native smooth
  // scroll fires incremental scroll events instead, so pins release
  // correctly along the way — same reason we handle it here rather than
  // letting the browser's default anchor jump run.
  const handleNavClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.querySelector(href);
    if (!target) return;
    event.preventDefault();
    setMenuOpen(false);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    const top = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
    window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
    history.pushState(null, "", href);
  };

  return (
    <>
      <header ref={headerRef} className={`nav${visible ? " nav--visible" : ""}`}>
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
        <button
          type="button"
          className="nav__index-toggle"
          onClick={() => setMenuOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          ref={toggleButtonRef}
        >
          Index
        </button>
      </header>

      <div
        className={`nav__overlay${menuOpen ? " nav__overlay--open" : ""}`}
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label="Chapter index"
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className="nav__overlay-close"
          onClick={() => setMenuOpen(false)}
          ref={closeButtonRef}
        >
          Close
        </button>
        <nav aria-label="Chapters">
          <ul className="nav__overlay-list">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  className="nav__overlay-link"
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
