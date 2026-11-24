/** Shared GateLayer L2→L1 network presets. */

export const NETWORKS = {
  testnet: {
    name: "testnet",
    l2: {
      id: 10087,
      name: "GateLayer Testnet",
      rpc: "https://gatelayer-testnet.gatenode.cc",
      explorer: "https://www.gatescan.org/gatelayer-testnet",
      withdrawalsApi:
        "https://gl-exp-api-t.gatescan.org/gatelayer-testnet/api/v2/optimism/withdrawals",
      gamesApi:
        "https://gl-exp-api-t.gatescan.org/gatelayer-testnet/api/v2/optimism/games",
      txApiBase:
        "https://gl-exp-api-t.gatescan.org/gatelayer-testnet/api/v2/transactions",
    },
    l1: {
      id: 85,
      name: "Gate Chain Testnet (Meteora)",
      rpc: "https://meteora-evm.gatenode.cc",
      explorer: "https://www.gatescan.org/gatechain-testnet",
      portal: "0x0D69cDd07Cf93075FE53769945575274fC563BA9",
      disputeGameFactory: "0x6f419Bb5d754033e39f758d20133d7fEA8e2Bb55",
    },
    gameType: 1,
  },
  mainnet: {
    name: "mainnet",
    l2: {
      id: 10088,
      name: "GateLayer",
      rpc: "https://gatelayer-mainnet.gatenode.cc",
      explorer: "https://www.gatescan.org/gatelayer",
      withdrawalsApi:
        "https://gl-exp-api-m.gatescan.org/gatelayer/api/v2/optimism/withdrawals",
      gamesApi:
        "https://gl-exp-api-m.gatescan.org/gatelayer/api/v2/optimism/games",
      txApiBase:
        "https://gl-exp-api-m.gatescan.org/gatelayer/api/v2/transactions",
    },
    l1: {
      id: 86,
      name: "Gate Chain",
      rpc: "https://evm.nodeinfo.cc",
      explorer: "https://www.gatescan.org/gatechain",
      portal: "0x48a4C3F12E489452E5b45facC04Df901D7Adc8cF",
      disputeGameFactory: "0x089A3b9d9CaA629d1b3Ce382f3B212B9Ebb78730",
    },
    gameType: 1,
  },
};

export const MESSAGE_PASSER = "0x4200000000000000000000000000000000000016";

export function resolveNetwork() {
  const key = (process.env.NETWORK || "testnet").toLowerCase();
  const net = NETWORKS[key];
  if (!net) {
    throw new Error(`Unknown NETWORK=${key}. Use testnet or mainnet.`);
  }
  return {
    ...net,
    l1Rpc: process.env.L1_RPC || net.l1.rpc,
    l2Rpc: process.env.L2_RPC || net.l2.rpc,
    l2ArchiveRpc: process.env.L2_ARCHIVE_RPC || process.env.L2_RPC || net.l2.rpc,
    portal: process.env.PORTAL || net.l1.portal,
    dgf: process.env.DGF || net.l1.disputeGameFactory,
    gameType: Number(process.env.GAME_TYPE || net.gameType),
  };
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function assertTxHash(hash) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error(`Invalid L2_TX: ${hash}`);
  }
}
