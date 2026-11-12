import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Upload, FileText, CheckCircle, AlertCircle, 
  ZoomIn, ZoomOut, Save, ArrowLeft, Merge, User, Check, X, Sparkles, Sliders,
  Loader2, Eye, EyeOff, Trash2, FileUp, Tag, Plus, Award, RefreshCw
} from 'lucide-react';

// --- INITIAL DATA (SEED) ---
const INITIAL_CLASSES = [
  {
    id: 'c_4q',
    name: '4º Q',
    students: [
      "Alan Atanes Castro", "Jamesa Bibi", "Mohamed Mellas", "Danna Sofia Reyes Moreno", 
      "Alex Abad Borbely", "Adam Afghani Belamdini", "Nikolas Gabriel Bala Kucharek", 
      "Joan Cristian Olaru Patrascan", "Carlos Alejandro Vieru", "Ismael El Bahlagui Atmani", 
      "Amir El Mounadi Aboussaid", "Amal Erraoui Mendil", "Roger Giró Dolcet", "Jannat Kallouch", 
      "Mariam Lahrour", "Ian López Seró", "Nil Muñoz Milà", "Maria Ioana Tene"
    ].map((name, i) => ({ id: `q_${i}`, name, needsMISU: i % 5 === 0 }))
  },
  {
    id: 'c_4r',
    name: '4º R',
    students: [
      "Jorge Andrés Calderón Zambrano", "Darius Vasilica Ciobanu", "Anabel Ioana Dragomir Broncs", 
      "Hamza El Achaal Draya", "Adrià Estrella Castro", "Gabriela Sofia Orcasita Ortega", 
      "Gabriel Serrano Lopez", "Adil Ahmad Kousar", "Erik Andrei Antof Peter", "Darius Daniel Bujor", 
      "Toni Companys Bitrià", "Iker Exposito Colomina", "Genís Montoy Tomas", "Yostin Andrés González Mora", 
      "Iris Ibarz Sisó", "Augustin Imbrea", "Saif Lebrigui El Haddoumi", "Nesrin Mhita El Hamidi", "Aaron Josué Pineda Rivas"
    ].map((name, i) => ({ id: `r_${i}`, name, needsMISU: i % 6 === 0 }))
  }
];

const INITIAL_ASSIGNMENTS = [
  {
    id: 'a_1',
    classId: 'c_4q',
    title: 'Unit 3: Opinion Essay',
    systemPromptOCR: 'Write an opinion essay about social media (120-150 words). Use connectors of contrast and addition.'
  },
  {
    id: 'a_2',
    classId: 'c_4r',
    title: 'Unit 3: Narrative Story',
    systemPromptOCR: 'Write a short mystery story starting with: "It was a dark and stormy night when the phone rang..." (120-150 words).'
  }
];

const ERROR_CODES = {
  'Sp': { desc: 'Spelling', color: 'bg-red-200 text-red-800 border-red-300' },
  'Gr': { desc: 'Grammar', color: 'bg-orange-200 text-orange-800 border-orange-300' },
  'T': { desc: 'Tense', color: 'bg-yellow-200 text-yellow-800 border-yellow-300' },
  'WO': { desc: 'Word Order', color: 'bg-blue-200 text-blue-800 border-blue-300' },
  'WW': { desc: 'Wrong Word', color: 'bg-purple-200 text-purple-800 border-purple-300' },
  'Prep': { desc: 'Preposition', color: 'bg-pink-200 text-pink-800 border-pink-300' },
  'S': { desc: 'Subject', color: 'bg-teal-200 text-teal-800 border-teal-300' },
  'Cap': { desc: 'Capitalization', color: 'bg-indigo-200 text-indigo-800 border-indigo-300' },
  '^': { desc: 'Missing Word', color: 'bg-green-200 text-green-800 border-green-300' },
  '[]': { desc: 'Extra Word', color: 'bg-gray-200 text-gray-800 border-gray-400' },
  'P': { desc: 'Punctuation', color: 'bg-slate-300 text-slate-800 border-slate-400' },
};

