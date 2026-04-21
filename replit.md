# EduPlatform — Nền tảng Giáo dục

## Overview

A comprehensive multi-role Vietnamese educational platform (LMS) serving teachers, students, language centers, K-12 schools, system admins, and enterprises.

## Architecture

pnpm monorepo with TypeScript project references.

### Artifacts

| Artifact | Path | Description |
|---|---|---|
| `artifacts/api-server` | `/api/*` | Express.js REST API server |
| `artifacts/edu-platform` | `/` (root) | React + Vite frontend (web) |
| `artifacts/mobile-app` | `/mobile/` | Expo React Native mobile app |

### Libraries

| Package | Purpose |
|---|---|
| `lib/db` | Drizzle ORM schema + PostgreSQL migrations |
| `lib/api-spec` | OpenAPI spec (`openapi.yaml`) |
| `lib/api-client-react` | Generated React Query hooks (via orval codegen) |
| `lib/api-zod` | Generated Zod validation schemas (via orval codegen) |

## Tech Stack

- **Web Frontend**: React 18, Vite, Tailwind CSS v4, shadcn/ui, TanStack Router (file-based routing), Better Auth (client), recharts, react-hook-form, date-fns
- **Mobile App**: Expo SDK 54, Expo Router, React Native, React Query
- **Backend**: Express.js 5, Drizzle ORM, PostgreSQL, Better Auth (server, email+Google OAuth)
- **AI**: OpenAI GPT-4o-mini via Replit AI Integrations proxy (lazy-loaded)
- **Fonts**: Be Vietnam Pro + Inter (web), Inter (mobile)

## Auth Architecture

Better Auth replaces Clerk everywhere:
- **Frontend**: `src/lib/auth-client.ts` exports `authClient` (createAuthClient from `better-auth/react`)
- **Routes**: File-based routing in `app/routes/` — public (sign-in, sign-up, forgot-password, reset-password); protected routes in `_auth/` subfolder (grouped by feature: courses/, assignments/, submissions/, questions/, quiz-templates/) under `_auth.tsx` layout
- **API Server**: `artifacts/api-server/src/lib/auth.ts` — betterAuth with Drizzle adapter; mounted at `/api/auth` in app.ts
- **Session**: Cookie-based; `requireAuth` middleware reads session from Better Auth and resolves `req.dbUser`
- **BA Tables**: `ba_user`, `ba_session`, `ba_account`, `ba_verification` (prefixed to avoid collision with app `users` table)
- **User linking**: `users.better_auth_user_id` → `ba_user.id`

## Design System

- Primary Blue: `#378ADD` — `hsl(210 71% 54%)`
- Success Green: `#1D9E75` — `hsl(161 69% 37%)`
- Warning Amber: `#BA7517` — `hsl(34 78% 41%)`

## User Roles

`teacher`, `student`, `center_admin`, `school_admin`, `system_admin`, `enterprise_admin`

## Web Frontend Pages

