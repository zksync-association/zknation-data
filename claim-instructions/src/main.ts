import { AbstractProvider, Contract, getDefaultProvider, JsonRpcProvider, ZeroAddress } from "ethers";
import { Allocation, constructMerkleTree, readAllocationsAndL1EligibilityLists, readCSV } from "./utils";
import { Command } from "commander";
import { DEFAULT_L2_TX_GAS_LIMIT, L1_BRIDGE_HUB_ADDRESS, L2_MERKLE_DISTRIBUTOR_ADDRESSES, L2_MERKLE_DISTRIBUTOR_INTERFACE, REQUIRED_L2_GAS_PRICE_PER_PUBDATA, ZKSYNC_ERA_CHAIN_ID, L2_ZK_TOKEN_ADDRESS, ERC20_INTERFACE, ALL_ADDRESSES_ALLOCATION_PATHES, L1_ADDRESSES_ALLOCATION_PATHES } from "./contants";
import { BRIDGEHUB_ABI } from "zksync-ethers/build/utils";
import { BigNumberish, parseUnits } from "ethers";
import { utils } from "zksync-ethers";

function getOneL2ClaimData(allocation: Allocation, address: string) {
  const { leaves, tree } = constructMerkleTree(allocation.allEligible, allocation.l1Eligible);
  let found = false;
  let leaf: any;
  for (let i = 0; i < leaves.length; i++) {
    if ((leaves[i].address as string).toLowerCase() == address.toLowerCase()) {
      leaf = leaves[i];
      found = true;
      break;
    }
  }

  if (!found) {
    return null;
  }

  const merkleProof = tree.getHexProof(leaf.hashBuffer);
  return {
    address: leaf.address,
    call_to_claim: {
      to: allocation.l2MerkleDistributorAddress,
      function: "claim",
      params: {
        index: leaf.index,
        amount: leaf.amount,
        merkle_proof: merkleProof,
      },
      l2_raw_calldata: L2_MERKLE_DISTRIBUTOR_INTERFACE.encodeFunctionData('claim', [leaf.index, leaf.amount, merkleProof])
    }
  };
}

function getL2ClaimData(allocations: Allocation[], address: string, isL1: boolean) {
  const claimCalldatas = {
    address,
    calls_to_claim: new Array(),
  };
  for (let i = 0; i < allocations.length; ++i) {
    const claimCalldata = getOneL2ClaimData(allocations[i], address);
    if (claimCalldata) {
      claimCalldatas.calls_to_claim.push(claimCalldata.call_to_claim);
    }
  }

  if (claimCalldatas.calls_to_claim.length == 0) {
    throw new Error(`${isL1 ? utils.undoL1ToL2Alias(address) : address} address is not eligible`);
  }

  return claimCalldatas;
}

function getL2TransferData(to: string, amount: string) {
  return {
    call_to_transfer: {
      to: L2_ZK_TOKEN_ADDRESS,
      function: "transfer",
      params: {
        to,
        amount
      },
      l2_raw_calldata: ERC20_INTERFACE.encodeFunctionData('transfer', [to, amount])
    }
  };
}

async function getL1TxInfo(
  l1Provider: JsonRpcProvider | AbstractProvider,
  to: string,
  l2Calldata: string,
  refundRecipient: string,
  gasPrice: BigNumberish
) {
  const bridgeHub = new Contract(L1_BRIDGE_HUB_ADDRESS, BRIDGEHUB_ABI, l1Provider);
  const neededValue = await bridgeHub.l2TransactionBaseCost(
    ZKSYNC_ERA_CHAIN_ID,
    gasPrice,
    DEFAULT_L2_TX_GAS_LIMIT,
    REQUIRED_L2_GAS_PRICE_PER_PUBDATA
  );

  const params = {
    chainId: ZKSYNC_ERA_CHAIN_ID,
    mintValue: neededValue.toString(),
    l2Contract: to,
    l2Value: 0,
    l2Calldata,
    l2GasLimit: DEFAULT_L2_TX_GAS_LIMIT,
    l2GasPerPubdataByteLimit: REQUIRED_L2_GAS_PRICE_PER_PUBDATA,
    factoryDeps: [],
    refundRecipient
  };
  const l1Calldata = BRIDGEHUB_ABI.encodeFunctionData("requestL2TransactionDirect", [params]);

  return {
    to: L1_BRIDGE_HUB_ADDRESS,
    function: "requestL2TransactionDirect",
    params,
    l1_raw_calldata: l1Calldata,
    value: neededValue.toString(),
    gas_price: gasPrice,
  };
}

async function main() {
  const program = new Command();

  const allocations = await readAllocationsAndL1EligibilityLists(ALL_ADDRESSES_ALLOCATION_PATHES, L1_ADDRESSES_ALLOCATION_PATHES, L2_MERKLE_DISTRIBUTOR_ADDRESSES);

  program
    .command("generate-l2-contract-claim-tx <address>")
    .action(async (address: string) => {
      const l2ClaimData = getL2ClaimData(allocations, address, false);
      console.log(JSON.stringify(l2ClaimData, null, 4));
    });

  program
    .command("generate-l1-contract-claim-tx <address>")
    .requiredOption("--l1-gas-price <l1-gas-price>")
    .option("--l1-json-rpc <l1-json-rpc>")
    .action(async (address, cmd) => {
      const gasPrice = parseUnits(cmd.l1GasPrice, "gwei").toString();
      const l1Provider = cmd.l1JsonRpc ? new JsonRpcProvider(cmd.l1JsonRpc) : getDefaultProvider("mainnet");

      const aliasedAddress = utils.applyL1ToL2Alias(address);
      const l2ClaimData = getL2ClaimData(allocations, aliasedAddress, true);

      const calls_to_claim = await Promise.all(l2ClaimData.calls_to_claim.map(async (data) => (await getL1TxInfo(l1Provider, data.to, data.l2_raw_calldata, address, gasPrice))))
      const finalData = {
        address,
        calls_to_claim
      }
      console.log(JSON.stringify(finalData, null, 4));
    });

  program
    .command("generate-l1-contract-transfer-tx")
    .requiredOption("--to <to>")
    .requiredOption("--amount <amount>")
    .requiredOption("--l1-gas-price <l1-gas-price>")
    .option("--l1-json-rpc <l1-json-rpc>")
    .action(async (cmd) => {
      const gasPrice = parseUnits(cmd.l1GasPrice, "gwei").toString();
      const l1Provider = cmd.l1JsonRpc ? new JsonRpcProvider(cmd.l1JsonRpc) : getDefaultProvider("mainnet");

      const l2TransferData = getL2TransferData(cmd.to, cmd.amount);
      const l1TxData = await getL1TxInfo(l1Provider, l2TransferData.call_to_transfer.to, l2TransferData.call_to_transfer.l2_raw_calldata, ZeroAddress, gasPrice);
      console.log(JSON.stringify(l1TxData, null, 4));
    });

  await program.parseAsync(process.argv);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err.message || err);
    console.log("Please make sure to run `yarn sc build` before running this script.");
    process.exit(1);
  });
