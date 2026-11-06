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
      return <span className="inline-flex items-center gap-1 text-red-600 font-medium">🔴 Highest</span>;
    case 'high':
      return <span className="inline-flex items-center gap-1 text-orange-600 font-medium">🟠 High</span>;
    case 'medium':
      return <span className="inline-flex items-center gap-1 text-amber-600 font-medium">🟡 Medium</span>;
    case 'low':
      return <span className="inline-flex items-center gap-1 text-green-600 font-medium">🟢 Low</span>;
    case 'lowest':
      return <span className="inline-flex items-center gap-1 text-blue-400 font-medium">⚪ Lowest</span>;
    default:
      return <span className="text-gray-500 capitalize">{priority}</span>;
  }
}
