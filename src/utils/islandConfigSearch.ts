import SkydriftArchipelagoSimulator, { Island, Epicycle } from './sim';
import ConjunctionAnalyzer, { ConjunctionStats, AnalysisParams } from './conjunctionAnalyzer';

/**
 * Interface for epicycle bounds
 */
export interface EpicycleBounds {
  minPeriod?: number;
  maxPeriod?: number;
  minProportion?: number;  // Proportion of parent epicycle for minimum period
  maxProportion?: number;  // Proportion of parent epicycle for maximum period
  allowNegative?: boolean; // Whether to allow negative periods (counterclockwise rotation)
}

/**
 * Interface for conjunction target
 */
export interface ConjunctionTarget {
  island1Id: number;
  island2Id: number;
  targetAvgGap?: number; // Target average gap between conjunctions (days)
}

/**
 * Interface for result metrics
 */
export interface ConfigSearchResult {
  islands: Island[];
  score: number;
  stats: Map<string, ConjunctionStats>;
  errorDetails: {
    errors: Map<string, number>;
  };
  temperature?: number;
  initialSearchIndex?: number;  // Which random configuration in the initial phase was selected
  annealingParams?: {
    initialTemperature: number;
    minTemperature: number;
    coolingRate?: number; 
    iterationsPerTemp?: number;
    numInitialConfigs?: number;
  };
}

/**
 * Configuration parameters for the search
 */
export interface ConfigSearchParams {
  baseIsland: Island;          // Starting island with fixed epicycles
  epicycleBounds: EpicycleBounds[]; // Bounds for each epicycle order for new islands
  islandsToConfigure: Island[]; // Islands to configure (without epicycles)
  conjunctionTargets: ConjunctionTarget[]; // Target conjunction criteria
  analysisParams: AnalysisParams; // Parameters for conjunction analysis
  annealingParams?: {
    initialTemperature?: number; // Starting temperature for simulated annealing
    coolingRate?: number;       // Rate at which temperature decreases
    minTemperature?: number;    // Minimum temperature to stop the search
    iterationsPerTemp?: number; // Number of iterations at each temperature
    numInitialConfigs?: number; // Number of random configurations to try before annealing
  };
}

/**
 * Class that searches for island configurations meeting conjunction criteria
 * using an incremental approach - optimizing one island at a time
 */
export default class IslandConfigSearch {
  private baseIsland: Island;
  private epicycleBounds: EpicycleBounds[];
  private islandsToConfigure: Island[];
  private conjunctionTargets: ConjunctionTarget[];
  private analysisParams: AnalysisParams;
  private annealingParams: {
    initialTemperature: number;
    coolingRate: number;
    minTemperature: number;
    iterationsPerTemp: number;
    numInitialConfigs: number;
  };
  private fixedIslands: Island[] = [];
  
  private bestResult: ConfigSearchResult | null = null;
  private currentIteration: number = 0;
  private startTime: number = 0;
  
  /**
   * Create a new island configuration search
   */
  constructor(params: ConfigSearchParams) {
    this.baseIsland = { ...params.baseIsland };
    this.epicycleBounds = [...params.epicycleBounds];
    this.islandsToConfigure = params.islandsToConfigure.map(i => ({ ...i }));
    this.conjunctionTargets = [...params.conjunctionTargets];
    this.analysisParams = { ...params.analysisParams };
    
    // Set default annealing parameters if not provided
    this.annealingParams = {
      initialTemperature: params.annealingParams?.initialTemperature || 1000,
      coolingRate: params.annealingParams?.coolingRate || 0.95,
      minTemperature: params.annealingParams?.minTemperature || 0.1,
      iterationsPerTemp: params.annealingParams?.iterationsPerTemp || 100,
      numInitialConfigs: params.annealingParams?.numInitialConfigs || 10
    };
  }
  