| Route | Page |
|---|---|
| `/` | Landing (public) or redirects to `/dashboard` if signed in |
| `/sign-in` | Clerk sign-in |
| `/sign-up` | Clerk sign-up |
| `/onboarding` | Role selection after first sign-up |
| `/dashboard` | Role-adaptive dashboard with charts and activity feed |
| `/courses` | Course list + creation modal |
| `/courses/:id` | Course detail (members + assignments + schedule + documents + import tabs) |
| `/courses/:id/curriculum` | Curriculum Builder — teacher creates chapters, lessons, lesson blocks (heading/text/youtube/upload/quiz/assignment) |
| `/courses/:id/learn` | Course Player — student sidebar tree, progress bar, mark complete, prev/next nav, auto-certificate on 100% |
| `/catalog` | Public course catalog (no auth) — search, category filter, course cards |
| `/catalog/:slug` | Course landing page — description, chapters preview, self-enroll button |
| `/certificates` | My certificates list (auto-issued on 100% completion) |
| `/certificates/:certNo` | Printable certificate detail page (public) |
| `/questions` | Question bank with skill/level/type filters |
| `/assignments` | Assignment list with status filter + create dialog (maxAttempts, allowReview) |
| `/assignments/:id` | Assignment editor (add questions, import from template, publish/close, teacher preview) |
| `/assignments/:id/take` | Full-screen exam UI (timer, progress bar, question navigator, 11 question types); supports `?preview=1` for teacher test run |
| `/quiz-templates` | Quiz template library list + create/delete |
| `/quiz-templates/:id` | Quiz template detail — import questions from bank, rich per-type edit dialog, delete, reorder |
| `/submissions` | Submission list |
| `/submissions/:id` | Submission result detail (per-question feedback, inline annotations, rubric grading, AI grading) |
| `/reports` | Statistics & reporting (overview, course comparison, student progress, radar/bar/line charts, CSV/JSON export) |
| `/rubrics` | Rubric management (CRUD rubric sets with criteria for writing/speaking/reading/listening) |
| `/system` | System admin (user management, system settings, audit log) — system_admin only |
| `/profile` | Student profile with skill radar + score history charts |
| `/gamification` | Badges grid, leaderboard, learning streak |
| `/enterprise` | HR dashboard, department stats, competency matrix |
| `/lms` | LMS integration (Moodle/Google Classroom stubs) |
| `/fraud` | Fraud detection events list (teacher/admin only) |

## Mobile App Screens

| Screen | Description |
|---|---|
| `/(tabs)/index` | Home: dashboard summary, streak banner, upcoming assignments, activity |
| `/(tabs)/assignments` | Assignment list with search and status filter |
| `/(tabs)/gamification` | Badges, leaderboard, streak tracking |
| `/(tabs)/profile` | User profile and logout |
| `/login` | Demo login (student@edu.vn / teacher@edu.vn, password: demo123) |
| `/assignment/[id]` | Assignment taking UI with MCQ and essay support |
| `/submission/[id]` | Submission result with AI grading details |

## Backend API Routes

### Core
- `GET/PATCH /api/users/me`
- `GET /api/users`
- `GET/POST /api/courses`, `GET/PATCH/DELETE /api/courses/:id`
- `GET /api/courses/:id/members`, `POST /api/courses/:id/members`
- `GET/POST /api/questions`, `GET/PATCH/DELETE /api/questions/:id`
- `GET/POST /api/assignments`, `GET/PATCH/DELETE /api/assignments/:id`
- `POST /api/assignments/:id/questions`
- `PATCH /api/assignments/:id/questions/:qid` — update assignment question content
- `DELETE /api/assignments/:id/questions/:qid`
- `POST /api/assignments/:id/import-from-template` — import all questions from a quiz template
- `GET/POST /api/submissions`, `GET /api/submissions/:id`
- `PATCH /api/submissions/:id/grade`
- `PATCH /api/submissions/:id/answers/:questionId` — per-question grading (score for essay, comment for all)
- `POST /api/assignments/:id/publish-grades` — batch publish pending_review → published
- `GET /api/questions/import-template` — download Excel template for question import
- `POST /api/questions/import` — bulk import questions from Excel file (multipart/form-data)
- `GET/POST /api/quiz-templates`, `GET/PATCH/DELETE /api/quiz-templates/:id`
- `POST /api/quiz-templates/:id/import-questions` — import questions from bank as copies
- `POST /api/quiz-templates/:id/questions` — add single question
- `PATCH /api/quiz-templates/:id/questions/:qid`, `DELETE /api/quiz-templates/:id/questions/:qid`
- `GET /api/dashboard/summary`, `activity`, `upcoming`, `skill-progress`, `weekly-stats`
- `POST /api/ai/grade-essay` — AI essay grading (OpenAI)
- `POST /api/ai/suggest-questions` — AI question suggestions
- `POST /api/ai/personalized-feedback/:submissionId` — AI personalized feedback
- `GET /api/assignments/:id/session` — check for existing quiz session
- `POST /api/assignments/:id/session` — create new quiz session
- `PATCH /api/assignments/:id/session` — auto-save session state (answers, flags, current question, timer)
- `POST /api/assignments/:id/session/beacon` — beforeunload beacon save (handles text/plain)
- `POST /api/assignments/:id/session/submit` — mark session as submitted
- `DELETE /api/assignments/:id/session` — delete session (restart)
- `POST /api/assignments/:id/session/heartbeat` — heartbeat + server-side expiry check
- `POST /api/fraud/report`, `GET /api/fraud/events` — Fraud detection
- `GET /api/gamification/badges`, `leaderboard`, `streak` — Gamification
- `GET /api/enterprise/department-report`, `competency-matrix` — Enterprise
- `POST /api/lms/sync`, `GET /api/lms/status` — LMS integration stubs

