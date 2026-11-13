import { describe, expect, it } from 'vitest';
import { generateDomainSubtasks } from './subtasks';

const titles = (ticket: string) => generateDomainSubtasks(ticket).map(s => s.title);

describe('generateDomainSubtasks', () => {
  it('always gives four open subtasks with their own ids', () => {
    for (const ticket of ['Containerize the API', 'Plan the kubernetes rollout', 'Fix typo', '']) {
      const subs = generateDomainSubtasks(ticket);
      expect(subs).toHaveLength(4);
      expect(subs.every(s => !s.completed && s.createdAt instanceof Date)).toBe(true);
      expect(new Set(subs.map(s => s.id)).size).toBe(4);
    }
  });

  it.each([
    ['Dockerize the service', 'multi-stage Dockerfile'],
    ['Move to a container runtime', 'multi-stage Dockerfile'],
    ['Deploy with Helm', 'Deployment manifest'],
    ['Set up the AKS cluster', 'Deployment manifest'],
    ['Build the CI/CD flow', 'workflow YAML'],
    ['Fix the Azure DevOps job', 'workflow YAML'],
    ['Prepare for the system design round', 'architectural principles'],
    ['Update my resume', 'architectural principles'],
    ['Study for the AWS exam', 'domain video modules'],
    ['Terraform associate', 'domain video modules'],
  ])('"%s" gets the matching breakdown', (ticket, firstWords) => {
    expect(titles(ticket)[0]).toContain(firstWords);
  });

  it('falls back to a general engineering breakdown', () => {
    expect(titles('Add a settings page')[0]).toContain('technical specification');
    expect(titles('Add a settings page')[2]).toContain('unit tests');
  });

  it('ignores letter case', () => {
    expect(titles('DOCKER BUILD')[0]).toBe(titles('docker build')[0]);
  });

  it('uses the first group that matches when several words appear', () => {
    // "docker" is checked before "pipeline"
    expect(titles('Docker image in the pipeline')[0]).toContain('Dockerfile');
  });
});
