import type { AutomationName, ModelChoice, ModelSettings, Risk } from '@momentum/contract';

/** Estimates the risk of an implementation; a short call, it needs no stronger model */
export const ESTIMATOR = 'haiku';

/** The model of an automation as set, before any risk estimate */
export function setModel(models: ModelSettings, automation: AutomationName): ModelChoice {
  return models.mode === 'single' ? models.single : models.perAutomation[automation];
}

/** The model passed to Claude Code: an alias, or nothing to leave it to Claude Code's default */
export const sdkModel = (choice: ModelChoice): string | undefined => (choice === 'default' ? undefined : choice);

export function parseRisk(answer: string): Risk | null {
  const m = /\b(low|medium|high)\b/i.exec(answer);
  return m ? (m[1]!.toLowerCase() as Risk) : null;
}

interface Doc {
  path: string;
  title: string;
  card: string;
}

/** The question the estimator answers: the user's rules applied to the entity to implement and its plans */
export function riskQuestion(rules: string, target: Doc & { type: string }, plans: Doc[]): { system: string; prompt: string } {
  const system = `You estimate the risk of an implementation before it starts: how hard the implementation is. Apply only the rules below. Answer with exactly one word: low, medium or high.

# Rules

${rules}`;
  const prompt = [
    `# To implement: ${target.path} (${target.type})\n\n## ${target.title}\n\n${target.card}`,
    ...plans.map((p) => `# Plan: ${p.path}\n\n## ${p.title}\n\n${p.card}`),
  ].join('\n\n');
  return { system, prompt };
}
