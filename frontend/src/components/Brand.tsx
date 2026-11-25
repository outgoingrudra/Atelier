export default function Brand() {
  return (
    <a href="/" className="brand" aria-label="Atelier home">
      <svg className="brand-symbol" viewBox="0 0 42 42" fill="none" aria-hidden="true">
        <path d="M7 29.5 20.5 6l13.7 23.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 24.5c7.2-3.1 14.2-3.1 21.5.1" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M34.8 32.5c-5.3 3.4-11.9 5-18.7 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="36" cy="8" r="2.3" fill="currentColor" />
      </svg>
      <span className="brand-type"><span className="brand-name">atelier<span>.</span></span><small>THE DRAWING ROOM</small></span>
    </a>
  );
}
