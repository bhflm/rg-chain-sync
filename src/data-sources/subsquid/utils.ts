import { RailgunEventType } from "../../types/data-entry";

// export enum RailgunEventType {
//   V1_GeneratedCommitmentBatch = 'GeneratedCommitmentBatch_V1',
//   V1_CommitmentBatch = 'CommitmentBatch_V1',
//   V1_Nullifiers = 'Nullifiers_V1',
//   CommitmentBatch = 'CommitmentBatch', 
//   GeneratedCommitmentBatch = 'GeneratedCommitmentBatch', // V2/V2-Legacy (if args match)
//   Nullifiers = 'Nullifiers',             // V2/V2-Legacy (if args match) - NOTE: V1/V2 names clash! Renamed V1 above.
//   Shield = 'Shield',
//   Unshield = 'Unshield',
//   Transact = 'Transact', // V2/V2-Legacy
// }

export const hasQueries = (eventTypes?: RailgunEventType[]) => {
  const queryNullifiers = !eventTypes || eventTypes.includes(RailgunEventType.Nullifiers);
  const queryCommitmentBatch = !eventTypes || eventTypes.includes(RailgunEventType.CommitmentBatch);
  const queryGeneratedCommitmentBatch = !eventTypes || eventTypes.includes(RailgunEventType.GeneratedCommitmentBatch);

  const queryFlags = {
    queryNullifiers,
    queryCommitmentBatch,
    queryGeneratedCommitmentBatch,
  };

  return Object.values(queryFlags).some(flag => flag);
};

interface QueryOptions {
  height: number;
  batchSize: number;
  offset?: number;
}

const commonFields = [
  'id',
  'blockNumber',
  'blockTimestamp',
  'transactionHash',
];

const getDefaultFields = (eventType: RailgunEventType): string[] => {
  switch (eventType) {
    case RailgunEventType.Nullifiers:
      return [
        ...commonFields,
        'treeNumber',
        'nullifier'
      ];
    case RailgunEventType.CommitmentBatch:
    case RailgunEventType.GeneratedCommitmentBatch:
      return [
        ...commonFields,
        'treeNumber',
        'batchStartTreePosition',
        'treePosition',
        'commitmentType',
        'hash'
      ];
    case RailgunEventType.Shield:
      return [
        ...commonFields,
        'treeNumber',
        'batchStartTreePosition',
        'treePosition',
        'commitmentType',
        'hash'
      ];
    case RailgunEventType.Unshield:
      return [
        ...commonFields,
        'to',
        'token',
        'amount',
        'fee',
        'eventLogIndex'
      ];
    case RailgunEventType.Transact:
      return [
        ...commonFields,
        'treeNumber',
        'batchStartTreePosition',
        'treePosition',
        'commitmentType',
        'hash'
      ];
    default:
      return [];
  }
};

const getEntityName = (eventType: RailgunEventType) => {
  switch (eventType) {
    case RailgunEventType.Nullifiers:
      return 'nullifiers';
    case RailgunEventType.CommitmentBatch:
    case RailgunEventType.GeneratedCommitmentBatch:
      return 'shieldCommitments';
    case RailgunEventType.Shield:
      return 'shieldCommitments';
    case RailgunEventType.Unshield:
      return 'unshields';
    case RailgunEventType.Transact:
      return 'transactCommitments';
    default:
      throw new Error(`Unknown event type: ${eventType}`);
  }
};

export const buildEventQuery = (
  eventType: RailgunEventType,
  options: QueryOptions
) => {
  const entityName = getEntityName(eventType);
  const defaultFields = getDefaultFields(eventType);

  return {
    [entityName]: {
      fields: defaultFields,
      where: {
        blockNumber_gte: options.height.toString()
      },
      limit: options.batchSize,
      offset: options.offset || 0,
      // orderBy: undefined // This should now match the expected type
    }
  };
};

export const buildEventQueries = (
  eventTypes: RailgunEventType[],
  options: QueryOptions
) => {
  return eventTypes.reduce((queries, eventType) => {
    return {
      ...queries,
      ...buildEventQuery(eventType, options)
    };
  }, {});
};

const queries = buildEventQueries(
  [RailgunEventType.Nullifiers, RailgunEventType.Shield],
  {
    height: 4000000,
    batchSize: 100,
    offset: 0
  }
);