### Curriculum (Frappe Learning-style)
- `GET /api/courses/:id/curriculum` — full chapter+lesson tree with per-lesson completion status and progress %
- `GET/POST /api/courses/:id/chapters`, `PATCH/DELETE /api/chapters/:chapterId`
- `POST /api/courses/:id/chapters/reorder`
- `GET/POST /api/chapters/:chapterId/lessons`, `GET/PATCH/DELETE /api/lessons/:lessonId`
- `POST /api/chapters/:chapterId/lessons/reorder`
- `GET/POST /api/lessons/:lessonId/blocks`, `PATCH/DELETE /api/lesson-blocks/:blockId`
- `POST /api/lessons/:lessonId/blocks/reorder`
- `POST /api/lessons/:lessonId/complete` — mark lesson done; auto-issues certificate on 100% and returns `{ certificateIssued, certificateNo, progressPercent }`
- `GET /api/catalog/courses` — public list (search, category, level filters)
- `GET /api/catalog/courses/:slug` — public course detail with chapter outline + enroll status
- `POST /api/courses/:id/enroll` — self-enroll (auth required)
- `GET /api/certificates` — my certificates list
- `GET /api/certificates/:certificateNo` — public certificate lookup

### Phase 2
- `GET/POST /api/courses/:id/schedule`, `DELETE /api/courses/:id/schedule/:eventId`
- `GET/POST /api/courses/:id/documents`, `DELETE /api/courses/:id/documents/:docId`
- `POST /api/courses/:id/import` — CSV import of course members
- `GET /api/reports/overview`, `GET /api/reports/course/:courseId`, `GET /api/reports/student/:studentId`
- `GET/POST /api/submissions/:id/annotations`, `DELETE /api/submissions/:id/annotations/:annotationId`
- `GET/POST /api/submissions/:id/rubric-grades`
- `GET/POST /api/rubrics`, `GET /api/rubrics/:id`, `DELETE /api/rubrics/:id`
- `GET /api/system/users`, `PATCH /api/system/users/:id`
- `GET/POST /api/system/settings`
- `GET /api/system/audit-log`

## Database Schema (Drizzle + PostgreSQL)

### Core Tables
`users`, `courses`, `course_members`, `questions`, `assignments`, `assignment_questions`, `submissions`, `submission_answers`, `quiz_sessions`

- `assignments` includes: `startTime`, `endTime`, `maxAttempts` (default 1), `allowReview` (default false)
- `assignment_questions` stores embedded copies of question data (type, content, options, correctAnswer, points, etc.) — no FK to `questions`
- `submissions` includes `isFinal` boolean (latest student submission is marked true)

### Quiz Template Tables
`quiz_templates` (id, title, description, teacherId, createdAt, updatedAt), `quiz_template_questions` (id, templateId, type, skill, level, content, options, correctAnswer, audioUrl, videoUrl, imageUrl, passage, explanation, metadata, points, orderIndex, createdAt)

### Quiz Session Tables
`quiz_sessions` (id, sessionId, userId, assignmentId, answers JSONB, flagged JSONB, currentQuestion, timeLeftSeconds, startedAt, lastSavedAt, status)
- Temporary table for persisting quiz-taking state (auto-save every 2s debounce + 30s interval)
- Status: `in_progress` → `submitted` (on submit) / `expired` (server-side timeout)
- Server validates expiry via `startedAt + assignment.timeLimitMinutes`
- Frontend features: debounced auto-save, localStorage fallback (offline), beforeunload beacon, resume/restart dialog, flag questions for review, save status indicator

