import { ethers } from "ethers";
import { config } from "./config.js";

export const MintState = Object.freeze({
  None: 0n,
  Committed: 1n,
  Minted: 2n
});

const abi = [
  "function mintState(address wallet) view returns (uint8)",
  "function attemptCount(address wallet) view returns (uint256)",
  "function trustedSigner() view returns (address)",
  "function diceMessageHash(address wallet, uint256 diceResult, uint256 nonce) view returns (bytes32)"
];

export const provider = new ethers.JsonRpcProvider(config.RPC_URL, Number(config.CHAIN_ID));
export const signer = new ethers.Wallet(config.SIGNER_PRIVATE_KEY, provider);
export const contract = new ethers.Contract(config.CONTRACT_ADDRESS, abi, provider);

export async function getWalletMintStatus(wallet) {
  const [state, attempts] = await Promise.all([
    contract.mintState(wallet),
    contract.attemptCount(wallet)
  ]);

  return {
    state: BigInt(state),
    attemptCount: BigInt(attempts)
  };
}

export async function assertSignerMatchesContract() {
  const trustedSigner = await contract.trustedSigner();

  if (trustedSigner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Backend signer ${signer.address} does not match contract trustedSigner ${trustedSigner}`);
  }
}

export async function signDiceRoll(wallet, diceResult, nonce) {
  const hash = await contract.diceMessageHash(wallet, diceResult, nonce);
  const signature = await signer.signMessage(ethers.getBytes(hash));

  return { hash, signature };
}