  /**
   * Generate a random configuration for a specific island
   */
  private generateRandomIslandConfig(islandBase: Island): Island {
    const island: Island = { ...islandBase, cycles: [] };
    
    // Generate epicycles based on the bounds
    for (let i = 0; i < this.epicycleBounds.length; i++) {
      const bounds = this.epicycleBounds[i];
      
      // Get actual min/max periods, handling proportional bounds
      let actualMinPeriod: number | undefined;
      let actualMaxPeriod: number | undefined;
      
      // Calculate min period from proportion if available
      if (bounds.minProportion !== undefined) {
        if (i === 0) {
          throw new Error(`Cannot use minProportion for the first epicycle (index 0) as there is no parent`);
        }
        
        // Use immediate parent epicycle (previous index)
        const parentPeriod = Math.abs(island.cycles[i-1].period);
        
        if (!parentPeriod) {
          throw new Error(`Cannot calculate proportional period: Parent epicycle at index ${i-1} has zero period`);
        }
        
        actualMinPeriod = bounds.minProportion * parentPeriod;
      }
      
      // If direct minPeriod is available, compare with proportion-based value and take the larger
      if (bounds.minPeriod !== undefined) {
        actualMinPeriod = actualMinPeriod !== undefined 
          ? Math.max(bounds.minPeriod, actualMinPeriod) 
          : bounds.minPeriod;
      }
      
      if (actualMinPeriod === undefined) {
        throw new Error(`Epicycle bounds at index ${i} must specify either minPeriod or minProportion`);
      }
      
      // Round minimum period up to the nearest integer
      actualMinPeriod = Math.ceil(actualMinPeriod);
      
      // Calculate max period from proportion if available
      if (bounds.maxProportion !== undefined) {
        if (i === 0) {
          throw new Error(`Cannot use maxProportion for the first epicycle (index 0) as there is no parent`);
        }
        
        // Use immediate parent epicycle (previous index)
        const parentPeriod = Math.abs(island.cycles[i-1].period);
        
        if (!parentPeriod) {
          throw new Error(`Cannot calculate proportional period: Parent epicycle at index ${i-1} has zero period`);
        }
        
        actualMaxPeriod = bounds.maxProportion * parentPeriod;
      }
      
      // If direct maxPeriod is available, compare with proportion-based value and take the smaller
      if (bounds.maxPeriod !== undefined) {
        actualMaxPeriod = actualMaxPeriod !== undefined 
          ? Math.min(bounds.maxPeriod, actualMaxPeriod) 
          : bounds.maxPeriod;
      }
      
      if (actualMaxPeriod === undefined) {
        throw new Error(`Epicycle bounds at index ${i} must specify either maxPeriod or maxProportion`);
      }
      
      // Round maximum period down to the nearest integer
      actualMaxPeriod = Math.floor(actualMaxPeriod);
      
      // Ensure min is not greater than max after rounding
      if (actualMinPeriod > actualMaxPeriod) {
        // Adjust max to at least equal min
        actualMaxPeriod = actualMinPeriod;
      }
      
      // Generate a random period within the bounds
      let period: number;
      if (actualMinPeriod === actualMaxPeriod) {
        period = actualMinPeriod;
      } else {
        // Generate random integer between min and max (inclusive)
        period = Math.floor(actualMinPeriod + Math.random() * (actualMaxPeriod - actualMinPeriod + 1));
      }
      
      // Apply negative period if allowed and randomly chosen
      if (bounds.allowNegative && Math.random() < 0.5) {
        period = -period;
      }
      
      island.cycles.push({ period });
    }
    
    return island;
  }
  
  /**
   * Generate a random island configuration including fixed islands
   */
  private generateRandomConfig(): Island[] {
    // Start with the base island
    const islands: Island[] = [this.baseIsland];
    
    // Add all fixed islands
    if (this.fixedIslands.length > 0) {
      islands.push(...this.fixedIslands);
    }
    
    // Generate random configuration for the target island
    // We're only configuring one island at a time
    if (this.islandsToConfigure.length > 0) {
      islands.push(this.generateRandomIslandConfig(this.islandsToConfigure[0]));
    }
    
    return islands;
  }
  
