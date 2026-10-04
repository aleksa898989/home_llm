import { z } from "zod";
import { HttpError } from "./errors.ts";

export const parse = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? "Invalid input");
  return result.data;
};

export const username = z
  .string()
  .trim()
  .regex(/^[\p{L}\p{N}_.-]{2,32}$/u, "Username: 2–32 letters, numbers, . _ or -");

export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password is too long");

const role = z.enum(["system", "user", "assistant"]);

const message = z.object({
  role,
  content: z.string().max(200_000),
  model: z.string().max(200).optional(),
  thinking: z.string().max(500_000).optional(),
  error: z.string().max(2_000).optional(),
});

const modelName = z
  .string()
  .trim()
  .min(1, "Model name required")
  .max(200)
  .regex(/^[\w.\-/:]+$/, "Invalid model name");

export const schemas = {
  register: z.object({ username, password }),
  login: z.object({ username: z.string().trim().max(64), password: z.string().max(200) }),
  changePassword: z.object({ current: z.string().max(200), next: password }),
  chatRequest: z.object({
    model: modelName,
    messages: z.array(message).min(1).max(1_000),
    think: z.boolean().optional(),
  }),
  saveChat: z.object({
    title: z.string().trim().max(100).default("New chat"),
    model: modelName.nullable().optional(),
    messages: z.array(message).max(1_000),
  }),
  chatId: z.string().regex(/^[\w-]{1,64}$/, "Invalid chat id"),
  userId: z.coerce.number().int().positive(),
  modelConfig: z.object({
    enabled: z.array(modelName).max(200),
    default: modelName.nullable(),
  }),
  modelName: z.object({ name: modelName }),
  patchUser: z.object({ approved: z.boolean().optional(), isAdmin: z.boolean().optional() }),
};
