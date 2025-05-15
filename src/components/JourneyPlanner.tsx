import React, { useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  TextField,
  Typography
} from '@mui/material';
import UpdateIcon from '@mui/icons-material/Update';
import { Island, Journey } from '../utils/sim';

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
  setDestinationIslandIdAndCalculate
}) => {
  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = Math.max(1, parseInt(e.target.value) || 0);
    setJourneySpeed(newSpeed);
  }, [setJourneySpeed]);

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="medium">
          Journey Planner
        </Typography>
        {isPlaying && activeJourney && (
          <Chip
            color="primary"
            size="small"
            icon={<UpdateIcon />}
            label="Live updating"
            sx={{ 
              animation: 'pulse 1.5s infinite ease-in-out',
              '@keyframes pulse': {
                '0%': { opacity: 0.7 },
                '50%': { opacity: 1 },
                '100%': { opacity: 0.7 }
              }
            }}
          />
        )}
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
              <Button
                variant="outlined"
                color="inherit"
                onClick={clearJourney}
                sx={{ mt: 'auto' }}
              >
                Clear Journey
              </Button>
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
        
        {activeJourney && (
          <Grid size={{ xs: 12 }}>
            <Box sx={{ mt: 2, p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom>
                Journey Details
                {isPlaying && (
                  <Chip
                    color="info"
                    size="small"
                    icon={<UpdateIcon />}
                    label="Live"
                    sx={{ ml: 1, height: 20, '& .MuiChip-label': { px: 1 } }}
                  />
                )}
              </Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 6, md: 2 }}>
                  <Typography variant="caption" fontWeight="medium" display="block">Distance:</Typography>
                  <Typography variant="body2">{activeJourney.distance.toFixed(0)} miles</Typography>
                </Grid>
                
                <Grid size={{ xs: 6, md: 2 }}>
                  <Typography variant="caption" fontWeight="medium" display="block">Duration:</Typography>
                  <Typography variant="body2">{activeJourney.duration.toFixed(1)} days</Typography>
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
                  <Typography variant="caption" fontWeight="medium" display="block">Arrival on Day:</Typography>
                  <Typography variant="body2">{(activeJourney.arrivalTime / 1000).toFixed(1)}</Typography>
                </Grid>
              </Grid>
            </Box>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
};

export default JourneyPlanner; 