  /**
   * Perturb a configuration, only modifying the last island (the one being configured)
   */
  private perturbConfig(islands: Island[], temperature: number): Island[] {
    const newIslands = JSON.parse(JSON.stringify(islands)) as Island[];
    
    // Only perturb the last island (the one we're configuring)
    if (newIslands.length > 1) {
      const islandIndex = newIslands.length - 1;
      const island = newIslands[islandIndex];
      
      // Perturb each epicycle with some probability
      for (let j = 0; j < island.cycles.length; j++) {
        // Higher temperature = higher chance of perturbation
        if (Math.random() < 0.5 * (temperature / this.annealingParams.initialTemperature)) {
          const bounds = this.epicycleBounds[j];
          const cycle = island.cycles[j];
          
          // Get current sign
          const currentSign = Math.sign(cycle.period);
          
          // Get actual min/max periods, handling proportional bounds
          let actualMinPeriod: number | undefined;
          let actualMaxPeriod: number | undefined;
          
          // Calculate min period from proportion if available
          if (bounds.minProportion !== undefined) {
            if (j === 0) {
              throw new Error(`Cannot use minProportion for the first epicycle (index 0) as there is no parent`);
            }
            
            // Use immediate parent epicycle (previous index)
            const parentPeriod = Math.abs(island.cycles[j-1].period);
            
            if (!parentPeriod) {
              throw new Error(`Cannot calculate proportional period: Parent epicycle at index ${j-1} has zero period`);
            }
            
            actualMinPeriod = bounds.minProportion * parentPeriod;
          }
          
          // If direct minPeriod is available, compare with proportion-based value and take the larger
          if (bounds.minPeriod !== undefined) {
            actualMinPeriod = actualMinPeriod !== undefined 
              ? Math.max(bounds.minPeriod, actualMinPeriod) 
              : bounds.minPeriod;
          }
          
          if (actualMinPeriod === undefined) {
            throw new Error(`Epicycle bounds at index ${j} must specify either minPeriod or minProportion`);
          }
          
          // Round minimum period up to the nearest integer
          actualMinPeriod = Math.ceil(actualMinPeriod);
          
          // Calculate max period from proportion if available
          if (bounds.maxProportion !== undefined) {
            if (j === 0) {
              throw new Error(`Cannot use maxProportion for the first epicycle (index 0) as there is no parent`);
            }
            
            // Use immediate parent epicycle (previous index) 
            const parentPeriod = Math.abs(island.cycles[j-1].period);
            
            if (!parentPeriod) {
              throw new Error(`Cannot calculate proportional period: Parent epicycle at index ${j-1} has zero period`);
            }
            
            actualMaxPeriod = bounds.maxProportion * parentPeriod;
          }
          
          // If direct maxPeriod is available, compare with proportion-based value and take the smaller
          if (bounds.maxPeriod !== undefined) {
            actualMaxPeriod = actualMaxPeriod !== undefined 
              ? Math.min(bounds.maxPeriod, actualMaxPeriod) 
              : bounds.maxPeriod;
          }
          
          if (actualMaxPeriod === undefined) {
            throw new Error(`Epicycle bounds at index ${j} must specify either maxPeriod or maxProportion`);
          }
          
          // Round maximum period down to the nearest integer
          actualMaxPeriod = Math.floor(actualMaxPeriod);
          
          // Ensure min is not greater than max after rounding
          if (actualMinPeriod > actualMaxPeriod) {
            // Adjust max to at least equal min
            actualMaxPeriod = actualMinPeriod;
          }
          
          // For integer period perturbation, use discrete steps based on temperature
          // Higher temperature allows larger random integer adjustments
          const maxIntegerPerturbation = Math.max(1, Math.floor((actualMaxPeriod - actualMinPeriod) * 0.2 * (temperature / this.annealingParams.initialTemperature)));
          const integerPerturbation = Math.floor(Math.random() * (2 * maxIntegerPerturbation + 1)) - maxIntegerPerturbation;
          
          // Calculate new period as an integer
          let newPeriod = Math.abs(cycle.period) + integerPerturbation;
          
          // Keep within bounds
          newPeriod = Math.max(actualMinPeriod, Math.min(actualMaxPeriod, newPeriod));
          
          // Apply sign
          if (bounds.allowNegative && Math.random() < 0.1) {
            // 10% chance to flip direction at higher temperatures
            cycle.period = -currentSign * newPeriod;
          } else {
            cycle.period = currentSign * newPeriod;
          }
        }
      }
    }
    
    return newIslands;
  }
  
