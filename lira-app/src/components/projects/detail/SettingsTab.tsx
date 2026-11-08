import { Plus, Check, Trash2, Save, Workflow, Sliders } from 'lucide-react';
import { Button } from '../../common/Button';
import type { DetailCtx } from './types';

export function SettingsTab(ctx: DetailCtx) {
  const { project, space, workflowStates, customFields, settingsSavedToast, showAddFieldModal, setShowAddFieldModal, newFieldName, setNewFieldName, newFieldType, setNewFieldType, newFieldDesc, setNewFieldDesc, handleRenameState, handleAddCustomField, handleRemoveCustomField, handleSaveSettings, handleDeleteProject } = ctx;
  return (
    <>
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-lira-text">Project Settings</h2>
                <p className="text-xs text-lira-muted mt-0.5">Configure workflow states, custom fields, and administrative schema.</p>
              </div>
              {settingsSavedToast && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-fade-in font-medium">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>✓ Saved</span>
                </div>
              )}
            </div>

            {/* 1. Workflow States (with ability to rename) */}
            <div className="bg-white rounded-xl border border-lira-border shadow-xs p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-lira-border pb-3">
                <Workflow className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-lira-text">Workflow States</h3>
                  <p className="text-xs text-lira-muted mt-0.5">
                    Customize the display labels for each issue lifecycle transition state.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {workflowStates.map(state => (
                  <div key={state.id} className="p-3.5 bg-gray-50/70 border border-lira-border rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${state.color}`} />
                        <span className="font-mono text-xs font-semibold text-lira-muted uppercase">{state.key}</span>
                      </div>
                      <span className="text-[10px] font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                        Category: {state.category}
                      </span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-lira-muted mb-1">State Display Label</label>
                      <input
                        type="text"
                        value={state.label}
                        onChange={e => handleRenameState(state.id, e.target.value)}
                        className="w-full text-xs font-semibold bg-white border border-lira-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-lira-blue"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Custom Fields */}
            <div className="bg-white rounded-xl border border-lira-border shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-lira-border pb-3">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-5 h-5 text-purple-600" />
                  <div>
                    <h3 className="text-sm font-bold text-lira-text">Custom Fields</h3>
                    <p className="text-xs text-lira-muted mt-0.5">
                      Configured attribute schema for issue tracking and analytics.
                    </p>
                  </div>
                </div>

                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setShowAddFieldModal(true)}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add Custom Field
                </Button>
              </div>

              <div className="divide-y divide-gray-100 border border-lira-border rounded-xl overflow-hidden">
                {customFields.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-3.5 hover:bg-gray-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-lira-text">{f.name}</span>
                        <span className="text-[10px] font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                          {f.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-lira-muted mt-0.5">{f.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCustomField(f.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Remove custom field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Settings Button */}
            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={handleSaveSettings}
                icon={<Save className="w-4 h-4" />}
              >
                Save Project Settings
              </Button>
            </div>

            {/* 3. Danger Zone */}
            <div className="bg-white rounded-xl border border-red-200 shadow-xs p-6 space-y-3">
              <h3 className="text-sm font-bold text-red-600 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Danger Zone
              </h3>
              <p className="text-xs text-lira-muted">
                Deleting this project unlinks it from the project directory. The underlying Space ({space?.name || project.key}) and its tickets will remain safely preserved in the database.
              </p>
              <button
                type="button"
                onClick={handleDeleteProject}
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Delete Project
              </button>
            </div>
          </div>

      {/* Add Custom Field Modal */}
      {showAddFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-lira-text">Add Custom Field to Project</h3>
            <form onSubmit={handleAddCustomField} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-lira-muted uppercase tracking-wider mb-1">
                  Field Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newFieldName}
                  onChange={e => setNewFieldName(e.target.value)}
                  placeholder="e.g. Story Points, Release Version"
                  className="w-full text-sm border border-lira-border rounded-lg px-3 py-2 focus:outline-none focus:border-lira-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-lira-muted uppercase tracking-wider mb-1">
                  Field Type
                </label>
                <select
                  value={newFieldType}
                  onChange={e => setNewFieldType(e.target.value)}
                  className="w-full text-sm border border-lira-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-lira-blue"
                >
                  <option value="Text">Single-line Text</option>
                  <option value="Number">Numeric Value</option>
                  <option value="Date">Date Picker</option>
                  <option value="Select">Dropdown Select</option>
                  <option value="User">User Picker</option>
                  <option value="URL">Web URL / Hyperlink</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-lira-muted uppercase tracking-wider mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newFieldDesc}
                  onChange={e => setNewFieldDesc(e.target.value)}
                  placeholder="Brief description of field usage"
                  className="w-full text-sm border border-lira-border rounded-lg px-3 py-2 focus:outline-none focus:border-lira-blue"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-lira-border">
                <Button type="button" variant="ghost" onClick={() => setShowAddFieldModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Add Field
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
