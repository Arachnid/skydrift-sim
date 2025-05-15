import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Slider,
  Stack,
  TextField,
  Typography,
  Paper
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';

interface TimeControlPanelProps {
  time: number;
  setTime: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  showOrbits: boolean;
  setShowOrbits: (showOrbits: boolean) => void;
  showTrails: boolean;
  setShowTrails: (showTrails: boolean) => void;
  calculateSystemPeriod: () => number;
  resetSimulation: () => void;
  jumpTime: (amount: number) => void;
}

const TimeControlPanel: React.FC<TimeControlPanelProps> = ({
  time,
  setTime,
  isPlaying,
  setIsPlaying,
  speed,
  setSpeed,
  showOrbits,
  setShowOrbits,
  showTrails,
  setShowTrails,
  calculateSystemPeriod,
  resetSimulation,
  jumpTime
}) => {
  return (
    <Stack spacing={3} sx={{ mb: 3 }}>
      <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
        <Stack direction="row" spacing={1}>
          <Button 
            variant="contained"
            color="primary"
            onClick={() => setIsPlaying(!isPlaying)}
            startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          >
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button 
            variant="contained"
            color="secondary"
            onClick={resetSimulation}
            startIcon={<RestartAltIcon />}
          >
            Reset
          </Button>
        </Stack>
        
        <Stack direction="row" spacing={1}>
          <Button 
            variant="contained"
            color="info"
            onClick={() => jumpTime(-10000)}
            startIcon={<FastRewindIcon />}
          >
            -10 days
          </Button>
          <Button 
            variant="contained"
            color="info"
            onClick={() => jumpTime(-1000)}
            startIcon={<FastRewindIcon />}
          >
            -1 day
          </Button>
          <Button 
            variant="contained"
            color="info"
            onClick={() => jumpTime(1000)}
            endIcon={<FastForwardIcon />}
          >
            1 day
          </Button>
          <Button 
            variant="contained"
            color="info"
            onClick={() => jumpTime(10000)}
            endIcon={<FastForwardIcon />}
          >
            10 days
          </Button>
        </Stack>
        
        <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
          <FormControlLabel
            control={
              <Checkbox
                checked={showOrbits}
                onChange={() => setShowOrbits(!showOrbits)}
              />
            }
            label="Show Orbits"
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={showTrails}
                onChange={() => setShowTrails(!showTrails)}
              />
            }
            label="Show Trails"
          />
          
          <Box sx={{ width: 320, display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 1 }}>Speed:</Typography>
            <Slider
              min={0.1}
              max={10}
              step={0.1}
              value={speed}
              onChange={(_, value) => setSpeed(value as number)}
              sx={{ mx: 1 }}
            />
            <Typography variant="body2" sx={{ ml: 1, minWidth: 100 }}>
              {speed.toFixed(1)} days/sec
            </Typography>
          </Box>
        </Stack>
      </Stack>
      
      {/* Day Control */}
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="body2">Day:</Typography>
        <TextField
          type="number"
          value={Math.floor((time / 1000) * 100) / 100}
          onChange={(e) => {
            const newTime = parseFloat(e.target.value) * 1000;
            if (!isNaN(newTime) && !isPlaying) {
              setTime(newTime);
            }
          }}
          onBlur={(e) => {
            // Format with 2 decimal places on blur
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
              e.target.value = value.toFixed(2);
            }
          }}
          disabled={isPlaying}
          size="small"
          inputProps={{ step: "1", min: "0" }}
          sx={{ width: 100 }}
        />
        
        {/* Total System Period Display */}
        <Paper sx={{ ml: 2, px: 2, py: 1, backgroundColor: 'primary.light', color: 'primary.contrastText' }} variant="outlined">
          <Typography variant="caption" fontWeight="medium">System Period: </Typography>
          <Typography variant="caption">{calculateSystemPeriod().toFixed(2)} days</Typography>
        </Paper>
      </Stack>
    </Stack>
  );
};

export default TimeControlPanel; 