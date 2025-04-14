import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatLegacyCommitmentBatchEvent,
  formatLegacyGeneratedCommitmentBatchEvent,
  formatLegacyNullifierEvents
} from '../src/formatters/v1';
import { CommitmentType } from '../src/types/events';

describe('V1 Formatters', () => {
  describe('formatLegacyCommitmentBatchEvent', () => {
    it('should format a CommitmentBatch event correctly', () => {
      const args = {
        treeNumber: 0n,
        startPosition: 100n,
        hash: [
          0x1234567890abcdefn, 
          0xfedcba0987654321n
        ],
        ciphertext: [
          {
            ephemeralKeys: [0x1111n, 0x2222n],
            ciphertext: [0xaaaaaa1111n, 0xbbbbbb2222n],
            memo: [0xcccccc3333n]
          },
          {
            ephemeralKeys: [0x3333n, 0x4444n],
            ciphertext: [0xdddddd4444n, 0xeeeeee5555n],
            memo: [0xffffff6666n]
          }
        ]
      };
      
      const transactionHash = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const blockNumber = 14000000;
      
      const result = formatLegacyCommitmentBatchEvent(args, transactionHash, blockNumber);
      
      console.log('RESULT: ', result);

      assert.strictEqual(result.treeNumber, 0, 'Tree number should match');
      assert.strictEqual(result.startPosition, 100, 'Start position should match');
      assert.strictEqual(result.blockNumber, blockNumber, 'Block number should match');
      assert.strictEqual(result.commitments.length, 2, 'Should have 2 commitments');
      
      const firstCommitment = result.commitments[0];
      assert.strictEqual(firstCommitment.commitmentType, CommitmentType.LegacyEncryptedCommitment);
      assert.strictEqual(firstCommitment.utxoTree, 0);
      assert.strictEqual(firstCommitment.utxoIndex, 100);
      assert.strictEqual(firstCommitment.blockNumber, blockNumber);
    });
    
    it('should throw an error for invalid args', () => {
      const invalidArgs = {
        treeNumber: null,
        startPosition: 100n,
        hash: [0x1234n],
        ciphertext: []
      };
      
      assert.throws(
        () => formatLegacyCommitmentBatchEvent(
          invalidArgs, 
          '0x1234', 
          12345
        ),
        /Invalid CommitmentBatchEventArgs/
      );
    });
  });
  
  describe('formatLegacyGeneratedCommitmentBatchEvent', () => {
    it('should format a GeneratedCommitmentBatch event correctly', () => {
      // Mock event args
      const args = {
        treeNumber: 1n,
        startPosition: 50n,
        commitments: [
          { npk: '0x1111222233334444' },
          { npk: '0x5555666677778888' }
        ],
        encryptedRandom: [
          [0xaaaabbbbccccn, 0xddddeeeeffn],
          [0x1111222233n, 0x4444555566n]
        ]
      };
      
      const transactionHash = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const blockNumber = 14000000;
      
      const result = formatLegacyGeneratedCommitmentBatchEvent(args, transactionHash, blockNumber);
      
      console.log('RESULT: ', result);

      assert.strictEqual(result.treeNumber, 1, 'Tree number should match');
      assert.strictEqual(result.startPosition, 50, 'Start position should match');
      assert.strictEqual(result.blockNumber, blockNumber, 'Block number should match');
      assert.strictEqual(result.commitments.length, 2, 'Should have 2 commitments');
      
      // Check commitment properties
      const firstCommitment = result.commitments[0];
      assert.strictEqual(firstCommitment.commitmentType, CommitmentType.LegacyGeneratedCommitment);
      assert.strictEqual(firstCommitment.utxoTree, 1);
      assert.strictEqual(firstCommitment.utxoIndex, 50);
      assert.strictEqual(firstCommitment.blockNumber, blockNumber);
    });
    
    it('should throw an error for invalid args', () => {
      const invalidArgs = {
        treeNumber: 1n,
        startPosition: null,
        commitments: [],
        encryptedRandom: []
      };
      
      assert.throws(
        () => formatLegacyGeneratedCommitmentBatchEvent(
          invalidArgs, 
          '0x1234', 
          12345
        ),
        /Invalid GeneratedCommitmentBatchEventArgs/
      );
    });
  });
  
  describe('formatLegacyNullifierEvents', () => {
    it('should format Nullifier events correctly', () => {
      // Mock event args
      const args = {
        treeNumber: 2n,
        nullifier: [
          0x1111111122222222n,
          0x3333333344444444n
        ]
      };
      
      const transactionHash = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const blockNumber = 14000000;
      
      // Format the events
      const result = formatLegacyNullifierEvents(args, transactionHash, blockNumber);
      
      console.log('RESULT; ', result);

      // Assertions
      assert.strictEqual(result.length, 2, 'Should have 2 nullifiers');
      
      // Check nullifier properties
      const firstNullifier = result[0];
      assert.strictEqual(firstNullifier.treeNumber, 2);
      assert.strictEqual(firstNullifier.blockNumber, blockNumber);
      assert.ok(firstNullifier.nullifier.startsWith('0x'), 'Nullifier should be a hex string');
      
      const secondNullifier = result[1];
      assert.strictEqual(secondNullifier.treeNumber, 2);
      assert.strictEqual(secondNullifier.blockNumber, blockNumber);
      assert.ok(secondNullifier.nullifier.startsWith('0x'), 'Nullifier should be a hex string');
    });
  });
});