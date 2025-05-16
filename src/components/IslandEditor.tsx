import React from 'react';
import { Grid, Box, Button, Stack } from '@mui/material';
import { Island, Epicycle } from '../utils/sim';
import IslandForm from './IslandForm';
import IslandList from './IslandList';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';

interface IslandEditorProps {
  islands: Island[];
  islandName: string;
  setIslandName: (name: string) => void;
  islandColor: string;
  setIslandColor: (color: string) => void;
  epicycles: Epicycle[];
  setEpicycles: (epicycles: Epicycle[]) => void;
  addIsland: () => void;
  editMode: boolean;
  resetIslandForm: () => void;
  toggleIslandVisibility: (islandId: number) => void;
  editIsland: (island: Island) => void;
  deleteIsland: (islandId: number) => void;
  calculateMilesRadius: (period: number) => number;
  setIslands: (islands: Island[]) => void;
}

const IslandEditor: React.FC<IslandEditorProps> = ({
  islands,
  islandName,
  setIslandName,
  islandColor,
  setIslandColor,
  epicycles,
  setEpicycles,
  addIsland,
  editMode,
  resetIslandForm,
  toggleIslandVisibility,
  editIsland,
  deleteIsland,
  calculateMilesRadius,
  setIslands
}) => {
  // Create file input ref for the upload functionality
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Handle file upload for importing islands
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = e.target?.result as string;
        const importedIslands = JSON.parse(jsonData) as Island[];
        
        // Ensure imported data has required Island structure
        if (Array.isArray(importedIslands) && importedIslands.length > 0) {
          // Validate island structure (basic validation)
          const validIslands = importedIslands.filter(island => 
            island && typeof island.id === 'number' && 
            typeof island.name === 'string' && 
            Array.isArray(island.cycles)
          );
          
          if (validIslands.length > 0) {
            setIslands(validIslands);
          } else {
            alert('Invalid island data format');
          }
        } else {
          alert('No valid islands found in the imported file');
        }
      } catch (error) {
        alert('Error parsing JSON file: ' + (error instanceof Error ? error.message : String(error)));
      }
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    
    reader.readAsText(file);
  };
  
  // Handle downloading islands as JSON
  const handleDownloadIslands = () => {
    // Create a JSON string from the islands
    const jsonData = JSON.stringify(islands, null, 2);
    
    // Create a blob from the JSON data
    const blob = new Blob([jsonData], { type: 'application/json' });
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'skydrift-islands.json';
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Grid container spacing={3}>
      {/* Island Configuration */}
      <Grid size={{xs: 12, md: 6}}>
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              Import Islands
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadIslands}
              disabled={islands.length === 0}
            >
              Export Islands
            </Button>
            
            {/* Hidden file input for upload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="application/json"
              style={{ display: 'none' }}
            />
          </Stack>
        </Box>
        <IslandForm
          islandName={islandName}
          setIslandName={setIslandName}
          islandColor={islandColor}
          setIslandColor={setIslandColor}
          epicycles={epicycles}
          setEpicycles={setEpicycles}
          addIsland={addIsland}
          editMode={editMode}
          resetIslandForm={resetIslandForm}
          calculateMilesRadius={calculateMilesRadius}
        />
      </Grid>
      
      {/* Island List */}
      <Grid size={{xs: 12, md: 6}}>
        <IslandList
          islands={islands}
          toggleIslandVisibility={toggleIslandVisibility}
          editIsland={editIsland}
          deleteIsland={deleteIsland}
        />
      </Grid>
    </Grid>
  );
};

export default IslandEditor; 