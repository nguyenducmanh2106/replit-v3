import type { AssignmentQuestion } from "./assignmentQuestion";

export interface AssignmentWithQuestions {
  id: number;
  title: string;
  /** @nullable */
  description?: string | null;
  /** @nullable */
  courseId?: number | null;
  /** @nullable */
  courseName?: string | null;
  teacherId: number;
  /** @nullable */
  dueDate?: Date | null;
  /** @nullable */
  startTime?: Date | null;
  /** @nullable */
  endTime?: Date | null;
  /** @nullable */
  timeLimitMinutes?: number | null;
  totalPoints: number;
  maxAttempts: number;
  allowReview: boolean;
  status: string;
  submissionCount: number;
  createdAt: Date;
  questions: AssignmentQuestion[];
}
