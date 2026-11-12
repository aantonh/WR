import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Check,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  Tag,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  Assignment,
  CurriculumRubric,
  ErrorCodeKey,
  EssayToken,
  PdfAnnotation,
  Phase,
  Student,
  Submission,
} from '../types';
import { ERROR_CODES, createEmptySubmission } from '../data/seed';
import { analyzeHandwrittenPage, evaluateEssayWithCurriculum } from '../utils/api';
import { applyErrorsToText, fileToDataUrl, renderPdfToImages } from '../utils/pdfOcr';

interface GradingInterfaceProps {
  student: Student;
  assignment: Assignment;
  initialPhase: Phase;
  submissionData?: Submission;
  onSaveSubmission: (key: string, data: Submission) => void;
  onToggleStudentMisu: (studentId: string) => void;
  onBack: () => void;
}

export const GradingInterface: React.FC<GradingInterfaceProps> = ({
  student,
  assignment,
  initialPhase,
  submissionData,
  onSaveSubmission,
  onToggleStudentMisu,
  onBack,
}) => {
  const baseSubmission = submissionData || createEmptySubmission(assignment.id, student.id);

  const [activePhase, setActivePhase] = useState<Phase>(initialPhase);
  const [zoom, setZoom] = useState(100);
  const [isEditingText, setIsEditingText] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRetranscribing, setIsRetranscribing] = useState(false);
  const [isUploadingSingle, setIsUploadingSingle] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState('');

  // PDF annotation overlay state
  const [pdfMarkMode, setPdfMarkMode] = useState(false);
  const [selectedPdfCode, setSelectedPdfCode] = useState<ErrorCodeKey>('Sp');
  const [showPdfAnnotations, setShowPdfAnnotations] = useState(true);

  // Manual token editor state
  const [editingTokenIndex, setEditingTokenIndex] = useState<number | null>(null);
  const [manualCode, setManualCode] = useState<ErrorCodeKey>('Sp');
  const [manualCorrection, setManualCorrection] = useState('');
  const [manualExplanation, setManualExplanation] = useState('');

  // Phase states
  const [draftPages, setDraftPages] = useState<string[]>(baseSubmission.draftPages || []);
  const [finalPages, setFinalPages] = useState<string[]>(baseSubmission.finalPages || []);
  const [draftText, setDraftText] = useState<string>(baseSubmission.draftText || '');
  const [finalText, setFinalText] = useState<string>(baseSubmission.finalText || '');
  const [draftTokens, setDraftTokens] = useState<EssayToken[]>(baseSubmission.draftTokens || []);
  const [finalTokens, setFinalTokens] = useState<EssayToken[]>(baseSubmission.finalTokens || []);
  const [draftPdfAnnotations, setDraftPdfAnnotations] = useState<PdfAnnotation[]>(
    baseSubmission.draftPdfAnnotations || []
  );
  const [finalPdfAnnotations, setFinalPdfAnnotations] = useState<PdfAnnotation[]>(
    baseSubmission.finalPdfAnnotations || []
  );
  const [draftRubric, setDraftRubric] = useState<CurriculumRubric | null>(
    baseSubmission.draftRubric || null
  );
  const [finalRubric, setFinalRubric] = useState<CurriculumRubric | null>(
    baseSubmission.finalRubric || null
  );
  const [draftGrade, setDraftGrade] = useState<string>(baseSubmission.draftGrade || '');
  const [finalGrade, setFinalGrade] = useState<string>(baseSubmission.finalGrade || '');
  const [draftWeight, setDraftWeight] = useState<number>(baseSubmission.draftWeight ?? 30);

  const currentPages = activePhase === 'draft' ? draftPages : finalPages;
  const setCurrentPages = activePhase === 'draft' ? setDraftPages : setFinalPages;
  const currentText = activePhase === 'draft' ? draftText : finalText;
  const setCurrentText = activePhase === 'draft' ? setDraftText : setFinalText;
  const currentTokens = activePhase === 'draft' ? draftTokens : finalTokens;
  const setCurrentTokens = activePhase === 'draft' ? setDraftTokens : setFinalTokens;
  const currentPdfAnnotations =
    activePhase === 'draft' ? draftPdfAnnotations : finalPdfAnnotations;
  const setCurrentPdfAnnotations =
    activePhase === 'draft' ? setDraftPdfAnnotations : setFinalPdfAnnotations;
  const currentRubric = activePhase === 'draft' ? draftRubric : finalRubric;

  useEffect(() => {
    if (currentText && currentTokens.length === 0) {
      const initialParts: EssayToken[] = currentText
        .split(/(\s+)/)
        .map((val) => ({ type: 'text', val }));
      setCurrentTokens(initialParts);
    }
  }, [activePhase, currentText]);

  const handleSingleFileUpload = async (file?: File) => {
    if (!file) return;
    setIsUploadingSingle(true);
    setAiErrorMsg('');
    try {
      const newImages =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
          ? await renderPdfToImages(file, undefined, 1.9)
          : [await fileToDataUrl(file)];

      const transcriptions: string[] = [];
      for (const imgUrl of newImages) {
        const analysis = await analyzeHandwrittenPage(imgUrl, [student]);
        if (analysis.transcribedText) {
          transcriptions.push(analysis.transcribedText);
        }
      }

      const combinedTranscription = transcriptions.join('\n\n');
      setCurrentPages((prev) => [...prev, ...newImages]);
      if (combinedTranscription) {
        const updated = currentText
          ? `${currentText}\n\n${combinedTranscription}`
          : combinedTranscription;
        setCurrentText(updated);
        setCurrentTokens(updated.split(/(\s+)/).map((val) => ({ type: 'text', val })));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo procesar el archivo subido.';
      setAiErrorMsg(message);
    } finally {
      setIsUploadingSingle(false);
    }
  };

  const handleRetranscribeFromPdf = async () => {
    if (currentPages.length === 0) return;
    setIsRetranscribing(true);
    setAiErrorMsg('');
    try {
      const transcriptions: string[] = [];
      for (const imgUrl of currentPages) {
        const analysis = await analyzeHandwrittenPage(imgUrl, [student]);
        if (analysis.transcribedText) {
          transcriptions.push(analysis.transcribedText);
        }
      }
      const joined = transcriptions.join('\n\n--- Página siguiente ---\n\n');
      if (joined) {
        setCurrentText(joined);
        setCurrentTokens(joined.split(/(\s+)/).map((val) => ({ type: 'text', val })));
        setIsEditingText(true);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo re-transcribir el PDF. Inténtalo de nuevo.';
      setAiErrorMsg(message);
    } finally {
      setIsRetranscribing(false);
    }
  };

  const runAiCorrection = async () => {
    if (!currentText.trim()) return;
    setIsAnalyzing(true);
    setAiErrorMsg('');
    setEditingTokenIndex(null);

    try {
      const evalResult = await evaluateEssayWithCurriculum({
        text: currentText,
        pages: currentPages,
        assignmentPrompt: assignment.systemPromptOCR,
        phase: activePhase,
        needsMISU: student.needsMISU,
      });

      const alignedTokens = applyErrorsToText(currentText, evalResult.errors || []);

      const autoPdfMarks: PdfAnnotation[] = (evalResult.errors || [])
        .filter((e) => Array.isArray(e.box2d) && e.box2d.length === 4 && ERROR_CODES[e.code])
        .map((e, i) => {
          const [ymin, xmin, , xmax] = e.box2d!;
          return {
            id: `pdf_ai_${i}_${Date.now()}`,
            pageIndex: 0,
            xPercent: Math.min(94, Math.max(4, (xmin + xmax) / 2 / 10)),
            yPercent: Math.min(94, Math.max(4, ymin / 10)),
            code: e.code,
            correction: e.correction || '',
            explanation: e.explanation || '',
          };
        });

      const rubricPayload: CurriculumRubric = {
        ...evalResult.rubric,
        feedback: evalResult.curriculumFeedback || '',
        misuApplied: student.needsMISU,
      };

      const formattedGrade =
        typeof evalResult.suggestedGrade === 'number'
          ? Math.max(0, Math.min(10, evalResult.suggestedGrade)).toFixed(1)
          : '';

      if (activePhase === 'draft') {
        setDraftTokens(alignedTokens);
        setDraftPdfAnnotations(autoPdfMarks);
        setDraftRubric(rubricPayload);
        if (formattedGrade) setDraftGrade(formattedGrade);
      } else {
        setFinalTokens(alignedTokens);
        setFinalPdfAnnotations(autoPdfMarks);
        setFinalRubric(rubricPayload);
        if (formattedGrade) setFinalGrade(formattedGrade);
      }

      setIsEditingText(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Hubo un problema al conectar con el evaluador IA. Inténtalo de nuevo.';
      setAiErrorMsg(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePdfCanvasClick = (e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    if (!pdfMarkMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    const newMark: PdfAnnotation = {
      id: `pdf_manual_${Date.now()}`,
      pageIndex,
      xPercent: Math.min(95, Math.max(2, xPercent)),
      yPercent: Math.min(95, Math.max(2, yPercent)),
      code: selectedPdfCode,
      correction: '',
      explanation: `Marcado manualmente (${ERROR_CODES[selectedPdfCode]?.desc || selectedPdfCode})`,
    };

    setCurrentPdfAnnotations((prev) => [...prev, newMark]);
    setShowPdfAnnotations(true);
  };

  const handleRemovePdfAnnotation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCurrentPdfAnnotations((prev) => prev.filter((m) => m.id !== id));
  };

  const handleOpenTokenEditor = (idx: number, token: EssayToken) => {
    if (/^\s+$/.test(token.val) || token.val === '') return;
    setEditingTokenIndex(idx);
    setManualCode(token.type === 'error' && token.code ? token.code : 'Sp');
    setManualCorrection(token.type === 'error' ? token.correction || '' : '');
    setManualExplanation(token.type === 'error' ? token.explanation || '' : '');
  };

  const handleApplyManualTokenTag = () => {
    if (editingTokenIndex === null) return;
    setCurrentTokens((prev) =>
      prev.map((tok, idx) => {
        if (idx !== editingTokenIndex) return tok;
        return {
          type: 'error',
          id: tok.id || `manual_${idx}_${Date.now()}`,
          code: manualCode,
          val: tok.val,
          correction: manualCorrection,
          explanation: manualExplanation,
        };
      })
    );
    setEditingTokenIndex(null);
  };

  const handleClearManualTokenTag = () => {
    if (editingTokenIndex === null) return;
    setCurrentTokens((prev) =>
      prev.map((tok, idx) => (idx === editingTokenIndex ? { type: 'text', val: tok.val } : tok))
    );
    setEditingTokenIndex(null);
  };

  const handleSaveAll = () => {
    const hasDraft = draftPages.length > 0 || draftText.trim().length > 0 || draftGrade !== '';
    const hasFinal = finalPages.length > 0 || finalText.trim().length > 0 || finalGrade !== '';

    onSaveSubmission(`${assignment.id}_${student.id}`, {
      ...baseSubmission,
      assignmentId: assignment.id,
      studentId: student.id,
      draftStatus: draftGrade !== '' ? 'graded' : hasDraft ? 'scanned' : 'pending',
      draftPages,
      draftText,
      draftTokens,
      draftPdfAnnotations,
      draftRubric,
      draftGrade,
      finalStatus: finalGrade !== '' ? 'graded' : hasFinal ? 'scanned' : 'pending',
      finalPages,
      finalText,
      finalTokens,
      finalPdfAnnotations,
      finalRubric,
      finalGrade,
      draftWeight: Number(draftWeight),
      finalWeight: 100 - Number(draftWeight),
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const finalWeight = 100 - draftWeight;
  const dNum = parseFloat(draftGrade);
  const fNum = parseFloat(finalGrade);
  const computedAverage =
    !isNaN(dNum) && !isNaN(fNum)
      ? ((dNum * (draftWeight / 100)) + (fNum * (finalWeight / 100))).toFixed(1)
      : !isNaN(dNum)
        ? dNum.toFixed(1)
        : !isNaN(fNum)
          ? fNum.toFixed(1)
          : '-';

  const errorCountInTokens = currentTokens.filter((t) => t.type === 'error').length;

  return (
    <div className="flex flex-col min-h-[760px] lg:h-[calc(100vh-56px)] bg-slate-50">
      {/* Grading Subheader */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="text-slate-600 hover:text-indigo-700 transition-colors p-2 rounded-lg hover:bg-slate-100 shrink-0"
            aria-label="Volver a la lista de alumnos"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 truncate">{student.name}</h2>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="text-xs font-medium text-slate-600 truncate">{assignment.title}</span>
              <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
                ·
              </span>
              <span className="text-xs text-slate-500 hidden sm:inline">
                Currículum Catalunya (Decret 175/2022 · 4t ESO)
              </span>
            </div>

            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg w-fit mt-1.5">
              <button
                type="button"
                onClick={() => {
                  setActivePhase('draft');
                  setEditingTokenIndex(null);
                }}
                className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors whitespace-nowrap tabular-nums ${
                  activePhase === 'draft'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fase 1: Draft ({draftPages.length} pág.)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePhase('final');
                  setEditingTokenIndex(null);
                }}
                className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors whitespace-nowrap tabular-nums ${
                  activePhase === 'final'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fase 2: Final Version ({finalPages.length} pág.)
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer bg-blue-50/70 px-3.5 py-2 rounded-lg border border-blue-200 select-none">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={student.needsMISU}
                onChange={() => onToggleStudentMisu(student.id)}
              />
              <div
                className={`block w-9 h-5 rounded-full transition-colors ${
                  student.needsMISU ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              />
              <div
                className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${
                  student.needsMISU ? 'translate-x-4' : ''
                }`}
              />
            </div>
            <span className="text-xs font-semibold text-blue-950 whitespace-nowrap">
              MISU (Dislexia/TDAH)
            </span>
          </label>

          <button
            type="button"
            onClick={handleSaveAll}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold inline-flex items-center gap-2 text-sm whitespace-nowrap"
          >
            {saveToast ? (
              <>
                <Check size={16} /> Guardado
              </>
            ) : (
              <>
                <Save size={16} /> Guardar evaluación
              </>
            )}
          </button>
        </div>
      </div>

      {/* Split Screen Workspace */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left: Scanned PDF Pages & Direct Stamps */}
        <div className="w-full lg:w-1/2 min-h-[380px] lg:h-full bg-slate-200/80 border-b lg:border-b-0 lg:border-r border-slate-300 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPdfMarkMode((m) => !m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors whitespace-nowrap ${
                  pdfMarkMode
                    ? 'bg-red-600 text-white border-red-700'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <Tag size={13} />
                {pdfMarkMode ? 'Clic en PDF para marcar (Activo)' : 'Marcar códigos en PDF'}
              </button>

              {pdfMarkMode && (
                <select
                  value={selectedPdfCode}
                  onChange={(e) => setSelectedPdfCode(e.target.value as ErrorCodeKey)}
                  aria-label="Código de error para marcar en PDF"
                  className="text-xs font-semibold border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {Object.entries(ERROR_CODES).map(([code, info]) => (
                    <option key={code} value={code}>
                      {code} ({info.desc})
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => setShowPdfAnnotations((s) => !s)}
                className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 inline-flex items-center gap-1 tabular-nums"
                title="Mostrar u ocultar marcas sobre el PDF"
              >
                {showPdfAnnotations ? <Eye size={14} /> : <EyeOff size={14} />}
                <span>{currentPdfAnnotations.length}</span>
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(50, z - 15))}
                className="p-1 hover:bg-white rounded text-slate-700"
                title="Alejar"
                aria-label="Alejar página"
              >
                <ZoomOut size={15} />
              </button>
              <span className="text-xs font-mono font-semibold w-10 text-center tabular-nums">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(200, z + 15))}
                className="p-1 hover:bg-white rounded text-slate-700"
                title="Acercar"
                aria-label="Acercar página"
              >
                <ZoomIn size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-5 flex flex-col items-center gap-6">
            {currentPages.length > 0 ? (
              currentPages.map((imgSrc, idx) => {
                const pageAnnotations = currentPdfAnnotations.filter((m) => m.pageIndex === idx);
                return (
                  <div
                    key={idx}
                    className="bg-white shadow-md origin-top transition-transform duration-150 border border-slate-300 rounded-xs overflow-hidden"
                    style={{ width: `${Math.round(540 * (zoom / 100))}px`, maxWidth: '100%' }}
                  >
                    <div className="bg-slate-800 text-white text-[11px] font-mono px-3 py-1.5 flex justify-between tabular-nums">
                      <span>
                        Hoja {idx + 1} de {currentPages.length} ({activePhase.toUpperCase()})
                      </span>
                      <span>
                        {pdfMarkMode ? `Haz clic para poner [${selectedPdfCode}]` : student.name}
                      </span>
                    </div>
                    <div
                      onClick={(e) => handlePdfCanvasClick(e, idx)}
                      className={`relative select-none ${pdfMarkMode ? 'cursor-crosshair' : ''}`}
                    >
                      <img
                        src={imgSrc}
                        alt={`Página ${idx + 1} de ${student.name}`}
                        className="w-full h-auto block pointer-events-none"
                      />

                      {showPdfAnnotations &&
                        pageAnnotations.map((mark) => {
                          const style = ERROR_CODES[mark.code] || {
                            color: 'bg-red-100 text-red-900 border-red-400',
                            desc: mark.code,
                          };
                          return (
                            <div
                              key={mark.id}
                              style={{ left: `${mark.xPercent}%`, top: `${mark.yPercent}%` }}
                              className="absolute -translate-x-1/2 -translate-y-1/2 group z-10"
                            >
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded border shadow-sm ${style.color}`}
                              >
                                {mark.code}
                                <button
                                  type="button"
                                  onClick={(e) => handleRemovePdfAnnotation(e, mark.id)}
                                  className="hover:text-red-700 ml-0.5 opacity-75 hover:opacity-100"
                                  title="Eliminar marca del PDF"
                                >
                                  ×
                                </button>
                              </span>
                              {(mark.correction || mark.explanation) && (
                                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-slate-900 text-white text-[11px] p-2 rounded-lg shadow-xl z-20 pointer-events-none">
                                  <div className="font-bold text-slate-300">
                                    {style.desc} ({mark.code})
                                  </div>
                                  {mark.correction && (
                                    <div className="text-emerald-300 font-semibold mt-0.5">
                                      → {mark.correction}
                                    </div>
                                  )}
                                  {mark.explanation && (
                                    <div className="text-slate-300 mt-0.5 leading-snug">
                                      {mark.explanation}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="my-auto bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center max-w-sm">
                <FileText className="text-slate-400 mx-auto mb-3" size={32} />
                <h4 className="font-bold text-slate-800 mb-1">
                  Sin hoja escaneada en {activePhase === 'draft' ? 'Draft' : 'Final'}
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Sube el PDF masivo desde la vista de clase o sube aquí el PDF/imagen individual de{' '}
                  {student.name}.
                </p>
                <label className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-indigo-700 transition-colors">
                  {isUploadingSingle ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  {isUploadingSingle
                    ? 'Transcribiendo manuscrito...'
                    : 'Subir PDF/Imagen individual'}
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => handleSingleFileUpload(e.target.files?.[0])}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Right: Transcribed Text, Error Codes, Curriculum Rubric & Weighted Grade */}
        <div className="w-full lg:w-1/2 lg:h-full bg-white flex flex-col overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-2.5 bg-slate-50 flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setIsEditingText(false);
                  setEditingTokenIndex(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                  !isEditingText
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Texto marcado ({errorCountInTokens})
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingText(true);
                  setEditingTokenIndex(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  isEditingText
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Editar texto base
              </button>
            </div>

            <div className="flex items-center gap-2">
              {currentPages.length > 0 && (
                <button
                  type="button"
                  onClick={handleRetranscribeFromPdf}
                  disabled={isRetranscribing}
                  className="bg-white text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                  title="Volver a leer la caligrafía del PDF con IA Visión"
                >
                  <RefreshCw size={13} className={isRetranscribing ? 'animate-spin' : ''} />
                  {isRetranscribing ? 'Leyendo PDF...' : 'Re-transcribir PDF'}
                </button>
              )}

              <button
                type="button"
                onClick={runAiCorrection}
                disabled={isAnalyzing || !currentText.trim()}
                className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {isAnalyzing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                {isAnalyzing ? 'Evaluando (Currículum CAT)...' : 'Evaluar y marcar códigos'}
              </button>
            </div>
          </div>

          {aiErrorMsg && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-800 flex items-center justify-between gap-2">
              <span>{aiErrorMsg}</span>
              <button
                type="button"
                onClick={() => setAiErrorMsg('')}
                className="font-bold px-1.5"
                aria-label="Cerrar error"
              >
                ×
              </button>
            </div>
          )}

          {!isEditingText && (
            <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 flex flex-wrap gap-1.5 items-center text-[11px]">
              <span className="font-medium text-slate-500 mr-1">
                Códigos (clic en cualquier palabra para marcar):
              </span>
              {Object.entries(ERROR_CODES).map(([code, info]) => (
                <span
                  key={code}
                  className={`px-1.5 py-0.5 rounded border font-bold ${info.color}`}
                  title={info.desc}
                >
                  {code}
                </span>
              ))}
            </div>
          )}

          <div className="flex-1 p-5 overflow-auto text-base space-y-4">
            {isEditingText ? (
              <textarea
                className="w-full h-full min-h-[260px] p-4 border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-600 text-slate-800 bg-slate-50/40 font-sans leading-relaxed"
                value={currentText}
                onChange={(e) => {
                  const val = e.target.value;
                  setCurrentText(val);
                  setCurrentTokens(val.split(/(\s+)/).map((v) => ({ type: 'text', val: v })));
                }}
                placeholder="Aquí aparece el texto manuscrito transcrito del PDF. Puedes editar cualquier palabra y pulsar 'Evaluar y marcar códigos'..."
              />
            ) : (
              <>
                <div className="p-6 bg-white border border-slate-200 rounded-xl min-h-[210px] whitespace-pre-wrap font-sans text-slate-800 leading-[2.75]">
                  {currentTokens.length > 0 ? (
                    currentTokens.map((token, i) => {
                      if (token.type === 'text') {
                        const isSpace = /^\s+$/.test(token.val) || token.val === '';
                        if (isSpace) return <span key={i}>{token.val}</span>;
                        return (
                          <span
                            key={i}
                            onClick={() => handleOpenTokenEditor(i, token)}
                            className="hover:bg-indigo-50 hover:text-indigo-900 rounded px-0.5 cursor-pointer transition-colors"
                            title="Clic para añadir código de corrección a esta palabra"
                          >
                            {token.val}
                          </span>
                        );
                      }

                      const tagStyle = (token.code && ERROR_CODES[token.code]) || {
                        color: 'bg-slate-200 text-slate-800 border-slate-400',
                        desc: 'Error',
                      };

                      return (
                        <span
                          key={i}
                          onClick={() => handleOpenTokenEditor(i, token)}
                          className="relative group inline-block mx-0.5 cursor-pointer"
                        >
                          <span
                            className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-1.5 leading-tight rounded border ${tagStyle.color} shadow-xs z-10`}
                          >
                            {token.code}
                          </span>
                          <span className="border-b-2 border-red-400 bg-red-50/70 px-1 rounded-xs font-medium">
                            {token.val === '' ? '___' : token.val}
                          </span>

                          <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-60 bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-xl z-20 pointer-events-none">
                            <div className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-1">
                              {tagStyle.desc} ({token.code})
                            </div>
                            {token.correction && (
                              <div className="text-emerald-300 font-semibold">
                                Sugerencia: {token.correction}
                              </div>
                            )}
                            {token.explanation && (
                              <div className="text-slate-300 text-[11px] mt-1 leading-snug">
                                {token.explanation}
                              </div>
                            )}
                            <div className="text-[10px] text-indigo-300 mt-1">
                              Clic para editar o quitar etiqueta
                            </div>
                          </div>
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-slate-400 text-sm">
                      No hay texto transcrito todavía. Sube el PDF o escribe el texto en la pestaña &ldquo;2. Editar texto base&rdquo;.
                    </span>
                  )}
                </div>

                {editingTokenIndex !== null && currentTokens[editingTokenIndex] && (
                  <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 flex flex-wrap items-end gap-3">
                    <div>
                      <div className="text-[11px] font-bold text-indigo-950 mb-1">
                        Palabra: &ldquo;{currentTokens[editingTokenIndex].val}&rdquo;
                      </div>
                      <select
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value as ErrorCodeKey)}
                        className="text-xs font-bold border border-indigo-300 rounded-lg px-2.5 py-1.5 bg-white"
                      >
                        {Object.entries(ERROR_CODES).map(([code, info]) => (
                          <option key={code} value={code}>
                            {code} - {info.desc}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Corrección sugerida
                      </label>
                      <input
                        type="text"
                        value={manualCorrection}
                        onChange={(e) => setManualCorrection(e.target.value)}
                        placeholder="Ej: went / People..."
                        className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                      />
                    </div>

                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nota pedagógica
                      </label>
                      <input
                        type="text"
                        value={manualExplanation}
                        onChange={(e) => setManualExplanation(e.target.value)}
                        placeholder="Breve explicación..."
                        className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleApplyManualTokenTag}
                        className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                      >
                        Aplicar
                      </button>
                      {currentTokens[editingTokenIndex].type === 'error' && (
                        <button
                          type="button"
                          onClick={handleClearManualTokenTag}
                          className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-200"
                        >
                          Quitar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingTokenIndex(null)}
                        className="text-slate-600 text-xs px-2 py-1.5 hover:bg-slate-200 rounded-lg"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}

                {currentRubric && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Award size={15} className="text-indigo-600" />
                        Rúbrica Currículum Catalunya (Decret 175/2022 · 4t ESO)
                      </h4>
                      {currentRubric.misuApplied && (
                        <span className="text-xs font-semibold text-blue-800">
                          Adaptació MISU aplicada (Decret 150/2017)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs tabular-nums">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500">Adequació i coherència (CE3)</div>
                        <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                          {currentRubric.adequacioCoherencia ?? '-'} / 10
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500">Cohesió i estructura (CE3)</div>
                        <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                          {currentRubric.cohesioOrganitzacio ?? '-'} / 10
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500">Riquesa lèxica (CE3/CE5)</div>
                        <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                          {currentRubric.riquesaLexica ?? '-'} / 10
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500">Correcció lingüística (CE5)</div>
                        <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                          {currentRubric.correccioLinguistica ?? '-'} / 10
                        </div>
                      </div>
                    </div>

                    {currentRubric.feedback && (
                      <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                        <strong className="text-slate-900">Valoració competencial:</strong>{' '}
                        {currentRubric.feedback}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Grading & Weighting Bar */}
          <div className="bg-slate-50 border-t border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold text-slate-600">Calificación y ponderación</h3>
              <div className="flex items-center gap-2 text-xs text-slate-600 tabular-nums">
                <Sliders size={14} className="text-indigo-600" />
                <span>
                  Peso Draft: <strong>{draftWeight}%</strong> · Final: <strong>{finalWeight}%</strong>
                </span>
                <input
                  type="range"
                  min={10}
                  max={50}
                  step={5}
                  value={draftWeight}
                  aria-label="Peso porcentual del Draft"
                  onChange={(e) => setDraftWeight(Number(e.target.value))}
                  className="w-24 accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div
                className={`p-3 rounded-xl border ${
                  activePhase === 'draft'
                    ? 'bg-white border-emerald-400'
                    : 'bg-slate-100/70 border-slate-200'
                }`}
              >
                <label
                  htmlFor="grade-draft-input"
                  className="block text-xs font-semibold text-slate-600 mb-1 tabular-nums"
                >
                  Nota Draft ({draftWeight}%)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="grade-draft-input"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    placeholder="-"
                    value={draftGrade}
                    onChange={(e) => setDraftGrade(e.target.value)}
                    className="w-20 text-lg font-mono font-bold p-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 text-center bg-white tabular-nums"
                  />
                  <span className="text-slate-500 text-xs font-medium">/ 10</span>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  activePhase === 'final'
                    ? 'bg-white border-indigo-400'
                    : 'bg-slate-100/70 border-slate-200'
                }`}
              >
                <label
                  htmlFor="grade-final-input"
                  className="block text-xs font-semibold text-slate-600 mb-1 tabular-nums"
                >
                  Nota Final ({finalWeight}%)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="grade-final-input"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    placeholder="-"
                    value={finalGrade}
                    onChange={(e) => setFinalGrade(e.target.value)}
                    className="w-20 text-lg font-mono font-bold p-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-center bg-white tabular-nums"
                  />
                  <span className="text-slate-500 text-xs font-medium">/ 10</span>
                </div>
              </div>

              <div className="bg-indigo-600 text-white p-3 rounded-xl flex flex-col items-center justify-center tabular-nums">
                <div className="text-[11px] font-semibold text-indigo-100">Nota media final</div>
                <div className="text-2xl sm:text-3xl font-bold font-mono mt-0.5">
                  {computedAverage}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
