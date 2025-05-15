# Skydrift Archipelago Simulator

This project simulates the orbital movements of floating islands in the Skydrift Archipelago fantasy world. It allows users to visualize how islands move in epicycles and predict conjunctions between them.

## Features

- Create and manage floating islands with custom properties
- Visualize island movements through epicycle orbits
- Track island positions over time with trails
- Jump forward and backward in time to observe orbital patterns
- Adjust simulation speed and visual settings
- Plan journeys between islands

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Start the development server:
```bash
npm start
```

## Usage

### Adding Islands

1. Enter a name for your island
2. (Optional) Select a custom color
3. Configure the epicycle periods (in days)
4. Click "Add Island"

### Controlling the Simulation

- Use the Play/Pause button to control the simulation
- Adjust the speed slider to change simulation speed
- Use the time jump buttons to move forward or backward in time
- Toggle "Show Orbits" and "Show Trails" to customize the visualization

### Editing Islands

1. Click the "Edit" button on an island card
2. Modify the island properties
3. Click "Update Island" to save changes

## Technical Details

The simulation uses epicycles (circles on circles) to create complex orbital patterns. Each island can have multiple epicycles with different periods, creating realistic and varied movements.

The position of each island is calculated using:
- Kepler's third law to determine orbital radius from period
- Epicyclic motion equations for complex orbital patterns
- Time-based animation for smooth visualization

## License

This project is licensed under the MIT License - see the LICENSE file for details.
