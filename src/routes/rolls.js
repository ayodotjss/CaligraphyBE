import { Router } from "express";
import { ethers } from "ethers";
import { z } from "zod";
import { MintState, getWalletMintStatus, signDiceRoll } from "../contract.js";
import { rollDice, createNonce } from "../dice/xoshiro256starstar.js";
import { HttpError } from "../middleware/errorHandler.js";
import { rollLimiter } from "../middleware/rateLimiters.js";
import { rollStore } from "../db/rollStore.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const rollRequestSchema = z.object({
  wallet: z.string().refine((value) => ethers.isAddress(value), "wallet must be a valid EVM address")
});

const statusUpdateSchema = z.object({
  status: z.enum(["submitted", "minted", "failed"]),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional()
});

router.post("/roll", rollLimiter, asyncHandler(async (req, res) => {
  const { wallet } = rollRequestSchema.parse(req.body);
  const checksummedWallet = ethers.getAddress(wallet);
  const status = await getWalletMintStatus(checksummedWallet);

  if (status.state === MintState.None) {
    throw new HttpError(409, "Wallet has not committed on-chain yet");
  }

  if (status.state === MintState.Minted) {
    throw new HttpError(409, "Wallet has already minted");
  }

  if (status.attemptCount > 2n) {
    throw new HttpError(409, "Wallet has exceeded max attempts");
  }

  const attemptNumber = status.attemptCount.toString();
  let created = false;
  const roll = await rollStore.getOrCreateActiveByWalletAttempt(checksummedWallet, attemptNumber, async () => {
    created = true;
    const diceResult = rollDice();
    const nonce = createNonce();
    const { hash, signature } = await signDiceRoll(checksummedWallet, diceResult, nonce);

    return {
      wallet: checksummedWallet,
      diceResult,
      nonce,
      signature,
      messageHash: hash,
      attemptNumber,
      status: "generated",
      createdAt: new Date().toISOString(),
      txHash: null
    };
  });

  return res.status(created ? 201 : 200).json(publicRoll(roll));
}));

router.patch("/rolls/:nonce", asyncHandler(async (req, res) => {
  const { status, txHash } = statusUpdateSchema.parse(req.body);
  const roll = await rollStore.updateByNonce(req.params.nonce, { status, txHash: txHash ?? null });

  if (!roll) {
    throw new HttpError(404, "Roll not found");
  }

  return res.json(publicRoll(roll));
}));

function publicRoll(roll) {
  return {
    wallet: roll.wallet,
    diceResult: roll.diceResult,
    nonce: roll.nonce,
    signature: roll.signature,
    attemptNumber: roll.attemptNumber,
    status: roll.status,
    txHash: roll.txHash
  };
}

export { router as rollsRouter };