### Phase 2 Tables
`schedule_events`, `course_documents`, `rubrics`, `rubric_criteria`, `answer_annotations`, `rubric_grades`, `audit_logs`, `system_settings`

### Phase 3 Tables
`badges`, `user_badges`, `learning_streaks`, `fraud_events`, `conversations`, `messages`

Auto-grading is applied on submission for all question types except `essay` (manual-only). Grading logic per type:
- `mcq`, `true_false`, `fill_blank` — direct string comparison (true_false normalizes "true"/"false" ↔ "Đúng"/"Sai")
- `fill_blank` with multiple blanks — partial scoring (correct blanks / total blanks × points)
- `word_selection` — set comparison of selected words vs correct words
- `matching` — partial scoring (correct pairs / total pairs × points)
- `drag_drop` — partial scoring (correct placements / total expected × points)
- `sentence_reorder` — exact array order comparison (all-or-nothing)
- `listening` — partial scoring per sub-question (correct / total × points); fallback to simple compare if no sub-questions
- `video_interactive` — partial scoring per checkpoint question, keyed by original index in options array (handles notes correctly)
- `reading` — simple text compare if `correctAnswer` exists, otherwise manual (no correctAnswer → pending)
- `essay` — always manual (teacher or AI grading)
- `open_end` — always manual (pending_review); supports text + audio recording with STT

### Open End Question (open_end)
- **Payload format**: `{input_type: "text"|"audio"|"combined", text_content?, audio_url?, transcript?, duration_seconds?, stt_confidence?}`
- **Allowed input types**: `text`, `audio` (image mode removed)
- **Audio flow**: MediaRecorder → upload to object storage → real-time Web Speech API preview during recording → server-side Whisper (gpt-4o-mini-transcribe via `/api/ai/transcribe`) for accurate final transcript → editable transcript
- **Audio state machine**: `idle` → `recording` (canvas waveform + timer + live transcript) → `processing` (upload) → `transcribed` (with AI transcribing indicator if Whisper still pending)
- **STT dual approach**: Real-time Web Speech API (vi-VN) runs during recording for instant preview; after recording, audio blob is sent to server `/api/ai/transcribe` endpoint which uses OpenAI Whisper (auto-detects language, supports Vietnamese + English + multilingual)
- **Paste detection**: Counter tracked, toast warning at >2 pastes, visual banner shown
- **Min text length**: 10 characters with color-coded counter (gray/amber/green)
- **Backward compatibility**: Display layer reads both new snake_case fields and old camelCase format

Streak and badges are updated on each submission.

### Submission System
- **maxAttempts**: Students limited to N submissions per assignment; API rejects excess attempts
- **isFinal**: Latest student submission marked `isFinal=true`; prior submissions marked `false`
- **startTime/endTime**: Submissions rejected outside the assignment time window
- **isPreview**: Teacher test run — API grades and returns result without saving to DB
- **allowReview**: When false, students cannot view submission details after grading

### Two-Tier Grading System
- **Type 1 (Auto-grade)**: All non-essay questions graded automatically on submit → status `graded`
- **Type 2 (Manual)**: Assignments with essay/open_end (non-autoGrade) → status `pending_review` on submit → teacher grades per-question → teacher publishes → status `published`
- **Status flow**: `pending_review` → (teacher grades) → `published` (student sees results); `graded` (auto-graded, immediate)
- **Per-question grading**: `PATCH /submissions/:id/answers/:questionId` — essay/open_end: score + comment; others: comment only
- **Batch publish**: `POST /assignments/:id/publish-grades` — moves all `pending_review` → `published`
- **Student view for pending_review**: Sees submission exists but no scores/answers/comments/points (all suppressed server-side)
- **Student view for published**: Full results with teacher comments (bypasses `allowReview`)
- **teacherComment**: Column on `submission_answers` table, shown per-question in web + mobile
- **Analytics**: Both `graded` and `published` count in all reports/dashboards (via `or(graded, published)` filters)

## Question Types (12 total)
`mcq`, `true_false`, `fill_blank`, `word_selection`, `matching`, `drag_drop`, `sentence_reorder`, `reading`, `listening`, `video_interactive`, `essay`, `open_end`

