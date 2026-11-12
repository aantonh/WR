import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image data URL.');
  }
  return {
    mimeType: match[1] || 'image/jpeg',
    data: match[2],
  };
}

async function withBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes('429') || msg.includes('503') || msg.includes('500') || msg.includes('RESOURCE_EXHAUSTED');
      if (isTransient && attempt < maxRetries) {
        const delayMs = 800 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();

  // Allow embedding inside Google Sites and cross-origin API calls from embedded contexts
  app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *;');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // 1. Extract writing instructions from worksheet image
  app.post('/api/extract-prompt', async (req: Request, res: Response) => {
    try {
      const { imageDataUrl } = req.body as { imageDataUrl?: string };
      if (!imageDataUrl) {
        res.status(400).json({ error: 'Missing imageDataUrl' });
        return;
      }

      const { mimeType, data } = parseDataUrl(imageDataUrl);
      const ai = getAiClient();

      const response = await withBackoff(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                text: 'Extract the complete English writing prompt / instructions from this worksheet image accurately as plain text.',
              },
              {
                inlineData: { mimeType, data },
              },
            ],
          },
        })
      );

      res.json({ text: (response.text ?? '').trim() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to extract prompt text.';
      console.error('/api/extract-prompt error:', message);
      res.status(500).json({ error: message });
    }
  });

  // 2. Analyze a handwritten scanned essay page (HTR + student roster match)
  app.post('/api/analyze-page', async (req: Request, res: Response) => {
    try {
      const { imageDataUrl, students } = req.body as {
        imageDataUrl?: string;
        students?: Array<{ id: string; name: string }>;
      };

      if (!imageDataUrl || !Array.isArray(students)) {
        res.status(400).json({ error: 'Missing imageDataUrl or students roster.' });
        return;
      }

      const { mimeType, data } = parseDataUrl(imageDataUrl);
      const studentRoster = students.map((s) => `- id: "${s.id}" | name: "${s.name}"`).join('\n');

      const prompt = `You are an expert Handwriting Text Recognition (HTR) specialist for secondary school (4t ESO, Catalonia) English essays.
Carefully examine this scanned handwritten worksheet:
1. STUDENT IDENTIFICATION: Read the handwritten student name and/or surname anywhere on the page (top header, name line, margin, or bottom). Match it to the closest student in this official class roster (accounting for Catalan/Spanish accents, partial names, or messy teenage handwriting):
${studentRoster}
2. CONTINUATION CHECK: Set "isContinuationPage" to true ONLY if there is clearly no student name on the sheet and the text is a continuation (page 2) of an essay.
3. VERBATIM HANDWRITING TRANSCRIPTION: Transcribe the entire handwritten English essay faithfully line by line and word for word.
CRITICAL RULE: Do NOT fix, normalize, or autocorrect the student's spelling mistakes, grammar errors, missing capitalization (such as lowercase "i"), wrong verb tenses, or punctuation mistakes. Transcribe the exact letters/words the student wrote so the teacher can grade them with error codes.`;

      const ai = getAiClient();
      const response = await withBackoff(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data } },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedNameRaw: {
                  type: Type.STRING,
                  description: 'Exact handwritten name/header string read from the scan, or empty string if none.',
                },
                studentId: {
                  type: Type.STRING,
                  description: 'Exact student id from the provided roster if matched, or empty string if unmatched.',
                },
                isContinuationPage: {
                  type: Type.BOOLEAN,
                  description: 'True if this page has no name and appears to continue a previous student essay.',
                },
                transcribedText: {
                  type: Type.STRING,
                  description: 'Verbatim transcription of the handwritten English text preserving original student errors.',
                },
              },
              required: ['detectedNameRaw', 'studentId', 'isContinuationPage', 'transcribedText'],
            },
          },
        })
      );

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson) as {
        detectedNameRaw?: string;
        studentId?: string;
        isContinuationPage?: boolean;
        transcribedText?: string;
      };

      res.json({
        detectedNameRaw: (parsed.detectedNameRaw ?? '').trim(),
        studentId: (parsed.studentId ?? '').trim(),
        isContinuationPage: Boolean(parsed.isContinuationPage),
        transcribedText: (parsed.transcribedText ?? '').trim(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to analyze handwritten page.';
      console.error('/api/analyze-page error:', message);
      res.status(500).json({ error: message });
    }
  });

  // 3. Evaluate essay against Catalonia Curriculum (Decret 175/2022 - 4t ESO)
  app.post('/api/evaluate-essay', async (req: Request, res: Response) => {
    try {
      const { text, pageImageDataUrl, assignmentPrompt, phase, needsMISU } = req.body as {
        text?: string;
        pageImageDataUrl?: string;
        assignmentPrompt?: string;
        phase?: 'draft' | 'final';
        needsMISU?: boolean;
      };

      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Essay text is required for evaluation.' });
        return;
      }

      const systemInstruction = `Ets un docent expert d'Anglès de Secundària a Catalunya que avalua redaccions de 4t d'ESO segons el Currículum d'Educació Bàsica de Catalunya (Decret 175/2022, de 27 de setembre):
- Competència específica 3 (CE3): Produir textos escrits i multimodals de certa extensió, coherents, cohesionats i adequats a la situació comunicativa (nivell A2+/B1 del MECR).
- Competència específica 5 (CE5): Reflexionar sobre el funcionament de la llengua anglesa (morfosintaxi, lèxic, ortografia i puntuació) per millorar la producció pròpia.
- Context de fase: "${phase === 'draft' ? 'DRAFT (Borrador inicial a aula sense diccionari ni ajudes externes)' : 'FINAL VERSION (Versió reescrita i millorada després de feedback)'}".
${
  needsMISU
    ? `- MESURA INCLUSIVA ACTIVA (MISU - Decret 150/2017, Dislèxia / TDAH): Aplica flexibilitat ortogràfica i formal. NO penalitzis faltes d'ortografia fonètica ('Sp') ni petits descuits de puntuació ('P') si la paraula és comprensible en context. Prioritza la coherència comunicativa, l'estructura d'idees, l'adequació a l'enunciat i el lèxic.`
    : `- Avaluació ordinària (sense MISU): Aplica els criteris estàndard de 4t d'ESO de Catalunya equilibrant comunicació i precisió formal.`
}

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

      const userPrompt = `Enunciat de la tasca (System Prompt): "${assignmentPrompt ?? ''}"

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

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: userPrompt },
      ];

      if (pageImageDataUrl && pageImageDataUrl.startsWith('data:image')) {
        const parsedImg = parseDataUrl(pageImageDataUrl);
        parts.push({ inlineData: parsedImg });
      }

      const ai = getAiClient();
      const response = await withBackoff(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                errors: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      originalWord: { type: Type.STRING },
                      occurrenceIndex: { type: Type.INTEGER },
                      code: {
                        type: Type.STRING,
                        enum: ['Sp', 'Gr', 'T', 'WO', 'WW', 'Prep', 'S', 'Cap', '^', '[]', 'P'],
                      },
                      correction: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      box2d: {
                        type: Type.ARRAY,
                        items: { type: Type.INTEGER },
                      },
                    },
                    required: ['originalWord', 'occurrenceIndex', 'code', 'correction', 'explanation'],
                  },
                },
                rubric: {
                  type: Type.OBJECT,
                  properties: {
                    adequacioCoherencia: { type: Type.NUMBER },
                    cohesioOrganitzacio: { type: Type.NUMBER },
                    riquesaLexica: { type: Type.NUMBER },
                    correccioLinguistica: { type: Type.NUMBER },
                  },
                  required: ['adequacioCoherencia', 'cohesioOrganitzacio', 'riquesaLexica', 'correccioLinguistica'],
                },
                suggestedGrade: { type: Type.NUMBER },
                curriculumFeedback: { type: Type.STRING },
              },
              required: ['errors', 'rubric', 'suggestedGrade', 'curriculumFeedback'],
            },
          },
        })
      );

      const rawJson = (response.text ?? '{}').trim();
      res.json(JSON.parse(rawJson));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to evaluate essay.';
      console.error('/api/evaluate-essay error:', message);
      res.status(500).json({ error: message });
    }
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WritingMaster AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
