import React, { useState } from 'react';
import { ArrowRight, FileText, Plus, Upload, Users } from 'lucide-react';
import type { Assignment, SchoolClass, Submission } from '../types';

interface DashboardProps {
  classes: SchoolClass[];
  assignments: Assignment[];
  submissions: Record<string, Submission>;
  onSelectClass: (cls: SchoolClass) => void;
  onAddClass: (name: string) => void;
  onOpenNewAssignment: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  classes,
  assignments,
  submissions,
  onSelectClass,
  onAddClass,
  onOpenNewAssignment,
}) => {
  const [showNewClassForm, setShowNewClassForm] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    onAddClass(newClassName.trim());
    setNewClassName('');
    setShowNewClassForm(false);
  };

  return (
    <main className="px-6 py-8 max-w-6xl mx-auto space-y-8">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance">
            Corrección de Redacciones en Inglés
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Gestión de clases, separación automática de PDFs escaneados, transcripción manuscrita y evaluación según el Currículum de Catalunya (Decret 175/2022 · 4t ESO).
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewClassForm((v) => !v)}
            className="px-4 py-2.5 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap"
          >
            <Plus size={16} /> Nueva clase
          </button>
          <button
            type="button"
            onClick={onOpenNewAssignment}
            className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm font-semibold whitespace-nowrap"
          >
            <Upload size={16} /> Nueva tarea
          </button>
        </div>
      </section>

      {showNewClassForm && (
        <form
          onSubmit={handleCreateClass}
          className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="new-class-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nombre de la clase (ej: 4º S, 1º Bachillerato A)
            </label>
            <input
              id="new-class-name"
              type="text"
              required
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Ej: 4º S"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 whitespace-nowrap"
          >
            Añadir clase
          </button>
          <button
            type="button"
            onClick={() => setShowNewClassForm(false)}
            className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancelar
          </button>
        </form>
      )}

      <section aria-labelledby="classes-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="classes-heading" className="text-lg font-semibold text-slate-800">
            Tus clases ({classes.length})
          </h2>
          <span className="text-xs text-slate-500 tabular-nums">
            {assignments.length} {assignments.length === 1 ? 'tarea activa' : 'tareas activas'} en total
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {classes.map((cls) => {
            const classAssignments = assignments.filter((a) => a.classId === cls.id);
            const misuCount = cls.students.filter((s) => s.needsMISU).length;
            const gradedCount = classAssignments.reduce((acc, assign) => {
              return (
                acc +
                cls.students.filter((s) => {
                  const sub = submissions[`${assign.id}_${s.id}`];
                  return sub?.draftStatus === 'graded' || sub?.finalStatus === 'graded';
                }).length
              );
            }, 0);

            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => onSelectClass(cls)}
                className="text-left bg-white p-6 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between group focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                      {cls.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Users size={13} aria-hidden="true" />
                        {cls.students.length} alumnos
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{misuCount} con MISU</span>
                      <span aria-hidden="true">·</span>
                      <span>{gradedCount} evaluaciones guardadas</span>
                    </div>
                  </div>
                  <FileText
                    className="text-slate-300 group-hover:text-indigo-300 transition-colors shrink-0"
                    size={36}
                    aria-hidden="true"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                  <span className="text-slate-600 font-medium tabular-nums">
                    {classAssignments.length}{' '}
                    {classAssignments.length === 1 ? 'tarea activa' : 'tareas activas'}
                  </span>
                  <span className="text-indigo-600 font-semibold inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Entrar <ArrowRight size={15} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
};
