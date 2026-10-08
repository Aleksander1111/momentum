import { describe, expect, it } from 'vitest';
import { toolDetail, toolName } from '../src/activity.ts';
import { calledInParallel, parseRating, ratingQuestion, retrieves, type RetrievalCall } from '../src/retrieval.ts';

const call = (name: string, response: string, result: string | null = 'found', error = false): RetrievalCall => ({
  name,
  response,
  input: { query: 'routes' },
  detail: 'routes',
  result,
  error,
});

describe('a run step as the chat shows it', () => {
  it('names an MCP tool by server and tool, and Claude Code tools as they are', () => {
    expect(toolName('mcp__momentum-kb__search')).toBe('momentum-kb · search');
    expect(toolName('Grep')).toBe('Grep');
  });

  it('says in a line what the tool was called on', () => {
    expect(toolDetail('Read', { file_path: 'src/server.js' })).toBe('src/server.js');
    expect(toolDetail('Grep', { pattern: 'books', path: 'src' })).toBe('books in src');
    expect(toolDetail('Bash', { command: 'git log -5', description: 'Show recent commits' })).toBe('Show recent commits');
    expect(toolDetail('Task', { subagent_type: 'momentum-summarization', description: 'Summarize', prompt: 'long' })).toBe('momentum-summarization: Summarize');
    expect(toolDetail('mcp__momentum-kb__search', { query: 'books\napi', limit: 5 })).toBe('books api');
    expect(toolDetail('Write', { file_path: 'a.md', content: 'x'.repeat(10_000) })).toBe('a.md');
    expect(toolDetail('mcp__other__lookup', { term: 'x'.repeat(400) }).length).toBeLessThanOrEqual(160);
  });
});

describe('rating a turn of retrieval', () => {
  it('counts every call but writes and the harness reports as retrieval', () => {
    expect(retrieves('mcp__momentum-kb__search')).toBe(true);
    expect(retrieves('Grep')).toBe(true);
    expect(retrieves('Write')).toBe(false);
    expect(retrieves('mcp__momentum-kb__write')).toBe(false);
    expect(retrieves('mcp__momentum-run__report_interview')).toBe(false);
  });

  it('sees tools called side by side only when one response called two of them', () => {
    expect(calledInParallel([call('Grep', 'a'), call('Grep', 'a'), call('Glob', 'b')])).toBe(false);
    expect(calledInParallel([call('Grep', 'a'), call('mcp__momentum-kb__search', 'a')])).toBe(true);
  });

  it('hands the rater each call with the start of its result', () => {
    const { prompt } = ratingQuestion('Which routes?', 'GET /books.', [call('Grep', 'a', 'x'.repeat(3000))]);
    expect(prompt).toContain('## Call 1: Grep');
    expect(prompt).toContain('first 1500 of 3000 characters');
  });

  it('rates each tool against the best one, precision from the useful calls and the score from both', () => {
    const calls = [call('mcp__momentum-kb__search', 'a'), call('Grep', 'a'), call('Grep', 'b'), call('Glob', 'b', 'boom', true)];
    const answer = `Here: {"calls": [{"n": 1, "relevance": 5}, {"n": 2, "relevance": 3}, {"n": 3, "relevance": 1}, {"n": 4, "relevance": 0}],
      "coverage": 0.8, "tools": {"momentum-kb · search": "the API card"}, "summary": "The search found the routes."}`;
    const r = parseRating(answer, calls)!;
    expect(r.tools.map((t) => [t.tool, t.calls, t.relevance, t.relative])).toEqual([
      ['momentum-kb · search', 1, 5, 1],
      ['Grep', 2, 2, 0.4],
      ['Glob', 1, 0, 0],
    ]);
    expect(r.tools[0]!.note).toBe('the API card');
    expect(r.precision).toBe(0.5);
    expect(r.coverage).toBe(0.8);
    expect(r.score).toBe(0.65);
    expect(r.parallel).toBe(true);
  });

  it('holds no rating when the rater gave none', () => {
    expect(parseRating('I cannot tell.', [call('Grep', 'a')])).toBeNull();
    expect(parseRating('{"calls": [], "coverage": 1}', [call('Grep', 'a')])).toBeNull();
  });
});
