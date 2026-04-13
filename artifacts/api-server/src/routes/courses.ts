import { Router, type IRouter } from "express";
import { eq, sql, inArray } from "drizzle-orm";
import { db, coursesTable, usersTable, courseMembersTable } from "@workspace/db";
import {
  ListCoursesResponse,
  CreateCourseBody,
  GetCourseParams,
  GetCourseResponse,
  UpdateCourseParams,
  UpdateCourseBody,
  UpdateCourseResponse,
  DeleteCourseParams,
  GetCourseMembersParams,
  GetCourseMembersResponse,
  AddCourseMemberParams,
  AddCourseMemberBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireTeacherRole, isTeacherOrAdmin } from "../middlewares/requireRole";

const router: IRouter = Router();

async function getCourseWithDetails(id: number) {
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, id));
  if (!course) return null;
  const memberCount = await db.select({ count: sql<number>`count(*)` }).from(courseMembersTable).where(eq(courseMembersTable.courseId, id));
  let teacherName: string | null = null;
  if (course.teacherId) {
    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, course.teacherId));
    teacherName = teacher?.name ?? null;
  }
  return {
    id: course.id,
    name: course.name,
    description: course.description ?? null,
    level: course.level ?? null,
    teacherId: course.teacherId ?? null,
    teacherName,
    studentCount: Number(memberCount[0]?.count ?? 0),
    status: course.status,
    createdAt: course.createdAt.toISOString(),
  };
}

router.get("/courses", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let courses;
  if (dbUser.role === "system_admin") {
    courses = await db.select().from(coursesTable);
  } else if (isTeacherOrAdmin(dbUser.role)) {
    courses = await db.select().from(coursesTable).where(eq(coursesTable.teacherId, dbUser.id));
  } else {
    // Students: only see courses they are enrolled in
    const memberships = await db
      .select({ courseId: courseMembersTable.courseId })
      .from(courseMembersTable)
      .where(eq(courseMembersTable.userId, dbUser.id));
    const enrolledIds = memberships.map(m => m.courseId);
    courses = enrolledIds.length > 0
      ? await db.select().from(coursesTable).where(inArray(coursesTable.id, enrolledIds))
      : [];
  }

  const result = await Promise.all(courses.map(c => getCourseWithDetails(c.id)));
  res.json(ListCoursesResponse.parse(result.filter(Boolean)));
});

router.post("/courses", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateCourseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [course] = await db.insert(coursesTable).values({
    ...parsed.data,
    teacherId: dbUser.id,
  }).returning();
  const detail = await getCourseWithDetails(course.id);
  res.status(201).json(GetCourseResponse.parse(detail));
});

router.get("/courses/:id", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetCourseParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, params.data.id));
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  // Verify access: owner, system_admin, or enrolled student
  if (dbUser.role !== "system_admin") {
    if (isTeacherOrAdmin(dbUser.role)) {
      if (course.teacherId !== dbUser.id) {
        res.status(403).json({ error: "Forbidden: you do not own this course" });
        return;
      }
    } else {
      const membershipRows = await db.select().from(courseMembersTable).where(
        eq(courseMembersTable.courseId, params.data.id)
      );
      const membership = membershipRows.find(r => r.userId === dbUser.id);
      if (!membership) {
        res.status(403).json({ error: "Forbidden: you are not enrolled in this course" });
        return;
      }
    }
  }

  const detail = await getCourseWithDetails(params.data.id);
  if (!detail) {
    res.status(404).json({ error: "Course not found" });
    return;
  }
  res.json(GetCourseResponse.parse(detail));
});

router.patch("/courses/:id", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateCourseParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(coursesTable).where(eq(coursesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Course not found" });
    return;
  }
  // Only course owner or system_admin can update
  if (existing.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden: you do not own this course" });
    return;
  }

  const parsed = UpdateCourseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.description != null) updates.description = parsed.data.description;
  if (parsed.data.level != null) updates.level = parsed.data.level;
  if (parsed.data.teacherId != null) updates.teacherId = parsed.data.teacherId;
  if (parsed.data.status != null) updates.status = parsed.data.status;

  await db.update(coursesTable).set(updates).where(eq(coursesTable.id, params.data.id));
  const detail = await getCourseWithDetails(params.data.id);
  if (!detail) {
    res.status(404).json({ error: "Course not found" });
    return;
  }
  res.json(UpdateCourseResponse.parse(detail));
});

router.delete("/courses/:id", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteCourseParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(coursesTable).where(eq(coursesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Course not found" });
    return;
  }
  // Only course owner or system_admin can delete
  if (existing.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden: you do not own this course" });
    return;
  }

  await db.delete(coursesTable).where(eq(coursesTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/courses/:id/members", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetCourseMembersParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existingCourse] = await db.select().from(coursesTable).where(eq(coursesTable.id, params.data.id));
  if (!existingCourse) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  if (dbUser.role !== "system_admin") {
    if (isTeacherOrAdmin(dbUser.role)) {
      if (existingCourse.teacherId !== dbUser.id) {
        res.status(403).json({ error: "Forbidden: you do not own this course" });
        return;
      }
    } else {
      const membershipRows = await db.select().from(courseMembersTable).where(eq(courseMembersTable.courseId, params.data.id));
      const membership = membershipRows.find(r => r.userId === dbUser.id);
      if (!membership) {
        res.status(403).json({ error: "Forbidden: you are not enrolled in this course" });
        return;
      }
    }
  }

  const members = await db
    .select({
      id: courseMembersTable.id,
      userId: courseMembersTable.userId,
      courseId: courseMembersTable.courseId,
      role: courseMembersTable.role,
      userName: usersTable.name,
      userEmail: usersTable.email,
      joinedAt: courseMembersTable.joinedAt,
    })
    .from(courseMembersTable)
    .innerJoin(usersTable, eq(courseMembersTable.userId, usersTable.id))
    .where(eq(courseMembersTable.courseId, params.data.id));
  res.json(GetCourseMembersResponse.parse(members.map(m => ({ ...m, joinedAt: m.joinedAt.toISOString() }))));
});

router.post("/courses/:id/members", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AddCourseMemberParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Only course owner or system_admin can add members
  const [existingCourse] = await db.select().from(coursesTable).where(eq(coursesTable.id, params.data.id));
  if (!existingCourse) {
    res.status(404).json({ error: "Course not found" });
    return;
  }
  if (existingCourse.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden: you do not own this course" });
    return;
  }

  const parsed = AddCourseMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [member] = await db.insert(courseMembersTable).values({
    courseId: params.data.id,
    userId: parsed.data.userId,
    role: parsed.data.role,
  }).returning();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, member.userId));
  res.status(201).json({
    id: member.id,
    userId: member.userId,
    courseId: member.courseId,
    role: member.role,
    userName: user?.name ?? "",
    userEmail: user?.email ?? "",
    joinedAt: member.joinedAt.toISOString(),
  });
});

export default router;
