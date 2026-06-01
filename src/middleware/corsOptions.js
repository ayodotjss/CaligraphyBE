import { config } from "../config.js";

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || origin === config.FRONTEND_ORIGIN) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204
};
