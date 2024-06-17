import { AbstractProvider, Contract, getDefaultProvider, JsonRpcProvider } from "ethers";
import { constructMerkleTree, readCSV } from "./utils";
import { Command } from "commander";
import { MerkleTree } from "merkletreejs";
import { DEFAULT_L2_TX_GAS_LIMIT, L1_BRIDGE_HUB_ADDRESS, L2_MERKLE_DISTRIBUTOR_ADDRESS, L2_MERKLE_DISTRIBUTOR_INTERFACE, REQUIRED_L2_GAS_PRICE_PER_PUBDATA, ZKSYNC_ERA_CHAIN_ID, } from "./contants";
import { BRIDGEHUB_ABI } from "zksync-ethers/build/utils";
import { BigNumberish, parseUnits } from "ethers";
import { utils } from "zksync-ethers";

function getL2ClaimData(tree: MerkleTree, leaves: any, address: string, isL1: boolean) {
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
    throw new Error(`${isL1 ? utils.undoL1ToL2Alias(address) : address} address is not eligible`);
  }

  const merkleProof = tree.getHexProof(leaf.hashBuffer);
  return {
    address: leaf.address,
    call_to_claim: {
      to: L2_MERKLE_DISTRIBUTOR_ADDRESS,
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

  program
    .command("generate-l2-contract-claim-tx <address>")
    .action(async (address: string, cmd) => {
      const allocation = await readCSV("airdrop-allocations.csv");
      const l1EligibilityList = await readCSV("l1_eligibility_list.csv");
      const { leavesBuffs, tree } = constructMerkleTree(allocation, l1EligibilityList);

      const l2ClaimData = getL2ClaimData(tree, leavesBuffs, address, false);
      console.log(JSON.stringify(l2ClaimData, null, 4));
    });

  program
    .command("generate-l1-contract-claim-tx <address>")
    .requiredOption("--l1-gas-price <l1-gas-price>")
    .option("--l1-json-rpc <l1-json-rpc>")
    .action(async (address, cmd) => {
      const gasPrice = parseUnits(cmd.l1GasPrice, "gwei").toString();
      const l1Provider = cmd.l1JsonRpc ? new JsonRpcProvider(cmd.l1JsonRpc) : getDefaultProvider("mainnet");

      const allocation = await readCSV("airdrop-allocations.csv");
      const l1EligibilityList = await readCSV("l1_eligibility_list.csv");
      const { leavesBuffs, tree } = constructMerkleTree(allocation, l1EligibilityList);

      const aliasedAddress = utils.applyL1ToL2Alias(address);
      const l2ClaimData = getL2ClaimData(tree, leavesBuffs, aliasedAddress, true);
      const l1TxData = await getL1TxInfo(l1Provider, l2ClaimData.call_to_claim.to, l2ClaimData.call_to_claim.l2_raw_calldata, address, gasPrice);
      const finalData = {
        address,
        call_to_claim: l1TxData
      }
      console.log(JSON.stringify(finalData, null, 4));
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
