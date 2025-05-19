import React from 'react';
import {
  Box,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  Slider,
  Typography,
  Paper,
  Stack
} from '@mui/material';

interface SettingsPanelProps {
  // Display settings
  showOrbits: boolean;
  setShowOrbits: (showOrbits: boolean) => void;
  showTrails: boolean;
  setShowTrails: (showTrails: boolean) => void;
  trailLength: number;
  setTrailLength: (length: number) => void;
  trailTickFrequency: number;
  setTrailTickFrequency: (frequency: number) => void;
  
  // Journey settings
  journeyTickMarkDays: number;
  setJourneyTickMarkDays: (days: number) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  showOrbits,
  setShowOrbits,
  showTrails,
  setShowTrails,
  trailLength,
  setTrailLength,
  trailTickFrequency,
  setTrailTickFrequency,
  journeyTickMarkDays,
  setJourneyTickMarkDays
}) => {
  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        {/* Display Settings */}
        <Grid size={{xs: 12, md: 6}}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Display Settings</Typography>
            <Divider sx={{ mb: 2 }} />
            
            {/* Orbits */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={showOrbits}
                  onChange={() => setShowOrbits(!showOrbits)}
                />
              }
              label="Show Orbits"
            />
            
            {/* Trail Settings */}
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showTrails}
                    onChange={() => setShowTrails(!showTrails)}
                  />
                }
                label="Show Trails"
              />
              
              <Box sx={{ ml: 4, mt: 1 }}>
                <Typography variant="body2" gutterBottom>
                  Trail Length (in days)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Slider
                    min={1}
                    max={60}
                    step={1}
                    value={trailLength / 1000} // Convert from milliseconds to days
                    onChange={(_, value) => setTrailLength((value as number) * 1000)}
                    sx={{ flexGrow: 1, mr: 2 }}
                    disabled={!showTrails}
                  />
                  <Typography variant="body2" sx={{ minWidth: 60 }}>
                    {trailLength / 1000} days
                  </Typography>
                </Box>
                
                <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
                  Trail Tick Frequency
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Slider
                    min={1}
                    max={20}
                    step={1}
                    value={trailTickFrequency}
                    onChange={(_, value) => setTrailTickFrequency(value as number)}
                    sx={{ flexGrow: 1, mr: 2 }}
                    disabled={!showTrails}
                  />
                  <Typography variant="body2" sx={{ minWidth: 60 }}>
                    Every {trailTickFrequency} days
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Higher values make trails look less dense but improve performance
                </Typography>
              </Box>
            </Box>
            
            {/* Journey Settings */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" fontWeight="500" gutterBottom>
                Journey Settings
              </Typography>
              <Box sx={{ ml: 4 }}>
                <Typography variant="body2" gutterBottom>
                  Journey Tick Mark Frequency
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={journeyTickMarkDays}
                    onChange={(_, value) => setJourneyTickMarkDays(value as number)}
                    sx={{ flexGrow: 1, mr: 2 }}
                  />
                  <Typography variant="body2" sx={{ minWidth: 90 }}>
                    Every {journeyTickMarkDays} day{journeyTickMarkDays !== 1 ? 's' : ''}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Controls how frequently tick marks appear on journey paths
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
        
        {/* Additional Settings Panel (placeholder for future settings) */}
        <Grid size={{xs: 12, md: 6}}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Help</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="body2" paragraph>
              <strong>Orbits:</strong> Shows the orbital paths of each island.
            </Typography>
            
            <Typography variant="body2" paragraph>
              <strong>Trails:</strong> Shows the future path of each island for the specified number of days.
            </Typography>
            
            <Typography variant="body2" paragraph>
              <strong>Trail Tick Frequency:</strong> Controls how often tick markers appear on trails. Each tick represents the specified number of days into the future.
            </Typography>
            
            <Typography variant="body2" paragraph>
              <strong>Journey Tick Mark Frequency:</strong> Controls how often tick markers appear on journey paths. Each tick represents the specified number of days into the journey.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SettingsPanel;