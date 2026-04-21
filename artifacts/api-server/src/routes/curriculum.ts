import { Router, type IRouter } from "express";
import { eq, and, asc, inArray, sql } from "drizzle-orm";
import {
  db,
  coursesTable,
  courseMembersTable,
  chaptersTable,
  lessonsTable,
  lessonBlocksTable,
  lessonProgressTable,
  certificatesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { isTeacherOrAdmin } from "../middlewares/requireRole";

const router: IRouter = Router();

async function canManageCourse(courseId: number, userId: number, role: string): Promise<boolean> {
  if (role === "system_admin") return true;
  if (!isTeacherOrAdmin(role)) return false;
  const [c] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId));
  return !!c && c.teacherId === userId;
}

async function canViewCourse(courseId: number, userId: number, role: string): Promise<boolean> {
  if (await canManageCourse(courseId, userId, role)) return true;
  const [member] = await db
    .select()
    .from(courseMembersTable)
    .where(and(eq(courseMembersTable.courseId, courseId), eq(courseMembersTable.userId, userId)));
  return !!member;
}

function parseId(v: unknown): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) ? n : null;
}

async function getCourseIdForChapter(chapterId: number): Promise<number | null> {
  const [c] = await db.select().from(chaptersTable).where(eq(chaptersTable.id, chapterId));
  return c?.courseId ?? null;
}

async function getCourseIdForLesson(lessonId: number): Promise<number | null> {
  const [l] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, lessonId));
  if (!l) return null;
  return getCourseIdForChapter(l.chapterId);
}

async function getCourseIdForBlock(blockId: number): Promise<number | null> {
  const [b] = await db.select().from(lessonBlocksTable).where(eq(lessonBlocksTable.id, blockId));
  if (!b) return null;
  return getCourseIdForLesson(b.lessonId);
}

// ── Curriculum tree ──────────────────────────────────────────────────────────
router.get("/courses/:id/curriculum", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const courseId = parseId(req.params.id);
  if (!courseId) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!(await canViewCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const chapters = await db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.courseId, courseId))
    .orderBy(asc(chaptersTable.orderIndex), asc(chaptersTable.id));
  const chapterIds = chapters.map(c => c.id);
  const lessons = chapterIds.length
    ? await db
        .select()
        .from(lessonsTable)
        .where(inArray(lessonsTable.chapterId, chapterIds))
        .orderBy(asc(lessonsTable.orderIndex), asc(lessonsTable.id))
    : [];
  const completedRows = await db
    .select({ lessonId: lessonProgressTable.lessonId })
    .from(lessonProgressTable)
    .where(eq(lessonProgressTable.userId, dbUser.id));
  const completedSet = new Set(completedRows.map(r => r.lessonId));

  const lessonsByChapter = new Map<number, typeof lessons>();
  for (const l of lessons) {
    const arr = lessonsByChapter.get(l.chapterId) ?? [];
    arr.push(l);
    lessonsByChapter.set(l.chapterId, arr);
  }

  let totalLessons = 0, completedLessons = 0;
  const chaptersOut = chapters.map(c => {
    const ls = lessonsByChapter.get(c.id) ?? [];
    return {
      id: c.id,
      title: c.title,
      description: c.description ?? null,
      orderIndex: c.orderIndex,
      lessons: ls.map(l => {
        totalLessons++;
        const completed = completedSet.has(l.id);
        if (completed) completedLessons++;
        return {
          id: l.id,
          title: l.title,
          slug: l.slug ?? null,
          orderIndex: l.orderIndex,
          includeInPreview: l.includeInPreview,
          durationMinutes: l.durationMinutes ?? null,
          completed,
        };
      }),
    };
  });

  res.json({
    courseId,
    totalLessons,
    completedLessons,
    progressPercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    chapters: chaptersOut,
  });
});

