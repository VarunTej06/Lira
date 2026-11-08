import { useEffect, useState } from 'react';
import { Copy, Check, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import type { SettingsState } from './useSettingsState';

interface LanInfo { lan: boolean; urls: string[] }

/** The private link (and a QR code) for opening Lira on a tablet or phone on the same Wi-Fi. Only the computer that runs Lira can see it. */
export function DevicesSection(s: SettingsState) {
  const { activeSection } = s;
  const [info, setInfo] = useState<LanInfo | null | 'error'>(null);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (activeSection !== 'devices') return;
    let cancelled = false;
    fetch('/api/lan')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('refused'))))
      .then((j: LanInfo) => {
        if (cancelled) return;
        setInfo(j);
        j.urls.forEach(u => QRCode.toDataURL(u, { margin: 1, width: 220 }).then(d => { if (!cancelled) setQr(q => ({ ...q, [u]: d })); }).catch(() => {}));
      })
      .catch(() => { if (!cancelled) setInfo('error'); });
    return () => { cancelled = true; };
  }, [activeSection]);

  const copy = async (u: string) => {
    try { await navigator.clipboard.writeText(u); setCopied(u); window.setTimeout(() => setCopied(null), 1800); } catch { /* the link is also shown to select by hand */ }
  };

  return (
    <>
      {activeSection === 'devices' && (
        <div className="space-y-5" data-testid="devices-section">
          <div>
            <h3 className="text-base font-bold text-lira-text flex items-center gap-2"><Smartphone className="w-4 h-4" /> Other devices</h3>
            <p className="text-xs text-lira-muted mt-1">Open Lira on a tablet or phone that is on the same Wi-Fi as this computer.</p>
          </div>

          {info === null && <p className="text-xs text-lira-muted">Looking…</p>}
          {info === 'error' && <p className="text-xs text-red-600">This page can only be opened on the computer that runs Lira.</p>}

          {info && info !== 'error' && !info.lan && (
            <div className="p-4 rounded-xl border border-lira-border bg-gray-50 text-sm text-lira-text space-y-2">
              <p><strong>Network access is off.</strong></p>
              <p className="text-xs text-lira-muted">Stop Lira (Ctrl+C in the terminal) and start it again with <code className="px-1.5 py-0.5 rounded bg-white border border-lira-border">npm run dev:lan</code>. Then come back here for the link.</p>
            </div>
          )}

          {info && info !== 'error' && info.lan && (
            <div className="space-y-4">
              {info.urls.length === 0 && <p className="text-xs text-lira-muted">No network address found. Check that this computer is connected to Wi-Fi.</p>}
              {info.urls.map(u => (
                <div key={u} className="p-4 rounded-xl border border-lira-border bg-gray-50 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                  {qr[u] ? <img src={qr[u]} alt="QR code of the private link" width={160} height={160} className="rounded-lg bg-white p-1 flex-shrink-0" /> : <div className="w-40 h-40 rounded-lg bg-white/50 flex-shrink-0" />}
                  <div className="min-w-0 flex-1 space-y-2 w-full">
                    <p className="text-xs text-lira-muted">Scan the code with the device&apos;s camera, or open this link on it once:</p>
                    <input readOnly value={u} onFocus={e => e.currentTarget.select()} aria-label="Private link" className="w-full text-xs font-mono border border-lira-border rounded-lg px-2.5 py-2 bg-white text-lira-text" />
                    <button onClick={() => copy(u)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-lira-blue text-white cursor-pointer">
                      {copied === u ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy link</>}
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                This link is a password: anyone with it on your Wi-Fi can read and change your tickets. Do not share it or use it on public Wi-Fi.
                To cancel every device, delete <code>data/private/lan-token</code> and restart Lira.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
