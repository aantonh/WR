import type { Assignment, ErrorCodeKey, SchoolClass, Submission } from '../types';

export const INITIAL_CLASSES: SchoolClass[] = [
  {
    id: 'c_4q',
    name: '4º Q',
    students: [
      'Alan Atanes Castro',
      'Jamesa Bibi',
      'Mohamed Mellas',
      'Danna Sofia Reyes Moreno',
      'Alex Abad Borbely',
      'Adam Afghani Belamdini',
      'Nikolas Gabriel Bala Kucharek',
      'Joan Cristian Olaru Patrascan',
      'Carlos Alejandro Vieru',
      'Ismael El Bahlagui Atmani',
      'Amir El Mounadi Aboussaid',
      'Amal Erraoui Mendil',
      'Roger Giró Dolcet',
      'Jannat Kallouch',
      'Mariam Lahrour',
      'Ian López Seró',
      'Nil Muñoz Milà',
      'Maria Ioana Tene',
    ].map((name, i) => ({ id: `q_${i}`, name, needsMISU: i % 5 === 0 })),
  },
  {
    id: 'c_4r',
    name: '4º R',
    students: [
      'Jorge Andrés Calderón Zambrano',
      'Darius Vasilica Ciobanu',
      'Anabel Ioana Dragomir Broncs',
      'Hamza El Achaal Draya',
      'Adrià Estrella Castro',
      'Gabriela Sofia Orcasita Ortega',
      'Gabriel Serrano Lopez',
      'Adil Ahmad Kousar',
      'Erik Andrei Antof Peter',
      'Darius Daniel Bujor',
      'Toni Companys Bitrià',
      'Iker Exposito Colomina',
      'Genís Montoy Tomas',
      'Yostin Andrés González Mora',
      'Iris Ibarz Sisó',
      'Augustin Imbrea',
      'Saif Lebrigui El Haddoumi',
      'Nesrin Mhita El Hamidi',
      'Aaron Josué Pineda Rivas',
    ].map((name, i) => ({ id: `r_${i}`, name, needsMISU: i % 6 === 0 })),
  },
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'a_1',
    classId: 'c_4q',
    title: 'Unit 3: Opinion Essay',
    systemPromptOCR:
      'Write an opinion essay about social media (120-150 words). Use connectors of contrast and addition.',
  },
  {
    id: 'a_2',
    classId: 'c_4r',
    title: 'Unit 3: Narrative Story',
    systemPromptOCR:
      'Write a short mystery story starting with: "It was a dark and stormy night when the phone rang..." (120-150 words).',
  },
];

export const ERROR_CODES: Record<ErrorCodeKey, { desc: string; color: string }> = {
  Sp: { desc: 'Spelling', color: 'bg-red-100 text-red-800 border-red-300' },
  Gr: { desc: 'Grammar', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  T: { desc: 'Tense', color: 'bg-amber-100 text-amber-900 border-amber-300' },
  WO: { desc: 'Word Order', color: 'bg-sky-100 text-sky-900 border-sky-300' },
  WW: { desc: 'Wrong Word', color: 'bg-violet-100 text-violet-900 border-violet-300' },
  Prep: { desc: 'Preposition', color: 'bg-rose-100 text-rose-900 border-rose-300' },
  S: { desc: 'Subject', color: 'bg-teal-100 text-teal-900 border-teal-300' },
  Cap: { desc: 'Capitalization', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
  '^': { desc: 'Missing Word', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  '[]': { desc: 'Extra Word', color: 'bg-slate-200 text-slate-800 border-slate-400' },
  P: { desc: 'Punctuation', color: 'bg-stone-200 text-stone-800 border-stone-400' },
};

export function createEmptySubmission(assignmentId: string, studentId: string): Submission {
  return {
    assignmentId,
    studentId,
    draftStatus: 'pending',
    draftPages: [],
    draftText: '',
    draftTokens: [],
    draftPdfAnnotations: [],
    draftRubric: null,
    draftGrade: '',
    finalStatus: 'pending',
    finalPages: [],
    finalText: '',
    finalTokens: [],
    finalPdfAnnotations: [],
    finalRubric: null,
    finalGrade: '',
    draftWeight: 30,
    finalWeight: 70,
  };
}

export function generateInitialSubmissions(
  classes: SchoolClass[],
  assignments: Assignment[]
): Record<string, Submission> {
  const subs: Record<string, Submission> = {};
  assignments.forEach((assign) => {
    const cls = classes.find((c) => c.id === assign.classId);
    if (!cls) return;
    cls.students.forEach((student) => {
      const key = `${assign.id}_${student.id}`;
      subs[key] = createEmptySubmission(assign.id, student.id);
    });
  });
  return subs;
}
