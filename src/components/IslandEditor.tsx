import React from 'react';
import { Grid } from '@mui/material';
import { Island, Epicycle } from '../utils/sim';
import IslandForm from './IslandForm';
import IslandList from './IslandList';

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
  calculateMilesRadius
}) => {
  return (
    <Grid container spacing={3}>
      {/* Island Configuration */}
      <Grid size={{ xs: 12, md: 6 }}>
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
      <Grid size={{ xs: 12, md: 6 }}>
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