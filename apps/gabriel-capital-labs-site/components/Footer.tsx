"use client";

import { footer, arrival, site } from "@/content/site";

export default function Footer() {
  const handleReplayClick = () => {
    window.dispatchEvent(new Event("gcl:request-replay"));
  };

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
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
