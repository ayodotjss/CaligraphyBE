import crypto from "node:crypto";

const MASK_64 = (1n << 64n) - 1n;

function rotl(x, k) {
  return ((x << BigInt(k)) | (x >> (64n - BigInt(k)))) & MASK_64;
}

function readUint64LE(buffer, offset) {
  return buffer.readBigUInt64LE(offset) & MASK_64;
}

export class Xoshiro256StarStar {
  constructor(seed = crypto.randomBytes(32)) {
    if (!Buffer.isBuffer(seed) || seed.length !== 32) {
      throw new Error("xoshiro256** seed must be a 32-byte Buffer");
    }

    this.s = [
      readUint64LE(seed, 0),
      readUint64LE(seed, 8),
      readUint64LE(seed, 16),
      readUint64LE(seed, 24)
    ];

    if (this.s.every((value) => value === 0n)) {
      this.s[0] = 1n;
    }
  }

  nextUint64() {
    const result = rotl((this.s[1] * 5n) & MASK_64, 7) * 9n & MASK_64;
    const t = (this.s[1] << 17n) & MASK_64;

    this.s[2] ^= this.s[0];
    this.s[3] ^= this.s[1];
    this.s[1] ^= this.s[2];
    this.s[0] ^= this.s[3];
    this.s[2] ^= t;
    this.s[3] = rotl(this.s[3], 45);

    return result;
  }
}

export function rollDice() {
  const rng = new Xoshiro256StarStar();
  const limit = (1n << 64n) - ((1n << 64n) % 6n);

  let value = rng.nextUint64();
  while (value >= limit) {
    value = rng.nextUint64();
  }

  return Number(value % 6n) + 1;
}

export function createNonce() {
  return BigInt(`0x${crypto.randomBytes(32).toString("hex")}`).toString();
}
