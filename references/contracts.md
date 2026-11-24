# GateLayer L2→L1 Contract & Endpoint Reference

## Testnet (regression default)

| Item | Value |
|------|-------|
| L2 name | GateLayer Testnet |
| L2 chain ID | `10087` |
| L2 RPC | `https://gatelayer-testnet.gatenode.cc` |
| L2 explorer | https://www.gatescan.org/gatelayer-testnet |
| L2 withdrawals API | `https://gl-exp-api-t.gatescan.org/gatelayer-testnet/api/v2/optimism/withdrawals` |
| L2 games API | `https://gl-exp-api-t.gatescan.org/gatelayer-testnet/api/v2/optimism/games` |
| L1 name | Gate Chain Testnet (Meteora) |
| L1 chain ID | `85` |
| L1 RPC | `https://meteora-evm.gatenode.cc` |
| L1 explorer | https://www.gatescan.org/gatechain-testnet |
| OptimismPortal | `0x0D69cDd07Cf93075FE53769945575274fC563BA9` |
| DisputeGameFactory | `0x6f419Bb5d754033e39f758d20133d7fEA8e2Bb55` |
| L1StandardBridge | `0x75DEd3BE4d69e8403c9079aE5cf5E059a23F6a67` |
| L1CrossDomainMessenger | `0x60cAd8D7D622bE3D62786b2e7a6617765D0F4d94` |
| L2StandardBridge | `0x4200000000000000000000000000000000000010` |
| L2ToL1MessagePasser | `0x4200000000000000000000000000000000000016` |
| L2 native token sentinel (withdrawTo) | `0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000` |
| Respected game type | `1` |
| proofMaturityDelaySeconds | `604800` (7 days) |
| disputeGameFinalityDelaySeconds | `302400` (~3.5 days) |
| maxClockDuration (typical game) | `302400` (~3.5 days) |
| Dispute game cadence | ~1 hour |

## Mainnet

| Item | Value |
|------|-------|
| L2 name | GateLayer |
| L2 chain ID | `10088` |
| L2 RPC | `https://gatelayer-mainnet.gatenode.cc` |
| L2 explorer | https://www.gatescan.org/gatelayer |
| L2 withdrawals API | `https://gl-exp-api-m.gatescan.org/gatelayer/api/v2/optimism/withdrawals` |
| L2 games API | `https://gl-exp-api-m.gatescan.org/gatelayer/api/v2/optimism/games` |
| L1 name | Gate Chain |
| L1 chain ID | `86` |
| L1 RPC | `https://evm.nodeinfo.cc` |
| L1 explorer | https://www.gatescan.org/gatechain |
| OptimismPortal | `0x48a4C3F12E489452E5b45facC04Df901D7Adc8cF` |
| DisputeGameFactory | `0x089A3b9d9CaA629d1b3Ce382f3B212B9Ebb78730` |
| L1StandardBridge | `0x1b30f00BbFeA2D2dAAAbBAf28059477CeA9E0E36` |
| L1CrossDomainMessenger | `0x030B1Fa1112A52dCC3b131d393d40234d36EC741` |
| L2StandardBridge | `0x4200000000000000000000000000000000000010` |
| L2ToL1MessagePasser | `0x4200000000000000000000000000000000000016` |
| proofMaturityDelaySeconds | `604800` (7 days) |

## Explorer status meanings

| Status | Meaning | Action |
|--------|---------|--------|
| Waiting for state root | No covering dispute game yet | Wait (~1h testnet) |
| Ready to prove | Game exists; not proven | Run prove script |
| Waiting a game to resolve | Proven; game still in progress | Wait (~3.5d clock + resolve) |
| In challenge period | Proven; waiting maturity | Wait until finalize window |
| Ready for relay | Can finalize on L1 | Run finalize script |
| Relayed | Finalized on L1 | Done |

Notes:

- Transaction detail page `op_withdrawals` can lag. Prefer withdrawals list API + L1 Portal reads.
- `Ready to prove` does **not** auto-advance; prove is a manual L1 tx (or bridge UI/relayer).
- Anyone may prove; finalize should use the same proof submitter account (or ExternalProof path).
