import { db, usersTable, coursesTable, courseMembersTable, questionsTable, assignmentsTable, assignmentQuestionsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export async function seedIfEmpty() {
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(coursesTable);
  if (Number(countResult?.count ?? 0) > 0) return;

  logger.info("Seeding demo data...");

  const [teacher] = await db.insert(usersTable).values({
    clerkId: "demo_teacher_1",
    email: "teacher@edu.vn",
    name: "Nguyễn Minh Anh",
    role: "teacher",
    organization: "Trường THPT Hà Nội",
  }).onConflictDoNothing().returning();

  const [student1] = await db.insert(usersTable).values({
    clerkId: "demo_student_1",
    email: "student1@edu.vn",
    name: "Trần Văn Bình",
    role: "student",
    organization: "Trường THPT Hà Nội",
  }).onConflictDoNothing().returning();

  const [student2] = await db.insert(usersTable).values({
    clerkId: "demo_student_2",
    email: "student2@edu.vn",
    name: "Lê Thị Cẩm",
    role: "student",
    organization: "Trường THPT Hà Nội",
  }).onConflictDoNothing().returning();

  if (!teacher) return;

  const [course1] = await db.insert(coursesTable).values({
    name: "Tiếng Anh B2 — Lớp 12A",
    description: "Khoá học tiếng Anh cấp độ B2 dành cho học sinh lớp 12",
    level: "B2",
    teacherId: teacher.id,
    status: "active",
  }).returning();

  const [course2] = await db.insert(coursesTable).values({
    name: "Luyện thi IELTS Band 6.5",
    description: "Khoá luyện thi IELTS nhắm mục tiêu 6.5",
    level: "B2",
    teacherId: teacher.id,
    status: "active",
  }).returning();

  if (student1) {
    await db.insert(courseMembersTable).values({ courseId: course1.id, userId: student1.id, role: "student" }).onConflictDoNothing();
    await db.insert(courseMembersTable).values({ courseId: course2.id, userId: student1.id, role: "student" }).onConflictDoNothing();
  }
  if (student2) {
    await db.insert(courseMembersTable).values({ courseId: course1.id, userId: student2.id, role: "student" }).onConflictDoNothing();
  }

  // 1. Trắc nghiệm (MCQ)
  const [q1] = await db.insert(questionsTable).values({
    type: "mcq", skill: "reading", level: "B2",
    content: "The committee _______ the proposal after a long discussion.",
    options: JSON.stringify(["approved", "was approved", "has approved", "approving"]),
    correctAnswer: "approved",
    explanation: "'approved' là thì quá khứ đơn phù hợp với ngữ cảnh 'after a long discussion'. Các đáp án còn lại sai về thì hoặc dạng động từ.",
    points: 1, createdBy: teacher.id,
  }).returning();

  // 2. Đúng/Sai (True/False)
  const [q2] = await db.insert(questionsTable).values({
    type: "true_false", skill: "reading", level: "B1",
    content: "The Great Wall of China is visible from space with the naked eye.",
    correctAnswer: "false",
    explanation: "Đây là quan niệm sai phổ biến. Tường thành chỉ rộng 4-8m, quá hẹp để nhìn thấy bằng mắt thường từ quỹ đạo.",
    points: 1, createdBy: teacher.id,
  }).returning();

  // 3. Điền chỗ trống (Fill Blank)
  const [q3] = await db.insert(questionsTable).values({
    type: "fill_blank", skill: "grammar", level: "B1",
    content: "Despite the heavy rain, the students ___ to school on time yesterday.",
    correctAnswer: "arrived",
    explanation: "Dùng thì quá khứ đơn 'arrived' vì có 'yesterday'. 'Despite' + noun/V-ing không ảnh hưởng đến thì của mệnh đề chính.",
    points: 2, createdBy: teacher.id,
  }).returning();

  // 4. Chọn từ (Word Selection)
  const [q4] = await db.insert(questionsTable).values({
    type: "word_selection", skill: "vocabulary", level: "B1",
    content: "Select all the ADJECTIVES in the sentence:\n\"The quick brown fox jumps over the lazy old dog.\"",
    options: JSON.stringify(["The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "old", "dog"]),
    correctAnswer: "quick,brown,lazy,old",
    explanation: "Tính từ: quick (nhanh), brown (nâu), lazy (lười), old (già). Chúng bổ nghĩa cho danh từ fox và dog.",
    points: 2, createdBy: teacher.id,
  }).returning();

  // 5. Nối cặp (Matching)
  const [q5] = await db.insert(questionsTable).values({
    type: "matching", skill: "vocabulary", level: "B2",
    content: "Match each word with its correct definition.",
    options: JSON.stringify([
      "Abundant | Present in large quantities; more than enough",
      "Brevity | Concise and exact use of words in writing",
      "Candid | Truthful and straightforward; not hiding anything",
      "Diligent | Showing care and hard work in one's duties",
    ]),
    correctAnswer: JSON.stringify({
      "Abundant": "Present in large quantities; more than enough",
      "Brevity": "Concise and exact use of words in writing",
      "Candid": "Truthful and straightforward; not hiding anything",
      "Diligent": "Showing care and hard work in one's duties",
    }),
    explanation: "Abundant=dồi dào, Brevity=ngắn gọn, Candid=thẳng thắn, Diligent=chăm chỉ. Đây là từ vựng học thuật quan trọng trong IELTS.",
    points: 4, createdBy: teacher.id,
  }).returning();

  // 6. Kéo thả (Drag & Drop)
  const [q6] = await db.insert(questionsTable).values({
    type: "drag_drop", skill: "grammar", level: "B2",
    content: "Arrange these words to form a grammatically correct sentence.",
    options: JSON.stringify(["learning", "is", "Language", "challenging", "rewarding", "but", "ultimately"]),
    correctAnswer: JSON.stringify(["Language", "learning", "is", "challenging", "but", "ultimately", "rewarding"]),
    explanation: "Câu đúng: 'Language learning is challenging but ultimately rewarding.' Cấu trúc: Chủ ngữ + Động từ + Tính từ bổ ngữ.",
    points: 3, createdBy: teacher.id,
  }).returning();

  // 7. Sắp xếp câu (Sentence Reorder)
  const [q7] = await db.insert(questionsTable).values({
    type: "sentence_reorder", skill: "writing", level: "B2",
    content: "Arrange these sentences in the correct order to form a coherent paragraph.",
    options: JSON.stringify([
      "Therefore, it is important to start learning languages from an early age.",
      "Learning a foreign language has numerous benefits for personal and professional development.",
      "Moreover, young learners acquire pronunciation and grammar more naturally.",
      "It opens doors to new cultures, opportunities, and ways of thinking.",
    ]),
    correctAnswer: JSON.stringify([
      "Learning a foreign language has numerous benefits for personal and professional development.",
      "It opens doors to new cultures, opportunities, and ways of thinking.",
      "Moreover, young learners acquire pronunciation and grammar more naturally.",
      "Therefore, it is important to start learning languages from an early age.",
    ]),
    explanation: "Cấu trúc đoạn văn: Topic sentence → Phát triển ý → Bổ sung (moreover) → Kết luận (therefore).",
    points: 4, createdBy: teacher.id,
  }).returning();

  // 8. Đọc hiểu (Reading)
  const [q8] = await db.insert(questionsTable).values({
    type: "reading", skill: "reading", level: "B2",
    content: "According to the passage, what is the PRIMARY driver of climate change?",
    passage: `Climate Change and Human Activity

Climate change refers to long-term shifts in global temperatures and weather patterns. While some climate change is natural, scientific evidence overwhelmingly shows that human activities have been the main driver since the 1800s.

The burning of fossil fuels such as coal, oil, and gas generates greenhouse gas emissions that act like a blanket wrapped around the Earth, trapping the sun's heat and raising temperatures. Between 1990 and 2016, global greenhouse gas emissions increased by 43 percent, with carbon dioxide (CO₂) being the largest contributor.

The consequences are wide-ranging: rising sea levels threatening coastal communities, more frequent and severe weather events, disruptions to ecosystems, and food and water insecurity. The IPCC warns that limiting global warming to 1.5°C requires rapid, far-reaching changes in all aspects of society.

Experts agree that the transition to renewable energy sources such as solar and wind power is critical. Improving energy efficiency, protecting forests, and shifting to sustainable agriculture are all necessary components of a comprehensive response.`,
    correctAnswer: "human activities / burning of fossil fuels",
    explanation: "Đoạn văn nêu rõ: 'human activities have been the main driver since the 1800s', cụ thể là việc đốt nhiên liệu hóa thạch (burning of fossil fuels).",
    points: 3, createdBy: teacher.id,
  }).returning();

  // 9. Nghe hiểu (Listening)
  const [q9] = await db.insert(questionsTable).values({
    type: "listening", skill: "listening", level: "B1",
    content: "Listen to the audio clip and answer: What does the speaker say about daily exercise?",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    options: JSON.stringify([
      "It should last at least 60 minutes every day",
      "Even 30 minutes of moderate activity has significant health benefits",
      "Only intense workouts provide health benefits",
      "Exercise is less important than diet",
    ]),
    correctAnswer: "Even 30 minutes of moderate activity has significant health benefits",
    explanation: "Theo bài nghe, chỉ cần 30 phút vận động vừa phải mỗi ngày đã mang lại lợi ích sức khỏe đáng kể. Không cần tập luyện cường độ cao.",
    points: 2, createdBy: teacher.id,
  }).returning();

  // 10. Video tương tác (Video Interactive)
  const [q10] = await db.insert(questionsTable).values({
    type: "video_interactive", skill: "listening", level: "B2",
    content: "Watch the video clip. In your own words, describe what you observed and what you think the main message is.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    explanation: "Câu trả lời tốt cần: mô tả những gì quan sát được, diễn giải thông điệp chính bằng ngôn ngữ của bản thân, và liên hệ với kiến thức đã học.",
    points: 5, createdBy: teacher.id,
  }).returning();

  // 11. Bài luận (Essay)
  const [q11] = await db.insert(questionsTable).values({
    type: "essay", skill: "writing", level: "B2",
    content: "Some people believe that technology has made our lives more complicated rather than simpler. To what extent do you agree or disagree?\n\nWrite a well-structured essay (200-250 words) with an introduction, body paragraphs, and conclusion. Support your arguments with specific examples.",
    explanation: "Tiêu chí chấm: (1) Trả lời đúng câu hỏi, (2) Cấu trúc rõ ràng, (3) Ví dụ cụ thể, (4) Từ vựng học thuật, (5) Ngữ pháp đa dạng và chính xác.",
    points: 10, createdBy: teacher.id,
  }).returning();

  // Assignment 1: All 11 question types
  const allQ = [q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11].filter(Boolean);
  const totalPts = allQ.reduce((s, q) => s + q!.points, 0);

  const [asgn1] = await db.insert(assignmentsTable).values({
    title: "Kiểm tra Tổng hợp — 11 Dạng Câu Hỏi",
    description: "Bài kiểm tra trình diễn đủ 11 dạng câu hỏi: MCQ, Đúng/Sai, Điền chỗ trống, Chọn từ, Nối cặp, Kéo thả, Sắp xếp câu, Đọc hiểu, Nghe hiểu, Video, Bài luận",
    courseId: course1.id, teacherId: teacher.id,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    timeLimitMinutes: 90, status: "published", totalPoints: totalPts,
  }).returning();

  await db.insert(assignmentQuestionsTable).values(
    allQ.map((q, i) => ({ assignmentId: asgn1.id, questionId: q!.id, orderIndex: i }))
  );

  // Assignment 2: Reading + MCQ
  const [asgn2] = await db.insert(assignmentsTable).values({
    title: "IELTS Reading Practice — Academic",
    description: "Bài luyện thi đọc hiểu IELTS dạng Academic",
    courseId: course2.id, teacherId: teacher.id,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    timeLimitMinutes: 40, status: "published",
    totalPoints: (q1?.points ?? 0) + (q8?.points ?? 0),
  }).returning();

  await db.insert(assignmentQuestionsTable).values([
    { assignmentId: asgn2.id, questionId: q1!.id, orderIndex: 0 },
    { assignmentId: asgn2.id, questionId: q8!.id, orderIndex: 1 },
  ]);

  // Assignment 3: Essay only (draft)
  await db.insert(assignmentsTable).values({
    title: "IELTS Writing Task 2 — Opinion Essay",
    description: "Viết bài luận thể hiện quan điểm cá nhân về tác động của công nghệ",
    courseId: course2.id, teacherId: teacher.id,
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    timeLimitMinutes: 45, status: "draft",
    totalPoints: q11?.points ?? 10,
  });

  logger.info("Demo data seeded successfully");
}
