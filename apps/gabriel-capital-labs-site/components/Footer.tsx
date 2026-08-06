"use client";

import { footer, arrival, site } from "@/content/site";

export default function Footer() {
  const handleReplayClick = () => {
    window.dispatchEvent(new Event("gcl:request-replay"));
  };

  return (
    <footer className="footer">
      <div className="container footer__inner">
        {/* D14 — the nav's own treatment: the bare canonical mark at its
            correct 480:520 aspect ratio (never a distorted 1:1 tile) at a
            legible ~22px, plus the wide-tracked wordmark text — replaces
            the old footer-lockup image, which read as an illegible grey
            square at 48px. The lockup image assets stay on disk, just
            unused here. */}
        <div className="footer__brand">
          <img
            className="footer__brand-mark"
            src="/img/gateway-g-480.webp"
            width={480}
            height={520}
            alt=""
            aria-hidden="true"
            loading="lazy"
          />
          <span className="footer__brand-word">{site.name}</span>
        </div>

        <div className="footer__legal">
          <strong>{footer.legalLine}</strong>
          <span>&copy; {footer.copyrightYear}</span>
        </div>

        <div className="footer__links">
          <button type="button" className="footer__link" onClick={handleReplayClick}>
            {arrival.replayLabel}
          </button>
          <a
            className="footer__link"
            href={footer.creditVectorLinkHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {footer.creditVectorLinkLabel}
          </a>
        </div>
      </div>
    </footer>
  );
}
