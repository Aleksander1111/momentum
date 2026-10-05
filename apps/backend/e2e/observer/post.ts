export const OBSERVER = `http://127.0.0.1:${process.env.E2E_OBSERVER_PORT ?? 7400}`;

/**
 * An event for the observer; the suite goes on when the observer is not there. No connection is kept open: Playwright
 * exiting with one idle crashes Node on Windows.
 */
export async function post(event: Record<string, unknown>): Promise<void> {
  await fetch(`${OBSERVER}/event`, { method: 'POST', headers: { 'content-type': 'application/json', connection: 'close' }, body: JSON.stringify(event) }).catch(() => {});
}
