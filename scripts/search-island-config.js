#!/usr/bin/env node

// We need to tell TypeScript how to resolve the module paths
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    esModuleInterop: true,
  }
});

// Import required modules
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const IslandConfigSearch = require('../src/utils/islandConfigSearch').default;
const fs = require('fs').promises;
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const os = require('os');

// If this is a worker thread, run the worker code
if (!isMainThread) {
  runWorker();
} else {
  // Otherwise run the main thread code
  runMain();
}

// Worker thread function
async function runWorker() {
  try {
    // Initialize variables
    let shouldExit = false;
    
    // Listen for messages from the main thread
    parentPort.on('message', (message) => {
      if (message.type === 'exit') {
        shouldExit = true;
      }
    });
    
    // Create search instance for incremental search
    const search = new IslandConfigSearch({
      ...workerData.searchParams,
      // Ensure we're using the worker-specific random seed
      annealingParams: {
        ...workerData.searchParams.annealingParams,
        randomSeed: workerData.searchParams.annealingParams?.randomSeed
      }
    });
    
    const result = await search.searchIncremental(
      // Progress callback
      (phase, totalPhases, currentIsland, result, iteration, temperature, elapsedMs) => {
        // Send progress updates to the main thread
        parentPort.postMessage({
          type: 'incremental-progress',
          data: {
            workerId: workerData.workerId,
            phase,
            totalPhases,
            currentIsland,
            result,
            iteration,
            temperature,
            elapsedMs,
            initialTemperature: workerData.searchParams.annealingParams?.initialTemperature,
            minTemperature: workerData.searchParams.annealingParams?.minTemperature
          }
        });
      },
      // Check if we should exit
      () => shouldExit
    );
    
    // Send the final result to the main thread
    parentPort.postMessage({
      type: 'result',
      data: {
        workerId: workerData.workerId,
        result
      }
    });
  } catch (error) {
    // Send any errors to the main thread
    parentPort.postMessage({
      type: 'error',
      data: {
        workerId: workerData.workerId,
        error: error.message,
        stack: error.stack
      }
    });
  }
}

