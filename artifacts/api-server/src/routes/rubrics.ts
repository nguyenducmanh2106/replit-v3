import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  db, rubricsTable, rubricCriteriaTable, rubricGradesTable,
  submissionsTable, answerAnnotationsTable, assignmentsTable, courseMembersTable, coursesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireTeacherRole } from "../middlewares/requireRole";
import {
  CreateRubricBody,
  ListRubricsQueryParams,
  GetRubricParams,
  DeleteRubricParams,
  SaveRubricGradesBody,
  SaveRubricGradesParams,
  GetSubmissionRubricGradesParams,
  CreateAnnotationBody,
  CreateAnnotationParams,
  DeleteAnnotationParams,
  GetSubmissionAnnotationsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const ADMIN_ROLES = ["system_admin", "center_admin", "school_admin", "enterprise_admin"];

async function getRubricWithCriteria(id: number) {
  const [rubric] = await db.select().from(rubricsTable).where(eq(rubricsTable.id, id));
  if (!rubric) return null;
  const criteria = await db.select().from(rubricCriteriaTable).where(eq(rubricCriteriaTable.rubricId, id))
    .orderBy(rubricCriteriaTable.orderIndex);
  return {
    id: rubric.id,
    title: rubric.title,
    skill: rubric.skill,
    description: rubric.description ?? null,
    createdBy: rubric.createdBy,
    createdAt: rubric.createdAt.toISOString(),
    criteria: criteria.map(c => ({
      id: c.id,
      rubricId: c.rubricId,
      name: c.name,
      description: c.description ?? null,
      maxPoints: c.maxPoints,
      orderIndex: c.orderIndex,
    })),
  };
}

async function canAccessSubmission(userId: number, userRole: string, submissionId: number): Promise<boolean> {
  if (ADMIN_ROLES.includes(userRole)) return true;
  const [submission] = await db.select({
    studentId: submissionsTable.studentId,
    assignmentId: submissionsTable.assignmentId,
  }).from(submissionsTable).where(eq(submissionsTable.id, submissionId));
  if (!submission) return false;
  if (submission.studentId === userId) return true;

  const [assignment] = await db.select({ courseId: assignmentsTable.courseId })
    .from(assignmentsTable).where(eq(assignmentsTable.id, submission.assignmentId));
  if (!assignment?.courseId) return false;

  const [course] = await db.select({ teacherId: coursesTable.teacherId })
    .from(coursesTable).where(eq(coursesTable.id, assignment.courseId));
  if (course?.teacherId === userId) return true;

  return false;
}

async function isTeacherOfSubmission(userId: number, userRole: string, submissionId: number): Promise<boolean> {
  if (ADMIN_ROLES.includes(userRole)) return true;
  const [submission] = await db.select({ assignmentId: submissionsTable.assignmentId })
    .from(submissionsTable).where(eq(submissionsTable.id, submissionId));
  if (!submission) return false;

  const [assignment] = await db.select({ courseId: assignmentsTable.courseId })
    .from(assignmentsTable).where(eq(assignmentsTable.id, submission.assignmentId));
  if (!assignment?.courseId) return false;

  const [course] = await db.select({ teacherId: coursesTable.teacherId })
    .from(coursesTable).where(eq(coursesTable.id, assignment.courseId));
  return course?.teacherId === userId;
}

router.get("/rubrics", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const qp = ListRubricsQueryParams.safeParse(req.query);
  const skill = qp.success ? qp.data.skill : undefined;

  let rubrics = await db.select().from(rubricsTable);
  if (skill) rubrics = rubrics.filter(r => r.skill === skill);

  const result = await Promise.all(rubrics.map(r => getRubricWithCriteria(r.id)));
  res.json(result.filter(Boolean));
});

router.post("/rubrics", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const parsed = CreateRubricBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [rubric] = await db.insert(rubricsTable).values({
    title: parsed.data.title,
    skill: parsed.data.skill,
    description: parsed.data.description ?? null,
    createdBy: dbUser.id,
  }).returning();

  if (parsed.data.criteria && parsed.data.criteria.length > 0) {
    for (const [i, c] of parsed.data.criteria.entries()) {
      await db.insert(rubricCriteriaTable).values({
        rubricId: rubric!.id,
        name: c.name,
        description: c.description ?? null,
        maxPoints: c.maxPoints,
        orderIndex: c.orderIndex ?? i,
      });
    }
  }

  const result = await getRubricWithCriteria(rubric!.id);
  res.status(201).json(result);
});

