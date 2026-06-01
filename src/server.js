import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import { assertSignerMatchesContract, provider, signer } from "./contract.js";
import { rollStore } from "./db/rollStore.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { rollsRouter } from "./routes/rolls.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", config.TRUST_PROXY);
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: config.FRONTEND_ORIGIN === "*" ? true : config.FRONTEND_ORIGIN
}));
app.use(express.json({ limit: "32kb" }));
app.use(morgan(config.NODE_ENV === "production" ? "combined" : "dev", {
  skip: (req) => config.NODE_ENV === "production" && req.path === "/health"
}));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    signer: signer.address,
    rollStore: rollStore.name
  });
});

app.get("/ready", async (req, res, next) => {
  try {
    const network = await provider.getNetwork();
    const configuredChainId = config.CHAIN_ID.toString();
    const actualChainId = network.chainId.toString();

    res.json({
      ok: actualChainId === configuredChainId,
      chainId: actualChainId,
      configuredChainId,
      signer: signer.address,
      rollStore: rollStore.name
    });
  } catch (error) {
    next(error);
  }
});

app.use(apiLimiter);
app.use(rollsRouter);
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.use(errorHandler);

async function main() {
  await rollStore.init();
  await assertSignerMatchesContract();

  if (config.NODE_ENV === "production" && rollStore.name === "json") {
    console.warn("ROLL_STORE=json is not recommended for production traffic. Use ROLL_STORE=postgres.");
  }

  const server = app.listen(config.PORT, () => {
    console.log(`Financial Calligraphy backend listening on http://localhost:${config.PORT}`);
  });

  server.requestTimeout = config.REQUEST_TIMEOUT_MS;
  server.headersTimeout = config.REQUEST_TIMEOUT_MS + 5_000;

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await rollStore.close();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
