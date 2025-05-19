import React, { useRef, useState, useCallback } from 'react';
import { Box, Button, CircularProgress, Snackbar, Alert } from '@mui/material';
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
  trailTickFrequency?: number;
  journeyTickMarkDays?: number;
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
  trailTickFrequency = 5,
  journeyTickMarkDays = 1,
  activeJourney,
  viewportScale,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const hiddenContainerRef = useRef<HTMLDivElement | null>(null);
  const simulationContainerRef = useRef<HTMLDivElement | null>(null);
  
  // A4 size in pixels at 96 DPI (standard screen resolution)
  // A4 is 210mm × 297mm or 8.27in × 11.69in
  // At 96 DPI, that's approximately 794 × 1123 pixels
  const chartWidth = 794;
  const chartHeight = 1123;
  
  // Calculate a dynamic scale factor to ensure islands use 90% of available space
  const [dynamicScale, setDynamicScale] = useState(viewportScale);
  
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
      // Note: The simulator already returns positions in miles
      // So we're calculating pixels per mile directly
      const pixelsPerMile = availableSpace / (maxDistance * 2);
      setDynamicScale(pixelsPerMile);
    }
  }, [islands, simulator, time, showTrails, trailLength]);

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      
      // Calculate optimal scale for print view
      calculateOptimalScale();
      
      // Create a canvas to render the printable chart
      const printCanvas = document.createElement('canvas');
      printCanvas.width = chartWidth;
      printCanvas.height = chartHeight;
      const ctx = printCanvas.getContext('2d');
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      
      // Clear with white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, chartWidth, chartHeight);
      
      // Wait a moment for the hidden canvas to render
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Find the SimulationCanvas in the container and get its canvas element
      if (!simulationContainerRef.current) {
        throw new Error("Simulation container not found");
      }
      
      const canvasElement = simulationContainerRef.current.querySelector('canvas');
      if (!canvasElement) {
        throw new Error("Canvas element not found");
      }
      
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
      
      // Create an image from the canvas
      const imgData = printCanvas.toDataURL('image/png');
      
      // Open a new window with just the image
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error("Could not open print window. Please allow pop-ups for this site.");
      }
      
      // Add content to the window
      printWindow.document.write(`
        <html>
          <head>
            <title>Skydrift Archipelago Chart - ${formatTime(time)}</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background-color: #f8f8f8;
              }
              
              .chart-container {
                max-width: 100%;
                max-height: 100vh;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                background: white;
              }
              
              img {
                display: block;
                max-width: 100%;
                height: auto;
              }
              
              .print-button {
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 8px 16px;
                background: #2196f3;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-family: Arial, sans-serif;
              }
              
              @media print {
                body {
                  background: none;
                }
                
                .chart-container {
                  box-shadow: none;
                  max-height: none;
                }
                
                .print-button {
                  display: none;
                }
                
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="chart-container">
              <img src="${imgData}" alt="Skydrift Archipelago Chart" />
            </div>
            <button class="print-button" onclick="window.print(); return false;">Print Chart</button>
            <script>
              // Auto print after a moment
              setTimeout(() => {
                window.print();
              }, 500);
            </script>
          </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Reset state
      setTimeout(() => {
        setIsPrinting(false);
      }, 1000);
    } catch (error) {
      console.error("Error printing chart:", error);
      setIsPrinting(false);
      setFeedbackMessage(`Error printing chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setShowFeedback(true);
    }
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
        startIcon={isPrinting ? <CircularProgress size={20} /> : <PrintIcon />}
        onClick={handlePrint}
        disabled={isPrinting}
        sx={{ ml: 1 }}
      >
        {isPrinting ? "Printing..." : "Print Chart"}
      </Button>
      
      {/* Hidden container for rendering the printable chart */}
      <Box
        ref={hiddenContainerRef}
        sx={{
          position: 'fixed',
          opacity: 0,
          pointerEvents: 'none',
          width: 0,
          height: 0,
          overflow: 'hidden'
        }}
      >
        <div ref={simulationContainerRef} style={{ width: chartWidth, height: chartHeight, backgroundColor: '#ffffff' }}>
          <SimulationCanvas
            simulator={simulator}
            islands={islands}
            time={time}
            showOrbits={false}
            showTrails={showTrails}
            trailLength={trailLength}
            trailTickFrequency={trailTickFrequency}
            journeyTickMarkDays={journeyTickMarkDays}
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
      </Box>
      
      {/* Feedback snackbar */}
      <Snackbar
        open={showFeedback}
        autoHideDuration={6000}
        onClose={() => setShowFeedback(false)}
      >
        <Alert onClose={() => setShowFeedback(false)} severity="error" sx={{ width: '100%' }}>
          {feedbackMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default PrintableSkyChartButton; 