import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Slider,
  Stack,
  TextField,
  Typography,
  Paper,
  Alert
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import { formatTime, formatDuration, parseTimeString } from '../utils/timeFormat';

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
  resetSimulation,
  jumpTime
}) => {
  // Format the time display for the UI
  const formattedTime = formatTime(time);
  
  // State for input field and validation
  const [dateInput, setDateInput] = useState(formattedTime);
  const [dateError, setDateError] = useState('');

  // Update date input when time changes
  useEffect(() => {
    setDateInput(formattedTime);
  }, [time]);
  
  // Handle date input change
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateInput(e.target.value);
    setDateError('');
  };
  
  // Handle date input blur (validate and apply)
  const handleDateInputBlur = () => {
    if (!isPlaying) {
      const parsedTime = parseTimeString(dateInput);
      
      if (parsedTime !== null) {
        setTime(parsedTime);
        // Update the input field with the formatted time to ensure consistency
        setDateInput(formatTime(parsedTime));
        setDateError('');
      } else {
        setDateError('Invalid date format. Use yyyy-mm-dd [h]h');
        // Reset the input to the current time
        setDateInput(formattedTime);
      }
    }
  };
  
  // Handle date input keypress
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleDateInputBlur();
    }
  };
  
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
      
      {/* Time Controls */}
      <Stack direction="row" spacing={2} alignItems="center">
        {/* Date input field that updates with current time */}
        <TextField
          label="Current Time"
          value={dateInput}
          onChange={handleDateInputChange}
          onBlur={handleDateInputBlur}
          onKeyPress={handleKeyPress}
          disabled={isPlaying}
          size="small"
          placeholder="yyyy-mm-dd [h]h"
          sx={{ width: 180 }}
          helperText={dateError || "Format: yyyy-mm-dd [h]h"}
          error={!!dateError}
        />
      </Stack>
    </Stack>
  );
};

export default TimeControlPanel; 