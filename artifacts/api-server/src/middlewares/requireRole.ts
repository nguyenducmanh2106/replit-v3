import { type Request, type Response, type NextFunction } from "express";

export const TEACHER_ROLES = ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"] as const;
export type TeacherRole = typeof TEACHER_ROLES[number];

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const dbUser = req.dbUser;
    if (!dbUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(dbUser.role)) {
      res.status(403).json({ error: "Forbidden: insufficient permissions" });
      return;
    }
    next();
  };
}

export function requireTeacherRole() {
  return requireRole(...TEACHER_ROLES);
}

export function isTeacherOrAdmin(role: string): boolean {
  return (TEACHER_ROLES as readonly string[]).includes(role);
}
