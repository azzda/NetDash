import { z } from "zod";

export const frontendEnvSchema = z.object({
  VITE_NETDASH_WS_URL: z.string().url().default("ws://localhost:4001"),
});

export const backendEnvSchema = z.object({
  NETDASH_HTTP_PORT: z.coerce.number().int().positive().default(4000),
  NETDASH_WS_PORT: z.coerce.number().int().positive().default(4001),
  NETDASH_ALLOWED_ORIGIN: z.string().default("http://localhost:5173"),
});

export type FrontendEnv = z.infer<typeof frontendEnvSchema>;
export type BackendEnv = z.infer<typeof backendEnvSchema>;
