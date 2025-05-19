import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SkydriftArchipelagoSimulator, { Conjunction, Island } from '../utils/sim';
import { formatTime, formatDuration } from '../utils/timeFormat';

// Style the table for better readability
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  '&.MuiTableCell-head': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontWeight: 'bold'
  }
}));

// Style for highlighted rows (active conjunctions)
const ActiveConjunctionRow = styled(TableRow)(({ theme }) => ({
  backgroundColor: theme.palette.success.light,
  '&:hover': {
    backgroundColor: theme.palette.success.main,
  }
}));

// Style for the time cell with icon button
const TimeCell = styled(TableCell)(({ theme }) => ({
  position: 'relative',
}));

// Style for the time button
const TimeButton = styled(IconButton)(({ theme }) => ({
  fontSize: '0.75rem',
  padding: '2px',
  position: 'absolute',
  right: '4px',
  top: '50%',
  transform: 'translateY(-50%)',
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  }
}));

interface ConjunctionsPanelProps {
  simulator: SkydriftArchipelagoSimulator;
  islands: Island[];
  currentTime: number;
  setTime?: (time: number) => void;      // Optional function to set simulation time
  setIsPlaying?: (playing: boolean) => void;  // Optional function to pause simulation
}

const ConjunctionsPanel: React.FC<ConjunctionsPanelProps> = ({ 
  simulator, 
  islands,
  currentTime,
  setTime,
  setIsPlaying
}) => {
  // State for storing conjunctions
  const [conjunctions, setConjunctions] = useState<Conjunction[]>([]);
  
  // Constants for conjunction calculations
  const MAX_CONJUNCTIONS = 10;
  const MAX_YEARS = 10;
  
  // Reference to track last calculated time and end time
  const lastCalculationRef = useRef<{
    startTime: number;
    endTime: number;
    islandCount: number;
    visibleIslands?: string;
  }>({
    startTime: -1,
    endTime: -1,
    islandCount: 0
  });
  
  // Track previous time to detect time jumps (manual day entry, skip forward/back)
  const prevTimeRef = useRef<number>(currentTime);
  
  // Calculation timer reference
  const calculationTimerRef = useRef<number | null>(null);
  
  // Effect to handle conjunction calculations
  useEffect(() => {
    // Clear any pending calculation timer
    if (calculationTimerRef.current !== null) {
      clearTimeout(calculationTimerRef.current);
      calculationTimerRef.current = null;
    }
    
    const calculateConjunctions = () => {
      // Calculate time increment - how much time has passed since last update
      const timeIncrement = currentTime - prevTimeRef.current;
      
      // Check if visible islands have changed
      const currentVisibleIslands = islands.filter(island => island.visible).map(island => island.id).sort().join(',');
      const prevVisibleIslands = lastCalculationRef.current.visibleIslands || '';
      const haveVisibleIslandsChanged = currentVisibleIslands !== prevVisibleIslands;
      
      // Calculate maximum look ahead period (10 years in days)
      const maxLookAheadDays = MAX_YEARS * 365;
      
      // Calculate the end time for the current look ahead window
      const currentEndTime = currentTime + (maxLookAheadDays * 1000);
      
      // Detect backward time jumps
      const isBackwardJump = timeIncrement < 0;
      
      // First, remove past conjunctions regardless of calculation type
      const filteredConjunctions = conjunctions.filter(conj => conj.endTime >= currentTime - 86400);
      const hasRemovedConjunctions = filteredConjunctions.length < conjunctions.length;
      
      // Recalculate everything from scratch in these cases:
      // 1. First calculation (lastCalculationRef.current.startTime === -1)
      // 2. Visible islands have changed
      // 3. Backward time jump
      const needsFullRecalculation = 
        lastCalculationRef.current.startTime === -1 ||
        haveVisibleIslandsChanged ||
        isBackwardJump;
      
      if (needsFullRecalculation) {
        // Use timer to allow UI to update before calculation starts
        calculationTimerRef.current = window.setTimeout(() => {
          // Do a full recalculation for max look ahead period
          const allConjunctions = simulator.calculateUpcomingConjunctions(maxLookAheadDays);
          
          // Store all conjunctions without limiting
          setConjunctions(allConjunctions);
          
          // Update calculation reference
          lastCalculationRef.current = {
            startTime: currentTime,
            endTime: currentEndTime,
            islandCount: islands.length,
            visibleIslands: currentVisibleIslands
          };
          
          calculationTimerRef.current = null;
        }, 10);
      } else {
        // Handle forward time changes and no time changes
        
        // Check if we need to calculate more conjunctions - do we have enough visible upcoming ones?
        const visibleUpcomingCount = filteredConjunctions.filter(conj => 
          conj.startTime > currentTime &&
          islands.find(i => i.id === conj.island1Id)?.visible &&
          islands.find(i => i.id === conj.island2Id)?.visible
        ).length;
        
        if (!hasRemovedConjunctions && visibleUpcomingCount >= MAX_CONJUNCTIONS) {
          // Just update the conjunctions list with filtered ones (past removed)
          // Don't update lastCalculationRef so future calculations start from the right spot
          setConjunctions(filteredConjunctions);
        } else if (timeIncrement > 0) {
          // We need to calculate more conjunctions
          
          // Always use actual elapsed time for calculation window
          const additionalTimeToCheck = timeIncrement;
          const newEndTime = lastCalculationRef.current.endTime + additionalTimeToCheck;
          
          // Calculate new conjunctions
          calculationTimerRef.current = window.setTimeout(() => {
            const newConjunctions = simulator.calculateUpcomingConjunctions(
              additionalTimeToCheck / 1000, // Convert ms to days
              lastCalculationRef.current.endTime // Start from previous end time
            );
            
            // Filter out any conjunctions that might overlap with existing ones
            const newUniqueConjunctions = newConjunctions.filter(newConj => 
              !filteredConjunctions.some(existingConj => 
                (newConj.island1Id === existingConj.island1Id && newConj.island2Id === existingConj.island2Id &&
                 Math.abs(newConj.startTime - existingConj.startTime) < 3600) || // Within 1 hour
                (newConj.island1Id === existingConj.island2Id && newConj.island2Id === existingConj.island1Id &&
                 Math.abs(newConj.startTime - existingConj.startTime) < 3600)
              )
            );
            
            // Sort all conjunctions by start time without limiting
            const sortedConjunctions = [
              ...filteredConjunctions,
              ...newUniqueConjunctions
            ].sort((a, b) => a.startTime - b.startTime);
            
            // Update the conjunctions state
            setConjunctions(sortedConjunctions);
            
            // Update the last calculation reference
            lastCalculationRef.current = {
              ...lastCalculationRef.current,
              startTime: currentTime,
              endTime: newEndTime
            };
            
            calculationTimerRef.current = null;
          }, 10);
        } else if (hasRemovedConjunctions) {
          // Time hasn't changed (or zero increment) but we removed past conjunctions
          setConjunctions(filteredConjunctions);
        }
      }
    };
    
    calculateConjunctions();
    
    // Store current time for comparison in next update
    prevTimeRef.current = currentTime;
    
    return () => {
      if (calculationTimerRef.current !== null) {
        clearTimeout(calculationTimerRef.current);
      }
    };
  }, [simulator, islands, currentTime]);
  
  // Initial calculation on component mount or island change
  useEffect(() => {
    // Use timer to allow UI to update
    calculationTimerRef.current = window.setTimeout(() => {
      // Calculate maximum look ahead period (10 years in days)
      const maxLookAheadDays = MAX_YEARS * 365;
      
      // Calculate all potential conjunctions within the look ahead period
      const allConjunctions = simulator.calculateUpcomingConjunctions(maxLookAheadDays);
      
      // Store all conjunctions without limiting
      setConjunctions(allConjunctions);
      
      // Get current visible islands string
      const currentVisibleIslands = islands.filter(island => island.visible).map(island => island.id).sort().join(',');
      
      // Update reference
      lastCalculationRef.current = {
        startTime: currentTime,
        endTime: currentTime + (maxLookAheadDays * 1000),
        islandCount: islands.length,
        visibleIslands: currentVisibleIslands
      };
      
      calculationTimerRef.current = null;
    }, 10);
    
    return () => {
      if (calculationTimerRef.current !== null) {
        clearTimeout(calculationTimerRef.current);
      }
    };
  }, [simulator, islands.length, currentTime]);
  
  // Filter conjunctions to show active and upcoming ones between visible islands
  const filteredConjunctions = conjunctions
    .filter(conj => 
      conj.endTime >= currentTime &&
      islands.find(i => i.id === conj.island1Id)?.visible &&
      islands.find(i => i.id === conj.island2Id)?.visible // Only include conjunctions between visible islands
    )
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, MAX_CONJUNCTIONS); // Apply limit AFTER filtering
  
  // Format distance for display
  const formatDistance = (distance: number): string => {
    return `${distance.toFixed(1)} miles`;
  };
  
  // Check if a conjunction is currently active
  const isConjunctionActive = (conjunction: Conjunction): boolean => {
    return currentTime >= conjunction.startTime && currentTime <= conjunction.endTime;
  };
  
  // Handler for when a time button is clicked
  const handleTimeButtonClick = (time: number) => {
    if (setTime && setIsPlaying) {
      setTime(time);
      setIsPlaying(false); // Pause the simulation
    }
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Conjunctions between Islands
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A conjunction occurs when two islands come within 50 miles of each other.
        Showing the next {MAX_CONJUNCTIONS} conjunctions between visible islands (up to {MAX_YEARS} years ahead).
      </Typography>
      
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <StyledTableCell>Islands</StyledTableCell>
              <StyledTableCell>Start</StyledTableCell>
              <StyledTableCell>End</StyledTableCell>
              <StyledTableCell>Duration</StyledTableCell>
              <StyledTableCell>Min. Distance</StyledTableCell>
              <StyledTableCell>Min. Distance At</StyledTableCell>
              <StyledTableCell>Status</StyledTableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredConjunctions.length > 0 ? (
              filteredConjunctions.map((conjunction) => {
                const isActive = isConjunctionActive(conjunction);
                const RowComponent = isActive ? ActiveConjunctionRow : TableRow;
                
                return (
                  <RowComponent key={conjunction.id}>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Chip 
                          size="small"
                          label={conjunction.island1Name} 
                          sx={{ 
                            bgcolor: islands.find(i => i.id === conjunction.island1Id)?.color,
                            color: 'white'
                          }}
                        />
                        <Typography variant="body2">&</Typography>
                        <Chip 
                          size="small"
                          label={conjunction.island2Name} 
                          sx={{ 
                            bgcolor: islands.find(i => i.id === conjunction.island2Id)?.color,
                            color: 'white'
                          }}
                        />
                      </Stack>
                    </TableCell>
                    <TimeCell>
                      {formatTime(conjunction.startTime)}
                      {setTime && setIsPlaying && (
                        <Tooltip title="Set time to conjunction start">
                          <TimeButton 
                            size="small"
                            onClick={() => handleTimeButtonClick(conjunction.startTime)}
                          >
                            <AccessTimeIcon fontSize="small" />
                          </TimeButton>
                        </Tooltip>
                      )}
                    </TimeCell>
                    <TimeCell>
                      {formatTime(conjunction.endTime)}
                      {setTime && setIsPlaying && (
                        <Tooltip title="Set time to conjunction end">
                          <TimeButton 
                            size="small"
                            onClick={() => handleTimeButtonClick(conjunction.endTime)}
                          >
                            <AccessTimeIcon fontSize="small" />
                          </TimeButton>
                        </Tooltip>
                      )}
                    </TimeCell>
                    <TableCell>{formatDuration(conjunction.duration)}</TableCell>
                    <TableCell>{formatDistance(conjunction.minDistance)}</TableCell>
                    <TimeCell>
                      {formatTime(conjunction.minDistanceTime)}
                      {setTime && setIsPlaying && (
                        <Tooltip title="Set time to minimum distance point">
                          <TimeButton 
                            size="small"
                            onClick={() => handleTimeButtonClick(conjunction.minDistanceTime)}
                          >
                            <AccessTimeIcon fontSize="small" />
                          </TimeButton>
                        </Tooltip>
                      )}
                    </TimeCell>
                    <TableCell>
                      {isActive ? (
                        <Chip 
                          size="small" 
                          label="ACTIVE" 
                          color="success"
                        />
                      ) : (
                        conjunction.startTime < currentTime ? (
                          <Chip 
                            size="small" 
                            label="PAST" 
                            color="default"
                          />
                        ) : (
                          <Chip 
                            size="small" 
                            label="UPCOMING" 
                            color="primary"
                          />
                        )
                      )}
                    </TableCell>
                  </RowComponent>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" sx={{ py: 2 }}>
                    No active or upcoming conjunctions found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Box sx={{ mt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Note: Conjunction times are calculated with precision of 0.05 days (about 1.2 hours).
          Changes to island orbits will affect future conjunction predictions.
        </Typography>
      </Box>
    </Box>
  );
};

export default ConjunctionsPanel; 