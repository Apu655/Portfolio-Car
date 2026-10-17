import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrolling; the app only uses it for convenience, so a no-op keeps test output clean.
window.scrollTo = () => {};
