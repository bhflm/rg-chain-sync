require("dotenv").config();
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { RpcSource } from "../src/data-sources/rpc/";
import { RailgunEventType, isNullifiersEntry } from "../src/types/data-entry";
import { NetworkName } from "../src/config/network-config";
import { DataEntry } from "../src/types/data-entry";

const API_KEY = process.env.API_KEY;
const alchemyURL = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;

describe("RpcSource", () => {
  let rpcSource: RpcSource;

  before(async () => {
    rpcSource = new RpcSource({
      networkName: NetworkName.Ethereum,
      providerUrl: alchemyURL,
      version: "v2",
      batchSize: 500,
    });

    const startTime = Date.now();
    const waitTimeout = 5000;
    while (rpcSource.head === 0n && Date.now() - startTime < waitTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (rpcSource.head === 0n) {
      throw new Error("RpcSource head did not initialize in time");
    }
    console.log(`RpcSource initialized with head: ${rpcSource.head}`);
  });

  after(() => {
    if (rpcSource) {
      rpcSource.destroy();
    }
  });

  it("should fetch more events between block range and be able to iterate across them", async () => {
    const startBlock = 16000000n;
    const endRange = startBlock + 5000n;

    const iterator = await rpcSource.read(startBlock);

    const eventsMapByType: Record<string, Record<string, any>> = {}; // we create a map to categorize events by { eventType: {  eventTimestamp: eventData } }

    // Fill in event map;
    for await (const entry of iterator) {
      if (entry.blockNumber >= endRange) break; // cut loop, if not will read a *lot*
      const blockTimestamp = entry.blockTimestamp.toString();

      if (!eventsMapByType[entry.type]) {
        eventsMapByType[entry.type] = new Map();
      }

      const map = eventsMapByType[entry.type];
      map.set(blockTimestamp, entry);
    }

    const nullifiersEventsMap = eventsMapByType[RailgunEventType.Nullifiers];
    assert(nullifiersEventsMap.size > 0, "Should at least have 1 event");

    const commitmentsEventsMap =
      eventsMapByType[RailgunEventType.CommitmentBatch];
    assert(commitmentsEventsMap.size > 0, "Should at least have 1 event");
  });
});
