import { useState, type Dispatch, type SetStateAction } from 'react';
import { Check, Database, FileText, Key, RotateCcw, Shield, Sparkles } from 'lucide-react';
import type { Space } from '../../types/space';
import {
  getSystemInstruction, setSystemInstruction, DEFAULT_SYSTEM_INSTRUCTION, getGeminiApiKey, setGeminiApiKey,
  setAiProvider, setOpenAiConfig, setConfirmWrites, type AiProvider, getOpenAiConfig,
} from '../../services/aiAgentService';

const CARD = 'bg-white border border-lira-border rounded-2xl p-3';
const HEADING = 'text-xs font-bold uppercase tracking-wide';
const FIELD = 'w-full text-xs border border-gray-300 rounded-xl px-2.5 py-2';

interface Props {
  spaces: Space[];
  activeSpace: Space | undefined;
  maximized: boolean;
  onBack: () => void;
  /** The three choices the chat header and the chat itself also read, so the chat owns them. */
  provider: AiProvider;
  setProvider: (p: AiProvider) => void;
  oai: ReturnType<typeof getOpenAiConfig>;
  setOai: Dispatch<SetStateAction<ReturnType<typeof getOpenAiConfig>>>;
  confirmWrites: boolean;
  setConfirmWrites: (v: boolean) => void;
}

/** Viva's settings: the instruction, which model answers, the keys, and whether to confirm before changing anything. */
export function VivaSettings({ spaces, activeSpace, maximized, onBack, provider, setProvider, oai, setOai, confirmWrites, setConfirmWrites: setConfirm }: Props) {
  const [instruction, setInstruction] = useState(getSystemInstruction());
  const [apiKey, setApiKey] = useState(getGeminiApiKey());
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSystemInstruction(instruction);
    setGeminiApiKey(apiKey.trim());
    setAiProvider(provider);
    setOpenAiConfig(oai);
    setConfirmWrites(confirmWrites);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };
  const resetInstruction = () => { setInstruction(DEFAULT_SYSTEM_INSTRUCTION); setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION); };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/70 text-lira-text animate-fade-in">
      <div className="flex items-center justify-between pb-2 border-b border-gray-200">
        <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-purple-600" /><h3 className="font-bold text-sm">Viva AI settings</h3></div>
        <button type="button" onClick={onBack} className="text-xs text-lira-blue hover:underline font-semibold cursor-pointer">Back to chat →</button>
      </div>

      <div className={CARD}>
        <div className="flex items-center gap-2 mb-2"><Database className="w-3.5 h-3.5 text-indigo-600" /><span className={HEADING}>Connected spaces ({spaces.length})</span></div>
        <div className="flex flex-wrap gap-1.5">
          {spaces.map(s => (
            <span key={s.id} className={`px-2 py-0.5 rounded-lg text-3xs font-semibold border flex items-center gap-1 ${s.id === activeSpace?.id ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
              <span>{s.icon}</span><span>{s.name}</span><span className="font-mono text-gray-400">[{s.key}]</span>
            </span>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-purple-600" /><label className={HEADING}>System instruction</label></div>
          <button type="button" onClick={resetInstruction} className="text-3xs text-lira-muted hover:text-purple-600 flex items-center gap-1 cursor-pointer"><RotateCcw className="w-3 h-3" /> Reset default</button>
        </div>
        <textarea rows={maximized ? 12 : 8} value={instruction} onChange={e => setInstruction(e.target.value)} className="w-full text-xs font-mono border border-gray-200 rounded-xl p-2.5 bg-gray-50/50 focus:outline-none focus:border-purple-500 leading-relaxed" />
      </div>

      <div className={`${CARD} space-y-2`}>
        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={confirmWrites} onChange={e => setConfirm(e.target.checked)} />
          <span><span className={HEADING}>Confirm before changing anything</span><br /><span className="text-lira-muted">Viva shows what it will do and waits for Confirm. Every change can be undone.</span></span>
        </label>
      </div>

      <div className={`${CARD} space-y-2`}>
        <div className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-purple-600" /><label htmlFor="viva-provider" className={HEADING}>Model</label></div>
        <select id="viva-provider" value={provider} onChange={e => setProvider(e.target.value as AiProvider)} className="w-full text-xs border border-gray-300 rounded-xl px-2.5 py-2 bg-white">
          <option value="local">Built-in engine (no network)</option>
          <option value="gemini">Google Gemini</option>
          <option value="openai">OpenAI-compatible server (Ollama, LM Studio, ...)</option>
        </select>
        {provider === 'openai' && (
          <div className="space-y-2">
            <input aria-label="Base URL" value={oai.baseUrl} onChange={e => setOai({ ...oai, baseUrl: e.target.value })} placeholder="http://localhost:11434/v1" className={FIELD} />
            <input aria-label="Model name" value={oai.model} onChange={e => setOai({ ...oai, model: e.target.value })} placeholder="llama3.1" className={FIELD} />
            <input aria-label="API key" type="password" value={oai.apiKey} onChange={e => setOai({ ...oai, apiKey: e.target.value })} placeholder="API key (not needed for a local server)" className={FIELD} />
          </div>
        )}
        <p className="text-3xs text-lira-muted">Changes to tickets are always made by the built-in engine, so they can be previewed and undone. The model answers questions.</p>
      </div>

      <div className={CARD}>
        <div className="flex items-center gap-1.5 mb-2"><Key className="w-3.5 h-3.5 text-amber-500" /><label className={HEADING}>Gemini API key (used when Google Gemini is the model)</label></div>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="AIzaSy… (leave empty to use the built-in local engine)"
            className="w-full text-xs border border-gray-300 rounded-xl pl-2.5 pr-14 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-2 top-2 text-3xs text-lira-muted hover:text-lira-text cursor-pointer">{showKey ? 'Hide' : 'Show'}</button>
        </div>
      </div>

      <button type="button" onClick={save} className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer">
        {saved ? <><Check className="w-4 h-4 text-emerald-300" /> Saved</> : 'Save settings'}
      </button>
    </div>
  );
}
