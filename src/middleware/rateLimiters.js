import { rateLimit } from "express-rate-limit";
import { config } from "../config.js";

const commonOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again shortly" }
};

export const apiLimiter = rateLimit({
  ...commonOptions,
  windowMs: config.API_RATE_LIMIT_WINDOW_MS,
  limit: config.API_RATE_LIMIT_MAX
});

export const rollLimiter = rateLimit({
  ...commonOptions,
  windowMs: config.ROLL_RATE_LIMIT_WINDOW_MS,
  limit: config.ROLL_RATE_LIMIT_MAX,
  message: { error: "Too many roll requests, please wait before trying again" }
});
