// require('dotenv').config();
// import { describe, it, before, after } from 'node:test';
// import assert from 'node:assert';

// // Import specific sources
// import { RpcSource } from '../src/data-sources/rpc/';
// import { SubsquidSource } from '../src/data-sources/subsquid/';

// import { AggregatedSource } from '../src/data-aggregator/aggregator';

// import { isNullifiersEntry } from '../src/types/data-entry';
// import { NetworkName } from '../src/config/network-config';

// const API_KEY = process.env.API_KEY;
// const alchemyURL = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;

// // using this block as reference since it has a known nullifier from playground
// // https://rail-squid.squids.live/squid-railgun-ethereum-v2/graphql
// /**
//  * nullifiers {
//     blockNumber
//     blockTimestamp
//     id
//     nullifier
//     transactionHash
//     treeNumber
//   }
//  */
// const TARGET_BLOCK = 14755920n;
// const EXPECTED_NULLIFIER = "0x1e52cee52f67c37a468458671cddde6b56390dcbdc4cf3b770badc0e78d66401";

// describe('AggregatedSource - Live API Tests', () => {
//     let aggregatedSource: AggregatedSource;

//     before(async () => {
//         console.log("[Agg Test Setup] Initializing sources...");
//         // create aggregatedSource with Subsquid having higher priority (listed first)
//         aggregatedSource = new AggregatedSource([
//           new SubsquidSource({
//             network: 'ethereum',
//             batchSize: 50,
//           }),
//           new RpcSource({
//             networkName: NetworkName.Ethereum,
//             providerUrl: alchemyURL,
//             version: 'v2',
//             batchSize: 500, // this doesn't need to be the same as on the other source since they handle stuff..differently
//           })]);

//         // wait a little bit and check if the head is set
//         const startTime = Date.now();
//         const waitTimeout = 5000;
//         while (aggregatedSource.head === 0n && (Date.now() - startTime) < waitTimeout) {
//             await new Promise(resolve => setTimeout(resolve, 500));
//         }

//         console.log(`[Agg Test Setup] AggregatedSource created. Head: ${aggregatedSource.head}`);
//         assert.ok(aggregatedSource.head > 0n, "Aggregated head should be > 0");
//     });

//     after(() => {
//         if (aggregatedSource) {
//             console.log("[Agg Test Teardown] Destroying AggregatedSource...");
//             aggregatedSource.destroy();
//         }
//     });

//     it('should initialize with head > 0', () => {
//         assert.ok(aggregatedSource.head > 0n, 'AggregatedSource head should be initialized and > 0');
//      });

//     it(`should yield the specific nullifier ${EXPECTED_NULLIFIER} from block ${TARGET_BLOCK}`, async () => {
//         let foundExpectedEntry = false;
//         let sourceOfFirstMatch: string | null = null;
//         const scanLimitBlocks = 10n; // Only scan a few blocks around the target
//         const endScanBlock = TARGET_BLOCK + scanLimitBlocks;

//         console.log(`[Agg Test Run] Starting search for nullifier ${EXPECTED_NULLIFIER} at/after block ${TARGET_BLOCK}...`);

//         const iterator = await aggregatedSource.read(TARGET_BLOCK);

//         // Iterate with the aggregated source iterator
//         for await (const entry of iterator) {
//             console.log(`[Agg Test Run] Yielded: Type=${entry.type}, Block=${entry.blockNumber}, Source=${entry.source}, LogIdx=${entry.logIndex}`);

//             // do not make it go away (is this needed??)
//             if (entry.blockNumber > endScanBlock) {
//                  console.log(`[Agg Test Run] Scanned past block ${endScanBlock}, stopping search.`);
//                  break;
//             }

//             // check if it's the event we're looking for
//             if (entry.blockNumber === TARGET_BLOCK && isNullifiersEntry(entry)) {
//                 const payload = entry.payload;
//                 // check if *any* of the nullifiers in this payload match our target
//                 const matchedNullifier = payload.nullifiers.find(n => n === EXPECTED_NULLIFIER);

//                 if (matchedNullifier) {
//                     console.log(`[Agg Test Run] FOUND expected nullifier ${matchedNullifier} from source: ${entry.source} in block ${entry.blockNumber}`);
//                     foundExpectedEntry = true;
//                     // record the source of the *first* time we see this specific nullifier
//                     if (sourceOfFirstMatch === null) {
//                         sourceOfFirstMatch = entry.source;
//                     }
//                     // don't break immediately - let's see if the other source also yields it (though dedupe might prevent it)
//                     // break; // uncomment to just validate with first show up of the entry
//                 }
//             }
//         }

//         assert.ok(foundExpectedEntry, `Test failed: Expected Nullifier ${EXPECTED_NULLIFIER} was NOT yielded for block ${TARGET_BLOCK}`);

//         // because Subsquid is higher priority, we expect it to yield the event first.
//         // Note: This assumes Subsquid has the data. If Subsquid is lagging, RPC might yield it first.
//         // Also, if logIndex differs, deduplication might fail, allowing both. <<< This current fails because of logIndex = -1 mock
//         assert.strictEqual(sourceOfFirstMatch, 'subsquid', `Expected the first match for the nullifier to come from 'subsquid', but got '${sourceOfFirstMatch}'`);

//         console.log(`[Agg Test Run] Test finished. First match source: ${sourceOfFirstMatch}`);

//     });
// });