  /**
   * Calculate the score for a configuration (lower is better)
   */
  private evaluateConfig(islands: Island[]): ConfigSearchResult {
    // Create a conjunction analyzer with the islands
    const analyzer = new ConjunctionAnalyzer(islands);
    
    // Choose a random start time within a 10,000 year range
    // Each evaluation uses a different random start time to ensure long-term stability
    // Days in 10,000 years = 10,000 * 365 = 3,650,000
    // Converting to milliseconds: 3,650,000 * 1000 = 3,650,000,000
    const randomStartTimeMs = Math.floor(Math.random() * 3650000000);
    
    // Convert conjunction targets to target pairs format
    const targetPairs = this.conjunctionTargets.map(target => ({
      island1Id: target.island1Id,
      island2Id: target.island2Id
    }));
    
    // Run the analysis with random start time while keeping other params
    const analysisParams = {
      ...this.analysisParams,
      startTimeMs: randomStartTimeMs
    };
    
    const stats = analyzer.analyzeConjunctions(analysisParams, targetPairs);
    
    // Calculate error for each conjunction target
    let totalScore = 0;
    
    // Track errors for reporting
    const errors = new Map<string, number>();
    
    // Local function to get pair key
    const getPairKey = (island1Id: number, island2Id: number): string => {
      return island1Id < island2Id ? 
        `${island1Id}-${island2Id}` : 
        `${island2Id}-${island1Id}`;
    };
    
    for (const target of this.conjunctionTargets) {
      // Get the pair key for this target
      const pairKey = getPairKey(target.island1Id, target.island2Id);
      const pairStats = stats.get(pairKey);
      
      if (pairStats) {
        // Check if there are any conjunctions
        if (pairStats.totalConjunctions === 0) {
          // Penalize heavily if no conjunctions were found for this pair
          totalScore += 1000000;
          errors.set(pairKey, 1000000);
          continue;
        }
        
        let pairError = 0;
        
        // Calculate error for average gap as a percentage
        if (target.targetAvgGap !== undefined) {
          // Use log ratio for symmetric error: |log(actual/target)| * 100
          // This treats overestimation and underestimation by the same factor equally
          const ratio = pairStats.avgTimeBetweenConjunctions / target.targetAvgGap;
          const logRatioError = Math.abs(Math.log(ratio)) * 100;
          
          totalScore += logRatioError;
          pairError = logRatioError;
        }
        
        errors.set(pairKey, pairError);
      } else {
        // Penalize heavily if the pair key is not found in stats
        totalScore += 1000000;
        errors.set(pairKey, 1000000);
      }
    }
    
    return {
      islands: JSON.parse(JSON.stringify(islands)),
      score: totalScore,
      stats,
      errorDetails: {
        errors
      }
    };
  }
  
  /**
   * Set fixed islands that will be included in all configurations
   */
  public setFixedIslands(islands: Island[]): void {
    this.fixedIslands = JSON.parse(JSON.stringify(islands));
  }
  
