import React, { useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { Island, Journey } from '../utils/sim';
import { formatTime, formatDuration } from '../utils/timeFormat';

interface JourneyPlannerProps {
  islands: Island[];
  isPlaying: boolean;
  sourceIslandId: number | null;
  setSourceIslandId: (id: number | null) => void;
  destinationIslandId: number | null;
  setDestinationIslandId: (id: number | null) => void;
  journeySpeed: number;
  setJourneySpeed: (speed: number) => void;
  activeJourney: Journey | null;
  clearJourney: () => void;
  setSourceIslandIdAndCalculate: (id: number | null) => void;
  setDestinationIslandIdAndCalculate: (id: number | null) => void;
  activeJourneys: Journey[];
  addActiveJourney: () => void;
  deleteJourney: (id: number) => void;
  simulator: any;
  time: number;
}

const JourneyPlanner: React.FC<JourneyPlannerProps> = ({
  islands,
  isPlaying,
  sourceIslandId,
  destinationIslandId,
  journeySpeed,
  setJourneySpeed,
  activeJourney,
  clearJourney,
  setSourceIslandIdAndCalculate,
  setDestinationIslandIdAndCalculate,
  activeJourneys,
  addActiveJourney,
  deleteJourney,
  simulator,
  time
}) => {
  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = Math.max(1, parseInt(e.target.value) || 0);
    setJourneySpeed(newSpeed);
  }, [setJourneySpeed]);

  // Helper to get island name
  const getIslandName = (islandId: number): string => {
    const island = islands.find(i => i.id === islandId);
    return island ? island.name : 'Unknown';
  };

  // Helper to get journey progress
  const getJourneyProgress = (journey: Journey) => {
    return simulator.getJourneyProgress(journey);
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="medium">
          Journey Planner
        </Typography>
      </Box>
      
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="subtitle2" gutterBottom>
            Source Island
          </Typography>
          <Paper 
            variant="outlined" 
            sx={{ 
              height: 200, 
              overflow: 'auto',
              p: 1
            }}
          >
            {islands.filter(island => island.visible).map(island => (
              <Box
                key={`source-${island.id}`}
                onClick={() => destinationIslandId !== island.id && setSourceIslandIdAndCalculate(island.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1,
                  mb: 0.5,
                  borderRadius: 1,
                  cursor: destinationIslandId === island.id ? 'not-allowed' : 'pointer',
                  bgcolor: sourceIslandId === island.id ? 'primary.light' : 'background.paper',
                  opacity: destinationIslandId === island.id ? 0.5 : 1,
                  '&:hover': {
                    bgcolor: destinationIslandId === island.id 
                      ? 'background.paper' 
                      : sourceIslandId === island.id 
                        ? 'primary.light' 
                        : 'action.hover',
                  }
                }}
              >
                <Box 
                  sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    bgcolor: island.color,
                    mr: 1
                  }}
                />
                <Typography 
                  variant="body2"
                  sx={{
                    textDecoration: destinationIslandId === island.id ? 'line-through' : 'none'
                  }}
                >
                  {island.name}
                  {destinationIslandId === island.id && ' (selected as destination)'}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Grid>
        
        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="subtitle2" gutterBottom>
            Destination Island
          </Typography>
          <Paper 
            variant="outlined" 
            sx={{ 
              height: 200, 
              overflow: 'auto',
              p: 1
            }}
          >
            {islands.filter(island => island.visible).map(island => (
              <Box
                key={`dest-${island.id}`}
                onClick={() => sourceIslandId !== island.id && setDestinationIslandIdAndCalculate(island.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1,
                  mb: 0.5,
                  borderRadius: 1,
                  cursor: sourceIslandId === island.id ? 'not-allowed' : 'pointer',
                  bgcolor: destinationIslandId === island.id ? 'primary.light' : 'background.paper',
                  opacity: sourceIslandId === island.id ? 0.5 : 1,
                  '&:hover': {
                    bgcolor: sourceIslandId === island.id 
                      ? 'background.paper' 
                      : destinationIslandId === island.id 
                        ? 'primary.light' 
                        : 'action.hover',
                  }
                }}
              >
                <Box 
                  sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    bgcolor: island.color,
                    mr: 1
                  }}
                />
                <Typography 
                  variant="body2"
                  sx={{
                    textDecoration: sourceIslandId === island.id ? 'line-through' : 'none'
                  }}
                >
                  {island.name}
                  {sourceIslandId === island.id && ' (selected as source)'}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Grid>
        
        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="subtitle2" gutterBottom>
            Journey Settings
          </Typography>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2,
              height: 200,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <TextField
              label="Speed (mph)"
              type="number"
              value={journeySpeed}
              onChange={handleSpeedChange}
              inputProps={{ min: 1 }}
              size="small"
              sx={{ width: '100%', mb: 2 }}
            />
            
            {activeJourney ? (
              <Box sx={{ mt: 'auto', display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={addActiveJourney}
                  sx={{ flexGrow: 1 }}
                >
                  Add Journey
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={clearJourney}
                >
                  Clear
                </Button>
              </Box>
            ) : (
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ 
                  mt: 2,
                  fontStyle: 'italic'
                }}
              >
                {!sourceIslandId 
                  ? "Select a source island to begin" 
                  : !destinationIslandId 
                    ? "Now select a destination island" 
                    : "Calculating journey..."}
              </Typography>
            )}
          </Paper>
        </Grid>
        
        {activeJourney && activeJourney.status === 'predicted' && (
          <Grid size={{ xs: 12 }}>
            <Box sx={{ mt: 2, p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom>
                Predicted Route
              </Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 6, md: 2 }}>
                  <Typography variant="caption" fontWeight="medium" display="block">Distance:</Typography>
                  <Typography variant="body2">{activeJourney.distance.toFixed(0)} miles</Typography>
                </Grid>
                
                <Grid size={{ xs: 6, md: 2 }}>
                  <Typography variant="caption" fontWeight="medium" display="block">Duration:</Typography>
                  <Typography variant="body2">{formatDuration(activeJourney.duration)}</Typography>
                </Grid>
                
                <Grid size={{ xs: 6, md: 2 }}>
                  <Typography variant="caption" fontWeight="medium" display="block">Average Speed:</Typography>
                  <Typography variant="body2">
                    {activeJourney.speed} mph ({(activeJourney.speed * 24).toFixed(0)} mi/day)
                  </Typography>
                </Grid>
                
                <Grid size={{ xs: 6, md: 2 }}>
                  <Typography variant="caption" fontWeight="medium" display="block">Direction:</Typography>
                  <Typography variant="body2">
                    {activeJourney.isClockwise ? "Clockwise" : "Counterclockwise"}
                  </Typography>
                </Grid>
                
                <Grid size={{ xs: 6, md: 2 }}>
                  <Typography variant="caption" fontWeight="medium" display="block">Arrival at:</Typography>
                  <Typography variant="body2">{formatTime(activeJourney.arrivalTime)}</Typography>
                </Grid>
              </Grid>
            </Box>
          </Grid>
        )}
        
        {activeJourneys.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Active Journeys
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell>Progress</TableCell>
                      <TableCell>ETA</TableCell>
                      <TableCell>Distance Left</TableCell>
                      <TableCell>Speed</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeJourneys.map(journey => {
                      if (journey.status === 'completed') return null;
                      
                      const progress = getJourneyProgress(journey);
                      
                      return (
                        <TableRow key={journey.id}>
                          <TableCell>{getIslandName(journey.sourceId)}</TableCell>
                          <TableCell>{getIslandName(journey.destinationId)}</TableCell>
                          <TableCell>{`${progress.progress.toFixed(0)}%`}</TableCell>
                          <TableCell>{formatDuration(progress.remainingTime)}</TableCell>
                          <TableCell>{`${progress.remainingDistance.toFixed(0)} mi`}</TableCell>
                          <TableCell>{`${journey.speed} mph`}</TableCell>
                          <TableCell>
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => deleteJourney(journey.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
};

export default JourneyPlanner; 