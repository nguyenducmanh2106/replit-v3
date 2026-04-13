import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, courseDocumentsTable, coursesTable, courseMembersTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireTeacherRole } from "../middlewares/requireRole";
import {
  CreateCourseDocumentBody,
  CreateCourseDocumentParams,
  DeleteCourseDocumentParams,
  GetCourseDocumentsParams,
} from "@workspace/api-zod";

const ADMIN_ROLES = ["system_admin", "center_admin", "school_admin", "enterprise_admin"];

async function isCourseMemberOrTeacher(userId: number, courseId: number, userRole: string): Promise<boolean> {
  if (ADMIN_ROLES.includes(userRole)) return true;
  const [course] = await db.select({ teacherId: coursesTable.teacherId }).from(coursesTable).where(eq(coursesTable.id, courseId));
  if (!course) return false;
  if (course.teacherId === userId) return true;
  const [member] = await db.select({ id: courseMembersTable.id }).from(courseMembersTable)
    .where(and(eq(courseMembersTable.courseId, courseId), eq(courseMembersTable.userId, userId)));
  return !!member;
}

const router: IRouter = Router();

router.get("/courses/:id/documents", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = GetCourseDocumentsParams.safeParse({ id: parseInt(String(req.params.id), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid course ID" }); return; }
  const courseId = params.data.id;

  const hasAccess = await isCourseMemberOrTeacher(dbUser.id, courseId, dbUser.role);
  if (!hasAccess) { res.status(403).json({ error: "Forbidden" }); return; }

  const docs = await db
    .select({
      id: courseDocumentsTable.id,
      courseId: courseDocumentsTable.courseId,
      uploadedBy: courseDocumentsTable.uploadedBy,
      uploaderName: usersTable.name,
      name: courseDocumentsTable.name,
      url: courseDocumentsTable.url,
      size: courseDocumentsTable.size,
      mimeType: courseDocumentsTable.mimeType,
      createdAt: courseDocumentsTable.createdAt,
    })
    .from(courseDocumentsTable)
    .innerJoin(usersTable, eq(courseDocumentsTable.uploadedBy, usersTable.id))
    .where(eq(courseDocumentsTable.courseId, courseId))
    .orderBy(courseDocumentsTable.createdAt);

  res.json(docs.map(d => ({
    ...d,
    size: d.size ?? null,
    mimeType: d.mimeType ?? null,
    createdAt: d.createdAt.toISOString(),
  })));
});

router.post("/courses/:id/documents", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const params = CreateCourseDocumentParams.safeParse({ id: parseInt(String(req.params.id), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid course ID" }); return; }
  const courseId = params.data.id;

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId));
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  if (course.teacherId !== dbUser.id && !ADMIN_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = CreateCourseDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [doc] = await db.insert(courseDocumentsTable).values({
    courseId,
    uploadedBy: dbUser.id,
    name: parsed.data.name,
    url: parsed.data.url,
    objectPath: parsed.data.objectPath ?? null,
    size: parsed.data.size ?? null,
    mimeType: parsed.data.mimeType ?? null,
  }).returning();

  res.status(201).json({
    id: doc!.id,
    courseId: doc!.courseId,
    uploadedBy: doc!.uploadedBy,
    uploaderName: dbUser.name,
    name: doc!.name,
    url: doc!.url,
    size: doc!.size ?? null,
    mimeType: doc!.mimeType ?? null,
    createdAt: doc!.createdAt.toISOString(),
  });
});

router.delete("/courses/:id/documents/:docId", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const params = DeleteCourseDocumentParams.safeParse({
    id: parseInt(String(req.params.id), 10),
    docId: parseInt(String(req.params.docId), 10),
  });
  if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, params.data.id));
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  if (course.teacherId !== dbUser.id && !ADMIN_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(courseDocumentsTable).where(
    and(eq(courseDocumentsTable.id, params.data.docId), eq(courseDocumentsTable.courseId, params.data.id))
  );
  res.sendStatus(204);
});

export default router;
