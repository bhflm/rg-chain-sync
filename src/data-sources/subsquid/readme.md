I feel this should be its own package ??

@railgun-reloaded/subsquid-provider

---- some notes/concerns/doubts ----

Ok, having to build the query is more complicated than I thought ??, is there any better way of handlign dynamic reading events with queries from the blockchain??

// IGNORE THIS 
QUESTION: // IGNORE THIS 

We have a defined set of events M, 
but we have a fixed number of available queries N,
issue is that event M does not imply that there's an existing query for event M, but can be several 
like for instance, **commitmentBatch** event red from the blockchain, whats the _translation_ for this 
in terms of subsquid query that we might need the reader to do ??
this impacts below too


OTHER STUFF for query builder : 
IE:
we read one block, from the very first layer
//END OF IGNORE THIS 


````ts
const target_block = 4000000;
const iterator = aggregator.read(targetBlock);
for (await event in iterator) {
  const blockNumber = event.blockNumber();
  // here event might be nullifier, commitment 
}
````

when it calls .read on the aggregator, deep down the aggregator does the following 

````ts
// (@@ todo: fix this, tho, typing issue, but it works) 
const iterator: AsyncIterableIterator<DataEntry> = {
                    ...(await source.read(height, eventTypes)),
                    [Symbol.asyncIterator]() {
                        return this;
                    }
                };
````


so the read thing says, hey! lets read from these eventTypes array all the queries we need 
````ts

    const nullifiers = {
      nullifiers: {
              fields: [
                'id',
                'blockNumber',
                'blockTimestamp',
                'transactionHash',
                'treeNumber',
                'nullifier'
              ],
              where: {
                  blockNumber_gte: height.toString()
              },
              limit: self.batchSize,
              offset: currentOffset,
              // orderBy: ['blockNumber_ASC', 'id_ASC'] 'NullifierOrderByInput.BlockNumberDesc' 
              // @@ TODO: Export abocve type from subsquid client, its erroring
      },
    };

    const commitmentShields = { 
      // build similar to nullifiers
    };

    const eventQueries = {
      ...nullifiers,
      ...commitmentBatch,
      ...eventQuery3,
      ...eventQueryN
    };

    const result = await self.subsquidClient.query(eventQueries);
````

