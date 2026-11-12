export type ErrorCodeKey =
  | 'Sp'
  | 'Gr'
  | 'T'
  | 'WO'
  | 'WW'
  | 'Prep'
  | 'S'
  | 'Cap'
  | '^'
  | '[]'
  | 'P';

export type Phase = 'draft' | 'final';

export type SubmissionStatus = 'pending' | 'scanned' | 'graded';

export interface Student {
  id: string;
  name: string;
  needsMISU: boolean;
}

export interface SchoolClass {
  id: string;
  name: string;
  students: Student[];
}

export interface Assignment {
  id: string;
  classId: string;
  title: string;
  systemPromptOCR: string;
}

export interface EssayToken {
  type: 'text' | 'error';
  val: string;
  id?: string;
  code?: ErrorCodeKey;
  correction?: string;
  explanation?: string;
}

export interface PdfAnnotation {
  id: string;
  pageIndex: number;
  xPercent: number;
  yPercent: number;
  code: ErrorCodeKey;
  correction: string;
  explanation: string;
}

export interface CurriculumRubric {
  adequacioCoherencia: number;
  cohesioOrganitzacio: number;
  riquesaLexica: number;
  correccioLinguistica: number;
  feedback?: string;
  misuApplied?: boolean;
}

export interface Submission {
  assignmentId: string;
  studentId: string;
  draftStatus: SubmissionStatus;
  draftPages: string[];
  draftText: string;
  draftTokens: EssayToken[];
  draftPdfAnnotations: PdfAnnotation[];
  draftRubric: CurriculumRubric | null;
  draftGrade: string;
  finalStatus: SubmissionStatus;
  finalPages: string[];
  finalText: string;
  finalTokens: EssayToken[];
  finalPdfAnnotations: PdfAnnotation[];
  finalRubric: CurriculumRubric | null;
  finalGrade: string;
  draftWeight: number;
  finalWeight: number;
}

export interface BulkPageBlock {
  id: string;
  pageNumbers: number[];
  images: string[];
  ocrText: string;
  detectedHeader: string;
  isContinuationPage: boolean;
  studentId: string;
  mergedCount: number;
  isRetrying: boolean;
}

export interface DetectedErrorItem {
  originalWord: string;
  occurrenceIndex: number;
  code: ErrorCodeKey;
  correction: string;
  explanation: string;
  box2d?: number[];
}

export interface EvaluationResponse {
  errors: DetectedErrorItem[];
  rubric: {
    adequacioCoherencia: number;
    cohesioOrganitzacio: number;
    riquesaLexica: number;
    correccioLinguistica: number;
  };
  suggestedGrade: number;
  curriculumFeedback: string;
}

export type AppView = 'dashboard' | 'class' | 'bulk_upload' | 'grade';
