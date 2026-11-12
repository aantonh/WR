import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  FileUp,
  Loader2,
  Merge,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { BulkPageBlock, Phase, SchoolClass } from '../types';
import { analyzeHandwrittenPage } from '../utils/api';
import { renderPdfToImages } from '../utils/pdfOcr';

interface BulkUploadValidationProps {
  cls: SchoolClass;
  phase: Phase;
  onCancel: () => void;
  onComplete: (assignedBlocks: BulkPageBlock[]) => void;
}

export const BulkUploadValidation: React.FC<BulkUploadValidationProps> = ({
  cls,
  phase,
  onCancel,
  onComplete,
}) => {
  const [pages, setPages] = useState<BulkPageBlock[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [progressInfo, setProgressInfo] = useState({ current: 0, total: 0, step: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleFileSelected = async (file?: File) => {
    if (!file) return;
    setPdfFile(file);
    setErrorMsg('');
    setIsProcessing(true);
    setPages([]);
    setProgressInfo({ current: 0, total: 0, step: 'Cargando motor PDF...' });

    try {
      const renderedImages = await renderPdfToImages(file, (current, total) => {
        setProgressInfo({
          current,
          total,
          step: `Renderizando página ${current} de ${total} a alta resolución...`,
        });
      });

      const numPages = renderedImages.length;
      const extractedPages: BulkPageBlock[] = new Array(numPages);
      let completedCount = 0;
      const BATCH_SIZE = 3;

      for (let i = 0; i < renderedImages.length; i += BATCH_SIZE) {
        const batch = renderedImages.slice(i, i + BATCH_SIZE);
        setProgressInfo({
          current: completedCount,
          total: numPages,
          step: `Leyendo nombres manuscritos y transcribiendo hojas (${completedCount}/${numPages})...`,
        });

        await Promise.all(
          batch.map(async (imageUrl, batchIdx) => {
            const globalIdx = i + batchIdx;
            const pageNum = globalIdx + 1;
            try {
              const analysis = await analyzeHandwrittenPage(imageUrl, cls.students);
              extractedPages[globalIdx] = {
                id: `p_${pageNum}_${Date.now()}_${globalIdx}`,
                pageNumbers: [pageNum],
                images: [imageUrl],
                ocrText: analysis.transcribedText,
                detectedHeader: analysis.detectedNameRaw,
                isContinuationPage: analysis.isContinuationPage,
                studentId: analysis.studentId,
                mergedCount: 1,
                isRetrying: false,
              };
            } catch {
              extractedPages[globalIdx] = {
                id: `p_${pageNum}_${Date.now()}_${globalIdx}`,
                pageNumbers: [pageNum],
                images: [imageUrl],
                ocrText: '',
                detectedHeader: '',
                isContinuationPage: false,
                studentId: '',
                mergedCount: 1,
                isRetrying: false,
              };
            } finally {
              completedCount += 1;
              setProgressInfo({
                current: completedCount,
                total: numPages,
                step: `Leyendo nombres manuscritos y transcribiendo hojas (${completedCount}/${numPages})...`,
              });
            }
          })
        );
      }

      setPages(extractedPages);
    } catch {
      setErrorMsg(
        'No se pudo procesar el PDF. Verifica que no esté protegido con contraseña e inténtalo de nuevo.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryPageOcr = async (index: number) => {
    const target = pages[index];
    if (!target || !target.images?.[0]) return;

    setPages((prev) => prev.map((p, idx) => (idx === index ? { ...p, isRetrying: true } : p)));
    try {
      const analysis = await analyzeHandwrittenPage(target.images[0], cls.students);
      setPages((prev) =>
        prev.map((p, idx) =>
          idx === index
            ? {
                ...p,
                ocrText: analysis.transcribedText || p.ocrText,
                detectedHeader: analysis.detectedNameRaw,
                isContinuationPage: analysis.isContinuationPage,
                studentId: analysis.studentId || p.studentId,
                isRetrying: false,
              }
            : p
        )
      );
    } catch {
      setPages((prev) => prev.map((p, idx) => (idx === index ? { ...p, isRetrying: false } : p)));
    }
  };

  const handleMerge = (index: number) => {
    if (index === 0) return;
    setPages((prevPages) => {
      const next = [...prevPages];
      const prev = { ...next[index - 1] };
      const curr = next[index];

      prev.mergedCount += curr.mergedCount;
      prev.pageNumbers = [...prev.pageNumbers, ...curr.pageNumbers];
      prev.images = [...prev.images, ...curr.images];
      prev.ocrText = [prev.ocrText, curr.ocrText]
        .filter(Boolean)
        .join('\n\n--- Página siguiente ---\n\n');

      next[index - 1] = prev;
      next.splice(index, 1);
      return next;
    });
  };

  const handleRemovePage = (index: number) => {
    setPages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleConfirm = () => {
    const assignedBlocks = pages.filter((p) => Boolean(p.studentId));
    onComplete(assignedBlocks);
  };

  const assignedCount = pages.filter((p) => Boolean(p.studentId)).length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className={phase === 'draft' ? 'text-emerald-700' : 'text-indigo-700'}>
              Fase: {phase === 'draft' ? 'Draft (Borrador)' : 'Final Version'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Clase {cls.name}</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            Subida masiva y separación de PDF
          </h2>
          <p className="text-slate-600 text-sm">
            Sube el PDF escaneado con los writings de la clase. El sistema separará cada hoja, detectará los nombres y te permitirá unir páginas del mismo alumno.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-200/70 font-medium text-sm inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <ArrowLeft size={16} /> Volver a {cls.name}
        </button>
      </div>

      {!isProcessing && pages.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-indigo-300 p-12 text-center">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <FileUp size={28} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1.5">
            Selecciona el PDF masivo escaneado
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
            Cada página se renderizará en alta definición y será leída con{' '}
            <strong>IA Visión Manuscrita</strong> para reconocer nombres escritos a mano y transcribir cada redacción de {cls.name}.
          </p>

          {errorMsg && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg max-w-md mx-auto">
              {errorMsg}
            </div>
          )}

          <label className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 cursor-pointer transition-colors">
            <Upload size={18} /> Seleccionar archivo PDF
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
            />
          </label>
        </div>
      )}

      {isProcessing && (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Loader2 size={36} className="animate-spin text-indigo-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-1">Procesando &ldquo;{pdfFile?.name}&rdquo;</h3>
          <p className="text-sm text-slate-600 mb-4">{progressInfo.step}</p>
          {progressInfo.total > 0 && (
            <div className="max-w-md mx-auto">
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{
                    width: `${Math.round((progressInfo.current / progressInfo.total) * 100)}%`,
                  }}
                />
              </div>
              <div className="text-xs font-mono font-semibold text-slate-500 mt-2 tabular-nums">
                Página {progressInfo.current} de {progressInfo.total}
              </div>
            </div>
          )}
        </div>
      )}

      {!isProcessing && pages.length > 0 && (
        <>
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-indigo-950 tabular-nums">
              <strong>Archivo:</strong> {pdfFile?.name}
              <span aria-hidden="true" className="mx-2 text-indigo-400">·</span>
              <strong>{pages.length}</strong> bloques detectados
              <span aria-hidden="true" className="mx-2 text-indigo-400">·</span>
              <strong>{assignedCount}</strong> asignados a alumnos
            </div>
            <label className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 cursor-pointer underline whitespace-nowrap">
              Subir otro PDF diferente
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
            </label>
          </div>

          <div className="space-y-4">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center gap-5"
              >
                <button
                  type="button"
                  onClick={() => setPreviewImage(page.images[0])}
                  className="w-28 h-36 bg-slate-100 rounded-lg border border-slate-300 overflow-hidden relative shrink-0 cursor-zoom-in group"
                  title="Clic para ampliar esta hoja"
                >
                  <img
                    src={page.images[0]}
                    alt={`Página ${page.pageNumbers.join(',')}`}
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition-colors flex items-center justify-center">
                    <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                  </div>
                  <div className="absolute bottom-1 left-1 right-1 bg-slate-900/80 text-white text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded text-center tabular-nums">
                    {page.mergedCount > 1
                      ? `Págs ${page.pageNumbers.join('+')}`
                      : `Pág ${page.pageNumbers[0]}`}
                  </div>
                </button>

                <div className="flex-1 w-full min-w-0">
                  <div className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center justify-between gap-2">
                    <span className="tabular-nums">
                      Transcripción manuscrita IA (
                      {page.ocrText ? `${page.ocrText.split(/\s+/).length} palabras` : '0 palabras'})
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleRetryPageOcr(index)}
                        disabled={page.isRetrying}
                        className="text-emerald-700 hover:underline font-medium inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={page.isRetrying ? 'animate-spin' : ''} />
                        {page.isRetrying ? 'Leyendo...' : 'Releer IA'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewImage(page.images[0])}
                        className="text-indigo-600 hover:underline font-medium inline-flex items-center gap-1"
                      >
                        <Eye size={12} /> Ver hoja
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-xs bg-slate-50 border border-slate-200 p-3 rounded-lg text-slate-700 max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {page.ocrText ||
                      '(No se detectó texto automático; podrás escribirlo o editarlo en la pantalla de corrección)'}
                  </div>
                </div>

                <div className="flex-1 w-full">
                  <div className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center justify-between gap-2">
                    <span>Alumno de {cls.name}</span>
                    {page.detectedHeader && (
                      <span
                        className="text-[11px] font-medium text-indigo-700 truncate max-w-[180px]"
                        title={`Nombre manuscrito detectado: ${page.detectedHeader}`}
                      >
                        Leído: &ldquo;{page.detectedHeader}&rdquo;
                      </span>
                    )}
                  </div>
                  <select
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    value={page.studentId || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPages((prev) =>
                        prev.map((p, idx) => (idx === index ? { ...p, studentId: val } : p))
                      );
                    }}
                  >
                    <option value="">-- Ignorar / Sin asignar --</option>
                    {cls.students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex md:flex-col gap-2 shrink-0">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => handleMerge(index)}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                        page.isContinuationPage
                          ? 'text-amber-900 bg-amber-50 border-amber-300 hover:bg-amber-100'
                          : 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
                      }`}
                    >
                      <Merge size={14} />{' '}
                      {page.isContinuationPage ? '2ª pág. → Unir' : 'Unir a anterior'}
                    </button>
                  )}

                  {page.studentId ? (
                    <div className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
                      <Check size={14} /> Emparejado
                    </div>
                  ) : (
                    <div className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
                      <AlertCircle size={14} /> Sin asignar
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemovePage(index)}
                    className="inline-flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-red-700 px-2 py-1 rounded transition-colors"
                    title="Descartar esta página"
                  >
                    <Trash2 size={13} /> Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-200/70 font-medium text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={assignedCount === 0}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2 font-semibold text-sm transition-colors"
            >
              <Save size={16} /> Guardar {assignedCount}{' '}
              {assignedCount === 1 ? 'writing asignado' : 'writings asignados'}
            </button>
          </div>
        </>
      )}

      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div
            className="relative max-w-3xl max-h-[90vh] overflow-auto bg-white rounded-xl p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="sticky top-2 float-right bg-slate-900 text-white p-1.5 rounded-full hover:bg-slate-700"
              aria-label="Cerrar vista previa"
            >
              <X size={18} />
            </button>
            <img src={previewImage} alt="Vista ampliada de la hoja escaneada" className="w-full h-auto rounded" />
          </div>
        </div>
      )}
    </div>
  );
};
