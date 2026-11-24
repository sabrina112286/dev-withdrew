# GateLayer mainnet withdraw prove helpers

Minimal scripts to **prove** GateLayer L2→L1 withdrawals (OP Stack).

## Server setup (`gl-rpc-explorer` / `10.0.4.7`)

```bash
git clone https://github.com/sabrina112286/dev-withdrew.git
cd dev-withdrew
npm i

cp .env.example .env
# edit .env: set PRIVATE_KEY
# L2_RPC / L2_ARCHIVE_RPC default to http://127.0.0.1:8545 on this host

set -a && source .env && set +a

# single tx
NETWORK=mainnet L2_TX=0x... node scripts/prove-withdrawal.mjs

# batch (7 Ready-to-prove txs tracked 2026-11-24)
./prove-batch-mainnet.sh

unset PRIVATE_KEY
```

## Requirement

L2 RPC must support **historical** `eth_getProof` at the dispute-game block (not only `latest`).  
If you see `maximum proof window`, the node is not usable for prove yet — ask ops to enable archive / widen proof window (testnet public RPC already can; mainnet `10.0.4.7:8545` previously could not).

## Scripts

| File | Purpose |
|------|---------|
| `scripts/prove-withdrawal.mjs` | L1 `proveWithdrawal` |
| `scripts/check-withdrawal-status.mjs` | Explorer + optional Portal status |
| `scripts/finalize-withdrawal.mjs` | L1 finalize after maturity |
| `scripts/withdraw-via-bridge.mjs` | L2 initiate via StandardBridge |
| `scripts/withdraw-via-message-passer.mjs` | L2 initiate via MessagePasser |
| `prove-batch-mainnet.sh` | Batch prove listed mainnet txs |

Addresses: `references/contracts.md`
