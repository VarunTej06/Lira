import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, GripVertical, Settings2, X, ChevronsUpDown } from 'lucide-react';
import type { Dashboard, DashboardWidget, WidgetSize } from '../../utils/dashboards/types';
import { SIZE_LABEL, SIZE_ORDER } from '../../utils/dashboards/types';
import type { DataCtx } from '../../utils/dashboards/metrics';
import { metricIssues } from '../../utils/dashboards/metrics';
import { widgetData, widgetScope } from '../../utils/dashboards/data';
import { WidgetBody, type WidgetActions } from './Widgets';

/** 12-column grid. Small = a quarter of the width, Medium = half, Large = three quarters, Full = all. Phones stack everything. */
const SPAN: Record<WidgetSize, string> = {
  S: 'col-span-12 sm:col-span-6 lg:col-span-3',
  M: 'col-span-12 md:col-span-6',
  L: 'col-span-12 lg:col-span-9',
  XL: 'col-span-12',
};
const MIN_H: Record<1 | 2 | 3, string> = { 1: 'min-h-[132px]', 2: 'min-h-[290px]', 3: 'min-h-[430px]' };

interface Props {
  dashboard: Dashboard;
  ctx: DataCtx;
  editing?: boolean;
  onChangeWidgets?: (widgets: DashboardWidget[]) => void;
  onSettings?: (widget: DashboardWidget) => void;
  onDrill: WidgetActions['onDrill'];
  onOpenIssue: WidgetActions['onOpenIssue'];
}

