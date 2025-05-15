// Define types for our data structures
export interface Epicycle {
  period: number;
}

export interface Island {
  id: number;
  name: string;
  color: string;
  radius: number;
  cycles: Epicycle[];
  visible: boolean;
}

export interface Position {
  x: number;
  y: number;
  time?: number;
}

// Add Journey interface
export interface Journey {
  sourceId: number;
  destinationId: number;
  speed: number; // mph
  path: Position[];
  distance: number;
  duration: number; // in days
  arrivalTime: number; // simulation time of arrival
  isClockwise: boolean;
}

// Velocity interface
export interface Velocity {
  speed: number;
  angle: number;
  x: number;
  y: number;
}

// Orbital position interface
export interface OrbitalPosition {
  dayInCycle: number;
  percentage: number;
}

export default class SkydriftArchipelagoSimulator {
  // Fixed scaling constant for internal coordinates (miles)
  // Set so that a period of 365 days has an orbital radius of 672 miles
  private readonly MILES_SCALE_FACTOR = 672 / Math.pow(365, 2/3);
  
  private islands: Island[] = [];
  private time: number = 0;
  private centerX: number = 400;
  private centerY: number = 400;

  constructor(islands: Island[] = []) {
    this.islands = [...islands];
  }
  
  // Get all islands
  getIslands(): Island[] {
    return [...this.islands];
  }
  
  // Set islands
  setIslands(islands: Island[]): void {
    this.islands = [...islands];
  }
  
  // Add an island
  addIsland(island: Island): void {
    this.islands.push({...island});
  }
  
  // Update an island
  updateIsland(island: Island): void {
    const index = this.islands.findIndex(i => i.id === island.id);
    if (index !== -1) {
      this.islands[index] = {...island};
    }
  }
  
  // Delete an island
  deleteIsland(islandId: number): void {
    this.islands = this.islands.filter(island => island.id !== islandId);
  }
  
  // Toggle island visibility
  toggleIslandVisibility(islandId: number): void {
    const island = this.islands.find(i => i.id === islandId);
    if (island) {
      island.visible = !island.visible;
    }
  }
  
  // Set time
  setTime(time: number): void {
    this.time = time;
  }
  
  // Get time
  getTime(): number {
    return this.time;
  }
  
  // Set center coordinates
  setCenter(x: number, y: number): void {
    this.centerX = x;
    this.centerY = y;
  }
  
  // Get center coordinates
  getCenter(): {x: number, y: number} {
    return {x: this.centerX, y: this.centerY};
  }
  
  // Calculate radius in miles using Kepler's third law and our fixed scale factor
  calculateMilesRadius(period: number): number {
    // r ∝ T^(2/3) where T is the period
    // Using our fixed scale factor to convert to miles
    // Use absolute value for radius calculation, but keep sign for direction
    return Math.pow(Math.abs(period), 2/3) * this.MILES_SCALE_FACTOR;
  }
  
  // Calculate radius for rendering (pixels)
  calculateRenderRadius(period: number): number {
    // We're removing the viewport scaling from the simulator
    // But we still need this method for backward compatibility
    // The component should apply its own scaling to the result
    return this.calculateMilesRadius(period);
  }
  
  // Calculate island position based on epicycles and time
  calculatePosition(island: Island, t: number = this.time, level: number = -1): Position {
    let x = 0;
    let y = 0;
    
    // Apply each epicycle up to the specified level (or all if level is -1)
    const cycleLimit = level >= 0 ? level + 1 : island.cycles.length;
    
    for (let i = 0; i < cycleLimit && i < island.cycles.length; i++) {
      const cycle = island.cycles[i];
      
      // Calculate radius in miles
      const radius = this.calculateMilesRadius(cycle.period);
      
      // Convert period to angular velocity (speed)
      // period = days for a full orbit (2π radians)
      // angular velocity = 2π / period (radians per day)
      const direction = Math.sign(cycle.period);
      const angularVelocity = direction * (2 * Math.PI) / Math.abs(cycle.period);
      
      // Convert time from milliseconds to days for angle calculation
      const timeInDays = t / 1000;
      
      // Add the epicycle contribution (all islands start at phase 0)
      x += radius * Math.cos(angularVelocity * timeInDays);
      y += radius * Math.sin(angularVelocity * timeInDays);
    }
    
    return { x, y };
  }
  
