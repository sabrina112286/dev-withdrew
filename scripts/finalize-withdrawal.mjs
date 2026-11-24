#!/usr/bin/env node
/**
 * Finalize GateLayer L2→L1 withdrawal after prove + maturity delay.
 *
 * Usage:
 *   NETWORK=testnet PRIVATE_KEY=0x... L2_TX=0x... node scripts/finalize-withdrawal.mjs
 *
 * Optional: L1_RPC L2_RPC PORTAL DGF
 */

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  getWithdrawals,
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
} from "viem/op-stack";
import { assertTxHash, requireEnv, resolveNetwork } from "./networks.mjs";

const net = resolveNetwork();
const PRIVATE_KEY = requireEnv("PRIVATE_KEY");
const L2_TX = requireEnv("L2_TX");
assertTxHash(L2_TX);

const account = privateKeyToAccount(
  /** @type {`0x${string}`} */ (
    PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`
  ),
);

const l1Chain = defineChain({
  id: net.l1.id,
  name: net.l1.name,
  nativeCurrency: { name: "GT", symbol: "GT", decimals: 18 },
  rpcUrls: { default: { http: [net.l1Rpc] } },
});

const l2Chain = defineChain({
  id: net.l2.id,
  name: net.l2.name,
  nativeCurrency: { name: "GT", symbol: "GT", decimals: 18 },
  rpcUrls: { default: { http: [net.l2Rpc] } },
  sourceId: net.l1.id,
  contracts: {
    portal: {
      [net.l1.id]: { address: /** @type {`0x${string}`} */ (net.portal) },
    },
    disputeGameFactory: {
      [net.l1.id]: { address: /** @type {`0x${string}`} */ (net.dgf) },
    },
  },
});

const portalAbi = parseAbi([
  "function finalizedWithdrawals(bytes32) view returns (bool)",
  "function proofMaturityDelaySeconds() view returns (uint256)",
  "function numProofSubmitters(bytes32) view returns (uint256)",
  "function proofSubmitters(bytes32,uint256) view returns (address)",
  "function provenWithdrawals(bytes32,address) view returns (address,uint64)",
]);

const publicClientL1 = createPublicClient({
  chain: l1Chain,
  transport: http(net.l1Rpc),
}).extend(publicActionsL1());

const publicClientL2 = createPublicClient({
  chain: l2Chain,
  transport: http(net.l2Rpc),
}).extend(publicActionsL2());

const walletClientL1 = createWalletClient({
  account,
  chain: l1Chain,
  transport: http(net.l1Rpc),
}).extend(walletActionsL1());

const receipt = await publicClientL2.getTransactionReceipt({
  hash: /** @type {`0x${string}`} */ (L2_TX),
});
const withdrawals = getWithdrawals(receipt);
if (!withdrawals.length) throw new Error("No withdrawal in L2 receipt");
const [withdrawal] = withdrawals;

const portal = /** @type {`0x${string}`} */ (net.portal);
const already = await publicClientL1.readContract({
  address: portal,
  abi: portalAbi,
  functionName: "finalizedWithdrawals",
  args: [withdrawal.withdrawalHash],
});
if (already) {
  console.log("Already finalized:", withdrawal.withdrawalHash);
  process.exit(0);
}

const n = await publicClientL1.readContract({
  address: portal,
  abi: portalAbi,
  functionName: "numProofSubmitters",
  args: [withdrawal.withdrawalHash],
});
if (n === 0n) {
  throw new Error("Not proven yet — run prove-withdrawal.mjs first");
}

const prover = await publicClientL1.readContract({
  address: portal,
  abi: portalAbi,
  functionName: "proofSubmitters",
  args: [withdrawal.withdrawalHash, 0n],
});
const [, provenAt] = await publicClientL1.readContract({
  address: portal,
  abi: portalAbi,
  functionName: "provenWithdrawals",
  args: [withdrawal.withdrawalHash, prover],
});
const delay = await publicClientL1.readContract({
  address: portal,
  abi: portalAbi,
  functionName: "proofMaturityDelaySeconds",
});
const now = BigInt(Math.floor(Date.now() / 1000));
const readyAt = provenAt + delay;
if (now < readyAt) {
  throw new Error(
    `Maturity not reached. Ready after ${new Date(Number(readyAt) * 1000).toISOString()} (now ${new Date(Number(now) * 1000).toISOString()})`,
  );
}

console.log("Network:", net.name);
console.log("Account:", account.address);
console.log("Withdrawal hash:", withdrawal.withdrawalHash);
console.log("Prover:", prover);
console.log("Finalizing...");

const hash = await walletClientL1.finalizeWithdrawal({
  withdrawal,
  chain: l1Chain,
});
console.log("L1 finalize tx:", hash);

const l1Receipt = await publicClientL1.waitForTransactionReceipt({ hash });
console.log("L1 status:", l1Receipt.status);
console.log(`Explorer: ${net.l1.explorer}/en/tx/${hash}`);
