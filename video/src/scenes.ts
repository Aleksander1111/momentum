/** The video's scenario: the deck's slides in order (docs/slides), each with its caption */
export interface Scene {
  slide: string;
  title: string;
  caption: string;
}

export const SCENES: Scene[] = [
  { slide: 'slide-1.png', title: 'Harness & Products', caption: 'One entry point between you and every project, in three layers: attention, understanding, implementation.' },
  { slide: 'slide-2.png', title: 'Mobile App', caption: 'Everything that needs you, in one ranked feed. Swipe right to approve, left to send back.' },
  { slide: 'slide-3.png', title: 'How everything works together', caption: 'One loop per project: work is done, summarized, validated and landed on the main line.' },
  { slide: 'slide-4.png', title: 'Entities', caption: 'A project is read as cards, not files, each linked to the rest of its knowledge graph.' },
  { slide: 'slide-5.png', title: 'Entity types', caption: 'Every card has a type, with its own colour and glyph wherever the app shows it.' },
  { slide: 'slide-6.png', title: 'Entity states', caption: 'Approval verifies. Any rewrite brings the card back to you.' },
  { slide: 'slide-7.png', title: 'Automations', caption: 'Twelve automations around the knowledge graph: on a schedule, on events, or when you ask.' },
  { slide: 'slide-8.png', title: 'Triggers', caption: 'Loops pause while the feed is full: nothing queues beyond what you can review.' },
  { slide: 'slide-9.png', title: 'Automation management', caption: 'It improves from patterns seen at least three times, and you review every change.' },
  { slide: 'slide-10.png', title: 'Agent tools', caption: 'Every write is checked the moment it is made.' },
  { slide: 'slide-11.png', title: 'Summarization', caption: 'Work arrives whole: whatever changed becomes cards you can read.' },
  { slide: 'slide-12.png', title: 'Graph completeness', caption: 'Completeness is measured on the main line, never guessed.' },
  { slide: 'slide-13.png', title: 'Consistency guard', caption: 'Every change is validated before it lands, as one commit.' },
  { slide: 'slide-14.png', title: 'Issue types', caption: 'Contradictions and gaps come up as issues, by severity.' },
  { slide: 'slide-15.png', title: 'Issue resolution', caption: 'Each issue comes with options. One swipe resolves it.' },
  { slide: 'slide-16.png', title: 'Git', caption: 'One straight line: a commit per run, no branches, no merges.' },
  { slide: 'slide-17.png', title: 'User actions', caption: 'Approve, send back or chat: only what you approve counts.' },
  { slide: 'slide-18.png', title: 'Settings', caption: 'Tuned to how you work. Self-hosted, and yours.' },
];

export const FPS = 30;
/** How long each slide stays, and how long two slides cross-fade */
export const SCENE_FRAMES = 10.5 * FPS;
export const FADE_FRAMES = 0.5 * FPS;
export const TOTAL_FRAMES = SCENES.length * SCENE_FRAMES - (SCENES.length - 1) * FADE_FRAMES;