// --- PDF & OCR BROWSER ENGINE (PDF.js + Tesseract.js) ---
const loadExternalScript = (src, globalCheck) => {
  return new Promise((resolve, reject) => {
    if (globalCheck()) return resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const ensurePdfJs = async () => {
  await loadExternalScript(
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    () => Boolean(window.pdfjsLib)
  );
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return window.pdfjsLib;
};

const ensureTesseract = async () => {
  await loadExternalScript(
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
    () => Boolean(window.Tesseract)
  );
  return window.Tesseract;
};

const normalizeText = (str) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshteinDistance = (a, b) => {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
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

const matchStudentFromOCR = (ocrText, students, headerHint = '') => {
  const normText = normalizeText(ocrText);
  const normHeader = normalizeText(headerHint);
  const combinedHeader = normHeader || normalizeText(ocrText.split('\n').slice(0, 6).join(' '));
  if (!normText && !combinedHeader) return { studentId: '', confidence: 0, matchedSnippet: '' };

  const headerWords = combinedHeader.split(' ').filter(w => w.length >= 3);
  const bodyWords = normText.split(' ').filter(w => w.length >= 3);

  let bestStudentId = '';
  let bestScore = 0;

  students.forEach((student) => {
    const tokens = normalizeText(student.name).split(' ').filter(t => t.length >= 3);
    if (tokens.length === 0) return;

    let score = 0;
    tokens.forEach((token, idx) => {
      const weight = idx === 0 ? 1.6 : 1.3;
      if (combinedHeader.includes(token)) {
        score += 2.5 * weight;
      } else if (headerWords.some(hw => levenshteinDistance(hw, token) <= (token.length >= 6 ? 2 : 1))) {
        score += 2.0 * weight;
      } else if (normText.includes(token)) {
        score += 1.2 * weight;
      } else if (bodyWords.some(bw => levenshteinDistance(bw, token) <= 1)) {
        score += 0.9 * weight;
      }
    });

    if (score > bestScore && score >= 2.2) {
      bestScore = score;
      bestStudentId = student.id;
    }
  });

  const lines = (headerHint || ocrText).split('\n').map(l => l.trim()).filter(Boolean);
  const firstLinesPreview = lines.slice(0, 2).join(' | ').slice(0, 85);
  return {
    studentId: bestStudentId,
    confidence: bestScore,
    matchedSnippet: firstLinesPreview || normText.slice(0, 85)
  };
};

// --- GEMINI 3 FLASH API CLIENT (WITH EXPONENTIAL BACKOFF) ---
const fetchGeminiWithBackoff = async (payload, maxRetries = 5) => {
  const apiKey = "";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return await response.json();
      }

      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const delayMs = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      if (attempt < maxRetries) {
        const delayMs = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
};

// --- MULTIMODAL HANDWRITING OCR & STUDENT ROSTER MATCHER ---
const analyzeHandwrittenPageWithGemini = async (imageUrl, students) => {
  try {
    const base64Data = imageUrl.split(',')[1];
    const mimeMatch = imageUrl.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const studentRoster = students.map(s => `- id: "${s.id}" | name: "${s.name}"`).join('\n');

    const prompt = `You are an expert Handwriting Text Recognition (HTR) specialist for secondary school (4t ESO, Catalonia) English essays.
Carefully examine this scanned handwritten worksheet:
1. STUDENT IDENTIFICATION: Read the handwritten student name and/or surname anywhere on the page (top header, name line, margin, or bottom). Match it to the closest student in this official class roster (accounting for Catalan/Spanish accents, partial names, or messy teenage handwriting):
${studentRoster}
2. CONTINUATION CHECK: Set "isContinuationPage" to true ONLY if there is clearly no student name on the sheet and the text is a continuation (page 2) of an essay.
3. VERBATIM HANDWRITING TRANSCRIPTION: Transcribe the entire handwritten English essay faithfully line by line and word for word.
CRITICAL RULE: Do NOT fix, normalize, or autocorrect the student's spelling mistakes, grammar errors, missing capitalization (such as lowercase "i"), wrong verb tenses, or punctuation mistakes. Transcribe the exact letters/words the student wrote so the teacher can grade them with error codes.`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        responseSchema: {
          type: 'OBJECT',
          properties: {
            detectedNameRaw: {
              type: 'STRING',
              description: 'Exact handwritten name/header string read from the scan, or empty string if none.'
            },
            studentId: {
              type: 'STRING',
              description: 'Exact student id from the provided roster if matched, or empty string if unmatched.'
            },
            isContinuationPage: {
              type: 'BOOLEAN',
              description: 'True if this page has no name and appears to continue a previous student essay.'
            },
            transcribedText: {
              type: 'STRING',
              description: 'Verbatim transcription of the handwritten English text preserving original student errors.'
            }
          },
          required: ['detectedNameRaw', 'studentId', 'isContinuationPage', 'transcribedText']
        }
      }
    };

    const result = await fetchGeminiWithBackoff(payload);
    const rawJson = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(rawJson);

    const validStudentId = students.some(s => s.id === parsed.studentId)
      ? parsed.studentId
      : matchStudentFromOCR(parsed.detectedNameRaw || '', students, parsed.detectedNameRaw || '').studentId;

    return {
      detectedNameRaw: (parsed.detectedNameRaw || '').trim(),
      studentId: validStudentId || '',
      isContinuationPage: Boolean(parsed.isContinuationPage) && !validStudentId,
      transcribedText: (parsed.transcribedText || '').trim()
    };
  } catch (err) {
    // Fallback silencioso a OCR local solo si no hay conexión con la API
    const Tesseract = await ensureTesseract();
    const res = await Tesseract.recognize(imageUrl, 'eng+spa');
    const fullText = (res?.data?.text || '').trim();
    const match = matchStudentFromOCR(fullText, students);
    return {
      detectedNameRaw: match.matchedSnippet,
      studentId: match.studentId,
      isContinuationPage: !match.studentId && fullText.split(/\s+/).length > 25,
      transcribedText: fullText
    };
  }
};

// --- ALINEACIÓN DE ERRORES SOBRE EL TEXTO TRANSCRITO ---
const applyErrorsToText = (text, errors = []) => {
  if (!text) return [];
  const parts = text.split(/(\s+)/);
  const cleanWordIndices = [];

  parts.forEach((part, idx) => {
    if (!/^\s+$/.test(part) && part !== '') {
      const stripped = part.replace(/^[.,!?;:"'()¿¡]+|[.,!?;:"'()¿¡]+$/g, '');
      cleanWordIndices.push({
        partIndex: idx,
        raw: part,
        clean: stripped.toLowerCase(),
        assignedError: null
      });
    }
  });

  errors.forEach((err, errIdx) => {
    if (!err || !err.originalWord || !ERROR_CODES[err.code]) return;
    const targetPhrase = err.originalWord.trim().split(/\s+/)[0].replace(/^[.,!?;:"'()¿¡]+|[.,!?;:"'()¿¡]+$/g, '').toLowerCase();
    if (!targetPhrase) return;

    const matchingSlots = cleanWordIndices.filter(
      slot => !slot.assignedError && (slot.clean === targetPhrase || slot.raw.toLowerCase().includes(targetPhrase))
    );

    if (matchingSlots.length > 0) {
      const desiredOcc = Math.max(0, (Number(err.occurrenceIndex) || 1) - 1);
      const chosenSlot = matchingSlots[Math.min(desiredOcc, matchingSlots.length - 1)];
      chosenSlot.assignedError = {
        id: `err_${errIdx}_${Date.now()}`,
        code: err.code,
        correction: err.correction || '',
        explanation: err.explanation || ''
      };
    }
  });

  const slotMap = new Map(cleanWordIndices.map(s => [s.partIndex, s.assignedError]));

  return parts.map((part, idx) => {
    const err = slotMap.get(idx);
    if (err) {
      return {
        type: 'error',
        id: err.id,
        code: err.code,
        val: part,
        correction: err.correction,
        explanation: err.explanation
      };
    }
    return { type: 'text', val: part };
  });
};

// --- MOTOR DE CORRECCIÓN SEGÚN CURRÍCULUM DE CATALUÑA (DECRET 175/2022 - 4t ESO) ---
const evaluateEssayWithCatalanCurriculum = async ({ text, pages, assignmentPrompt, phase, needsMISU }) => {
  const systemInstruction = `Ets un docent expert d'Anglès de Secundària a Catalunya que avalua redaccions de 4t d'ESO segons el Currículum d'Educació Bàsica de Catalunya (Decret 175/2022, de 27 de setembre):
- Competència específica 3 (CE3): Produir textos escrits i multimodals de certa extensió, coherents, cohesionats i adequats a la situació comunicativa (nivell A2+/B1 del MECR).
- Competència específica 5 (CE5): Reflexionar sobre el funcionament de la llengua anglesa (morfosintaxi, lèxic, ortografia i puntuació) per millorar la producció pròpia.
- Context de fase: "${phase === 'draft' ? 'DRAFT (Borrador inicial a aula sense diccionari ni ajudes externes)' : 'FINAL VERSION (Versió reescrita i millorada després de feedback)'}".
${needsMISU
  ? `- MESURA INCLUSIVA ACTIVA (MISU - Decret 150/2017, Dislèxia / TDAH): Aplica flexibilitat ortogràfica i formal. NO penalitzis faltes d'ortografia fonètica ('Sp') ni petits descuits de puntuació ('P') si la paraula és comprensible en context. Prioritza la coherència comunicativa, l'estructura d'idees, l'adequació a l'enunciat i el lèxic.`
  : `- Avaluació ordinària (sense MISU): Aplica els criteris estàndard de 4t d'ESO de Catalunya equilibrant comunicació i precisió formal.`}

CODIS D'ERROR ESTRICTS PER MARCAR AL TEXT:
- "Sp": Spelling (paraula mal escrita ortogràficament)
- "Gr": Grammar (concordança subjecte-verb, plural, articles, estructura gramatical)
- "T": Tense (temps o forma verbal incorrecta)
- "WO": Word Order (ordre incorrecte de les paraules a l'oració)
- "WW": Wrong Word (elecció lèxica incorrecta o fals amic)
- "Prep": Preposition (preposició errònia o absent)
- "S": Subject (omissió del subjecte obligatori en anglès)
- "Cap": Capitalization (majúscula absent en 'I', noms propis, idiomes, dies/mesos)
- "^": Missing Word (falta una paraula just abans o al lloc indicat)
- "[]": Extra Word (sobra aquesta paraula innecessària)
- "P": Punctuation (puntuació incorrecta o absent)`;

  const userPrompt = `Enunciat de la tasca (System Prompt): "${assignmentPrompt}"

Text transcrit de l'alumne a corregir i marcar:
"""
${text}
"""

Analitza el text mot per mot i retorna:
1. Tots els errors detectats amb el seu codi exacte ("Sp", "Gr", "T", "WO", "WW", "Prep", "S", "Cap", "^", "[]", "P"), la paraula exacta del text ("originalWord"), el número d'aparició d'aquesta paraula ("occurrenceIndex", començant per 1), la correcció suggerida ("correction"), una breu explicació pedagògica en català/castellà ("explanation"), i si s'adjunta la imatge escanejada, les coordenades aproximades [ymin, xmin, ymax, xmax] (escala 0-1000) on apareix l'error a la fulla 1.
2. Les 4 dimensions de la rúbrica del Currículum de Catalunya (0 a 10):
   - adequacioCoherencia (CE3.1)
   - cohesioOrganitzacio (CE3.2)
   - riquesaLexica (CE3.3 / CE5)
   - correccioLinguistica (CE5)
3. La nota global suggerida (0 a 10) i un comentari formatiu breu alineat amb el Decret 175/2022.`;

  const parts = [{ text: userPrompt }];
  if (pages && pages.length > 0 && pages[0].startsWith('data:image')) {
    const base64Data = pages[0].split(',')[1];
    const mimeMatch = pages[0].match(/^data:([^;]+);base64,/);
    parts.push({
      inlineData: {
        mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
        data: base64Data
      }
    });
  }

  const payload = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.15,
      responseSchema: {
        type: 'OBJECT',
        properties: {
          errors: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                originalWord: { type: 'STRING' },
                occurrenceIndex: { type: 'INTEGER' },
                code: {
                  type: 'STRING',
                  enum: ['Sp', 'Gr', 'T', 'WO', 'WW', 'Prep', 'S', 'Cap', '^', '[]', 'P']
                },
                correction: { type: 'STRING' },
                explanation: { type: 'STRING' },
                box2d: {
                  type: 'ARRAY',
                  items: { type: 'INTEGER' }
                }
              },
              required: ['originalWord', 'occurrenceIndex', 'code', 'correction', 'explanation']
            }
          },
          rubric: {
            type: 'OBJECT',
            properties: {
              adequacioCoherencia: { type: 'NUMBER' },
              cohesioOrganitzacio: { type: 'NUMBER' },
              riquesaLexica: { type: 'NUMBER' },
              correccioLinguistica: { type: 'NUMBER' }
            },
            required: ['adequacioCoherencia', 'cohesioOrganitzacio', 'riquesaLexica', 'correccioLinguistica']
          },
          suggestedGrade: { type: 'NUMBER' },
          curriculumFeedback: { type: 'STRING' }
        },
        required: ['errors', 'rubric', 'suggestedGrade', 'curriculumFeedback']
      }
    }
  };

  const result = await fetchGeminiWithBackoff(payload);
  const rawJson = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(rawJson);
};

// Todos los alumnos empiezan SIN entregas ni notas inventadas
const generateInitialSubmissions = (classes, assignments) => {
  const subs = {};
  assignments.forEach(assign => {
    const cls = classes.find(c => c.id === assign.classId);
    if (!cls) return;
    cls.students.forEach((student) => {
      const key = `${assign.id}_${student.id}`;
      subs[key] = {
        assignmentId: assign.id,
        studentId: student.id,
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
        finalWeight: 70
      };
    });
  });
  return subs;
};

// --- COMPONENTS ---

// 1. NEW ASSIGNMENT MODAL
const NewAssignmentModal = ({ classes, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [promptText, setPromptText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleExtractInstructionOCR = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsScanning(true);

    try {
      let imageUrl = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pdfjsLib = await ensurePdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.8 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        imageUrl = canvas.toDataURL('image/jpeg', 0.9);
      } else {
        imageUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      }

      const base64Data = imageUrl.split(',')[1];
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Extract the complete English writing prompt / instructions from this worksheet image accurately as plain text.' },
              { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
            ]
          }
        ]
      };
      const result = await fetchGeminiWithBackoff(payload);
      const extracted = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      setPromptText(extracted || 'No se pudo detectar texto. Escribe el enunciado aquí.');
    } catch (err) {
      setPromptText('Error al leer el archivo. Por favor, escribe o pega el enunciado manualmente.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !classId) return;
    onSave({
      id: `a_${Date.now()}`,
      classId,
      title: title.trim(),
      systemPromptOCR: promptText.trim() || 'Standard secondary school English writing evaluation criteria.'
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="text-indigo-600" size={20} /> Nueva Tarea de Writing
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Clase Destino</label>
            <select 
              value={classId} 
              onChange={(e) => setClassId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-indigo-500"
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.students.length} alumnos)</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Título de la Tarea</label>
            <input 
              type="text" 
              required
              placeholder="Ej: Unit 4: For and Against Essay"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Instrucciones / Enunciado (OCR para IA)</label>
            <div className="mb-2">
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-lg p-3 cursor-pointer transition text-sm font-medium">
                {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {isScanning ? 'Extrayendo texto con OCR...' : fileName ? `Archivo cargado: ${fileName}` : 'Subir PDF o Imagen del enunciado (OCR real)'}
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleExtractInstructionOCR} />
              </label>
            </div>
            <textarea 
              rows={4}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="El texto extraído aparecerá aquí o puedes escribirlo directamente..."
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">
              Cancelar
            </button>
            <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow">
              Crear Tarea
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. DASHBOARD COMPONENT
const Dashboard = ({ classes, assignments, onSelectClass, onOpenNewAssignment }) => (
  <div className="p-8 max-w-6xl mx-auto">
    <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <BookOpen className="text-indigo-600" size={32} />
          WritingMaster AI
        </h1>
        <p className="text-slate-500 mt-1">Gestión, OCR y Corrección de Redacciones en Inglés (Secundaria)</p>
      </div>
      <button 
        onClick={onOpenNewAssignment}
        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow hover:bg-indigo-700 transition flex items-center gap-2 font-medium w-fit"
      >
        <Upload size={18} /> Nueva Tarea
      </button>
    </header>

    <h2 className="text-xl font-semibold text-slate-700 mb-4">Tus Clases</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {classes.map(cls => {
        const classAssignments = assignments.filter(a => a.classId === cls.id);
        return (
          <div 
            key={cls.id} 
            onClick={() => onSelectClass(cls)}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 cursor-pointer transition flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-800 group-hover:text-indigo-600 transition">{cls.name}</h3>
                <p className="text-slate-500">{cls.students.length} Alumnos matriculados</p>
              </div>
              <FileText className="text-slate-300 group-hover:text-indigo-200 transition" size={44} />
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-600 font-medium">{classAssignments.length} {classAssignments.length === 1 ? 'tarea activa' : 'tareas activas'}</span>
              <span className="text-indigo-600 font-semibold group-hover:translate-x-1 transition-transform">Entrar →</span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// 3. CLASS VIEW COMPONENT
const ClassView = ({ cls, assignments, submissions, onBack, onUploadBulk, onGradeStudent, onToggleStudentMisu, onOpenNewAssignment }) => {
  const classAssignments = assignments.filter(a => a.classId === cls.id);
  const [selectedAssignId, setSelectedAssignId] = useState(classAssignments[0]?.id || '');
  
  const currentAssign = classAssignments.find(a => a.id === selectedAssignId) || classAssignments[0];

  const uploadedDraftCount = currentAssign
    ? cls.students.filter(s => (submissions[`${currentAssign.id}_${s.id}`]?.draftStatus || 'pending') !== 'pending').length
    : 0;
  const uploadedFinalCount = currentAssign
    ? cls.students.filter(s => (submissions[`${currentAssign.id}_${s.id}`]?.finalStatus || 'pending') !== 'pending').length
    : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium w-fit">
          <ArrowLeft size={18} /> Volver al Dashboard
        </button>
        <button onClick={onOpenNewAssignment} className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
          + Añadir tarea a {cls.name}
        </button>
      </div>
      
      {currentAssign ? (
        <>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="bg-indigo-100 text-indigo-800 font-bold px-3 py-1 rounded-lg text-sm">{cls.name}</span>
                {classAssignments.length > 1 ? (
                  <select 
                    value={currentAssign.id}
                    onChange={(e) => setSelectedAssignId(e.target.value)}
                    className="text-xl font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-indigo-500"
                  >
                    {classAssignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                  </select>
                ) : (
                  <h1 className="text-2xl font-bold text-slate-800">{currentAssign.title}</h1>
                )}
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  Drafts: {uploadedDraftCount}/{cls.students.length} · Finals: {uploadedFinalCount}/{cls.students.length}
                </span>
              </div>
              <p className="text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="font-semibold text-slate-700">System Prompt (OCR):</span> "{currentAssign.systemPromptOCR}"
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => onUploadBulk(currentAssign.id, 'draft')} 
                className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-sm hover:bg-emerald-700 transition flex items-center gap-2 text-sm font-medium"
              >
                <Upload size={16} /> Subir PDF Masivo (Draft)
              </button>
              <button 
                onClick={() => onUploadBulk(currentAssign.id, 'final')} 
                className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg shadow-sm hover:bg-indigo-700 transition flex items-center gap-2 text-sm font-medium"
              >
                <Upload size={16} /> Subir PDF Masivo (Final)
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-4 font-semibold">Alumno</th>
                  <th className="p-4 font-semibold">Draft (Sin ayudas)</th>
                  <th className="p-4 font-semibold">Final Version</th>
                  <th className="p-4 font-semibold text-center">Nota Final</th>
                  <th className="p-4 font-semibold text-right">Acciones de Corrección</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {cls.students.map((student) => {
                  const subKey = `${currentAssign.id}_${student.id}`;
                  const sub = submissions[subKey] || { draftStatus: 'pending', finalStatus: 'pending', draftWeight: 30, finalWeight: 70 };
                  
                  const dGrade = parseFloat(sub.draftGrade);
                  const fGrade = parseFloat(sub.finalGrade);
                  let weightedAvg = '-';
                  if (!isNaN(dGrade) && !isNaN(fGrade)) {
                    weightedAvg = ((dGrade * (sub.draftWeight / 100)) + (fGrade * (sub.finalWeight / 100))).toFixed(1);
                  } else if (!isNaN(dGrade)) {
                    weightedAvg = `${dGrade.toFixed(1)} (solo draft)`;
                  } else if (!isNaN(fGrade)) {
                    weightedAvg = `${fGrade.toFixed(1)} (solo final)`;
                  }

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <User size={16} className="text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800">{student.name}</span>
                          <button
                            onClick={() => onToggleStudentMisu(cls.id, student.id)}
                            title="Clic para activar/desactivar adaptación MISU"
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold transition ${
                              student.needsMISU 
                                ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                                : 'bg-slate-100 text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            {student.needsMISU ? 'MISU Activo' : '+ MISU'}
                          </button>
                        </div>
                      </td>
                      <td className="p-4">
                        {sub.draftStatus === 'graded' && (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 font-medium">
                            <CheckCircle size={14}/> Nota: {sub.draftGrade}
                          </span>
                        )}
                        {sub.draftStatus === 'scanned' && (
                          <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 font-medium">
                            <AlertCircle size={14}/> Escaneado ({sub.draftPages?.length || 1} pág.)
                          </span>
                        )}
                        {sub.draftStatus === 'pending' && <span className="text-slate-400">Sin entregar</span>}
                      </td>
                      <td className="p-4">
                        {sub.finalStatus === 'graded' && (
                          <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 font-medium">
                            <CheckCircle size={14}/> Nota: {sub.finalGrade}
                          </span>
                        )}
                        {sub.finalStatus === 'scanned' && (
                          <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 font-medium">
                            <AlertCircle size={14}/> Escaneado ({sub.finalPages?.length || 1} pág.)
                          </span>
                        )}
                        {sub.finalStatus === 'pending' && <span className="text-slate-400">Sin entregar</span>}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-700">
                        {weightedAvg}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button 
                          onClick={() => onGradeStudent(student, currentAssign, 'draft')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            sub.draftStatus !== 'pending' 
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {sub.draftStatus !== 'pending' ? 'Corregir Draft' : 'Subir/Ver Draft'}
                        </button>
                        <button 
                          onClick={() => onGradeStudent(student, currentAssign, 'final')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            sub.finalStatus !== 'pending' 
                              ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200' 
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {sub.finalStatus !== 'pending' ? 'Corregir Final' : 'Subir/Ver Final'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 mb-4">No hay tareas creadas todavía para {cls.name}.</p>
          <button 
            onClick={onOpenNewAssignment}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition"
          >
            Crear Primera Tarea
          </button>
        </div>
      )}
    </div>
  );
};

// 4. BULK UPLOAD VALIDATION COMPONENT (Real PDF Splitter & HTR Matcher)
const BulkUploadValidation = ({ cls, phase, onCancel, onComplete }) => {
  const [pages, setPages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [progressInfo, setProgressInfo] = useState({ current: 0, total: 0, step: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [previewImage, setPreviewImage] = useState(null);

  const handleFileSelected = async (file) => {
    if (!file) return;
    setPdfFile(file);
    setErrorMsg('');
    setIsProcessing(true);
    setPages([]);
    setProgressInfo({ current: 0, total: 0, step: 'Cargando motor PDF...' });

    try {
      const pdfjsLib = await ensurePdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      const renderedPages = [];
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        setProgressInfo({
          current: pageNum,
          total: numPages,
          step: `Renderizando página ${pageNum} de ${numPages} a alta resolución...`
        });
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const imageUrl = canvas.toDataURL('image/jpeg', 0.88);

        renderedPages.push({ pageNum, imageUrl });
      }

      // 2. Analizar escritura manuscrita y nombres con Gemini Vision en lotes de 3 páginas
      const extractedPages = new Array(numPages);
      let completedCount = 0;
      const BATCH_SIZE = 3;

      for (let i = 0; i < renderedPages.length; i += BATCH_SIZE) {
        const batch = renderedPages.slice(i, i + BATCH_SIZE);
        setProgressInfo({
          current: completedCount,
          total: numPages,
          step: `Leyendo nombres manuscritos y transcribiendo hojas (${completedCount}/${numPages})...`
        });

        await Promise.all(
          batch.map(async (item, batchIdx) => {
            const globalIdx = i + batchIdx;
            try {
              const analysis = await analyzeHandwrittenPageWithGemini(item.imageUrl, cls.students);
              extractedPages[globalIdx] = {
                id: `p_${item.pageNum}_${Date.now()}_${globalIdx}`,
                pageNumbers: [item.pageNum],
                images: [item.imageUrl],
                ocrText: analysis.transcribedText,
                detectedHeader: analysis.detectedNameRaw,
                isContinuationPage: analysis.isContinuationPage,
                studentId: analysis.studentId,
                mergedCount: 1,
                isRetrying: false
              };
            } catch (pageErr) {
              extractedPages[globalIdx] = {
                id: `p_${item.pageNum}_${Date.now()}_${globalIdx}`,
                pageNumbers: [item.pageNum],
                images: [item.imageUrl],
                ocrText: '',
                detectedHeader: '',
                isContinuationPage: false,
                studentId: '',
                mergedCount: 1,
                isRetrying: false
              };
            } finally {
              completedCount += 1;
              setProgressInfo({
                current: completedCount,
                total: numPages,
                step: `Leyendo nombres manuscritos y transcribiendo hojas (${completedCount}/${numPages})...`
              });
            }
          })
        );
      }

      setPages(extractedPages);
    } catch (err) {
      setErrorMsg('No se pudo procesar el PDF. Verifica que no esté protegido con contraseña e inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryPageOcr = async (index) => {
    const target = pages[index];
    if (!target || !target.images?.[0]) return;

    setPages(prev => prev.map((p, idx) => idx === index ? { ...p, isRetrying: true } : p));
    try {
      const analysis = await analyzeHandwrittenPageWithGemini(target.images[0], cls.students);
      setPages(prev => prev.map((p, idx) => idx === index ? {
        ...p,
        ocrText: analysis.transcribedText || p.ocrText,
        detectedHeader: analysis.detectedNameRaw,
        isContinuationPage: analysis.isContinuationPage,
        studentId: analysis.studentId || p.studentId,
        isRetrying: false
      } : p));
    } catch (err) {
      setPages(prev => prev.map((p, idx) => idx === index ? { ...p, isRetrying: false } : p));
    }
  };

  const handleMerge = (index) => {
    if (index === 0) return;
    const newPages = [...pages];
    const prev = newPages[index - 1];
    const curr = newPages[index];

    prev.mergedCount += curr.mergedCount;
    prev.pageNumbers = [...prev.pageNumbers, ...curr.pageNumbers];
    prev.images = [...prev.images, ...curr.images];
    prev.ocrText = [prev.ocrText, curr.ocrText].filter(Boolean).join('\n\n--- Página siguiente ---\n\n');

    newPages.splice(index, 1);
    setPages(newPages);
  };

  const handleRemovePage = (index) => {
    const newPages = [...pages];
    newPages.splice(index, 1);
    setPages(newPages);
  };

  const handleConfirm = () => {
    const assignedBlocks = pages.filter(p => Boolean(p.studentId));
    onComplete(assignedBlocks);
  };

  const assignedCount = pages.filter(p => Boolean(p.studentId)).length;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded ${phase === 'draft' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
            Fase: {phase === 'draft' ? 'Draft (Borrador)' : 'Final Version'}
          </span>
          <h2 className="text-2xl font-bold text-slate-800 mt-2">Subida Masiva y Separación de PDF ({cls.name})</h2>
          <p className="text-slate-500 text-sm">Sube el PDF escaneado con los writings de la clase. El sistema separará cada hoja, detectará los nombres y te permitirá unir páginas del mismo alumno.</p>
        </div>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 font-medium text-sm flex items-center gap-1.5">
          <ArrowLeft size={16} /> Volver a {cls.name}
        </button>
      </div>

      {/* ZONA DE SUBIDA DE ARCHIVO */}
      {!isProcessing && pages.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-300 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileUp size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Selecciona el PDF masivo escaneado</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Cada página se renderizará en alta definición y será leída con <strong>IA Visión Manuscrita</strong> para reconocer nombres escritos a mano y transcribir cada redacción de {cls.name}.
          </p>

          {errorMsg && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg max-w-md mx-auto">
              {errorMsg}
            </div>
          )}

          <label className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow hover:bg-indigo-700 cursor-pointer transition">
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

      {/* BARRA DE PROGRESO MIENTRAS SEPARA Y LEE OCR */}
      {isProcessing && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
          <Loader2 size={40} className="animate-spin text-indigo-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">Procesando "{pdfFile?.name}"</h3>
          <p className="text-sm text-slate-600 mb-4">{progressInfo.step}</p>
          {progressInfo.total > 0 && (
            <div className="max-w-md mx-auto">
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${Math.round((progressInfo.current / progressInfo.total) * 100)}%` }}
                />
              </div>
              <div className="text-xs font-semibold text-slate-500 mt-2">
                Página {progressInfo.current} de {progressInfo.total}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANEL DE VALIDACIÓN SPLIT & MATCH */}
      {!isProcessing && pages.length > 0 && (
        <>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-indigo-900">
              <strong>Archivo:</strong> {pdfFile?.name} · <strong>{pages.length} bloques</strong> detectados · <strong>{assignedCount} asignados</strong> a alumnos.
            </div>
            <label className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 cursor-pointer underline">
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
              <div key={page.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-5">
                {/* Miniatura real de la hoja del PDF */}
                <div 
                  onClick={() => setPreviewImage(page.images[0])}
                  className="w-28 h-36 bg-slate-100 rounded-lg border border-slate-300 overflow-hidden relative shrink-0 cursor-zoom-in group shadow-inner"
                  title="Clic para ampliar esta hoja"
                >
                  <img src={page.images[0]} alt={`Página ${page.pageNumbers.join(',')}`} className="w-full h-full object-cover object-top" />
                  <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition flex items-center justify-center">
                    <Eye className="text-white opacity-0 group-hover:opacity-100 transition" size={22} />
                  </div>
                  <div className="absolute bottom-1 left-1 right-1 bg-slate-900/75 text-white text-[10px] font-bold px-1.5 py-0.5 rounded text-center">
                    {page.mergedCount > 1 ? `Págs ${page.pageNumbers.join('+')}` : `Pág ${page.pageNumbers[0]}`}
                  </div>
                </div>
                
                {/* Texto OCR extraído */}
                <div className="flex-1 w-full min-w-0">
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-1 flex items-center justify-between gap-2">
                    <span>Transcripción Manuscrita IA ({page.ocrText ? `${page.ocrText.split(/\s+/).length} palabras` : '0 palabras'}):</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleRetryPageOcr(index)}
                        disabled={page.isRetrying}
                        className="text-emerald-700 hover:underline normal-case font-medium flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={page.isRetrying ? 'animate-spin' : ''} />
                        {page.isRetrying ? 'Leyendo...' : 'Releer IA'}
                      </button>
                      <button 
                        onClick={() => setPreviewImage(page.images[0])}
                        className="text-indigo-600 hover:underline normal-case font-medium flex items-center gap-1"
                      >
                        <Eye size={12} /> Ver hoja
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-700 max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {page.ocrText || '(No se detectó texto automático; podrás escribirlo o editarlo en la pantalla de corrección)'}
                  </div>
                </div>

                {/* Selector de alumno */}
                <div className="flex-1 w-full">
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-1 flex items-center justify-between gap-1">
                    <span>Alumno de {cls.name}:</span>
                    {page.detectedHeader && (
                      <span className="text-[11px] normal-case font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded truncate max-w-[170px]" title={`Nombre manuscrito detectado: ${page.detectedHeader}`}>
                        Leído: "{page.detectedHeader}"
                      </span>
                    )}
                  </div>
                  <select 
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    value={page.studentId || ""}
                    onChange={(e) => {
                      const newPages = [...pages];
                      newPages[index].studentId = e.target.value;
                      setPages(newPages);
                    }}
                  >
                    <option value="">-- Ignorar / Sin asignar --</option>
                    {cls.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Botones de acción por página */}
                <div className="flex md:flex-col gap-2 shrink-0">
                  {index > 0 && (
                    <button 
                      onClick={() => handleMerge(index)} 
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                        page.isContinuationPage
                          ? 'text-amber-900 bg-amber-100 border-amber-300 hover:bg-amber-200'
                          : 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
                      }`}
                    >
                      <Merge size={14} /> {page.isContinuationPage ? '2ª pág. → Unir' : 'Unir a anterior'}
                    </button>
                  )}
                  {page.studentId ? (
                    <div className="flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                      <Check size={14} /> Emparejado
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                      <AlertCircle size={14} /> Sin asignar
                    </div>
                  )}
                  <button
                    onClick={() => handleRemovePage(index)}
                    className="flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-red-600 px-2 py-1 rounded transition"
                    title="Descartar esta página"
                  >
                    <Trash2 size={13} /> Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <button onClick={onCancel} className="px-6 py-2.5 rounded-lg text-slate-600 hover:bg-slate-200 font-medium transition">
              Cancelar
            </button>
            <button 
              onClick={handleConfirm} 
              disabled={assignedCount === 0}
              className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white shadow hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 font-medium transition"
            >
              <Save size={18} /> Guardar {assignedCount} {assignedCount === 1 ? 'Writing Asignado' : 'Writings Asignados'}
            </button>
          </div>
        </>
      )}

      {/* Modal de vista previa ampliada de una hoja del PDF */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-3xl max-h-[90vh] overflow-auto bg-white rounded-xl p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setPreviewImage(null)}
              className="sticky top-2 float-right bg-slate-900 text-white p-1.5 rounded-full hover:bg-slate-700"
            >
              <X size={18} />
            </button>
            <img src={previewImage} alt="Vista ampliada" className="w-full h-auto rounded" />
          </div>
        </div>
      )}
    </div>
  );
};

// 5. GRADING INTERFACE (Split Screen)
const GradingInterface = ({ student, assignment, initialPhase, submissionData, onSaveSubmission, onToggleStudentMisu, onBack }) => {
  const [activePhase, setActivePhase] = useState(initialPhase); // 'draft' or 'final'
  const [zoom, setZoom] = useState(100);
  const [isEditingText, setIsEditingText] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRetranscribing, setIsRetranscribing] = useState(false);
  const [isUploadingSingle, setIsUploadingSingle] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState('');

  // Marcado interactivo sobre el PDF
  const [pdfMarkMode, setPdfMarkMode] = useState(false);
  const [selectedPdfCode, setSelectedPdfCode] = useState('Sp');
  const [showPdfAnnotations, setShowPdfAnnotations] = useState(true);

  // Popover de edición manual de etiquetas en el texto transcrito
  const [editingTokenIndex, setEditingTokenIndex] = useState(null);
  const [manualCode, setManualCode] = useState('Sp');
  const [manualCorrection, setManualCorrection] = useState('');
  const [manualExplanation, setManualExplanation] = useState('');

  // Estados locales sincronizados con submissionData
  const [draftPages, setDraftPages] = useState(submissionData.draftPages || []);
  const [finalPages, setFinalPages] = useState(submissionData.finalPages || []);
  const [draftText, setDraftText] = useState(submissionData.draftText || '');
  const [finalText, setFinalText] = useState(submissionData.finalText || '');
  const [draftTokens, setDraftTokens] = useState(submissionData.draftTokens || []);
  const [finalTokens, setFinalTokens] = useState(submissionData.finalTokens || []);
  const [draftPdfAnnotations, setDraftPdfAnnotations] = useState(submissionData.draftPdfAnnotations || []);
  const [finalPdfAnnotations, setFinalPdfAnnotations] = useState(submissionData.finalPdfAnnotations || []);
  const [draftRubric, setDraftRubric] = useState(submissionData.draftRubric || null);
  const [finalRubric, setFinalRubric] = useState(submissionData.finalRubric || null);
  const [draftGrade, setDraftGrade] = useState(submissionData.draftGrade || '');
  const [finalGrade, setFinalGrade] = useState(submissionData.finalGrade || '');
  const [draftWeight, setDraftWeight] = useState(submissionData.draftWeight ?? 30);

  const currentPages = activePhase === 'draft' ? draftPages : finalPages;
  const setCurrentPages = activePhase === 'draft' ? setDraftPages : setFinalPages;
  const currentText = activePhase === 'draft' ? draftText : finalText;
  const setCurrentText = activePhase === 'draft' ? setDraftText : setFinalText;
  const currentTokens = activePhase === 'draft' ? draftTokens : finalTokens;
  const setCurrentTokens = activePhase === 'draft' ? setDraftTokens : setFinalTokens;
  const currentPdfAnnotations = activePhase === 'draft' ? draftPdfAnnotations : finalPdfAnnotations;
  const setCurrentPdfAnnotations = activePhase === 'draft' ? setDraftPdfAnnotations : setFinalPdfAnnotations;
  const currentRubric = activePhase === 'draft' ? draftRubric : finalRubric;

  // Asegurar que si hay texto pero aún no hay tokens, se inicialicen como tokens de texto seleccionables
  useEffect(() => {
    if (currentText && currentTokens.length === 0) {
      const initialParts = currentText.split(/(\s+)/).map(val => ({ type: 'text', val }));
      setCurrentTokens(initialParts);
    }
  }, [activePhase, currentText]);

  // Permitir subir un PDF o imagen individual y transcribirlo con Gemini Vision HTR
  const handleSingleFileUpload = async (file) => {
    if (!file) return;
    setIsUploadingSingle(true);
    setAiErrorMsg('');
    try {
      const newImages = [];
      let combinedTranscription = '';

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pdfjsLib = await ensurePdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          const imgUrl = canvas.toDataURL('image/jpeg', 0.88);
          newImages.push(imgUrl);

          const analysis = await analyzeHandwrittenPageWithGemini(imgUrl, [student]);
          if (analysis.transcribedText) {
            combinedTranscription += (combinedTranscription ? '\n\n' : '') + analysis.transcribedText;
          }
        }
      } else {
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        newImages.push(dataUrl);
        const analysis = await analyzeHandwrittenPageWithGemini(dataUrl, [student]);
        combinedTranscription = analysis.transcribedText || '';
      }

      setCurrentPages(prev => [...prev, ...newImages]);
      if (combinedTranscription) {
        const updated = currentText ? `${currentText}\n\n${combinedTranscription}` : combinedTranscription;
        setCurrentText(updated);
        setCurrentTokens(updated.split(/(\s+)/).map(val => ({ type: 'text', val })));
      }
    } catch (err) {
      setAiErrorMsg('No se pudo procesar el archivo subido.');
    } finally {
      setIsUploadingSingle(false);
    }
  };

  // Re-transcribir desde las imágenes del PDF usando Gemini Vision HTR
  const handleRetranscribeFromPdf = async () => {
    if (currentPages.length === 0) return;
    setIsRetranscribing(true);
    setAiErrorMsg('');
    try {
      const transcriptions = [];
      for (const imgUrl of currentPages) {
        const analysis = await analyzeHandwrittenPageWithGemini(imgUrl, [student]);
        if (analysis.transcribedText) {
          transcriptions.push(analysis.transcribedText);
        }
      }
      const joined = transcriptions.join('\n\n--- Página siguiente ---\n\n');
      if (joined) {
        setCurrentText(joined);
        setCurrentTokens(joined.split(/(\s+)/).map(val => ({ type: 'text', val })));
        setIsEditingText(true);
      }
    } catch (err) {
      setAiErrorMsg('No se pudo re-transcribir el PDF. Inténtalo de nuevo.');
    } finally {
      setIsRetranscribing(false);
    }
  };

  // Analizador completo basado en el Currículum de Cataluña (Decret 175/2022 - 4t ESO)
  const runAiCorrection = async () => {
    if (!currentText.trim()) return;
    setIsAnalyzing(true);
    setAiErrorMsg('');
    setEditingTokenIndex(null);

    try {
      const evalResult = await evaluateEssayWithCatalanCurriculum({
        text: currentText,
        pages: currentPages,
        assignmentPrompt: assignment.systemPromptOCR,
        phase: activePhase,
        needsMISU: student.needsMISU
      });

      const alignedTokens = applyErrorsToText(currentText, evalResult.errors || []);

      // Generar marcas visuales sobre el PDF (página 1) a partir de las cajas detectadas por la IA
      const autoPdfMarks = (evalResult.errors || [])
        .filter(e => Array.isArray(e.box2d) && e.box2d.length === 4 && ERROR_CODES[e.code])
        .map((e, i) => {
          const [ymin, xmin, ymax, xmax] = e.box2d;
          return {
            id: `pdf_ai_${i}_${Date.now()}`,
            pageIndex: 0,
            xPercent: Math.min(94, Math.max(4, ((xmin + xmax) / 2) / 10)),
            yPercent: Math.min(94, Math.max(4, (ymin / 10))),
            code: e.code,
            correction: e.correction || '',
            explanation: e.explanation || ''
          };
        });

      const rubricPayload = {
        ...evalResult.rubric,
        feedback: evalResult.curriculumFeedback || '',
        misuApplied: student.needsMISU
      };

      const formattedGrade = typeof evalResult.suggestedGrade === 'number'
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
      setAiErrorMsg('Hubo un problema al conectar con el evaluador IA. Inténtalo de nuevo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Añadir marca de código de error haciendo clic directamente encima de la imagen del PDF
  const handlePdfCanvasClick = (e, pageIndex) => {
    if (!pdfMarkMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    const newMark = {
      id: `pdf_manual_${Date.now()}`,
      pageIndex,
      xPercent: Math.min(95, Math.max(2, xPercent)),
      yPercent: Math.min(95, Math.max(2, yPercent)),
      code: selectedPdfCode,
      correction: '',
      explanation: `Marcado manualmente (${ERROR_CODES[selectedPdfCode]?.desc || selectedPdfCode})`
    };

    setCurrentPdfAnnotations(prev => [...prev, newMark]);
    setShowPdfAnnotations(true);
  };

  const handleRemovePdfAnnotation = (e, id) => {
    e.stopPropagation();
    setCurrentPdfAnnotations(prev => prev.filter(m => m.id !== id));
  };

  // Abrir editor manual sobre cualquier palabra o etiqueta del texto transcrito
  const handleOpenTokenEditor = (idx, token) => {
    if (/^\s+$/.test(token.val) || token.val === '') return;
    setEditingTokenIndex(idx);
    setManualCode(token.type === 'error' ? token.code : 'Sp');
    setManualCorrection(token.type === 'error' ? (token.correction || '') : '');
    setManualExplanation(token.type === 'error' ? (token.explanation || '') : '');
  };

  const handleApplyManualTokenTag = () => {
    if (editingTokenIndex === null) return;
    setCurrentTokens(prev =>
      prev.map((tok, idx) => {
        if (idx !== editingTokenIndex) return tok;
        return {
          type: 'error',
          id: tok.id || `manual_${idx}_${Date.now()}`,
          code: manualCode,
          val: tok.val,
          correction: manualCorrection,
          explanation: manualExplanation
        };
      })
    );
    setEditingTokenIndex(null);
  };

  const handleClearManualTokenTag = () => {
    if (editingTokenIndex === null) return;
    setCurrentTokens(prev =>
      prev.map((tok, idx) => (idx === editingTokenIndex ? { type: 'text', val: tok.val } : tok))
    );
    setEditingTokenIndex(null);
  };

  const handleSaveAll = () => {
    const hasDraft = draftPages.length > 0 || draftText.trim().length > 0 || draftGrade !== '';
    const hasFinal = finalPages.length > 0 || finalText.trim().length > 0 || finalGrade !== '';

    onSaveSubmission(`${assignment.id}_${student.id}`, {
      ...submissionData,
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
      finalWeight: 100 - Number(draftWeight)
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const finalWeight = 100 - draftWeight;
  const dNum = parseFloat(draftGrade);
  const fNum = parseFloat(finalGrade);
  const computedAverage = (!isNaN(dNum) && !isNaN(fNum))
    ? ((dNum * (draftWeight / 100)) + (fNum * (finalWeight / 100))).toFixed(1)
    : !isNaN(dNum) ? dNum.toFixed(1) : !isNaN(fNum) ? fNum.toFixed(1) : '-';

  const errorCountInTokens = currentTokens.filter(t => t.type === 'error').length;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-500 hover:text-indigo-600 transition p-2 rounded-full hover:bg-slate-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-800">{student.name}</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{assignment.title}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Currículum Catalunya · Decret 175/2022 (4t ESO)
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button 
                onClick={() => { setActivePhase('draft'); setEditingTokenIndex(null); }}
                className={`text-xs font-bold px-3 py-1 rounded-md transition ${activePhase === 'draft' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Fase 1: Draft ({draftPages.length} pág.)
              </button>
              <button 
                onClick={() => { setActivePhase('final'); setEditingTokenIndex(null); }}
                className={`text-xs font-bold px-3 py-1 rounded-md transition ${activePhase === 'final' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Fase 2: Final Version ({finalPages.length} pág.)
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Toggle MISU */}
          <label className="flex items-center gap-2.5 cursor-pointer bg-blue-50/70 px-4 py-2 rounded-xl border border-blue-200 select-none">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={student.needsMISU} 
                onChange={() => onToggleStudentMisu(student.id)} 
              />
              <div className={`block w-10 h-6 rounded-full transition ${student.needsMISU ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${student.needsMISU ? 'translate-x-4' : ''}`}></div>
            </div>
            <span className="text-xs font-bold text-blue-900">Aplicar MISU (Dislexia/TDAH)</span>
          </label>
          
          <button 
            onClick={handleSaveAll}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow hover:bg-indigo-700 transition font-medium flex items-center gap-2 text-sm"
          >
            {saveToast ? <><Check size={18} /> ¡Guardado!</> : <><Save size={18} /> Guardar Evaluación</>}
          </button>
        </div>
      </header>

      {/* Split Content */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left Side: Scanned PDF Pages + Interactive Code Stamps */}
        <div className="w-full lg:w-1/2 h-1/2 lg:h-full bg-slate-200 border-b lg:border-b-0 lg:border-r border-slate-300 flex flex-col relative overflow-hidden">
          {/* Barra de herramientas sobre el PDF */}
          <div className="bg-white/95 backdrop-blur border-b border-slate-300 px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPdfMarkMode(m => !m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition ${
                  pdfMarkMode
                    ? 'bg-red-600 text-white border-red-700 shadow-sm'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <Tag size={13} /> {pdfMarkMode ? 'Clic en PDF para marcar (Activo)' : 'Marcar códigos en PDF'}
              </button>

              {pdfMarkMode && (
                <select
                  value={selectedPdfCode}
                  onChange={(e) => setSelectedPdfCode(e.target.value)}
                  className="text-xs font-bold border border-slate-300 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(ERROR_CODES).map(([code, info]) => (
                    <option key={code} value={code}>{code} ({info.desc})</option>
                  ))}
                </select>
              )}

              <button
                onClick={() => setShowPdfAnnotations(s => !s)}
                className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                title="Mostrar u ocultar marcas sobre el PDF"
              >
                {showPdfAnnotations ? <Eye size={14} /> : <EyeOff size={14} />}
                <span>{currentPdfAnnotations.length}</span>
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button onClick={() => setZoom(z => Math.max(50, z - 15))} className="p-1 hover:bg-white rounded text-slate-700" title="Alejar"><ZoomOut size={15}/></button>
              <span className="text-xs font-mono font-semibold w-10 text-center">{zoom}%</span>
              <button onClick={() => setZoom(z => Math.min(200, z + 15))} className="p-1 hover:bg-white rounded text-slate-700" title="Acercar"><ZoomIn size={15}/></button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-6 flex flex-col items-center gap-6">
            {currentPages.length > 0 ? (
              currentPages.map((imgSrc, idx) => {
                const pageAnnotations = currentPdfAnnotations.filter(m => m.pageIndex === idx);
                return (
                  <div 
                    key={idx}
                    className="bg-white shadow-xl origin-top transition-transform duration-200 ease-out border border-slate-300 rounded-sm overflow-hidden"
                    style={{ width: `${Math.round(540 * (zoom / 100))}px` }}
                  >
                    <div className="bg-slate-800 text-white text-[11px] font-mono px-3 py-1 flex justify-between">
                      <span>Hoja {idx + 1} de {currentPages.length} ({activePhase.toUpperCase()})</span>
                      <span>{pdfMarkMode ? `Haz clic para poner [${selectedPdfCode}]` : student.name}</span>
                    </div>
                    <div 
                      onClick={(e) => handlePdfCanvasClick(e, idx)}
                      className={`relative select-none ${pdfMarkMode ? 'cursor-crosshair' : ''}`}
                    >
                      <img src={imgSrc} alt={`Página ${idx + 1} de ${student.name}`} className="w-full h-auto block pointer-events-none" />
                      
                      {showPdfAnnotations && pageAnnotations.map((mark) => {
                        const style = ERROR_CODES[mark.code] || { color: 'bg-red-200 text-red-900 border-red-400', desc: mark.code };
                        return (
                          <div
                            key={mark.id}
                            style={{ left: `${mark.xPercent}%`, top: `${mark.yPercent}%` }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 group z-10"
                          >
                            <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-1.5 py-0.5 rounded border shadow-md ${style.color}`}>
                              {mark.code}
                              <button
                                onClick={(e) => handleRemovePdfAnnotation(e, mark.id)}
                                className="hover:text-red-700 ml-0.5 opacity-75 hover:opacity-100"
                                title="Eliminar marca del PDF"
                              >
                                ×
                              </button>
                            </span>
                            {(mark.correction || mark.explanation) && (
                              <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-slate-900 text-white text-[11px] p-2 rounded-lg shadow-xl z-20 pointer-events-none">
                                <div className="font-bold text-slate-300">{style.desc} ({mark.code})</div>
                                {mark.correction && <div className="text-emerald-300 font-semibold mt-0.5">→ {mark.correction}</div>}
                                {mark.explanation && <div className="text-slate-300 mt-0.5 leading-snug">{mark.explanation}</div>}
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
              <div className="my-auto bg-white/90 border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center max-w-sm">
                <FileText className="text-slate-400 mx-auto mb-3" size={36} />
                <h4 className="font-bold text-slate-700 mb-1">Sin hoja escaneada en {activePhase === 'draft' ? 'Draft' : 'Final'}</h4>
                <p className="text-xs text-slate-500 mb-4">
                  Sube el PDF masivo desde la vista de clase o sube aquí el PDF/imagen individual de {student.name}.
                </p>
                <label className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-indigo-700 transition">
                  {isUploadingSingle ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {isUploadingSingle ? 'Transcribiendo manuscrito...' : 'Subir PDF/Imagen individual'}
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

        {/* Right Side: Text & Correction */}
        <div className="w-full lg:w-1/2 h-1/2 lg:h-full bg-white flex flex-col">
          <div className="border-b border-slate-200 p-3 bg-slate-50 flex flex-wrap justify-between items-center gap-2">
            <div className="flex gap-2">
              <button 
                onClick={() => { setIsEditingText(false); setEditingTokenIndex(null); }} 
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${!isEditingText ? 'bg-white shadow text-indigo-600 border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                1. Texto Marcado con Códigos ({errorCountInTokens})
              </button>
              <button 
                onClick={() => { setIsEditingText(true); setEditingTokenIndex(null); }} 
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${isEditingText ? 'bg-white shadow text-indigo-600 border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                2. Editar Texto Base
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              {currentPages.length > 0 && (
                <button
                  onClick={handleRetranscribeFromPdf}
                  disabled={isRetranscribing}
                  className="bg-white text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 transition flex items-center gap-1.5"
                  title="Volver a leer la caligrafía del PDF con IA Visión"
                >
                  <RefreshCw size={13} className={isRetranscribing ? 'animate-spin' : ''} />
                  {isRetranscribing ? 'Leyendo PDF...' : 'Re-transcribir PDF'}
                </button>
              )}

              <button 
                onClick={runAiCorrection}
                disabled={isAnalyzing || !currentText.trim()}
                className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-1.5 shadow-sm"
              >
                {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {isAnalyzing ? "Corrigiendo (Currículum CAT)..." : "Evaluar y Marcar Códigos"}
              </button>
            </div>
          </div>

          {aiErrorMsg && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center justify-between">
              <span>{aiErrorMsg}</span>
              <button onClick={() => setAiErrorMsg('')} className="font-bold">×</button>
            </div>
          )}

          {/* Leyenda rápida de códigos */}
          {!isEditingText && (
            <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 flex flex-wrap gap-1.5 items-center text-[11px]">
              <span className="font-semibold text-slate-500 mr-1">Códigos (clic en cualquier palabra para marcar/editar):</span>
              {Object.entries(ERROR_CODES).map(([code, info]) => (
                <span key={code} className={`px-1.5 py-0.5 rounded border font-bold ${info.color}`} title={info.desc}>
                  {code}
                </span>
              ))}
            </div>
          )}

          <div className="flex-1 p-5 overflow-auto text-base leading-loose space-y-4">
            {isEditingText ? (
              <textarea 
                className="w-full h-full min-h-[260px] p-4 border border-slate-300 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-slate-50/50 font-sans leading-relaxed"
                value={currentText}
                onChange={(e) => {
                  const val = e.target.value;
                  setCurrentText(val);
                  setCurrentTokens(val.split(/(\s+)/).map(v => ({ type: 'text', val: v })));
                }}
                placeholder="Aquí aparece el texto manuscrito transcrito del PDF. Puedes editar cualquier palabra y pulsar 'Evaluar y Marcar Códigos'..."
              />
            ) : (
              <>
                <div className="p-6 bg-white border border-slate-200 rounded-xl min-h-[220px] whitespace-pre-wrap font-sans text-slate-800 leading-[2.8]">
                  {currentTokens.length > 0 ? currentTokens.map((token, i) => {
                    if (token.type === 'text') {
                      const isSpace = /^\s+$/.test(token.val) || token.val === '';
                      if (isSpace) return <span key={i}>{token.val}</span>;
                      return (
                        <span
                          key={i}
                          onClick={() => handleOpenTokenEditor(i, token)}
                          className="hover:bg-indigo-50 hover:text-indigo-900 rounded px-0.5 cursor-pointer transition"
                          title="Clic para añadir código de corrección a esta palabra"
                        >
                          {token.val}
                        </span>
                      );
                    } else {
                      const tagStyle = ERROR_CODES[token.code] || { color: 'bg-gray-200 text-gray-800 border-gray-400', desc: 'Error' };
                      return (
                        <span
                          key={i}
                          onClick={() => handleOpenTokenEditor(i, token)}
                          className="relative group inline-block mx-0.5 cursor-pointer"
                        >
                          <span className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-extrabold px-1.5 leading-tight rounded border ${tagStyle.color} shadow-sm z-10`}>
                            {token.code}
                          </span>
                          <span className="border-b-2 border-red-400 bg-red-50/70 px-1 rounded-sm font-medium">
                            {token.val === '' ? '___' : token.val}
                          </span>
                          
                          <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-60 bg-slate-800 text-white text-xs p-2.5 rounded-lg shadow-xl z-20 pointer-events-none">
                            <div className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-1">{tagStyle.desc} ({token.code})</div>
                            {token.correction && <div className="text-emerald-300 font-semibold">Sugerencia: {token.correction}</div>}
                            {token.explanation && <div className="text-slate-300 text-[11px] mt-1 leading-snug">{token.explanation}</div>}
                            <div className="text-[10px] text-indigo-300 mt-1">Clic para editar o quitar etiqueta</div>
                          </div>
                        </span>
                      );
                    }
                  }) : (
                    <span className="text-slate-400 text-sm">
                      No hay texto transcrito todavía. Sube el PDF o escribe el texto en la pestaña "2. Editar Texto Base".
                    </span>
                  )}
                </div>

                {/* Editor rápido de etiqueta al hacer clic sobre cualquier palabra del texto */}
                {editingTokenIndex !== null && currentTokens[editingTokenIndex] && (
                  <div className="bg-indigo-50/90 border border-indigo-200 rounded-xl p-3.5 shadow-sm flex flex-wrap items-end gap-3">
                    <div>
                      <div className="text-[11px] font-bold text-indigo-900 mb-1">
                        Palabra: "{currentTokens[editingTokenIndex].val}"
                      </div>
                      <select
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        className="text-xs font-bold border border-indigo-300 rounded-lg px-2.5 py-1.5 bg-white"
                      >
                        {Object.entries(ERROR_CODES).map(([code, info]) => (
                          <option key={code} value={code}>{code} - {info.desc}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Corrección sugerida</label>
                      <input
                        type="text"
                        value={manualCorrection}
                        onChange={(e) => setManualCorrection(e.target.value)}
                        placeholder="Ej: went / People..."
                        className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                      />
                    </div>

                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nota pedagógica</label>
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
                        onClick={handleApplyManualTokenTag}
                        className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                      >
                        Aplicar
                      </button>
                      {currentTokens[editingTokenIndex].type === 'error' && (
                        <button
                          onClick={handleClearManualTokenTag}
                          className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-red-200"
                        >
                          Quitar
                        </button>
                      )}
                      <button
                        onClick={() => setEditingTokenIndex(null)}
                        className="text-slate-500 text-xs px-2 py-1.5 hover:bg-slate-200 rounded-lg"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}

                {/* Rúbrica Oficial Currículum Catalunya (Decret 175/2022 - 4t ESO) */}
                {currentRubric && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Award size={15} className="text-indigo-600" />
                        Rúbrica Currículum Catalunya (Decret 175/2022 · 4t ESO)
                      </h4>
                      {currentRubric.misuApplied && (
                        <span className="text-[11px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                          Adaptació MISU aplicada (Decret 150/2017)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500">Adequació i coherència (CE3)</div>
                        <div className="text-base font-extrabold text-slate-800 mt-0.5">{currentRubric.adequacioCoherencia ?? '-'} / 10</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500">Cohesió i estructura (CE3)</div>
                        <div className="text-base font-extrabold text-slate-800 mt-0.5">{currentRubric.cohesioOrganitzacio ?? '-'} / 10</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500">Riquesa lèxica (CE3/CE5)</div>
                        <div className="text-base font-extrabold text-slate-800 mt-0.5">{currentRubric.riquesaLexica ?? '-'} / 10</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500">Correcció lingüística (CE5)</div>
                        <div className="text-base font-extrabold text-slate-800 mt-0.5">{currentRubric.correccioLinguistica ?? '-'} / 10</div>
                      </div>
                    </div>

                    {currentRubric.feedback && (
                      <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                        <strong className="text-slate-700">Valoració competencial:</strong> {currentRubric.feedback}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Grading Panel at bottom */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Calificación y Ponderación</h3>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Sliders size={14} className="text-indigo-600" />
                <span>Peso Draft: <strong>{draftWeight}%</strong> / Final: <strong>{finalWeight}%</strong></span>
                <input 
                  type="range" min="10" max="50" step="5"
                  value={draftWeight}
                  onChange={(e) => setDraftWeight(Number(e.target.value))}
                  className="w-20 accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className={`p-3 rounded-xl border ${activePhase === 'draft' ? 'bg-white border-emerald-400 shadow-sm' : 'bg-slate-100/70 border-slate-200'}`}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nota Draft ({draftWeight}%)</label>
                <div className="flex items-center gap-1.5">
                  <input 
                    type="number" step="0.1" min="0" max="10"
                    placeholder="-"
                    value={draftGrade}
                    onChange={(e) => setDraftGrade(e.target.value)}
                    className="w-20 text-xl font-bold p-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-center bg-white" 
                  />
                  <span className="text-slate-400 text-sm font-medium">/ 10</span>
                </div>
              </div>
              
              <div className={`p-3 rounded-xl border ${activePhase === 'final' ? 'bg-white border-indigo-400 shadow-sm' : 'bg-slate-100/70 border-slate-200'}`}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nota Final ({finalWeight}%)</label>
                <div className="flex items-center gap-1.5">
                  <input 
                    type="number" step="0.1" min="0" max="10"
                    placeholder="-"
                    value={finalGrade}
                    onChange={(e) => setFinalGrade(e.target.value)}
                    className="w-20 text-xl font-bold p-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-center bg-white" 
                  />
                  <span className="text-slate-400 text-sm font-medium">/ 10</span>
                </div>
              </div>

              <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-sm flex flex-col items-center justify-center">
                <div className="text-[11px] font-bold text-indigo-200 uppercase tracking-wide">Nota Media Final</div>
                <div className="text-3xl font-black mt-0.5">{computedAverage}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// MAIN APP CONTAINER
export default function App() {
  const [classes, setClasses] = useState(INITIAL_CLASSES);
  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [submissions, setSubmissions] = useState(() => generateInitialSubmissions(INITIAL_CLASSES, INITIAL_ASSIGNMENTS));

  const [view, setView] = useState('dashboard'); // 'dashboard', 'class', 'bulk_upload', 'grade'
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [bulkContext, setBulkContext] = useState({ assignmentId: null, phase: 'draft' });
  const [gradingContext, setGradingContext] = useState({ studentId: null, assignment: null, phase: 'draft' });
  const [showNewAssignmentModal, setShowNewAssignmentModal] = useState(false);

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const handleCreateAssignment = (newAssign) => {
    setAssignments(prev => [...prev, newAssign]);
    setShowNewAssignmentModal(false);
    setSelectedClassId(newAssign.classId);
    setView('class');
  };

  const handleToggleStudentMisu = (classId, studentId) => {
    setClasses(prev => prev.map(c => {
      if (c.id !== classId) return c;
      return {
        ...c,
        students: c.students.map(s => s.id === studentId ? { ...s, needsMISU: !s.needsMISU } : s)
      };
    }));
  };

  const handleBulkComplete = (assignedBlocks) => {
    setSubmissions(prev => {
      const updated = { ...prev };
      const touchedStudents = new Set();

      assignedBlocks.forEach(block => {
        const key = `${bulkContext.assignmentId}_${block.studentId}`;
        const existing = updated[key] || {
          assignmentId: bulkContext.assignmentId,
          studentId: block.studentId,
          draftStatus: 'pending',
          draftPages: [],
          draftText: '',
          draftTokens: [],
          draftGrade: '',
          finalStatus: 'pending',
          finalPages: [],
          finalText: '',
          finalTokens: [],
          finalGrade: '',
          draftWeight: 30,
          finalWeight: 70
        };

        const isDuplicateInSameBatch = touchedStudents.has(block.studentId);
        touchedStudents.add(block.studentId);

        if (bulkContext.phase === 'draft') {
          updated[key] = {
            ...existing,
            draftStatus: 'scanned',
            draftPages: isDuplicateInSameBatch ? [...(existing.draftPages || []), ...block.images] : block.images,
            draftText: isDuplicateInSameBatch
              ? [existing.draftText, block.ocrText].filter(Boolean).join('\n\n')
              : block.ocrText
          };
        } else {
          updated[key] = {
            ...existing,
            finalStatus: 'scanned',
            finalPages: isDuplicateInSameBatch ? [...(existing.finalPages || []), ...block.images] : block.images,
            finalText: isDuplicateInSameBatch
              ? [existing.finalText, block.ocrText].filter(Boolean).join('\n\n')
              : block.ocrText
          };
        }
      });
      return updated;
    });
    setView('class');
  };

  const handleSaveSubmission = (key, data) => {
    setSubmissions(prev => ({ ...prev, [key]: data }));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {view === 'dashboard' && (
        <Dashboard 
          classes={classes}
          assignments={assignments}
          onSelectClass={(cls) => { setSelectedClassId(cls.id); setView('class'); }}
          onOpenNewAssignment={() => setShowNewAssignmentModal(true)}
        />
      )}
      
      {view === 'class' && selectedClass && (
        <ClassView 
          cls={selectedClass}
          assignments={assignments}
          submissions={submissions}
          onBack={() => { setSelectedClassId(null); setView('dashboard'); }} 
          onUploadBulk={(assignmentId, phase) => { setBulkContext({ assignmentId, phase }); setView('bulk_upload'); }}
          onGradeStudent={(student, assignment, phase) => { 
            setGradingContext({ studentId: student.id, assignment, phase }); 
            setView('grade'); 
          }}
          onToggleStudentMisu={handleToggleStudentMisu}
          onOpenNewAssignment={() => setShowNewAssignmentModal(true)}
        />
      )}
      
      {view === 'bulk_upload' && selectedClass && (
        <BulkUploadValidation 
          cls={selectedClass}
          phase={bulkContext.phase}
          onCancel={() => setView('class')}
          onComplete={handleBulkComplete}
        />
      )}

      {view === 'grade' && selectedClass && (
        <GradingInterface 
          student={selectedClass.students.find(s => s.id === gradingContext.studentId)}
          assignment={gradingContext.assignment}
          initialPhase={gradingContext.phase}
          submissionData={submissions[`${gradingContext.assignment.id}_${gradingContext.studentId}`] || {}}
          onSaveSubmission={handleSaveSubmission}
          onToggleStudentMisu={(stId) => handleToggleStudentMisu(selectedClass.id, stId)}
          onBack={() => setView('class')} 
        />
      )}

      {showNewAssignmentModal && (
        <NewAssignmentModal 
          classes={classes}
          onClose={() => setShowNewAssignmentModal(false)}
          onSave={handleCreateAssignment}
        />
      )}
    </div>
  );
}