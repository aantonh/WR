import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { DetectedErrorItem, EssayToken, Student } from '../types';
import { ERROR_CODES } from '../data/seed';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function renderPdfToImages(
  file: File,
  onProgress?: (current: number, total: number) => void,
  scale = 1.9
): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const images: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.85));
  }

  return images;
}

export async function renderFirstPdfPage(file: File, scale = 1.8): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL('image/jpeg', 0.88);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export const normalizeText = (str: string): string =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const levenshteinDistance = (a: string, b: string): number => {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
};

export function matchStudentFromOCR(
  ocrText: string,
  students: Student[],
  headerHint = ''
): { studentId: string; confidence: number; matchedSnippet: string } {
  const normText = normalizeText(ocrText);
  const normHeader = normalizeText(headerHint);
  const combinedHeader = normHeader || normalizeText(ocrText.split('\n').slice(0, 6).join(' '));
  if (!normText && !combinedHeader) return { studentId: '', confidence: 0, matchedSnippet: '' };

  const headerWords = combinedHeader.split(' ').filter((w) => w.length >= 3);
  const bodyWords = normText.split(' ').filter((w) => w.length >= 3);

  let bestStudentId = '';
  let bestScore = 0;

  students.forEach((student) => {
    const tokens = normalizeText(student.name)
      .split(' ')
      .filter((t) => t.length >= 3);
    if (tokens.length === 0) return;

    let score = 0;
    tokens.forEach((token, idx) => {
      const weight = idx === 0 ? 1.6 : 1.3;
      if (combinedHeader.includes(token)) {
        score += 2.5 * weight;
      } else if (headerWords.some((hw) => levenshteinDistance(hw, token) <= (token.length >= 6 ? 2 : 1))) {
        score += 2.0 * weight;
      } else if (normText.includes(token)) {
        score += 1.2 * weight;
      } else if (bodyWords.some((bw) => levenshteinDistance(bw, token) <= 1)) {
        score += 0.9 * weight;
      }
    });

    if (score > bestScore && score >= 2.2) {
      bestScore = score;
      bestStudentId = student.id;
    }
  });

  const lines = (headerHint || ocrText)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const firstLinesPreview = lines.slice(0, 2).join(' | ').slice(0, 85);

  return {
    studentId: bestStudentId,
    confidence: bestScore,
    matchedSnippet: firstLinesPreview || normText.slice(0, 85),
  };
}

export function applyErrorsToText(text: string, errors: DetectedErrorItem[] = []): EssayToken[] {
  if (!text) return [];
  const parts = text.split(/(\s+)/);
  const cleanWordIndices: Array<{
    partIndex: number;
    raw: string;
    clean: string;
    assignedError: { id: string; code: DetectedErrorItem['code']; correction: string; explanation: string } | null;
  }> = [];

  parts.forEach((part, idx) => {
    if (!/^\s+$/.test(part) && part !== '') {
      const stripped = part.replace(/^[.,!?;:"'()¿¡]+|[.,!?;:"'()¿¡]+$/g, '');
      cleanWordIndices.push({
        partIndex: idx,
        raw: part,
        clean: stripped.toLowerCase(),
        assignedError: null,
      });
    }
  });

  errors.forEach((err, errIdx) => {
    if (!err || !err.originalWord || !ERROR_CODES[err.code]) return;
    const targetPhrase = err.originalWord
      .trim()
      .split(/\s+/)[0]
      .replace(/^[.,!?;:"'()¿¡]+|[.,!?;:"'()¿¡]+$/g, '')
      .toLowerCase();
    if (!targetPhrase) return;

    const matchingSlots = cleanWordIndices.filter(
      (slot) => !slot.assignedError && (slot.clean === targetPhrase || slot.raw.toLowerCase().includes(targetPhrase))
    );

    if (matchingSlots.length > 0) {
      const desiredOcc = Math.max(0, (Number(err.occurrenceIndex) || 1) - 1);
      const chosenSlot = matchingSlots[Math.min(desiredOcc, matchingSlots.length - 1)];
      chosenSlot.assignedError = {
        id: `err_${errIdx}_${Date.now()}`,
        code: err.code,
        correction: err.correction || '',
        explanation: err.explanation || '',
      };
    }
  });

  const slotMap = new Map(cleanWordIndices.map((s) => [s.partIndex, s.assignedError]));

  return parts.map((part, idx) => {
    const err = slotMap.get(idx);
    if (err) {
      return {
        type: 'error',
        id: err.id,
        code: err.code,
        val: part,
        correction: err.correction,
        explanation: err.explanation,
      };
    }
    return { type: 'text', val: part };
  });
}
