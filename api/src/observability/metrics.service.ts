import { Injectable } from '@nestjs/common';

/** Counters for what matters: requests, sign-ups, sign-ins, locks, readiness. Served as plain text at /metrics, which the public site never forwards. */
@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();

  inc(name: string, labels: Record<string, string | number> = {}): void {
    const key = `${name}${Object.keys(labels).length ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` : ''}`;
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  render(): string {
    return [...this.counters.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k} ${v}`).join('\n') + '\n';
  }
}
