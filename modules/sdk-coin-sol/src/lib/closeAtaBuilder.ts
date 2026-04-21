import { BuildTransactionError, TransactionType } from '@bitgo/sdk-core';
import { BaseCoin as CoinConfig } from '@bitgo/statics';
import assert from 'assert';
import { InstructionBuilderTypes } from './constants';
import { AtaClose } from './iface';
import { Transaction } from './transaction';
import { TransactionBuilder } from './transactionBuilder';
import { validateAddress } from './utils';

export class CloseAtaBuilder extends TransactionBuilder {
  // Unified storage for all close entries (single or bulk)
  protected _closeAtaEntries: { accountAddress: string; destinationAddress: string; authorityAddress: string }[] = [];

  // Track whether the legacy single-ATA API is being used
  private _usingSingleAtaApi = false;

  constructor(_coinConfig: Readonly<CoinConfig>) {
    super(_coinConfig);
    this._transaction = new Transaction(_coinConfig);
  }

  protected get transactionType(): TransactionType {
    return TransactionType.CloseAssociatedTokenAccount;
  }

  /**
   * Sets the ATA account address to close (single-ATA API, backward compatible).
   * Cannot be mixed with addCloseAtaInstruction().
   */
  accountAddress(accountAddress: string): this {
    validateAddress(accountAddress, 'accountAddress');
    this._usingSingleAtaApi = true;
    this._ensureSingleEntry();
    this._closeAtaEntries[0].accountAddress = accountAddress;
    return this;
  }

  /**
   * Sets the destination address for rent SOL (single-ATA API, backward compatible).
   * Cannot be mixed with addCloseAtaInstruction().
   */
  destinationAddress(destinationAddress: string): this {
    validateAddress(destinationAddress, 'destinationAddress');
    this._usingSingleAtaApi = true;
    this._ensureSingleEntry();
    this._closeAtaEntries[0].destinationAddress = destinationAddress;
    return this;
  }

  /**
   * Sets the authority address / ATA owner (single-ATA API, backward compatible).
   * Cannot be mixed with addCloseAtaInstruction().
   */
  authorityAddress(authorityAddress: string): this {
    validateAddress(authorityAddress, 'authorityAddress');
    this._usingSingleAtaApi = true;
    this._ensureSingleEntry();
    this._closeAtaEntries[0].authorityAddress = authorityAddress;
    return this;
  }

  /**
   * Ensures a single entry exists in _closeAtaEntries for the legacy API.
   */
  private _ensureSingleEntry(): void {
    if (this._closeAtaEntries.length === 0) {
      this._closeAtaEntries.push({ accountAddress: '', destinationAddress: '', authorityAddress: '' });
    }
  }

  /**
   * Add an ATA to close in this transaction (for bulk closure).
   * Cannot be mixed with the single-ATA API (accountAddress/destinationAddress/authorityAddress).
   *
   * @param {string} accountAddress - the ATA address to close
   * @param {string} destinationAddress - where rent SOL goes (root wallet address)
   * @param {string} authorityAddress - ATA owner who must sign
   */
  addCloseAtaInstruction(accountAddress: string, destinationAddress: string, authorityAddress: string): this {
    if (this._usingSingleAtaApi) {
      throw new BuildTransactionError(
        'Cannot mix addCloseAtaInstruction() with single-ATA API (accountAddress/destinationAddress/authorityAddress)'
      );
    }

    validateAddress(accountAddress, 'accountAddress');
    validateAddress(destinationAddress, 'destinationAddress');
    validateAddress(authorityAddress, 'authorityAddress');

    if (accountAddress === destinationAddress) {
      throw new BuildTransactionError('Account address to close cannot be the same as the destination address');
    }

    if (this._closeAtaEntries.some((entry) => entry.accountAddress === accountAddress)) {
      throw new BuildTransactionError('Duplicate ATA address: ' + accountAddress);
    }

    this._closeAtaEntries.push({ accountAddress, destinationAddress, authorityAddress });
    return this;
  }

  /** @inheritDoc */
  initBuilder(tx: Transaction): void {
    super.initBuilder(tx);
    for (const instruction of this._instructionsData) {
      if (instruction.type === InstructionBuilderTypes.CloseAssociatedTokenAccount) {
        const ataCloseInstruction: AtaClose = instruction;
        this._closeAtaEntries.push({
          accountAddress: ataCloseInstruction.params.accountAddress,
          destinationAddress: ataCloseInstruction.params.destinationAddress,
          authorityAddress: ataCloseInstruction.params.authorityAddress,
        });
      }
    }
  }

  /** @inheritdoc */
  protected async buildImplementation(): Promise<Transaction> {
    assert(this._closeAtaEntries.length > 0, 'At least one ATA must be specified before building the transaction');

    for (const entry of this._closeAtaEntries) {
      assert(entry.accountAddress, 'Account Address must be set before building the transaction');
      assert(entry.destinationAddress, 'Destination Address must be set before building the transaction');
      assert(entry.authorityAddress, 'Authority Address must be set before building the transaction');

      if (entry.accountAddress === entry.destinationAddress) {
        throw new BuildTransactionError('Account address to close cannot be the same as the destination address');
      }
    }

    this._instructionsData = this._closeAtaEntries.map(
      (entry): AtaClose => ({
        type: InstructionBuilderTypes.CloseAssociatedTokenAccount,
        params: {
          accountAddress: entry.accountAddress,
          destinationAddress: entry.destinationAddress,
          authorityAddress: entry.authorityAddress,
        },
      })
    );

    return await super.buildImplementation();
  }
}
