#!/usr/bin/env node
/**
 * L2→L1 withdraw via L2StandardBridge.withdrawTo (Bridge path).
 *
 * Usage:
 *   NETWORK=testnet PRIVATE_KEY=0x... AMOUNT_ETH=0.000001 node scripts/withdraw-via-bridge.mjs
 * Optional: TO MIN_GAS EXTRA L2_RPC DRY_RUN=1
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  http,
  parseAbi,
  parseEther,
  parseGwei,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getWithdrawals } from "viem/op-stack";
import { requireEnv, resolveNetwork } from "./networks.mjs";

const L2_ETH = "0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000";
const L2_BRIDGE = "0x4200000000000000000000000000000000000010";
const L2_MESSENGER = "0x4200000000000000000000000000000000000007";
const L2_MESSAGE_PASSER = "0x4200000000000000000000000000000000000016";

const net = resolveNetwork();
const PRIVATE_KEY = requireEnv("PRIVATE_KEY");
const AMOUNT_ETH = process.env.AMOUNT_ETH || "0.000001";
const MIN_GAS = Number(process.env.MIN_GAS || "200000");
const EXTRA = /** @type {`0x${string}`} */ (process.env.EXTRA || "0x");
const DRY_RUN = process.env.DRY_RUN === "1";
const amount = parseEther(AMOUNT_ETH);

const account = privateKeyToAccount(
  /** @type {`0x${string}`} */ (
    PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`
  ),
);
const TO = /** @type {`0x${string}`} */ (process.env.TO || account.address);

const bridgeAbi = parseAbi([
  "function withdrawTo(address _l2Token, address _to, uint256 _amount, uint32 _minGasLimit, bytes _extraData) payable",
]);

const l2Chain = defineChain({
  id: net.l2.id,
  name: net.l2.name,
  nativeCurrency: { name: "GT", symbol: "GT", decimals: 18 },
  rpcUrls: { default: { http: [net.l2Rpc] } },
});

const publicClient = createPublicClient({
  chain: l2Chain,
  transport: http(net.l2Rpc),
});
const walletClient = createWalletClient({
  account,
  chain: l2Chain,
  transport: http(net.l2Rpc),
});

const data = encodeFunctionData({
  abi: bridgeAbi,
  functionName: "withdrawTo",
  args: [L2_ETH, TO, amount, MIN_GAS, EXTRA],
});

console.log({
  network: net.name,
  path: "L2StandardBridge.withdrawTo",
  from: account.address,
  to: TO,
  amountEth: AMOUNT_ETH,
  bridge: L2_BRIDGE,
});

if (DRY_RUN) {
  console.log("DRY_RUN=1 → skipped");
  process.exit(0);
}

const hash = await walletClient.sendTransaction({
  to: L2_BRIDGE,
  data,
  value: amount,
  gas: 300_000n,
  gasPrice: parseGwei(process.env.GAS_PRICE_GWEI || "0.121"),
});
console.log("L2 tx:", hash);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("status:", receipt.status, "block:", receipt.blockNumber.toString());
console.log(`explorer: ${net.l2.explorer}/tx/${hash}`);

const withdrawals = getWithdrawals(receipt);
if (!withdrawals.length) {
  console.error("No MessagePassed in receipt");
  process.exit(2);
}
const w = withdrawals[0];
console.log("MessagePassed:", {
  sender: w.sender,
  target: w.target,
  value: w.value.toString(),
  gasLimit: w.gasLimit.toString(),
  withdrawalHash: w.withdrawalHash,
});
console.log("touched:", {
  bridge: receipt.logs.some((l) => l.address.toLowerCase() === L2_BRIDGE.toLowerCase()),
  messenger: receipt.logs.some(
    (l) => l.address.toLowerCase() === L2_MESSENGER.toLowerCase(),
  ),
  messagePasser: receipt.logs.some(
    (l) => l.address.toLowerCase() === L2_MESSAGE_PASSER.toLowerCase(),
  ),
});
console.log(
  `Next: wait ~1h for Ready to prove, then NETWORK=${net.name} L2_TX=${hash} node scripts/prove-withdrawal.mjs`,
);
if (receipt.status !== "success") process.exit(1);
