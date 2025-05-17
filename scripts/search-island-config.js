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
      } else if (message.type === 'optimize-island') {
        // Handle request to optimize a specific island
        optimizeIsland(message.data);
      }
    });

    // Function to optimize a single island and report results back
    async function optimizeIsland(params) {
      try {
        const { island, fixedIslands, phase, totalPhases, searchParams } = params;

        // Create list of all islands for this optimization (base island + fixed islands + current island)
        const currentIslands = [searchParams.baseIsland];
        if (fixedIslands && fixedIslands.length > 0) {
          currentIslands.push(...fixedIslands);
        }
        
        // Get set of all island IDs in the current configuration
        const islandIds = new Set([
          searchParams.baseIsland.id, 
          ...fixedIslands.map(i => i.id),
          island.id
        ]);
        
        // Filter conjunction targets to only include those relevant to the current set of islands
        const relevantTargets = searchParams.conjunctionTargets.filter(target => 
          islandIds.has(target.island1Id) && islandIds.has(target.island2Id));
          
        console.log(`Worker ${workerData.workerId}: Optimizing island "${island.name}" with ${relevantTargets.length} relevant conjunction targets`);

        // Create search instance for this phase
        const search = new IslandConfigSearch({
          baseIsland: searchParams.baseIsland,
          epicycleBounds: searchParams.epicycleBounds,
          islandsToConfigure: [island], // Only one island to configure
          conjunctionTargets: relevantTargets, // Only use relevant targets
          analysisParams: searchParams.analysisParams,
          annealingParams: searchParams.annealingParams
        });

        // Add previously configured islands as fixed islands
        if (fixedIslands && fixedIslands.length > 0) {
          search.setFixedIslands(fixedIslands);
        }
        
        // Run the optimization
        const result = await search.optimizeIsland(
          // Progress callback
          (result, iteration, temperature, elapsedMs) => {
            // Send progress updates to the main thread
            parentPort.postMessage({
              type: 'optimization-progress',
              data: {
                workerId: workerData.workerId,
                phase,
                totalPhases,
                currentIsland: island.name,
                result,
                iteration,
                temperature,
                elapsedMs,
                initialTemperature: searchParams.annealingParams?.initialTemperature,
                minTemperature: searchParams.annealingParams?.minTemperature
              }
            });
          },
          // Check if we should exit
          () => shouldExit
        );
        
        // Send the result to the main thread
        parentPort.postMessage({
          type: 'optimization-result',
          data: {
            workerId: workerData.workerId,
            phase,
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
    
    // Signal that the worker is ready
    parentPort.postMessage({
      type: 'worker-ready',
      data: {
        workerId: workerData.workerId
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
  function printPhaseSearchSummary(phase, totalPhases, currentIsland, result, elapsedMs, lastUpdateTime, temperature, initialTemperature, minTemperature) {
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
    const tableBorder = '+----------------+----------------+---------+---------+-----------+---------+-----------+';
    console.log('\nCONJUNCTION RESULTS:');
    console.log(tableBorder);
    console.log('| Island 1       | Island 2       | Max Dur | Max Gap | Target Gap | Avg Gap | Error     |');
    console.log(tableBorder);
    
    // Iterate through targets in config order and find corresponding stats
    for (const target of config.conjunctionTargets) {
      const pairKey = getPairKey(target.island1Id, target.island2Id);
      
      // Find stats for this pair
      let foundStats = null;
      for (const stats of result.stats.values()) {
        const statsPairKey = getPairKey(stats.island1Id, stats.island2Id);
        if (statsPairKey === pairKey) {
          foundStats = stats;
          break;
        }
      }
      
      // Skip if no stats found for this pair
      if (!foundStats) continue;
      
      const island1 = foundStats.island1Name.padEnd(14).substring(0, 14);
      const island2 = foundStats.island2Name.padEnd(14).substring(0, 14);
      
      let maxDur = formatDurationCompact(foundStats.maxConjunctionDuration).padStart(7);
      let maxGap = foundStats.maxTimeBetweenConjunctions !== null ? 
        formatDurationCompact(foundStats.maxTimeBetweenConjunctions).padStart(7) : 
        '   -    ';
      let avgGap = formatDurationCompact(foundStats.avgTimeBetweenConjunctions).padStart(7);
      
      // Get log-ratio error for this pair
      const error = result.errorDetails.errors.get(pairKey) || 0;
      const errorStr = error.toFixed(2).padStart(7);
      
      // Get target gap from configuration
      let targetGap = '   -    ';
      if (target.targetAvgGap !== undefined) {
        targetGap = formatDurationCompact(target.targetAvgGap).padStart(9);
      }
      
      console.log(`| ${island1} | ${island2} | ${maxDur} | ${maxGap} | ${targetGap} | ${avgGap} | ${errorStr}   |`);
    }
    
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
      description: 'Number of worker processes',
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
      let allConfiguredIslands = [config.baseIsland];
      let bestResult = null;
      let shouldExit = false;
      let currentPhase = 0;
      const totalPhases = config.islandsToConfigure.length;
      
      // Track per-worker progress
      let workersReady = 0;
      let workersRunning = 0;
      let phaseResults = new Map(); // Map of workerId -> result for current phase
      let workerProgress = new Map(); // Map of workerId -> {temperature, iteration, etc}
      
      // Track overall progress
      let startTime = Date.now();
      let phaseStartTime = startTime;
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
            await fs.writeFile(outputPath, JSON.stringify(allConfiguredIslands, null, 2), 'utf-8');
            console.log('Configuration saved!');
            
            // Print the island configurations in a more readable format
            console.log('\nIsland Configurations:');
            for (const island of allConfiguredIslands) {
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
        if (updateNeeded && workerProgress.size > 0) {
          const now = Date.now();
          
          // Find the best result so far
          let currentBestResult = null;
          let currentBestScore = Infinity;
          
          for (const [workerId, result] of phaseResults.entries()) {
            if (result && result.score < currentBestScore) {
              currentBestScore = result.score;
              currentBestResult = result;
            }
          }
          
          if (currentBestResult) {
            // Clear console if supported
            if (process.stdout.isTTY) {
              process.stdout.write('\x1Bc');
            }
            
            console.log('\n=== ISLAND CONFIGURATION SEARCH ===\n');
            console.log(`Phase ${currentPhase + 1}/${totalPhases}: Optimizing island "${config.islandsToConfigure[currentPhase].name}"`);
            console.log(`Total elapsed time: ${((now - startTime) / 1000).toFixed(1)} seconds`);
            console.log(`Phase elapsed time: ${((now - phaseStartTime) / 1000).toFixed(1)} seconds`);
            console.log(`Current best score: ${currentBestScore.toFixed(4)}`);
            
            // Show worker status
            console.log('\nWORKER STATUS:');
            const workerTable = '+--------+-----------+----------+------------+';
            console.log(workerTable);
            console.log('| Worker | Progress  | Temp     | Score      |');
            console.log(workerTable);
            
            for (let i = 0; i < numWorkers; i++) {
              const progress = workerProgress.get(i) || {};
              const result = phaseResults.get(i);
              
              // Calculate progress percentage
              let progressPct = 0;
              if (progress.temperature !== undefined && 
                  progress.initialTemperature !== undefined && 
                  progress.minTemperature !== undefined) {
                const logInitial = Math.log(progress.initialTemperature);
                const logMin = Math.log(progress.minTemperature);
                const logCurrent = Math.log(progress.temperature);
                progressPct = ((logInitial - logCurrent) / (logInitial - logMin)) * 100;
                progressPct = Math.min(100, Math.max(0, progressPct));
              }
              
              const tempStr = progress.temperature ? progress.temperature.toFixed(1).padStart(8) : '    -    ';
              const score = result ? result.score.toFixed(4).padStart(10) : '    -    ';
              
              console.log(`| ${String(i).padEnd(6)} | ${progressPct.toFixed(1).padStart(8)}% | ${tempStr} | ${score} |`);
            }
            
            console.log(workerTable);
            
            // Show best result details if available
            if (currentBestResult && currentBestResult.stats) {
              // Render table of target results
              const tableBorder = '+----------------+----------------+---------+---------+------------+---------+-----------+';
              console.log('\nCONJUNCTION RESULTS (BEST SO FAR):');
              console.log(tableBorder);
              console.log('| Island 1       | Island 2       | Max Dur | Max Gap | Target Gap | Avg Gap | Error     |');
              console.log(tableBorder);
              
              // Iterate through targets in config order and find corresponding stats
              for (const target of config.conjunctionTargets) {
                const pairKey = getPairKey(target.island1Id, target.island2Id);
                
                // Find stats for this pair
                let foundStats = null;
                for (const stats of currentBestResult.stats.values()) {
                  const statsPairKey = getPairKey(stats.island1Id, stats.island2Id);
                  if (statsPairKey === pairKey) {
                    foundStats = stats;
                    break;
                  }
                }
                
                // Skip if no stats found for this pair
                if (!foundStats) continue;
                
                const island1 = foundStats.island1Name.padEnd(14).substring(0, 14);
                const island2 = foundStats.island2Name.padEnd(14).substring(0, 14);
                
                let maxDur = formatDurationCompact(foundStats.maxConjunctionDuration).padStart(7);
                let maxGap = foundStats.maxTimeBetweenConjunctions !== null ? 
                  formatDurationCompact(foundStats.maxTimeBetweenConjunctions).padStart(7) : 
                  '   -    ';
                let avgGap = formatDurationCompact(foundStats.avgTimeBetweenConjunctions).padStart(7);
                
                // Get log-ratio error for this pair
                const error = currentBestResult.errorDetails.errors.get(pairKey) || 0;
                const errorStr = error.toFixed(2).padStart(7);
                
                // Get target gap from configuration
                let targetGap = '   -    ';
                if (target.targetAvgGap !== undefined) {
                  targetGap = formatDurationCompact(target.targetAvgGap).padStart(10);
                }
                
                console.log(`| ${island1} | ${island2} | ${maxDur} | ${maxGap} | ${targetGap} | ${avgGap} | ${errorStr}   |`);
              }
              
              console.log(tableBorder);
            }
            
            // Show islands configured so far
            console.log('\nCONFIGURED ISLANDS:');
            for (const island of allConfiguredIslands) {
              console.log(`- ${island.name}:`);
              if (island.cycles) {
                for (const cycle of island.cycles) {
                  console.log(`  * Period: ${cycle.period.toFixed(2)} days`);
                }
              }
            }
            
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
      
      // Create worker threads
      const workers = [];
      
      // Function to start the next phase
      async function startNextPhase() {
        if (currentPhase >= totalPhases) {
          // All phases complete, save final result
          clearInterval(updateInterval);
          
          console.log(`\nSearch completed. Saving configuration to ${outputPath}...`);
          await fs.writeFile(outputPath, JSON.stringify(allConfiguredIslands, null, 2), 'utf-8');
          console.log('Configuration saved!');
          
          // Print the island configurations in a more readable format
          console.log('\nFinal Island Configurations:');
          for (const island of allConfiguredIslands) {
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
        
        // Reset phase tracking
        phaseStartTime = Date.now();
        phaseResults.clear();
        workerProgress.clear();
        workersRunning = numWorkers;
        
        const currentIsland = config.islandsToConfigure[currentPhase];
        console.log(`\nStarting Phase ${currentPhase + 1}/${totalPhases}: Optimizing island "${currentIsland.name}"`);
        
        // Create fixed islands array (skip the base island which is already included in the search)
        const fixedIslands = allConfiguredIslands.slice(1);
        
        // Create set of island IDs in the current configuration
        const islandIds = new Set([
          config.baseIsland.id, 
          ...fixedIslands.map(i => i.id),
          currentIsland.id
        ]);
        
        // Filter conjunction targets to only include those relevant to the current set of islands
        const relevantTargets = config.conjunctionTargets.filter(target => 
          islandIds.has(target.island1Id) && islandIds.has(target.island2Id));
        
        console.log(`Using ${relevantTargets.length} conjunction targets for this phase`);
        
        // Start the workers for this phase
        for (let i = 0; i < numWorkers; i++) {
          workers[i].postMessage({
            type: 'optimize-island',
            data: {
              island: currentIsland,
              fixedIslands: fixedIslands,
              phase: currentPhase + 1,
              totalPhases: totalPhases,
              searchParams: {
                baseIsland: config.baseIsland,
                epicycleBounds: config.epicycleBounds,
                conjunctionTargets: config.conjunctionTargets, // We'll let the worker filter these
                analysisParams: config.analysisParams || {
                  simulationDays: 3650,
                  timeStepDays: 30
                },
                annealingParams: {
                  ...config.annealingParams,
                  // Use different random seeds for different workers
                  randomSeed: (config.annealingParams?.randomSeed || 0) + i
                }
              }
            }
          });
        }
        
        updateNeeded = true;
        updateDisplay();
      }
      
      // Function to complete the current phase
      function completePhase() {
        // Find the best result from all workers
        let bestPhaseResult = null;
        let bestPhaseScore = Infinity;
        
        for (const [workerId, result] of phaseResults.entries()) {
          if (result && result.score < bestPhaseScore) {
            bestPhaseScore = result.score;
            bestPhaseResult = result;
          }
        }
        
        if (bestPhaseResult) {
          // Get the configured island from the best result
          const configuredIsland = bestPhaseResult.islands[bestPhaseResult.islands.length - 1];
          
          // Add to our list of configured islands
          allConfiguredIslands.push(configuredIsland);
          bestResult = bestPhaseResult;
          
          console.log(`\nCompleted Phase ${currentPhase + 1}/${totalPhases}`);
          console.log(`Added island "${configuredIsland.name}" with score ${bestPhaseScore.toFixed(4)}`);
          
          // Move to next phase
          currentPhase++;
          startNextPhase();
        } else {
          console.error('No valid result found for this phase');
          process.exit(1);
        }
      }
      
      // Function to handle worker message
      const handleWorkerMessage = async (message, workerId) => {
        if (message.type === 'worker-ready') {
          workersReady++;
          
          // Start the first phase when all workers are ready
          if (workersReady === numWorkers) {
            startNextPhase();
          }
        } else if (message.type === 'optimization-progress') {
          const { phase, result, temperature, initialTemperature, minTemperature } = message.data;
          
          // Update progress tracking for this worker
          workerProgress.set(workerId, {
            temperature,
            initialTemperature,
            minTemperature
          });
          
          // Update current result if better than previous
          const currentResult = phaseResults.get(workerId);
          if (!currentResult || result.score < currentResult.score) {
            phaseResults.set(workerId, result);
          }
          
          // Trigger display update
          updateNeeded = true;
          updateDisplay();
        } else if (message.type === 'optimization-result') {
          const { result } = message.data;
          
          // Store final result for this worker
          phaseResults.set(workerId, result);
          
          // Mark this worker as complete
          workersRunning--;
          
          // If all workers are done with this phase, move to the next
          if (workersRunning === 0) {
            completePhase();
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
            workerId: i
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