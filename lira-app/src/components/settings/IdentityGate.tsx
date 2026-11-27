import type { ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Skeleton } from '../common/Skeleton';
import type { TeamsData } from '../teams/useTeamsData';

export interface SettingsContext { org: string; data: TeamsData; reload: () => void }
export type ReadyData = Extract<TeamsData, { state: 'ready' }> & { org: string; reload: () => void };

/** The pages that manage people and access: they wait for the server's answer and show its refusal instead of an empty page. */
export function IdentityGate({ children }: { children: (ready: ReadyData) => ReactNode }) {
  const { org, data, reload } = useOutletContext<SettingsContext>();
  if (data.state === 'loading') return <div role="status" aria-label="Loading people and teams" className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  if (data.state === 'denied') return <p role="alert" className="text-ui">You do not have access to manage people and teams here. Ask the owner of this organisation.</p>;
  if (data.state === 'error') return <p role="alert" className="text-ui text-red-600">{data.message} <button type="button" onClick={reload} className="underline">Try again</button></p>;
  return <>{children({ ...data, org, reload })}</>;
}
