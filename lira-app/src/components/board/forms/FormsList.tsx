import { FileText, Plus, Trash2, Eye, ChevronRight } from 'lucide-react';
import { Button } from '../../common/Button';
import type {  } from '../../../types/space';
import type { FormsState } from './useFormsState';

/** The saved forms. */
export function FormsList(s: FormsState) {
  const { space, forms, setActiveTab, setPreviewForm,  handleDeleteForm } = s;
  return (
    <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-jira-text">Space Intake Forms</h3>
                  <p className="text-xs text-jira-muted">
                    Custom forms for stakeholders and team members to submit tasks into {space?.name || 'this space'}.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => setActiveTab('builder')}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Form
                </Button>
              </div>

              {forms.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-jira-border rounded-xl">
                  <FileText className="w-8 h-8 text-jira-muted mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-jira-text">No intake forms yet</p>
                  <p className="text-xs text-jira-muted mt-1 max-w-sm mx-auto">
                    Create forms to capture bug reports, customer feedback, and feature requests.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveTab('builder')}
                    className="mt-4"
                  >
                    Build your first form
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {forms.map(form => (
                    <div
                      key={form.id}
                      className="border border-jira-border rounded-xl p-4 hover:border-jira-blue/50 hover:shadow-xs transition-all bg-white flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-blue-50 text-jira-blue rounded-lg">
                              <FileText className="w-4 h-4" />
                            </span>
                            <h4 className="text-sm font-bold text-jira-text group-hover:text-jira-blue transition-colors">
                              {form.title}
                            </h4>
                          </div>
                          <button
                            onClick={() => handleDeleteForm(form.id)}
                            className="p-1 text-jira-muted hover:text-red-600 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Delete form"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {form.description && (
                          <p className="text-xs text-jira-muted mt-2 line-clamp-2">
                            {form.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-3 text-[11px] text-jira-muted">
                          <span className="font-semibold text-jira-text">{form.fields.length}</span> fields
                          <span>•</span>
                          <span>{new Date(form.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-jira-border/60 mt-3 flex items-center justify-between">
                        <button
                          onClick={() => setPreviewForm(form)}
                          className="text-xs font-semibold text-jira-blue hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview Form
                        </button>
                        <ChevronRight className="w-4 h-4 text-jira-muted group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
    </>
  );
}
