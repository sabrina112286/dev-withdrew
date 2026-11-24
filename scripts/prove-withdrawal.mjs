#!/usr/bin/env node
/**
 * Prove GateLayer L2→L1 withdrawal on L1 OptimismPortal.
 *
 * Usage:
 *   npm i viem
 *   NETWORK=testnet PRIVATE_KEY=0x... L2_TX=0x... node scripts/prove-withdrawal.mjs
 *
 * Optional: L1_RPC L2_RPC L2_ARCHIVE_RPC PORTAL DGF GAME_TYPE
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
  buildProveWithdrawal,
  getWithdrawals,
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
} from "viem/op-stack";
import {
  MESSAGE_PASSER,
  assertTxHash,
  requireEnv,
  resolveNetwork,
} from "./networks.mjs";

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
  rpcUrls: { default: { http: [net.l2ArchiveRpc] } },
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

const factoryAbi = parseAbi([
  "function gameCount() view returns (uint256)",
  "function gameAtIndex(uint256) view returns (uint32 gameType, uint64 timestamp, address proxy)",
  "function findLatestGames(uint32 gameType, uint256 start, uint256 n) view returns ((uint256 index, bytes32 metadata, uint64 timestamp, bytes32 rootClaim, bytes extraData)[])",
]);
const gameAbi = parseAbi([
  "function rootClaim() view returns (bytes32)",
  "function l2BlockNumber() view returns (uint256)",
]);

const publicClientL1 = createPublicClient({
  chain: l1Chain,
  transport: http(net.l1Rpc),
}).extend(publicActionsL1());

const publicClientL2 = createPublicClient({
  chain: l2Chain,
  transport: http(net.l2ArchiveRpc),
}).extend(publicActionsL2());

const walletClientL1 = createWalletClient({
  account,
  chain: l1Chain,
  transport: http(net.l1Rpc),
}).extend(walletActionsL1());

async function findCoveringOutput(l2BlockNumber) {
  // Avoid viem getGames multicall — Gate Chain may lack multicall3.
  const gameCount = await publicClientL1.readContract({
    address: /** @type {`0x${string}`} */ (net.dgf),
    abi: factoryAbi,
    functionName: "gameCount",
  });
  if (gameCount === 0n) throw new Error("No dispute games found");

  const games = await publicClientL1.readContract({
    address: /** @type {`0x${string}`} */ (net.dgf),
    abi: factoryAbi,
    functionName: "findLatestGames",
    args: [net.gameType, gameCount - 1n, 30n],
  });

  for (const g of games) {
    const [, timestamp, proxy] = await publicClientL1.readContract({
      address: /** @type {`0x${string}`} */ (net.dgf),
      abi: factoryAbi,
      functionName: "gameAtIndex",
      args: [g.index],
    });
    const l2 =
      g.extraData && g.extraData !== "0x"
        ? BigInt(g.extraData)
        : await publicClientL1.readContract({
            address: proxy,
            abi: gameAbi,
            functionName: "l2BlockNumber",
          });
    if (l2 < l2BlockNumber) continue;

    const rootClaim =
      g.rootClaim &&
      g.rootClaim !==
        "0x0000000000000000000000000000000000000000000000000000000000000000"
        ? g.rootClaim
        : await publicClientL1.readContract({
            address: proxy,
            abi: gameAbi,
            functionName: "rootClaim",
          });

    return {
      index: g.index,
      proxy,
      l2BlockNumber: l2,
      outputIndex: g.index,
      outputRoot: rootClaim,
      timestamp: BigInt(timestamp),
    };
  }

  throw new Error(
    `No dispute game covering L2 block ${l2BlockNumber}. Still Waiting for state root.`,
  );
}

const receipt = await publicClientL2.getTransactionReceipt({
  hash: /** @type {`0x${string}`} */ (L2_TX),
});
if (receipt.status !== "success") {
  throw new Error(`L2 tx not successful: ${receipt.status}`);
}

const withdrawals = getWithdrawals(receipt);
if (!withdrawals.length) {
  throw new Error("No MessagePassed withdrawal in L2 receipt");
}
const [withdrawal] = withdrawals;

console.log("Network:", net.name);
console.log("Account:", account.address);
console.log("L2 block:", receipt.blockNumber.toString());
console.log("Withdrawal:", {
  sender: withdrawal.sender,
  target: withdrawal.target,
  value: withdrawal.value.toString(),
  gasLimit: withdrawal.gasLimit.toString(),
  withdrawalHash: withdrawal.withdrawalHash,
});

const output = await findCoveringOutput(receipt.blockNumber);
console.log("Covering game:", {
  index: output.index.toString(),
  proxy: output.proxy,
  l2BlockNumber: output.l2BlockNumber.toString(),
  outputRoot: output.outputRoot,
});

try {
  await publicClientL2.getProof({
    address: /** @type {`0x${string}`} */ (MESSAGE_PASSER),
    storageKeys: [
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    ],
    blockNumber: output.l2BlockNumber,
  });
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/proof window|maximum proof/i.test(msg)) {
    console.error(`
BLOCKER: L2 RPC cannot serve historical eth_getProof for block ${output.l2BlockNumber}.
Set L2_ARCHIVE_RPC to an archive endpoint and rerun.
`);
    process.exit(2);
  }
  throw e;
}

const args = await buildProveWithdrawal(publicClientL2, {
  account,
  output,
  withdrawal,
});

console.log("Submitting proveWithdrawal on L1...");
const hash = await walletClientL1.proveWithdrawal({
  ...args,
  chain: l1Chain,
});
console.log("L1 prove tx:", hash);

const l1Receipt = await publicClientL1.waitForTransactionReceipt({ hash });
console.log("L1 status:", l1Receipt.status);
console.log(
  l1Receipt.status === "success"
    ? "Prove succeeded. Wait challenge/maturity (~7d), then finalize."
    : "Prove failed on L1.",
);
console.log(`Explorer: ${net.l1.explorer}/en/tx/${hash}`);
console.log(`L2 tx: ${net.l2.explorer}/tx/${L2_TX}`);
