import { useEffect } from 'react';

/**
 * Web: the app fills the part of the screen the keyboard leaves free, so the field being typed in stays in view.
 * The viewport's `interactive-widget=resizes-content` does this where the browser supports it; this covers the rest.
 */
export function useVisibleViewport(): void {
  useEffect(() => {
    const view = window.visualViewport;
    const root = document.getElementById('root');
    if (!view || !root) return;
    const fit = () => {
      // Scaled back by the zoom, so pinching the page does not shrink it
      root.style.height = `${view.height * view.scale}px`;
      if (view.scale === 1) window.scrollTo(0, 0);
    };
    fit();
    view.addEventListener('resize', fit);
    return () => {
      view.removeEventListener('resize', fit);
      root.style.height = '';
    };
  }, []);
}
