#!/usr/bin/env node

// We need to tell TypeScript how to resolve the module paths
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    esModuleInterop: true,
  }
});

// Import Island type and ConjunctionAnalyzer
const SkydriftArchipelagoSimulator = require('../src/utils/sim').default;
const ConjunctionAnalyzer = require('../src/utils/conjunctionAnalyzer').default;
const { formatTime, parseTimeString, formatDuration } = require('../src/utils/timeFormat');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Function to format a duration in days to a human-readable string
function formatDurationLocal(days) {
  if (days < 1) {
    return `${Math.round(days * 24)} hours`;
  } else if (days < 30) {
    return `${days.toFixed(1)} days`;
  } else if (days < 365) {
    return `${(days / 30).toFixed(1)} months`;
  } else {
    return `${(days / 365).toFixed(1)} years`;
  }
}

// Function to format a distance in miles
function formatDistance(miles) {
  return `${miles.toFixed(1)} miles`;
}

// Function to print conjunction stats in a readable format
function printConjunctionStats(stats, islands) {
  // Print overall summary
  console.log('\n=== CONJUNCTION ANALYSIS SUMMARY ===\n');
  console.log(`Analyzed ${stats.size} island pairs\n`);
  
  // Sort pairs by island IDs
  const sortedPairs = Array.from(stats.values())
    .sort((a, b) => {
      // Compare first islands by ID
      if (a.island1Id !== b.island1Id) return a.island1Id - b.island1Id;
      
      // If first islands have the same ID, compare second islands by ID
      return a.island2Id - b.island2Id;
    });
  
  // Create ASCII table with abbreviated column headers
  const tableBorder = '+----------------+----------------+----------+----------+---------+---------+---------+---------+';
  console.log(tableBorder);
  console.log('| Island 1       | Island 2       | Min Dist | Avg Dist | Avg Dur | Max Dur | Avg Gap | Max Gap |');
  console.log(tableBorder);
  
  // Print each pair as a row in the table
  sortedPairs.forEach(pairStats => {
    const island1 = pairStats.island1Name.padEnd(14).substring(0, 14);
    const island2 = pairStats.island2Name.padEnd(14).substring(0, 14);
    
    // Default values when no conjunctions
    let avgDur = '   -    ';
    let maxDur = '   -    ';
    let avgDist = '    -    ';
    let minDist = '    -    ';
    let avgGap = '   -    ';
    let maxGap = '   -    ';
    
    if (pairStats.totalConjunctions > 0) {
      // Format values for conjunctions
      minDist = formatDistanceCompact(pairStats.minMinDistance).padStart(8);
      avgDist = formatDistanceCompact(pairStats.avgMinDistance).padStart(8);
      avgDur = formatDurationCompact(pairStats.avgConjunctionDuration).padStart(7);
      maxDur = formatDurationCompact(pairStats.maxConjunctionDuration).padStart(7);
      avgGap = formatDurationCompact(pairStats.avgTimeBetweenConjunctions).padStart(7);
      
      if (pairStats.maxTimeBetweenConjunctions !== null) {
        maxGap = formatDurationCompact(pairStats.maxTimeBetweenConjunctions).padStart(7);
      }
    }
    
    console.log(`| ${island1} | ${island2} | ${minDist} | ${avgDist} | ${avgDur} | ${maxDur} | ${avgGap} | ${maxGap} |`);
  });
  
  console.log(tableBorder);
  
  // Add a legend explaining abbreviations
  console.log('\nLEGEND:');
  console.log('Min Dist = Minimum distance recorded during any conjunction (miles)');
  console.log('Avg Dist = Average minimum distance during conjunctions (miles)');
  console.log('Avg Dur  = Average duration of conjunctions');
  console.log('Max Dur  = Maximum duration of conjunctions');
  console.log('Avg Gap  = Average time between conjunctions, considering full simulation timespan');
  console.log('Max Gap  = Maximum time between consecutive conjunctions');

  // Print per-island conjunction statistics
  printPerIslandConjunctionStats(stats, islands);
}

