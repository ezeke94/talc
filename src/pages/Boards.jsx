import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Fab,
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
  Avatar,
  AvatarGroup,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Assignment as AssignmentIcon,
  Group as GroupIcon,
  DateRange as DateRangeIcon,
  Flag as FlagIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  PauseCircleOutline as PauseCircleOutlineIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { getStatusColor, getPriorityColor } from '../utils/projectSeedData';

const BASE_BOARD_COLUMNS = {
  'Planning': {
    id: 'Planning',
    title: 'Planning',
    color: '#ffa726',
    icon: <ScheduleIcon />
  },
  'In Progress': {
    id: 'In Progress',
    title: 'In Progress',
    color: '#42a5f5',
    icon: <TimelineIcon />
  },
  'Completed': {
    id: 'Completed',
    title: 'Completed',
    color: '#66bb6a',
    icon: <CheckCircleIcon />
  }
};
const ON_HOLD_COLUMN = {
  id: 'On Hold',
  title: 'On Hold',
  color: '#bdbdbd',
  icon: <PauseCircleOutlineIcon />
};

const Boards = () => {
  const { currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Check user permissions
  const userRole = currentUser?.role?.toLowerCase() || '';
  const canEdit = ['admin', 'quality'].includes(userRole);
  // Page visibility now handled by navigation; allow view for all authenticated users.
  
  // State management
  const [projects, setProjects] = useState([]);
  const [showOnHold, setShowOnHold] = useState(false);
  const [users, setUsers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isNewProject, setIsNewProject] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activeId, setActiveId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [hoverColumn, setHoverColumn] = useState(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Check access permission
  // Removed role-based gating; Firestore security rules will still enforce write limits.

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch projects
        const projectsQuery = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const computeProgress = (tasks = []) => {
          if (!Array.isArray(tasks) || tasks.length === 0) return 0;
            const completed = tasks.filter(t => (t.status || '').toLowerCase() === 'completed').length;
            return Math.round((completed / tasks.length) * 100);
        };
        const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
          const projectsData = snapshot.docs.map(d => {
            const data = d.data();
            const tasks = data.tasks || [];
            return {
              id: d.id,
              ...data,
              startDate: data.startDate?.toDate() || new Date(),
              endDate: data.endDate?.toDate() || new Date(),
              progress: computeProgress(tasks)
            };
          });
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

  // Organize projects by status for board columns
  const boardData = useMemo(() => {
    const columns = {};
    // Order columns differently for mobile vs desktop
    const MOBILE_ORDER = ['In Progress', 'Planning', 'Completed'];
    const DESKTOP_ORDER = Object.keys(BASE_BOARD_COLUMNS);
    const order = isMobile ? MOBILE_ORDER : DESKTOP_ORDER;

    order.forEach(status => {
      if (BASE_BOARD_COLUMNS[status]) {
        columns[status] = {
          ...BASE_BOARD_COLUMNS[status],
          projects: projects.filter(project => project.status === status)
        };
      }
    });
    // Conditionally add On Hold
    if (showOnHold) {
      columns['On Hold'] = {
        ...ON_HOLD_COLUMN,
        projects: projects.filter(project => project.status === 'On Hold')
      };
    }
    return columns;
  }, [projects, showOnHold]);

  // Handle drag and drop
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event) => {
    const overId = event.over ? event.over.id : null;
    setDragOverId(overId);

    // Determine hovered column (if any) so we can highlight it.
    if (!overId) {
      setHoverColumn(null);
      return;
    }

    // If over a column id, highlight it directly
    if (Object.keys(boardData).includes(overId)) {
      setHoverColumn(overId);
      return;
    }

    // If over a project card, highlight its status column
    const overProject = projects.find(p => p.id === overId);
    if (overProject && overProject.status) {
      // Only highlight if the target column is visible in the current board
      if (Object.keys(boardData).includes(overProject.status)) setHoverColumn(overProject.status);
      else setHoverColumn(null);
      return;
    }

    setHoverColumn(null);
  };

  const handleDragEnd = async (event) => {
  if (!canEdit || isMobile) return; // disable dragging on mobile
    
    const { active, over } = event;
    
    // If dropped outside of any known column/project, move to On Hold
    if (!over) {
      try {
        const projectRef = doc(db, 'projects', activeId);
        await updateDoc(projectRef, {
          status: 'On Hold',
          updatedAt: Timestamp.now()
        });
        setSnackbar({ open: true, message: 'Project moved to On Hold', severity: 'success' });
        setProjects(prev => prev.map(p => p.id === activeId ? { ...p, status: 'On Hold' } : p));
      } catch (err) {
        console.error('Error moving project to On Hold', err);
        setSnackbar({ open: true, message: 'Error moving to On Hold: ' + err.message, severity: 'error' });
      } finally {
        setActiveId(null);
      }
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    // Find the project being dragged
    const activeProject = projects.find(p => p.id === activeId);
    if (!activeProject) {
      setActiveId(null);
      return;
    }

    // Determine drop target status. If user drops on a column it will be the column id,
    // otherwise if they dropped on another project element we use that project's status.
    let newStatus = null;
    if (Object.keys(boardData).includes(overId)) {
      newStatus = overId;
    } else {
      // maybe dropped on a project card - find its status
      const overProject = projects.find(p => p.id === overId);
      if (overProject) newStatus = overProject.status;
    }

    // If we determined a new status and it's different from the active project's status, update Firestore
        if (newStatus && activeProject.status !== newStatus) {
          // ensure status string is normalized and allowed
          const allowedKeys = [...Object.keys(BASE_BOARD_COLUMNS), 'On Hold'];
          if (!allowedKeys.includes(newStatus)) {
            console.warn('Attempted to set unknown status:', newStatus, 'falling back to Planning');
            newStatus = 'Planning';
          }
      try {
        // Update project status
        const projectRef = doc(db, 'projects', activeId);
        await updateDoc(projectRef, {
          status: newStatus,
          updatedAt: Timestamp.now()
        });

        setSnackbar({
          open: true,
          message: 'Project status updated successfully!',
          severity: 'success'
        });
        // optimistic UI: update locally so the board doesn't remove the project briefly
        setProjects(prev => prev.map(p => p.id === activeId ? { ...p, status: newStatus } : p));
  } catch (error) {
        console.error('Error updating project status:', error);
        setSnackbar({
          open: true,
          message: 'Error updating project status: ' + error.message,
          severity: 'error'
        });
      }
  }
    
    setActiveId(null);
    setDragOverId(null);
    setHoverColumn(null);
  };

  // Task status helpers
  const getTaskStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'in progress':
        return <TimelineIcon color="primary" fontSize="small" />;
      case 'planning':
        return <ScheduleIcon color="warning" fontSize="small" />;
      default:
        return <AssignmentIcon color="disabled" fontSize="small" />;
    }
  };

  // Convert hex to rgba helper for highlighting
  const hexToRgba = (hex, alpha = 0.14) => {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    const cleaned = hex.replace('#', '');
    const bigint = parseInt(cleaned, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const isTaskOverdue = (task) => {
    if (!task?.dueDate || (task.status || '').toLowerCase() === 'completed') return false;
    const due = task.dueDate?.toDate ? task.dueDate.toDate() : task.dueDate;
    return new Date(due) < new Date();
  };

  // Handle add new project
  const handleAddProject = () => {
    setSelectedProject({
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
      tags: [],
      tasks: [],
      dependencies: [],
      progress: 0
    });
    setIsNewProject(true);
    setEditMode(true);
    setProjectDialogOpen(true);
  };

  // Handle project edit
  const handleEditProject = (project, e) => {
    if (e) e.stopPropagation();
    setSelectedProject(project);
    setIsNewProject(false);
    setEditMode(true);
    setProjectDialogOpen(true);
  };

  // Quick status change from view mode
  const changeProjectStatus = async (projectId, newStatus) => {
    if (!canEdit) return;
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
      setSnackbar({ open: true, message: 'Project status updated', severity: 'success' });
      // locally update selected project to reflect the change quickly
      if (selectedProject && selectedProject.id === projectId) {
        setSelectedProject({ ...selectedProject, status: newStatus });
      }
    } catch (err) {
      console.error('Error updating project status', err);
      setSnackbar({ open: true, message: 'Error updating status: ' + err.message, severity: 'error' });
    }
  };

  // Handle project delete
  const handleDeleteProject = async (projectId, e) => {
    if (e) e.stopPropagation();
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

  // Handle project save
  const handleSaveProject = async (updatedData) => {
    try {
      // Normalise task dueDates for Firestore writes (Timestamp)
      const normalizeTasksForFirestore = (tasks = []) => tasks.map(t => ({
        ...t,
        dueDate: t?.dueDate instanceof Date ? Timestamp.fromDate(t.dueDate) : (t?.dueDate || null)
      }));

      if (isNewProject) {
        // Create new project
        await addDoc(collection(db, 'projects'), {
          ...updatedData,
          startDate: Timestamp.fromDate(updatedData.startDate),
          endDate: Timestamp.fromDate(updatedData.endDate),
          tasks: normalizeTasksForFirestore(updatedData.tasks),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: {
            userId: currentUser.uid,
            name: currentUser.displayName || currentUser.name || currentUser.email,
            email: currentUser.email
          }
        });

        setSnackbar({
          open: true,
          message: 'Project created successfully!',
          severity: 'success'
        });
      } else {
        // Update existing project
        const projectRef = doc(db, 'projects', selectedProject.id);
        const updatePayload = {
          ...updatedData,
          tasks: normalizeTasksForFirestore(updatedData.tasks),
          updatedAt: Timestamp.now()
        };
        
        // Convert dates if they exist
        if (updatedData.startDate instanceof Date) {
          updatePayload.startDate = Timestamp.fromDate(updatedData.startDate);
  }
        if (updatedData.endDate instanceof Date) {
          updatePayload.endDate = Timestamp.fromDate(updatedData.endDate);
        }
        
        await updateDoc(projectRef, updatePayload);

        setSnackbar({
          open: true,
          message: 'Project updated successfully!',
          severity: 'success'
        });
      }

      setProjectDialogOpen(false);
      setEditMode(false);
      setIsNewProject(false);
    } catch (error) {
      console.error('Error saving project:', error);
      setSnackbar({
        open: true,
        message: 'Error saving project: ' + error.message,
        severity: 'error'
      });
    }
  };

  // Sortable Project Card Component
  const toggleTaskStatus = async (projectId, taskIndex) => {
    if (!canEdit) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const tasks = [...(project.tasks || [])];
    const task = tasks[taskIndex];
    if (!task) return;
    const currentStatus = (task.status || '').toLowerCase();
    // Cycle: planning -> in progress -> completed -> planning
    let nextStatus;
    if (currentStatus === 'planning') nextStatus = 'In Progress';
    else if (currentStatus === 'in progress') nextStatus = 'Completed';
    else if (currentStatus === 'completed') nextStatus = 'Planning';
    else nextStatus = 'Planning';
    tasks[taskIndex] = { ...task, status: nextStatus, updatedAt: Timestamp.now() };
    // Recompute progress
    const completed = tasks.filter(t => (t.status || '').toLowerCase() === 'completed').length;
    const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        tasks,
        progress,
        updatedAt: Timestamp.now()
      });
      setSnackbar({ open: true, message: 'Task status updated', severity: 'success' });
    } catch (err) {
      console.error('Failed to update task status', err);
      setSnackbar({ open: true, message: 'Error updating task: ' + err.message, severity: 'error' });
    }
  };

  const moveTask = async (projectId, taskIndex, direction) => {
    if (!canEdit) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const tasks = [...(project.tasks || [])];
    const newIndex = direction === 'up' ? taskIndex - 1 : taskIndex + 1;
    if (newIndex < 0 || newIndex >= tasks.length) return;
    const [removed] = tasks.splice(taskIndex, 1);
    tasks.splice(newIndex, 0, removed);
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        tasks,
        updatedAt: Timestamp.now()
      });
      setSnackbar({ open: true, message: 'Task order updated', severity: 'success' });
    } catch (err) {
      console.error('Failed to reorder tasks', err);
      setSnackbar({ open: true, message: 'Error reordering tasks: ' + err.message, severity: 'error' });
    }
  };

  const SortableProjectCard = ({ project }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ 
      id: project.id,
      disabled: !(canEdit && !isMobile) // disable dragging on mobile or if user can't edit
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        elevation={isDragging ? 8 : 2}
        sx={{
          mb: 2,
          cursor: canEdit ? 'move' : 'pointer',
          transition: 'all 0.2s ease',
          bgcolor: isDragging ? 'action.hover' : 'background.paper',
          '&:hover': {
            elevation: 4,
            bgcolor: 'action.hover'
          }
        }}
        onClick={() => {
          setSelectedProject(project);
          setIsNewProject(false);
          setEditMode(false);
          setProjectDialogOpen(true);
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {/* Project Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="h6" component="h3" sx={{ 
              fontSize: '1rem', 
              fontWeight: 600,
              lineHeight: 1.2,
              flex: 1,
              mr: 1
            }}>
              {project.name}
            </Typography>
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

          {/* Project Description */}
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 2, 
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {project.description}
          </Typography>

          {/* Progress Bar */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {project.progress || 0}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={project.progress || 0} 
              sx={{ 
                height: 6, 
                borderRadius: 3,
                bgcolor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  bgcolor: getStatusColor(project.status)
                }
              }}
            />
          </Box>

          {/* Tasks Summary */}
          {project.tasks && project.tasks.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Tasks ({project.tasks.filter(t => (t.status || '').toLowerCase() === 'completed').length}/{project.tasks.length})
              </Typography>
              {/* If more than 3 tasks exist show a persistent hint above the scrollable list */}
              {project.tasks.length > 3 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', mb: 1 }}>
                  +{project.tasks.length - 3} more tasks — scroll to view
                </Typography>
              )}

              <Box sx={{ mt: 1, maxHeight: isMobile ? 320 : 160, minHeight: isMobile ? 160 : 120, overflowY: 'auto' }}>
                {project.tasks.map((task, taskIndex) => (
                  <Box
                    key={taskIndex}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 0.5,
                      p: 0.5,
                      borderRadius: 1,
                      bgcolor: (task.status || '').toLowerCase() === 'completed' ? 'success.light' :
                               isTaskOverdue(task) ? 'error.light' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    {canEdit ? (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskStatus(project.id, project.tasks.indexOf(task));
                        }}
                        sx={{ mr: 0.5 }}
                      >
                        {(task.status || '').toLowerCase() === 'completed' ? <CheckCircleIcon color="success" fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
                      </IconButton>
                    ) : getTaskStatusIcon(task.status)}
                    <Typography
                      variant="caption"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(task);
                        setTaskDialogOpen(true);
                      }}
                      sx={{
                        flex: 1,
                        cursor: 'pointer',
                        textDecoration: (task.status || '').toLowerCase() === 'completed' ? 'line-through' : 'none',
                        color: (task.status || '').toLowerCase() === 'completed' ? 'text.disabled' : 'text.primary'
                      }}
                    >
                      {task.name}
                    </Typography>
                    {canEdit && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        <IconButton size="small" disabled={taskIndex === 0} onClick={(e) => { e.stopPropagation(); moveTask(project.id, project.tasks.indexOf(task), 'up'); }}>
                          <ArrowUpwardIcon fontSize="inherit" />
                        </IconButton>
                        <IconButton size="small" disabled={taskIndex === Math.min(4, project.tasks.length - 1)} onClick={(e) => { e.stopPropagation(); moveTask(project.id, project.tasks.indexOf(task), 'down'); }}>
                          <ArrowDownwardIcon fontSize="inherit" />
                        </IconButton>
                      </Box>
                    )}
                    {isTaskOverdue(task) && (
                      <WarningIcon color="error" fontSize="small" />
                    )}
                  </Box>
                ))}
                {/* preserved for legacy compatibility - we keep this here but the persistent hint above is the primary UX */}
              </Box>
            </Box>
          )}

          {/* Project Footer */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {project.assignedUsers && project.assignedUsers.length > 0 && (
                <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.75rem' } }}>
                  {project.assignedUsers.map((user, userIndex) => (
                    <Tooltip key={userIndex} title={user.name || user.email}>
                      <Avatar
                        src={user.photoURL}
                        alt={user.name || user.email}
                      >
                        {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                      </Avatar>
                    </Tooltip>
                  ))}
                </AvatarGroup>
              )}
              {isMobile && project.assignedUsers && project.assignedUsers.length > 0 && (
                <Box sx={{ ml: 1 }}>
                  <Typography variant="caption">{project.assignedUsers.length} members</Typography>
                </Box>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Due: {new Date(project.endDate).toLocaleDateString()}
            </Typography>
          </Box>

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {project.tags.slice(0, 2).map((tag, index) => (
                <Chip 
                  key={index} 
                  label={tag} 
                  size="small" 
                  variant="outlined"
                  sx={{ fontSize: '0.6rem', height: 18 }}
                />
              ))}
              {project.tags.length > 2 && (
                <Chip 
                  label={`+${project.tags.length - 2}`} 
                  size="small" 
                  variant="outlined"
                  sx={{ fontSize: '0.6rem', height: 18 }}
                />
              )}
            </Box>
          )}

          {/* Edit and Delete Buttons */}
          {canEdit && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <IconButton 
                size="small"
                color="primary"
                onClick={(e) => handleEditProject(project, e)}
                sx={{ '&:hover': { bgcolor: 'primary.light' } }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton 
                size="small"
                color="error"
                onClick={(e) => handleDeleteProject(project.id, e)}
                sx={{ '&:hover': { bgcolor: 'error.light' } }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  // Droppable Column Component
  const DroppableColumn = ({ columnId, column }) => {
    const {
      setNodeRef,
      isOver,
    } = useDroppable({
      id: columnId,
    });

    return (
        <Box key={columnId} sx={{
          minWidth: isMobile ? 'auto' : 350,
          width: isMobile ? '100%' : 'auto',
          // Fix column width while dragging to prevent other columns collapsing
          flex: isMobile ? '1 1 auto' : (activeId ? '0 0 360px' : '1 1 0')
        }}>
        <Paper 
          elevation={3} 
          sx={{ 
            p: 2, 
            height: '100%',
            bgcolor: 'grey.50',
            // Add highlight when dragging a card over this column
            boxShadow: activeId && hoverColumn === columnId ? `0 0 0 4px ${hexToRgba(column.color)}` : 'none',
            borderTop: `4px solid ${column.color}`
          }}
        >
          {/* Column Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {column.icon}
              <Typography variant="h6" sx={{ fontWeight: 600, color: column.color }}>
                {column.title}
              </Typography>
              <Chip 
                label={column.projects.length} 
                size="small" 
                sx={{ 
                  bgcolor: column.color, 
                  color: 'white',
                  fontSize: '0.75rem',
                  minWidth: 24,
                  height: 24
                }} 
              />
            </Box>
          </Box>

          {/* Projects Area */}
          <Box
            ref={setNodeRef}
            sx={{
              minHeight: 200,
              bgcolor: isOver ? 'action.hover' : 'transparent',
              borderRadius: 1,
              p: isOver ? 1 : 0,
              transition: 'all 0.2s ease'
            }}
          >
            <SortableContext items={column.projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {column.projects.map((project) => (
                <SortableProjectCard key={project.id} project={project} />
              ))}
            </SortableContext>
            
            {column.projects.length === 0 && (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 4,
                  color: 'text.secondary',
                  fontStyle: 'italic'
                }}
              >
                No projects in {column.title.toLowerCase()}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <Typography>Loading project boards...</Typography>
      </Container>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Project Boards
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Toggle On Hold column visibility */}
          <IconButton
            aria-label={showOnHold ? 'Hide On Hold' : 'Show On Hold'}
            onClick={() => setShowOnHold((prev) => !prev)}
            size="small"
          >
            {showOnHold ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </IconButton>
          <Typography variant="body2" sx={{ ml: 1 }}>
            {showOnHold ? 'Hide' : 'Show'} On Hold Projects
          </Typography>
          {canEdit ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddProject}
              size={isMobile ? 'small' : 'medium'}
              sx={{ display: isMobile ? 'none' : 'inline-flex' }}
            >
              Add Project
            </Button>
          ) : (
            <Chip 
              label="View Only" 
              color="warning" 
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          )}
        </Box>
      </Box>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: 3,
            overflowX: 'auto',
            minHeight: 600,
            pb: 2
          }}
        >
          {Object.entries(boardData).map(([columnId, column]) => 
            <DroppableColumn key={columnId} columnId={columnId} column={column} />
          )}
          {/* Show overlay when dragging outside columns */}
          {activeId && !isMobile && (
            <Box sx={{ position: 'relative', width: '100%' }}>
              {dragOverId === null && (
                <Paper elevation={3} sx={{ position: 'absolute', right: 16, top: 16, p: 1, bgcolor: 'warning.light', color: 'text.primary', zIndex: 2000 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>Drop outside columns to mark On Hold</Typography>
                </Paper>
              )}
            </Box>
          )}
        </Box>
        
        <DragOverlay>
            {activeId ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pointerEvents: 'none' }}>
                <SortableProjectCard project={projects.find(p => p.id === activeId)} />
                {hoverColumn ? (
                  <Paper elevation={6} sx={{ p: '6px 10px', bgcolor: getStatusColor(hoverColumn), color: '#fff', borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>Move to {hoverColumn}</Typography>
                  </Paper>
                ) : dragOverId === null ? (
                  <Paper elevation={6} sx={{ p: '6px 10px', bgcolor: 'warning.main', color: '#fff', borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>Drop outside to mark On Hold</Typography>
                  </Paper>
                ) : null}
              </Box>
            ) : null}
        </DragOverlay>
      </DndContext>

      {/* Mobile FAB for quick Add Project */}
      {isMobile && canEdit && (
        <Fab
          color="primary"
          aria-label="add"
          onClick={handleAddProject}
          sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1400 }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Project Details/Edit Dialog */}
      <Dialog
        open={projectDialogOpen}
        onClose={() => {
          setProjectDialogOpen(false);
          setEditMode(false);
          setIsNewProject(false);
        }}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {isNewProject ? 'Add New Project' : editMode ? 'Edit Project' : 'Project Details'}
        </DialogTitle>
        <DialogContent>
                {selectedProject && !editMode && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h5" gutterBottom>
                    {selectedProject.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
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
                    {selectedProject.description}
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

                {canEdit && (
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={selectedProject.status}
                        label="Status"
                        onChange={(e) => changeProjectStatus(selectedProject.id, e.target.value)}
                      >
                        <MenuItem value="Planning">Planning</MenuItem>
                        <MenuItem value="In Progress">In Progress</MenuItem>
                        <MenuItem value="Completed">Completed</MenuItem>
                        <MenuItem value="On Hold">On Hold</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {selectedProject.assignedUsers && selectedProject.assignedUsers.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Assigned Team Members
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
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Tasks ({selectedProject.tasks.filter(t => t.status === 'Completed').length}/{selectedProject.tasks.length} completed)
                    </Typography>
                    <List dense>
                      {selectedProject.tasks.map((task, index) => (
                        <ListItem 
                          key={index}
                          sx={{ 
                            bgcolor: task.status === 'Completed' ? 'success.light' : 
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
                                  Status: {task.status}
                                </Typography>
                                {task.dueDate && (
                                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                                    Due: {new Date(task.dueDate.toDate()).toLocaleDateString()}
                                  </Typography>
                                )}
                                {task.assignedTo && (
                                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                                    Assigned: {task.assignedTo.name || task.assignedTo.email}
                                  </Typography>
                                )}
                              </Box>
                            }
                            sx={{
                              '& .MuiListItemText-primary': {
                                textDecoration: task.status === 'Completed' ? 'line-through' : 'none',
                                color: task.status === 'Completed' ? 'text.disabled' : 'text.primary'
                              }
                            }}
                          />
                          {isTaskOverdue(task) && (
                            <WarningIcon color="error" />
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
              </Grid>
            </Box>
          )}

          {/* Edit Form */}
          {selectedProject && editMode && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Project Name"
                    value={selectedProject.name}
                    onChange={(e) => setSelectedProject({ ...selectedProject, name: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Description"
                    value={selectedProject.description}
                    onChange={(e) => setSelectedProject({ ...selectedProject, description: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={selectedProject.status}
                      label="Status"
                      onChange={(e) => setSelectedProject({ ...selectedProject, status: e.target.value })}
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
                      value={selectedProject.priority}
                      label="Priority"
                      onChange={(e) => setSelectedProject({ ...selectedProject, priority: e.target.value })}
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
                    value={selectedProject.startDate}
                    onChange={(date) => setSelectedProject({ ...selectedProject, startDate: date })}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="End Date"
                    value={selectedProject.endDate}
                    onChange={(date) => setSelectedProject({ ...selectedProject, endDate: date })}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Center</InputLabel>
                    <Select
                      value={selectedProject.center?.id || ''}
                      label="Center"
                      onChange={(e) => {
                        const selectedCenter = centers.find(c => c.id === e.target.value);
                        setSelectedProject({ ...selectedProject, center: selectedCenter || null });
                      }}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {centers.map((center) => (
                        <MenuItem key={center.id} value={center.id}>
                          {center.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Owner</InputLabel>
                    <Select
                      value={selectedProject.owner?.id || selectedProject.owner?.userId || ''}
                      label="Owner"
                      onChange={(e) => {
                        const selectedUser = users.find(u => u.id === e.target.value);
                        setSelectedProject({ 
                          ...selectedProject, 
                          owner: selectedUser ? {
                            userId: selectedUser.id,
                            name: selectedUser.name || selectedUser.displayName,
                            email: selectedUser.email,
                            photoURL: selectedUser.photoURL
                          } : null 
                        });
                      }}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {users.map((user) => (
                        <MenuItem key={user.id} value={user.id}>
                          {user.name || user.displayName || user.email}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Assigned Team Members</InputLabel>
                    <Select
                      multiple
                      value={selectedProject.assignedUsers?.map(u => u.id || u.userId) || []}
                      label="Assigned Team Members"
                      onChange={(e) => {
                        const selectedUserIds = e.target.value;
                        const selectedUsers = users.filter(u => selectedUserIds.includes(u.id)).map(u => ({
                          userId: u.id,
                          name: u.name || u.displayName,
                          email: u.email,
                          photoURL: u.photoURL
                        }));
                        setSelectedProject({ ...selectedProject, assignedUsers: selectedUsers });
                      }}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((userId) => {
                            const user = users.find(u => u.id === userId);
                            return (
                              <Chip 
                                key={userId} 
                                label={user?.name || user?.displayName || user?.email} 
                                size="small" 
                              />
                            );
                          })}
                        </Box>
                      )}
                    >
                      {users.map((user) => (
                        <MenuItem key={user.id} value={user.id}>
                          <Checkbox checked={(selectedProject.assignedUsers?.map(u => u.id || u.userId) || []).indexOf(user.id) > -1} />
                          <ListItemText primary={user.name || user.displayName || user.email} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Tags (comma-separated)"
                    value={selectedProject.tags?.join(', ') || ''}
                    onChange={(e) => {
                      const tagsArray = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                      setSelectedProject({ ...selectedProject, tags: tagsArray });
                    }}
                    placeholder="e.g., UI, Backend, Mobile"
                    helperText="Enter tags separated by commas"
                  />
                </Grid>

                {/* Tasks Editor - Improved UX */}
                <Grid item xs={12}>
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'grey.50', p: 1, borderRadius: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Tasks
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        size="small"
                        fullWidth={isMobile}
                        onClick={() => {
                          setSelectedProject({
                            ...selectedProject,
                            tasks: [...(selectedProject.tasks || []), { name: '', status: 'Planning', dueDate: null, priority: '', description: '', assignedTo: {} }]
                          });
                        }}
                        disabled={!canEdit}
                        sx={{ ...(canEdit ? {} : { opacity: 0.6 }), '&:hover': { boxShadow: canEdit ? 4 : 'none' } }}
                      >
                        Add Task
                      </Button>
                    </Box>
                    {(selectedProject.tasks || []).map((task, idx) => {
                      const dueDate = task.dueDate && task.dueDate.toDate ? task.dueDate.toDate() : task.dueDate;
                      return (
                        <Box key={idx} sx={{ mb: 1, '&:hover .task-delete': { opacity: 1 } }}>
                          <Accordion sx={{ bgcolor: 'background.paper', transition: 'box-shadow 0.15s', '&:hover': { boxShadow: 3 } }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                <Typography sx={{ flex: 1, fontWeight: 600 }}>{task.name || `Task ${idx + 1}`}</Typography>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                  <Chip label={task.status || 'Planning'} size="small" sx={{ bgcolor: getStatusColor(task.status), color: 'white' }} />
                                  {dueDate && (
                                    <Typography variant="caption" color={isTaskOverdue(task) ? 'error' : 'text.secondary'}>
                                      Due: {new Date(dueDate).toLocaleDateString()}
                                    </Typography>
                                  )}
                                          {task.assignedTo && !isMobile && (
                                              <Avatar src={task.assignedTo.photoURL} sx={{ width: 24, height: 24, ml: 1 }}>
                                      {(task.assignedTo.name || task.assignedTo.email || 'U').charAt(0).toUpperCase()}
                                    </Avatar>
                                  )}
                                </Box>
                              </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    label="Task Name"
                                    value={task.name || ''}
                                    onChange={e => {
                                      const newTasks = [...selectedProject.tasks];
                                      newTasks[idx] = { ...newTasks[idx], name: e.target.value };
                                      setSelectedProject({ ...selectedProject, tasks: newTasks });
                                    }}
                                    size="small"
                                    fullWidth
                                    sx={{ minWidth: 180 }}
                                  />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                  <FormControl fullWidth size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                      value={task.status || 'Planning'}
                                      label="Status"
                                      onChange={e => {
                                        const newTasks = [...selectedProject.tasks];
                                        newTasks[idx] = { ...newTasks[idx], status: e.target.value };
                                        setSelectedProject({ ...selectedProject, tasks: newTasks });
                                      }}
                                    >
                                      <MenuItem value="Planning">Planning</MenuItem>
                                      <MenuItem value="In Progress">In Progress</MenuItem>
                                      <MenuItem value="Completed">Completed</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                  <DatePicker
                                    label="Due Date"
                                    value={task.dueDate || null}
                                    onChange={date => {
                                      const newTasks = [...selectedProject.tasks];
                                      newTasks[idx] = { ...newTasks[idx], dueDate: date };
                                      setSelectedProject({ ...selectedProject, tasks: newTasks });
                                    }}
                                    renderInput={params => {
                                      const overflowDueDate = task.dueDate && task.dueDate.toDate ? task.dueDate.toDate() : task.dueDate;
                                      const isInvalid = overflowDueDate && (new Date(overflowDueDate) < new Date()) && (task.status || '').toLowerCase() !== 'completed';
                                      return <TextField {...params} size="small" fullWidth sx={{ minWidth: 140 }} error={isInvalid} helperText={isInvalid ? 'Due date is in the past' : ''} />
                                    }}
                                  />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                  <FormControl fullWidth size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>Priority</InputLabel>
                                    <Select
                                      value={task.priority || ''}
                                      label="Priority"
                                      onChange={e => {
                                        const newTasks = [...selectedProject.tasks];
                                        newTasks[idx] = { ...newTasks[idx], priority: e.target.value };
                                        setSelectedProject({ ...selectedProject, tasks: newTasks });
                                      }}
                                    >
                                      <MenuItem value="Low">Low</MenuItem>
                                      <MenuItem value="Medium">Medium</MenuItem>
                                      <MenuItem value="High">High</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                  <TextField
                                    label="Description"
                                    value={task.description || ''}
                                    onChange={e => {
                                      const newTasks = [...selectedProject.tasks];
                                      newTasks[idx] = { ...newTasks[idx], description: e.target.value };
                                      setSelectedProject({ ...selectedProject, tasks: newTasks });
                                    }}
                                    size="small"
                                    fullWidth
                                    multiline
                                    rows={2}
                                    sx={{ minWidth: 200 }}
                                  />
                                </Grid>
                                {/* Assigned To (user dropdown) */}
                                <Grid item xs={12} sm={6}>
                                  <FormControl fullWidth size="small" sx={{ minWidth: 180 }}>
                                    <InputLabel>Assigned To</InputLabel>
                                    <Select
                                      value={task.assignedTo?.uid || ''}
                                      label="Assigned To"
                                      onChange={e => {
                                        const selectedUser = users.find(u => u.id === e.target.value);
                                        const newTasks = [...selectedProject.tasks];
                                        newTasks[idx] = {
                                          ...newTasks[idx],
                                          assignedTo: selectedUser
                                            ? {
                                                uid: selectedUser.id,
                                                name: selectedUser.name || selectedUser.displayName || selectedUser.email,
                                                email: selectedUser.email,
                                                photoURL: selectedUser.photoURL,
                                                role: selectedUser.role
                                              }
                                            : {}
                                        };
                                        setSelectedProject({ ...selectedProject, tasks: newTasks });
                                      }}
                                    >
                                      <MenuItem value=""><em>None</em></MenuItem>
                                      {users.map(user => (
                                        <MenuItem key={user.id} value={user.id}>
                                          {user.name || user.displayName || user.email}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                  <Divider sx={{ my: 1 }} />
                                </Grid>
                                <Grid item xs={12}>
                                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    {canEdit && (
                                      <IconButton className="task-delete" color="error" sx={{ opacity: 0, transition: 'opacity 0.15s' }} onClick={() => {
                                      const newTasks = [...selectedProject.tasks];
                                      newTasks.splice(idx, 1);
                                      setSelectedProject({ ...selectedProject, tasks: newTasks });
                                    }}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                    )}
                                  
                                  </Box>
                                </Grid>
                              </Grid>
                            </AccordionDetails>
                          </Accordion>
                        </Box>
                      );
                    })}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setProjectDialogOpen(false);
            setEditMode(false);
            setIsNewProject(false);
          }}>
            {editMode ? 'Cancel' : 'Close'}
          </Button>
          {!editMode && !isNewProject && canEdit && (
            <Button 
              variant="contained" 
              color="primary"
              startIcon={<EditIcon />}
              onClick={() => setEditMode(true)}
            >
              Edit
            </Button>
          )}
          {editMode && (
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => handleSaveProject({
                name: selectedProject.name,
                description: selectedProject.description,
                status: selectedProject.status,
                priority: selectedProject.priority,
                startDate: selectedProject.startDate,
                endDate: selectedProject.endDate,
                center: selectedProject.center,
                owner: selectedProject.owner,
                assignedUsers: selectedProject.assignedUsers,
                tags: selectedProject.tags,
                reminderDays: selectedProject.reminderDays || 7,
                tasks: selectedProject.tasks || [],
                dependencies: selectedProject.dependencies || [],
                progress: selectedProject.progress || 0
              })}
            >
              {isNewProject ? 'Create Project' : 'Save Changes'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Task Details Dialog */}
      <Dialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Task Details
        </DialogTitle>
        <DialogContent>
          {selectedTask && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {selectedTask.name}
              </Typography>
              
              {selectedTask.description && (
                <Typography variant="body1" paragraph>
                  {selectedTask.description}
                </Typography>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Status
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getTaskStatusIcon(selectedTask.status)}
                    <Typography variant="body1">
                      {selectedTask.status}
                    </Typography>
                  </Box>
                </Grid>

                {selectedTask.priority && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Priority
                    </Typography>
                    <Chip
                      label={selectedTask.priority}
                      size="small"
                      sx={{ 
                        bgcolor: getPriorityColor(selectedTask.priority),
                        color: 'white'
                      }}
                    />
                  </Grid>
                )}

                {selectedTask.dueDate && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Due Date
                    </Typography>
                    <Typography 
                      variant="body1"
                      color={isTaskOverdue(selectedTask) ? 'error' : 'text.primary'}
                    >
                      {new Date(selectedTask.dueDate.toDate()).toLocaleDateString()}
                      {isTaskOverdue(selectedTask) && ' (Overdue)'}
                    </Typography>
                  </Grid>
                )}

                {selectedTask.assignedTo && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Assigned To
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Avatar src={selectedTask.assignedTo.photoURL} sx={{ width: 32, height: 32 }}>
                        {(selectedTask.assignedTo.name || selectedTask.assignedTo.email || 'U').charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="body1">
                        {selectedTask.assignedTo.name || selectedTask.assignedTo.email}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDialogOpen(false)}>
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

export default Boards;