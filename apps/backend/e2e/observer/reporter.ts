import type { FullConfig, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import { post } from './post.ts';

const idOf = (test: TestCase) => test.annotations.find((a) => a.type === 'scenario')?.description;

/** Hands the observer what the runner sees: the scenarios chosen, each one starting and ending, and each of its steps */
export default class ObserverReporter implements Reporter {
  onBegin(_config: FullConfig, suite: Suite): void {
    post({ type: 'begin', ids: suite.allTests().map(idOf).filter(Boolean) });
  }

  onTestBegin(test: TestCase): void {
    const id = idOf(test);
    if (id) post({ type: 'test', id, status: 'running' });
  }

  onStepBegin(test: TestCase, _result: TestResult, step: TestStep): void {
    const id = idOf(test);
    if (id && step.category === 'test.step') post({ type: 'step', id, title: step.title, status: 'running' });
  }

  onStepEnd(test: TestCase, _result: TestResult, step: TestStep): void {
    const id = idOf(test);
    if (id && step.category === 'test.step') post({ type: 'step', id, title: step.title, status: step.error ? 'failed' : 'passed' });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const id = idOf(test);
    if (!id) return;
    const status = result.status === 'passed' ? 'passed' : result.status === 'skipped' ? 'skipped' : 'failed';
    const reason =
      result.status === 'skipped'
        ? test.annotations.find((a) => a.type === 'skip')?.description
        : result.error?.message?.split('\n')[0];
    post({ type: 'test', id, status, reason });
  }

  async onEnd(): Promise<void> {
    await post({ type: 'end' });
  }
}
