import { ClassifiedTx, Opportunity, Bundle, ProfitEstimate } from '../types';
import { ForkHandle } from '../types';
import { strategyLogger } from '../utils/logger';

export interface Strategy {
  name: string;
  description: string;
  isLegal: boolean;
  detect: (txs: ClassifiedTx[]) => Promise<Opportunity | null>;
  buildBundle: (opportunity: Opportunity) => Promise<Bundle>;
  estimateProfit: (bundle: Bundle, fork: ForkHandle) => Promise<ProfitEstimate>;
}

export class EthicsViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EthicsViolationError';
  }
}

export class StrategyRegistry {
  private strategies: Map<string, Strategy> = new Map();
  private simulationOnly: boolean;

  constructor(simulationOnly?: boolean) {
    this.simulationOnly = simulationOnly ?? process.env.SIMULATION_ONLY === 'true';
  }

  register(strategy: Strategy): void {
    if (!strategy.isLegal && !this.simulationOnly) {
      throw new EthicsViolationError(
        `Cannot register unethical strategy ${strategy.name} in production mode`
      );
    }

    this.strategies.set(strategy.name, strategy);
    strategyLogger.info(
      { strategy: strategy.name, isLegal: strategy.isLegal },
      'Strategy registered'
    );
  }

  unregister(strategyName: string): boolean {
    const removed = this.strategies.delete(strategyName);
    if (removed) {
      strategyLogger.info({ strategy: strategyName }, 'Strategy unregistered');
    }
    return removed;
  }

  getStrategy(name: string): Strategy | undefined {
    return this.strategies.get(name);
  }

  getAllStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  getLegalStrategies(): Strategy[] {
    return Array.from(this.strategies.values()).filter((s) => s.isLegal);
  }

  async executeLegalStrategies(txs: ClassifiedTx[]): Promise<Opportunity[]> {
    const legalStrats = this.getLegalStrategies();

    if (legalStrats.length === 0) {
      strategyLogger.warn('No legal strategies registered');
      return [];
    }

    strategyLogger.info(
      { strategyCount: legalStrats.length, txCount: txs.length },
      'Executing legal strategies'
    );

    const opportunities = await Promise.allSettled(
      legalStrats.map(async (strat) => {
        try {
          const startTime = Date.now();
          const opportunity = await strat.detect(txs);
          const latency = Date.now() - startTime;

          if (opportunity) {
            strategyLogger.info(
              {
                strategy: strat.name,
                profit: opportunity.expectedProfitUSD,
                latency,
              },
              'Opportunity detected'
            );
          }

          return opportunity;
        } catch (error: any) {
          strategyLogger.error(
            { strategy: strat.name, error: error.message },
            'Strategy execution failed'
          );
          return null;
        }
      })
    );

    const validOpportunities = opportunities
      .filter((result) => result.status === 'fulfilled' && result.value !== null)
      .map((result) => (result as PromiseFulfilledResult<Opportunity | null>).value!)
      .filter(Boolean);

    strategyLogger.info(
      { opportunitiesFound: validOpportunities.length },
      'Strategy execution complete'
    );

    return validOpportunities;
  }

  validateStrategyExecution(strategy: Strategy): boolean {
    if (!strategy.isLegal && !this.simulationOnly) {
      throw new EthicsViolationError(
        `Cannot execute unethical strategy ${strategy.name} in production mode`
      );
    }

    // Additional validation logic can be added here
    return true;
  }

  isSimulationOnly(): boolean {
    return this.simulationOnly;
  }

  setSimulationMode(simulationOnly: boolean): void {
    this.simulationOnly = simulationOnly;
    strategyLogger.info({ simulationOnly }, 'Simulation mode updated');

    // Unregister unethical strategies if switching to production
    if (!simulationOnly) {
      const unethicalStrategies = Array.from(this.strategies.values()).filter(
        (s) => !s.isLegal
      );
      unethicalStrategies.forEach((s) => this.unregister(s.name));
    }
  }
}
