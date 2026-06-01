import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ override: true });

const envBoolean = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  if (["true", "1", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no", "off"].includes(value.toLowerCase())) return false;
  return value;
}, z.boolean());

const trustProxy = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  if (/^\d+$/.test(value)) return Number(value);
  if (["true", "yes", "on"].includes(value.toLowerCase())) return 1;
  if (["false", "no", "off"].includes(value.toLowerCase())) return false;
  return value;
}, z.union([z.number().int().nonnegative(), z.literal(false)]));

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TRUST_PROXY: trustProxy.default(1),
  RPC_URL: z.string().url(),
  CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "CONTRACT_ADDRESS must be an EVM address"),
  CHAIN_ID: z.coerce.bigint().positive(),
  SIGNER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "SIGNER_PRIVATE_KEY must be a 32-byte hex private key"),
  FRONTEND_ORIGIN: z.string().url("FRONTEND_ORIGIN must be your frontend URL, for example http://localhost:3000"),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  ROLL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  ROLL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  ROLL_STORE: z.enum(["json", "postgres"]).default("json"),
  DATABASE_URL: z.string().url().optional(),
  POSTGRES_MAX_CONNECTIONS: z.coerce.number().int().positive().default(5),
  POSTGRES_SSL: envBoolean.default(true),
  POSTGRES_PREPARE: envBoolean.default(false),
  DATA_FILE: z.string().default("./data/rolls.json")
}).superRefine((env, ctx) => {
  if (env.ROLL_STORE === "postgres" && !env.DATABASE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DATABASE_URL"],
      message: "DATABASE_URL is required when ROLL_STORE=postgres"
    });
  }
});

export const config = envSchema.parse(process.env);
