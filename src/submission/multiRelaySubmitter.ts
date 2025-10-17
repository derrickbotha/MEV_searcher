import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import { ethers } from 'ethers';
import { Bundle, SignedBundle, SubmissionResult } from '../types';
import { submissionLogger } from '../utils/logger';
import retry from 'async-retry';

export interface RelayClient {
  name: string;
  submitBundle: (bundle: SignedBundle, targetBlock: number) => Promise<SubmissionResult>;
}

export class FlashbotsRelayClient implements RelayClient {
  name = 'Flashbots';
  private provider: FlashbotsBundleProvider | null = null;
  private authSigner: ethers.Wallet;
  private relayUrl: string;

  constructor(authKey: string, relayUrl?: string) {
    this.authSigner = new ethers.Wallet(authKey);
    this.relayUrl = relayUrl || process.env.FLASHBOTS_RELAY_URL || 'https://relay.flashbots.net';
  }

  async initialize(provider: ethers.Provider): Promise<void> {
    this.provider = await FlashbotsBundleProvider.create(
      provider,
      this.authSigner,
      this.relayUrl
    );
    submissionLogger.info({ relay: this.name }, 'Flashbots provider initialized');
  }

  async submitBundle(bundle: SignedBundle, targetBlock: number): Promise<SubmissionResult> {
    if (!this.provider) {
      throw new Error('Flashbots provider not initialized');
    }

    try {
      const signedBundle = await this.provider.signBundle(
        bundle.txs.map((tx) => ({ signedTransaction: tx }))
      );

      const simulation = await this.provider.simulate(signedBundle, targetBlock);
      
      if ('error' in simulation) {
        return {
          success: false,
          error: simulation.error.message,
          relay: this.name,
        };
      }

      const submission = await this.provider.sendRawBundle(signedBundle, targetBlock);

      return {
        success: true,
        bundleHash: submission.bundleHash,
        relay: this.name,
        inclusionProbability: 0.5, // Placeholder
      };
    } catch (error: any) {
      submissionLogger.error({ error: error.message, relay: this.name }, 'Bundle submission failed');
      return {
        success: false,
        error: error.message,
        relay: this.name,
      };
    }
  }
}

export class EdenRelayClient implements RelayClient {
  name = 'Eden';
  private relayUrl: string;
  private authKey: string;

  constructor(authKey: string, relayUrl?: string) {
    this.authKey = authKey;
    this.relayUrl = relayUrl || process.env.EDEN_RELAY_URL || 'https://api.edennetwork.io/v1/bundle';
  }

  async submitBundle(bundle: SignedBundle, targetBlock: number): Promise<SubmissionResult> {
    try {
      const response = await fetch(this.relayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authKey}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_sendBundle',
          params: [
            {
              txs: bundle.txs,
              blockNumber: `0x${targetBlock.toString(16)}`,
            },
          ],
        }),
      });

      const data = await response.json();

      if (data.error) {
        return {
          success: false,
          error: data.error.message,
          relay: this.name,
        };
      }

      return {
        success: true,
        bundleHash: data.result?.bundleHash,
        relay: this.name,
        inclusionProbability: 0.4,
      };
    } catch (error: any) {
      submissionLogger.error({ error: error.message, relay: this.name }, 'Bundle submission failed');
      return {
        success: false,
        error: error.message,
        relay: this.name,
      };
    }
  }
}

export class MultiRelaySubmitter {
  private relays: RelayClient[] = [];

  constructor(relays?: RelayClient[]) {
    this.relays = relays || [];
  }

  addRelay(relay: RelayClient): void {
    this.relays.push(relay);
    submissionLogger.info({ relay: relay.name }, 'Relay added');
  }

  async submitWithFallback(bundle: SignedBundle, targetBlock: number): Promise<SubmissionResult> {
    if (this.relays.length === 0) {
      throw new Error('No relays configured');
    }

    submissionLogger.info(
      { relayCount: this.relays.length, targetBlock },
      'Submitting bundle to multiple relays'
    );

    const results = await Promise.allSettled(
      this.relays.map((relay) =>
        retry(() => relay.submitBundle(bundle, targetBlock), {
          retries: 2,
          minTimeout: 1000,
        })
      )
    );

    const successful = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<SubmissionResult>).value)
      .filter((r) => r.success);

    if (successful.length === 0) {
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => (r as PromiseRejectedResult).reason?.message || 'Unknown error');

      submissionLogger.error({ errors }, 'All relays rejected bundle');
      
      return {
        success: false,
        error: `All relays rejected: ${errors.join(', ')}`,
        relay: 'multi',
      };
    }

    // Return best result (highest inclusion probability)
    const best = this.selectBestSubmission(successful);
    
    submissionLogger.info(
      {
        successfulRelays: successful.length,
        selectedRelay: best.relay,
        bundleHash: best.bundleHash,
      },
      'Bundle submitted successfully'
    );

    return best;
  }

  private selectBestSubmission(submissions: SubmissionResult[]): SubmissionResult {
    return submissions.reduce((best, current) => {
      if (!best.inclusionProbability || !current.inclusionProbability) {
        return best;
      }
      return current.inclusionProbability > best.inclusionProbability ? current : best;
    });
  }

  getRelays(): RelayClient[] {
    return this.relays;
  }
}
