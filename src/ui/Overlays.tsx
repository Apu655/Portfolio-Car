import { usePortfolio } from '../state/store';

/** Explains why the quick view opened instead of 3D, or why 3D is unavailable. */
export function NoticeBanner() {
  const notice = usePortfolio((s) => s.notice);
  const dismiss = usePortfolio((s) => s.dismissNotice);
  if (!notice) return null;
  return (
    <div className="notice" role="status">
      <p>{notice}</p>
      <button type="button" className="icon-button" aria-label="Dismiss notice" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}

/** Full-screen fade used while switching between the 3D world and the quick view. */
export function ViewTransition() {
  const transition = usePortfolio((s) => s.transition);
  return <div className={`view-fade is-${transition}`} aria-hidden="true" />;
}

export function WorldLoading() {
  return (
    <div className="world-loading" role="status">
      <span className="spinner" aria-hidden="true" />
      Loading the 3D world…
    </div>
  );
}
