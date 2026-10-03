export const OBSERVER = `http://127.0.0.1:${process.env.E2E_OBSERVER_PORT ?? 7400}`;

/** An event for the observer; the suite goes on when the observer is not there */
export async function post(event: Record<string, unknown>): Promise<void> {
  await fetch(`${OBSERVER}/event`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event) }).catch(() => {});
}
