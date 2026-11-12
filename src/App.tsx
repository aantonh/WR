import React, { useEffect, useState } from 'react';
import { Globe, Upload } from 'lucide-react';
import type { AppView, Assignment, BulkPageBlock, Phase, SchoolClass, Submission } from './types';
import {
  INITIAL_ASSIGNMENTS,
  INITIAL_CLASSES,
  createEmptySubmission,
  generateInitialSubmissions,
} from './data/seed';
import {
  clearPersistedState,
  loadPersistedState,
  savePersistedState,
  type PersistedState,
} from './utils/storage';
import { Dashboard } from './components/Dashboard';
import { ClassView } from './components/ClassView';
import { BulkUploadValidation } from './components/BulkUploadValidation';
import { GradingInterface } from './components/GradingInterface';
import { NewAssignmentModal } from './components/NewAssignmentModal';
import { GoogleSitesModal } from './components/GoogleSitesModal';

export default function App() {
  const [classes, setClasses] = useState<SchoolClass[]>(() => {
    const saved = loadPersistedState();
    return saved?.classes ?? INITIAL_CLASSES;
  });

  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const saved = loadPersistedState();
    return saved?.assignments ?? INITIAL_ASSIGNMENTS;
  });

  const [submissions, setSubmissions] = useState<Record<string, Submission>>(() => {
    const saved = loadPersistedState();
    return (
      saved?.submissions ?? generateInitialSubmissions(INITIAL_CLASSES, INITIAL_ASSIGNMENTS)
    );
  });

  const [view, setView] = useState<AppView>('dashboard');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [bulkContext, setBulkContext] = useState<{ assignmentId: string; phase: Phase }>({
    assignmentId: '',
    phase: 'draft',
  });
  const [gradingContext, setGradingContext] = useState<{
    studentId: string;
    assignment: Assignment | null;
    phase: Phase;
  }>({
    studentId: '',
    assignment: null,
    phase: 'draft',
  });

  const [showNewAssignmentModal, setShowNewAssignmentModal] = useState(false);
  const [showGoogleSitesModal, setShowGoogleSitesModal] = useState(false);
  const [storageNotice, setStorageNotice] = useState('');

  // Persist changes locally so work inside Google Sites embeds survives refreshes
  useEffect(() => {
    const result = savePersistedState({ classes, assignments, submissions });
    if (result.quotaFallback) {
      setStorageNotice(
        'Almacenamiento lleno para imágenes grandes: textos y notas guardados en el navegador; exporta un respaldo JSON para conservar escaneos.'
      );
    } else {
      setStorageNotice('');
    }
  }, [classes, assignments, submissions]);

  const selectedClass = classes.find((c) => c.id === selectedClassId) || null;

  const handleCreateAssignment = (newAssign: Assignment) => {
    setAssignments((prev) => [...prev, newAssign]);
    setShowNewAssignmentModal(false);
    setSelectedClassId(newAssign.classId);
    setView('class');
  };

  const handleAddClass = (name: string) => {
    const newCls: SchoolClass = {
      id: `c_${Date.now()}`,
      name,
      students: [],
    };
    setClasses((prev) => [...prev, newCls]);
  };

  const handleAddStudent = (classId: string, name: string) => {
    setClasses((prev) =>
      prev.map((c) =>
        c.id !== classId
          ? c
          : {
              ...c,
              students: [
                ...c.students,
                { id: `s_${Date.now()}`, name, needsMISU: false },
              ],
            }
      )
    );
  };

  const handleToggleStudentMisu = (classId: string, studentId: string) => {
    setClasses((prev) =>
      prev.map((c) => {
        if (c.id !== classId) return c;
        return {
          ...c,
          students: c.students.map((s) =>
            s.id === studentId ? { ...s, needsMISU: !s.needsMISU } : s
          ),
        };
      })
    );
  };

  const handleBulkComplete = (assignedBlocks: BulkPageBlock[]) => {
    setSubmissions((prev) => {
      const updated = { ...prev };
      const touchedStudents = new Set<string>();

      assignedBlocks.forEach((block) => {
        const key = `${bulkContext.assignmentId}_${block.studentId}`;
        const existing =
          updated[key] || createEmptySubmission(bulkContext.assignmentId, block.studentId);

        const isDuplicateInSameBatch = touchedStudents.has(block.studentId);
        touchedStudents.add(block.studentId);

        if (bulkContext.phase === 'draft') {
          updated[key] = {
            ...existing,
            draftStatus: 'scanned',
            draftPages: isDuplicateInSameBatch
              ? [...(existing.draftPages || []), ...block.images]
              : block.images,
            draftText: isDuplicateInSameBatch
              ? [existing.draftText, block.ocrText].filter(Boolean).join('\n\n')
              : block.ocrText,
          };
        } else {
          updated[key] = {
            ...existing,
            finalStatus: 'scanned',
            finalPages: isDuplicateInSameBatch
              ? [...(existing.finalPages || []), ...block.images]
              : block.images,
            finalText: isDuplicateInSameBatch
              ? [existing.finalText, block.ocrText].filter(Boolean).join('\n\n')
              : block.ocrText,
          };
        }
      });

      return updated;
    });
    setView('class');
  };

  const handleSaveSubmission = (key: string, data: Submission) => {
    setSubmissions((prev) => ({ ...prev, [key]: data }));
  };

  const handleImportState = (imported: PersistedState) => {
    setClasses(imported.classes);
    setAssignments(imported.assignments);
    setSubmissions(imported.submissions);
    setView('dashboard');
    setSelectedClassId(null);
  };

  const handleResetState = () => {
    clearPersistedState();
    setClasses(INITIAL_CLASSES);
    setAssignments(INITIAL_ASSIGNMENTS);
    setSubmissions(generateInitialSubmissions(INITIAL_CLASSES, INITIAL_ASSIGNMENTS));
    setView('dashboard');
    setSelectedClassId(null);
  };

  const gradingStudent =
    selectedClass?.students.find((s) => s.id === gradingContext.studentId) || null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      {/* Three-Zone Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between gap-8 shrink-0">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => {
            setSelectedClassId(null);
            setView('dashboard');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display hover:text-indigo-700 transition-colors"
        >
          WritingMaster AI
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => {
              setSelectedClassId(null);
              setView('dashboard');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              view === 'dashboard' ? 'text-slate-900 underline underline-offset-4' : ''
            }`}
          >
            Clases
          </button>

          {selectedClass && (
            <button
              type="button"
              onClick={() => setView('class')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                view === 'class' ? 'text-slate-900 underline underline-offset-4' : ''
              }`}
            >
              {selectedClass.name}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowGoogleSitesModal(true)}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            <Globe size={14} aria-hidden="true" />
            Google Sites
          </button>
        </nav>

        {/* Zone 3: Single primary CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowGoogleSitesModal(true)}
            className="md:hidden px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            Google Sites
          </button>
          <button
            type="button"
            onClick={() => setShowNewAssignmentModal(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            <Upload size={14} aria-hidden="true" />
            Nueva tarea
          </button>
        </div>
      </header>

      {storageNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-900 flex items-center justify-between gap-4">
          <span>{storageNotice}</span>
          <button
            type="button"
            onClick={() => setShowGoogleSitesModal(true)}
            className="font-semibold underline whitespace-nowrap"
          >
            Abrir respaldo JSON
          </button>
        </div>
      )}

      <div className="flex-1">
        {view === 'dashboard' && (
          <Dashboard
            classes={classes}
            assignments={assignments}
            submissions={submissions}
            onSelectClass={(cls) => {
              setSelectedClassId(cls.id);
              setView('class');
            }}
            onAddClass={handleAddClass}
            onOpenNewAssignment={() => setShowNewAssignmentModal(true)}
          />
        )}

        {view === 'class' && selectedClass && (
          <ClassView
            cls={selectedClass}
            assignments={assignments}
            submissions={submissions}
            onBack={() => {
              setSelectedClassId(null);
              setView('dashboard');
            }}
            onUploadBulk={(assignmentId, phase) => {
              setBulkContext({ assignmentId, phase });
              setView('bulk_upload');
            }}
            onGradeStudent={(student, assignment, phase) => {
              setGradingContext({ studentId: student.id, assignment, phase });
              setView('grade');
            }}
            onToggleStudentMisu={handleToggleStudentMisu}
            onAddStudent={handleAddStudent}
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

        {view === 'grade' &&
          selectedClass &&
          gradingStudent &&
          gradingContext.assignment && (
            <GradingInterface
              student={gradingStudent}
              assignment={gradingContext.assignment}
              initialPhase={gradingContext.phase}
              submissionData={
                submissions[`${gradingContext.assignment.id}_${gradingStudent.id}`]
              }
              onSaveSubmission={handleSaveSubmission}
              onToggleStudentMisu={(stId) => handleToggleStudentMisu(selectedClass.id, stId)}
              onBack={() => setView('class')}
            />
          )}
      </div>

      {showNewAssignmentModal && (
        <NewAssignmentModal
          classes={classes}
          initialClassId={selectedClassId}
          onClose={() => setShowNewAssignmentModal(false)}
          onSave={handleCreateAssignment}
        />
      )}

      {showGoogleSitesModal && (
        <GoogleSitesModal
          currentState={{ classes, assignments, submissions }}
          onImportState={handleImportState}
          onResetState={handleResetState}
          onClose={() => setShowGoogleSitesModal(false)}
        />
      )}
    </div>
  );
}
