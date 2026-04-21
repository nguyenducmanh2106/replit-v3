import { Router, type IRouter } from "express";
import { eq, and, asc, desc, ilike, sql } from "drizzle-orm";
import {
  db,
  coursesTable,
  usersTable,
  courseMembersTable,
  chaptersTable,
  lessonsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/catalog/courses", async (req, res): Promise<void> => {
  const category = typeof req.query.category === "string" ? req.query.category : null;
  const level = typeof req.query.level === "string" ? req.query.level : null;
  const search = typeof req.query.search === "string" ? req.query.search
    : typeof req.query.q === "string" ? req.query.q : null;

  const conds = [eq(coursesTable.published, true)];
  if (category) conds.push(eq(coursesTable.category, category));
  if (level) conds.push(eq(coursesTable.level, level));
  if (search) conds.push(ilike(coursesTable.name, `%${search}%`));

  const courses = await db
    .select()
    .from(coursesTable)
    .where(and(...conds))
    .orderBy(desc(coursesTable.createdAt));

  if (courses.length === 0) {
    res.json([]);
    return;
  }

  const courseIds = courses.map(c => c.id);
  const teacherIds = Array.from(new Set(courses.map(c => c.teacherId).filter((x): x is number => !!x)));
  const teachers = teacherIds.length
    ? await db.select().from(usersTable).where(sql`${usersTable.id} = ANY(${teacherIds})`)
    : [];
  const teacherMap = new Map(teachers.map(t => [t.id, t]));

  const memberCounts = await db
    .select({
      courseId: courseMembersTable.courseId,
      cnt: sql<number>`count(*)::int`,
    })
    .from(courseMembersTable)
    .where(sql`${courseMembersTable.courseId} = ANY(${courseIds})`)
    .groupBy(courseMembersTable.courseId);
  const memberMap = new Map(memberCounts.map(m => [m.courseId, Number(m.cnt)]));

  const lessonCounts = await db
    .select({
      courseId: chaptersTable.courseId,
      cnt: sql<number>`count(${lessonsTable.id})::int`,
    })
    .from(chaptersTable)
    .leftJoin(lessonsTable, eq(lessonsTable.chapterId, chaptersTable.id))
    .where(sql`${chaptersTable.courseId} = ANY(${courseIds})`)
    .groupBy(chaptersTable.courseId);
  const lessonMap = new Map(lessonCounts.map(l => [l.courseId, Number(l.cnt)]));

  res.json(courses.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug ?? null,
    shortDescription: c.shortDescription ?? null,
    description: c.description ?? null,
    level: c.level ?? null,
    category: c.category ?? null,
    tags: c.tags ?? [],
    coverImage: c.coverImage ?? null,
    teacherName: c.teacherId ? (teacherMap.get(c.teacherId)?.name ?? null) : null,
    studentCount: memberMap.get(c.id) ?? 0,
    totalLessons: lessonMap.get(c.id) ?? 0,
  })));
});

router.get("/catalog/courses/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const [course] = await db
    .select()
    .from(coursesTable)
    .where(and(eq(coursesTable.slug, slug), eq(coursesTable.published, true)));
  if (!course) { res.status(404).json({ error: "Not found" }); return; }

  let teacherName: string | null = null;
  if (course.teacherId) {
    const [t] = await db.select().from(usersTable).where(eq(usersTable.id, course.teacherId));
    teacherName = t?.name ?? null;
  }
  const [memberRow] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(courseMembersTable)
    .where(eq(courseMembersTable.courseId, course.id));
  const chapters = await db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.courseId, course.id))
    .orderBy(asc(chaptersTable.orderIndex), asc(chaptersTable.id));
  const chapterIds = chapters.map(c => c.id);
  const lessons = chapterIds.length
    ? await db
        .select()
        .from(lessonsTable)
        .where(sql`${lessonsTable.chapterId} = ANY(${chapterIds})`)
        .orderBy(asc(lessonsTable.orderIndex), asc(lessonsTable.id))
    : [];
  const previewLessons = lessons.filter(l => l.includeInPreview).map(l => ({
    id: l.id, title: l.title, durationMinutes: l.durationMinutes ?? null,
  }));

  let isEnrolled = false;
  const dbUser = req.dbUser;
  if (dbUser) {
    const [m] = await db
      .select()
      .from(courseMembersTable)
      .where(and(eq(courseMembersTable.courseId, course.id), eq(courseMembersTable.userId, dbUser.id)));
    isEnrolled = !!m;
  }

  res.json({
    id: course.id,
    name: course.name,
    slug: course.slug ?? null,
    shortDescription: course.shortDescription ?? null,
    description: course.description ?? null,
    level: course.level ?? null,
    category: course.category ?? null,
    tags: course.tags ?? [],
    coverImage: course.coverImage ?? null,
    teacherName,
    studentCount: Number(memberRow?.cnt ?? 0),
    totalLessons: lessons.length,
    chapters: chapters.map(c => {
      const cLessons = lessons.filter(l => l.chapterId === c.id);
      return {
        id: c.id,
        title: c.title,
        lessonCount: cLessons.length,
        previewLessons: cLessons.filter(l => l.includeInPreview).map(l => ({ id: l.id, title: l.title })),
      };
    }),
    isEnrolled,
  });
});

router.post("/courses/:id/enroll", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const courseId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(courseId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId));
  if (!course) { res.status(404).json({ error: "Not found" }); return; }
  if (!course.published) { res.status(403).json({ error: "Course not published" }); return; }

  const [existing] = await db
    .select()
    .from(courseMembersTable)
    .where(and(eq(courseMembersTable.courseId, courseId), eq(courseMembersTable.userId, dbUser.id)));
  let member = existing;
  if (!existing) {
    [member] = await db.insert(courseMembersTable).values({
      courseId, userId: dbUser.id, role: "student",
    }).returning();
  }
  res.status(existing ? 200 : 201).json({
    id: member.id,
    courseId: member.courseId,
    userId: member.userId,
    name: dbUser.name,
    email: dbUser.email,
    avatarUrl: dbUser.avatarUrl ?? null,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
  });
});

export default router;
