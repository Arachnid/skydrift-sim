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
const SkydriftArchipelagoSimulator = require('../src/utils/sim').default;
const { formatTime } = require('../src/utils/timeFormat');
const fs = require('fs');
const path = require('path');

// Constants for our search
const MIN_YEARS_AFTER_ZERO = 900;
const MIN_YEARS_IN_DAYS = MIN_YEARS_AFTER_ZERO * 365;
const DAYS_BEFORE_CONJUNCTION = 34;
const DAYS_AFTER_FOR_JOURNEY = 9;
const MIN_JOURNEY_DURATION = 2.5; // Minimum acceptable journey duration in days
const MAX_JOURNEY_DURATION = 4.0; // Maximum acceptable journey duration in days
const JOURNEY_SPEED = 8; // mph, a reasonable speed
const MAX_CONJUNCTION_DISTANCE = 5; // miles
const OBSIDIAN_SPIRE_ID = 7;
const SYLVANIS_ID = 2;
const VELVETIA_ID = 6;
const AETHERIA_ID = 1;

// Main function to find a specific time meeting our requirements
async function findSpecificTime() {
  try {
    // Load island configuration
    const configPath = path.join(__dirname, '..', 'src', 'data', 'defaultIslands.json');
    const configData = await fs.promises.readFile(configPath, 'utf-8');
    const islands = JSON.parse(configData);
    
    console.log(`Loaded ${islands.length} islands from config`);
    
    // Create simulator and load islands
    const simulator = new SkydriftArchipelagoSimulator(islands);
    
    // Start time at 900 years (convert to milliseconds for simulator)
    let startTime = MIN_YEARS_IN_DAYS * 1000;
    simulator.setTime(startTime);
    
    // Find the island objects
    const obsidianSpire = islands.find(island => island.id === OBSIDIAN_SPIRE_ID);
    const sylvanis = islands.find(island => island.id === SYLVANIS_ID);
    const velvetia = islands.find(island => island.id === VELVETIA_ID);
    const aetheria = islands.find(island => island.id === AETHERIA_ID);
    
    if (!obsidianSpire || !sylvanis || !velvetia || !aetheria) {
      console.error("Could not find all required islands!");
      process.exit(1);
    }
    
    // Search for conjunctions
    console.log("Searching for close conjunctions between Obsidian Spire and Sylvanis...");
    
    // Look ahead 200 years (should be sufficient to find a good match)
    const LOOK_AHEAD_DAYS = 200 * 365;
    const conjunctions = simulator.calculateUpcomingConjunctions(
      LOOK_AHEAD_DAYS,
      startTime,
      [{ island1Id: OBSIDIAN_SPIRE_ID, island2Id: SYLVANIS_ID }]
    );
    
    let candidateTimes = [];
    
    console.log(`Found ${conjunctions.length} conjunctions to check...`);
    
    // Filter for close conjunctions and sort by distance (closest first)
    const closeConjunctions = conjunctions
      .filter(conj => conj.minDistance < MAX_CONJUNCTION_DISTANCE)
      .sort((a, b) => a.minDistance - b.minDistance);
    
    console.log(`Found ${closeConjunctions.length} close conjunctions (<${MAX_CONJUNCTION_DISTANCE} miles)...`);
    console.log("Sorting conjunctions by minimum distance (closest first)");
    
    // For each conjunction, check 34 days before and calculate journey time
    closeConjunctions.forEach((conj, index) => {
      // Calculate the time 34 days before conjunction
      const candidateTime = conj.startTime - (DAYS_BEFORE_CONJUNCTION * 1000);
      
      // Set simulator to 9 days after candidate time
      const journeyCheckTime = candidateTime + (DAYS_AFTER_FOR_JOURNEY * 1000);
      simulator.setTime(journeyCheckTime);
      
      // Calculate journey from Velvetia to Aetheria
      const journey = simulator.calculateJourney(VELVETIA_ID, AETHERIA_ID, JOURNEY_SPEED, true);
      
      if (journey) {
        console.log(`Checking conjunction ${index + 1}/${closeConjunctions.length}:`);
        console.log(`  Conjunction at: ${formatTime(conj.startTime)}`);
        console.log(`  Candidate time: ${formatTime(candidateTime)}`);
        console.log(`  Journey time: ${journey.duration.toFixed(2)} days (acceptable: ${MIN_JOURNEY_DURATION}-${MAX_JOURNEY_DURATION} days)`);
        console.log(`  Conjunction distance: ${conj.minDistance.toFixed(2)} miles`);
        
        // Add to candidates if journey duration is in the acceptable range
        if (journey.duration >= MIN_JOURNEY_DURATION && journey.duration <= MAX_JOURNEY_DURATION) {
          candidateTimes.push({
            time: candidateTime,
            conjunction: conj,
            journeyDuration: journey.duration
          });
        }
      }
    });
    
    // Sort candidates by conjunction distance (smallest first)
    candidateTimes.sort((a, b) => a.conjunction.minDistance - b.conjunction.minDistance);
    
    // Print the results
    console.log("\n=== RESULTS ===");
    if (candidateTimes.length === 0) {
      console.log("No suitable times found!");
    } else {
      console.log(`Found ${candidateTimes.length} times that match all criteria!`);
      console.log("Sorting results by conjunction distance (closest first)");
      
      candidateTimes.slice(0, 5).forEach((candidate, i) => {
        console.log(`\nCandidate #${i + 1}:`);
        console.log(`Date: ${formatTime(candidate.time)}`);
        console.log(`Years after year 0: ${(candidate.time / (1000 * 365)).toFixed(2)}`);
        console.log(`Journey duration: ${candidate.journeyDuration.toFixed(2)} days`);
        console.log(`Conjunction distance: ${candidate.conjunction.minDistance.toFixed(2)} miles`);
        console.log(`Conjunction start: ${formatTime(candidate.conjunction.startTime)}`);
        console.log(`Minimum distance time: ${formatTime(candidate.conjunction.minDistanceTime)}`);
      });
    }
  } catch (error) {
    console.error('Error finding specific time:', error);
  }
}

// Run the search
findSpecificTime(); 