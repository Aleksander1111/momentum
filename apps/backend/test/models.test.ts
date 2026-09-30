import type { ModelSettings } from '@momentum/contract';
import { describe, expect, it } from 'vitest';
import { parseRisk, riskQuestion, sdkModel, setModel } from '../src/models.ts';

const models = (mode: ModelSettings['mode']): ModelSettings =>
  ({
    mode,
    single: 'sonnet',
    perAutomation: { implementation: 'opus', summarization: 'haiku' },
    risk: { low: 'haiku', medium: 'sonnet', high: 'opus' },
  }) as ModelSettings;

describe('models', () => {
  it('takes the one model, or the automation’s own', () => {
    expect(setModel(models('single'), 'summarization')).toBe('sonnet');
    expect(setModel(models('per_automation'), 'summarization')).toBe('haiku');
    expect(setModel(models('risk'), 'implementation')).toBe('opus');
  });

  it('leaves Default to Claude Code', () => {
    expect(sdkModel('default')).toBeUndefined();
    expect(sdkModel('fable')).toBe('fable');
  });

  it('reads the risk from the answer', () => {
    expect(parseRisk('High')).toBe('high');
    expect(parseRisk('medium.')).toBe('medium');
    expect(parseRisk('unsure')).toBeNull();
  });

  it('asks with the rules, the target and its plans', () => {
    const q = riskQuestion('Migrations are high.', { path: 'Data/Migration/x', type: 'Data/Migration', title: 'X', card: 'Add a column' }, [
      { path: 'Harness/Plan/x', title: 'Plan X', card: '1. Write it' },
    ]);
    expect(q.system).toContain('Migrations are high.');
    expect(q.prompt).toContain('Data/Migration/x');
    expect(q.prompt).toContain('1. Write it');
  });
});