  // Calculate intermediate positions for all epicycle levels
  calculateAllPositions(island: Island, t: number = this.time): Position[] {
    const positions: Position[] = [];
    
    // Add center position (0,0)
    positions.push({ x: 0, y: 0 });
    
    // Calculate position at each epicycle level
    for (let level = 0; level < island.cycles.length; level++) {
      const position = this.calculatePosition(island, t, level);
      positions.push(position);
    }
    
    return positions;
  }
  
  // Calculate orbit path points
  calculateOrbitPath(island: Island, steps = 100): Position[][] {
    const orbits: Position[][] = [];
    
    // For each epicycle level, calculate a set of orbit points
    for (let cycleLevel = 0; cycleLevel < island.cycles.length; cycleLevel++) {
      const orbitPoints: Position[] = [];
      let basePosition: Position | undefined;
      
      // If this is not the first epicycle, we need the base position where this epicycle is centered
      if (cycleLevel > 0) {
        const allPositions = this.calculateAllPositions(island, this.time);
        basePosition = allPositions[cycleLevel]; // The position where this epicycle is centered
      }
      
      const cycle = island.cycles[cycleLevel];
      
      // Calculate radius in miles, no longer scaling for rendering
      const radius = this.calculateMilesRadius(cycle.period);
      
      const stepSize = 2 * Math.PI / steps;
      
      for (let i = 0; i <= steps; i++) {
        const angle = i * stepSize;
        
        if (cycleLevel === 0) {
          // First level epicycle - centered at origin (0,0) instead of CENTER_X, CENTER_Y
          // Let the component handle the centering and scaling
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          orbitPoints.push({ x, y });
        } else if (basePosition) {
          // Higher level epicycles - centered at the previous level's position
          const x = basePosition.x + radius * Math.cos(angle);
          const y = basePosition.y + radius * Math.sin(angle);
          orbitPoints.push({ x, y });
        }
      }
      
      orbits.push(orbitPoints);
    }
    
    return orbits;
  }
  
