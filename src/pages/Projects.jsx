// Dependency management via UI has been removed. Use Firestore directly for now.
import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Tooltip,
  Alert,
  Snackbar,
  IconButton,
  useTheme,
  useMediaQuery,
  Autocomplete,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Avatar,
  AvatarGroup,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Assignment as AssignmentIcon,
  Group as GroupIcon,
  DateRange as DateRangeIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  PauseCircleOutline as PauseCircleOutlineIcon
} from '@mui/icons-material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import ReplayIcon from '@mui/icons-material/Replay';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  query,
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { getStatusColor, getPriorityColor, calculateProjectProgress } from '../utils/projectSeedData';

const Projects = () => {
  const { currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const NAME_COL_WIDTH = isMobile ? 120 : 250;
  
  // Check user permissions
  const userRole = currentUser?.role?.toLowerCase() || '';
  const canEdit = ['admin', 'quality'].includes(userRole);
  
  // State management
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('view'); // 'view', 'add', 'edit'
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  // Default to 1 year view (365 days) per user request
  const [ganttTimeRange, setGanttTimeRange] = useState(365); // days
  const [draggedProject, setDraggedProject] = useState(null);
  // Connection mode removed — dependency drawing is now handled outside UI

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'Planning',
    priority: 'Medium',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    center: null,
    owner: null,
    assignedUsers: [],
    reminderDays: 7,
    dependencies: [],
    tags: [],
    tasks: []
  });

  // Page visibility is enforced through the navigation; no role check required here.

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch projects
        const projectsQuery = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
          const projectsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            startDate: doc.data().startDate?.toDate() || new Date(),
            endDate: doc.data().endDate?.toDate() || new Date()
          }));
          setProjects(projectsData);
        });

        // Fetch users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(user => user.isActive);
        setUsers(usersData);

        // Fetch centers
        const centersSnapshot = await getDocs(collection(db, 'centers'));
        let centersData = centersSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          name: doc.data().name || doc.id 
        }));
        
        // If no centers, use defaults
        if (centersData.length === 0) {
          centersData = [
            { id: 'physis', name: 'PHYSIS' },
            { id: 'whitehouse', name: 'Whitehouse' },
            { id: 'hephzi', name: 'Hephzi' },
            { id: 'harlur', name: 'Harlur' }
          ];
        }
        setCenters(centersData);

        setLoading(false);
        
        return unsubscribeProjects;
      } catch (error) {
        console.error('Error fetching data:', error);
        setSnackbar({
          open: true,
          message: 'Error fetching data: ' + error.message,
          severity: 'error'
        });
        setLoading(false);
      }
    };

    let unsubscribe;
    fetchData().then(unsub => {
      if (unsub) unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Gantt chart calculations
  // Helper to calculate ISO week number and roll it over at 52
  const getIsoWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // ISO week date weeks start on Monday, so correct day number
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    // Normalize to 1..52
    return ((weekNo - 1) % 52) + 1;
  };
  const scrollRef = React.useRef(null);
  const timelineRef = React.useRef(null);
  // Preferred scaling for each time-range so zooming feels meaningful
  const SCALE_BY_RANGE = {
    30: 22,
    90: 12,
    180: 6,
    365: 3
  };

  const DEFAULT_PIXELS_PER_DAY = SCALE_BY_RANGE[ganttTimeRange] || 12; // default to current range
  const [scale, setScale] = useState(DEFAULT_PIXELS_PER_DAY);
  const scaleRef = React.useRef(scale);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  // (SCALE_BY_RANGE moved above sequence to initialize scale correctly)
  const MIN_SCALE = Math.min(...Object.values(SCALE_BY_RANGE));
  const MAX_SCALE = Math.max(...Object.values(SCALE_BY_RANGE));
  const ganttData = useMemo(() => {
    if (projects.length === 0) {
      const now = new Date();
      const startDate = new Date(now.getTime() - (ganttTimeRange / 2) * 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + (ganttTimeRange / 2) * 24 * 60 * 60 * 1000);
      const totalDays = (endDate - startDate) / (24 * 60 * 60 * 1000);
      return { projects: [], timePeriods: [], startDate, endDate, totalDays };
    }
    
    // Calculate the actual range needed to show all projects
    const projectDates = projects.flatMap(p => [new Date(p.startDate), new Date(p.endDate)]);
    const actualStartDate = new Date(Math.min(...projectDates));
    const actualEndDate = new Date(Math.max(...projectDates));
    
    // Load the full timeline (one year before and after now) regardless of selected view
    const now = new Date();
    const yearDays = 365 * 24 * 60 * 60 * 1000;
    const fullStartDate = new Date(now.getTime() - yearDays);
    const fullEndDate = new Date(now.getTime() + yearDays);
    // We will render projects across the full two-year span and let the UI scroll/zoom
    const padding = 7 * 24 * 60 * 60 * 1000; // 7 days padding
    const startDate = new Date(Math.min(actualStartDate.getTime() - padding, fullStartDate.getTime()));
    const endDate = new Date(Math.max(actualEndDate.getTime() + padding, fullEndDate.getTime()));
    
    // Generate time periods for the header
    const timePeriods = [];
    const totalDays = (endDate - startDate) / (24 * 60 * 60 * 1000);
    const periodsCount = ganttTimeRange <= 60 ? Math.ceil(totalDays / 7) : Math.ceil(totalDays / 30); // Weeks for short range, months for long range
    
    for (let i = 0; i < periodsCount; i++) {
      const periodStart = new Date(startDate.getTime() + (i * (ganttTimeRange <= 60 ? 7 : 30) * 24 * 60 * 60 * 1000));
      const periodEnd = new Date(periodStart.getTime() + ((ganttTimeRange <= 60 ? 7 : 30) * 24 * 60 * 60 * 1000));
      
      timePeriods.push({
        start: periodStart,
        end: periodEnd,
        label: ganttTimeRange <= 60
          ? `Week ${getIsoWeekNumber(periodStart)} ${periodStart.toLocaleDateString('en-US', { month: 'short' })}`
          : periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        width: (ganttTimeRange <= 60 ? 7 : 30) / totalDays * 100
      });
    }
    
  const projectsData = projects.map(project => {
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);
      
      // Calculate position and width percentages
      const leftOffset = Math.max(0, (projectStart - startDate) / (24 * 60 * 60 * 1000)) / totalDays * 100;
      const rightOffset = Math.max(0, (endDate - projectEnd) / (24 * 60 * 60 * 1000)) / totalDays * 100;
      const width = Math.max(2, 100 - leftOffset - rightOffset);
      
      return {
        ...project,
        leftOffset,
        width,
        isVisible: projectEnd >= startDate && projectStart <= endDate
      };
    }).filter(project => project.isVisible);

    return {
      projects: projectsData,
      timePeriods,
      startDate,
      endDate,
      totalDays
    };
  }, [projects, ganttTimeRange]);

  // Add wheel gesture to zoom in/out when Ctrl is pressed
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // Continuous zoom while Ctrl/Cmd + wheel is pressed. We will update scale on each wheel
    // and debounce to snap to discrete ranges once wheel stops.
    let lastCenterRatio = 0.5;
    const wheelTimer = { id: null };

  let wheelTimerID = null;
  const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();

      // compute center ratio so when scaling we preserve the current viewport center
      const oldWidth = timelineRef.current?.clientWidth || (ganttData?.totalDays || 90) * scale;
      lastCenterRatio = oldWidth > 0 ? (container.scrollLeft + container.clientWidth / 2) / oldWidth : 0.5;

      // compute new scale using an exponential factor for smooth zoom
      const zoomSpeed = 0.0025; // smaller = slower zoom
      const factor = Math.exp(-e.deltaY * zoomSpeed);
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleRef.current * factor));
      setScale(newScale);

      // Immediately reposition so zoom feels anchored to viewport center
      requestAnimationFrame(() => {
  const newWidth = (ganttData?.totalDays || 90) * newScale;
        const left = Math.max(0, Math.min(1, lastCenterRatio)) * newWidth - container.clientWidth / 2;
        container.scrollLeft = Math.max(0, Math.round(left));
      });

      // debounce and snap to nearest range
  if (wheelTimerID) clearTimeout(wheelTimerID);
  wheelTimerID = setTimeout(() => {
        // snap to nearest scale (which maps to ganttTimeRange)
        const ranges = Object.keys(SCALE_BY_RANGE).map(k => parseInt(k, 10));
        let nearest = ranges[0];
        let nearestDiff = Math.abs(SCALE_BY_RANGE[nearest] - newScale);
        for (const r of ranges) {
          const diff = Math.abs(SCALE_BY_RANGE[r] - newScale);
          if (diff < nearestDiff) { nearest = r; nearestDiff = diff; }
        }
        setGanttTimeRange(nearest);
        setScale(SCALE_BY_RANGE[nearest]);
        wheelTimerID = null;
      }, 250);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
      if (wheelTimerID) clearTimeout(wheelTimerID);
    };
  }, [ganttTimeRange, ganttData?.totalDays]);

  // Helpers for zoom/pan/reset
  const TIME_RANGES = [30, 90, 180, 365];

  const handleZoomIn = () => {
    const idx = TIME_RANGES.indexOf(ganttTimeRange);
    if (idx > 0) setGanttTimeRange(TIME_RANGES[idx - 1]);
  };

  const handleZoomOut = () => {
    const idx = TIME_RANGES.indexOf(ganttTimeRange);
    if (idx < TIME_RANGES.length - 1) setGanttTimeRange(TIME_RANGES[idx + 1]);
  };

  // Preserve viewport center on zoom and update scale
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !timelineRef.current) {
      setScale(SCALE_BY_RANGE[ganttTimeRange] || DEFAULT_PIXELS_PER_DAY);
      return;
    }

    const oldWidth = timelineRef.current.clientWidth;
    const centerLeft = container.scrollLeft + container.clientWidth / 2;
    const centerRatio = oldWidth > 0 ? centerLeft / oldWidth : 0.5;

    const newScale = SCALE_BY_RANGE[ganttTimeRange] || DEFAULT_PIXELS_PER_DAY;
    setScale(newScale);

    // Wait for layout to recalculate new width and then adjust scroll to keep center
    requestAnimationFrame(() => {
      const newWidth = (ganttData?.totalDays || 90) * (newScale);
      const newCenterLeft = Math.max(0, Math.min(1, centerRatio)) * newWidth;
      container.scrollTo({ left: Math.max(0, newCenterLeft - container.clientWidth / 2), behavior: 'smooth' });
    });
  }, [ganttTimeRange, ganttData?.totalDays]);

  const resetToToday = () => {
    if (!scrollRef.current || !timelineRef.current || !ganttData?.totalDays) return;
    const now = new Date();
    const todayOffset = ((now - ganttData.startDate) / (24 * 60 * 60 * 1000)) / ganttData.totalDays;
    const contentWidth = timelineRef.current.clientWidth;
    const leftPx = Math.max(0, Math.min(1, todayOffset)) * contentWidth;
    const container = scrollRef.current;
    container.scrollTo({ left: Math.max(0, leftPx - container.clientWidth / 2), behavior: 'smooth' });
  };

  // Ensure on the very first load we center the timeline on today so the default view
  // shows the current date in the middle (user-requested default behavior).
  const hasCenteredOnMountRef = React.useRef(false);
  useEffect(() => {
    if (hasCenteredOnMountRef.current) return;
    if (!ganttData?.totalDays) return;

    // Slight delay to allow DOM widths to be calculated so centering is accurate
    setTimeout(() => {
      resetToToday();
      hasCenteredOnMountRef.current = true;
    }, 80);
  }, [ganttData?.totalDays]);

  // On mount and when ganttTimeRange changes, center the visible viewport to the selected range around today
  // Remove auto reset on zoom — zoom preserves viewport center.

  // Helper functions for task display
  const getTaskStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'in progress':
        return <ScheduleIcon color="primary" fontSize="small" />;
      case 'planning':
        return <TimelineIcon color="action" fontSize="small" />;
      default:
        return <AssignmentIcon color="disabled" fontSize="small" />;
    }
  };

  const isTaskOverdue = (task) => {
    if (!task?.dueDate || (task.status || '').toLowerCase() === 'completed') return false;
    const due = task.dueDate?.toDate ? task.dueDate.toDate() : task.dueDate;
    return new Date(due) < new Date();
  };

  // Handle project operations
  const handleAddProject = () => {
    setFormData({
      name: '',
      description: '',
      status: 'Planning',
      priority: 'Medium',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      center: null,
      owner: null,
      assignedUsers: [],
      reminderDays: 7,
      dependencies: [],
      tags: [],
      tasks: []
    });
    setDialogMode('add');
    setDialogOpen(true);
  };

  const handleEditProject = (project) => {
    setSelectedProject(project);
    setFormData({
      name: project.name || '',
      description: project.description || '',
      status: project.status || 'Planning',
      priority: project.priority || 'Medium',
      startDate: new Date(project.startDate),
      endDate: new Date(project.endDate),
      center: project.center || null,
      owner: project.owner || null,
      assignedUsers: project.assignedUsers || [],
      reminderDays: project.reminderDays || 7,
      dependencies: project.dependencies || [],
      tags: project.tags || [],
      tasks: project.tasks || []
    });
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const handleViewProject = (project) => {
    setSelectedProject(project);
    setDialogMode('view');
    setDialogOpen(true);
  };

  const handleSaveProject = async () => {
    try {
      const projectData = {
        ...formData,
        startDate: Timestamp.fromDate(formData.startDate),
        endDate: Timestamp.fromDate(formData.endDate),
        updatedAt: Timestamp.now(),
        progress: calculateProjectProgress(formData.tasks)
      };

      if (dialogMode === 'add') {
        await addDoc(collection(db, 'projects'), {
          ...projectData,
          createdAt: Timestamp.now(),
          createdBy: {
            userId: currentUser.uid,
            name: currentUser.displayName || currentUser.name,
            email: currentUser.email
          }
        });
        setSnackbar({
          open: true,
          message: 'Project created successfully!',
          severity: 'success'
        });
      } else if (dialogMode === 'edit') {
        await updateDoc(doc(db, 'projects', selectedProject.id), projectData);
        setSnackbar({
          open: true,
          message: 'Project updated successfully!',
          severity: 'success'
        });
      }
      
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving project:', error);
      setSnackbar({
        open: true,
        message: 'Error saving project: ' + error.message,
        severity: 'error'
      });
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteDoc(doc(db, 'projects', projectId));
        setSnackbar({
          open: true,
          message: 'Project deleted successfully!',
          severity: 'success'
        });
      } catch (error) {
        console.error('Error deleting project:', error);
        setSnackbar({
          open: true,
          message: 'Error deleting project: ' + error.message,
          severity: 'error'
        });
      }
    }
  };

  // Project connection functionality removed — scheduling via dependencies is no longer supported in the UI.

  // Connection handlers
  // Connection UI removed — the functions for starting/ending connections are deprecated.

  // Connection End handler removed (no-op)

  // Render Gantt Chart
  const renderGanttChart = () => (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimelineIcon />
          Project Timeline
          {/* Header controls: pan, reset, zoom */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={() => {
              if (timelineRef.current && scrollRef.current) {
                scrollRef.current.scrollBy({ left: -Math.round(scrollRef.current.clientWidth * 0.25), behavior: 'smooth' });
              }
            }}>
              <ArrowBackIosIcon />
            </IconButton>
            <IconButton size="small" onClick={() => {
              if (timelineRef.current && scrollRef.current) {
                scrollRef.current.scrollBy({ left: Math.round(scrollRef.current.clientWidth * 0.25), behavior: 'smooth' });
              }
            }}>
              <ArrowForwardIosIcon />
            </IconButton>
            <IconButton size="small" onClick={() => resetToToday()}>
              <ReplayIcon />
            </IconButton>
            <IconButton size="small" onClick={() => handleZoomIn()}>
              <ZoomInIcon />
            </IconButton>
            <IconButton size="small" onClick={() => handleZoomOut()}>
              <ZoomOutIcon />
            </IconButton>
          </Box>
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={ganttTimeRange}
            onChange={(e) => setGanttTimeRange(e.target.value)}
            label="Time Range"
          >
            <MenuItem value={30}>1 Month</MenuItem>
            <MenuItem value={90}>3 Months</MenuItem>
            <MenuItem value={180}>6 Months</MenuItem>
            <MenuItem value={365}>1 Year</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      {/* Connection/Dependency mode removed from UI */}
      
  <Box ref={scrollRef} sx={{ overflowX: 'auto', minHeight: isMobile ? 300 : 400, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        {/* Gantt Chart Container */}
  <Box ref={timelineRef} sx={{ minWidth: isMobile ? 400 : 800, height: '100%', width: Math.max(isMobile ? 400 : 800, (ganttData?.totalDays || 90) * scale) }}>
          
          {/* Header Row - Time Periods */}
          <Box sx={{ 
            display: 'flex', 
            borderBottom: '2px solid', 
            borderColor: 'divider',
            bgcolor: 'grey.50',
            minHeight: isMobile ? 40 : 60,
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            {/* Project Name Column Header */}
            <Box sx={{ 
              width: NAME_COL_WIDTH,
              position: 'sticky',
              left: 0,
              top: 0,
              zIndex: 12,
              bgcolor: 'grey.100',
              p: isMobile ? 0.5 : 2, 
              borderRight: '1px solid', 
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 600,
            }}>
              <Typography variant={isMobile ? "caption" : "subtitle1"} sx={{ fontWeight: 600, fontSize: isMobile ? '0.7rem' : '1rem' }}>
                Projects
              </Typography>
            </Box>
            
            {/* Time Period Headers */}
            <Box sx={{ flex: 1, display: 'flex', position: 'relative' }}>
              {ganttData.timePeriods.map((period, index) => (
                <Box
                  key={index}
                  sx={{
                    width: `${period.width}%`,
                    p: isMobile ? 0.5 : 1,
                    borderRight: index < ganttData.timePeriods.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: isMobile ? 40 : 60
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 500, fontSize: isMobile ? '0.55rem' : '0.75rem' }}>
                    {period.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Project Rows */}
          {ganttData.projects.length > 0 ? (
            ganttData.projects.map((project, index) => (
              <Box 
                key={project.id} 
                sx={{ 
                  display: 'flex',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  minHeight: isMobile ? 50 : 60,
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                {/* Project Name Column */}
                <Box sx={{ 
                  width: NAME_COL_WIDTH, 
                  position: 'sticky',
                  left: 0,
                  top: 0,
                  zIndex: 5,
                  bgcolor: 'background.paper',
                  p: isMobile ? 1 : 2, 
                  borderRight: '1px solid', 
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}>
                  <Typography 
                    variant={isMobile ? "caption" : "body2"}
                    sx={{ 
                      fontWeight: 500, 
                      fontSize: isMobile ? '0.75rem' : '0.875rem',
                      cursor: 'pointer',
                      '&:hover': { color: 'primary.main' },
                      lineHeight: 1.2
                    }}
                    onClick={() => handleViewProject(project)}
                  >
                    {project.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      label={project.status}
                      size="small"
                      sx={{ 
                        bgcolor: getStatusColor(project.status),
                        color: 'white',
                        fontSize: isMobile ? '0.6rem' : '0.65rem',
                        height: isMobile ? 16 : 18
                      }}
                    />
                    <Chip
                      label={project.priority}
                      size="small"
                      sx={{ 
                        bgcolor: getPriorityColor(project.priority),
                        color: 'white',
                        fontSize: isMobile ? '0.6rem' : '0.65rem',
                        height: isMobile ? 16 : 18
                      }}
                    />
                  </Box>
                </Box>
                
                {/* Timeline Area */}
                <Box sx={{ 
                  flex: 1, 
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  px: 1
                }}>
                  {/* Grid Lines */}
                  {ganttData.timePeriods.map((period, periodIndex) => (
                    <Box
                      key={periodIndex}
                      sx={{
                        position: 'absolute',
                        left: `${ganttData.timePeriods.slice(0, periodIndex + 1).reduce((acc, p) => acc + p.width, 0)}%`,
                        top: 0,
                        bottom: 0,
                        width: '1px',
                        bgcolor: 'divider',
                        opacity: 0.3
                      }}
                    />
                  ))}
                  
                  {/* Project Bar */}
                  <Tooltip 
                    title={
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{project.name}</Typography>
                        <Typography variant="caption" display="block">
                          {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" display="block">
                          Status: {project.status} | Priority: {project.priority}
                        </Typography>
                        <Typography variant="caption" display="block">
                          Progress: {project.progress || 0}%
                        </Typography>
                        {project.owner && (
                          <Typography variant="caption" display="block">
                            Owner: {project.owner.name}
                          </Typography>
                        )}
                        {project.assignedUsers && project.assignedUsers.length > 0 && (
                          <Typography variant="caption" display="block">
                            Team: {project.assignedUsers.length} member(s)
                          </Typography>
                        )}
                      </Box>
                    }
                    placement="top"
                    arrow
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${project.leftOffset}%`,
                        width: `${project.width}%`,
                        height: isMobile ? 20 : 24,
                        bgcolor: getStatusColor(project.status),
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        px: isMobile ? 0.5 : 1,
                        cursor: 'pointer',
                        opacity: 0.8,
                        '&:hover': { 
                          opacity: 1,
                          transform: 'scaleY(1.1)',
                          zIndex: 10
                        },
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                      onClick={() => handleViewProject(project)}
                    >
                      {/* Progress indicator inside the bar */}
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${project.progress || 0}%`,
                          bgcolor: 'rgba(255,255,255,0.3)',
                          borderRadius: 1
                        }}
                      />
                      
                      {/* Progress text */}
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: 'white', 
                          fontSize: isMobile ? '0.6rem' : '0.7rem',
                          fontWeight: 600,
                          position: 'relative',
                          zIndex: 1
                        }}
                      >
                        {project.progress || 0}%
                      </Typography>
                    </Box>
                  </Tooltip>
                  
                  {/* Connection Nodes */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: `${project.leftOffset}%`,
                      width: `${project.width}%`,
                      height: isMobile ? 20 : 24,
                      pointerEvents: 'none',
                      zIndex: 12
                    }}
                  >
                    {/* Connection nodes removed */}

                    {/* Connection nodes removed */}
                  </Box>
                  
                  {/* Today indicator line */}
                  {(() => {
                    const today = new Date();
                    const todayOffset = ((today - ganttData.startDate) / (24 * 60 * 60 * 1000)) / ganttData.totalDays * 100;
                    if (todayOffset >= 0 && todayOffset <= 100) {
                      return (
                        <Box
                          sx={{
                            position: 'absolute',
                            left: `${todayOffset}%`,
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            bgcolor: 'error.main',
                            zIndex: 5,
                            opacity: 0.7
                          }}
                        />
                      );
                    }
                    return null;
                  })()}
                </Box>
              </Box>
            ))
          ) : (
            <Box sx={{ 
              p: 4, 
              textAlign: 'center', 
              color: 'text.secondary',
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}>
              <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
                No projects found in the selected time range
              </Typography>
            </Box>
          )}
          
          {/* Today indicator line legend */}
          <Box sx={{ 
            p: 2, 
            bgcolor: 'grey.50', 
            borderTop: '1px solid', 
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 2, bgcolor: 'error.main' }} />
              <Typography variant="caption" color="text.secondary">
                Today
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Showing {ganttData.projects.length} project(s) from {ganttData.startDate.toLocaleDateString()} to {ganttData.endDate.toLocaleDateString()}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  );

  // Render Project Cards
  const renderProjectCards = () => (
    <Grid container spacing={3}>
      {projects.map((project) => (
        <Grid item xs={12} sm={6} lg={4} key={project.id}>
          <Card 
            elevation={2}
            sx={{ 
              height: '100%',
              cursor: 'pointer',
              transition: 'elevation 0.2s',
              '&:hover': { elevation: 4 }
            }}
            onClick={() => handleViewProject(project)}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Typography variant="h6" component="h3" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  {project.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Chip
                    label={project.status}
                    size="small"
                    sx={{ 
                      bgcolor: getStatusColor(project.status),
                      color: 'white',
                      fontSize: '0.7rem'
                    }}
                  />
                  <Chip
                    label={project.priority}
                    size="small"
                    sx={{ 
                      bgcolor: getPriorityColor(project.priority),
                      color: 'white',
                      fontSize: '0.7rem'
                    }}
                  />
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, height: 40, overflow: 'hidden' }}>
                {project.description}
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Progress: {project.progress || 0}%
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={project.progress || 0} 
                  sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', justify: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                </Typography>
                {project.owner && (
                  <Typography variant="caption" color="text.secondary">
                    Owner: {project.owner.name}
                  </Typography>
                )}
              </Box>
              
              {project.tags && project.tags.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                  {project.tags.slice(0, 3).map((tag, index) => (
                    <Chip 
                      key={index} 
                      label={tag} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: '0.6rem', height: 20 }}
                    />
                  ))}
                  {project.tags.length > 3 && (
                    <Chip 
                      label={`+${project.tags.length - 3}`} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: '0.6rem', height: 20 }}
                    />
                  )}
                </Box>
              )}
              
              {canEdit && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                  <IconButton 
                    size="small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditProject(project);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <Typography>Loading projects...</Typography>
      </Container>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            Projects Timeline
          </Typography>
        </Box>

        {/* Gantt Chart */}
        {renderGanttChart()}

        {/* Project Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle>
            Project Details
          </DialogTitle>
          <DialogContent>
            {/* View Mode - Read-only display with good UI */}
            {selectedProject && (
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Typography variant="h5" gutterBottom>
                      {selectedProject.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <Chip
                        label={selectedProject.status}
                        sx={{ 
                          bgcolor: getStatusColor(selectedProject.status),
                          color: 'white'
                        }}
                      />
                      <Chip
                        label={selectedProject.priority}
                        sx={{ 
                          bgcolor: getPriorityColor(selectedProject.priority),
                          color: 'white'
                        }}
                      />
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="body1" paragraph>
                      {selectedProject.description || 'No description provided'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Start Date
                    </Typography>
                    <Typography variant="body1">
                      {new Date(selectedProject.startDate).toLocaleDateString()}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      End Date
                    </Typography>
                    <Typography variant="body1">
                      {new Date(selectedProject.endDate).toLocaleDateString()}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Progress
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={selectedProject.progress || 0} 
                        sx={{ 
                          flex: 1,
                          height: 10, 
                          borderRadius: 5,
                          bgcolor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: getStatusColor(selectedProject.status)
                          }
                        }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 45 }}>
                        {selectedProject.progress || 0}%
                      </Typography>
                    </Box>
                  </Grid>

                  {selectedProject.owner && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Project Owner
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <Avatar src={selectedProject.owner.photoURL} sx={{ width: 32, height: 32 }}>
                          {(selectedProject.owner.name || selectedProject.owner.email || 'U').charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="body1">
                          {selectedProject.owner.name || selectedProject.owner.email}
                        </Typography>
                      </Box>
                    </Grid>
                  )}

                  {selectedProject.center && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Center
                      </Typography>
                      <Typography variant="body1">
                        {selectedProject.center.name || selectedProject.center.id}
                      </Typography>
                    </Grid>
                  )}

                  {selectedProject.assignedUsers && selectedProject.assignedUsers.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Assigned Team Members ({selectedProject.assignedUsers.length})
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {selectedProject.assignedUsers.map((user, index) => (
                          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                            <Avatar src={user.photoURL} sx={{ width: 24, height: 24 }}>
                              {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2">
                              {user.name || user.email}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Grid>
                  )}

                  {selectedProject.tasks && selectedProject.tasks.length > 0 && (
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Tasks ({selectedProject.tasks.filter(t => (t.status || '').toLowerCase() === 'completed').length}/{selectedProject.tasks.length} completed)
                      </Typography>
                      <List dense sx={{ maxHeight: 400, overflowY: 'auto' }}>
                        {selectedProject.tasks.map((task, index) => (
                          <ListItem 
                            key={index}
                            sx={{ 
                              bgcolor: (task.status || '').toLowerCase() === 'completed' ? 'success.light' : 
                                      isTaskOverdue(task) ? 'error.light' : 'transparent',
                              borderRadius: 1,
                              mb: 0.5
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              {getTaskStatusIcon(task.status)}
                            </ListItemIcon>
                            <ListItemText
                              primary={task.name}
                              secondary={
                                <Box>
                                  <Typography variant="caption" color="text.secondary">
                                    Status: {task.status || 'Planning'}
                                  </Typography>
                                  {task.dueDate && (
                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                                      Due: {new Date(task.dueDate.toDate ? task.dueDate.toDate() : task.dueDate).toLocaleDateString()}
                                    </Typography>
                                  )}
                                  {task.priority && (
                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                                      Priority: {task.priority}
                                    </Typography>
                                  )}
                                  {task.assignedTo && task.assignedTo.name && (
                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                                      Assigned: {task.assignedTo.name || task.assignedTo.email}
                                    </Typography>
                                  )}
                                  {task.description && (
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                      {task.description}
                                    </Typography>
                                  )}
                                </Box>
                              }
                              sx={{
                                '& .MuiListItemText-primary': {
                                  textDecoration: (task.status || '').toLowerCase() === 'completed' ? 'line-through' : 'none',
                                  color: (task.status || '').toLowerCase() === 'completed' ? 'text.disabled' : 'text.primary',
                                  fontWeight: 500
                                }
                              }}
                            />
                            {isTaskOverdue(task) && (
                              <WarningIcon color="error" fontSize="small" />
                            )}
                          </ListItem>
                        ))}
                      </List>
                    </Grid>
                  )}

                  {selectedProject.tags && selectedProject.tags.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Tags
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {selectedProject.tags.map((tag, index) => (
                          <Chip key={index} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Grid>
                  )}

                  {selectedProject.dependencies && selectedProject.dependencies.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Dependencies
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {selectedProject.dependencies.map((dep, index) => {
                          const depProject = projects.find(p => p.id === dep);
                          return depProject ? (
                            <Chip 
                              key={index} 
                              label={depProject.name} 
                              size="small" 
                              icon={<TimelineIcon />}
                              variant="outlined"
                              color="primary"
                            />
                          ) : null;
                        })}
                      </Box>
                    </Grid>
                  )}

                  {selectedProject.reminderDays !== undefined && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Reminder
                      </Typography>
                      <Typography variant="body1">
                        {selectedProject.reminderDays} days before deadline
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} startIcon={<CloseIcon />}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
};

export default Projects;