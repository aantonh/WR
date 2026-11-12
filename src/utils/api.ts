import type { EvaluationResponse, Phase, Student } from '../types';
import { matchStudentFromOCR } from './pdfOcr';

export async function extractPromptFromImage(imageDataUrl: string): Promise<string> {
  const res = await fetch('/api/extract-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo extraer el texto de la imagen.');
  }
  return data.text || '';
}

export async function analyzeHandwrittenPage(
  imageDataUrl: string,
  students: Student[]
): Promise<{
  detectedNameRaw: string;
  studentId: string;
  isContinuationPage: boolean;
  transcribedText: string;
}> {
  const res = await fetch('/api/analyze-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageDataUrl,
      students: students.map((s) => ({ id: s.id, name: s.name })),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al analizar la hoja manuscrita.');
  }

  const validStudentId = students.some((s) => s.id === data.studentId)
    ? data.studentId
    : matchStudentFromOCR(data.detectedNameRaw || '', students, data.detectedNameRaw || '').studentId;

  return {
    detectedNameRaw: (data.detectedNameRaw || '').trim(),
    studentId: validStudentId || '',
    isContinuationPage: Boolean(data.isContinuationPage) && !validStudentId,
    transcribedText: (data.transcribedText || '').trim(),
  };
}

export async function evaluateEssayWithCurriculum(params: {
  text: string;
  pages: string[];
  assignmentPrompt: string;
  phase: Phase;
  needsMISU: boolean;
}): Promise<EvaluationResponse> {
  const res = await fetch('/api/evaluate-essay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: params.text,
      pageImageDataUrl: params.pages[0] || '',
      assignmentPrompt: params.assignmentPrompt,
      phase: params.phase,
      needsMISU: params.needsMISU,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al evaluar la redacción.');
  }
  return data as EvaluationResponse;
}
