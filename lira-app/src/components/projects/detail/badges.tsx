import { PriorityLabel } from '../../common/Icons';
/** Small helpers that colour a status and show a priority. */
// Helper badge styles
export function getStatusBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case 'done':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'inprogress':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'todo':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'backlog':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function getPriorityBadge(priority: string) {
  switch (priority?.toLowerCase()) {
    case 'highest':
    case 'high':
    case 'medium':
    case 'low':
    case 'lowest':
      return <PriorityLabel priority={priority.toLowerCase()} />;
    default:
      return <span className="text-gray-500 capitalize">{priority}</span>;
  }
}
