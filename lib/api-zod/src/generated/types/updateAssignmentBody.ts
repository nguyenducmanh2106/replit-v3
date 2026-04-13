export interface UpdateAssignmentBody {
  title?: string;
  description?: string;
  courseId?: number;
  dueDate?: Date;
  startTime?: Date;
  endTime?: Date;
  timeLimitMinutes?: number;
  maxAttempts?: number;
  allowReview?: boolean;
  autoGrade?: boolean;
  status?: string;
}
