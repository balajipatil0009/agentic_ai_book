'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';

import { TimerPanel, type TimerChange } from '@/components/time/timer-panel';
import { addManualSession, deleteSession, updateSession } from '@/lib/actions/time';
import { cn, formatMinutes } from '@/lib/utils';

type SessionRow = {
  id: string;
  day: string;
  minutes: number;
  source: string;
  note: string;
  chapterId: string | null;
  chapterTitle: string | null;
  startedAt: string;
};

type Props = {
  chapters: { id: string; title: string }[];
  sessions: SessionRow[];
  activeTimer: { id: string; startedAt: string; chapterId: string | null } | null;
};

export function TimeLogTool({ chapters, sessions, activeTimer }: Props) {
  const router = useRouter();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ day: '', minutes: '', note: '' });
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    },
    [],
  );

  function notify(kind: 'ok' | 'error', text: string) {
    setMessage({ kind, text });
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 3500);
  }

  function handleTimerChange(change: TimerChange) {
    if (change.kind === 'stopped') {
      notify(
        'ok',
        typeof change.minutes === 'number'
          ? `Session logged — ${formatMinutes(change.minutes)}.`
          : 'Session stopped.',
      );
    } else if (change.kind === 'started') {
      notify('ok', 'Timer running. It keeps counting while you read.');
    } else {
      notify('error', change.message);
    }
    router.refresh();
  }

  async function submitManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(minutes);
    const result = await addManualSession({
      day: date,
      minutes: value,
      note,
      chapterId: chapterId || null,
    });
    if (result.ok) {
      setMinutes('');
      setNote('');
      notify('ok', 'Time added.');
      router.refresh();
    } else {
      notify('error', result.error ?? 'Could not save that entry.');
    }
  }

  async function saveEdit(id: string) {
    const result = await updateSession(id, {
      day: draft.day,
      minutes: Number(draft.minutes),
      note: draft.note,
    });
    if (result.ok) {
      setEditingId(null);
      notify('ok', 'Entry updated.');
      router.refresh();
    } else {
      notify('error', result.error ?? 'Could not update.');
    }
  }

  async function remove(id: string) {
    await deleteSession(id);
    notify('ok', 'Entry deleted.');
    router.refresh();
  }

  const grouped = useMemo(() => sessions, [sessions]);

  return (
    <div className="space-y-5">
      {message ? (
        <div
          role="status"
          className={cn(
            'rounded-lg border px-3.5 py-2.5 text-sm',
            message.kind === 'ok'
              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
              : 'border-red-400/25 bg-red-400/10 text-red-200',
          )}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <TimerPanel
          key={activeTimer ? `${activeTimer.id}:${activeTimer.startedAt}` : 'idle'}
          initial={activeTimer}
          onChanged={handleTimerChange}
        />

        {/* Manual entry */}
        <form onSubmit={submitManual} className="card p-6">
          <div className="text-[0.7rem] uppercase tracking-[0.16em] text-[var(--faint)]">
            Log time manually
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="manual-date">
                Date
              </label>
              <input
                id="manual-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="manual-minutes">
                Minutes
              </label>
              <input
                id="manual-minutes"
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                placeholder="45"
                className="input"
                required
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="label" htmlFor="manual-chapter">
              Chapter <span className="normal-case tracking-normal text-[var(--faint)]">(optional)</span>
            </label>
            <select
              id="manual-chapter"
              value={chapterId}
              onChange={(event) => setChapterId(event.target.value)}
              className="input"
            >
              <option value="">General study</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <label className="label" htmlFor="manual-note">
              Note <span className="normal-case tracking-normal text-[var(--faint)]">(optional)</span>
            </label>
            <input
              id="manual-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Built the ingestion worker"
              className="input"
              maxLength={200}
            />
          </div>

          <button type="submit" className="btn btn-primary mt-4 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add entry
          </button>
        </form>
      </div>

      {/* Sessions */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
          <h2 className="text-[0.95rem] font-semibold">Sessions</h2>
          <span className="text-[0.75rem] text-[var(--faint)]">
            {grouped.length} most recent entries
          </span>
        </div>

        {grouped.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">
            Nothing logged yet — start the timer or add an entry above.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {grouped.map((session) => {
              const isEditing = editingId === session.id;
              return (
                <li
                  key={session.id}
                  className="grid grid-cols-[92px_1fr_auto] items-center gap-3 px-5 py-3 transition hover:bg-white/[0.02] sm:grid-cols-[110px_1fr_auto_auto]"
                >
                  {isEditing ? (
                    <input
                      type="date"
                      value={draft.day}
                      onChange={(event) => setDraft((prev) => ({ ...prev, day: event.target.value }))}
                      className="input !py-1 !text-[0.8rem]"
                    />
                  ) : (
                    <span className="font-mono text-[0.78rem] text-[var(--muted)]">{session.day}</span>
                  )}

                  <div className="min-w-0">
                    {isEditing ? (
                      <input
                        value={draft.note}
                        onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
                        placeholder="What did you work on?"
                        className="input !py-1 !text-[0.82rem]"
                        maxLength={200}
                      />
                    ) : (
                      <span className="block truncate text-[0.88rem]">
                        {session.chapterTitle ?? session.note ?? 'Study session'}
                        {session.chapterTitle && session.note ? (
                          <span className="text-[var(--faint)]"> — {session.note}</span>
                        ) : null}
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={draft.minutes}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, minutes: event.target.value }))
                      }
                      className="input !w-20 !py-1 !text-[0.8rem]"
                    />
                  ) : (
                    <span className="hidden items-center gap-2 sm:flex">
                      <span
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider',
                          session.source === 'timer'
                            ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                            : 'border-violet-400/25 bg-violet-500/10 text-violet-300',
                        )}
                      >
                        {session.source}
                      </span>
                      <span className="w-14 text-right font-mono text-[0.85rem] tabular-nums text-emerald-300">
                        {formatMinutes(session.minutes)}
                      </span>
                    </span>
                  )}

                  <span className="flex items-center justify-end gap-1">
                    <span className="font-mono text-[0.8rem] tabular-nums text-emerald-300 sm:hidden">
                      {formatMinutes(session.minutes)}
                    </span>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(session.id)}
                          className="rounded-md p-1.5 text-emerald-300 hover:bg-emerald-400/10"
                          aria-label="Save"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-md p-1.5 text-[var(--muted)] hover:bg-white/[0.06]"
                          aria-label="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(session.id);
                            setDraft({
                              day: session.day,
                              minutes: String(session.minutes),
                              note: session.note ?? '',
                            });
                          }}
                          className="rounded-md p-1.5 text-[var(--muted)] hover:bg-white/[0.06] hover:text-white"
                          aria-label="Edit entry"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(session.id)}
                          className="rounded-md p-1.5 text-[var(--muted)] hover:bg-red-400/10 hover:text-red-300"
                          aria-label="Delete entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
