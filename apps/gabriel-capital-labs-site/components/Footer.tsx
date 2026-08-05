"use client";

import { footer, arrival } from "@/content/site";

export default function Footer() {
  const year = new Date().getFullYear();

  const handleReplayClick = () => {
    window.dispatchEvent(new Event("gcl:request-replay"));
  };

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <img
          className="footer__lockup"
          src="/footer-lockup.png"
          width={1000}
          height={1000}
          alt=""
          aria-hidden="true"
          loading="lazy"
        />

        <div className="footer__legal">
          <strong>{footer.legalLine}</strong>
          <span>&copy; {year}</span>
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
