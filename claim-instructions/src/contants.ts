import { readInterface } from "./utils";

export const L2_MERKLE_DISTRIBUTOR_INTERFACE = readInterface("abi/MERKLE_DISTRIBUTOR_ABI.json");
export const L1_BRIDGE_HUB_INTERFACE = readInterface("abi/BRIDGE_HUB_ABI.json");

export const L1_BRIDGE_HUB_ADDRESS = "0x303a465B659cBB0ab36eE643eA362c509EEb5213";
export const L2_MERKLE_DISTRIBUTOR_ADDRESS = "0x66Fd4FC8FA52c9bec2AbA368047A0b27e24ecfe4";
export const ZKSYNC_ERA_CHAIN_ID = 324;
export const DEFAULT_L2_TX_GAS_LIMIT = 2097152;
export const REQUIRED_L2_GAS_PRICE_PER_PUBDATA = 800;

