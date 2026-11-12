import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Copy,
  Download,
  Globe,
  RefreshCw,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import type { PersistedState } from '../utils/storage';

interface GoogleSitesModalProps {
  currentState: PersistedState;
  onImportState: (state: PersistedState) => void;
  onResetState: () => void;
  onClose: () => void;
}

export const GoogleSitesModal: React.FC<GoogleSitesModalProps> = ({
  currentState,
  onImportState,
  onResetState,
  onClose,
}) => {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isPrivateAiStudioPreview =
    currentHostname.startsWith('ais-dev-') || currentHostname.startsWith('ais-pre-');

  const [publicUrlInput, setPublicUrlInput] = useState(
    isPrivateAiStudioPreview ? '' : currentOrigin
  );
  const [copiedField, setCopiedField] = useState<'url' | 'iframe' | null>(null);
  const [iframeHeight, setIframeHeight] = useState(860);
  const [statusMessage, setStatusMessage] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    checked: boolean;
    ok: boolean;
    geminiConfigured: boolean;
    message: string;
  } | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedBaseUrl = (publicUrlInput.trim() || currentOrigin).replace(/\/+$/, '');
  const embedUrl = `${normalizedBaseUrl}/?embed=1`;
  const iframeSnippet = `<iframe src="${embedUrl}" width="100%" height="${iframeHeight}" style="border:0;border-radius:12px;background:#f8fafc;" allowfullscreen></iframe>`;

  const handleCopy = async (text: string, field: 'url' | 'iframe') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setStatusMessage('Copia manual necesaria: selecciona el texto y pulsa Ctrl+C / Cmd+C.');
    }
  };

  const handleCheckHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch('/api/health');
      const data = (await res.json()) as { ok?: boolean; geminiConfigured?: boolean };
      setHealthStatus({
        checked: true,
        ok: Boolean(res.ok && data.ok),
        geminiConfigured: Boolean(data.geminiConfigured),
        message: isPrivateAiStudioPreview
          ? 'El servidor responde correctamente aquí, però aquesta URL és privada d’AI Studio. Desplega l’app a Cloud Run per incrustar-la a Google Sites.'
          : 'Servidor públic i capçaleres d’iframe llestos per a Google Sites.',
      });
    } catch {
      setHealthStatus({
        checked: true,
        ok: false,
        geminiConfigured: false,
        message: 'No s’ha pogut contactar amb el servidor backend (/api/health).',
      });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleExportBackup = () => {
    const json = JSON.stringify(
      {
        ...currentState,
        exportedAt: new Date().toISOString(),
        app: 'WritingMaster AI - Google Sites Edition',
      },
      null,
      2
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `writingmaster-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMessage('Còpia de seguretat descarregada en format JSON.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as PersistedState;
      if (!Array.isArray(parsed.classes) || !Array.isArray(parsed.assignments) || !parsed.submissions) {
        setStatusMessage('L’arxiu JSON no té un format vàlid de WritingMaster.');
        return;
      }
      onImportState(parsed);
      setStatusMessage('Dades importades correctament.');
    } catch {
      setStatusMessage('No s’ha pogut llegir l’arxiu JSON seleccionat.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gsites-modal-title"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="text-indigo-600" size={20} />
            <h3 id="gsites-modal-title" className="text-lg font-bold text-slate-900">
              Incrustar a Google Sites i Còpies de Seguretat
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          {isPrivateAiStudioPreview && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-2 text-xs sm:text-sm text-amber-950">
              <div className="font-bold flex items-center gap-2 text-amber-900">
                <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                Per què dona error a Google Sites amb aquesta URL de previsualització?
              </div>
              <p className="text-xs leading-relaxed text-amber-900">
                Les URLs <code className="font-mono font-semibold">ais-dev-*</code> i{' '}
                <code className="font-mono font-semibold">ais-pre-*</code> d’AI Studio són privades
                i redirigeixen a l’inici de sessió de Google (<code className="font-mono">accounts.google.com</code>),
                que bloqueja els iframes de Google Sites per seguretat.
              </p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-amber-950 font-medium">
                <li>
                  Prem el botó <strong>Deploy</strong> (dalt a la dreta d’AI Studio) per desplegar l’app a{' '}
                  <strong>Cloud Run</strong> com a servei web públic.
                </li>
                <li>
                  Assegura’t de permetre l’accés públic (<em>Allow public / unauthenticated access</em>) al servei de Cloud Run.
                </li>
                <li>
                  Enganxa la <strong>URL pública final</strong> (sense <code className="font-mono">ais-dev-</code> ni{' '}
                  <code className="font-mono">ais-pre-</code>) al camp de sota i copia el codi per a Google Sites.
                </li>
              </ol>
            </div>
          )}

          {/* Public URL input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="public-deploy-url" className="text-xs font-semibold text-slate-700">
                URL pública de l’aplicació desplegada (Cloud Run)
              </label>
              <button
                type="button"
                onClick={handleCheckHealth}
                disabled={isCheckingHealth}
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1"
              >
                <RefreshCw size={12} className={isCheckingHealth ? 'animate-spin' : ''} />
                Comprovar servidor
              </button>
            </div>
            <input
              id="public-deploy-url"
              type="url"
              value={publicUrlInput}
              onChange={(e) => setPublicUrlInput(e.target.value)}
              placeholder="https://writingmaster-ai-xxxxx.run.app"
              className="w-full font-mono text-xs bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            {healthStatus && (
              <p
                className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${
                  healthStatus.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <CheckCircle size={14} className="shrink-0" />
                <span>
                  {healthStatus.message}{' '}
                  {healthStatus.ok &&
                    (healthStatus.geminiConfigured
                      ? '(GEMINI_API_KEY detectada)'
                      : '(Falta GEMINI_API_KEY a Secrets)')}
                </span>
              </p>
            )}
          </div>

          {/* Direct Embed URL */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Opció A · URL per a Google Sites (Insertar → Incorporar → Per URL)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={embedUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800"
              />
              <button
                type="button"
                onClick={() => handleCopy(embedUrl, 'url')}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {copiedField === 'url' ? <Check size={14} /> : <Copy size={14} />}
                {copiedField === 'url' ? 'Copiada' : 'Copiar URL'}
              </button>
            </div>
          </div>

          {/* Iframe HTML Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <label className="text-xs font-semibold text-slate-700">
                Opció B · Codi HTML iframe (Insertar → Incorporar → Inserir codi)
              </label>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Alçada:</span>
                <select
                  value={iframeHeight}
                  onChange={(e) => setIframeHeight(Number(e.target.value))}
                  className="border border-slate-300 rounded-md px-2 py-1 bg-white font-mono text-xs tabular-nums"
                >
                  <option value={720}>720px</option>
                  <option value={860}>860px</option>
                  <option value={960}>960px</option>
                  <option value={1100}>1100px</option>
                </select>
              </div>
            </div>
            <textarea
              readOnly
              rows={3}
              value={iframeSnippet}
              onFocus={(e) => e.target.select()}
              className="w-full font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-800 resize-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleCopy(iframeSnippet, 'iframe')}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                {copiedField === 'iframe' ? <Check size={14} /> : <Copy size={14} />}
                {copiedField === 'iframe' ? 'Codi copiat' : 'Copiar codi iframe'}
              </button>
            </div>
          </div>

          {/* Backup & Persistence Section */}
          <div className="border-t border-slate-200 pt-5 space-y-3">
            <div>
              <h4 className="font-semibold text-slate-900">Portabilitat i còpia de seguretat local</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Els canvis es desen automàticament en aquest navegador. Descarrega un JSON per moure les avaluacions entre ordinadors.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Download size={14} /> Exportar JSON
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Upload size={14} /> Importar JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportFile}
              />

              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="px-3.5 py-2 border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ml-auto"
                >
                  <RotateCcw size={14} /> Restaurar dades inicials
                </button>
              ) : (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-red-700 font-medium">Confirmar reinici?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onResetState();
                      setConfirmReset(false);
                      setStatusMessage('Dades restaurades a l’estat inicial.');
                    }}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
                  >
                    Sí, restaurar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium"
                  >
                    Cancel·lar
                  </button>
                </div>
              )}
            </div>

            {statusMessage && (
              <p className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                {statusMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
