require("dotenv").config();
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { RpcSource } from "../src/data-sources/rpc/"; // Adjust path if needed
import { RailgunEventType, isNullifiersEntry } from "../src/types/data-entry"; // Adjust path
import { NetworkName } from "../src/config/network-config"; // Adjust path
import { DataCompleteness } from "../src/types/datasource"; // Adjust path

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("NO API KEY FOUND");
}
const alchemyURL = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;

describe("RpcSource with ReadableStream", () => {
  let rpcSource: RpcSource;

  before(async () => {
    rpcSource = new RpcSource({
      networkName: NetworkName.Ethereum,
      providerUrl: alchemyURL,
      // version: 'v2', // Assuming v2 for the test target block
      // Let's explicitly test the block where the nullifier is known
      version: "v1", // Target block 14755920 is likely V1 contract era
      batchSize: 500, // Keep batch size reasonable for testing
    });

    // Wait for the source to get its initial head
    const startTime = Date.now();
    const waitTimeout = 10000; // Increase timeout slightly for network latency
    console.log("Waiting for RpcSource head initialization...");
    while (rpcSource.head === 0n && Date.now() - startTime < waitTimeout) {
      // The head update runs in the background, just wait
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (rpcSource.head === 0n) {
      // Attempt one more explicit update just in case
      // @ts-ignore // Accessing private method for test setup robustness
      await rpcSource.updateHead();
      if (rpcSource.head === 0n) {
        rpcSource.destroy(); // Clean up if initialization failed
        throw new Error(
          `RpcSource head did not initialize within ${waitTimeout}ms`,
        );
      }
    }
    console.log(`RpcSource initialized with head: ${rpcSource.head}`);
  });

  after(() => {
    if (rpcSource) {
      console.log("Destroying RpcSource...");
      rpcSource.destroy();
      console.log("RpcSource destroyed.");
    }
  });

  // --- Keep the first test commented out or adapt similarly if needed ---
  // it('should fetch and iterate through Nullifier events', async () => { ... });

  it("should fetch the specific V1 Nullifier event at block 14755920 using ReadableStream", async () => {
    const targetBlock = 14755920n;
    let foundMatch = false;
    const expectedNullifier =
      "0x1e52cee52f67c37a468458671cddde6b56390dcbdc4cf3b770badc0e78d66401";
    // Limit scanning slightly beyond the target block just in case of timing issues or wanting the *first* after.
    const maxBlocksToScan = 10n; // Scan target block + a few more
    const endScanBlock = targetBlock + maxBlocksToScan;

    console.log(
      `[Test Stream] Starting search for Nullifier ${expectedNullifier} at block ${targetBlock}...`,
    );

    // Get the ReadableStream from the RpcSource
    // Pass the desired event type to potentially optimize fetching if implemented
    const stream = await rpcSource.read(targetBlock, [
      RailgunEventType.Nullifiers,
    ]);

    // Use for await...of directly on the stream (Node.js supports this)
    for await (const entry of stream) {
      console.log(
        `[Test Stream] Processing entry: Type=${entry.type}, Block=${entry.blockNumber}, LogIndex=${entry.logIndex}`,
      );

      // Stop searching if we go too far past the target block
      if (entry.blockNumber > endScanBlock) {
        console.log(
          `[Test Stream] Scanned up to block ${entry.blockNumber} (> ${endScanBlock}), stopping search.`,
        );
        break; // Exit the loop
      }

      // We requested only Nullifiers, but double-check the type guard just to be safe
      if (isNullifiersEntry(entry)) {
        console.log(
          `[Test Stream] Found Nullifiers entry at block ${entry.blockNumber}, tx ${entry.transactionHash}`,
        );

        // Check if it's the exact block and nullifier we want
        if (entry.blockNumber === targetBlock) {
          const payload = entry.payload;
          // Find if the *expected* nullifier is in the payload's array
          const foundExpectedInPayload =
            payload.nullifiers.includes(expectedNullifier);

          if (foundExpectedInPayload) {
            console.log(
              `[Test Stream] Found expected Nullifier ${expectedNullifier} in payload at block ${targetBlock}. Validating...`,
            );
            foundMatch = true;

            // --- Perform Assertions ---
            assert.strictEqual(
              entry.type,
              RailgunEventType.Nullifiers,
              "Entry type should be Nullifiers",
            );
            assert.strictEqual(entry.source, "rpc", 'Source should be "rpc"');
            assert.strictEqual(
              entry.completeness,
              DataCompleteness.BASIC,
              "Completeness should be BASIC",
            );
            assert.strictEqual(
              entry.blockNumber,
              targetBlock,
              `Block number should be the target block ${targetBlock}`,
            );
            assert.ok(
              entry.transactionHash.startsWith("0x") &&
                entry.transactionHash.length === 66,
              "Transaction hash format invalid",
            );
            assert.ok(
              typeof entry.logIndex === "number" && entry.logIndex >= 0,
              "Log index should be a non-negative number",
            );
            assert.ok(
              typeof entry.blockTimestamp === "number" &&
                entry.blockTimestamp > 1600000000,
              "Block timestamp seems invalid",
            ); // Basic sanity check
            assert.strictEqual(
              entry.railgunTxid,
              undefined,
              "RailgunTxid should be undefined for basic RPC",
            );

            assert.ok(
              typeof payload.treeNumber === "number",
              "Payload treeNumber should be a number",
            );
            assert.ok(
              Array.isArray(payload.nullifiers) &&
                payload.nullifiers.length > 0,
              "Payload nullifiers array invalid or empty",
            );

            // Validate format of the specific nullifier found
            const foundNullifier = payload.nullifiers.find(
              (n) => n === expectedNullifier,
            );
            assert.ok(
              foundNullifier,
              "Expected nullifier string not actually found in array after includes check?",
            ); // Should not fail if includes worked
            assert.strictEqual(
              typeof foundNullifier,
              "string",
              "Nullifier should be a string",
            );
            assert.ok(
              foundNullifier.startsWith("0x"),
              "Nullifier string should start with 0x",
            );
            assert.strictEqual(
              foundNullifier.length,
              66,
              `Nullifier hex string length should be 66`,
            );

            console.log(
              `[Test Stream] Successfully validated Nullifiers entry: ${JSON.stringify(entry, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)}`,
            );

            // We found the exact entry we wanted, stop iterating.
            break; // Exit the for await loop
          } else {
            console.log(
              `[Test Stream] Found Nullifiers event in block ${targetBlock}, but it did not contain the expected nullifier ${expectedNullifier}. Payload:`,
              payload.nullifiers,
            );
            // Continue searching within the block or subsequent blocks up to the limit
          }
        } else {
          console.log(
            `[Test Stream] Found Nullifiers event at block ${entry.blockNumber} (after target). Skipping detailed validation for this test's purpose.`,
          );
          // If you wanted the *first* nullifier *at or after*, you could validate and break here too.
          // For this specific test targeting block 14755920, we continue until we find it or exceed the scan limit.
        }
      } else {
        // This shouldn't happen if the eventTypes filter worked, but good to log if it does.
        console.warn(
          `[Test Stream] Received unexpected entry type: ${entry.type} at block ${entry.blockNumber}`,
        );
      }
    } // End for await loop

    // Final assertion after the loop finishes (or breaks)
    assert.ok(
      foundMatch,
      `Test failed: Expected Nullifier ${expectedNullifier} was not found and validated in block ${targetBlock} (scanned up to ${endScanBlock})`,
    );
  });
});
