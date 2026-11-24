#!/usr/bin/env bash
# Prove a list of Ready-to-prove mainnet L2 withdrawals.
# Usage (on gl-rpc-explorer):
#   cp .env.example .env   # edit PRIVATE_KEY
#   set -a && source .env && set +a
#   ./prove-batch-mainnet.sh
set -euo pipefail
cd "$(dirname "$0")"

: "${PRIVATE_KEY:?set PRIVATE_KEY}"
export NETWORK="${NETWORK:-mainnet}"
export L1_RPC="${L1_RPC:-https://evm.nodeinfo.cc}"
export L2_RPC="${L2_RPC:-http://127.0.0.1:8545}"
export L2_ARCHIVE_RPC="${L2_ARCHIVE_RPC:-$L2_RPC}"

TXS=(
  0xf27a67964fff677f1f98701250295866deb080da46e872ea934253ba47a83fd9
  0x2debec1da71fdebdc9ca2516b15f6d946060769739a741dd8e7d2264915e2ead
  0xe52d1167c81fb4c9c6ca270f99e182458040fa8cd41a0e8423a6df737f553341
  0x6390ea61136ae17ff8b75a2a2ac9424af1aee86161e3b7bc0d4881eb2ee0dda3
  0xedbad60f5ac328bfb1909fd4492c2080944ee03f526e21aadc7b3e3e81f60e84
  0x5ecc7f0aed2fbefdeeeea73f4dca9207505f2511f1559d923e4f312b77d2e6f5
  0x5c92f81dd1c7c182b4d36c4957809b5367f8b149304ed47fe9792d9fbd4adf9b
)

echo "NETWORK=$NETWORK L2_RPC=$L2_RPC L2_ARCHIVE_RPC=$L2_ARCHIVE_RPC"
for TX in "${TXS[@]}"; do
  echo "===== prove $TX ====="
  L2_TX="$TX" node scripts/prove-withdrawal.mjs || echo "FAIL $TX"
done
