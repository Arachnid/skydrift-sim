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
  }>({
    startTime: -1,
    endTime: -1,
    islandCount: 0
  });
  
  // Reference to track if we're in a continuous playback
  const isPlayingRef = useRef<boolean>(false);
  
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
      // Track if we're in continuous playback (small, regular time increments)
      const timeIncrement = currentTime - prevTimeRef.current;
      const isPlaying = timeIncrement > 0 && timeIncrement < 100; // Threshold for detecting continuous play
      isPlayingRef.current = isPlaying;
      
      // Check if islands have changed
      const currentIslandCount = islands.length;
      
      // Calculate maximum look ahead period (10 years in days)
      const maxLookAheadDays = MAX_YEARS * 365;
      
      // Calculate the end time for the current look ahead window
      const currentEndTime = currentTime + (maxLookAheadDays * 1000);
      
      // Detect time jumps (manual entry, skip forward/back)
      const isTimeJump = Math.abs(timeIncrement) > 100 || timeIncrement < 0;
      
      // Recalculate everything from scratch in these cases:
      // 1. First calculation (lastCalculationRef.current.startTime === -1)
      // 2. Islands have changed (added/removed)
      // 3. Manual time jump (not continuous playback)
      const needsFullRecalculation = 
        lastCalculationRef.current.startTime === -1 ||
        currentIslandCount !== lastCalculationRef.current.islandCount ||
        isTimeJump;
      
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
            islandCount: currentIslandCount
          };
          
          calculationTimerRef.current = null;
        }, 10);
      } else if (isPlaying && currentTime > lastCalculationRef.current.startTime) {
        // For continuous playback, only calculate new conjunctions at the extended end
        
        // Calculate only the new time slice
        const additionalTimeToCheck = timeIncrement; // ms of time that has passed
        const newEndTime = lastCalculationRef.current.endTime + additionalTimeToCheck;
        
        // No need to show calculating indicator for incremental updates
        const newConjunctions = simulator.calculateUpcomingConjunctions(
          additionalTimeToCheck / 1000, // Convert ms to days
          lastCalculationRef.current.endTime // Start from previous end time
        );
        
        // Filter out any conjunctions that might overlap with existing ones
        const newUniqueConjunctions = newConjunctions.filter(newConj => 
          !conjunctions.some(existingConj => 
            (newConj.island1Id === existingConj.island1Id && newConj.island2Id === existingConj.island2Id &&
             Math.abs(newConj.startTime - existingConj.startTime) < 3600) || // Within 1 hour
            (newConj.island1Id === existingConj.island2Id && newConj.island2Id === existingConj.island1Id &&
             Math.abs(newConj.startTime - existingConj.startTime) < 3600)
          )
        );
        
        // Filter out conjunctions that are now in the past
        const updatedConjunctions = [
          ...conjunctions,
          ...newUniqueConjunctions
        ].filter(conj => conj.endTime >= currentTime - 86400); // Keep conjunctions that ended within the last day
        
        // Sort all conjunctions by start time without limiting
        const sortedConjunctions = updatedConjunctions.sort((a, b) => a.startTime - b.startTime);
        
        // Update the conjunctions state
        setConjunctions(sortedConjunctions);
        
        // Update the last calculation reference
        lastCalculationRef.current = {
          ...lastCalculationRef.current,
          startTime: currentTime,
          endTime: newEndTime
        };
      }
    };
    
    calculateConjunctions();
    
    // Store current time for comparison in next update
    prevTimeRef.current = currentTime;
    
    // Set up interval for recalculation during continuous playback
    const intervalId = setInterval(() => {
      if (isPlayingRef.current) {
        calculateConjunctions();
      }
    }, 5000);
    
    return () => {
      clearInterval(intervalId);
      if (calculationTimerRef.current !== null) {
        clearTimeout(calculationTimerRef.current);
      }
    };
  }, [simulator, islands, currentTime, conjunctions]);
  
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
      
      // Update reference
      lastCalculationRef.current = {
        startTime: currentTime,
        endTime: currentTime + (maxLookAheadDays * 1000),
        islandCount: islands.length
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