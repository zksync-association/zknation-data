import { readInterface } from "./utils";

export const ALL_ADDRESSES_ALLOCATION_PATHES = ["airdrop-allocations-wave-1.csv", "airdrop-allocations-wave-2.csv", "airdrop-allocations-wave-3.csv"];
export const L1_ADDRESSES_ALLOCATION_PATHES = ["l1_eligibility_list-wave-1.csv", "l1_eligibility_list-wave-2.csv",  "l1_eligibility_list-wave-3.csv"];
export const L2_MERKLE_DISTRIBUTOR_ADDRESSES = ["0x66Fd4FC8FA52c9bec2AbA368047A0b27e24ecfe4", "0xb294F411cB52c7C6B6c0B0b61DBDf398a8b0725d", "0xf29D698E74EF1904BCFDb20Ed38f9F3EF0A89E5b"];
export const L2_MERKLE_DISTRIBUTOR_INTERFACE = readInterface("abi/MERKLE_DISTRIBUTOR_ABI.json");
export const L1_BRIDGE_HUB_INTERFACE = readInterface("abi/BRIDGE_HUB_ABI.json");
export const ERC20_INTERFACE = readInterface("abi/ERC20_ABI.json");

export const L1_BRIDGE_HUB_ADDRESS = "0x303a465B659cBB0ab36eE643eA362c509EEb5213";
export const L2_ZK_TOKEN_ADDRESS = "0x5a7d6b2f92c77fad6ccabd7ee0624e64907eaf3e";
export const ZKSYNC_ERA_CHAIN_ID = 324;
export const DEFAULT_L2_TX_GAS_LIMIT = 2097152;
export const REQUIRED_L2_GAS_PRICE_PER_PUBDATA = 800;