  /**
   * Optimize a single island using simulated annealing
   * @param progressCallback Optional callback for progress reporting
   * @param shouldCancel Optional callback that returns true when optimization should be cancelled
   * @returns The best configuration found
   */
  public optimizeIsland(
    progressCallback?: (result: ConfigSearchResult, iteration: number, temperature: number, elapsedMs: number) => void,
    shouldCancel?: () => boolean
  ): ConfigSearchResult {
    this.startTime = Date.now();
    this.currentIteration = 0;
    
    // Try multiple random starting configurations
    const numInitialConfigs = this.annealingParams.numInitialConfigs;
    let bestStartingConfig: Island[] = [];
    let bestStartingResult: ConfigSearchResult | null = null;
    let initialSearchIndex = 0;
    
    // First phase: explore the configuration space randomly
    for (let i = 0; i < numInitialConfigs; i++) {
      // Generate random configuration
      const randomConfig = this.generateRandomConfig();
      const randomResult = this.evaluateConfig(randomConfig);
      
      // Update best starting configuration if better
      if (!bestStartingResult || randomResult.score < bestStartingResult.score) {
        bestStartingConfig = randomConfig;
        bestStartingResult = randomResult;
        initialSearchIndex = i;
        
        // Report progress
        if (progressCallback) {
          progressCallback(
            {
              ...bestStartingResult,
              initialSearchIndex: i,
              temperature: this.annealingParams.initialTemperature,
              annealingParams: {
                initialTemperature: this.annealingParams.initialTemperature,
                minTemperature: this.annealingParams.minTemperature,
                coolingRate: this.annealingParams.coolingRate,
                iterationsPerTemp: this.annealingParams.iterationsPerTemp,
                numInitialConfigs: this.annealingParams.numInitialConfigs
              }
            },
            i,
            this.annealingParams.initialTemperature,
            Date.now() - this.startTime
          );
        }
      }
      
      // Check for cancellation
      if (shouldCancel && shouldCancel()) {
        return {
          ...bestStartingResult!,
          initialSearchIndex,
          temperature: this.annealingParams.initialTemperature,
          annealingParams: {
            initialTemperature: this.annealingParams.initialTemperature,
            minTemperature: this.annealingParams.minTemperature,
            coolingRate: this.annealingParams.coolingRate,
            iterationsPerTemp: this.annealingParams.iterationsPerTemp,
            numInitialConfigs: this.annealingParams.numInitialConfigs
          }
        };
      }
    }
    
    // Initialize with the best starting configuration
    let currentConfig = bestStartingConfig;
    let currentResult = bestStartingResult!;
    
    // Initialize best result
    this.bestResult = {
      ...currentResult,
      initialSearchIndex,
      temperature: this.annealingParams.initialTemperature,
      annealingParams: {
        initialTemperature: this.annealingParams.initialTemperature,
        minTemperature: this.annealingParams.minTemperature,
        coolingRate: this.annealingParams.coolingRate,
        iterationsPerTemp: this.annealingParams.iterationsPerTemp,
        numInitialConfigs: this.annealingParams.numInitialConfigs
      }
    };
    
    // Initial temperature
    let temperature = this.annealingParams.initialTemperature;
    
    // Main annealing loop
    while (temperature > this.annealingParams.minTemperature) {
      // Perform iterations at this temperature
      for (let i = 0; i < this.annealingParams.iterationsPerTemp; i++) {
        this.currentIteration++;
        
        // Generate a neighboring solution
        const neighborConfig = this.perturbConfig(currentConfig, temperature);
        const neighborResult = this.evaluateConfig(neighborConfig);
        
        // Calculate acceptance probability
        let acceptanceProbability = 1.0;
        if (neighborResult.score > currentResult.score) {
          // If new solution is worse, calculate probability of accepting it
          acceptanceProbability = Math.exp((currentResult.score - neighborResult.score) / temperature);
        }
        
        // Decide whether to accept the new solution
        if (acceptanceProbability > Math.random()) {
          currentConfig = neighborConfig;
          currentResult = neighborResult;
          
          // Update best result if this is better
          if (currentResult.score < this.bestResult.score) {
            // Add temperature and annealing params to the result
            this.bestResult = {
              ...currentResult,
              initialSearchIndex,
              temperature,
              annealingParams: {
                initialTemperature: this.annealingParams.initialTemperature,
                minTemperature: this.annealingParams.minTemperature,
                coolingRate: this.annealingParams.coolingRate,
                iterationsPerTemp: this.annealingParams.iterationsPerTemp,
                numInitialConfigs: this.annealingParams.numInitialConfigs
              }
            };
            
            // Report progress
            if (progressCallback) {
              progressCallback(
                this.bestResult, 
                this.currentIteration, 
                temperature,
                Date.now() - this.startTime
              );
            }
          }
        }
        
        // Check for cancellation
        if (shouldCancel && shouldCancel()) {
          return this.bestResult;
        }
      }
      
      // Cool down
      temperature *= this.annealingParams.coolingRate;
      
      // Report temperature change
      if (progressCallback) {
        progressCallback(
          {
            ...this.bestResult,
            temperature,
            annealingParams: {
              initialTemperature: this.annealingParams.initialTemperature,
              minTemperature: this.annealingParams.minTemperature,
              coolingRate: this.annealingParams.coolingRate,
              iterationsPerTemp: this.annealingParams.iterationsPerTemp,
              numInitialConfigs: this.annealingParams.numInitialConfigs
            }
          }, 
          this.currentIteration, 
          temperature,
          Date.now() - this.startTime
        );
      }
    }
    
    return this.bestResult;
  }

