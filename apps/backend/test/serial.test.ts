import { describe, expect, it } from 'vitest';
import { Serial } from '../src/serial.ts';

const tick = () => new Promise((r) => setTimeout(r, 5));

describe('serial calls', () => {
  it('runs calls of one key in order, and of different keys side by side', async () => {
    const serial = new Serial();
    const log: string[] = [];
    const call = (key: string, name: string) =>
      serial.run(key, async () => {
        log.push(`${name} start`);
        await tick();
        log.push(`${name} end`);
        return name;
      });
    const results = await Promise.all([call('a', 'a1'), call('a', 'a2'), call('b', 'b1')]);
    expect(results).toEqual(['a1', 'a2', 'b1']);
    expect(log.indexOf('a1 end')).toBeLessThan(log.indexOf('a2 start'));
    expect(log.indexOf('b1 start')).toBeLessThan(log.indexOf('a1 end'));
  });

  it('goes on after a failed call and forgets a settled key', async () => {
    const serial = new Serial();
    const failed = serial.run('a', async () => {
      throw new Error('no');
    });
    const next = serial.run('a', async () => 'next');
    await expect(failed).rejects.toThrow('no');
    await expect(next).resolves.toBe('next');
    await tick();
    expect(serial.busy('a')).toBe(false);
  });
});