// Function to print how often each island has a conjunction with any other island
function printPerIslandConjunctionStats(stats, islands) {
  // Create a map to store per-island stats
  const islandStats = new Map();
  
  // First pass: collect all conjunction times for each island
  Array.from(stats.values()).forEach(pairStats => {
    // Only process pairs with conjunctions
    if (pairStats.totalConjunctions === 0 || !pairStats.allConjunctions) {
      return;
    }
    
    // Initialize island stats if needed
    if (!islandStats.has(pairStats.island1Name)) {
      islandStats.set(pairStats.island1Name, {
        id: pairStats.island1Id,
        name: pairStats.island1Name,
        totalConjunctions: 0,
        uniquePartners: new Set(),
        conjunctionTimes: []
      });
    }
    
    if (!islandStats.has(pairStats.island2Name)) {
      islandStats.set(pairStats.island2Name, {
        id: pairStats.island2Id,
        name: pairStats.island2Name,
        totalConjunctions: 0,
        uniquePartners: new Set(),
        conjunctionTimes: []
      });
    }
    
    const island1Stats = islandStats.get(pairStats.island1Name);
    const island2Stats = islandStats.get(pairStats.island2Name);
    
    // Add conjunction data
    island1Stats.totalConjunctions += pairStats.totalConjunctions;
    island1Stats.uniquePartners.add(pairStats.island2Name);
    
    island2Stats.totalConjunctions += pairStats.totalConjunctions;
    island2Stats.uniquePartners.add(pairStats.island1Name);
    
    // Add all conjunction start times to both islands
    pairStats.allConjunctions.forEach(conjunction => {
      island1Stats.conjunctionTimes.push(conjunction.startTime);
      island2Stats.conjunctionTimes.push(conjunction.startTime);
    });
  });
  
  // Second pass: calculate statistics based on all conjunction times
  islandStats.forEach(islandStat => {
    // Sort conjunction times chronologically
    islandStat.conjunctionTimes.sort((a, b) => a - b);
    
    // Calculate gaps between conjunctions
    const gaps = [];
    for (let i = 1; i < islandStat.conjunctionTimes.length; i++) {
      const gap = (islandStat.conjunctionTimes[i] - islandStat.conjunctionTimes[i-1]) / 1000; // Convert ms to days
      gaps.push(gap);
    }
    
    // Calculate gap statistics
    if (gaps.length > 0) {
      islandStat.avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
      islandStat.maxGap = Math.max(...gaps);
    } else {
      islandStat.avgGap = 0;
      islandStat.maxGap = 0;
    }
  });
  
  // Sort islands by their IDs directly
  const sortedIslands = Array.from(islandStats.values())
    .sort((a, b) => a.id - b.id);
  
  // Print per-island table
  console.log('\n\n=== PER-ISLAND CONJUNCTION SUMMARY ===\n');
  
  // Create ASCII table for per-island stats
  const islandTableBorder = '+----------------+-----------+---------+---------+------------+';
  console.log(islandTableBorder);
  console.log('| Island Name    | Total Conj | Avg Gap | Max Gap | Partners  |');
  console.log(islandTableBorder);
  
  sortedIslands.forEach(islandStat => {
    const islandName = islandStat.name.padEnd(14).substring(0, 14);
    const totalConjunctions = `${islandStat.totalConjunctions}`.padStart(9);
    const partnerCount = `${islandStat.uniquePartners.size}`.padStart(10);
    
    // Format gap values
    let avgGap = '   -    ';
    let maxGap = '   -    ';
    
    if (islandStat.totalConjunctions > 1) {
      avgGap = formatDurationCompact(islandStat.avgGap).padStart(7);
      maxGap = formatDurationCompact(islandStat.maxGap).padStart(7);
    }
    
    console.log(`| ${islandName} | ${totalConjunctions} | ${avgGap} | ${maxGap} | ${partnerCount} |`);
  });
  
  console.log(islandTableBorder);
  console.log('\nLEGEND:');
  console.log('Total Conj = Total number of conjunctions with any other island');
  console.log('Avg Gap    = Average time between consecutive conjunctions with any island');
  console.log('Max Gap    = Maximum time between consecutive conjunctions with any island');
  console.log('Partners   = Number of unique islands this island has conjunctions with');
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

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to island configuration file',
    default: path.join(__dirname, '..', 'src', 'data', 'defaultIslands.json')
  })
  .option('start', {
    alias: 's',
    type: 'string',
    description: 'Start date in yyyy-mm-dd format (optional hours suffix)',
    default: '0000-01-01'
  })
  .option('duration', {
    alias: 'd',
    type: 'number',
    description: 'Simulation duration in days',
    default: 36500
  })
  .help()
  .alias('help', 'h')
  .argv;

// Main function to analyze conjunctions
async function analyzeConjunctions(configPath, startDate, durationDays) {
  try {
    // Read and parse the island configuration
    const configData = await fs.promises.readFile(configPath, 'utf-8');
    const islands = JSON.parse(configData);
    
    console.log(`Loaded ${islands.length} islands from ${path.basename(configPath)}`);
    
    // Parse start date
    const startTimeMs = parseTimeString(startDate);
    if (startTimeMs === null) {
      console.error(`Invalid start date format: ${startDate}`);
      console.error('Expected format: yyyy-mm-dd [h]h');
      process.exit(1);
    }
    
    // Initialize the analyzer
    const analyzer = new ConjunctionAnalyzer(islands);
    
    // Fixed timestep of 30 days
    const timeStepDays = 30;
    
    console.log(`Start time: ${formatTime(startTimeMs)}`);
    console.log(`Duration: ${formatDuration(durationDays)} (${durationDays.toFixed(0)} days)`);
    console.log(`Time step: ${formatDuration(timeStepDays)} (${timeStepDays.toFixed(0)} days)`);
    
    // Run the analysis
    console.log('Analyzing conjunctions...');
    const startTime = Date.now();
    
    const conjunctionStats = analyzer.analyzeConjunctions({
      simulationDays: durationDays,
      timeStepDays: timeStepDays,
      startTimeMs: startTimeMs
    });
    
    const endTime = Date.now();
    console.log(`Analysis completed in ${((endTime - startTime) / 1000).toFixed(1)} seconds`);
    
    // Print the results
    printConjunctionStats(conjunctionStats, islands);
    
  } catch (error) {
    console.error('Error analyzing conjunctions:', error);
  }
}

// Run the analysis
analyzeConjunctions(argv.config, argv.start, argv.duration); 