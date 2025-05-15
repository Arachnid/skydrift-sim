import React from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Island } from '../utils/sim';

interface IslandListProps {
  islands: Island[];
  toggleIslandVisibility: (islandId: number) => void;
  editIsland: (island: Island) => void;
  deleteIsland: (islandId: number) => void;
}

const IslandList: React.FC<IslandListProps> = ({
  islands,
  toggleIslandVisibility,
  editIsland,
  deleteIsland
}) => {
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
        Island List
      </Typography>
      <Stack 
        spacing={1.5} 
        sx={{ 
          maxHeight: 400, 
          overflow: 'auto',
          pr: 1
        }}
      >
        {islands.map((island) => (
          <Paper 
            key={`list-${island.id}`} 
            variant="outlined"
            sx={{ p: 2, display: 'flex', alignItems: 'center' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
              <Button
                size="small"
                onClick={() => toggleIslandVisibility(island.id)}
                sx={{ minWidth: 'auto', p: 0.5 }}
              >
                {island.visible ? 
                  <VisibilityIcon fontSize="small" /> : 
                  <VisibilityOffIcon fontSize="small" color="disabled" />
                }
              </Button>
              <Box 
                sx={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: '50%', 
                  bgcolor: island.color,
                  ml: 1
                }}
              />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body1" fontWeight="medium">
                {island.name}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button 
                variant="contained"
                color="primary"
                size="small"
                onClick={() => editIsland(island)}
                startIcon={<EditIcon />}
              >
                Edit
              </Button>
              <Button 
                variant="contained"
                color="error"
                size="small"
                onClick={() => deleteIsland(island.id)}
                startIcon={<DeleteIcon />}
              >
                Delete
              </Button>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};

export default IslandList; 