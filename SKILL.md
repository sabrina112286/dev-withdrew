---
name: bridging-l2-to-l1-on-gatelayer
description: Runs GateLayer L2→L1 native withdrawal regression (L2StandardBridge.withdrawTo or MessagePasser.initiateWithdrawal, wait dispute game, proveWithdrawal, wait challenge, finalizeWithdrawal). Use when proving/finalizing withdrawals, debugging Ready to prove / Waiting a game to resolve, checking finalizedWithdrawals, or phrases like "L2 to L1 withdraw", "prove withdrawal on GateLayer", "finalize withdrawal", "challenge period", "MessagePasser initiateWithdrawal", "withdrawTo bridge", or "GateLayer bridge withdraw".
---

# Bridging L2→L1 on GateLayer

OP Stack native withdrawal. Manual path does **not** auto-prove or auto-finalize.

Addresses: [references/contracts.md](references/contracts.md). L1→L2 deposit: skill `bridging-l1-to-l2-on-gatelayer`.

## Security

- Never commit private keys. Pass `PRIVATE_KEY` via env only.
- Prefer testnet for regression. Mainnet needs L1 gas and often an archive L2 RPC.
- Do not call finalize on L2 `0x4200…0016`. Finalize is L1 OptimismPortal only.

## Input validation

- **tx-hash**: `^0x[a-fA-F0-9]{64}$`
- **rpc-url**: `^https://[^\s;|&]+$`
- **address**: `^0x[a-fA-F0-9]{40}$`
- **network**: `testnet` or `mainnet`

## End-to-end flow

```text
1) L2 initiate (Bridge withdrawTo OR MessagePasser initiateWithdrawal)
2) Wait covering dispute game          (~1h testnet)
3) L1 proveWithdrawal                  (manual)
4) Wait game resolve + proof maturity  (~7d wall clock)
5) L1 finalizeWithdrawal               (manual)
```

### 1) Initiate on L2 — two supported paths

Explorer “Interacted with” differs by entrypoint; both emit `MessagePassed` and use the same prove/finalize flow.

| Path | Contract | Method | Script |
|------|----------|--------|--------|
| A Bridge | `0x4200…0010` L2StandardBridge | `withdrawTo` | `scripts/withdraw-via-bridge.mjs` |
| B Direct | `0x4200…0016` L2ToL1MessagePasser | `initiateWithdrawal` | `scripts/withdraw-via-message-passer.mjs` |

**Path A — Bridge (recommended for app-style withdraw):**

```bash
NETWORK=testnet PRIVATE_KEY=0x... AMOUNT_ETH=0.000001 \
  node scripts/withdraw-via-bridge.mjs
```

```bash
cast send 0x4200000000000000000000000000000000000010 \
  "withdrawTo(address,address,uint256,uint32,bytes)" \
  0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000 \
  <L1_RECIPIENT> <WEI_AMOUNT> 200000 0x \
  --value <WEI_AMOUNT> \
  --rpc-url https://gatelayer-testnet.gatenode.cc \
  --private-key "$PRIVATE_KEY"
```

**Path B — MessagePasser (low-level):**

```bash
NETWORK=testnet PRIVATE_KEY=0x... AMOUNT_ETH=0.000001 \
  node scripts/withdraw-via-message-passer.mjs
```

```bash
cast send 0x4200000000000000000000000000000000000016 \
  "initiateWithdrawal(address,uint256,bytes)" \
  <L1_RECIPIENT> 21000 0x \
  --value <WEI_AMOUNT> \
  --rpc-url https://gatelayer-testnet.gatenode.cc \
  --private-key "$PRIVATE_KEY"
```

Use a sane L2 gasLimit (`21000`–`200000`), not `1e14`.

### 2) Wait for state root / Ready to prove

```bash
NETWORK=testnet L2_TX=0x... node scripts/check-withdrawal-status.mjs
```

### 3) Prove on L1 (manual)

If public RPC returns `maximum proof window`, set `L2_ARCHIVE_RPC`.

```bash
NETWORK=testnet PRIVATE_KEY=0x... L2_TX=0x... \
  node scripts/prove-withdrawal.mjs
```

Portal reads (authoritative):

```bash
PORTAL=0x0D69cDd07Cf93075FE53769945575274fC563BA9
L1=https://meteora-evm.gatenode.cc
cast call $PORTAL "numProofSubmitters(bytes32)(uint256)" <WITHDRAWAL_HASH> --rpc-url $L1
cast call $PORTAL "provenWithdrawals(bytes32,address)(address,uint64)" <WITHDRAWAL_HASH> <PROVER> --rpc-url $L1
cast call $PORTAL "finalizedWithdrawals(bytes32)(bool)" <WITHDRAWAL_HASH> --rpc-url $L1
```

Explorer pages can lag — trust Portal.

### 4) Wait challenge / maturity

- `proofMaturityDelaySeconds = 604800` (~7d from prove)
- Game clock / resolve may also apply

### 5) Finalize on L1 (manual)

```bash
NETWORK=testnet PRIVATE_KEY=0x... L2_TX=0x... \
  node scripts/finalize-withdrawal.mjs
```

Wrong: finalize on L2 MessagePasser.

## Agent regression checklist

1. Confirm network (default testnet).
2. Initiate via path A and/or B, or accept existing `L2_TX`.
3. `check-withdrawal-status.mjs` until Ready to prove.
4. Prove; report L1 tx + Portal reads.
5. Wait maturity; then finalize; confirm `finalizedWithdrawals == true`.

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Stuck Ready to prove | Prove not submitted | Run prove script |
| `maximum proof window` | No historical eth_getProof | `L2_ARCHIVE_RPC` |
| Explorer lag after prove | Index delay | Withdrawals API + Portal |
| Finalize early | Maturity / game | Wait |
| Multicall3 missing | viem getGames | Scripts use `findLatestGames` |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/withdraw-via-bridge.mjs` | Initiate via L2StandardBridge |
| `scripts/withdraw-via-message-passer.mjs` | Initiate via MessagePasser |
| `scripts/check-withdrawal-status.mjs` | Status + optional Portal |
| `scripts/prove-withdrawal.mjs` | L1 prove |
| `scripts/finalize-withdrawal.mjs` | L1 finalize |
