import { db } from './db';
import type { Issue } from '../types/issue';
import type { Space } from '../types/space';
import { saveToDiskNow } from '../services/localDiskSync';

export interface BackupData {
  version: string;
  exportedAt: string;
  spaces: Space[];
  issues: Issue[];
}

export async function exportBackup(): Promise<void> {
  // 1. Save latest state directly to local PC disk (data/spaces/*.json)
  await saveToDiskNow();

  // 2. Export and trigger browser download
  const spaces = await db.spaces.toArray();
  const issues = await db.issues.toArray();

  const backup: BackupData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    spaces,
    issues,
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `lira-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<{ spaces: number; issues: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const backup: BackupData = JSON.parse(text);

        if (!backup.spaces || !backup.issues) {
          throw new Error('Invalid backup file format');
        }

        // Clear existing data
        await db.spaces.clear();
        await db.issues.clear();

        // Re-import
        const spacesWithDates = backup.spaces.map((s) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        }));

        const issuesWithDates = backup.issues.map((i) => ({
          ...i,
          createdAt: new Date(i.createdAt),
          updatedAt: new Date(i.updatedAt),
          dueDate: i.dueDate ? new Date(i.dueDate) : undefined,
          startDate: i.startDate ? new Date(i.startDate) : undefined,
          resolvedAt: i.resolvedAt ? new Date(i.resolvedAt) : undefined,
        }));

        await db.spaces.bulkAdd(spacesWithDates);
        await db.issues.bulkAdd(issuesWithDates);

        // Immediately sync imported data to local PC disk (data/spaces/*.json)
        await saveToDiskNow();

        resolve({ spaces: backup.spaces.length, issues: backup.issues.length });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
