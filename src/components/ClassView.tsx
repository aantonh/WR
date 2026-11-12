import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Download,
  Plus,
  Upload,
  User,
  UserPlus,
} from 'lucide-react';
import type { Assignment, Phase, SchoolClass, Student, Submission } from '../types';

interface ClassViewProps {
  cls: SchoolClass;
  assignments: Assignment[];
  submissions: Record<string, Submission>;
  onBack: () => void;
  onUploadBulk: (assignmentId: string, phase: Phase) => void;
  onGradeStudent: (student: Student, assignment: Assignment, phase: Phase) => void;
  onToggleStudentMisu: (classId: string, studentId: string) => void;
  onAddStudent: (classId: string, name: string) => void;
  onOpenNewAssignment: () => void;
}

export const ClassView: React.FC<ClassViewProps> = ({
  cls,
  assignments,
  submissions,
  onBack,
  onUploadBulk,
  onGradeStudent,
  onToggleStudentMisu,
  onAddStudent,
  onOpenNewAssignment,
}) => {
  const classAssignments = assignments.filter((a) => a.classId === cls.id);
  const [selectedAssignId, setSelectedAssignId] = useState(classAssignments[0]?.id || '');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');

  const currentAssign =
    classAssignments.find((a) => a.id === selectedAssignId) || classAssignments[0];

  const uploadedDraftCount = currentAssign
    ? cls.students.filter(
        (s) => (submissions[`${currentAssign.id}_${s.id}`]?.draftStatus || 'pending') !== 'pending'
      ).length
    : 0;
  const uploadedFinalCount = currentAssign
    ? cls.students.filter(
        (s) => (submissions[`${currentAssign.id}_${s.id}`]?.finalStatus || 'pending') !== 'pending'
      ).length
    : 0;

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    onAddStudent(cls.id, newStudentName.trim());
    setNewStudentName('');
    setShowAddStudent(false);
  };

  const handleExportCsv = () => {
    if (!currentAssign) return;
    const rows = [
      ['Alumno', 'MISU', 'Nota Draft', 'Peso Draft (%)', 'Nota Final', 'Peso Final (%)', 'Media Ponderada'],
    ];

    cls.students.forEach((student) => {
      const sub = submissions[`${currentAssign.id}_${student.id}`];
      const dGrade = sub ? parseFloat(sub.draftGrade) : NaN;
      const fGrade = sub ? parseFloat(sub.finalGrade) : NaN;
      const dW = sub?.draftWeight ?? 30;
      const fW = sub?.finalWeight ?? 70;
      let avg = '';
      if (!isNaN(dGrade) && !isNaN(fGrade)) {
        avg = ((dGrade * (dW / 100)) + (fGrade * (fW / 100))).toFixed(1);
      } else if (!isNaN(dGrade)) {
        avg = dGrade.toFixed(1);
      } else if (!isNaN(fGrade)) {
        avg = fGrade.toFixed(1);
      }

      rows.push([
        `"${student.name.replace(/"/g, '""')}"`,
        student.needsMISU ? 'SI' : 'NO',
        sub?.draftGrade || '',
        String(dW),
        sub?.finalGrade || '',
        String(fW),
        avg,
      ]);
    });

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cls.name}-${currentAssign.title.replace(/[^a-z0-9]/gi, '_')}-notas.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-700 font-medium whitespace-nowrap"
        >
          <ArrowLeft size={16} /> Volver al panel de clases
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAddStudent((v) => !v)}
            className="text-sm text-slate-700 hover:text-indigo-700 font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <UserPlus size={15} /> Añadir alumno
          </button>
          {currentAssign && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="text-sm text-slate-700 hover:text-indigo-700 font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download size={15} /> Exportar notas CSV
            </button>
          )}
          <button
            type="button"
            onClick={onOpenNewAssignment}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 whitespace-nowrap"
          >
            <Plus size={15} /> Añadir tarea a {cls.name}
          </button>
        </div>
      </div>

      {showAddStudent && (
        <form
          onSubmit={handleCreateStudent}
          className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="new-student-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre completo del alumno/a para {cls.name}
            </label>
            <input
              id="new-student-name"
              type="text"
              required
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              placeholder="Ej: Laura Martínez Soler"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 whitespace-nowrap"
          >
            Añadir a la lista
          </button>
          <button
            type="button"
            onClick={() => setShowAddStudent(false)}
            className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancelar
          </button>
        </form>
      )}

      {currentAssign ? (
        <>
          <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2.5 flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-bold text-indigo-700">{cls.name}</span>
                <span aria-hidden="true" className="text-slate-300">
                  /
                </span>
                {classAssignments.length > 1 ? (
                  <select
                    value={currentAssign.id}
                    onChange={(e) => setSelectedAssignId(e.target.value)}
                    aria-label="Seleccionar tarea"
                    className="text-lg font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    {classAssignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{currentAssign.title}</h1>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                <span>Drafts: {uploadedDraftCount}/{cls.students.length}</span>
                <span aria-hidden="true">·</span>
                <span>Finals: {uploadedFinalCount}/{cls.students.length}</span>
                <span aria-hidden="true">·</span>
                <span>{cls.students.length} alumnos en lista</span>
              </div>

              <p className="text-sm text-slate-600 bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-800">Enunciado (System Prompt): </span>
                {currentAssign.systemPromptOCR}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onUploadBulk(currentAssign.id, 'draft')}
                className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm font-semibold whitespace-nowrap"
              >
                <Upload size={16} /> Subir PDF Masivo (Draft)
              </button>
              <button
                type="button"
                onClick={() => onUploadBulk(currentAssign.id, 'final')}
                className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm font-semibold whitespace-nowrap"
              >
                <Upload size={16} /> Subir PDF Masivo (Final)
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">Alumno</th>
                  <th className="px-4 py-3.5 font-semibold">Draft (Sin ayudas)</th>
                  <th className="px-4 py-3.5 font-semibold">Final Version</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Nota Final</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Acciones de corrección</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {cls.students.map((student) => {
                  const subKey = `${currentAssign.id}_${student.id}`;
                  const sub = submissions[subKey];
                  const draftStatus = sub?.draftStatus || 'pending';
                  const finalStatus = sub?.finalStatus || 'pending';
                  const draftWeight = sub?.draftWeight ?? 30;
                  const finalWeight = sub?.finalWeight ?? 70;

                  const dGrade = sub ? parseFloat(sub.draftGrade) : NaN;
                  const fGrade = sub ? parseFloat(sub.finalGrade) : NaN;
                  let weightedAvg = '-';
                  if (!isNaN(dGrade) && !isNaN(fGrade)) {
                    weightedAvg = ((dGrade * (draftWeight / 100)) + (fGrade * (finalWeight / 100))).toFixed(1);
                  } else if (!isNaN(dGrade)) {
                    weightedAvg = `${dGrade.toFixed(1)} (draft)`;
                  } else if (!isNaN(fGrade)) {
                    weightedAvg = `${fGrade.toFixed(1)} (final)`;
                  }

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <User size={15} className="text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="font-medium text-slate-900">{student.name}</span>
                          <button
                            type="button"
                            onClick={() => onToggleStudentMisu(cls.id, student.id)}
                            title="Clic para activar o desactivar adaptación MISU"
                            className={`text-xs px-2 py-0.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
                              student.needsMISU
                                ? 'bg-blue-50 text-blue-800 border border-blue-300'
                                : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {student.needsMISU ? 'MISU Activo' : '+ MISU'}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 tabular-nums">
                        {draftStatus === 'graded' && (
                          <span className="text-emerald-800 inline-flex items-center gap-1.5 font-semibold">
                            <CheckCircle size={14} className="text-emerald-600" />
                            Nota: {sub.draftGrade}
                          </span>
                        )}
                        {draftStatus === 'scanned' && (
                          <span className="text-amber-800 inline-flex items-center gap-1.5 font-medium">
                            <AlertCircle size={14} className="text-amber-600" />
                            Escaneado ({sub.draftPages?.length || 1} pág.)
                          </span>
                        )}
                        {draftStatus === 'pending' && (
                          <span className="text-slate-400">Sin entregar</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 tabular-nums">
                        {finalStatus === 'graded' && (
                          <span className="text-indigo-800 inline-flex items-center gap-1.5 font-semibold">
                            <CheckCircle size={14} className="text-indigo-600" />
                            Nota: {sub.finalGrade}
                          </span>
                        )}
                        {finalStatus === 'scanned' && (
                          <span className="text-amber-800 inline-flex items-center gap-1.5 font-medium">
                            <AlertCircle size={14} className="text-amber-600" />
                            Escaneado ({sub.finalPages?.length || 1} pág.)
                          </span>
                        )}
                        {finalStatus === 'pending' && (
                          <span className="text-slate-400">Sin entregar</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center font-mono font-semibold text-slate-800 tabular-nums">
                        {weightedAvg}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onGradeStudent(student, currentAssign, 'draft')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                              draftStatus !== 'pending'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {draftStatus !== 'pending' ? 'Corregir Draft' : 'Subir/Ver Draft'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onGradeStudent(student, currentAssign, 'final')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                              finalStatus !== 'pending'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {finalStatus !== 'pending' ? 'Corregir Final' : 'Subir/Ver Final'}
                          </button>
                        </div>
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
          <p className="text-slate-600 mb-4">No hay tareas creadas todavía para {cls.name}.</p>
          <button
            type="button"
            onClick={onOpenNewAssignment}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            Crear primera tarea
          </button>
        </div>
      )}
    </div>
  );
};
