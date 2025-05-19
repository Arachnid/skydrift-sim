import React, { useState } from 'react';
import { Button, Snackbar, Alert, Badge } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import SkydriftArchipelagoSimulator from '../utils/sim';

interface ShareSimulationButtonProps {
  simulator: SkydriftArchipelagoSimulator;
  time: number;
  islands: any[];
  activeJourneys: any[];
}

const ShareSimulationButton: React.FC<ShareSimulationButtonProps> = ({
  simulator,
  time,
  islands,
  activeJourneys
}) => {
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [shareStatus, setShareStatus] = useState<'success' | 'error'>('success');
  const [shareMessage, setShareMessage] = useState('Simulation URL copied to clipboard!');

  const handleShareClick = () => {
    try {
      // Create the URL with parameters
      const shareUrl = new URL(window.location.href);
      
      // Clear any existing parameters
      Array.from(shareUrl.searchParams.keys()).forEach(key => {
        shareUrl.searchParams.delete(key);
      });
      
      // Set time parameter (in days for readability)
      const days = Math.floor(time / 1000);
      shareUrl.searchParams.set('day', days.toString());
      
      // Add visible islands parameter
      const visibleIslands = islands
        .filter(island => island && island.id && island.visible)
        .map(island => island.id.toString());
      
      if (visibleIslands.length > 0) {
        shareUrl.searchParams.set('islands', visibleIslands.join('-'));
      }
      
      // Add journeys parameter
      const activeJourneyParams = activeJourneys
        .filter(journey => journey && journey.sourceId && journey.destinationId)
        .map(journey => `${journey.sourceId}_${journey.destinationId}_${journey.speed}`);
      
      if (activeJourneyParams.length > 0) {
        shareUrl.searchParams.set('journeys', activeJourneyParams.join('-'));
      }
      
      // Copy to clipboard
      navigator.clipboard.writeText(shareUrl.toString())
        .then(() => {
          setShareStatus('success');
          setShareMessage(`Simulation URL copied! (Day ${days})`);
          setOpenSnackbar(true);
          
          // Don't update browser URL - this will be handled only when the URL is loaded
        })
        .catch(err => {
          console.error('Failed to copy URL: ', err);
          setShareStatus('error');
          setShareMessage('Failed to copy URL to clipboard');
          setOpenSnackbar(true);
        });
    } catch (error) {
      console.error('Error creating share URL:', error);
      setShareStatus('error');
      setShareMessage('Error creating share URL');
      setOpenSnackbar(true);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<ShareIcon />}
        onClick={handleShareClick}
        sx={{ mr: 1 }}
      >
        Share
      </Button>
      <Snackbar
        open={openSnackbar}
        autoHideDuration={3000}
        onClose={() => setOpenSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setOpenSnackbar(false)} severity={shareStatus} sx={{ width: '100%' }}>
          {shareMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ShareSimulationButton; 