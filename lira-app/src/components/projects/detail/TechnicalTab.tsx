import { GitBranch, Plus, ExternalLink, Check, Save, Server, X, Code } from 'lucide-react';
import { Button } from '../../common/Button';
import type { DetailCtx } from './types';

export function TechnicalTab(ctx: DetailCtx) {
  const { repoUrl, setRepoUrl, description, setDescription, lead, setLead, environments, newEnvInput, setNewEnvInput, techSavedToast, handleAddEnv, handleRemoveEnv, handleSaveTechnicalDetails } = ctx;
  return (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto w-full">
            <div className="bg-white rounded-xl border border-jira-border shadow-xs p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-jira-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-jira-text flex items-center gap-2">
                    <Code className="w-5 h-5 text-jira-blue" />
                    Technical Details & Environments
                  </h2>
                  <p className="text-xs text-jira-muted mt-1">
                    Manage Git repositories, architecture scope, engineering leads, and deployment target environments.
                  </p>
                </div>
                {techSavedToast && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-fade-in font-medium">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>✓ Saved</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveTechnicalDetails} className="space-y-6">
                {/* Repository URL */}
                <div>
                  <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-2">
                    Source Code Repository Link (Repo URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <GitBranch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="url"
                        value={repoUrl}
                        onChange={e => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/organization/project-repository"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-jira-border rounded-lg focus:outline-none focus:border-jira-blue transition-all"
                      />
                    </div>
                    {repoUrl && (
                      <a
                        href={repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-jira-text text-sm rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Visit</span>
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-jira-muted mt-1">
                    Direct VCS endpoint for branch associations, commit tracking, and PR automation.
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-2">
                    Description & Architectural Scope
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Provide technical overview, architecture constraints, API contracts, or sprint scope..."
                    className="w-full text-sm border border-jira-border rounded-lg p-3 focus:outline-none focus:border-jira-blue resize-none transition-all"
                  />
                </div>

                {/* Lead */}
                <div>
                  <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-2">
                    Technical Lead / Owner
                  </label>
                  <input
                    type="text"
                    value={lead}
                    onChange={e => setLead(e.target.value)}
                    className="w-full text-sm border border-jira-border rounded-lg px-3 py-2 focus:outline-none focus:border-jira-blue"
                  />
                </div>

                {/* Environments Tags */}
                <div>
                  <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-2">
                    Environments (Tags)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {environments.map(env => (
                      <div
                        key={env}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-jira-blue border border-blue-200 rounded-lg text-xs font-semibold"
                      >
                        <Server className="w-3.5 h-3.5" />
                        <span>{env}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEnv(env)}
                          className="hover:text-red-500 transition-colors ml-1 cursor-pointer"
                          title={`Remove ${env}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add environment tag input */}
                  <div className="flex items-center gap-2 max-w-sm">
                    <input
                      type="text"
                      value={newEnvInput}
                      onChange={e => setNewEnvInput(e.target.value)}
                      placeholder="Add environment tag (e.g. QA, UAT)..."
                      className="flex-1 px-3 py-1.5 text-xs border border-jira-border rounded-lg focus:outline-none focus:border-jira-blue"
                    />
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      onClick={handleAddEnv}
                      icon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Save button */}
                <div className="pt-4 border-t border-jira-border flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    icon={<Save className="w-4 h-4" />}
                  >
                    Save Technical Details
                  </Button>
                </div>
              </form>
            </div>
          </div>
  );
}
