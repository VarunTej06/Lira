import { Plus, Trash2, ListPlus, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '../../common/Button';
import type { FormFieldType } from './useFormsState';
import type { FormsState } from './useFormsState';

/** Build a new form. */
export function FormBuilder(s: FormsState) {
  const {  setActiveTab, formTitle, setFormTitle, formDesc, setFormDesc, fields, setFields, fieldName, setFieldName, fieldType, setFieldType, fieldRequired, setFieldRequired, fieldOptions, setFieldOptions, builderError, handleAddField, handleRemoveField, handleSaveForm } = s;
  return (
    <>
            <form onSubmit={handleSaveForm} className="space-y-5">
              {builderError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {builderError}
                </div>
              )}

              {/* Form Info */}
              <div className="space-y-3 bg-gray-50/70 p-4 rounded-xl border border-lira-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-lira-muted">Form Details</h4>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-semibold text-lira-text mb-1">
                      Form Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. User Feedback & Suggestions"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-lira-border rounded-lg bg-white focus:outline-none focus:border-lira-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-lira-text mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Instructions for submitter..."
                      value={formDesc}
                      onChange={e => setFormDesc(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-lira-border rounded-lg bg-white focus:outline-none focus:border-lira-blue"
                    />
                  </div>
                </div>
              </div>

              {/* Add Field Box */}
              <div className="space-y-3 bg-blue-50/40 p-4 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-lira-blue flex items-center gap-1.5">
                    <ListPlus className="w-4 h-4" /> Add Field
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-6 space-y-1">
                    <label className="block text-[11px] font-semibold text-lira-text">Field Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Account Number, Error Log"
                      value={fieldName}
                      onChange={e => setFieldName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddField(); } }}
                      className="w-full px-3 py-1.5 text-xs border border-lira-border rounded-lg bg-white focus:outline-none focus:border-lira-blue"
                    />
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="block text-[11px] font-semibold text-lira-text">Field Type</label>
                    <select
                      value={fieldType}
                      onChange={e => setFieldType(e.target.value as FormFieldType)}
                      className="w-full px-2.5 py-1.5 text-xs border border-lira-border rounded-lg bg-white focus:outline-none focus:border-lira-blue"
                    >
                      <option value="text">Single-line Text</option>
                      <option value="textarea">Multi-line Paragraph</option>
                      <option value="number">Number</option>
                      <option value="date">Date Picker</option>
                      <option value="select">Dropdown Select</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex items-center">
                    <button
                      type="button"
                      onClick={handleAddField}
                      className="w-full py-1.5 px-3 bg-lira-blue text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Field
                    </button>
                  </div>
                </div>

                {fieldType === 'select' && (
                  <div className="space-y-1 pt-1">
                    <label className="block text-[11px] font-semibold text-lira-text">
                      Options (comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="Option A, Option B, Option C"
                      value={fieldOptions}
                      onChange={e => setFieldOptions(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-lira-border rounded-lg bg-white"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-lira-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldRequired}
                      onChange={e => setFieldRequired(e.target.checked)}
                      className="rounded border-gray-300 text-lira-blue"
                    />
                    Required field
                  </label>
                </div>
              </div>

              {/* Current Fields List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-lira-muted">
                    Form Schema Fields ({fields.length})
                  </h4>
                  {fields.length > 0 && (
                    <span className="text-[11px] text-lira-muted">Fields will appear in this order</span>
                  )}
                </div>

                {fields.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-lira-border rounded-xl text-xs text-lira-muted">
                    No fields added yet. Use the tool above to add intake form fields.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fields.map((f, i) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-2.5 bg-gray-50 border border-lira-border rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-white border border-lira-border flex items-center justify-center font-bold text-[10px] text-lira-muted">
                            {i + 1}
                          </span>
                          <div>
                            <span className="font-semibold text-lira-text">{f.name}</span>
                            <span className="ml-2 text-[10px] uppercase font-mono px-1.5 py-0.5 bg-gray-200/70 rounded text-lira-muted">
                              {f.type}
                            </span>
                            {f.required && (
                              <span className="ml-1.5 text-[10px] text-red-600 font-bold">Required</span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveField(f.id)}
                          className="p-1 text-lira-muted hover:text-red-600 transition-colors cursor-pointer"
                          title="Remove field"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-2 pt-4 border-t border-lira-border">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => { setActiveTab('list'); setFields([]); }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Save Form
                </Button>
              </div>
            </form>
    </>
  );
}
