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
function printConjunctionStats(stats) {
  // Print overall summary
  console.log('\n=== CONJUNCTION ANALYSIS SUMMARY ===\n');
  console.log(`Analyzed ${stats.size} island pairs\n`);
  
  // Sort pairs by number of conjunctions (most frequent first)
  const sortedPairs = Array.from(stats.values())
    .sort((a, b) => b.totalConjunctions - a.totalConjunctions);
  
  // Create ASCII table with abbreviated column headers
  const tableBorder = '+----------------+----------------+---------+---------+----------+---------+---------+---------+---------+';
  console.log(tableBorder);
  console.log('| Island 1       | Island 2       | Avg Dur | Max Dur | Avg Dist | Min Dist | Min Gap | Max Gap | Avg Gap |');
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
    let minGap = '   -    ';
    let maxGap = '   -    ';
    
    if (pairStats.totalConjunctions > 0) {
      // Format values for conjunctions
      avgDur = formatDurationCompact(pairStats.avgConjunctionDuration).padStart(7);
      maxDur = formatDurationCompact(pairStats.maxConjunctionDuration).padStart(7);
      avgDist = formatDistanceCompact(pairStats.avgMinDistance).padStart(8);
      minDist = formatDistanceCompact(pairStats.minMinDistance).padStart(7);
      avgGap = formatDurationCompact(pairStats.avgTimeBetweenConjunctions).padStart(7);
      
      if (pairStats.minTimeBetweenConjunctions !== null) {
        minGap = formatDurationCompact(pairStats.minTimeBetweenConjunctions).padStart(7);
      }
      
      if (pairStats.maxTimeBetweenConjunctions !== null) {
        maxGap = formatDurationCompact(pairStats.maxTimeBetweenConjunctions).padStart(7);
      }
    }
    
    console.log(`| ${island1} | ${island2} | ${avgDur} | ${maxDur} | ${avgDist} | ${minDist} | ${minGap} | ${maxGap} | ${avgGap} |`);
  });
  
  console.log(tableBorder);
  
  // Add a legend explaining abbreviations
  console.log('\nLEGEND:');
  console.log('Avg Dur  = Average duration of conjunctions');
  console.log('Max Dur  = Maximum duration of conjunctions');
  console.log('Avg Dist = Average minimum distance during conjunctions (miles)');
  console.log('Min Dist = Minimum distance recorded during any conjunction (miles)');
  console.log('Min Gap  = Minimum time between consecutive conjunctions');
  console.log('Max Gap  = Maximum time between consecutive conjunctions');
  console.log('Avg Gap  = Average time between conjunctions, considering full simulation timespan');
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
    printConjunctionStats(conjunctionStats);
    
  } catch (error) {
    console.error('Error analyzing conjunctions:', error);
  }
}

// Run the analysis
analyzeConjunctions(argv.config, argv.start, argv.duration); 