import React, { useState } from 'react';
import { Loader2, Sparkles, Upload, X } from 'lucide-react';
import type { Assignment, SchoolClass } from '../types';
import { extractPromptFromImage } from '../utils/api';
import { fileToDataUrl, renderFirstPdfPage } from '../utils/pdfOcr';

interface NewAssignmentModalProps {
  classes: SchoolClass[];
  initialClassId?: string | null;
  onClose: () => void;
  onSave: (assignment: Assignment) => void;
}

export const NewAssignmentModal: React.FC<NewAssignmentModalProps> = ({
  classes,
  initialClassId,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState(initialClassId || classes[0]?.id || '');
  const [promptText, setPromptText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [fileName, setFileName] = useState('');
  const [scanError, setScanError] = useState('');

  const handleExtractInstructionOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setScanError('');
    setIsScanning(true);

    try {
      const imageUrl =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
          ? await renderFirstPdfPage(file, 1.8)
          : await fileToDataUrl(file);

      const extracted = await extractPromptFromImage(imageUrl);
      setPromptText(extracted || 'No se pudo detectar texto. Escribe el enunciado aquí.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al leer el archivo.';
      setScanError(message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !classId) return;
    onSave({
      id: `a_${Date.now()}`,
      classId,
      title: title.trim(),
      systemPromptOCR:
        promptText.trim() || 'Standard secondary school English writing evaluation criteria.',
    });
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-assignment-title"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 id="new-assignment-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="text-indigo-600" size={18} />
            Nueva tarea de Writing
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-600"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="assign-class" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Clase destino
            </label>
            <select
              id="assign-class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.students.length} alumnos)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="assign-title" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Título de la tarea
            </label>
            <input
              id="assign-title"
              type="text"
              required
              placeholder="Ej: Unit 4: For and Against Essay"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div>
            <label htmlFor="assign-prompt" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Instrucciones / Enunciado (OCR para IA)
            </label>
            <label className="mb-2.5 flex items-center justify-center gap-2 border border-dashed border-indigo-300 bg-indigo-50/60 hover:bg-indigo-50 text-indigo-700 rounded-lg px-4 py-3 cursor-pointer transition-colors text-sm font-medium">
              {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span>
                {isScanning
                  ? 'Extrayendo texto con OCR...'
                  : fileName
                    ? `Archivo cargado: ${fileName}`
                    : 'Subir PDF o imagen del enunciado'}
              </span>
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={handleExtractInstructionOCR}
              />
            </label>
            {scanError && (
              <p className="text-xs text-red-700 mb-2">{scanError}</p>
            )}
            <textarea
              id="assign-prompt"
              rows={4}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="El texto extraído aparecerá aquí o puedes escribirlo directamente..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold transition-colors whitespace-nowrap"
            >
              Crear tarea
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
