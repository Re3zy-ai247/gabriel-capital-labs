"use client";

import { footer, arrival } from "@/content/site";

export default function Footer() {
  const handleReplayClick = () => {
    window.dispatchEvent(new Event("gcl:request-replay"));
  };

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <picture>
          <source
            type="image/webp"
            srcSet="/img/footer-lockup-96.webp 1x, /img/footer-lockup-192.webp 2x"
          />
          <img
            className="footer__lockup"
            src="/img/footer-lockup-96.png"
            srcSet="/img/footer-lockup-96.png 1x, /img/footer-lockup-192.png 2x"
            width={96}
            height={96}
            alt=""
            aria-hidden="true"
            loading="lazy"
          />
        </picture>

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
