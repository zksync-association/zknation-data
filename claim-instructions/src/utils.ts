import { ethers, solidityPackedKeccak256 } from "ethers";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import * as fs from "fs";
import { utils } from "zksync-ethers";
import { MerkleTree } from "merkletreejs";

export interface Allocation {
    allEligible: string[][],
    l1Eligible: string[][],
    l2MerkleDistributorAddress: string
}

export function readInterface(path: string) {
    const abi = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8' }));
    return new ethers.Interface(abi);
}

// Function to read and parse the CSV file and return a Promise
export function readCSV(filePath: string): Promise<string[][]> {
    return new Promise((resolve, reject) => {
        const values: string[][] = []; // Initialize an empty array to store the parsed data
        const parser = parse({ columns: false }, (error, records: string[][]) => {
            if (error) {
                reject("Error parsing the CSV file: " + error);
                return;
            }

            // Skip the header row and store the rest in the "values" array with the row index
            for (let i = 1; i < records.length; i++) {
                values.push(records[i]);
            }
            resolve(values);
        });

        // Create a read stream from the file and pipe it to the parser
        createReadStream(filePath).pipe(parser);
    });
}

export async function readAllocationsAndL1EligibilityLists(allEligiblePath: string[], l1EligiblePath: string[], l2MerkleDistributorAddresses: string[]): Promise<Allocation[]> {
    let result = new Array();
    if (allEligiblePath.length !== l1EligiblePath.length || l1EligiblePath.length !== l2MerkleDistributorAddresses.length) {
        throw new Error("Mismatch between the number of eligibility lists and the L1 addresses list!");
    }
    for (let i = 0; i < allEligiblePath.length; ++i) {
        result.push({
            allEligible: await readCSV(allEligiblePath[i]),
            l1Eligible: await readCSV(l1EligiblePath[i]),
            l2MerkleDistributorAddress: l2MerkleDistributorAddresses[i]
        });
    }
    return result;
}

export function constructMerkleTree(addresses: string[][], l1SmartContractAddresses: string[][]) {
    for (let i = 0; i < addresses.length; i++) {
        for (let j = 0; j < l1SmartContractAddresses.length; j++) {
            if (addresses[i][0].toLowerCase() == l1SmartContractAddresses[j][0].toLowerCase()) {
                addresses[i][0] = utils.applyL1ToL2Alias(addresses[i][0]);
                break;
            }
        }
    }

    const leaves = addresses.map((allocation, i) => ({
        address: allocation[0],
        amount: allocation[1],
        index: i,
        hashBuffer: Buffer.from(
            solidityPackedKeccak256(["uint256", "address", "uint256"], [i, allocation[0], allocation[1]])
                .replace("0x", ""),
            "hex"
        ),
    }));

    const leavesBuffs = leaves.sort((a, b) => Buffer.compare(a.hashBuffer, b.hashBuffer));
    const tree = new MerkleTree(leavesBuffs.map((leaf) => leaf.hashBuffer), ethers.keccak256, { sortPairs: true });

    return { leaves: leavesBuffs, tree };
}

