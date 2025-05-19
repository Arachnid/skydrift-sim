import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
  Chip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DirectionsBoatIcon from '@mui/icons-material/DirectionsBoat';
import TerrainIcon from '@mui/icons-material/Terrain';
import UpdateIcon from '@mui/icons-material/Update';
import FilterCenterFocusIcon from '@mui/icons-material/FilterCenterFocus';
import PrintIcon from '@mui/icons-material/Print';
import SettingsIcon from '@mui/icons-material/Settings';
import SkydriftArchipelagoSimulator, { Island, Epicycle, Position, Journey, Conjunction } from '../utils/sim';
import TimeControlPanel from './TimeControlPanel';
import SimulationCanvas from './SimulationCanvas';
import IslandEditor from './IslandEditor';
import JourneyPlanner from './JourneyPlanner';
import ConjunctionsPanel from './ConjunctionsPanel';
import PrintableSkyChartButton from './PrintableSkyChartButton';
import ShareSimulationButton from './ShareSimulationButton';
import SettingsPanel from './SettingsPanel';
// Import default islands from the JSON file
import defaultIslandsData from '../data/defaultIslands.json';

const SkydriftArchipelagoSimulation = () => {
  const theme = useTheme();
  
  // System-wide configuration
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 800 });
  const [CENTER_X, setCenterX] = useState(400);
  const [CENTER_Y, setCenterY] = useState(400);
  
  // Fixed scaling constant for internal coordinates (miles)
  // Set so that a period of 365 days has an orbital radius of 672 miles
  const MILES_SCALE_FACTOR = 672 / Math.pow(365, 2/3);
  
  // Viewport scaling for rendering
  const [viewportScale, setViewportScale] = useState(1);
  
  const SIMULATION_SPEED = 1;
  
  // Pleasing color palette
  const colorPalette = [
    "#4287f5", // Blue
    "#f54242", // Red
    "#42f5a7", // Mint Green
    "#f5a742", // Orange
    "#9e42f5", // Purple
    "#f542e5", // Pink
    "#42d7f5", // Cyan
    "#69f542", // Lime
    "#f5e942", // Yellow
    "#8442f5", // Indigo
    "#f55c42", // Coral
    "#42f584", // Light Green
    "#4275f5", // Royal Blue
    "#f542a1", // Hot Pink
    "#42f5d7"  // Turquoise
  ];

  // Create simulator instance
  const simulatorRef = useRef<SkydriftArchipelagoSimulator>(new SkydriftArchipelagoSimulator());
  
  // Cast the imported JSON to the correct type
  const defaultIslands = defaultIslandsData as Island[];
  
  // Island configuration state - use the imported default islands
  const [islands, setIslands] = useState<Island[]>(defaultIslands);
  
  // Calculate viewport scaling based on island positions and canvas size
  const calculateViewportScale = useCallback(() => {
    if (!islands || islands.length === 0) return 1;
    
    // Find the maximum radius needed by any island
    let maxRadiusSum = 0;
    
    islands.forEach(island => {
      let totalRadius = 0;
      island.cycles.forEach(cycle => {
        // Calculate radius in miles
        const radius = simulatorRef.current.calculateMilesRadius(cycle.period);
        totalRadius += radius;
      });
      
      if (totalRadius > maxRadiusSum) {
        maxRadiusSum = totalRadius;
      }
    });
    
    const targetPixelRadius = Math.min(canvasSize.width / 2, canvasSize.height / 2);
    
    // Calculate viewport scale to fit largest island orbit on screen
    if (maxRadiusSum > 0) {
      return targetPixelRadius / maxRadiusSum;
    }
    
    return 1;
  }, [islands, canvasSize]);
  
  // Update viewport scale whenever islands or canvas size changes
  const updateViewportScale = useCallback(() => {
    const newScale = calculateViewportScale();
    setViewportScale(newScale);
    return newScale;
  }, [calculateViewportScale]);
  
  // Time control state
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(SIMULATION_SPEED);
  
  // Display settings
  const [showOrbits, setShowOrbits] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [trailLength, setTrailLength] = useState(30000); // 30 days in milliseconds
  const [trailTickFrequency, setTrailTickFrequency] = useState(5); // Every 5 days by default
  
  // Journey settings
  const [journeyTickMarkDays, setJourneyTickMarkDays] = useState(1); // Days between journey tick marks
  
  // New island form state
  const [islandName, setIslandName] = useState("");
  const [islandColor, setIslandColor] = useState("");
  const [epicycles, setEpicycles] = useState<Epicycle[]>([
    { period: 250 },
    { period: -80 }  // Negative period for opposite direction
  ]);
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editingIslandId, setEditingIslandId] = useState<number | null>(null);
  
  // Animation frame reference
  const animationFrameRef = useRef<number | undefined>(undefined);
  const journeyAnimationFrameRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  // Journey planning state
  const [showJourneyPlanner, setShowJourneyPlanner] = useState(false);
  const [sourceIslandId, setSourceIslandId] = useState<number | null>(null);
  const [destinationIslandId, setDestinationIslandId] = useState<number | null>(null);
  const [journeySpeed, setJourneySpeed] = useState(8); // mph
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);
  const [activeJourneys, setActiveJourneys] = useState<Journey[]>([]);
  
  // Add state for tab management
  const [activeTab, setActiveTab] = useState<'island' | 'journey' | 'conjunction' | 'settings'>('conjunction');
  
  // Add a throttle reference to limit journey updates
  const throttleRef = useRef<number | null>(null);
  
  // Add a ref to store the latest journey calculation function
  const journeyCalculationRef = useRef<((srcId: number, destId: number) => void) | undefined>(undefined);

  // Update epicycle value
  const updateEpicycle = (index: number, field: string, value: string): void => {
    const updatedEpicycles = [...epicycles];
    if (field === 'period') {
      const period = parseFloat(value);
      if (!isNaN(period) && period !== 0) {
        updatedEpicycles[index].period = period;
      }
    }
    setEpicycles(updatedEpicycles);
  };
  
  // Update toggleIslandVisibility to remove drawCanvas call
  const toggleIslandVisibility = (islandId: number): void => {
    simulatorRef.current.toggleIslandVisibility(islandId);
    
    // Update the React state to match simulator
    setIslands([...simulatorRef.current.getIslands()]);
  };
  
  // Keep the calculateMilesRadius function as it's used directly in the UI
  const calculateMilesRadius = (period: number): number => {
    return simulatorRef.current.calculateMilesRadius(period);
  };

  // Parse shared URL if present
  useEffect(() => {
    const parseShareUrl = () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        
        // Check if we have any sharing parameters
        if (!searchParams.has('day') && !searchParams.has('islands') && !searchParams.has('journeys')) {
          return;
        }
        
        // Keep track if we've applied any parameters
        let appliedParameters = false;
        
        // Parse day parameter
        const dayParam = searchParams.get('day');
        if (dayParam !== null) {
          const day = parseInt(dayParam, 10);
          if (!isNaN(day)) {
            // Convert days to milliseconds (1 day = 1000ms in the simulation)
            const newTime = day * 1000;
            setTime(newTime);
            simulatorRef.current.setTime(newTime);
            
            // If simulation was playing, pause it when loading a shared state
            if (isPlaying) {
              setIsPlaying(false);
            }
            
            appliedParameters = true;
          }
        }
        
        // Parse islands parameter
        const islandsParam = searchParams.get('islands');
        if (islandsParam) {
          const visibleIslandIds = islandsParam.split('-').map(id => parseInt(id, 10));
          const updatedIslands = [...islands];
          let hasChanges = false;
          
          // First, set all islands to invisible
          updatedIslands.forEach(island => {
            if (island.visible) {
              island.visible = false;
              hasChanges = true;
            }
          });
          
          // Then make specified islands visible
          visibleIslandIds.forEach(id => {
            if (!isNaN(id)) {
              const islandIndex = updatedIslands.findIndex(island => island.id === id);
              if (islandIndex >= 0 && !updatedIslands[islandIndex].visible) {
                updatedIslands[islandIndex].visible = true;
                hasChanges = true;
              }
            }
          });
          
          // Only update islands if there were changes
          if (hasChanges) {
            simulatorRef.current.setIslands(updatedIslands);
            setIslands([...simulatorRef.current.getIslands()]);
            appliedParameters = true;
          }
        }
        
        // Parse journeys parameter
        const journeysParam = searchParams.get('journeys');
        if (journeysParam) {
          // Clear existing journeys first - get and delete all existing journeys 
          const existingJourneys = [...simulatorRef.current.getActiveJourneys()];
          existingJourneys.forEach(journey => {
            if (journey && journey.id) {
              simulatorRef.current.deleteJourney(journey.id);
            }
          });
          setActiveJourneys([]);
          
          // Add each journey from URL parameters
          const journeySpecs = journeysParam.split('-');
          let journeysAdded = 0;
          
          journeySpecs.forEach(spec => {
            const [srcStr, dstStr, spdStr] = spec.split('_');
            const sourceId = parseInt(srcStr, 10);
            const destId = parseInt(dstStr, 10);
            const speed = parseFloat(spdStr);
            
            if (isNaN(sourceId) || isNaN(destId) || isNaN(speed)) {
              return;
            }
            
            // Make sure islands exist
            const sourceIsland = islands.find(island => island.id === sourceId);
            const destIsland = islands.find(island => island.id === destId);
            
            if (!sourceIsland || !destIsland) {
              return;
            }
            
            const calculatedJourney = simulatorRef.current.calculateJourney(
              sourceId,
              destId,
              speed,
              false // Don't just predict, add a real journey
            );
            
            if (calculatedJourney) {
              simulatorRef.current.addJourney(calculatedJourney);
              journeysAdded++;
            }
          });
          
          // Update active journeys state if we added any journeys
          if (journeysAdded > 0) {
            setActiveJourneys([...simulatorRef.current.getActiveJourneys()]);
            appliedParameters = true;
          }
        }
        
        // Clear URL parameters if we've applied any to prevent repeated parsing
        if (appliedParameters) {
          // Use replaceState to update the URL without triggering a page reload
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch (error) {
        console.error('Error parsing shared URL:', error);
      }
    };

    // Parse URL when component first mounts
    parseShareUrl();

    // Listen for popstate events (back/forward browser navigation)
    const handlePopState = () => {
      parseShareUrl();
    };

    window.addEventListener('popstate', handlePopState);

    // Clean up event listener
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [islands, isPlaying, journeySpeed]);
  
  // Update time and positions in animation loop
  useEffect(() => {
    if (!isPlaying) return;
    
    const animate = (currentTime: number): void => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = currentTime;
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      
      // Update time based on speed
      setTime(prevTime => {
        const newTime = prevTime + deltaTime * speed;
        simulatorRef.current.setTime(newTime); // Update simulator time
        
        // Update active journey statuses
        const updatedJourneys = simulatorRef.current.updateJourneyStatuses();
        
        // Filter out completed journeys
        const activeOnes = updatedJourneys.filter(journey => journey.status === 'active');
        
        // Update state if there are any changes in journey statuses
        if (updatedJourneys.length !== activeOnes.length) {
          setActiveJourneys([...activeOnes]);
        }
        
        return newTime;
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        // When stopping animation, reset the last time reference to prevent time jumps
        lastTimeRef.current = 0;
      }
    };
  }, [isPlaying, speed]);

  // Also update simulator time when time is set directly
  useEffect(() => {
    simulatorRef.current.setTime(time);
  }, [time]);
  
  // Add the predicted journey to active journeys
  const addActiveJourney = useCallback(() => {
    if (activeJourney) {
      simulatorRef.current.addJourney(activeJourney);
      setActiveJourneys([...simulatorRef.current.getActiveJourneys()]);
      
      // Clear the active journey and selection
      setActiveJourney(null);
      setSourceIslandId(null);
      setDestinationIslandId(null);
      
      // Clear any pending journey calculations
      if (throttleRef.current !== null) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
      
      // Make sure we cancel and reset the animation frame for journey calculation
      if (journeyAnimationFrameRef.current) {
        cancelAnimationFrame(journeyAnimationFrameRef.current);
        journeyAnimationFrameRef.current = undefined;
      }
    }
  }, [activeJourney]);
  
  // Delete a journey by ID
  const deleteJourney = useCallback((journeyId: number) => {
    simulatorRef.current.deleteJourney(journeyId);
    setActiveJourneys([...simulatorRef.current.getActiveJourneys()]);
  }, []);
  
  // Update clearJourney to remove drawCanvas call
  const clearJourney = () => {
    setActiveJourney(null);
    setSourceIslandId(null);
    setDestinationIslandId(null);
    
    // Clear any pending journey calculations
    if (throttleRef.current !== null) {
      clearTimeout(throttleRef.current);
      throttleRef.current = null;
    }
    
    // Cancel any active journey animation frame
    if (journeyAnimationFrameRef.current) {
      cancelAnimationFrame(journeyAnimationFrameRef.current);
      journeyAnimationFrameRef.current = undefined;
    }
  };
  
  // Update addIsland to use updateViewportScale
  const addIsland = (): void => {
    if (!islandName) return;
    
    // Create a deep copy of the epicycles
    const cycles = JSON.parse(JSON.stringify(epicycles));
    
    // Generate a color if not in edit mode or color not set
    let color = islandColor;
    if (!editMode || !color) {
      // Pick the next color from the palette or a random one if we've used them all
      const nextColorIndex = islands.length % colorPalette.length;
      color = colorPalette[nextColorIndex];
    }
    
    if (editMode && editingIslandId) {
      // Update existing island
      const updatedIsland: Island = {
        id: editingIslandId,
        name: islandName,
        color: color,
        radius: 8,
        cycles: cycles,
        visible: true
      };
      
      simulatorRef.current.updateIsland(updatedIsland);
      setIslands([...simulatorRef.current.getIslands()]);
      
      setEditMode(false);
      setEditingIslandId(null);
    } else {
      // Create new island
      const newIsland: Island = {
        id: Date.now(), // Use timestamp for unique ID
        name: islandName,
        color: color,
        radius: 8,
        cycles: cycles,
        visible: true
      };
      
      simulatorRef.current.addIsland(newIsland);
      setIslands([...simulatorRef.current.getIslands()]);
    }
    
    // Update viewport scaling
    updateViewportScale();
    
    // Reset form
    resetIslandForm();
  };
  
  // Update deleteIsland to use updateViewportScale
  const deleteIsland = (islandId: number): void => {
    // If currently editing this island, cancel edit mode
    if (editMode && editingIslandId === islandId) {
      resetIslandForm();
    }
    
    // Remove the island from the simulator
    simulatorRef.current.deleteIsland(islandId);
    
    // Update React state
    setIslands([...simulatorRef.current.getIslands()]);
    
    // Update viewport scaling
    updateViewportScale();
  };
  
  // Edit an existing island
  const editIsland = (island: Island): void => {
    setIslandName(island.name);
    setIslandColor(island.color);
    setEpicycles([...island.cycles]);
    setEditMode(true);
    setEditingIslandId(island.id);
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
  
  // Keep functions that are used in the UI
  const calculateOrbitalPeriod = (cycles: Epicycle[]): number => {
    return simulatorRef.current.calculateOrbitalPeriod(cycles);
  };

  const calculateOrbitalPosition = (cycles: Epicycle[], currentTime: number = time): { dayInCycle: number, percentage: number } => {
    return simulatorRef.current.calculateOrbitalPosition(cycles, currentTime);
  };

  const calculateVelocity = (island: Island, t: number = time): { speed: number, angle: number, x: number, y: number } => {
    return simulatorRef.current.calculateVelocity(island, t);
  };
  
  // Reset the simulation
  const resetSimulation = (): void => {
    setTime(0);
    simulatorRef.current.setTime(0);
    setIsPlaying(false);
    lastTimeRef.current = 0;
  };
  
  // Jump forward or backward in time
  const jumpTime = (amount: number): void => {
    const newTime = time + amount;
    setTime(newTime);
    simulatorRef.current.setTime(newTime);
  };
  
  // Update setDestinationIslandId to automatically calculate journey
  const setDestinationIslandIdAndCalculate = (id: number | null): void => {
    // Set the state
    setDestinationIslandId(id);
    
    // Calculate journey with the new ID directly, not depending on state update
    if (id !== null && sourceIslandId !== null) {
      calculateJourneyWithIds(sourceIslandId, id);
    }
  };

  // Add a new function to set source island and calculate journey if destination is already selected
  const setSourceIslandIdAndCalculate = (id: number | null): void => {
    // Set the state
    setSourceIslandId(id);
    
    // Calculate journey with the new ID directly, not depending on state update
    if (id !== null && destinationIslandId !== null) {
      calculateJourneyWithIds(id, destinationIslandId);
    }
  };

  // Memoize the journey calculation function for better performance
  const calculateJourneyWithIds = useCallback((srcId: number, destId: number) => {
    // Let the simulator calculate the journey as a prediction
    const journey = simulatorRef.current.calculateJourney(srcId, destId, journeySpeed, true);
    
    if (journey) {
      setActiveJourney(journey);
    }
  }, [journeySpeed]);
  
  // Update the journey calculation ref when the function changes
  useEffect(() => {
    journeyCalculationRef.current = calculateJourneyWithIds;
  }, [calculateJourneyWithIds]);

  // Extract resetIslandForm functionality to a reusable function
  const resetIslandForm = (): void => {
    setEditMode(false);
    setEditingIslandId(null);
    setIslandName("");
    setIslandColor("");
    setEpicycles([
      { period: 250 },
      { period: -80 }  // Negative period for opposite direction
    ]);
  };

  // Update useEffect to handle viewport scaling when islands change
  useEffect(() => {
    // Update simulator with current islands
    simulatorRef.current.setIslands(islands);
    
    // Update viewport scaling
    updateViewportScale();
  }, [islands, canvasSize, updateViewportScale]);

  // Update useEffect to handle simulator time and position without journey updates
  useEffect(() => {
    // Update simulator time and position
    simulatorRef.current.setTime(time);
    simulatorRef.current.setCenter(CENTER_X, CENTER_Y);
  }, [time, CENTER_X, CENTER_Y]);

  // Update useEffect to handle journey when time changes explicitly (not during animation)
  useEffect(() => {
    // Skip during animation - animation loop handles journey updates
    if (isPlaying) return;
    
    // Only update journey when necessary
    if (activeJourney && sourceIslandId !== null && destinationIslandId !== null) {
      // Throttle updates to avoid excessive calculations
      if (throttleRef.current !== null) {
        clearTimeout(throttleRef.current);
      }
      
      throttleRef.current = window.setTimeout(() => {
        if (journeyCalculationRef.current) {
          journeyCalculationRef.current(sourceIslandId, destinationIslandId);
        }
        throttleRef.current = null;
      }, 50); // Faster response time for manual controls
    }
    
    return () => {
      if (throttleRef.current !== null) {
        clearTimeout(throttleRef.current);
      }
    };
  }, [time, activeJourney, sourceIslandId, destinationIslandId, isPlaying, journeyCalculationRef]);

  // Add back simulator initialization in a new useEffect
  useEffect(() => {
    // Initialize simulator with islands
    const simulator = simulatorRef.current;
    simulator.setIslands(islands);
    
    // Set viewport scaling
    updateViewportScale();
  }, [islands, updateViewportScale]);

  // Update journey when playing
  useEffect(() => {
    // Only update journey during animation
    if (!isPlaying) return;
    
    // Only update journey when necessary 
    if (activeJourney && sourceIslandId !== null && destinationIslandId !== null) {
      const animateJourney = (timestamp: number) => {
        // Always calculate the journey on each frame for maximum accuracy
        if (journeyCalculationRef.current) {
          journeyCalculationRef.current(sourceIslandId, destinationIslandId);
        }
        
        // Continue animation loop
        journeyAnimationFrameRef.current = requestAnimationFrame(animateJourney);
      };
      
      // Start animation
      journeyAnimationFrameRef.current = requestAnimationFrame(animateJourney);
      
      // Cleanup on unmount or when dependencies change
      return () => {
        if (journeyAnimationFrameRef.current) {
          cancelAnimationFrame(journeyAnimationFrameRef.current);
          journeyAnimationFrameRef.current = undefined;
        }
      };
    }
  }, [isPlaying, activeJourney, sourceIslandId, destinationIslandId, journeyCalculationRef]);
  //console.log("Rendering Simulation");
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 3, mb: 2, backgroundColor: 'grey.50' }} elevation={2}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Skydrift Archipelago Simulation
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Simulating the orbital cycles of islands across days in your world
        </Typography>
        
        {/* Time Controls */}
        <TimeControlPanel
          time={time}
          setTime={setTime}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          speed={speed}
          setSpeed={setSpeed}
          resetSimulation={resetSimulation}
          jumpTime={jumpTime}
        />
        
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <ShareSimulationButton
            simulator={simulatorRef.current}
            islands={islands}
            time={time}
            activeJourneys={activeJourneys}
          />
          <PrintableSkyChartButton
            simulator={simulatorRef.current}
            islands={islands}
            time={time}
            showTrails={showTrails}
            trailLength={trailLength}
            trailTickFrequency={trailTickFrequency}
            activeJourney={activeJourney}
            activeJourneys={activeJourneys}
            viewportScale={viewportScale}
            journeyTickMarkDays={journeyTickMarkDays}
          />
        </Box>

        {/* Canvas */}
        <SimulationCanvas
          simulator={simulatorRef.current}
          islands={islands}
          time={time}
          showOrbits={showOrbits}
          showTrails={showTrails}
          trailLength={trailLength}
          trailTickFrequency={trailTickFrequency}
          activeJourney={activeJourney}
          viewportScale={viewportScale}
          journeyTickMarkDays={journeyTickMarkDays}
          onResize={(width, height) => {
            if(width !== canvasSize.width || height !== canvasSize.height) {
              setCanvasSize({ width, height });
              setCenterX(width / 2);
              setCenterY(height / 2);
            }
          }}
          toggleIslandVisibility={toggleIslandVisibility}
        />

        {/* Tab Navigation */}
        <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => setActiveTab(newValue)}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab 
              icon={<FilterCenterFocusIcon />} 
              iconPosition="start" 
              label="Conjunctions" 
              value="conjunction" 
            />
            <Tab 
              icon={<DirectionsBoatIcon />} 
              iconPosition="start" 
              label="Journey Planner" 
              value="journey" 
            />
            <Tab 
              icon={<SettingsIcon />} 
              iconPosition="start" 
              label="Settings" 
              value="settings" 
            />
            <Tab 
              icon={<TerrainIcon />} 
              iconPosition="start" 
              label="Add/Edit Island" 
              value="island" 
            />
          </Tabs>
        </Box>

        {/* Conditional Rendering Based on Active Tab */}
        {activeTab === 'conjunction' && (
          <ConjunctionsPanel
            simulator={simulatorRef.current}
            islands={islands}
            currentTime={time}
            setTime={setTime}
            setIsPlaying={setIsPlaying}
          />
        )}

        {activeTab === 'journey' && (
          <JourneyPlanner
            islands={islands}
            isPlaying={isPlaying}
            sourceIslandId={sourceIslandId}
            setSourceIslandId={setSourceIslandId}
            destinationIslandId={destinationIslandId}
            setDestinationIslandId={setDestinationIslandId}
            journeySpeed={journeySpeed}
            setJourneySpeed={setJourneySpeed}
            activeJourney={activeJourney}
            clearJourney={clearJourney}
            setSourceIslandIdAndCalculate={setSourceIslandIdAndCalculate}
            setDestinationIslandIdAndCalculate={setDestinationIslandIdAndCalculate}
            activeJourneys={activeJourneys}
            addActiveJourney={addActiveJourney}
            deleteJourney={deleteJourney}
            simulator={simulatorRef.current}
            time={time}
          />
        )}
        
        {activeTab === 'settings' && (
          <SettingsPanel
            showOrbits={showOrbits}
            setShowOrbits={setShowOrbits}
            showTrails={showTrails}
            setShowTrails={setShowTrails}
            trailLength={trailLength}
            setTrailLength={setTrailLength}
            trailTickFrequency={trailTickFrequency}
            setTrailTickFrequency={setTrailTickFrequency}
            journeyTickMarkDays={journeyTickMarkDays}
            setJourneyTickMarkDays={setJourneyTickMarkDays}
          />
        )}

        {activeTab === 'island' && (
          <IslandEditor
            islands={islands}
            islandName={islandName}
            setIslandName={setIslandName}
            islandColor={islandColor}
            setIslandColor={setIslandColor}
            epicycles={epicycles}
            setEpicycles={setEpicycles}
            addIsland={addIsland}
            editMode={editMode}
            resetIslandForm={resetIslandForm}
            toggleIslandVisibility={toggleIslandVisibility}
            editIsland={editIsland}
            deleteIsland={deleteIsland}
            calculateMilesRadius={calculateMilesRadius}
            setIslands={(newIslands) => {
              simulatorRef.current.setIslands(newIslands);
              setIslands([...simulatorRef.current.getIslands()]);
              updateViewportScale();
            }}
          />
        )}
      </Paper>
    </Box>
  );
};

export default SkydriftArchipelagoSimulation;