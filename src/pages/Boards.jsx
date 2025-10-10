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
  Warning as WarningIcon
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
import { db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query,
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { getStatusColor, getPriorityColor } from '../utils/projectSeedData';

const BOARD_COLUMNS = {
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

const Boards = () => {
  const { currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Check user permissions
  const userRole = currentUser?.role?.toLowerCase() || '';
  const canEdit = ['admin', 'quality'].includes(userRole);
  const canView = ['admin', 'quality', 'coordinator'].includes(userRole);
  
  // State management
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activeId, setActiveId] = useState(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Check access permission
  if (!canView) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You don't have permission to view project boards. Only Admin, Quality, and Coordinator roles can access this page.
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
    Object.keys(BOARD_COLUMNS).forEach(status => {
      columns[status] = {
        ...BOARD_COLUMNS[status],
        projects: projects.filter(project => project.status === status)
      };
    });
    return columns;
  }, [projects]);

  // Handle drag and drop
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    if (!canEdit) return;
    
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
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

    // If dropped on a different column
    if (Object.keys(BOARD_COLUMNS).includes(overId) && activeProject.status !== overId) {
      try {
        // Update project status
        const projectRef = doc(db, 'projects', activeId);
        await updateDoc(projectRef, {
          status: overId,
          updatedAt: new Date()
        });

        setSnackbar({
          open: true,
          message: 'Project status updated successfully!',
          severity: 'success'
        });
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

  const isTaskOverdue = (task) => {
    if (!task.dueDate || task.status === 'Completed') return false;
    return new Date(task.dueDate.toDate()) < new Date();
  };

  // Sortable Project Card Component
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
      disabled: !canEdit 
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
                Tasks ({project.tasks.filter(t => t.status === 'Completed').length}/{project.tasks.length})
              </Typography>
              <Box sx={{ mt: 1, maxHeight: 120, overflowY: 'auto' }}>
                {project.tasks.slice(0, 3).map((task, taskIndex) => (
                  <Box 
                    key={taskIndex}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      mb: 0.5,
                      p: 0.5,
                      borderRadius: 1,
                      bgcolor: task.status === 'Completed' ? 'success.light' : 
                              isTaskOverdue(task) ? 'error.light' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTask(task);
                      setTaskDialogOpen(true);
                    }}
                  >
                    {getTaskStatusIcon(task.status)}
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        flex: 1,
                        textDecoration: task.status === 'Completed' ? 'line-through' : 'none',
                        color: task.status === 'Completed' ? 'text.disabled' : 'text.primary'
                      }}
                    >
                      {task.name}
                    </Typography>
                    {isTaskOverdue(task) && (
                      <WarningIcon color="error" fontSize="small" />
                    )}
                  </Box>
                ))}
                {project.tasks.length > 3 && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    +{project.tasks.length - 3} more tasks
                  </Typography>
                )}
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
      <Box key={columnId} sx={{ minWidth: 350, flex: 1 }}>
        <Paper 
          elevation={3} 
          sx={{ 
            p: 2, 
            height: '100%',
            bgcolor: 'grey.50',
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
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Project Boards
        </Typography>
        {!canEdit && (
          <Chip 
            label="View Only" 
            color="warning" 
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        )}
      </Box>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 3,
            overflowX: 'auto',
            minHeight: 600,
            pb: 2
          }}
        >
          {Object.entries(boardData).map(([columnId, column]) => 
            <DroppableColumn key={columnId} columnId={columnId} column={column} />
          )}
        </Box>
        
        <DragOverlay>
          {activeId ? (
            <SortableProjectCard project={projects.find(p => p.id === activeId)} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Project Details Dialog */}
      <Dialog
        open={projectDialogOpen}
        onClose={() => setProjectDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          Project Details
        </DialogTitle>
        <DialogContent>
          {selectedProject && (
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProjectDialogOpen(false)}>
            Close
          </Button>
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
  );
};

export default Boards;