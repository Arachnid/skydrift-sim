import SkydriftArchipelagoSimulator, { Island, Conjunction } from './sim';

/**
 * Statistics about conjunctions between a pair of islands
 */
export interface ConjunctionStats {
  island1Id: number;
  island2Id: number;
  island1Name: string;
  island2Name: string;
  totalConjunctions: number;
  avgConjunctionDuration: number;
  minConjunctionDuration: number;
  maxConjunctionDuration: number;
  avgTimeBetweenConjunctions: number;
  minTimeBetweenConjunctions: number | null;
  maxTimeBetweenConjunctions: number | null;
  avgMinDistance: number;
  minMinDistance: number;
  conjunctionTimes: number[]; // timestamps of conjunction start times
  allConjunctions: Conjunction[]; // all conjunctions found
}

/**
 * Parameters for conjunction analysis
 */
export interface AnalysisParams {
  simulationDays: number;
  timeStepDays: number;
  startTimeMs?: number; // Optional start time in milliseconds
}

/**
 * A class that analyzes island conjunctions over an extended period
 */
export default class ConjunctionAnalyzer {
  private simulator: SkydriftArchipelagoSimulator;
  private islands: Island[];
  
  /**
   * Create a new conjunction analyzer
   * @param islands The islands to analyze
   */
  constructor(islands: Island[]) {
    this.islands = [...islands];
    this.simulator = new SkydriftArchipelagoSimulator(this.islands);
  }
  
  /**
   * Run the conjunction analysis for a specified period
   * @param params Analysis parameters
   * @returns Object mapping pairs of island IDs to their conjunction statistics
   */
  public analyzeConjunctions(params: AnalysisParams = { 
    simulationDays: 3650, // 10 years by default
    timeStepDays: 365     // Process in 1-year chunks
  }): Map<string, ConjunctionStats> {
    // Set the initial simulation time (default to 0 if not specified)
    const startTimeMs = params.startTimeMs || 0;
    this.simulator.setTime(startTimeMs);
    
    // Initialize stats for each island pair
    const stats = new Map<string, ConjunctionStats>();
    
    // Initialize pairs
    for (let i = 0; i < this.islands.length; i++) {
      const island1 = this.islands[i];
      for (let j = i + 1; j < this.islands.length; j++) {
        const island2 = this.islands[j];
        
        // Create a unique key for each pair
        const pairKey = this.getPairKey(island1.id, island2.id);
        
        stats.set(pairKey, {
          island1Id: island1.id,
          island2Id: island2.id,
          island1Name: island1.name,
          island2Name: island2.name,
          totalConjunctions: 0,
          avgConjunctionDuration: 0,
          minConjunctionDuration: Infinity,
          maxConjunctionDuration: 0,
          avgTimeBetweenConjunctions: 0,
          minTimeBetweenConjunctions: null,
          maxTimeBetweenConjunctions: null,
          avgMinDistance: 0,
          minMinDistance: Infinity,
          conjunctionTimes: [],
          allConjunctions: []
        });
      }
    }
    
    // Run the simulation in chunks to avoid memory issues
    const totalTimeMs = params.simulationDays * 1000;
    const chunkSizeMs = params.timeStepDays * 1000;
    const endTimeMs = startTimeMs + totalTimeMs;
    
    // Collect all conjunctions
    const allConjunctions: Conjunction[] = [];
    
    for (let time = startTimeMs; time < endTimeMs; time += chunkSizeMs) {
      this.simulator.setTime(time);
      
      // Calculate conjunctions for the next chunk
      const conjunctions = this.simulator.calculateUpcomingConjunctions(
        params.timeStepDays,
        time
      );
      
      // Add to the accumulating list
      allConjunctions.push(...conjunctions);
    }
    
    // Process all conjunctions
    for (const conjunction of allConjunctions) {
      const pairKey = this.getPairKey(conjunction.island1Id, conjunction.island2Id);
      const pairStats = stats.get(pairKey);
      
      if (pairStats) {
        // Track this conjunction
        pairStats.totalConjunctions++;
        pairStats.allConjunctions.push(conjunction);
        pairStats.conjunctionTimes.push(conjunction.startTime);
        
        // Update min/max/avg duration
        const duration = conjunction.duration;
        pairStats.avgConjunctionDuration = 
          (pairStats.avgConjunctionDuration * (pairStats.totalConjunctions - 1) + duration) / 
          pairStats.totalConjunctions;
          
        pairStats.minConjunctionDuration = Math.min(pairStats.minConjunctionDuration, duration);
        pairStats.maxConjunctionDuration = Math.max(pairStats.maxConjunctionDuration, duration);
        
        // Update min/max/avg minimum distance
        const minDist = conjunction.minDistance;
        pairStats.avgMinDistance = 
          (pairStats.avgMinDistance * (pairStats.totalConjunctions - 1) + minDist) / 
          pairStats.totalConjunctions;
          
        pairStats.minMinDistance = Math.min(pairStats.minMinDistance, minDist);
      }
    }
    
    // Calculate intervals for each pair
    for (const pairStats of Array.from(stats.values())) {
      // Calculate average time between conjunctions using full timespan
      if (pairStats.totalConjunctions > 0) {
        // Sort times if not already sorted
        pairStats.conjunctionTimes.sort((a: number, b: number) => a - b);
        
        // Total simulation timespan in days
        const simTimespan = params.simulationDays;
        
        // Calculate intervals
        const intervals = [];
        
        // First and last conjunction times in days
        const firstConjTime = pairStats.conjunctionTimes[0] / 1000;
        const lastConjTime = pairStats.conjunctionTimes[pairStats.conjunctionTimes.length - 1] / 1000;
        
        // Add the combined "outside" interval (time before first and after last conjunction)
        const outsideInterval = firstConjTime + (simTimespan - lastConjTime);
        if (outsideInterval > 0) {
          intervals.push(outsideInterval);
        }
        
        // Add intervals between conjunctions
        for (let i = 1; i < pairStats.conjunctionTimes.length; i++) {
          const interval = (pairStats.conjunctionTimes[i] - pairStats.conjunctionTimes[i-1]) / 1000;
          intervals.push(interval);
        }
        
        // Calculate average interval
        const totalIntervalTime = intervals.reduce((sum, interval) => sum + interval, 0);
        pairStats.avgTimeBetweenConjunctions = totalIntervalTime / intervals.length;
        
        // Calculate min/max intervals (only between observed conjunctions)
        if (pairStats.totalConjunctions > 1) {
          let minInterval = Infinity;
          let maxInterval = 0;
          
          for (let i = 1; i < pairStats.conjunctionTimes.length; i++) {
            const interval = (pairStats.conjunctionTimes[i] - pairStats.conjunctionTimes[i-1]) / 1000;
            minInterval = Math.min(minInterval, interval);
            maxInterval = Math.max(maxInterval, interval);
          }
          
          pairStats.minTimeBetweenConjunctions = minInterval;
          pairStats.maxTimeBetweenConjunctions = maxInterval;
        } else {
          // Only one conjunction, use the average as both min and max
          pairStats.minTimeBetweenConjunctions = pairStats.avgTimeBetweenConjunctions;
          pairStats.maxTimeBetweenConjunctions = pairStats.avgTimeBetweenConjunctions;
        }
      }
    }
    
    return stats;
  }
  
  /**
   * Create a unique key for an island pair (order doesn't matter)
   */
  private getPairKey(island1Id: number, island2Id: number): string {
    return island1Id < island2Id ? 
      `${island1Id}-${island2Id}` : 
      `${island2Id}-${island1Id}`;
  }
} 