  /**
   * Run an incremental search, optimizing one island at a time
   * @param progressCallback Optional callback for progress reporting
   * @param shouldCancel Optional callback that returns true when search should be cancelled
   * @returns The best configuration found
   */
  public searchIncremental(
    progressCallback?: (phase: number, 
                       totalPhases: number, 
                       currentIsland: string, 
                       result: ConfigSearchResult, 
                       iteration: number, 
                       temperature: number, 
                       elapsedMs: number) => void,
    shouldCancel?: () => boolean
  ): ConfigSearchResult {
    // Start with just the base island
    let currentIslands: Island[] = [{ ...this.baseIsland }];
    const totalPhases = this.islandsToConfigure.length;
    let startTime = Date.now();
    
    // For each island in order
    for (let phase = 0; phase < totalPhases; phase++) {
      const currentIsland = this.islandsToConfigure[phase];
      const currentIslandName = currentIsland.name;
      
      console.log(`\nPhase ${phase + 1}/${totalPhases}: Optimizing island "${currentIslandName}"`);
      
      // Filter conjunction targets to only include those relevant to the current set of islands
      const islandIds = new Set([...currentIslands.map(i => i.id), currentIsland.id]);
      const relevantTargets = this.conjunctionTargets.filter(target => 
        islandIds.has(target.island1Id) && islandIds.has(target.island2Id));
      
      // Create a search instance for just this island
      const searchParams: ConfigSearchParams = {
        baseIsland: this.baseIsland,
        epicycleBounds: this.epicycleBounds,
        islandsToConfigure: [currentIsland],
        conjunctionTargets: relevantTargets,
        analysisParams: this.analysisParams,
        annealingParams: this.annealingParams
      };
      
      // Create search instance for this phase
      const search = new IslandConfigSearch(searchParams);
      
      // Add all previously configured islands as fixed islands
      if (phase > 0) {
        const fixedIslands = currentIslands.slice(1); // Skip the base island
        search.setFixedIslands(fixedIslands);
      }
      
      // Run the optimization with a progress wrapper
      const phaseResult = search.optimizeIsland(
        (result, iteration, temperature, elapsedMs) => {
          if (progressCallback) {
            // Add annealing parameters to the result for progress tracking
            const resultWithParams = {
              ...result,
              temperature,
              annealingParams: search.annealingParams
            };
            
            progressCallback(
              phase + 1,
              totalPhases,
              currentIslandName,
              resultWithParams,
              iteration,
              temperature,
              elapsedMs
            );
          }
        },
        shouldCancel
      );
      
      // If the search was cancelled, return the current best result
      if (shouldCancel && shouldCancel()) {
        return phaseResult;
      }
      
      // Update the current islands with the result
      currentIslands = phaseResult.islands;
      
      console.log(`Completed optimization for "${currentIslandName}"`);
    }
    
    // Perform final evaluation of the complete configuration
    // Create a conjunction analyzer with all islands
    const analyzer = new ConjunctionAnalyzer(currentIslands);
    const analysisParams = {
      ...this.analysisParams
    };
    
    // Convert conjunction targets to target pairs format
    const targetPairs = this.conjunctionTargets.map(target => ({
      island1Id: target.island1Id,
      island2Id: target.island2Id
    }));
    
    const stats = analyzer.analyzeConjunctions(analysisParams, targetPairs);
    
    // Calculate error for each conjunction target
    let totalScore = 0;
    
    // Track errors for reporting
    const errors = new Map<string, number>();
    
    // Local function to get pair key
    const getPairKey = (island1Id: number, island2Id: number): string => {
      return island1Id < island2Id ? 
        `${island1Id}-${island2Id}` : 
        `${island2Id}-${island1Id}`;
    };
    
    for (const target of this.conjunctionTargets) {
      // Get the pair key for this target
      const pairKey = getPairKey(target.island1Id, target.island2Id);
      const pairStats = stats.get(pairKey);
      
      if (pairStats) {
        // Check if there are any conjunctions
        if (pairStats.totalConjunctions === 0) {
          // Penalize heavily if no conjunctions were found for this pair
          totalScore += 1000000;
          errors.set(pairKey, 1000000);
          continue;
        }
        
        let pairError = 0;
        
        // Calculate error for average gap as a percentage
        if (target.targetAvgGap !== undefined) {
          // Use log ratio for symmetric error: |log(actual/target)| * 100
          // This treats overestimation and underestimation by the same factor equally
          const ratio = pairStats.avgTimeBetweenConjunctions / target.targetAvgGap;
          const logRatioError = Math.abs(Math.log(ratio)) * 100;
          
          totalScore += logRatioError;
          pairError = logRatioError;
        }
        
        errors.set(pairKey, pairError);
      } else {
        // Penalize heavily if the pair key is not found in stats
        totalScore += 1000000;
        errors.set(pairKey, 1000000);
      }
    }
    
    return {
      islands: currentIslands,
      score: totalScore,
      stats,
      errorDetails: {
        errors
      }
    };
  }
} 