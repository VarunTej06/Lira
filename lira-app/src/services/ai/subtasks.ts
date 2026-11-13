import { v4 as uuidv4 } from 'uuid';

type Subtask = { id: string; title: string; completed: boolean; createdAt: Date };

/** Keywords in a ticket title, and the subtasks they suggest. The first group that matches wins. */
const TEMPLATES: { words: string[]; titles: string[] }[] = [
  {
    words: ['docker', 'container'],
    titles: [
      'Write multi-stage Dockerfile (Alpine runtime + caching)',
      'Configure .dockerignore to exclude node_modules & temp files',
      'Build Docker image and verify image size under 40MB',
      'Test container locally with healthcheck endpoint',
    ],
  },
  {
    words: ['kubernetes', 'aks', 'helm'],
    titles: [
      'Create Deployment manifest with resource requests & limits',
      'Configure ClusterIP Service and Ingress routing rules',
      'Set up Horizontal Pod Autoscaler (HPA) CPU/memory threshold',
      'Package Helm chart values.yaml and test with dry-run',
    ],
  },
  {
    words: ['ci/cd', 'pipeline', 'azure devops', 'action'],
    titles: [
      'Define workflow YAML triggers on main push and pull requests',
      'Add dependency cache and automated Vitest execution step',
      'Configure service principal / secret tokens for registry push',
      'Add automated container push to container registry (ACR)',
    ],
  },
  {
    words: ['interview', 'resume', 'system design', 'leetcode'],
    titles: [
      'Review core architectural principles and trade-offs',
      'Practice timed mock problem solving and edge cases',
      'Document key talking points and STAR methodology stories',
      'Refine resume bullet points with quantified engineering metrics',
    ],
  },
  {
    words: ['certification', 'exam', 'aws', 'terraform', 'kcna'],
    titles: [
      'Complete domain video modules and study notes',
      'Conduct hands-on terminal labs and architecture drills',
      'Take timed practice exam and analyze question review notes',
      'Schedule official exam appointment and review cheat sheet',
    ],
  },
];

const DEFAULT_TITLES = [
  'Define technical specification & acceptance criteria',
  'Implement core functionality and data models',
  'Write unit tests and verify edge cases',
  'Review changes and verify on Kanban board',
];

/**
 * Domain-specific subtask generator for intelligent task breakdowns
 */
export function generateDomainSubtasks(title: string): Subtask[] {
  const t = title.toLowerCase();
  const titles = TEMPLATES.find(tpl => tpl.words.some(w => t.includes(w)))?.titles ?? DEFAULT_TITLES;
  const now = new Date();
  return titles.map(text => ({ id: uuidv4(), title: text, completed: false, createdAt: now }));
}
