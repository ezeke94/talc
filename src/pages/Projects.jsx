// Remove a dependency between two projects
  const handleRemoveDependency = async (sourceProjectId, targetProjectId) => {
    try {
      const targetProject = projects.find(p => p.id === targetProjectId);
      if (!targetProject) return;
      const updatedDependencies = (targetProject.dependencies || []).filter(id => id !== sourceProjectId);
      await updateDoc(doc(db, 'projects', targetProjectId), {
        dependencies: updatedDependencies,
        updatedAt: Timestamp.now()
      });
      setSnackbar({
        open: true,
        message: 'Dependency removed successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error removing dependency:', error);
      setSnackbar({
        open: true,
        message: 'Error removing dependency: ' + error.message,
        severity: 'error'
      });
    }
  };
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
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox
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
  Close as CloseIcon
} from '@mui/icons-material';
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
  const [isMobile, setIsMobile] = useState(false);

  // More reliable mobile detection for Safari and Opera
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < theme.breakpoints.values.md);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [theme.breakpoints.values.md]);
  
  // Check user permissions
  const userRole = currentUser?.role?.toLowerCase() || '';
  const canEdit = ['admin', 'quality'].includes(userRole);
  const canView = ['admin', 'quality', 'coordinator'].includes(userRole);
  
  // State management
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('view'); // 'view', 'add', 'edit'
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [ganttTimeRange, setGanttTimeRange] = useState(90); // days
  const [currentTab, setCurrentTab] = useState(0);
  const [draggedProject, setDraggedProject] = useState(null);
  const [connectionMode, setConnectionMode] = useState(false);
  const [sourceProject, setSourceProject] = useState(null);

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

  // Check access permission
  if (!canView) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You don't have permission to view projects. Only Admin, Quality, and Coordinator roles can access this page.
          </Typography>
        </Paper>
      </Container>
    );
  }

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
  const ganttData = useMemo(() => {
    if (projects.length === 0) {
      const now = new Date();
      const startDate = new Date(now.getTime() - (ganttTimeRange / 2) * 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + (ganttTimeRange / 2) * 24 * 60 * 60 * 1000);
      return { projects: [], timePeriods: [], startDate, endDate, totalDays: 0 };
    }
    
    // Calculate the actual range needed to show all projects
    const projectDates = projects.flatMap(p => [new Date(p.startDate), new Date(p.endDate)]);
    const actualStartDate = new Date(Math.min(...projectDates));
    const actualEndDate = new Date(Math.max(...projectDates));
    
    // Use either the calculated range or the user-selected range, whichever is larger
    const now = new Date();
    const baseStartDate = new Date(now.getTime() - (ganttTimeRange / 2) * 24 * 60 * 60 * 1000);
    const baseEndDate = new Date(now.getTime() + (ganttTimeRange / 2) * 24 * 60 * 60 * 1000);
    
    // Expand the range to include all projects with some padding
    const padding = 7 * 24 * 60 * 60 * 1000; // 7 days padding
    const startDate = new Date(Math.min(actualStartDate.getTime() - padding, baseStartDate.getTime()));
    const endDate = new Date(Math.max(actualEndDate.getTime() + padding, baseEndDate.getTime()));
    
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
          ? `Week ${i + 1}` 
          : periodStart.toLocaleDateString('en-US', { month: 'short', year: ganttTimeRange > 180 ? '2-digit' : undefined }),
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

  const handleConnectProjects = async (sourceProjectId, targetProjectId) => {
    try {
      const sourceProject = projects.find(p => p.id === sourceProjectId);
      const targetProject = projects.find(p => p.id === targetProjectId);
      
      if (!sourceProject || !targetProject) return;

      // Update target project to start after source project ends
      const newStartDate = new Date(sourceProject.endDate);
      const currentDuration = targetProject.endDate - targetProject.startDate;
      const newEndDate = new Date(newStartDate.getTime() + currentDuration);

      // Update dependencies
      const updatedDependencies = [...(targetProject.dependencies || [])];
      if (!updatedDependencies.includes(sourceProjectId)) {
        updatedDependencies.push(sourceProjectId);
      }

      await updateDoc(doc(db, 'projects', targetProjectId), {
        startDate: Timestamp.fromDate(newStartDate),
        endDate: Timestamp.fromDate(newEndDate),
        dependencies: updatedDependencies,
        updatedAt: Timestamp.now()
      });

      setSnackbar({
        open: true,
        message: `"${targetProject.name}" has been rescheduled to start after "${sourceProject.name}" ends`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error connecting projects:', error);
      setSnackbar({
        open: true,
        message: 'Error connecting projects: ' + error.message,
        severity: 'error'
      });
    }
  };

  // Connection handlers
  const handleConnectionStart = (projectId, nodeType) => {
    if (connectionMode && sourceProject) {
      // If already in connection mode and clicking a different project, connect them
      if (sourceProject.id !== projectId) {
        handleConnectProjects(sourceProject.id, projectId);
        setConnectionMode(false);
        setSourceProject(null);
      } else {
        // Cancel connection mode if clicking the same project
        setConnectionMode(false);
        setSourceProject(null);
      }
    } else {
      // Start connection mode
      const project = projects.find(p => p.id === projectId);
      setConnectionMode(true);
      setSourceProject(project);
      setSnackbar({
        open: true,
        message: `Select the target project to reschedule after "${project.name}" ends`,
        severity: 'info'
      });
    }
  };

  const handleConnectionEnd = (projectId, nodeType) => {
    if (connectionMode && sourceProject && sourceProject.id !== projectId) {
      // Connect the source project to this target project
      handleConnectProjects(sourceProject.id, projectId);
      setConnectionMode(false);
      setSourceProject(null);
    } else if (connectionMode && sourceProject && sourceProject.id === projectId) {
      // Cancel connection mode if clicking the same project
      setConnectionMode(false);
      setSourceProject(null);
      setSnackbar({
        open: true,
        message: 'Connection cancelled',
        severity: 'info'
      });
    } else {
      // Start connection mode from end node
      handleConnectionStart(projectId, nodeType);
    }
  };

  // Render Gantt Chart
  const renderGanttChart = () => (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimelineIcon />
          Project Timeline
          <Tooltip 
            title={
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Project Dependencies
                </Typography>
                <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                  • Click the blue dot (start) or orange dot (end) on any project bar
                </Typography>
                <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                  • Then click on another project to create a dependency
                </Typography>
                <Typography variant="caption" display="block">
                  • The target project will be rescheduled to start after the source project ends (keeping its duration)
                </Typography>
              </Box>
            }
            arrow
            placement="bottom-start"
          >
            <IconButton size="small" sx={{ ml: 1 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,17A1.5,1.5 0 0,1 10.5,15.5A1.5,1.5 0 0,1 12,14A1.5,1.5 0 0,1 13.5,15.5A1.5,1.5 0 0,1 12,17M12,10.5A1.5,1.5 0 0,1 10.5,9A1.5,1.5 0 0,1 12,7.5A1.5,1.5 0 0,1 13.5,9A1.5,1.5 0 0,1 12,10.5Z"/>
              </svg>
            </IconButton>
          </Tooltip>
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={ganttTimeRange}
            onChange={(e) => setGanttTimeRange(e.target.value)}
            label="Time Range"
          >
            <MenuItem value={30}>30 Days</MenuItem>
            <MenuItem value={60}>60 Days</MenuItem>
            <MenuItem value={90}>90 Days</MenuItem>
            <MenuItem value={180}>6 Months</MenuItem>
            <MenuItem value={365}>1 Year</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      {/* Connection Mode Indicator */}
      {connectionMode && sourceProject && (
        <Alert 
          severity="info" 
          sx={{ mb: 2 }}
          action={
            <IconButton
              color="inherit"
              size="small"
              onClick={() => {
                setConnectionMode(false);
                setSourceProject(null);
              }}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          <strong>Dependency Mode:</strong> Click on any project's connection node to schedule it after "{sourceProject.name}" ends.
          <br />
          <Typography variant="caption" component="span">
            The target project will be rescheduled to start when "{sourceProject.name}" finishes, maintaining its original duration.
          </Typography>
        </Alert>
      )}
      
      <Box sx={{ overflowX: 'auto', minHeight: isMobile ? 300 : 400, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        {/* Gantt Chart Container */}
        <Box sx={{ minWidth: isMobile ? 400 : 800, height: '100%' }}>
          
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
              width: isMobile ? 120 : 250, 
              p: isMobile ? 0.5 : 2, 
              borderRight: '1px solid', 
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 600,
              bgcolor: 'grey.100'
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
                  width: isMobile ? 180 : 250, 
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
                    {/* Start Connection Node */}
                    <Tooltip title={connectionMode ? "Click to connect projects" : "Click to start connecting projects"} arrow>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: isMobile ? -3 : -4,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: isMobile ? 6 : 8,
                          height: isMobile ? 6 : 8,
                          bgcolor: connectionMode && sourceProject?.id === project.id ? 'warning.main' : 'primary.main',
                          borderRadius: '50%',
                          border: connectionMode ? '3px solid white' : '2px solid white',
                          cursor: 'pointer',
                          pointerEvents: 'auto',
                          transition: 'all 0.2s ease-in-out',
                          boxShadow: connectionMode ? 2 : 0,
                          '&:hover': {
                            transform: 'translateY(-50%) scale(1.3)',
                            bgcolor: connectionMode && sourceProject?.id === project.id ? 'warning.dark' : 'primary.dark'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConnectionStart(project.id, 'start');
                        }}
                      />
                    </Tooltip>

                    {/* End Connection Node */}
                    <Tooltip title={connectionMode ? "Click to connect projects" : "Click to start connecting projects"} arrow>
                      <Box
                        sx={{
                          position: 'absolute',
                          right: isMobile ? -3 : -4,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: isMobile ? 6 : 8,
                          height: isMobile ? 6 : 8,
                          bgcolor: connectionMode && sourceProject?.id === project.id ? 'warning.main' : 'secondary.main',
                          borderRadius: '50%',
                          border: connectionMode ? '3px solid white' : '2px solid white',
                          cursor: 'pointer',
                          pointerEvents: 'auto',
                          transition: 'all 0.2s ease-in-out',
                          boxShadow: connectionMode ? 2 : 0,
                          '&:hover': {
                            transform: 'translateY(-50%) scale(1.3)',
                            bgcolor: connectionMode && sourceProject?.id === project.id ? 'warning.dark' : 'secondary.dark'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConnectionEnd(project.id, 'end');
                        }}
                      />
                    </Tooltip>
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
            Projects Management
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {canEdit && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddProject}
                size={isMobile ? 'small' : 'medium'}
              >
                Add Project
              </Button>
            )}
          </Box>
        </Box>

        {/* Tabs */}
        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)} sx={{ mb: 3 }}>
          <Tab label="Gantt Chart" icon={<TimelineIcon />} />
          <Tab label="Project Cards" icon={<AssignmentIcon />} />
        </Tabs>

        {/* Content */}
        {currentTab === 0 && renderGanttChart()}
        {currentTab === 1 && renderProjectCards()}

        {/* Project Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle>
            {dialogMode === 'add' ? 'Add New Project' : 
             dialogMode === 'edit' ? 'Edit Project' : 'Project Details'}
          </DialogTitle>
          <DialogContent>
            {/* Project Form Content - Continuing in next part due to length */}
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Project Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={dialogMode === 'view'}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={dialogMode === 'view'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      disabled={dialogMode === 'view'}
                    >
                      <MenuItem value="Planning">Planning</MenuItem>
                      <MenuItem value="In Progress">In Progress</MenuItem>
                      <MenuItem value="Completed">Completed</MenuItem>
                      <MenuItem value="On Hold">On Hold</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      disabled={dialogMode === 'view'}
                    >
                      <MenuItem value="Low">Low</MenuItem>
                      <MenuItem value="Medium">Medium</MenuItem>
                      <MenuItem value="High">High</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Start Date"
                    value={formData.startDate}
                    onChange={(date) => setFormData({ ...formData, startDate: date })}
                    disabled={dialogMode === 'view'}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="End Date"
                    value={formData.endDate}
                    onChange={(date) => setFormData({ ...formData, endDate: date })}
                    disabled={dialogMode === 'view'}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} startIcon={<CloseIcon />}>
              {dialogMode === 'view' ? 'Close' : 'Cancel'}
            </Button>
            {dialogMode !== 'view' && canEdit && (
              <Button onClick={handleSaveProject} variant="contained" startIcon={<SaveIcon />}>
                {dialogMode === 'add' ? 'Create' : 'Update'}
              </Button>
            )}
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