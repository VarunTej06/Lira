import { alertDialog } from '../../common/dialogStore';
import { FileText } from 'lucide-react';
import { Button } from '../../common/Button';
import type { FormsState } from './useFormsState';

/** A form as the people filling it in will see it. */
export function FormPreview(s: FormsState) {
  const {  previewForm, setPreviewForm } = s;
  if (!previewForm) return null; // only rendered while a form is being previewed
  return (
    <>
            <div className="space-y-5 max-w-lg mx-auto">
              <div className="border-b border-lira-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-50 text-lira-blue rounded-md">
                    <FileText className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-bold text-lira-text">{previewForm.title}</h3>
                </div>
                {previewForm.description && (
                  <p className="text-xs text-lira-muted mt-1">{previewForm.description}</p>
                )}
              </div>

              <div className="space-y-4 bg-gray-50/60 border border-lira-border p-4 rounded-xl">
                {previewForm.fields.map((f, idx) => (
                  <div key={f.id || idx} className="space-y-1">
                    <label className="block text-xs font-semibold text-lira-text">
                      {f.name} {f.required && <span className="text-red-500">*</span>}
                    </label>

                    {f.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        placeholder={`Enter ${f.name.toLowerCase()}...`}
                        className="w-full px-3 py-1.5 text-xs border border-lira-border rounded-lg bg-white focus:outline-none focus:border-lira-blue"
                      />
                    ) : f.type === 'select' ? (
                      <select className="w-full px-3 py-1.5 text-xs border border-lira-border rounded-lg bg-white focus:outline-none focus:border-lira-blue">
                        <option value="">Select an option...</option>
                        {(f.options || []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : f.type === 'checkbox' ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input type="checkbox" className="w-4 h-4 rounded text-lira-blue border-gray-300" />
                        <span className="text-xs text-lira-muted">Confirm {f.name.toLowerCase()}</span>
                      </div>
                    ) : (
                      <input
                        type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                        placeholder={`Enter ${f.name.toLowerCase()}...`}
                        className="w-full px-3 py-1.5 text-xs border border-lira-border rounded-lg bg-white focus:outline-none focus:border-lira-blue"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setPreviewForm(null)}>
                  Close Preview
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    await alertDialog({ title: 'Form submitted', message: 'Intake form submission received (mock submission).' });
                    setPreviewForm(null);
                  }}
                >
                  Submit Response
                </Button>
              </div>
            </div>
    </>
  );
}
