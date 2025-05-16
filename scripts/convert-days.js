#!/usr/bin/env node

// We need to tell TypeScript how to resolve the module paths
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    esModuleInterop: true,
  }
});

// Import the timeFormat function
const { formatTime } = require('../src/utils/timeFormat');

// Get the days from command-line arguments
const args = process.argv.slice(2);

if (args.length !== 1) {
  console.error("Usage: npm run convert-days <days>");
  process.exit(1);
}

const days = parseFloat(args[0]);

// Check if the input is a valid number
if (isNaN(days)) {
  console.error("Error: Please provide a valid number of days");
  process.exit(1);
}

// Convert days to milliseconds (as per timeFormat.ts, 1 day = 1000ms)
const milliseconds = days * 1000;

// Format the time
const formattedTime = formatTime(milliseconds);

console.log(`${days} days = ${formattedTime}`); 