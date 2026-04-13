import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, coursesTable, usersTable, courseMembersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireTeacherRole } from "../middlewares/requireRole";
import { ImportCourseMembersBody, ImportCourseMembersParams } from "@workspace/api-zod";

const ADMIN_ROLES = ["system_admin", "center_admin", "school_admin", "enterprise_admin"];

const router: IRouter = Router();

function parseCSV(csvData: string): Array<{ email?: string; name?: string; role?: string }> {
  const lines = csvData.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const header = lines[0]!.split(",").map(h => h.trim().toLowerCase());
  const rows: Array<{ email?: string; name?: string; role?: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const values = line.split(",").map(v => v.trim());
    const row: Record<string, string> = {};
    header.forEach((h, idx) => { if (values[idx] !== undefined) row[h] = values[idx]!; });
    rows.push({ email: row.email, name: row.name, role: row.role });
  }
  return rows;
}

router.post("/courses/:id/import-members", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const params = ImportCourseMembersParams.safeParse({ id: parseInt(String(req.params.id), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid course ID" }); return; }
  const courseId = params.data.id;

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId));
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  if (course.teacherId !== dbUser.id && !ADMIN_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = ImportCourseMembersBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const rows = parseCSV(parsed.data.csvData);
  const defaultRole = parsed.data.role ?? "student";

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.email) {
      errors.push(`Row missing email: ${JSON.stringify(row)}`);
      skipped++;
      continue;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, row.email));
    if (!user) {
      errors.push(`User not found: ${row.email}`);
      skipped++;
      continue;
    }

    const existing = await db.select().from(courseMembersTable).where(
      and(eq(courseMembersTable.courseId, courseId), eq(courseMembersTable.userId, user.id))
    );
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(courseMembersTable).values({
      courseId,
      userId: user.id,
      role: row.role ?? defaultRole,
    });
    imported++;
  }

  res.json({ imported, skipped, errors });
});

export default router;
