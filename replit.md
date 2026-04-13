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

- **Web Frontend**: React 18, Vite, Tailwind CSS v4, shadcn/ui, wouter (routing), Clerk auth, recharts, react-hook-form, date-fns
- **Mobile App**: Expo SDK 54, Expo Router, React Native, React Query
- **Backend**: Express.js, Drizzle ORM, PostgreSQL, Clerk SDK
- **AI**: OpenAI GPT-4o-mini via Replit AI Integrations proxy
- **Fonts**: Be Vietnam Pro + Inter (web), Inter (mobile)

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
- `GET/POST /api/quiz-templates`, `GET/PATCH/DELETE /api/quiz-templates/:id`
- `POST /api/quiz-templates/:id/import-questions` — import questions from bank as copies
- `POST /api/quiz-templates/:id/questions` — add single question
- `PATCH /api/quiz-templates/:id/questions/:qid`, `DELETE /api/quiz-templates/:id/questions/:qid`
- `GET /api/dashboard/summary`, `activity`, `upcoming`, `skill-progress`, `weekly-stats`
- `POST /api/ai/grade-essay` — AI essay grading (OpenAI)
- `POST /api/ai/suggest-questions` — AI question suggestions
- `POST /api/ai/personalized-feedback/:submissionId` — AI personalized feedback
- `POST /api/fraud/report`, `GET /api/fraud/events` — Fraud detection
- `GET /api/gamification/badges`, `leaderboard`, `streak` — Gamification
- `GET /api/enterprise/department-report`, `competency-matrix` — Enterprise
- `POST /api/lms/sync`, `GET /api/lms/status` — LMS integration stubs

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
`users`, `courses`, `course_members`, `questions`, `assignments`, `assignment_questions`, `submissions`, `submission_answers`

- `assignments` includes: `startTime`, `endTime`, `maxAttempts` (default 1), `allowReview` (default false)
- `assignment_questions` stores embedded copies of question data (type, content, options, correctAnswer, points, etc.) — no FK to `questions`
- `submissions` includes `isFinal` boolean (latest student submission is marked true)

### Quiz Template Tables
`quiz_templates` (id, title, description, teacherId, createdAt, updatedAt), `quiz_template_questions` (id, templateId, type, skill, level, content, options, correctAnswer, audioUrl, videoUrl, imageUrl, passage, explanation, metadata, points, orderIndex, createdAt)

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

Streak and badges are updated on each submission.

### Submission System
- **maxAttempts**: Students limited to N submissions per assignment; API rejects excess attempts
- **isFinal**: Latest student submission marked `isFinal=true`; prior submissions marked `false`
- **startTime/endTime**: Submissions rejected outside the assignment time window
- **isPreview**: Teacher test run — API grades and returns result without saving to DB
- **allowReview**: When false, students cannot view submission details after grading

## Question Types (11 total)
`mcq`, `true_false`, `fill_blank`, `word_selection`, `matching`, `drag_drop`, `sentence_reorder`, `reading`, `listening`, `video_interactive`, `essay`

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

- `DATABASE_URL` — PostgreSQL connection string
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk frontend key
- `CLERK_SECRET_KEY` — Clerk backend key
- `VITE_CLERK_PROXY_URL` — Clerk proxy URL for Replit
- `PORT` — Port for each artifact (set by Replit)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Auto-provisioned by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Auto-provisioned by Replit AI Integrations

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
