import { v4 as uuidv4 } from 'uuid';

/**
 * Domain-specific subtask generator for intelligent task breakdowns
 */
export function generateDomainSubtasks(title: string): { id: string; title: string; completed: boolean; createdAt: Date }[] {
  const t = title.toLowerCase();
  const now = new Date();

  if (t.includes('docker') || t.includes('container')) {
    return [
      { id: uuidv4(), title: 'Write multi-stage Dockerfile (Alpine runtime + caching)', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Configure .dockerignore to exclude node_modules & temp files', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Build Docker image and verify image size under 40MB', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Test container locally with healthcheck endpoint', completed: false, createdAt: now },
    ];
  }

  if (t.includes('kubernetes') || t.includes('aks') || t.includes('helm')) {
    return [
      { id: uuidv4(), title: 'Create Deployment manifest with resource requests & limits', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Configure ClusterIP Service and Ingress routing rules', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Set up Horizontal Pod Autoscaler (HPA) CPU/memory threshold', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Package Helm chart values.yaml and test with dry-run', completed: false, createdAt: now },
    ];
  }

  if (t.includes('ci/cd') || t.includes('pipeline') || t.includes('azure devops') || t.includes('action')) {
    return [
      { id: uuidv4(), title: 'Define workflow YAML triggers on main push and pull requests', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Add dependency cache and automated Vitest execution step', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Configure service principal / secret tokens for registry push', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Add automated container push to container registry (ACR)', completed: false, createdAt: now },
    ];
  }

  if (t.includes('interview') || t.includes('resume') || t.includes('system design') || t.includes('leetcode')) {
    return [
      { id: uuidv4(), title: 'Review core architectural principles and trade-offs', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Practice timed mock problem solving and edge cases', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Document key talking points and STAR methodology stories', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Refine resume bullet points with quantified engineering metrics', completed: false, createdAt: now },
    ];
  }

  if (t.includes('certification') || t.includes('exam') || t.includes('aws') || t.includes('terraform') || t.includes('kcna')) {
    return [
      { id: uuidv4(), title: 'Complete domain video modules and study notes', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Conduct hands-on terminal labs and architecture drills', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Take timed practice exam and analyze question review notes', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Schedule official exam appointment and review cheat sheet', completed: false, createdAt: now },
    ];
  }

  // Default smart engineering breakdown
  return [
    { id: uuidv4(), title: 'Define technical specification & acceptance criteria', completed: false, createdAt: now },
    { id: uuidv4(), title: 'Implement core functionality and data models', completed: false, createdAt: now },
    { id: uuidv4(), title: 'Write unit tests and verify edge cases', completed: false, createdAt: now },
    { id: uuidv4(), title: 'Review changes and verify on Kanban board', completed: false, createdAt: now },
  ];
}
