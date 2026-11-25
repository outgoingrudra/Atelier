import Link from "next/link";
import Brand from "@/components/Brand";

export default function NotFound() {
  return (
    <main className="home-shell">
      <header className="site-header">
        <Brand />
        <span className="header-note">
          <i aria-hidden="true" /> PAGE NOT FOUND
        </span>
      </header>

      <section className="not-found-layout" aria-labelledby="not-found-title">
        <div className="not-found-copy">
          <p className="eyebrow">
            <span>404 /</span> BLANK CANVAS
          </p>
          <h1 id="not-found-title">
            Nothing sketched
            <br />
            <em>here yet.</em>
          </h1>
          <p className="hero-description">
            The page or room you&apos;re looking for doesn&apos;t exist, or the studio closed
            after everyone left.
          </p>
          <div className="not-found-actions">
            <Link href="/" className="primary-button">
              <span>BACK TO THE STUDIO</span>
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>

        <div className="artwork not-found-plate" aria-hidden="true">
          <div className="artwork-header">
            <span>ERROR 404</span>
            <span>MISSING FRAME ✳</span>
          </div>
          <svg viewBox="0 0 460 280" fill="none">
            <rect x="24" y="20" width="412" height="240" stroke="#36302a" strokeWidth="1" />
            <path
              d="M110 88l240 104M350 88L110 192"
              stroke="#46413a"
              strokeWidth="2"
              strokeDasharray="6 8"
              strokeLinecap="round"
            />
            <path
              d="M148 164c34-54 88-74 142-46 28 15 44 45 24 68-22 24-74 10-96-14"
              stroke="#D68B5B"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="148" cy="164" r="6" fill="#E8DFD1" />
            <path
              d="m366 56 5-14 5 14 14 5-14 5-5 14-5-14-14-5 14-5Z"
              fill="#C57649"
            />
          </svg>
          <div className="artwork-footer">
            <span>START A NEW ROOM FROM THE ENTRANCE.</span>
            <span>ATELIER</span>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <span>ATELIER © 2026</span>
        <span>MADE FOR PLAYING TOGETHER</span>
      </footer>
    </main>
  );
}
