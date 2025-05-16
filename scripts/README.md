# Skydrift Simulation Scripts

This directory contains utility scripts for the Skydrift archipelago simulation.

## Island Configuration Search

The `search-island-config.js` script uses simulated annealing to find optimal island orbital configurations that match desired conjunction criteria.

### Usage

```bash
node search-island-config.js --config <config-file-path> [options]
```

#### Options

- `--config`, `-c`: Path to the search configuration file (required)
- `--output`, `-o`: Path to save the best result to (default: `best-island-config.json`)
- `--workers`, `-w`: Number of parallel workers (default: number of CPU cores)
- `--update-interval`, `-u`: Progress update interval in seconds (default: 5)
- `--help`, `-h`: Show help

### Configuration File Format

The configuration file should be a JSON file with the following structure:

```json
{
  "baseIsland": {
    "id": 1,
    "name": "Skyward",
    "color": "#3498db",
    "radius": 5,
    "visible": true,
    "cycles": [
      { "period": 365 },
      { "period": 30 }
    ]
  },
  "epicycleBounds": [
    {
      "minPeriod": 300,
      "maxPeriod": 420,
      "allowNegative": true
    },
    {
      "minPeriod": 20,
      "maxPeriod": 60,
      "allowNegative": true
    }
  ],
  "islandsToConfigure": [
    {
      "id": 2,
      "name": "Aetheria",
      "color": "#e74c3c",
      "radius": 4,
      "visible": true,
      "cycles": []
    }
  ],
  "conjunctionTargets": [
    {
      "island1Id": 1,
      "island2Id": 2,
      "targetAvgGap": 30,
      "maxGap": 60,
      "targetMinDistance": 20
    }
  ],
  "analysisParams": {
    "simulationDays": 3650,
    "timeStepDays": 30,
    "startTimeMs": 0
  },
  "annealingParams": {
    "initialTemperature": 1000,
    "coolingRate": 0.95,
    "minTemperature": 0.1,
    "iterationsPerTemp": 100
  },
  "weights": {
    "avgGapWeight": 1.0,
    "maxGapWeight": 2.0,
    "minDistanceWeight": 1.0,
    "durationWeight": 0.5
  }
}
```

#### Configuration Parameters

- `baseIsland`: The base island with fixed epicycles
- `epicycleBounds`: Bounds for each epicycle order for islands to be configured
  - `minPeriod`: Minimum period (days)
  - `maxPeriod`: Maximum period (days)
  - `allowNegative`: Whether to allow negative periods (counterclockwise rotation)
- `islandsToConfigure`: Islands to configure (should have empty `cycles` array)
- `conjunctionTargets`: Target conjunction criteria for pairs of islands
  - `island1Id`: ID of first island
  - `island2Id`: ID of second island
  - `targetAvgGap`: Target average gap between conjunctions (days)
  - `maxGap`: Maximum allowable gap between conjunctions (days)
  - `targetMinDistance`: Target minimum distance during conjunctions (miles)
  - `targetAvgDuration`: Target average duration of conjunctions (days)
- `analysisParams`: Parameters for conjunction analysis
  - `simulationDays`: Duration of simulation (days)
  - `timeStepDays`: Time step for analysis (days)
  - `startTimeMs`: Optional start time (milliseconds)
- `annealingParams`: Parameters for simulated annealing
  - `initialTemperature`: Starting temperature
  - `coolingRate`: Rate at which temperature decreases
  - `minTemperature`: Minimum temperature to stop the search
  - `iterationsPerTemp`: Number of iterations at each temperature
- `weights`: Weights for different error types in the objective function
  - `avgGapWeight`: Weight for average gap errors
  - `maxGapWeight`: Weight for maximum gap errors
  - `minDistanceWeight`: Weight for minimum distance errors
  - `durationWeight`: Weight for duration errors

### Example

A sample configuration file is provided at `sample-config.json`. You can run:

```bash
node search-island-config.js --config sample-config.json --output my-island-config.json
```

The script will run until interrupted with Ctrl+C, and the best configuration will be saved to the specified output file.

### Output

The script will periodically output a summary of the search progress, including:
- Current best score
- Conjunction statistics for each island pair
- Error details for each conjunction target
- Current best island configuration

When the script is interrupted with Ctrl+C, it will save the best configuration to the specified output file. 