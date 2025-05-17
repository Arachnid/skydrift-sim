import React, { useRef, useState, useEffect } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography, Paper } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import SkydriftArchipelagoSimulator, { Island, Journey } from '../utils/sim';
import { formatTime } from '../utils/timeFormat';

interface PrintableSkyChartButtonProps {
  simulator: SkydriftArchipelagoSimulator;
  islands: Island[];
  time: number;
  showTrails: boolean;
  trailLength: number;
  activeJourney: Journey | null;
  activeJourneys: Journey[];
  viewportScale: number;
}

const PrintableSkyChartButton: React.FC<PrintableSkyChartButtonProps> = ({
  simulator,
  islands,
  time,
  showTrails,
  trailLength,
  activeJourney,
  activeJourneys,
  viewportScale,
}) => {
  const [open, setOpen] = useState(false);
  const printCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // A4 size in pixels at 96 DPI (standard screen resolution)
  // A4 is 210mm × 297mm or 8.27in × 11.69in
  // At 96 DPI, that's approximately 794 × 1123 pixels
  const chartWidth = 794;
  const chartHeight = 1123;
  
  // Calculate a dynamic scale factor to ensure islands use 90% of available space
  const [dynamicScale, setDynamicScale] = useState(viewportScale);

  // Calculate the dynamic scale factor when islands change
  useEffect(() => {
    if (islands.length === 0) return;
    
    // Calculate the maximum extent of all visible islands and their trails
    let maxDistance = 0;
    const visibleIslands = islands.filter(i => i.visible);
    
    visibleIslands.forEach(island => {
      // Get the base position
      const position = simulator.calculatePosition(island);
      const distance = Math.sqrt(position.x * position.x + position.y * position.y);
      
      // If showing trails, include their extent too
      if (showTrails) {
        // Sample future positions to find maximum extent
        const totalDays = trailLength / 1000;
        for (let day = 0; day <= totalDays; day += 5) {
          const futureTime = time + (day * 1000);
          const futurePos = simulator.calculatePosition(island, futureTime);
          const futureDistance = Math.sqrt(futurePos.x * futurePos.x + futurePos.y * futurePos.y);
          maxDistance = Math.max(maxDistance, futureDistance);
        }
      } else {
        maxDistance = Math.max(maxDistance, distance);
      }
    });
    
    // Add 10% padding
    maxDistance *= 1.1;
    
    // Calculate scale to fit 90% of the smallest dimension
    const minDimension = Math.min(chartWidth, chartHeight);
    const radius = minDimension * 0.45; // 90% of half the dimension
    
    // Calculate new scale if maxDistance is valid
    if (maxDistance > 0) {
      const newScale = radius / maxDistance;
      setDynamicScale(newScale);
    }
  }, [islands, simulator, showTrails, time, trailLength]);

  const handleOpen = () => {
    setOpen(true);
    // Render the chart when dialog opens
    setTimeout(renderPrintableChart, 100);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handlePrint = () => {
    if (!printCanvasRef.current) return;

    // Convert canvas to image data URL
    const dataUrl = printCanvasRef.current.toDataURL('image/png');
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the chart');
      return;
    }

    // Create HTML content for the print window
    printWindow.document.write(`
      <html>
        <head>
          <title>Skydrift Archipelago Chart - ${formatTime(time)}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            .chart-container {
              page-break-inside: avoid;
              width: 100%;
              max-width: 210mm;
              margin: 0 auto;
            }
            .chart-image {
              width: 100%;
              height: auto;
            }
            @media print {
              .no-print {
                display: none;
              }
              @page {
                size: A4 portrait;
                margin: 10mm;
              }
              body {
                width: 210mm;
                height: 297mm;
              }
            }
            .print-button {
              padding: 10px 20px;
              background: #2196f3;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
              margin: 20px;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="print-button" onclick="window.print(); return false;">Print Chart</button>
          </div>
          <div class="chart-container">
            <img src="${dataUrl}" class="chart-image" alt="Skydrift Archipelago Chart" />
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  const renderPrintableChart = () => {
    if (!printCanvasRef.current) return;
    
    const canvas = printCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set dimensions for A4 size
    canvas.width = chartWidth;
    canvas.height = chartHeight;
    
    // Calculate margins with more space at the top
    const topMargin = 100;  // Increased top margin for title and date
    const margin = 50;
    const contentWidth = chartWidth - (margin * 2);
    const contentHeight = chartHeight - margin - topMargin; // Adjust for top margin
    
    // Clear canvas with white background for printing
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw title and timestamp first (outside the frame)
    ctx.fillStyle = "#000000";
    ctx.font = "bold 24px Arial";
    const title = "Skydrift Archipelago Chart";
    ctx.textAlign = "center";
    ctx.fillText(title, chartWidth / 2, topMargin - 50);
    
    ctx.font = "16px Arial";
    const timeStr = `Date: ${formatTime(time)}`;
    ctx.fillText(timeStr, chartWidth / 2, topMargin - 25);
    ctx.textAlign = "left";
    
    // Draw a border for the chart
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, topMargin, contentWidth, contentHeight);
    
    // Draw cardinal directions at the edges of the chart (not moving with the content)
    ctx.font = "16px Arial";
    ctx.fillStyle = "#000000";
    
    // North at top center
    ctx.textAlign = "center";
    ctx.fillText("N", chartWidth / 2, topMargin - 10);
    
    // South at bottom center
    ctx.fillText("S", chartWidth / 2, chartHeight - margin + 25);
    
    // East at right center
    ctx.textAlign = "left";
    ctx.fillText("E", chartWidth - margin + 10, chartHeight / 2);
    
    // West at left center
    ctx.textAlign = "right";
    ctx.fillText("W", margin - 10, chartHeight / 2);
    
    // Reset text alignment
    ctx.textAlign = "left";
    
    // Set up proper scaling and translation to ensure content is centered
    // Define content area for the chart
    const contentArea = {
      x: margin,
      y: topMargin,
      width: contentWidth,
      height: contentHeight
    };
    
    // Calculate center of content area
    const contentCenterX = contentArea.x + contentArea.width / 2;
    const contentCenterY = contentArea.y + contentArea.height / 2;
    
    // Set simulator center to chart content center
    simulator.setCenter(contentCenterX, contentCenterY);
    
    // Calculate scale factor based on visible islands
    // This ensures content is properly scaled and centered
    const visibleIslands = islands.filter(i => i.visible);
    if (visibleIslands.length > 0) {
      // Find maximum coordinates in any direction
      let maxDistance = 0;
      visibleIslands.forEach(island => {
        // Sample current and future positions (if trails enabled)
        const positions = [];
        
        // Current position
        const pos = simulator.calculatePosition(island);
        positions.push(pos);
        
        // Future positions for trails
        if (showTrails) {
          const totalDays = trailLength / 1000;
          for (let day = 0; day <= totalDays; day += 5) {
            const futureTime = time + (day * 1000);
            positions.push(simulator.calculatePosition(island, futureTime));
          }
        }
        
        // Find maximum distance from center for this island
        positions.forEach(pos => {
          const distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
          maxDistance = Math.max(maxDistance, distance);
        });
      });
      
      // Add margin for island size and text
      maxDistance += 20;
      
      // Calculate safe scale to fit content with padding (80% of available space)
      const availableWidth = contentWidth * 0.8;
      const availableHeight = contentHeight * 0.8;
      const maxDimension = Math.min(availableWidth, availableHeight);
      
      // Update dynamic scale - ensures we don't overflow the frame
      if (maxDistance > 0) {
        const newScale = maxDimension / (maxDistance * 2);
        setDynamicScale(newScale);
      }
    }
    
    // Draw trails if enabled
    if (showTrails) {
      islands.forEach(island => {
        if (island.visible) {
          drawIslandTrail(ctx, island, contentCenterX, contentCenterY, dynamicScale);
        }
      });
    }
    
    // Draw active journeys with monochrome styling
    activeJourneys.forEach(journey => {
      drawJourney(ctx, journey, "#333333", contentCenterX, contentCenterY, dynamicScale);
    });
    
    // Draw predicted journey
    if (activeJourney && activeJourney.status === 'predicted' && activeJourney.path.length > 1) {
      drawJourney(ctx, activeJourney, "#666666", contentCenterX, contentCenterY, dynamicScale);
    }
    
    // Draw islands with monochrome styling
    islands.forEach(island => {
      if (!island.visible) return;
      
      const position = simulator.calculatePosition(island);
      
      // Draw island circle
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(
        position.x * dynamicScale + contentCenterX, 
        position.y * dynamicScale + contentCenterY, 
        island.radius, 0, 2 * Math.PI
      );
      ctx.fill();
      
      // Draw island name
      ctx.font = "12px Arial";
      const nameText = island.name;
      const textWidth = ctx.measureText(nameText).width;
      const nameX = position.x * dynamicScale + contentCenterX + 12;
      const nameY = position.y * dynamicScale + contentCenterY - 8;
      
      // Draw text with white background for contrast
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(nameX - 2, nameY - 12, textWidth + 4, 14);
      
      // Draw text
      ctx.fillStyle = "#000000";
      ctx.fillText(nameText, nameX, nameY);
    });
    
    // Draw scale at the bottom (inside the frame)
    drawScale(ctx, contentArea);
  };
  
  // Helper function to draw scale at the bottom, inside the frame
  const drawScale = (ctx: CanvasRenderingContext2D, contentArea: {x: number, y: number, width: number, height: number}): void => {
    const scaleWidth = Math.min(300, contentArea.width * 0.4); // Limit scale width to 40% of content area
    const scaleHeight = 30;
    
    // Position scale in the bottom-left corner of the content area
    const scaleX = contentArea.x + 20;
    const scaleY = contentArea.y + contentArea.height - scaleHeight;
    
    // Calculate what actual distance the scale represents based on current scale factor
    // Find a nice round number that fits well within our scale width
    const pixelsPerMile = dynamicScale;
    
    // Find a nice round number for the scale
    let roundedMiles = 100;
    const possibleRoundNumbers = [10, 25, 50, 100, 200, 250, 500, 1000];
    
    // Find the largest round number that will fit at least 2-3 ticks on the scale
    for (let i = 0; i < possibleRoundNumbers.length; i++) {
      const miles = possibleRoundNumbers[i];
      const pixelWidth = miles * pixelsPerMile;
      
      // We want at least 3 ticks to fit within our scale width
      if (pixelWidth * 3 <= scaleWidth) {
        roundedMiles = miles;
      } else {
        break;
      }
    }
    
    // How many ticks can we fit?
    const maxTicks = Math.floor(scaleWidth / (roundedMiles * pixelsPerMile));
    const tickMiles = [];
    
    // Create tick array
    for (let i = 0; i <= maxTicks; i++) {
      tickMiles.push(i * roundedMiles);
    }
    
    // Draw background for scale
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillRect(scaleX - 5, scaleY - 15, scaleWidth + 10, scaleHeight + 15);
    
    // Draw scale line
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleX, scaleY);
    ctx.lineTo(scaleX + scaleWidth, scaleY);
    ctx.stroke();
    
    // Draw scale ticks
    tickMiles.forEach(miles => {
      // Calculate pixel position for this tick
      const tickX = scaleX + (miles * pixelsPerMile);
      
      ctx.beginPath();
      ctx.moveTo(tickX, scaleY);
      ctx.lineTo(tickX, scaleY - 10);
      ctx.stroke();
      
      ctx.font = "12px Arial";
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.fillText(`${miles} miles`, tickX, scaleY + 15);
    });
    
    // Reset text alignment
    ctx.textAlign = "left";
  };
  
  // Helper function to draw island trails
  const drawIslandTrail = (ctx: CanvasRenderingContext2D, island: Island, offsetX: number, offsetY: number, scale: number): void => {
    const futureTrail: { x: number, y: number }[] = [];
    const tickPoints: { x: number, y: number }[] = [];
    
    // Generate fewer points for printing
    const pointsPerDay = 20;
    const totalDays = trailLength / 1000;
    const totalPoints = totalDays * pointsPerDay;
    
    for (let i = 0; i <= totalPoints; i++) {
      const futureTime = time + (i * trailLength / totalPoints);
      const pos = simulator.calculatePosition(island, futureTime);
      
      futureTrail.push({ 
        x: pos.x * scale + offsetX, 
        y: pos.y * scale + offsetY
      });
      
      // Add tick marks every 5 days
      if (i % (5 * pointsPerDay) === 0 && i > 0) {
        tickPoints.push({ 
          x: pos.x * scale + offsetX, 
          y: pos.y * scale + offsetY
        });
      }
    }
    
    // Draw trail
    if (futureTrail.length >= 2) {
      ctx.strokeStyle = "#cccccc"; // Light gray for monochrome printing
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(futureTrail[0].x, futureTrail[0].y);
      
      for (let i = 1; i < futureTrail.length; i++) {
        ctx.lineTo(futureTrail[i].x, futureTrail[i].y);
      }
      
      ctx.stroke();
      
      // Draw tick marks
      ctx.fillStyle = "#000000";
      tickPoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  };
  
  // Helper function to draw journeys
  const drawJourney = (ctx: CanvasRenderingContext2D, journey: Journey, color: string, offsetX: number, offsetY: number, scale: number): void => {
    const sourceIsland = islands.find(island => island.id === journey.sourceId);
    const destIsland = islands.find(island => island.id === journey.destinationId);
    
    if (!sourceIsland?.visible || !destIsland?.visible) return;
    
    // Calculate start and end positions
    let startPosition;
    if (journey.status === 'active') {
      startPosition = simulator.getCurrentJourneyPosition(journey);
    } else {
      startPosition = journey.path[0];
    }
    
    const destPos = simulator.calculatePosition(destIsland, journey.arrivalTime);
    
    // Draw path
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    
    ctx.beginPath();
    ctx.moveTo(
      startPosition.x * scale + offsetX, 
      startPosition.y * scale + offsetY
    );
    
    // Draw path with fewer points for clarity
    const skipFactor = Math.max(1, Math.floor(journey.path.length / 50));
    for (let i = skipFactor; i < journey.path.length; i += skipFactor) {
      const point = journey.path[i];
      ctx.lineTo(
        point.x * scale + offsetX, 
        point.y * scale + offsetY
      );
    }
    
    // Make sure we connect to the last point
    const lastPoint = journey.path[journey.path.length - 1];
    ctx.lineTo(
      lastPoint.x * scale + offsetX, 
      lastPoint.y * scale + offsetY
    );
    
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw day markers along the journey
    // For this, we need to know the journey duration and calculate points at daily intervals
    if (journey.duration > 0) {
      // Calculate how many day markers to show
      const journeyDays = Math.ceil(journey.duration);
      
      // Draw markers for each day along the path
      ctx.fillStyle = color === "#333333" ? "#333333" : "#666666";
      
      for (let day = 0; day < journeyDays; day++) {
        // Find position at this day in the journey
        // Calculate progress percentage
        const progress = day / journey.duration;
        
        // Find the corresponding index in the path array
        const pathIndex = Math.min(Math.floor(progress * journey.path.length), journey.path.length - 1);
        const marker = journey.path[pathIndex];
        
        // Draw a square marker (distinct from island trail circles)
        const markerSize = 5;
        ctx.fillRect(
          marker.x * scale + offsetX - markerSize/2, 
          marker.y * scale + offsetY - markerSize/2, 
          markerSize, 
          markerSize
        );
        
        // Add day number for longer journeys (if there's enough space between markers)
        if (journeyDays <= 10 || day % Math.ceil(journeyDays / 10) === 0) {
          ctx.font = "9px Arial";
          ctx.textAlign = "center";
          ctx.fillText(
            `${day+1}`, 
            marker.x * scale + offsetX, 
            marker.y * scale + offsetY - 8
          );
        }
      }
      
      // Reset text alignment
      ctx.textAlign = "left";
    }
    
    // Draw start marker
    if (journey.status === 'active') {
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(
        startPosition.x * scale + offsetX, 
        startPosition.y * scale + offsetY, 
        6, 0, 2 * Math.PI
      );
      ctx.fill();
      
      // Add progress label
      const progress = simulator.getJourneyProgress(journey);
      ctx.font = "12px Arial";
      const progressText = `${progress.progress.toFixed(0)}%`;
      ctx.fillText(
        progressText,
        startPosition.x * scale + offsetX + 10,
        startPosition.y * scale + offsetY + 4
      );
    }
    
    // Draw destination marker
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(
      destPos.x * scale + offsetX, 
      destPos.y * scale + offsetY, 
      4, 0, 2 * Math.PI
    );
    ctx.fill();
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<PrintIcon />}
        onClick={handleOpen}
        sx={{ ml: 1 }}
      >
        Print Chart
      </Button>
      
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Printable Skydrift Archipelago Chart</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            This chart shows the current state of the Skydrift Archipelago at {formatTime(time)}.
            It has been optimized for monochrome printing on A4 paper.
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <Paper elevation={3} sx={{ p: 2, bgcolor: '#f5f5f5', maxHeight: '70vh', overflow: 'auto' }}>
              <canvas
                ref={printCanvasRef}
                width={chartWidth}
                height={chartHeight}
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
          <Button onClick={handlePrint} variant="contained" startIcon={<PrintIcon />}>
            Print Chart
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PrintableSkyChartButton; 