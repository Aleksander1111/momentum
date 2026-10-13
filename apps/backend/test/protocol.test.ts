import { describe, expect, it } from 'vitest';
import { kindOf, messageFileOf } from '../e2e/support/scripted.ts';
import { bookkeeping } from '../src/hooks.ts';
import { messageRequest, RUN_LINE, runLine, SAY, WORKING_DIR, workspaceLine } from '../src/protocol.ts';

// The end-to-end stand-in for the model reads what the harness writes: both sides use one protocol
describe('the protocol between the harness and what reads its runs', () => {
  const file = 'C:/Projects/momentum/.git/MOMENTUM_MSG';

  it('asks for the commit message where the stand-in finds it, as bookkeeping', () => {
    const request = messageRequest(file);
    expect(kindOf(request, false)).toBe('commit-message');
    expect(messageFileOf(request)).toBe(file);
    expect(bookkeeping(request)).toBe(true);
  });

  it('names every request the hooks make so the stand-in tells them apart', () => {
    expect(kindOf(`Before you finish, ${SAY.summarize} these artifacts into entities.`, false)).toBe('summarize');
    expect(kindOf(`Before you finish: ${SAY.guardRefusal}. Fix them.`, false)).toBe('guard');
    expect(kindOf(`${SAY.resume}. Continue where you left off.`, false)).toBe('resume');
    expect(kindOf('Which routes are there?', true)).toBe('prompt');
    expect(kindOf('And which one creates a book?', false)).toBe('message');
  });

  it('writes the run and workspace lines the stand-in reads the run from', () => {
    const run = { id: 'ab12cd34', automation: 'consistency-check', trigger: 'schedule' };
    expect(RUN_LINE.exec(`# Momentum run\n\n${runLine({ ...run, targetPath: null })}\n- Work only here.`)?.slice(1)).toEqual([
      'ab12cd34',
      'consistency-check',
      'schedule',
      undefined,
    ]);
    expect(RUN_LINE.exec(runLine({ ...run, targetPath: 'Product/Feature/search' }))?.[4]).toBe('Product/Feature/search');
    expect(WORKING_DIR.exec(workspaceLine({ name: 'my-app', path: 'C:/Projects/my app', main: 'main' }))?.[1]).toBe('C:/Projects/my app');
  });
});