// Main thread function
async function runMain() {
  // Function to print incremental search progress
  function printIncrementalSearchSummary(phase, totalPhases, currentIsland, result, elapsedMs, lastUpdateTime, temperature, initialTemperature, minTemperature) {
    // Clear console if supported
    if (process.stdout.isTTY) {
      process.stdout.write('\x1Bc');
    }
    
    // Calculate progress percentage based on temperature
    let progressPct = 0;
    if (temperature !== undefined && initialTemperature !== undefined && minTemperature !== undefined) {
      // Calculate logarithmic progress percentage
      // When temperature = initialTemperature, progress = 0%
      // When temperature = minTemperature, progress = 100%
      const logInitial = Math.log(initialTemperature);
      const logMin = Math.log(minTemperature);
      const logCurrent = Math.log(temperature);
      progressPct = ((logInitial - logCurrent) / (logInitial - logMin)) * 100;
      progressPct = Math.min(100, Math.max(0, progressPct)); // Clamp between 0-100
    }
    
    // Create a progress bar
    const barWidth = 30;
    const completeChars = Math.floor((progressPct / 100) * barWidth);
    const progressBar = '█'.repeat(completeChars) + '░'.repeat(barWidth - completeChars);
    
    console.log('\n=== ISLAND CONFIGURATION SEARCH ===\n');
    console.log(`Phase: ${phase}/${totalPhases} - Optimizing island "${currentIsland}"`);
    console.log(`Progress: [${progressBar}] ${progressPct.toFixed(1)}%`);
    if (temperature !== undefined) {
      console.log(`Temperature: ${temperature.toFixed(2)}`);
    }
    console.log(`Elapsed time: ${(elapsedMs / 1000).toFixed(1)} seconds`);
    console.log(`Current best score: ${result.score.toFixed(4)}`);
    
    // Render table of target results
    const tableBorder = '+----------------+----------------+----------+----------+---------+---------+-----------+';
    console.log('\nCONJUNCTION RESULTS:');
    console.log(tableBorder);
    console.log('| Island 1       | Island 2       | Avg Dist | Max Dur | Avg Gap | Max Gap | Error (%) |');
    console.log(tableBorder);
    
    // Print each pair as a row in the table
    const pairs = Array.from(result.stats.values());
    // Filter to only include pairs that are in the conjunctionTargets
    pairs.filter(pairStats => {
      const pairKey = getPairKey(pairStats.island1Id, pairStats.island2Id);
      return result.errorDetails.errors.has(pairKey);
    }).forEach(pairStats => {
      const island1 = pairStats.island1Name.padEnd(14).substring(0, 14);
      const island2 = pairStats.island2Name.padEnd(14).substring(0, 14);
      
      let avgDist = formatDistanceCompact(pairStats.avgMinDistance).padStart(8);
      let maxDur = formatDurationCompact(pairStats.maxConjunctionDuration).padStart(7);
      let avgGap = formatDurationCompact(pairStats.avgTimeBetweenConjunctions).padStart(7);
      let maxGap = pairStats.maxTimeBetweenConjunctions !== null ? 
        formatDurationCompact(pairStats.maxTimeBetweenConjunctions).padStart(7) : 
        '   -    ';
      
      // Get error percentage for this pair
      const pairKey = getPairKey(pairStats.island1Id, pairStats.island2Id);
      const error = result.errorDetails.errors.get(pairKey) || 0;
      const errorStr = error.toFixed(2).padStart(7);
      
      console.log(`| ${island1} | ${island2} | ${avgDist} | ${maxDur} | ${avgGap} | ${maxGap} | ${errorStr}% |`);
    });
    
    console.log(tableBorder);
    
    // Show time since last update
    const timeSinceUpdate = Math.floor((Date.now() - lastUpdateTime) / 1000);
    console.log(`\nLast update: ${timeSinceUpdate} seconds ago`);
    console.log('Press Ctrl+C to stop and save the current best configuration');
  }

  // Compact formatting functions for the table
  function formatDurationCompact(days) {
    if (days < 1) {
      return `${Math.round(days * 24)}h`;
    } else if (days < 30) {
      return `${days.toFixed(1)}d`;
    } else if (days < 365) {
      return `${(days / 30).toFixed(1)}m`;
    } else {
      return `${(days / 365).toFixed(1)}y`;
    }
  }

  function formatDistanceCompact(miles) {
    return `${miles.toFixed(1)}mi`;
  }

  // Create a unique key for an island pair (order doesn't matter)
  function getPairKey(island1Id, island2Id) {
    return island1Id < island2Id ? 
      `${island1Id}-${island2Id}` : 
      `${island2Id}-${island1Id}`;
  }

  // Parse command line arguments
  const argv = yargs(hideBin(process.argv))
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'Path to search configuration file',
      demandOption: true
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      description: 'Path to output file for best result',
      default: 'best-island-config.json'
    })
    .option('workers', {
      alias: 'w',
      type: 'number',
      description: 'Number of worker processes (only relevant for parallel search)',
      default: 1
    })
    .option('update-interval', {
      alias: 'u',
      type: 'number',
      description: 'Progress update interval in seconds',
      default: 2
    })
    .help()
    .alias('help', 'h')
    .argv;

  // Flag to track if we've already handled Ctrl+C
  let sigintHandled = false;

  // Main function to run the search
  async function searchIslandConfig(configPath, outputPath, updateIntervalSecs, numWorkers) {
    try {
      // Read and parse the search configuration
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      // Use the number of CPUs as default if not specified
      numWorkers = numWorkers || Math.max(1, os.cpus().length - 1);
      
      console.log(`Loaded search configuration from ${path.basename(configPath)}`);
      console.log(`Running with ${numWorkers} worker threads in parallel`);
      
      // Setup variables for tracking
      let bestResult = null;
      let shouldExit = false;
      let workersRunning = 0;
      let workersCompleted = 0;
      let currentPhases = new Map(); // Map of workerId -> phase
      let totalPhases = config.islandsToConfigure.length;
      let currentIslands = new Map(); // Map of workerId -> islandName
      let workerResults = new Map(); // Map of workerId -> result
      
      // Track progress
      let startTime = Date.now();
      let lastUpdateTime = startTime;
      let updateNeeded = false;
      
      // Improved SIGINT handler with immediate exit capability
      process.on('SIGINT', async () => {
        // Prevent handler from being called multiple times
        if (sigintHandled) {
          console.log('\nForce exiting...');
          process.exit(1);
        }
        
        sigintHandled = true;
        console.log('\nReceived SIGINT (Ctrl+C). Stopping search...');
        shouldExit = true;
        
        // Signal all workers to exit
        for (let i = 0; i < numWorkers; i++) {
          try {
            workers[i].postMessage({ type: 'exit' });
          } catch (error) {
            // Worker might already be gone, ignore
          }
        }
        
        // Wait for best result to be saved
        if (bestResult) {
          try {
            console.log(`\nSaving current configuration to ${outputPath}...`);
            await fs.writeFile(outputPath, JSON.stringify(bestResult.islands, null, 2), 'utf-8');
            console.log('Configuration saved!');
            
            // Print the island configurations in a more readable format
            console.log('\nIsland Configurations:');
            for (const island of bestResult.islands) {
              console.log(`- ${island.name}:`);
              if (island.cycles) {
                for (const cycle of island.cycles) {
                  console.log(`  * Period: ${cycle.period.toFixed(2)} days`);
                }
              } else {
                console.log('  * No cycles configured yet');
              }
            }
          } catch (error) {
            console.error('Error saving results:', error);
          }
        } else {
          console.log('No valid results to save.');
        }
        
        // Force exit after a short delay if we're still running
        setTimeout(() => {
          console.log('Exiting...');
          process.exit(0);
        }, 500);
      });
      
      // Function to update the display showing progress from all workers
      function updateDisplay() {
        if (updateNeeded && workerResults.size > 0) {
          const now = Date.now();
          
          // Find the best result among all workers
          let currentBestResult = null;
          let currentBestScore = Infinity;
          let highestPhase = 0;
          
          for (const [workerId, result] of workerResults.entries()) {
            const workerPhase = currentPhases.get(workerId) || 0;
            
            // First prioritize the highest phase
            if (workerPhase > highestPhase) {
              highestPhase = workerPhase;
              currentBestResult = result;
              currentBestScore = result.score;
            } 
            // If in the same highest phase, compare scores
            else if (workerPhase === highestPhase && result && result.score < currentBestScore) {
              currentBestResult = result;
              currentBestScore = result.score;
            }
          }
          
          if (currentBestResult) {
            bestResult = currentBestResult;
            
            // Clear console if supported
            if (process.stdout.isTTY) {
              process.stdout.write('\x1Bc');
            }
            
            console.log('\n=== ISLAND CONFIGURATION SEARCH ===\n');
            console.log(`Running ${workersRunning} workers in parallel (${workersCompleted} completed)`);
            console.log(`Elapsed time: ${((now - startTime) / 1000).toFixed(1)} seconds`);
            console.log(`Current best score: ${bestResult.score.toFixed(4)}`);
            
            // Show worker status
            console.log('\nWORKER STATUS:');
            const workerTable = '+--------+----------------+----------+----------+';
            console.log(workerTable);
            console.log('| Worker | Current Island | Progress | Score    |');
            console.log(workerTable);
            
            for (let i = 0; i < numWorkers; i++) {
              const phase = currentPhases.get(i) || 0;
              const island = currentIslands.get(i) || 'Not started';
              const result = workerResults.get(i);
              
              // Calculate progress percentage
              let progressPct = 0;
              if (result && result.temperature !== undefined && 
                  result.annealingParams?.initialTemperature !== undefined && 
                  result.annealingParams?.minTemperature !== undefined) {
                const logInitial = Math.log(result.annealingParams.initialTemperature);
                const logMin = Math.log(result.annealingParams.minTemperature);
                const logCurrent = Math.log(result.temperature);
                progressPct = ((logInitial - logCurrent) / (logInitial - logMin)) * 100;
                progressPct = Math.min(100, Math.max(0, progressPct));
              }
              
              const score = result ? result.score.toFixed(4) : '-';
              
              console.log(`| ${String(i).padEnd(6)} | ${island.padEnd(14).substring(0, 14)} | ${progressPct.toFixed(1).padStart(7)}% | ${String(score).padStart(8)} |`);
            }
            
            console.log(workerTable);
            
            // Render table of target results for the best configuration
            const tableBorder = '+----------------+----------------+----------+---------+---------+---------+-----------+';
            console.log('\nCONJUNCTION RESULTS (BEST CONFIGURATION):');
            console.log(tableBorder);
            console.log('| Island 1       | Island 2       | Avg Dist | Max Dur | Avg Gap | Max Gap | Error (%) |');
            console.log(tableBorder);
            
            // Print each pair as a row in the table
            const pairs = Array.from(bestResult.stats.values());
            // Filter to only include pairs that are in the conjunctionTargets
            pairs.filter(pairStats => {
              const pairKey = getPairKey(pairStats.island1Id, pairStats.island2Id);
              return bestResult.errorDetails.errors.has(pairKey);
            }).forEach(pairStats => {
              const island1 = pairStats.island1Name.padEnd(14).substring(0, 14);
              const island2 = pairStats.island2Name.padEnd(14).substring(0, 14);
              
              let avgDist = formatDistanceCompact(pairStats.avgMinDistance).padStart(8);
              let maxDur = formatDurationCompact(pairStats.maxConjunctionDuration).padStart(7);
              let avgGap = formatDurationCompact(pairStats.avgTimeBetweenConjunctions).padStart(7);
              let maxGap = pairStats.maxTimeBetweenConjunctions !== null ? 
                formatDurationCompact(pairStats.maxTimeBetweenConjunctions).padStart(7) : 
                '   -    ';
              
              // Get error percentage for this pair
              const pairKey = getPairKey(pairStats.island1Id, pairStats.island2Id);
              const error = bestResult.errorDetails.errors.get(pairKey) || 0;
              const errorStr = error.toFixed(2).padStart(8);
              
              console.log(`| ${island1} | ${island2} | ${avgDist} | ${maxDur} | ${avgGap} | ${maxGap} | ${errorStr}% |`);
            });
            
            console.log(tableBorder);
                
            // Show time since last update
            const timeSinceUpdate = Math.floor((Date.now() - lastUpdateTime) / 1000);
            console.log(`\nLast update: ${timeSinceUpdate} seconds ago`);
            console.log('Press Ctrl+C to stop and save the current best configuration');
          }
          
          lastUpdateTime = now;
          updateNeeded = false;
        }
      }
      
      // Set up a periodic update
      const updateInterval = setInterval(() => {
        updateNeeded = true;
        updateDisplay();
      }, updateIntervalSecs * 1000);
      
      // Create worker threads for parallel search
      const workers = [];
      
      // Function to handle worker message
      const handleWorkerMessage = async (message, workerId) => {
        if (message.type === 'incremental-progress') {
          const { phase, totalPhases: receivedTotalPhases, currentIsland: islandName, result, temperature } = message.data;
          
          // Update progress tracking for this worker
          currentPhases.set(workerId, phase);
          currentIslands.set(workerId, islandName);
          
          // Store worker's current result
          const workerResult = { ...result };
          workerResult.temperature = temperature;
          workerResult.annealingParams = {
            initialTemperature: message.data.initialTemperature,
            minTemperature: message.data.minTemperature
          };
          workerResults.set(workerId, workerResult);
          
          // Trigger display update
          updateNeeded = true;
          updateDisplay();
          
          // If a worker found a better result, update the best result
          const workerPhase = currentPhases.get(workerId) || 0;
          const currentHighestPhase = bestResult ? (bestResult.currentPhase || 0) : 0;
          
          // First prioritize by phase, then by score within the same phase
          if (!bestResult || 
              workerPhase > currentHighestPhase || 
              (workerPhase === currentHighestPhase && result.score < bestResult.score)) {
            // Clone result and add phase information
            bestResult = { ...workerResult, currentPhase: workerPhase };
          }
        } else if (message.type === 'result') {
          const { result } = message.data;
          workerResults.set(workerId, result);
          
          // Check if this is the best result
          const workerPhase = currentPhases.get(workerId) || 0;
          const currentHighestPhase = bestResult ? (bestResult.currentPhase || 0) : 0;
          
          // First prioritize by phase, then by score within the same phase
          if (!bestResult || 
              workerPhase > currentHighestPhase || 
              (workerPhase === currentHighestPhase && result.score < bestResult.score)) {
            // Clone result and add phase information
            bestResult = { ...result, currentPhase: workerPhase };
          }
          
          // Mark this worker as completed
          workersCompleted++;
          workersRunning--;
          
          // If all workers have completed, save the result and exit
          if (workersRunning === 0) {
            // Clean up
            clearInterval(updateInterval);
            
            // Save final result
            console.log(`\nSearch completed. Saving configuration to ${outputPath}...`);
            await fs.writeFile(outputPath, JSON.stringify(bestResult.islands, null, 2), 'utf-8');
            console.log('Configuration saved!');
            
            // Print the island configurations in a more readable format
            console.log('\nFinal Island Configurations:');
            for (const island of bestResult.islands) {
              console.log(`- ${island.name}:`);
              if (island.cycles) {
                for (const cycle of island.cycles) {
                  console.log(`  * Period: ${cycle.period.toFixed(2)} days`);
                }
              }
            }
            
            // Exit
            process.exit(0);
          }
        } else if (message.type === 'error') {
          console.error(`Worker ${workerId} error:`, message.data.error);
          
          // Mark this worker as failed
          workersRunning--;
          
          // If all workers have failed, exit
          if (workersRunning === 0) {
            console.error('All workers have failed. Exiting.');
            process.exit(1);
          }
        }
      };
      
      // Start worker threads
      for (let i = 0; i < numWorkers; i++) {
        const worker = new Worker(__filename, {
          workerData: {
            workerId: i,
            searchParams: {
              baseIsland: config.baseIsland,
              epicycleBounds: config.epicycleBounds,
              islandsToConfigure: config.islandsToConfigure,
              conjunctionTargets: config.conjunctionTargets,
              analysisParams: config.analysisParams || {
                simulationDays: 3650, // 10 years by default
                timeStepDays: 30      // Process in 1-month chunks
              },
              annealingParams: {
                ...config.annealingParams,
                // Use different random seeds for different workers
                randomSeed: (config.annealingParams?.randomSeed || 0) + i
              }
            }
          }
        });
        
        // Set up message handler for this worker
        worker.on('message', (message) => handleWorkerMessage(message, i));
        
        // Handle worker termination
        worker.on('error', (error) => {
          console.error(`Worker ${i} crashed:`, error);
          workersRunning--;
        });
        
        // Handle worker exit
        worker.on('exit', (code) => {
          if (code !== 0 && !shouldExit) {
            console.error(`Worker ${i} exited with code ${code}`);
            workersRunning--;
          }
        });
        
        workers.push(worker);
        workersRunning++;
      }
      
    } catch (error) {
      console.error('Error running island configuration search:', error);
      process.exit(1);
    }
  }

  // Run the search
  searchIslandConfig(
    argv.config, 
    argv.output, 
    argv['update-interval'],
    argv.workers
  ).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
} 