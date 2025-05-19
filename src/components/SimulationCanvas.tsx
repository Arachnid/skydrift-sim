import React, { useEffect, useRef } from 'react';
import { Box, styled } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SkydriftArchipelagoSimulator, { Island, Position, Journey, Conjunction } from '../utils/sim';

// Custom styled component for the canvas container
const CanvasContainer = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
  marginTop: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  width: '100%',
  // Fix height to prevent excessive vertical size
  height: 'min(calc(100vh - 350px), 800px)', // Use the smaller of these two values
  minHeight: '400px'
}));

interface SimulationCanvasProps {
  simulator: SkydriftArchipelagoSimulator;
  islands: Island[];
  time: number;
  showOrbits: boolean;
  showTrails: boolean;
  trailLength: number;
  trailTickFrequency?: number;
  journeyTickMarkDays?: number; // Days between journey tick marks
  activeJourney: Journey | null;
  viewportScale: number;
  onResize: (width: number, height: number) => void;
  toggleIslandVisibility: (islandId: number) => void;
  customProps?: {
    printMode?: boolean;
    showLegend?: boolean;
    backgroundColor?: string;
  };
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  simulator,
  islands,
  time,
  showOrbits,
  showTrails,
  trailLength,
  trailTickFrequency = 5,
  journeyTickMarkDays = 1, // Default to 1 day between tick marks
  activeJourney,
  viewportScale,
  onResize,
  toggleIslandVisibility,
  customProps
}) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  // CENTER_X and CENTER_Y are initially 0 and will be set in the resize observer
  const centerXRef = useRef<number>(0);
  const centerYRef = useRef<number>(0);

  // Add a ref to store the legend item positions
  const legendItemPositionsRef = useRef<{ x: number, y: number, width: number, height: number, islandId: number }[]>([]);

  // Set up resize observer for canvas
  useEffect(() => {
    if (canvasContainerRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.contentRect) {
            // Get the container size
            const width = Math.floor(entry.contentRect.width);
            const height = Math.floor(entry.contentRect.height);
            
            // Update state with new dimensions
            onResize(width, height);
            
            // Update center references
            centerXRef.current = width / 2;
            centerYRef.current = height / 2;
          }
        }
      });
      
      resizeObserver.observe(canvasContainerRef.current);
      resizeObserverRef.current = resizeObserver;
    }
    
    return () => {
      if (resizeObserverRef.current && canvasContainerRef.current) {
        resizeObserverRef.current.unobserve(canvasContainerRef.current);
        resizeObserverRef.current.disconnect();
      }
    };
  }, [onResize]);

  // Draw everything on the canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Update canvas dimensions to match container
    canvas.width = canvasContainerRef.current?.clientWidth || 800;
    canvas.height = canvasContainerRef.current?.clientHeight || 800;
    
    // Set simulator center coordinates
    simulator.setCenter(centerXRef.current, centerYRef.current);
    
    // Set simulator time
    simulator.setTime(time);
    
    // Clear canvas with specified background color or default
    ctx.fillStyle = customProps?.backgroundColor || "#fafafa"; // Use custom background color or default MUI background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
        
    // Draw epicycle circles and orbits
    if (showOrbits) {
      // Draw center point
      ctx.fillStyle = theme.palette.text.primary;
      ctx.beginPath();
      ctx.arc(centerXRef.current, centerYRef.current, 4, 0, 2 * Math.PI);
      ctx.fill();

      islands.forEach(island => {
        // Skip if island is not visible
        if (!island.visible) return;
        
        // Draw epicycle circles
        const positions = simulator.calculateAllPositions(island);
        
        ctx.strokeStyle = island.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.2;
        
        // Draw a circle for each epicycle
        for (let i = 0; i < island.cycles.length; i++) {
          const cycle = island.cycles[i];
          const center = positions[i]; // Current center for this epicycle
          
          // Calculate radius in miles, then scale for rendering
          const radius = simulator.calculateRenderRadius(cycle.period) * viewportScale;
          
          ctx.beginPath();
          ctx.arc(center.x * viewportScale + centerXRef.current, center.y * viewportScale + centerYRef.current, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
        
        // Draw epicycle lines (the "arms" of the system)
        ctx.strokeStyle = island.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]); // More refined dashed line style
        
        // Draw lines connecting the epicycle centers
        ctx.beginPath();
        ctx.moveTo(positions[0].x * viewportScale + centerXRef.current, positions[0].y * viewportScale + centerYRef.current);
        
        for (let i = 1; i < positions.length; i++) {
          ctx.lineTo(positions[i].x * viewportScale + centerXRef.current, positions[i].y * viewportScale + centerYRef.current);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.globalAlpha = 1;
      });
    }
    
    // Draw active conjunctions
    drawActiveConjunctions(ctx);
    
    // Draw trails
    if (showTrails) {
      islands.forEach(island => {
        if (island.visible) {
          drawIslandTrail(ctx, island);
        }
      });
    }
    
    // Draw active journeys
    const activeJourneys = simulator.getActiveJourneys();
    activeJourneys.forEach(journey => {
      if (journey.status === 'active') {
        drawActiveJourney(ctx, journey);
      }
    });
    
    // Draw predicted journey path with MUI styling - only if it's actually a prediction
    if (activeJourney && activeJourney.status === 'predicted' && activeJourney.path.length > 1) {
      drawPredictedJourney(ctx, activeJourney);
    }
    
    // Draw islands
    islands.forEach(island => {
      // Skip if island is not visible
      if (!island.visible) return;
      
      const position = simulator.calculatePosition(island);
      
      // Draw island circle with shadow for depth
      ctx.save();
      
      // In print mode, use monochrome styling
      if (customProps?.printMode) {
        // No shadow for cleaner print
        ctx.fillStyle = "#000000"; // Black for print
      } else {
        // Regular styling with shadow effect
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = island.color;
      }
      
      ctx.beginPath();
      ctx.arc(position.x * viewportScale + centerXRef.current, position.y * viewportScale + centerYRef.current, island.radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
      
      // Draw island name with better typography and background
      ctx.font = "500 12px Roboto, Arial, sans-serif"; // MUI typography - medium weight
      
      const nameText = island.name;
      const textWidth = ctx.measureText(nameText).width;
      const nameX = position.x * viewportScale + centerXRef.current + 12;
      const nameY = position.y * viewportScale + centerYRef.current - 8;
      
      // Draw background capsule for label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      const padding = 4;
      const capsuleRadius = 8;
      
      ctx.beginPath();
      ctx.moveTo(nameX - padding + capsuleRadius, nameY - 12);
      ctx.lineTo(nameX + textWidth + padding - capsuleRadius, nameY - 12);
      ctx.arc(nameX + textWidth + padding - capsuleRadius, nameY - 12 + capsuleRadius, capsuleRadius, -Math.PI/2, Math.PI/2);
      ctx.lineTo(nameX - padding + capsuleRadius, nameY + 4);
      ctx.arc(nameX - padding + capsuleRadius, nameY - 12 + capsuleRadius, capsuleRadius, Math.PI/2, -Math.PI/2);
      ctx.fill();
      
      // Draw text
      ctx.fillStyle = "#212121"; // MUI default text color
      ctx.fillText(nameText, nameX, nameY);
    });
    
    // Draw legend
    const shouldShowLegend = customProps?.showLegend !== false;
    if (shouldShowLegend) {
      drawLegend(ctx);
    }
  }, [simulator, islands, time, showOrbits, showTrails, trailLength, activeJourney, viewportScale, theme, customProps]);

  // Helper function to draw active conjunctions
  const drawActiveConjunctions = (ctx: CanvasRenderingContext2D): void => {
    // Get the active conjunctions
    const activeConjunctions = simulator.getActiveConjunctions();
    
    activeConjunctions.forEach(conjunction => {
      const island1 = islands.find(i => i.id === conjunction.island1Id);
      const island2 = islands.find(i => i.id === conjunction.island2Id);
      
      if (island1?.visible && island2?.visible) {
        // Get the current positions of both islands
        const pos1 = simulator.calculatePosition(island1);
        const pos2 = simulator.calculatePosition(island2);
        
        // Draw the conjunction indicator
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#f44336"; // MUI red color for conjunction area
        
        // Draw a circle at the midpoint between the islands
        const midX = (pos1.x + pos2.x) / 2;
        const midY = (pos1.y + pos2.y) / 2;
        
        // Calculate the distance between islands
        const distance = simulator.calculateDistance(island1, island2);
        
        // Draw a circle with a radius proportional to the conjunction threshold
        const conjunctionRadius = simulator.CONJUNCTION_THRESHOLD * viewportScale;
        
        ctx.beginPath();
        ctx.arc(
          midX * viewportScale + centerXRef.current,
          midY * viewportScale + centerYRef.current,
          conjunctionRadius, 0, 2 * Math.PI
        );
        ctx.fill();
        
        // Connect the islands with a line
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = "#f44336"; // MUI red
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(
          pos1.x * viewportScale + centerXRef.current,
          pos1.y * viewportScale + centerYRef.current
        );
        ctx.lineTo(
          pos2.x * viewportScale + centerXRef.current,
          pos2.y * viewportScale + centerYRef.current
        );
        ctx.stroke();
        
        // Draw the minimum distance
        ctx.globalAlpha = 1;
        ctx.font = "bold 12px Roboto, Arial, sans-serif";
        ctx.fillStyle = "#f44336"; // MUI red
        
        const distanceText = `${distance.toFixed(1)} miles`;
        const textWidth = ctx.measureText(distanceText).width;
        
        // Position the text at the midpoint
        const textX = midX * viewportScale + centerXRef.current - textWidth / 2;
        const textY = midY * viewportScale + centerYRef.current - 15;
        
        // Draw text background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        const padding = 4;
        const capsuleRadius = 8;
        
        ctx.beginPath();
        ctx.moveTo(textX - padding + capsuleRadius, textY - 12);
        ctx.lineTo(textX + textWidth + padding - capsuleRadius, textY - 12);
        ctx.arc(textX + textWidth + padding - capsuleRadius, textY - 12 + capsuleRadius, capsuleRadius, -Math.PI/2, Math.PI/2);
        ctx.lineTo(textX - padding + capsuleRadius, textY + 4);
        ctx.arc(textX - padding + capsuleRadius, textY - 12 + capsuleRadius, capsuleRadius, Math.PI/2, -Math.PI/2);
        ctx.fill();
        
        // Draw text
        ctx.fillStyle = "#f44336";
        ctx.fillText(distanceText, textX, textY);
      }
    });
    
    ctx.globalAlpha = 1;
  };

  // Helper function to draw the trail for an island
  const drawIslandTrail = (ctx: CanvasRenderingContext2D, island: Island): void => {
    // Generate future position points
    const futureTrail: Position[] = [];
    const tickPoints: Position[] = [];
    
    // Calculate 30 days into the future with 100 points per day
    const pointsPerDay = 100;
    const totalDays = trailLength / 1000; // 30 days
    const totalPoints = totalDays * pointsPerDay;
    
    for (let i = 0; i <= totalPoints; i++) {
      const futureTime = time + (i * trailLength / totalPoints);
      const pos = simulator.calculatePosition(island, futureTime);
      futureTrail.push({ 
        x: pos.x * viewportScale + centerXRef.current, 
        y: pos.y * viewportScale + centerYRef.current, 
        time: futureTime 
      });
      
      // Add tick mark points using trailTickFrequency
      if (i % (trailTickFrequency * pointsPerDay) === 0 && i > 0) {
        tickPoints.push({ 
          x: pos.x * viewportScale + centerXRef.current, 
          y: pos.y * viewportScale + centerYRef.current, 
          time: futureTime 
        });
      }
    }
    
    // Draw the future trail
    if (futureTrail.length >= 2) {
      // Use monochrome for print mode, island colors otherwise
      ctx.strokeStyle = customProps?.printMode ? "#cccccc" : island.color;
      ctx.lineWidth = customProps?.printMode ? 1.5 : 2.5;
      ctx.globalAlpha = 0.6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      ctx.beginPath();
      ctx.moveTo(futureTrail[0].x, futureTrail[0].y);
      
      for (let i = 1; i < futureTrail.length; i++) {
        ctx.lineTo(futureTrail[i].x, futureTrail[i].y);
      }
      
      ctx.stroke();
      
      // Draw tick marks - more modern style
      ctx.fillStyle = customProps?.printMode ? "#000000" : island.color;
      tickPoints.forEach((point, i) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, customProps?.printMode ? 3 : 4, 0, 2 * Math.PI);
        ctx.fill();
      });
      
      ctx.globalAlpha = 1;
    }
  };
  
  // Helper function to draw active journeys
  const drawActiveJourney = (ctx: CanvasRenderingContext2D, journey: Journey): void => {
    const sourceIsland = islands.find(island => island.id === journey.sourceId);
    const destIsland = islands.find(island => island.id === journey.destinationId);
    
    if (sourceIsland && destIsland) {
      // Get the current position along the journey path
      const currentPosition = simulator.getCurrentJourneyPosition(journey);
      
      // Get the destination position at arrival time
      const destPos = simulator.calculatePosition(destIsland, journey.arrivalTime);
      
      // Draw the future journey path
      const futurePath = simulator.getFutureJourneyPath(journey);
      
      if (futurePath.length > 1) {
        // Draw the future path
        ctx.strokeStyle = customProps?.printMode ? "#333333" : "#2e7d32"; // MUI green or dark gray for print
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]); // Dashed line
        ctx.globalAlpha = 0.75;
        
        ctx.beginPath();
        ctx.moveTo(
          currentPosition.x * viewportScale + centerXRef.current, 
          currentPosition.y * viewportScale + centerYRef.current
        );
        
        for (let i = 1; i < futurePath.length; i++) {
          const point = futurePath[i];
          ctx.lineTo(
            point.x * viewportScale + centerXRef.current, 
            point.y * viewportScale + centerYRef.current
          );
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      // Draw current position marker
      ctx.fillStyle = customProps?.printMode ? "#000000" : "#2e7d32"; // MUI green or black for print
      ctx.beginPath();
      ctx.arc(
        currentPosition.x * viewportScale + centerXRef.current, 
        currentPosition.y * viewportScale + centerYRef.current, 
        6, 0, 2 * Math.PI
      );
      ctx.fill();
      
      // Draw destination marker
      ctx.fillStyle = "#f44336"; // MUI red
      ctx.beginPath();
      ctx.arc(
        destPos.x * viewportScale + centerXRef.current, 
        destPos.y * viewportScale + centerYRef.current, 
        8, 0, 2 * Math.PI
      );
      ctx.fill();
      
      // Draw journey progress label
      const progress = simulator.getJourneyProgress(journey);
      ctx.font = "bold 12px Roboto, Arial, sans-serif";
      ctx.fillStyle = "#2e7d32"; // MUI green
      
      const labelText = `${destIsland.name}: ${progress.progress.toFixed(0)}%`;
      const labelX = currentPosition.x * viewportScale + centerXRef.current + 10;
      const labelY = currentPosition.y * viewportScale + centerYRef.current - 10;
      
      // Draw label background
      const textWidth = ctx.measureText(labelText).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      const padding = 4;
      const capsuleRadius = 8;
      
      ctx.beginPath();
      ctx.moveTo(labelX - padding + capsuleRadius, labelY - 12);
      ctx.lineTo(labelX + textWidth + padding - capsuleRadius, labelY - 12);
      ctx.arc(labelX + textWidth + padding - capsuleRadius, labelY - 12 + capsuleRadius, capsuleRadius, -Math.PI/2, Math.PI/2);
      ctx.lineTo(labelX - padding + capsuleRadius, labelY + 4);
      ctx.arc(labelX - padding + capsuleRadius, labelY - 12 + capsuleRadius, capsuleRadius, Math.PI/2, -Math.PI/2);
      ctx.fill();
      
      // Draw label text
      ctx.fillStyle = "#2e7d32"; // MUI green
      ctx.fillText(labelText, labelX, labelY);
    }
  };
  
  // Helper function to draw the predicted journey
  const drawPredictedJourney = (ctx: CanvasRenderingContext2D, journey: Journey): void => {
    const sourceIsland = islands.find(island => island.id === journey.sourceId);
    const destIsland = islands.find(island => island.id === journey.destinationId);
    
    if (sourceIsland && destIsland) {
      // Draw the journey path
      ctx.strokeStyle = customProps?.printMode ? "#666666" : "#795548"; // MUI brown color or gray for print
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]); // Dashed line with MUI styling
      ctx.globalAlpha = 0.75;
      
      ctx.beginPath();
      const startPoint = journey.path[0];
      ctx.moveTo(
        startPoint.x * viewportScale + centerXRef.current, 
        startPoint.y * viewportScale + centerYRef.current
      );
      
      for (let i = 1; i < journey.path.length; i++) {
        const point = journey.path[i];
        ctx.lineTo(
          point.x * viewportScale + centerXRef.current, 
          point.y * viewportScale + centerYRef.current
        );
      }
      
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash
      
      // Draw destination marker (where the island will be at arrival)
      const destPos = simulator.calculatePosition(destIsland, journey.arrivalTime);
      ctx.fillStyle = "#f44336"; // MUI red
      ctx.beginPath();
      ctx.arc(
        destPos.x * viewportScale + centerXRef.current, 
        destPos.y * viewportScale + centerYRef.current, 
        8, 0, 2 * Math.PI
      );
      ctx.fill();
      
      // Draw time markers along the path
      ctx.fillStyle = "#795548"; // MUI brown
      ctx.font = "bold 11px Roboto, Arial, sans-serif";
      
      // Show one marker for each day of the journey, based on the journeyTickMarkDays setting
      const journeyDays = Math.ceil(journey.duration);
      
      if (journeyDays > 0) {
        for (let day = journeyTickMarkDays; day <= journeyDays; day += journeyTickMarkDays) {
          // Calculate what percentage of the journey this day represents
          const t = day / journey.duration;
          // Find the corresponding index in the path array
          const markerIndex = Math.min(Math.floor(t * (journey.path.length - 1)), journey.path.length - 1);
          const marker = journey.path[markerIndex];
          
          // Draw a square marker instead of a circle
          const markerSize = 8;
          const markerX = marker.x * viewportScale + centerXRef.current - markerSize/2;
          const markerY = marker.y * viewportScale + centerYRef.current - markerSize/2;
          ctx.fillRect(markerX, markerY, markerSize, markerSize);
        }
      }
      
      ctx.globalAlpha = 1;
    }
  };
  
  // Update the drawLegend function to store clickable areas and handle clicks
  const drawLegend = (ctx: CanvasRenderingContext2D): void => {
    const visibleIslands = islands.filter(island => island.visible);
    
    // MUI-styled legend with more rounded corners and subtle shadow
    const padding = 16;
    const lineHeight = 32;
    
    // Calculate legend height based on content
    let legendHeight = islands.length * lineHeight + padding * 2;
        
    const legendWidth = 220;
    const legendX = 24;
    const legendY = 24;
    
    // Draw legend background with rounded corners and subtle shadow
    ctx.save();
    
    // Draw shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Draw rounded background
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    const radius = 8;
    ctx.moveTo(legendX + radius, legendY);
    ctx.lineTo(legendX + legendWidth - radius, legendY);
    ctx.quadraticCurveTo(legendX + legendWidth, legendY, legendX + legendWidth, legendY + radius);
    ctx.lineTo(legendX + legendWidth, legendY + legendHeight - radius);
    ctx.quadraticCurveTo(legendX + legendWidth, legendY + legendHeight, legendX + legendWidth - radius, legendY + legendHeight);
    ctx.lineTo(legendX + radius, legendY + legendHeight);
    ctx.quadraticCurveTo(legendX, legendY + legendHeight, legendX, legendY + legendHeight - radius);
    ctx.lineTo(legendX, legendY + radius);
    ctx.quadraticCurveTo(legendX, legendY, legendX + radius, legendY);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
    
    // Add legend title
    ctx.fillStyle = "#212121"; // MUI default text color
    ctx.font = "bold 14px Roboto, Arial, sans-serif"; // MUI typography
    ctx.fillText("Island Information", legendX + padding, legendY + padding + 4);
    
    // Add a subtle divider
    ctx.strokeStyle = "rgba(0, 0, 0, 0.12)"; // MUI divider color
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(legendX + padding, legendY + padding + 12);
    ctx.lineTo(legendX + legendWidth - padding, legendY + padding + 12);
    ctx.stroke();
    
    // Clear previous legend item positions
    legendItemPositionsRef.current = [];

    // Draw island information
    islands.forEach((island, index) => {
      const y = legendY + padding + 24 + index * lineHeight; // Add extra space for title and divider
      const orbitalPeriod = simulator.calculateOrbitalPeriod(island.cycles);
      const { dayInCycle, percentage } = simulator.calculateOrbitalPosition(island.cycles);
      const velocity = simulator.calculateVelocity(island);
      
      // Draw color indicator with MUI-style pill shape
      ctx.fillStyle = island.visible ? island.color : "rgba(0, 0, 0, 0.3)"; // Dim color if not visible
      ctx.beginPath();
      const pillWidth = 24;
      const pillHeight = 12;
      const pillRadius = pillHeight / 2;
      const pillX = legendX + padding + 5;
      const pillY = y + 2;
      
      ctx.moveTo(pillX + pillRadius, pillY);
      ctx.lineTo(pillX + pillWidth - pillRadius, pillY);
      ctx.arc(pillX + pillWidth - pillRadius, pillY + pillRadius, pillRadius, -Math.PI/2, Math.PI/2);
      ctx.lineTo(pillX + pillRadius, pillY + pillHeight);
      ctx.arc(pillX + pillRadius, pillY + pillRadius, pillRadius, Math.PI/2, -Math.PI/2);
      ctx.fill();
      
      // Store clickable area for the legend item
      legendItemPositionsRef.current.push({
        x: pillX,
        y: pillY,
        width: pillWidth,
        height: pillHeight,
        islandId: island.id
      });
      
      // Draw island name
      ctx.fillStyle = "#212121"; // MUI default text color
      ctx.font = "500 13px Roboto, Arial, sans-serif"; // MUI typography - medium weight
      ctx.fillText(island.name, legendX + padding + pillWidth + 10, y + 4);
      
      // Draw speed info with MUI typography style
      ctx.font = "400 12px Roboto, Arial, sans-serif";
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; // MUI secondary text color
      ctx.fillText(
        `${velocity.speed.toFixed(0)} mi/d`, 
        legendX + padding + pillWidth + 10, 
        y + 20
      );
    });
  };

  // Add a click event listener to toggle island visibility
  useEffect(() => {
    const handleCanvasClick = (event: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Check if the click is within any legend item
      for (const item of legendItemPositionsRef.current) {
        if (
          x >= item.x &&
          x <= item.x + item.width &&
          y >= item.y &&
          y <= item.y + item.height
        ) {
          // Toggle visibility
          toggleIslandVisibility(item.islandId);
          break;
        }
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('click', handleCanvasClick);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('click', handleCanvasClick);
      }
    };
  }, [toggleIslandVisibility]);

  return (
    <CanvasContainer ref={canvasContainerRef}>
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: '100%' }}
      />
    </CanvasContainer>
  );
};

export default SimulationCanvas; 