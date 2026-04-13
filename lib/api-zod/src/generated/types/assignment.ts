export interface Assignment {
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
  questionCount: number;
  maxAttempts: number;
  allowReview: boolean;
  autoGrade: boolean;
  /** draft | published | closed */
  status: string;
  submissionCount: number;
  createdAt: Date;
}
