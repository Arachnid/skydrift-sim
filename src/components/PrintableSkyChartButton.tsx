import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography, Paper } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import SkydriftArchipelagoSimulator, { Island, Journey } from '../utils/sim';
import { formatTime } from '../utils/timeFormat';
import SimulationCanvas from './SimulationCanvas';

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
  const simulationContainerRef = useRef<HTMLDivElement | null>(null);
  
  // A4 size in pixels at 96 DPI (standard screen resolution)
  // A4 is 210mm × 297mm or 8.27in × 11.69in
  // At 96 DPI, that's approximately 794 × 1123 pixels
  const chartWidth = 794;
  const chartHeight = 1123;
  
  // Calculate a dynamic scale factor to ensure islands use 90% of available space
  const [dynamicScale, setDynamicScale] = useState(viewportScale);
  
  // Create a temporary copy of our simulator for rendering purposes
  const printSimulatorRef = useRef<SkydriftArchipelagoSimulator>(
    new SkydriftArchipelagoSimulator()
  );
  
  // Function to calculate optimal scale for the print view
  const calculateOptimalScale = useCallback(() => {
    const visibleIslands = islands.filter(i => i.visible);
    if (visibleIslands.length === 0) return;
    
    // Find maximum extent of any visible island
    let maxDistance = 0;
    
    visibleIslands.forEach(island => {
      // Get current position
      const pos = simulator.calculatePosition(island);
      const distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      
      // Sample future positions if trails are enabled
      if (showTrails) {
        const totalDays = trailLength / 1000;
        for (let day = 0; day <= totalDays; day += 5) {
          const futureTime = time + (day * 1000);
          const futurePos = simulator.calculatePosition(island, futureTime);
          const futureDistance = Math.sqrt(
            futurePos.x * futurePos.x + futurePos.y * futurePos.y
          );
          maxDistance = Math.max(maxDistance, futureDistance);
        }
      } else {
        maxDistance = Math.max(maxDistance, distance);
      }
    });
    
    // Add some padding
    maxDistance *= 1.1;
    
    // Calculate scaling to fit content into 80% of the printable area
    const contentWidth = chartWidth - 100; // Leave 50px margin on each side
    const contentHeight = chartHeight - 200; // Leave 100px margin top/bottom
    const availableSpace = Math.min(contentWidth, contentHeight) * 0.8;
    
    if (maxDistance > 0) {
      // Scale to make the furthest point take up 80% of available space
      const newScale = availableSpace / (maxDistance * 2);
      setDynamicScale(newScale);
    }
  }, [islands, simulator, time, showTrails, trailLength, chartWidth, chartHeight]);
  
  // Initialize the print simulator with current state
  useEffect(() => {
    // Copy islands and journeys from the main simulator
    printSimulatorRef.current.setIslands(islands);
    printSimulatorRef.current.setTime(time);
    
    // Add active journeys
    activeJourneys.forEach(journey => {
      printSimulatorRef.current.addJourney(journey);
    });
    
    // Calculate scaled viewport based on visible islands
    calculateOptimalScale();
  }, [islands, time, activeJourneys, calculateOptimalScale]);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handlePrint = () => {
    if (!simulationContainerRef.current) return;
    
    // Create a new canvas for the printable chart
    const printCanvas = document.createElement('canvas');
    printCanvas.width = chartWidth;
    printCanvas.height = chartHeight;
    const ctx = printCanvas.getContext('2d');
    if (!ctx) return;
    
    // Clear with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, chartWidth, chartHeight);
    
    // Find the SimulationCanvas in the container and get its canvas element
    const canvasElement = simulationContainerRef.current.querySelector('canvas');
    if (canvasElement) {
      // Position the simulation canvas centered in the printable area
      const contentMarginTop = 100;
      const contentMarginSide = 50;
      const contentWidth = chartWidth - (contentMarginSide * 2);
      const contentHeight = chartHeight - contentMarginTop - contentMarginSide;
      
      // Scale to fit while maintaining aspect ratio
      const canvasAspect = canvasElement.width / canvasElement.height;
      const contentAspect = contentWidth / contentHeight;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (canvasAspect > contentAspect) {
        // Canvas is wider than content area
        drawWidth = contentWidth;
        drawHeight = drawWidth / canvasAspect;
        drawX = contentMarginSide;
        drawY = contentMarginTop + (contentHeight - drawHeight) / 2;
      } else {
        // Canvas is taller than content area
        drawHeight = contentHeight;
        drawWidth = drawHeight * canvasAspect;
        drawX = contentMarginSide + (contentWidth - drawWidth) / 2;
        drawY = contentMarginTop;
      }
      
      // Draw the canvas content
      ctx.drawImage(canvasElement, drawX, drawY, drawWidth, drawHeight);
      
      // Add frame, title, and scale
      renderPrintableDecorations(ctx, {
        x: contentMarginSide,
        y: contentMarginTop,
        width: contentWidth,
        height: contentHeight
      });
    }
    
    // Convert to image and open print window
    const dataUrl = printCanvas.toDataURL('image/png');
    openPrintWindow(dataUrl);
  };
  
  // Adds decorations specific to the printable version
  const renderPrintableDecorations = (
    ctx: CanvasRenderingContext2D, 
    contentArea: {x: number, y: number, width: number, height: number}
  ) => {
    const { x: margin, y: topMargin, width: contentWidth, height: contentHeight } = contentArea;
    
    // Draw a border for the chart
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, topMargin, contentWidth, contentHeight);
    
    // Draw title and timestamp
    ctx.fillStyle = "#000000";
    ctx.font = "bold 24px Arial";
    const title = "Skydrift Archipelago Chart";
    ctx.textAlign = "center";
    ctx.fillText(title, chartWidth / 2, topMargin - 50);
    
    ctx.font = "16px Arial";
    const timeStr = `Date: ${formatTime(time)}`;
    ctx.fillText(timeStr, chartWidth / 2, topMargin - 25);
    
    // Draw cardinal directions
    ctx.font = "16px Arial";
    ctx.fillStyle = "#000000";
    
    // North at top center
    ctx.textAlign = "center";
    ctx.fillText("N", chartWidth / 2, topMargin - 10);
    
    // South at bottom center
    ctx.fillText("S", chartWidth / 2, topMargin + contentHeight + 25);
    
    // East at right center
    ctx.textAlign = "left";
    ctx.fillText("E", margin + contentWidth + 10, topMargin + contentHeight / 2);
    
    // West at left center
    ctx.textAlign = "right";
    ctx.fillText("W", margin - 10, topMargin + contentHeight / 2);
    
    // Reset text alignment
    ctx.textAlign = "left";
    
    // Draw scale at the bottom
    drawScale(ctx, contentArea);
  };
  
  // Helper function to draw scale at the bottom
  const drawScale = (ctx: CanvasRenderingContext2D, contentArea: {x: number, y: number, width: number, height: number}): void => {
    const scaleWidth = Math.min(300, contentArea.width * 0.4);
    const scaleHeight = 30;
    
    // Position scale in the bottom-left corner of the content area
    const scaleX = contentArea.x + 20;
    const scaleY = contentArea.y + contentArea.height - scaleHeight;
    
    // Calculate what actual distance the scale represents based on current scale factor
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
  
  // Function to open print window with chart image
  const openPrintWindow = (dataUrl: string) => {
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
  
  // Custom handler for toggling island visibility (required by SimulationCanvas)
  const handleToggleIslandVisibility = (islandId: number) => {
    // No-op for the printable view
  };
  
  // Custom resize handler for the printable canvas
  const handleCanvasResize = (width: number, height: number) => {
    // No-op for the printable view
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
      
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { maxHeight: '90vh' }
        }}
      >
        <DialogTitle>Printable Skydrift Archipelago Chart</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            This chart shows the current state of the Skydrift Archipelago at {formatTime(time)}.
            It has been optimized for monochrome printing on A4 paper.
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <Paper 
              elevation={3} 
              sx={{ 
                p: 2, 
                bgcolor: '#f5f5f5', 
                maxHeight: '70vh',
                overflow: 'auto'
              }}
            >
              {/* Container for the simulation canvas */}
              <div ref={simulationContainerRef} style={{ width: '100%', height: '600px', backgroundColor: '#ffffff' }}>
                <SimulationCanvas
                  simulator={printSimulatorRef.current}
                  islands={islands}
                  time={time}
                  showOrbits={false} // No orbits in print version
                  showTrails={showTrails}
                  trailLength={trailLength}
                  activeJourney={activeJourney}
                  viewportScale={dynamicScale}
                  onResize={handleCanvasResize}
                  toggleIslandVisibility={handleToggleIslandVisibility}
                  customProps={{
                    printMode: true,
                    showLegend: false,
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>
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