router.get("/rubrics/:id", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const params = GetRubricParams.safeParse({ id: parseInt(String(req.params.id), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const result = await getRubricWithCriteria(params.data.id);
  if (!result) { res.status(404).json({ error: "Rubric not found" }); return; }
  res.json(result);
});

router.delete("/rubrics/:id", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const params = DeleteRubricParams.safeParse({ id: parseInt(String(req.params.id), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [rubric] = await db.select().from(rubricsTable).where(eq(rubricsTable.id, params.data.id));
  if (!rubric) { res.status(404).json({ error: "Rubric not found" }); return; }
  if (rubric.createdBy !== dbUser.id && !ADMIN_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(rubricCriteriaTable).where(eq(rubricCriteriaTable.rubricId, params.data.id));
  await db.delete(rubricsTable).where(eq(rubricsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/submissions/:id/annotations", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = GetSubmissionAnnotationsParams.safeParse({ id: parseInt(String(req.params.id), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const hasAccess = await canAccessSubmission(dbUser.id, dbUser.role, params.data.id);
  if (!hasAccess) { res.status(403).json({ error: "Forbidden" }); return; }

  const annotations = await db.select().from(answerAnnotationsTable)
    .where(eq(answerAnnotationsTable.submissionId, params.data.id));

  res.json(annotations.map(a => ({
    id: a.id,
    submissionId: a.submissionId,
    questionId: a.questionId,
    teacherId: a.teacherId,
    startOffset: a.startOffset,
    endOffset: a.endOffset,
    comment: a.comment ?? null,
    color: a.color,
    createdAt: a.createdAt.toISOString(),
  })));
});

router.post("/submissions/:id/annotations", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const params = CreateAnnotationParams.safeParse({ id: parseInt(String(req.params.id), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const submissionId = params.data.id;

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, submissionId));
  if (!submission) { res.status(404).json({ error: "Submission not found" }); return; }

  const isTeacher = await isTeacherOfSubmission(dbUser.id, dbUser.role, submissionId);
  if (!isTeacher) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = CreateAnnotationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [annotation] = await db.insert(answerAnnotationsTable).values({
    submissionId,
    questionId: parsed.data.questionId,
    teacherId: dbUser.id,
    startOffset: parsed.data.startOffset,
    endOffset: parsed.data.endOffset,
    comment: parsed.data.comment ?? null,
    color: parsed.data.color ?? "yellow",
  }).returning();

  res.status(201).json({
    id: annotation!.id,
    submissionId: annotation!.submissionId,
    questionId: annotation!.questionId,
    teacherId: annotation!.teacherId,
    startOffset: annotation!.startOffset,
    endOffset: annotation!.endOffset,
    comment: annotation!.comment ?? null,
    color: annotation!.color,
    createdAt: annotation!.createdAt.toISOString(),
  });
});

router.delete("/submissions/:id/annotations/:annotationId", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const params = DeleteAnnotationParams.safeParse({
    id: parseInt(String(req.params.id), 10),
    annotationId: parseInt(String(req.params.annotationId), 10),
  });
  if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }

  const [annotation] = await db.select().from(answerAnnotationsTable)
    .where(and(eq(answerAnnotationsTable.id, params.data.annotationId), eq(answerAnnotationsTable.submissionId, params.data.id)));
  if (!annotation) { res.status(404).json({ error: "Annotation not found" }); return; }

  if (annotation.teacherId !== dbUser.id && !ADMIN_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(answerAnnotationsTable).where(eq(answerAnnotationsTable.id, params.data.annotationId));
  res.sendStatus(204);
});

router.get("/submissions/:id/rubric-grades", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = GetSubmissionRubricGradesParams.safeParse({ id: parseInt(String(req.params.id), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const hasAccess = await canAccessSubmission(dbUser.id, dbUser.role, params.data.id);
  if (!hasAccess) { res.status(403).json({ error: "Forbidden" }); return; }

  const grades = await db
    .select({
      id: rubricGradesTable.id,
      submissionId: rubricGradesTable.submissionId,
      criterionId: rubricGradesTable.criterionId,
      criterionName: rubricCriteriaTable.name,
      teacherId: rubricGradesTable.teacherId,
      score: rubricGradesTable.score,
      comment: rubricGradesTable.comment,
      createdAt: rubricGradesTable.createdAt,
    })
    .from(rubricGradesTable)
    .innerJoin(rubricCriteriaTable, eq(rubricGradesTable.criterionId, rubricCriteriaTable.id))
    .where(eq(rubricGradesTable.submissionId, params.data.id));

  res.json(grades.map(g => ({
    ...g,
    comment: g.comment ?? null,
    createdAt: g.createdAt.toISOString(),
  })));
});

router.post("/submissions/:id/rubric-grades", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const params = SaveRubricGradesParams.safeParse({ id: parseInt(String(req.params.id), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const submissionId = params.data.id;

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, submissionId));
  if (!submission) { res.status(404).json({ error: "Submission not found" }); return; }

  const isTeacher = await isTeacherOfSubmission(dbUser.id, dbUser.role, submissionId);
  if (!isTeacher) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = SaveRubricGradesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  for (const g of parsed.data.grades) {
    const existing = await db.select().from(rubricGradesTable).where(
      and(eq(rubricGradesTable.submissionId, submissionId), eq(rubricGradesTable.criterionId, g.criterionId))
    );
    if (existing.length > 0) {
      await db.update(rubricGradesTable).set({
        score: g.score,
        comment: g.comment ?? null,
        teacherId: dbUser.id,
      }).where(eq(rubricGradesTable.id, existing[0]!.id));
    } else {
      await db.insert(rubricGradesTable).values({
        submissionId,
        criterionId: g.criterionId,
        teacherId: dbUser.id,
        score: g.score,
        comment: g.comment ?? null,
      });
    }
  }

  const grades = await db
    .select({
      id: rubricGradesTable.id,
      submissionId: rubricGradesTable.submissionId,
      criterionId: rubricGradesTable.criterionId,
      criterionName: rubricCriteriaTable.name,
      teacherId: rubricGradesTable.teacherId,
      score: rubricGradesTable.score,
      comment: rubricGradesTable.comment,
      createdAt: rubricGradesTable.createdAt,
    })
    .from(rubricGradesTable)
    .innerJoin(rubricCriteriaTable, eq(rubricGradesTable.criterionId, rubricCriteriaTable.id))
    .where(eq(rubricGradesTable.submissionId, submissionId));

  res.json(grades.map(g => ({
    ...g,
    comment: g.comment ?? null,
    createdAt: g.createdAt.toISOString(),
  })));
});

export default router;
