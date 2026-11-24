#!/usr/bin/env node
/**
 * Check GateLayer L2→L1 withdrawal status (explorer + optional L1 Portal).
 *
 * Usage:
 *   NETWORK=testnet L2_TX=0x... node scripts/check-withdrawal-status.mjs
 *   NETWORK=testnet L2_TX=0x... WITHDRAWAL_HASH=0x... PROVER=0x... node ...
 */

import { createPublicClient, defineChain, http, parseAbi } from "viem";
import { assertTxHash, resolveNetwork } from "./networks.mjs";

const net = resolveNetwork();
const L2_TX = process.env.L2_TX;
if (!L2_TX) throw new Error("Missing env: L2_TX");
assertTxHash(L2_TX);

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const tx = await fetchJson(`${net.l2.txApiBase}/${L2_TX}`);
const list = await fetchJson(net.l2.withdrawalsApi);
const item = (list.items || []).find(
  (i) => i.l2_transaction_hash?.toLowerCase() === L2_TX.toLowerCase(),
);
const games = await fetchJson(net.l2.gamesApi);
const latestGame = (games.items || [])[0];

const receiptBlock = BigInt(tx.block || tx.block_number || 0);
// block may be missing on some payloads; fall back via RPC
let l2Block = receiptBlock;
if (!l2Block) {
  const l2 = createPublicClient({
    chain: defineChain({
      id: net.l2.id,
      name: net.l2.name,
      nativeCurrency: { name: "GT", symbol: "GT", decimals: 18 },
      rpcUrls: { default: { http: [net.l2Rpc] } },
    }),
    transport: http(net.l2Rpc),
  });
  const r = await l2.getTransactionReceipt({ hash: /** @type {`0x${string}`} */ (L2_TX) });
  l2Block = r.blockNumber;
}

console.log(
  JSON.stringify(
    {
      network: net.name,
      l2Tx: L2_TX,
      l2Block: l2Block.toString(),
      explorerTxStatus: tx?.op_withdrawals?.[0] || null,
      withdrawalsListStatus: item
        ? {
            status: item.status,
            msgNonce: item.msg_nonce,
            l1TransactionHash: item.l1_transaction_hash,
            challengePeriodEnd: item.challenge_period_end,
            l2Timestamp: item.l2_timestamp,
          }
        : null,
      latestGame: latestGame
        ? {
            index: latestGame.index,
            l2BlockNumber: latestGame.l2_block_number,
            createdAt: latestGame.created_at,
            status: latestGame.status,
            coversWithdrawal: latestGame.l2_block_number >= Number(l2Block),
          }
        : null,
      links: {
        l2Tx: `${net.l2.explorer}/tx/${L2_TX}`,
      },
    },
    null,
    2,
  ),
);

const WH = process.env.WITHDRAWAL_HASH;
const PROVER = process.env.PROVER;
if (WH && PROVER) {
  const portalAbi = parseAbi([
    "function numProofSubmitters(bytes32) view returns (uint256)",
    "function provenWithdrawals(bytes32,address) view returns (address,uint64)",
    "function finalizedWithdrawals(bytes32) view returns (bool)",
    "function proofMaturityDelaySeconds() view returns (uint256)",
  ]);
  const l1 = createPublicClient({
    chain: defineChain({
      id: net.l1.id,
      name: net.l1.name,
      nativeCurrency: { name: "GT", symbol: "GT", decimals: 18 },
      rpcUrls: { default: { http: [net.l1Rpc] } },
    }),
    transport: http(net.l1Rpc),
  });
  const portal = /** @type {`0x${string}`} */ (net.portal);
  const [n, proven, finalized, delay] = await Promise.all([
    l1.readContract({
      address: portal,
      abi: portalAbi,
      functionName: "numProofSubmitters",
      args: [/** @type {`0x${string}`} */ (WH)],
    }),
    l1.readContract({
      address: portal,
      abi: portalAbi,
      functionName: "provenWithdrawals",
      args: [
        /** @type {`0x${string}`} */ (WH),
        /** @type {`0x${string}`} */ (PROVER),
      ],
    }),
    l1.readContract({
      address: portal,
      abi: portalAbi,
      functionName: "finalizedWithdrawals",
      args: [/** @type {`0x${string}`} */ (WH)],
    }),
    l1.readContract({
      address: portal,
      abi: portalAbi,
      functionName: "proofMaturityDelaySeconds",
    }),
  ]);
  const [game, provenAt] = proven;
  console.log(
    JSON.stringify(
      {
        portal,
        withdrawalHash: WH,
        prover: PROVER,
        numProofSubmitters: n.toString(),
        provenGame: game,
        provenAt: provenAt.toString(),
        provenAtIso:
          provenAt > 0n
            ? new Date(Number(provenAt) * 1000).toISOString()
            : null,
        finalizeAfterIso:
          provenAt > 0n
            ? new Date(Number(provenAt + delay) * 1000).toISOString()
            : null,
        finalized,
      },
      null,
      2,
    ),
  );
}
