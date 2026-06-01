import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { config } from "../config.js";

const ACTIVE_STATUSES = new Set(["generated", "submitted"]);

class JsonRollStore {
  constructor(filePath = config.DATA_FILE) {
    this.filePath = path.resolve(filePath);
    this.queue = Promise.resolve();
    this.name = "json";
  }

  async init() {
    return undefined;
  }

  async readAll() {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.rolls) ? parsed.rolls : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async writeAll(rolls) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify({ rolls }, null, 2)}\n`, "utf8");
  }

  findActiveInRolls(rolls, wallet, attemptNumber) {
    const normalizedWallet = wallet.toLowerCase();

    return rolls.find((roll) => (
      roll.wallet.toLowerCase() === normalizedWallet
      && String(roll.attemptNumber) === String(attemptNumber)
      && ACTIVE_STATUSES.has(roll.status)
    ));
  }

  async findActiveByWalletAttempt(wallet, attemptNumber) {
    const rolls = await this.readAll();
    return this.findActiveInRolls(rolls, wallet, attemptNumber);
  }

  async getOrCreateActiveByWalletAttempt(wallet, attemptNumber, createRoll) {
    return this.enqueue(async () => {
      const rolls = await this.readAll();
      const existingRoll = this.findActiveInRolls(rolls, wallet, attemptNumber);
      if (existingRoll) return existingRoll;

      const roll = await createRoll();
      rolls.push(roll);
      await this.writeAll(rolls);
      return roll;
    });
  }

  async updateByNonce(nonce, patch) {
    return this.enqueue(async () => {
      const rolls = await this.readAll();
      const index = rolls.findIndex((roll) => String(roll.nonce) === String(nonce));
      if (index === -1) return null;

      rolls[index] = {
        ...rolls[index],
        ...patch,
        updatedAt: new Date().toISOString()
      };

      await this.writeAll(rolls);
      return rolls[index];
    });
  }

  async enqueue(task) {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => {});
    return run;
  }
}

class PostgresRollStore {
  constructor(databaseUrl = config.DATABASE_URL) {
    this.sql = postgres(databaseUrl, {
      max: 5,
      ssl: "require",
      transform: postgres.camel
    });
    this.name = "postgres";
  }

  async init() {
    await this.sql`
      create table if not exists rolls (
        id bigserial primary key,
        wallet text not null,
        dice_result integer not null check (dice_result between 1 and 6),
        nonce text not null unique,
        signature text not null,
        message_hash text not null,
        attempt_number text not null,
        status text not null check (status in ('generated', 'submitted', 'minted', 'failed')),
        created_at timestamptz not null default now(),
        updated_at timestamptz,
        tx_hash text
      )
    `;

    await this.sql`
      create unique index if not exists rolls_active_wallet_attempt_idx
      on rolls (lower(wallet), attempt_number)
      where status in ('generated', 'submitted')
    `;
  }

  async getOrCreateActiveByWalletAttempt(wallet, attemptNumber, createRoll) {
    const existingRoll = await this.findActiveByWalletAttempt(wallet, attemptNumber);
    if (existingRoll) return existingRoll;

    const roll = await createRoll();

    try {
      const [insertedRoll] = await this.sql`
        insert into rolls (
          wallet,
          dice_result,
          nonce,
          signature,
          message_hash,
          attempt_number,
          status,
          created_at,
          tx_hash
        ) values (
          ${roll.wallet},
          ${roll.diceResult},
          ${roll.nonce},
          ${roll.signature},
          ${roll.messageHash},
          ${roll.attemptNumber},
          ${roll.status},
          ${roll.createdAt},
          ${roll.txHash}
        )
        returning *
      `;

      return normalizePostgresRoll(insertedRoll);
    } catch (error) {
      if (error.code !== "23505") throw error;

      const currentRoll = await this.findActiveByWalletAttempt(wallet, attemptNumber);
      if (currentRoll) return currentRoll;
      throw error;
    }
  }

  async findActiveByWalletAttempt(wallet, attemptNumber) {
    const [roll] = await this.sql`
      select *
      from rolls
      where lower(wallet) = lower(${wallet})
        and attempt_number = ${String(attemptNumber)}
        and status in ('generated', 'submitted')
      order by created_at desc
      limit 1
    `;

    return roll ? normalizePostgresRoll(roll) : undefined;
  }

  async updateByNonce(nonce, patch) {
    const [roll] = await this.sql`
      update rolls
      set
        status = ${patch.status},
        tx_hash = ${patch.txHash ?? null},
        updated_at = now()
      where nonce = ${String(nonce)}
      returning *
    `;

    return roll ? normalizePostgresRoll(roll) : null;
  }
}

function normalizePostgresRoll(roll) {
  return {
    wallet: roll.wallet,
    diceResult: roll.diceResult,
    nonce: roll.nonce,
    signature: roll.signature,
    messageHash: roll.messageHash,
    attemptNumber: roll.attemptNumber,
    status: roll.status,
    createdAt: roll.createdAt instanceof Date ? roll.createdAt.toISOString() : roll.createdAt,
    updatedAt: roll.updatedAt instanceof Date ? roll.updatedAt.toISOString() : roll.updatedAt,
    txHash: roll.txHash
  };
}

export const rollStore = config.ROLL_STORE === "postgres"
  ? new PostgresRollStore()
  : new JsonRollStore();
