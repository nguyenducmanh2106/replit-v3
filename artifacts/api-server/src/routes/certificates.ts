import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, certificatesTable, coursesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/certificates", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const rows = await db
    .select({
      cert: certificatesTable,
      course: coursesTable,
    })
    .from(certificatesTable)
    .innerJoin(coursesTable, eq(coursesTable.id, certificatesTable.courseId))
    .where(eq(certificatesTable.userId, dbUser.id))
    .orderBy(desc(certificatesTable.issuedAt));
  res.json(rows.map(r => ({
    id: r.cert.id,
    certificateNo: r.cert.certificateNo,
    courseId: r.cert.courseId,
    courseName: r.course.name,
    userId: r.cert.userId,
    userName: dbUser.name,
    issuedAt: r.cert.issuedAt.toISOString(),
  })));
});

router.get("/certificates/:certificateNo", async (req, res): Promise<void> => {
  const certificateNo = String(req.params.certificateNo);
  const [row] = await db
    .select({
      cert: certificatesTable,
      course: coursesTable,
      user: usersTable,
    })
    .from(certificatesTable)
    .innerJoin(coursesTable, eq(coursesTable.id, certificatesTable.courseId))
    .innerJoin(usersTable, eq(usersTable.id, certificatesTable.userId))
    .where(eq(certificatesTable.certificateNo, certificateNo));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    id: row.cert.id,
    certificateNo: row.cert.certificateNo,
    courseId: row.cert.courseId,
    courseName: row.course.name,
    userId: row.cert.userId,
    userName: row.user.name,
    issuedAt: row.cert.issuedAt.toISOString(),
  });
});

export default router;
