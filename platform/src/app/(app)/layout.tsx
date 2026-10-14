import { AppShell } from '@/components/app-shell';
import { requireUser } from '@/lib/auth';
import { getActiveTimer, getChaptersWithProgress } from '@/lib/queries';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [chapters, timer] = await Promise.all([
    getChaptersWithProgress(user.id),
    getActiveTimer(user.id),
  ]);

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      chapters={chapters.map((chapter) => ({
        id: chapter.id,
        slug: chapter.slug,
        title: chapter.title,
        kicker: chapter.kicker,
        completed: Boolean(chapter.completedAt),
        percent: chapter.totalSections
          ? Math.round((chapter.completedSections / chapter.totalSections) * 100)
          : chapter.completedAt
            ? 100
            : 0,
      }))}
      activeTimer={
        timer
          ? {
              id: timer.id,
              startedAt: new Date(timer.startedAt).toISOString(),
              chapterId: timer.chapterId,
            }
          : null
      }
    >
      {children}
    </AppShell>
  );
}
