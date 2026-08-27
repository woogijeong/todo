import { z } from "zod";

/**
 * Zod schemas for the 4 MongoDB collections defined in
 * docs/.omc/plans/todo-app-plan.md section 2.
 *
 * `_id` and other ObjectId-typed references are represented as plain
 * strings at this validation boundary because they arrive as strings
 * from the client (forms / Server Action args); the Mongo access layer
 * is responsible for converting to/from `ObjectId`.
 */

const dateOnlyString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const objectIdString = z.string().min(1);

const title = z.string().trim().min(1).max(200);
const description = z.string().max(2000);

export const taskStatus = z.enum(["todo", "doing", "done"]);
export type TaskStatus = z.infer<typeof taskStatus>;

// ---------------------------------------------------------------------------
// users / sessions (GitHub OAuth — see docs/GITHUB_OAUTH_SETUP.md)
// ---------------------------------------------------------------------------

export const userSchema = z.object({
  _id: objectIdString,
  // GitHub's stable numeric account id — the join key we upsert on, so a user
  // renaming their GitHub login doesn't create a second account here.
  githubId: z.number().int(),
  login: z.string().min(1),
  avatarUrl: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.literal(1),
});
export type User = z.infer<typeof userSchema>;

export const sessionSchema = z.object({
  _id: objectIdString,
  // Opaque random token; the only value that ever lands in the cookie.
  token: z.string().min(1),
  userId: objectIdString,
  createdAt: z.date(),
  expiresAt: z.date(),
});
export type Session = z.infer<typeof sessionSchema>;

// Every domain document below is owned by exactly one user. `userId` is the
// string form of a `users._id` and is always injected server-side from the
// session — never accepted from client input, so it is omitted from every
// *InputSchema.
const userId = objectIdString;

// ---------------------------------------------------------------------------
// yearlyGoals
// ---------------------------------------------------------------------------

export const yearlyGoalSchema = z.object({
  _id: objectIdString,
  userId,
  title,
  description: description.optional(),
  year: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.literal(1),
});
export type YearlyGoal = z.infer<typeof yearlyGoalSchema>;

export const yearlyGoalInputSchema = yearlyGoalSchema.omit({
  _id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  schemaVersion: true,
});
export type YearlyGoalInput = z.infer<typeof yearlyGoalInputSchema>;

// ---------------------------------------------------------------------------
// monthlyPlans
// ---------------------------------------------------------------------------

const monthOnlyString = z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM");

export const monthlyPlanSchema = z.object({
  _id: objectIdString,
  userId,
  yearlyGoalId: objectIdString.nullable(),
  title,
  month: monthOnlyString,
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.literal(1),
});
export type MonthlyPlan = z.infer<typeof monthlyPlanSchema>;

export const monthlyPlanInputSchema = monthlyPlanSchema.omit({
  _id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  schemaVersion: true,
});
export type MonthlyPlanInput = z.infer<typeof monthlyPlanInputSchema>;

// ---------------------------------------------------------------------------
// weeklyPlans
// ---------------------------------------------------------------------------

export const weeklyPlanSchema = z.object({
  _id: objectIdString,
  userId,
  monthlyPlanId: objectIdString.nullable(),
  title,
  weekStart: dateOnlyString,
  weekEnd: dateOnlyString,
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.literal(1),
});
export type WeeklyPlan = z.infer<typeof weeklyPlanSchema>;

export const weeklyPlanInputSchema = weeklyPlanSchema.omit({
  _id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  schemaVersion: true,
});
export type WeeklyPlanInput = z.infer<typeof weeklyPlanInputSchema>;

// ---------------------------------------------------------------------------
// tasks
// ---------------------------------------------------------------------------

export const taskSchema = z.object({
  _id: objectIdString,
  userId,
  weeklyPlanId: objectIdString.nullable(),
  title,
  description: description.optional(),
  status: taskStatus,
  dueDate: dateOnlyString.optional(),
  completedAt: z.date().nullable().optional(),
  notifiedAt: dateOnlyString.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.literal(1),
});
export type Task = z.infer<typeof taskSchema>;

export const taskInputSchema = taskSchema.omit({
  _id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  schemaVersion: true,
});
export type TaskInput = z.infer<typeof taskInputSchema>;

// ---------------------------------------------------------------------------
// taskEvents (append-only, no update/delete input schema needed)
// ---------------------------------------------------------------------------

export const taskEventSchema = z.object({
  _id: objectIdString,
  userId,
  taskId: objectIdString,
  weeklyPlanId: objectIdString.nullable(),
  monthlyPlanId: objectIdString.nullable(),
  fromStatus: z.string().nullable(),
  toStatus: taskStatus,
  occurredAt: z.date(),
});
export type TaskEvent = z.infer<typeof taskEventSchema>;

export const taskEventInputSchema = taskEventSchema.omit({
  _id: true,
});
export type TaskEventInput = z.infer<typeof taskEventInputSchema>;
