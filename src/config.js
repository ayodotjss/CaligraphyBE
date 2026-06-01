import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  RPC_URL: z.string().url(),
  CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "CONTRACT_ADDRESS must be an EVM address"),
  CHAIN_ID: z.coerce.bigint().positive(),
  SIGNER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "SIGNER_PRIVATE_KEY must be a 32-byte hex private key"),
  FRONTEND_ORIGIN: z.string().default("*"),
  ROLL_STORE: z.enum(["json", "postgres"]).default("json"),
  DATABASE_URL: z.string().url().optional(),
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