const Card: React.FC<{
  widget: DashboardWidget; dashboard: Dashboard; ctx: DataCtx; editing: boolean; index: number; count: number;
  dragging: boolean; over: boolean;
  onDragStart: () => void; onDragEnd: () => void; onDragOver: () => void; onDropHere: () => void;
  onMove: (dir: -1 | 1) => void; onSize: (s: WidgetSize) => void; onHeight: () => void; onRemove: () => void; onSettings: () => void;
  actions: WidgetActions;
}> = ({ widget, dashboard, ctx, editing, index, count, dragging, over, onDragStart, onDragEnd, onDragOver, onDropHere, onMove, onSize, onHeight, onRemove, onSettings, actions }) => {
  const data = useMemo(() => widgetData(dashboard, widget, ctx), [dashboard, widget, ctx]);
  const isStat = widget.type === 'stat';
  return (
    <section
      data-testid="widget" data-widget-type={widget.type} data-widget-id={widget.id}
      draggable={editing}
      onDragStart={e => { if (!editing) return; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', widget.id); onDragStart(); }}
      onDragEnd={onDragEnd}
      onDragOver={e => { if (!editing) return; e.preventDefault(); onDragOver(); }}
      onDrop={e => { if (!editing) return; e.preventDefault(); onDropHere(); }}
      aria-label={widget.title}
      className={`${SPAN[widget.size]} ${MIN_H[widget.height]} relative flex flex-col rounded-xl border bg-white shadow-xs transition-all ${
        editing ? 'border-dashed border-lira-blue/50' : 'border-lira-border'
      } ${dragging ? 'opacity-40' : ''} ${over ? 'ring-2 ring-lira-blue' : ''}`}
    >
      <header className={`flex items-center gap-1.5 px-4 ${isStat ? 'pt-3' : 'pt-3 pb-1'}`}>
        {editing && <GripVertical className="w-4 h-4 text-lira-muted cursor-grab flex-shrink-0" aria-label="Drag to move" />}
        <h3 className="flex-1 min-w-0 text-xs font-semibold uppercase tracking-wide text-lira-muted truncate">{widget.title}</h3>
        {widget.filters && <span className="text-4xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-lira-blue flex-shrink-0" title="This widget has its own filters">own filters</span>}
      </header>

      {editing && (
        <div className="flex flex-wrap items-center gap-1 px-3 pb-1 no-print" data-testid="widget-tools">
          <button type="button" aria-label="Move earlier" disabled={index === 0} onClick={() => onMove(-1)} className="p-1 rounded hover:bg-gray-100 text-lira-muted disabled:opacity-30 cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" /></button>
          <button type="button" aria-label="Move later" disabled={index === count - 1} onClick={() => onMove(1)} className="p-1 rounded hover:bg-gray-100 text-lira-muted disabled:opacity-30 cursor-pointer"><ArrowRight className="w-3.5 h-3.5" /></button>
          <span className="w-px h-4 bg-lira-border mx-0.5" />
          {SIZE_ORDER.map(s => (
            <button key={s} type="button" aria-pressed={widget.size === s} title={SIZE_LABEL[s]} aria-label={`Width: ${SIZE_LABEL[s]}`} onClick={() => onSize(s)}
              className={`px-1.5 py-0.5 text-3xs font-semibold rounded cursor-pointer ${widget.size === s ? 'bg-lira-blue text-white' : 'text-lira-muted hover:bg-gray-100'}`}>{s}</button>
          ))}
          <button type="button" title="Change height" aria-label="Change height" onClick={onHeight} className="p-1 rounded hover:bg-gray-100 text-lira-muted cursor-pointer"><ChevronsUpDown className="w-3.5 h-3.5" /></button>
          <span className="flex-1" />
          <button type="button" aria-label="Widget settings" onClick={onSettings} className="p-1 rounded hover:bg-gray-100 text-lira-muted hover:text-lira-blue cursor-pointer" data-testid="widget-settings"><Settings2 className="w-3.5 h-3.5" /></button>
          <button type="button" aria-label="Remove widget" onClick={onRemove} className="p-1 rounded hover:bg-red-50 text-lira-muted hover:text-red-600 cursor-pointer" data-testid="widget-remove"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="flex-1 min-h-0 px-4 pb-3 pt-1 overflow-y-auto">
        <WidgetBody widget={widget} data={data} actions={actions} />
      </div>
    </section>
  );
};

/** The widgets of a dashboard. In edit mode they can be dragged, resized, set up and removed. */
export const DashboardGrid: React.FC<Props> = ({ dashboard, ctx, editing = false, onChangeWidgets, onSettings, onDrill, onOpenIssue }) => {
  const [dragId, setDragIdState] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null); // read by drop, so it works even before React re-renders
  const setDragId = (id: string | null) => { dragRef.current = id; setDragIdState(id); };
  const [overId, setOverId] = useState<string | null>(null);
  const widgets = dashboard.widgets;
  const set = (next: DashboardWidget[]) => onChangeWidgets?.(next);

  const actions: WidgetActions = useMemo(() => ({
    onDrill, onOpenIssue,
    statIssues: (w: DashboardWidget) => metricIssues(w.config.metric ?? 'open', widgetScope(dashboard, w, ctx), ctx.now),
  }), [onDrill, onOpenIssue, dashboard, ctx]);

  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= widgets.length) return;
    const next = [...widgets];
    const [w] = next.splice(from, 1);
    next.splice(to, 0, w);
    set(next);
  };
  const drop = (targetId: string) => {
    const from = widgets.findIndex(w => w.id === dragRef.current);
    const to = widgets.findIndex(w => w.id === targetId);
    setDragId(null); setOverId(null);
    move(from, to);
  };

  if (widgets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-lira-border bg-white/60 py-16 text-center text-sm text-lira-muted" data-testid="empty-dashboard">
        This dashboard has no widgets yet. Choose <strong className="text-lira-text">Customise</strong>, then <strong className="text-lira-text">Add widget</strong>.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4" data-testid="dashboard-grid">
      {widgets.map((w, i) => (
        <Card
          key={w.id} widget={w} dashboard={dashboard} ctx={ctx} editing={editing} index={i} count={widgets.length}
          dragging={dragId === w.id} over={!!dragId && overId === w.id && dragId !== w.id}
          onDragStart={() => setDragId(w.id)} onDragEnd={() => { setDragId(null); setOverId(null); }}
          onDragOver={() => setOverId(w.id)} onDropHere={() => drop(w.id)}
          onMove={dir => move(i, i + dir)}
          onSize={size => set(widgets.map(x => (x.id === w.id ? { ...x, size } : x)))}
          onHeight={() => set(widgets.map(x => (x.id === w.id ? { ...x, height: (x.height % 3 + 1) as 1 | 2 | 3 } : x)))}
          onRemove={() => set(widgets.filter(x => x.id !== w.id))}
          onSettings={() => onSettings?.(w)}
          actions={actions}
        />
      ))}
    </div>
  );
};
