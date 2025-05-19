import React from 'react';
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import EditIcon from '@mui/icons-material/Edit';
import { Epicycle } from '../utils/sim';

interface IslandFormProps {
  islandName: string;
  setIslandName: (name: string) => void;
  islandColor: string;
  setIslandColor: (color: string) => void;
  epicycles: Epicycle[];
  setEpicycles: (epicycles: Epicycle[]) => void;
  addIsland: () => void;
  editMode: boolean;
  resetIslandForm: () => void;
  calculateMilesRadius: (period: number) => number;
}

const IslandForm: React.FC<IslandFormProps> = ({
  islandName,
  setIslandName,
  islandColor,
  setIslandColor,
  epicycles,
  setEpicycles,
  addIsland,
  editMode,
  resetIslandForm,
  calculateMilesRadius
}) => {
  
  // Update epicycle value to handle both period and radius
  const updateEpicycle = (index: number, field: string, value: string): void => {
    const updatedEpicycles = [...epicycles];
    if (field === 'period') {
      const period = parseFloat(value);
      if (!isNaN(period) && period !== 0) {
        updatedEpicycles[index].period = period;
      }
    } else if (field === 'radius') {
      const radius = parseFloat(value);
      if (!isNaN(radius) && radius !== 0) {
        // Calculate period from radius
        const period = Math.pow(radius / 672, 3/2) * 365;
        updatedEpicycles[index].period = period;
      }
    }
    setEpicycles(updatedEpicycles);
  };

  // Format the value on blur
  const formatValueOnBlur = (index: number, field: string): void => {
    const updatedEpicycles = [...epicycles];
    if (field === 'period') {
      updatedEpicycles[index].period = parseFloat(updatedEpicycles[index].period.toFixed(1));
    } else if (field === 'radius') {
      const radius = calculateMilesRadius(updatedEpicycles[index].period);
      updatedEpicycles[index].period = Math.pow(radius / 672, 3/2) * 365;
    }
    setEpicycles(updatedEpicycles);
  };

  // Add a new epicycle to the form
  const addEpicycle = (): void => {
    setEpicycles([...epicycles, {
      period: 5
    }]);
  };
  
  // Remove the last epicycle from the form
  const removeEpicycle = (): void => {
    if (epicycles.length > 1) {
      setEpicycles(epicycles.slice(0, -1));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle1" fontWeight="medium">
        {editMode ? "Edit Island" : "Add New Island"}
      </Typography>
      <Stack direction="row" flexWrap="wrap" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="caption">Name</Typography>
          <TextField
            size="small"
            value={islandName}
            onChange={(e) => setIslandName(e.target.value)}
            placeholder="Island name"
            sx={{ width: 140 }}
          />
        </Box>
        
        <Stack direction="row" spacing={1} alignSelf="flex-end">
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={addEpicycle}
            startIcon={<AddIcon />}
          >
            Add Epicycle
          </Button>
          
          <Button
            variant="contained"
            color="error"
            size="small"
            onClick={removeEpicycle}
            disabled={epicycles.length <= 1}
            startIcon={<RemoveIcon />}
          >
            Remove Epicycle
          </Button>
        </Stack>
      </Stack>
      
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight="medium" gutterBottom>
          Epicycles ({epicycles.length})
        </Typography>
        <Stack spacing={2}>
          {epicycles.map((epicycle, index) => (
            <Box 
              key={`epicycle-form-${index}`} 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2, 
                borderLeft: '4px solid', 
                borderColor: islandColor || 'primary.main',
                pl: 2,
                py: 1
              }}
            >
              <Typography variant="caption" fontWeight="medium">
                {index === 0 ? "Primary" : index === 1 ? "Secondary" : `Level ${index+1}`}
              </Typography>
              <Box>
                <Typography variant="caption" display="block">Period (days)</Typography>
                <TextField
                  type="number"
                  size="small"
                  value={epicycle.period}
                  onChange={(e) => updateEpicycle(index, 'period', e.target.value)}
                  onBlur={() => formatValueOnBlur(index, 'period')}
                  inputProps={{ step: "0.5" }}
                  placeholder="Period"
                  sx={{ width: 100 }}
                />
              </Box>
              <Box>
                <Typography variant="caption" display="block">Radius (miles)</Typography>
                <TextField
                  type="number"
                  size="small"
                  value={calculateMilesRadius(epicycle.period).toFixed(1)}
                  onChange={(e) => updateEpicycle(index, 'radius', e.target.value)}
                  onBlur={() => formatValueOnBlur(index, 'radius')}
                  inputProps={{ step: "0.1" }}
                  placeholder="Radius"
                  sx={{ width: 100 }}
                />
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>
      
      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          color={editMode ? "warning" : "success"}
          onClick={addIsland}
          startIcon={editMode ? <EditIcon /> : <AddIcon />}
        >
          {editMode ? "Update Island" : "Add Island"}
        </Button>
        
        {editMode && (
          <Button
            variant="outlined"
            color="inherit"
            onClick={resetIslandForm}
          >
            Cancel
          </Button>
        )}
      </Stack>
    </Box>
  );
};

export default IslandForm; 