  // Calculate distance between two islands at a given time (in miles)
  calculateDistance(island1: Island, island2: Island, t: number = this.time): number {
    const pos1 = this.calculatePosition(island1, t);
    const pos2 = this.calculatePosition(island2, t);
    
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + 
      Math.pow(pos1.y - pos2.y, 2)
    );
  }
  
  // Find minimum distance time using binary search
  findMinimumDistanceTime(
    island1: Island, 
    island2: Island, 
    startTime: number, 
    endTime: number, 
    precision = 1
  ): number {
    // If we've reached our precision, return the midpoint
    if (endTime - startTime <= precision) {
      return (startTime + endTime) / 2;
    }
    
    const midTime1 = startTime + (endTime - startTime) / 3;
    const midTime2 = startTime + 2 * (endTime - startTime) / 3;
    
    const dist1 = this.calculateDistance(island1, island2, midTime1);
    const dist2 = this.calculateDistance(island1, island2, midTime2);
    
    if (dist1 < dist2) {
      return this.findMinimumDistanceTime(island1, island2, startTime, midTime2, precision);
    } else {
      return this.findMinimumDistanceTime(island1, island2, midTime1, endTime, precision);
    }
  }

  // Calculate GCD (Greatest Common Divisor) using Euclidean algorithm
  private gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  }

  // Calculate LCM (Least Common Multiple)
  private lcm(a: number, b: number): number {
    return Math.abs(a * b) / this.gcd(a, b);
  }

  // Calculate the total system period (LCM of all island periods)
  calculateSystemPeriod(): number {
    if (this.islands.length === 0) return 0;
    
    // Get the orbital period for each island
    const periods = this.islands.map(island => this.calculateOrbitalPeriod(island.cycles));
    
    // Calculate the LCM of all periods
    return periods.reduce((acc, period) => this.lcm(acc, period), periods[0]);
  }

  // Calculate orbital period as LCM of all epicycle periods
  calculateOrbitalPeriod(cycles: Epicycle[]): number {
    if (cycles.length === 0) return 0;
    if (cycles.length === 1) return Math.abs(cycles[0].period);
    
    return cycles.reduce((acc, cycle) => this.lcm(acc, Math.abs(cycle.period)), Math.abs(cycles[0].period));
  }

  // Calculate where in the orbital cycle the island currently is
  calculateOrbitalPosition(cycles: Epicycle[], currentTime: number = this.time): OrbitalPosition {
    const orbitalPeriod = this.calculateOrbitalPeriod(cycles);
    
    // Convert time (in ms) to days
    const currentTimeInDays = currentTime / 1000;
    
    // Normalize the time to the range [0, orbitalPeriod)
    // This handles negative time values correctly too
    const normalizedTime = ((currentTimeInDays % orbitalPeriod) + orbitalPeriod) % orbitalPeriod;
    
    // Calculate percentage through the cycle
    const percentage = (normalizedTime / orbitalPeriod) * 100;
    
    return { 
      dayInCycle: normalizedTime, 
      percentage 
    };
  }

  // Calculate velocity vector for an island at a given time
  calculateVelocity(island: Island, t: number = this.time): Velocity {
    let vx = 0;
    let vy = 0;
    
    for (let i = 0; i < island.cycles.length; i++) {
      const cycle = island.cycles[i];
      
      // Calculate radius in miles
      const radius = this.calculateMilesRadius(cycle.period);
      
      // Convert period to angular velocity (speed)
      const direction = Math.sign(cycle.period);
      
      // Angular velocity in radians per day (not millisecond)
      // ω = 2π / T where T is period in days
      const angularVelocityPerDay = direction * (2 * Math.PI) / Math.abs(cycle.period);
      
      // Calculate the current angle for this epicycle
      // We need to convert time (ms) to days for the angle calculation
      const angle = angularVelocityPerDay * (t / 1000);
      
      // Calculate the linear velocity components for this epicycle
      // v = r * ω (miles per day)
      // vx = -r * ω * sin(angle)  (negative because derivative of cos is -sin)
      // vy = r * ω * cos(angle)   (derivative of sin is cos)
      const vxi = -radius * angularVelocityPerDay * Math.sin(angle);
      const vyi = radius * angularVelocityPerDay * Math.cos(angle);
      
      // Sum the velocity components
      vx += vxi;
      vy += vyi;
    }
    
    // Calculate the total speed and angle
    const speed = Math.sqrt(vx * vx + vy * vy);
    
    // Calculate the angle in degrees (0 is east, 90 is north)
    let angle = Math.atan2(vy, vx) * (180 / Math.PI);
    if (angle < 0) angle += 360; // Convert to 0-360 range
    
    return { 
      speed: speed, 
      angle: angle,
      x: vx,
      y: vy
    };
  }

  // Calculate the polar coordinates (r, θ) from cartesian (x, y)
  cartesianToPolar(x: number, y: number): { r: number, theta: number } {
    const r = Math.sqrt(x * x + y * y);
    let theta = Math.atan2(y, x);
    if (theta < 0) theta += 2 * Math.PI; // Convert to [0, 2π] range
    return { r, theta };
  }
  
  // Convert polar coordinates (r, θ) to cartesian (x, y)
  polarToCartesian(r: number, theta: number): { x: number, y: number } {
    return {
      x: r * Math.cos(theta),
      y: r * Math.sin(theta)
    };
  }

  // Normalize angle to be between -π and π
  normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
  
  // Calculate journey between two islands
  calculateJourney(sourceIslandId: number, destinationIslandId: number, journeySpeed: number): Journey | null {
    if (journeySpeed <= 0) {
      return null;
    }
    
    const sourceIsland = this.islands.find(island => island.id === sourceIslandId);
    const destIsland = this.islands.find(island => island.id === destinationIslandId);
    
    if (!sourceIsland || !destIsland) {
      return null;
    }
    
    // Get current positions
    const sourcePos = this.calculatePosition(sourceIsland);
    const sourcePolar = this.cartesianToPolar(sourcePos.x, sourcePos.y);
    
    // Initial estimate: calculate journey based on current destination position
    let destPos = this.calculatePosition(destIsland);
    let destPolar = this.cartesianToPolar(destPos.x, destPos.y);
    
    // Calculate initial distance (straight line in Cartesian)
    let distance = Math.sqrt(
      Math.pow(destPos.x - sourcePos.x, 2) + 
      Math.pow(destPos.y - sourcePos.y, 2)
    );
    
    // Initial duration estimate
    let duration = distance / (journeySpeed * 24); // Convert to days (speed is mph, so mph * 24 = miles per day)
    
    // Iterative approach to find the actual destination position at arrival time
    const MAX_ITERATIONS = 10;
    let iterations = 0;
    let prevDuration = 0;
    
    while (Math.abs(duration - prevDuration) > 0.01 && iterations < MAX_ITERATIONS) {
      // Update previous duration
      prevDuration = duration;
      
      // Calculate destination position at estimated arrival time
      const arrivalTime = this.time + (duration * 1000); // Convert days to milliseconds
      destPos = this.calculatePosition(destIsland, arrivalTime);
      destPolar = this.cartesianToPolar(destPos.x, destPos.y);
      
      // Calculate angular difference (consider both directions)
      let angleDiff = destPolar.theta - sourcePolar.theta;
      angleDiff = this.normalizeAngle(angleDiff);
      
      // Determine if clockwise or counterclockwise is shorter
      const isClockwise = angleDiff > 0;
      const shortestAngleDiff = Math.min(Math.abs(angleDiff), 2 * Math.PI - Math.abs(angleDiff));
      
      // Calculate path length using numerical integration
      const numSegments = 100;
      let totalDistance = 0;
      let prevR = sourcePolar.r;
      let prevTheta = sourcePolar.theta;
      const path: Position[] = [];
      
      // Add starting point
      path.push({
        x: sourcePos.x,
        y: sourcePos.y,
        time: this.time
      });
      
      for (let i = 1; i <= numSegments; i++) {
        const t = i / numSegments;
        
        // Linear interpolation of radius
        const r = sourcePolar.r + t * (destPolar.r - sourcePolar.r);
        
        // Angular interpolation (taking shortest path)
        let theta;
        if (isClockwise) {
          if (angleDiff > 0) {
            theta = sourcePolar.theta + t * angleDiff;
          } else {
            theta = sourcePolar.theta + t * (angleDiff + 2 * Math.PI);
          }
        } else {
          if (angleDiff < 0) {
            theta = sourcePolar.theta + t * angleDiff;
          } else {
            theta = sourcePolar.theta + t * (angleDiff - 2 * Math.PI);
          }
        }
        
        // Calculate segment length
        const dr = r - prevR;
        const dTheta = this.normalizeAngle(theta - prevTheta);
        const segmentLength = Math.sqrt(dr * dr + Math.pow((prevR + r) / 2 * dTheta, 2));
        
        totalDistance += segmentLength;
        prevR = r;
        prevTheta = theta;
        
        // Convert back to Cartesian for the path
        const pos = this.polarToCartesian(r, theta);
        path.push({
          x: pos.x,
          y: pos.y,
          time: this.time + (t * duration * 1000) // Interpolate time along the path
        });
      }
      
      // Update distance and duration
      distance = totalDistance;
      duration = distance / (journeySpeed * 24); // Convert to days (speed is mph, so mph * 24 = miles per day)
      iterations++;
    }
    
    // Create the journey object
    const journey: Journey = {
      sourceId: sourceIslandId,
      destinationId: destinationIslandId,
      speed: journeySpeed,
      path: [],
      distance: distance,
      duration: duration,
      arrivalTime: this.time + (duration * 1000),
      isClockwise: this.normalizeAngle(destPolar.theta - sourcePolar.theta) > 0
    };
    
    // Calculate the final path with more detail
    const numPathPoints = 200;
    const path: Position[] = [];
    
    // Get source and destination positions
    const finalSourcePos = this.calculatePosition(sourceIsland);
    const finalDestPos = this.calculatePosition(destIsland, journey.arrivalTime);
    
    // Convert to polar
    const finalSourcePolar = this.cartesianToPolar(finalSourcePos.x, finalSourcePos.y);
    const finalDestPolar = this.cartesianToPolar(finalDestPos.x, finalDestPos.y);
    
    // Calculate angular difference
    let finalAngleDiff = finalDestPolar.theta - finalSourcePolar.theta;
    finalAngleDiff = this.normalizeAngle(finalAngleDiff);
    
    // Determine direction
    const finalIsClockwise = journey.isClockwise;
    
    // Generate path points
    for (let i = 0; i <= numPathPoints; i++) {
      const t = i / numPathPoints;
      
      // Linear interpolation of radius
      const r = finalSourcePolar.r + t * (finalDestPolar.r - finalSourcePolar.r);
      
      // Angular interpolation (taking shortest path)
      let theta;
      if (finalIsClockwise) {
        if (finalAngleDiff > 0) {
          theta = finalSourcePolar.theta + t * finalAngleDiff;
        } else {
          theta = finalSourcePolar.theta + t * (finalAngleDiff + 2 * Math.PI);
        }
      } else {
        if (finalAngleDiff < 0) {
          theta = finalSourcePolar.theta + t * finalAngleDiff;
        } else {
          theta = finalSourcePolar.theta + t * (finalAngleDiff - 2 * Math.PI);
        }
      }
      
      // Convert back to Cartesian
      const pos = this.polarToCartesian(r, theta);
      path.push({
        x: pos.x,
        y: pos.y,
        time: this.time + (t * duration * 1000)
      });
    }
    
    journey.path = path;
    return journey;
  }
} 