import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import { assertSignerMatchesContract, provider, signer } from "./contract.js";
import { rollStore } from "./db/rollStore.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { rollsRouter } from "./routes/rolls.js";

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.FRONTEND_ORIGIN === "*" ? true : config.FRONTEND_ORIGIN
}));
app.use(express.json({ limit: "32kb" }));
app.use(morgan(config.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", async (req, res, next) => {
  try {
    const network = await provider.getNetwork();
    res.json({
      ok: true,
      chainId: network.chainId.toString(),
      signer: signer.address,
      rollStore: rollStore.name
    });
  } catch (error) {
    next(error);
  }
});

app.use(rollsRouter);
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.use(errorHandler);

async function main() {
  await rollStore.init();
  await assertSignerMatchesContract();

  app.listen(config.PORT, () => {
    console.log(`Financial Calligraphy backend listening on http://localhost:${config.PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