// ── Chapters ─────────────────────────────────────────────────────────────────
router.get("/courses/:id/chapters", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const courseId = parseId(req.params.id);
  if (!courseId) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!(await canViewCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const rows = await db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.courseId, courseId))
    .orderBy(asc(chaptersTable.orderIndex), asc(chaptersTable.id));
  res.json(rows.map(r => ({
    id: r.id, courseId: r.courseId, title: r.title,
    description: r.description ?? null, orderIndex: r.orderIndex,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/courses/:id/chapters", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const courseId = parseId(req.params.id);
  if (!courseId) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!(await canManageCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const { title, description } = req.body ?? {};
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const [maxRow] = await db
    .select({ m: sql<number>`coalesce(max(${chaptersTable.orderIndex}), -1)` })
    .from(chaptersTable)
    .where(eq(chaptersTable.courseId, courseId));
  const [row] = await db.insert(chaptersTable).values({
    courseId, title, description: description ?? null,
    orderIndex: Number(maxRow?.m ?? -1) + 1,
  }).returning();
  res.status(201).json({
    id: row.id, courseId: row.courseId, title: row.title,
    description: row.description ?? null, orderIndex: row.orderIndex,
    createdAt: row.createdAt.toISOString(),
  });
});

router.patch("/chapters/:chapterId", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const chapterId = parseId(req.params.chapterId);
  if (!chapterId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForChapter(chapterId);
  if (!courseId) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canManageCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const patch: Record<string, unknown> = {};
  if (typeof req.body?.title === "string") patch.title = req.body.title;
  if (req.body?.description !== undefined) patch.description = req.body.description ?? null;
  if (typeof req.body?.orderIndex === "number") patch.orderIndex = req.body.orderIndex;
  const [row] = await db.update(chaptersTable).set(patch).where(eq(chaptersTable.id, chapterId)).returning();
  res.json({
    id: row.id, courseId: row.courseId, title: row.title,
    description: row.description ?? null, orderIndex: row.orderIndex,
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/chapters/:chapterId", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const chapterId = parseId(req.params.chapterId);
  if (!chapterId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForChapter(chapterId);
  if (!courseId) { res.status(204).end(); return; }
  if (!(await canManageCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(chaptersTable).where(eq(chaptersTable.id, chapterId));
  res.status(204).end();
});

router.post("/courses/:id/chapters/reorder", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const courseId = parseId(req.params.id);
  if (!courseId) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!(await canManageCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  for (let i = 0; i < ids.length; i++) {
    await db.update(chaptersTable).set({ orderIndex: i })
      .where(and(eq(chaptersTable.id, ids[i]), eq(chaptersTable.courseId, courseId)));
  }
  res.status(204).end();
});

// ── Lessons ──────────────────────────────────────────────────────────────────
router.get("/chapters/:chapterId/lessons", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const chapterId = parseId(req.params.chapterId);
  if (!chapterId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForChapter(chapterId);
  if (!courseId) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canViewCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const rows = await db
    .select()
    .from(lessonsTable)
    .where(eq(lessonsTable.chapterId, chapterId))
    .orderBy(asc(lessonsTable.orderIndex), asc(lessonsTable.id));
  res.json(rows.map(r => ({
    id: r.id, chapterId: r.chapterId, title: r.title,
    slug: r.slug ?? null, orderIndex: r.orderIndex,
    includeInPreview: r.includeInPreview,
    durationMinutes: r.durationMinutes ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/chapters/:chapterId/lessons", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const chapterId = parseId(req.params.chapterId);
  if (!chapterId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForChapter(chapterId);
  if (!courseId) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canManageCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const { title, slug, includeInPreview, durationMinutes } = req.body ?? {};
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const [maxRow] = await db
    .select({ m: sql<number>`coalesce(max(${lessonsTable.orderIndex}), -1)` })
    .from(lessonsTable)
    .where(eq(lessonsTable.chapterId, chapterId));
  const [row] = await db.insert(lessonsTable).values({
    chapterId, title,
    slug: slug ?? null,
    includeInPreview: !!includeInPreview,
    durationMinutes: durationMinutes ?? null,
    orderIndex: Number(maxRow?.m ?? -1) + 1,
  }).returning();
  res.status(201).json({
    id: row.id, chapterId: row.chapterId, title: row.title,
    slug: row.slug ?? null, orderIndex: row.orderIndex,
    includeInPreview: row.includeInPreview,
    durationMinutes: row.durationMinutes ?? null,
    createdAt: row.createdAt.toISOString(),
  });
});

router.get("/lessons/:lessonId", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const lessonId = parseId(req.params.lessonId);
  if (!lessonId) { res.status(400).json({ error: "Invalid id" }); return; }
  const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, lessonId));
  if (!lesson) { res.status(404).json({ error: "Not found" }); return; }
  const [chapter] = await db.select().from(chaptersTable).where(eq(chaptersTable.id, lesson.chapterId));
  if (!chapter) { res.status(404).json({ error: "Not found" }); return; }
  const courseId = chapter.courseId;
  if (!(await canViewCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const blocks = await db
    .select()
    .from(lessonBlocksTable)
    .where(eq(lessonBlocksTable.lessonId, lessonId))
    .orderBy(asc(lessonBlocksTable.orderIndex), asc(lessonBlocksTable.id));
  const [progress] = await db
    .select()
    .from(lessonProgressTable)
    .where(and(eq(lessonProgressTable.userId, dbUser.id), eq(lessonProgressTable.lessonId, lessonId)));
  res.json({
    id: lesson.id,
    chapterId: lesson.chapterId,
    title: lesson.title,
    slug: lesson.slug ?? null,
    orderIndex: lesson.orderIndex,
    includeInPreview: lesson.includeInPreview,
    durationMinutes: lesson.durationMinutes ?? null,
    createdAt: lesson.createdAt.toISOString(),
    chapterTitle: chapter.title,
    courseId,
    completed: !!progress,
    blocks: blocks.map(b => ({
      id: b.id, lessonId: b.lessonId, type: b.type,
      data: (b.data ?? {}) as Record<string, unknown>,
      orderIndex: b.orderIndex, createdAt: b.createdAt.toISOString(),
    })),
  });
});

router.patch("/lessons/:lessonId", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const lessonId = parseId(req.params.lessonId);
  if (!lessonId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForLesson(lessonId);
  if (!courseId) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canManageCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const patch: Record<string, unknown> = {};
  if (typeof req.body?.title === "string") patch.title = req.body.title;
  if (req.body?.slug !== undefined) patch.slug = req.body.slug ?? null;
  if (typeof req.body?.includeInPreview === "boolean") patch.includeInPreview = req.body.includeInPreview;
  if (req.body?.durationMinutes !== undefined) patch.durationMinutes = req.body.durationMinutes ?? null;
  if (typeof req.body?.orderIndex === "number") patch.orderIndex = req.body.orderIndex;
  const [row] = await db.update(lessonsTable).set(patch).where(eq(lessonsTable.id, lessonId)).returning();
  res.json({
    id: row.id, chapterId: row.chapterId, title: row.title,
    slug: row.slug ?? null, orderIndex: row.orderIndex,
    includeInPreview: row.includeInPreview,
    durationMinutes: row.durationMinutes ?? null,
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/lessons/:lessonId", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const lessonId = parseId(req.params.lessonId);
  if (!lessonId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForLesson(lessonId);
  if (!courseId) { res.status(204).end(); return; }
  if (!(await canManageCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(lessonsTable).where(eq(lessonsTable.id, lessonId));
  res.status(204).end();
});

router.post("/chapters/:chapterId/lessons/reorder", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const chapterId = parseId(req.params.chapterId);
  if (!chapterId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForChapter(chapterId);
  if (!courseId) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canManageCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  for (let i = 0; i < ids.length; i++) {
    await db.update(lessonsTable).set({ orderIndex: i })
      .where(and(eq(lessonsTable.id, ids[i]), eq(lessonsTable.chapterId, chapterId)));
  }
  res.status(204).end();
});

// ── Lesson Blocks ────────────────────────────────────────────────────────────
router.get("/lessons/:lessonId/blocks", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const lessonId = parseId(req.params.lessonId);
  if (!lessonId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForLesson(lessonId);
  if (!courseId) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canViewCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const rows = await db
    .select()
    .from(lessonBlocksTable)
    .where(eq(lessonBlocksTable.lessonId, lessonId))
    .orderBy(asc(lessonBlocksTable.orderIndex), asc(lessonBlocksTable.id));
  res.json(rows.map(r => ({
    id: r.id, lessonId: r.lessonId, type: r.type,
    data: (r.data ?? {}) as Record<string, unknown>,
    orderIndex: r.orderIndex, createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/lessons/:lessonId/blocks", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const lessonId = parseId(req.params.lessonId);
  if (!lessonId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForLesson(lessonId);
  if (!courseId) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canManageCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const { type, data, orderIndex } = req.body ?? {};
  if (!type) { res.status(400).json({ error: "type required" }); return; }
  let oi = typeof orderIndex === "number" ? orderIndex : null;
  if (oi === null) {
    const [maxRow] = await db
      .select({ m: sql<number>`coalesce(max(${lessonBlocksTable.orderIndex}), -1)` })
      .from(lessonBlocksTable)
      .where(eq(lessonBlocksTable.lessonId, lessonId));
    oi = Number(maxRow?.m ?? -1) + 1;
  }
  const [row] = await db.insert(lessonBlocksTable).values({
    lessonId, type, data: data ?? {}, orderIndex: oi,
  }).returning();
  res.status(201).json({
    id: row.id, lessonId: row.lessonId, type: row.type,
    data: (row.data ?? {}) as Record<string, unknown>,
    orderIndex: row.orderIndex, createdAt: row.createdAt.toISOString(),
  });
});

router.patch("/blocks/:blockId", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const blockId = parseId(req.params.blockId);
  if (!blockId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForBlock(blockId);
  if (!courseId) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canManageCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const patch: Record<string, unknown> = {};
  if (typeof req.body?.type === "string") patch.type = req.body.type;
  if (req.body?.data !== undefined) patch.data = req.body.data;
  if (typeof req.body?.orderIndex === "number") patch.orderIndex = req.body.orderIndex;
  const [row] = await db.update(lessonBlocksTable).set(patch).where(eq(lessonBlocksTable.id, blockId)).returning();
  res.json({
    id: row.id, lessonId: row.lessonId, type: row.type,
    data: (row.data ?? {}) as Record<string, unknown>,
    orderIndex: row.orderIndex, createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/blocks/:blockId", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const blockId = parseId(req.params.blockId);
  if (!blockId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForBlock(blockId);
  if (!courseId) { res.status(204).end(); return; }
  if (!(await canManageCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(lessonBlocksTable).where(eq(lessonBlocksTable.id, blockId));
  res.status(204).end();
});

router.post("/lessons/:lessonId/blocks/reorder", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const lessonId = parseId(req.params.lessonId);
  if (!lessonId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForLesson(lessonId);
  if (!courseId) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canManageCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  for (let i = 0; i < ids.length; i++) {
    await db.update(lessonBlocksTable).set({ orderIndex: i })
      .where(and(eq(lessonBlocksTable.id, ids[i]), eq(lessonBlocksTable.lessonId, lessonId)));
  }
  res.status(204).end();
});

// ── Mark complete + auto-issue certificate ──────────────────────────────────
router.post("/lessons/:lessonId/complete", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const lessonId = parseId(req.params.lessonId);
  if (!lessonId) { res.status(400).json({ error: "Invalid id" }); return; }
  const courseId = await getCourseIdForLesson(lessonId);
  if (!courseId) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canViewCourse(courseId, dbUser.id, dbUser.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.insert(lessonProgressTable).values({ userId: dbUser.id, lessonId })
    .onConflictDoNothing({ target: [lessonProgressTable.userId, lessonProgressTable.lessonId] });

  // Compute progress
  const allLessons = await db
    .select({ id: lessonsTable.id })
    .from(lessonsTable)
    .innerJoin(chaptersTable, eq(chaptersTable.id, lessonsTable.chapterId))
    .where(eq(chaptersTable.courseId, courseId));
  const totalLessons = allLessons.length;
  const lessonIdSet = allLessons.map(l => l.id);
  const completed = lessonIdSet.length
    ? await db
        .select({ id: lessonProgressTable.lessonId })
        .from(lessonProgressTable)
        .where(and(eq(lessonProgressTable.userId, dbUser.id), inArray(lessonProgressTable.lessonId, lessonIdSet)))
    : [];
  const completedLessons = completed.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  let certificateNo: string | null = null;
  if (totalLessons > 0 && completedLessons === totalLessons) {
    const [existing] = await db
      .select()
      .from(certificatesTable)
      .where(and(eq(certificatesTable.userId, dbUser.id), eq(certificatesTable.courseId, courseId)));
    if (existing) {
      certificateNo = existing.certificateNo;
    } else {
      const no = `CERT-${courseId}-${dbUser.id}-${Date.now().toString(36).toUpperCase()}`;
      const [cert] = await db.insert(certificatesTable).values({
        courseId, userId: dbUser.id, certificateNo: no,
      }).returning();
      certificateNo = cert.certificateNo;
    }
  }

  res.json({ courseId, totalLessons, completedLessons, progressPercent, certificateNo });
});

export default router;