### Question Schema Fields
- `content` — main question text (may contain `___` for fill_blank inline rendering)
- `options` — JSON array: choices (mcq/listening), "left | right" pairs (matching), items (drag_drop/sentence_reorder), tokens (word_selection)
- `correctAnswer` — string (mcq/fill_blank/true_false), JSON (matching/drag_drop/sentence_reorder/word_selection), comma-separated (word_selection)
- `audioUrl` — audio file URL (listening)
- `videoUrl` — video file URL (video_interactive)
- `imageUrl` — optional image displayed above the question
- `passage` — reading passage text displayed in a split pane (reading type)
- `explanation` — rationale shown to students after they answer (all types)

### UI Behaviors by Type
- `mcq` / `listening` — card-style A/B/C/D radio selector
- `true_false` — large two-column ĐÚNG/SAI toggle cards
- `fill_blank` — inline input inside sentence (parses `___`) or standalone input
- `word_selection` — clickable chip tokens, supports multi-select
- `matching` — two-column click-to-pair (shuffled right column, stable across renders)
- `drag_drop` — drag-and-drop + click-to-add, HTML5 drag events + visual drop zone
- `sentence_reorder` — click-to-add with ↑↓ reorder buttons
- `reading` — split pane (scrollable passage left, answer input right)
- `video_interactive` / `essay` — native HTML5 video player + rich text editor (bold/italic/underline/list) with word counter
- `listening` — audio player with speed control (0.75×–2×), replay, progress scrubber

- Course members endpoint (`GET /courses/:id/members`) accessible to enrolled students, not just teachers

## Phase 3 Features

- **AI Essay Grading**: OpenAI grades essays on grammar, vocabulary, structure, content
- **AI Question Suggestions**: AI recommends questions based on student level
- **AI Personalized Feedback**: Post-submission AI feedback for students
- **Fraud Detection**: Tab-switch/copy-paste tracking during exams, events dashboard
- **Gamification**: 8 badge types, global/course leaderboard, daily learning streaks
- **Enterprise Dashboard**: Department stats, competency matrix charts
- **LMS Integration**: Moodle/Google Classroom sync stubs (simulation mode)
- **Mobile App**: Full Expo app with home, assignments, gamification, and profile tabs

## Environment Variables

- `PG_EXTERNAL_URL` — External PostgreSQL connection string (user's own DB at 103.216.116.36:5432/replit)
- `DATABASE_URL` — (fallback) Replit managed PostgreSQL
- `PORT` — Port for each artifact (set by Replit)
- `BETTER_AUTH_URL` — Optional: full URL of api-server for Better Auth callbacks (defaults to localhost:PORT)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Auto-provisioned by Replit AI Integrations (lazy-loaded, optional)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Auto-provisioned by Replit AI Integrations (lazy-loaded, optional)

## Workflows

- **Start application**: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/edu-platform run dev` (Vite on port 3000)
- **Start api-server**: `PORT=3001 pnpm --filter @workspace/api-server run dev` (Express + Better Auth on port 3001)

## Codegen

**Note**: Orval 8.5.3 fails to parse `openapi.yaml` when it contains OpenAPI 3.1.0 `type: ["integer","null"]` arrays. The generated files in `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/` are committed to git and must be manually maintained.

After modifying `lib/api-spec/openapi.yaml`, manually update the generated files and rebuild declarations:
```bash
# Rebuild api-client-react declarations
cd lib/api-client-react && npx tsc -p tsconfig.json

# Rebuild api-zod declarations
cd lib/api-zod && npx tsc -p tsconfig.json
```

**Merge conflict artifacts**: The Phase 3 git merge left broken JSDoc fragments and interleaved function bodies in the generated files. All known corruption points have been fixed (as of April 2026). If you encounter TypeScript errors in the generated files after a merge, follow the same pattern:
- Truncated fetch function bodies: add `...options, method: "GET/POST", });};`
- Interleaved queryOptions functions: separate into two distinct functions
- Duplicate imports: deduplicate the import block

## Seed Data

On first API server start, demo data is automatically seeded (courses, questions, assignments, badges) if the database is empty.
