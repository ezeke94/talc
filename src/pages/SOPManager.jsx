import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Paper, Box, Button, TextField, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Checkbox, FormControlLabel, Chip, IconButton, Tooltip, Card, CardContent, CardActions, Stack, Divider, Badge } from '@mui/material';
import { Link as LinkIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Description as DescriptionIcon } from '@mui/icons-material';
import { db } from '../firebase/config';
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, orderBy, query, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const SOPManager = () => {
  const { currentUser } = useAuth();
  const [sops, setSops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingSop, setEditingSop] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [todos, setTodos] = useState([]);
  // ...existing code...
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userRole, setUserRole] = useState('');

  // Fetch current user's role from Firestore (auth user object doesn't include custom fields)
  useEffect(() => {
    let unsubUser;
    const fetchRole = async () => {
      if (!currentUser) return;
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        // Use onSnapshot to reflect role changes live
        unsubUser = onSnapshot(userDocRef, (snap) => {
          const data = snap.data();
          setUserRole((data && data.role) || '');
        });
      } catch (e) {
        console.error('Failed to fetch user role', e);
      }
    };
    fetchRole();
    return () => {
      if (typeof unsubUser === 'function') unsubUser();
    };
  }, [currentUser]);

  // Allow only Admin/Quality (not Evaluators) to edit/delete
  const canEdit = useMemo(() => {
    const role = (userRole || '').trim().toLowerCase();
    if (import.meta.env.MODE !== 'production') return role !== 'evaluator';
    return role === 'admin' || role === 'quality';
  }, [userRole]);

  useEffect(() => {
    setLoading(true);
    setError('');
    const q = query(collection(db, 'sops'), orderBy('title'));
    const unsub = onSnapshot(q, (snapshot) => {
      setSops(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (e) => {
      console.error('Failed to load SOPs', e);
      setError('Failed to load SOPs');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleOpenDialog = (sop = null) => {
  setEditingSop(sop);
  setTitle(sop ? sop.title : '');
  setDescription(sop ? sop.description : '');
  setUrl(sop ? sop.url || '' : '');
  setTodos(sop ? (sop.todos || []) : []);
  setShowDialog(true);
  };

  const handleSaveSop = async () => {
    if (!currentUser) return;
    const baseUserName = currentUser.displayName || currentUser.email || 'Unknown User';
    const now = new Date();
    const sopData = {
      title: title.trim(),
      description: description.trim(),
      url: url.trim(),
      todos: (todos || []).map(t => ({ id: t.id || Date.now(), text: (t.text || '').trim() })),
      // metadata
      updatedAt: now,
      lastModifiedBy: { userId: currentUser.uid, userName: baseUserName },
    };
    setSaving(true);
    try {
      if (editingSop) {
  // ...existing code...
        await updateDoc(doc(db, 'sops', editingSop.id), sopData);
        
      } else {
        const newSop = {
          ...sopData,
          createdAt: now,
          createdBy: { userId: currentUser.uid, userName: baseUserName },
        };
        const docRef = await addDoc(collection(db, 'sops'), newSop);
        
      }
      // Close dialog and reset
      setShowDialog(false);
      setEditingSop(null);
      setTitle('');
      setDescription('');
      setUrl('');
      setTodos([]);
    } catch (e) {
      console.error('Failed to save SOP', e);
      alert('Failed to save SOP');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSop = async (id) => {
    if (!currentUser) return;
    const target = sops.find(s => s.id === id);
    if (!target) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'sops', id));
      
    } catch (e) {
      console.error('Failed to delete SOP', e);
      alert('Failed to delete SOP');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const addTodo = () => setTodos([...(todos || []), { id: Date.now(), text: '' }]);
  const updateTodo = (idx, value) => {
    const newTodos = [...todos];
    newTodos[idx].text = value;
    setTodos(newTodos);
  };
  const removeTodo = idx => setTodos(todos.filter((_, i) => i !== idx));

  return (
    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ borderRadius: 3 }}>
        {/* Header Section */}
        <Box sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
          color: 'white', 
          p: 4, 
          borderRadius: '12px 12px 0 0' 
        }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
                SOP Management
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: '600px' }}>
                Manage Standard Operating Procedures for events and tasks. Create, edit, and organize SOPs with associated documentation links.
              </Typography>
            </Box>
            {canEdit && (
              <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  fontWeight: 600,
                  '&:hover': { 
                    bgcolor: 'rgba(255,255,255,0.3)' 
                  }
                }}
              >
                Add New SOP
              </Button>
            )}
          </Stack>
        </Box>

        {/* Content Section */}
        <Box sx={{ p: 4 }}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
              <Stack alignItems="center" spacing={2}>
                <CircularProgress size={40} />
                <Typography variant="h6" color="text.secondary">Loading SOPs...</Typography>
              </Stack>
            </Box>
          ) : error ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="error" gutterBottom>{error}</Typography>
              <Typography color="text.secondary">Please try refreshing the page</Typography>
            </Box>
          ) : sops.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <DescriptionIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom color="text.secondary">
                No SOPs found
              </Typography>
              <Typography color="text.secondary" paragraph>
                {canEdit ? 'Create your first SOP to get started' : 'No SOPs have been created yet'}
              </Typography>
              {canEdit && (
                <Button 
                  variant="contained" 
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                  sx={{ mt: 2 }}
                >
                  Create First SOP
                </Button>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
              {sops.map(sop => (
                <Card key={sop.id} elevation={2} sx={{ 
                  borderRadius: 2, 
                  transition: 'all 0.3s ease',
                  '&:hover': { 
                    transform: 'translateY(-4px)', 
                    boxShadow: 4 
                  },
                  height: 'fit-content'
                }}>
                  <CardContent sx={{ pb: 1 }}>
                    <Stack spacing={2}>
                      {/* SOP Title and Badge */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2, wordBreak: 'break-word', flex: 1 }}>
                          {sop.title}
                        </Typography>
                        <Badge 
                          badgeContent={Array.isArray(sop.todos) ? sop.todos.length : 0} 
                          color="primary"
                          sx={{ '& .MuiBadge-badge': { fontSize: '0.75rem' } }}
                        >
                          <Chip 
                            label="SOP" 
                            size="small" 
                            variant="outlined" 
                            color="primary"
                          />
                        </Badge>
                      </Box>

                      {/* Description */}
                      {sop.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.4
                        }}>
                          {sop.description}
                        </Typography>
                      )}

                      {/* Tasks Preview */}
                      {Array.isArray(sop.todos) && sop.todos.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                            TASKS ({sop.todos.length})
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {sop.todos.slice(0, 3).map((todo, idx) => (
                              <Chip 
                                key={idx}
                                label={todo.text.length > 20 ? `${todo.text.substring(0, 20)}...` : todo.text}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 24 }}
                              />
                            ))}
                            {sop.todos.length > 3 && (
                              <Chip 
                                label={`+${sop.todos.length - 3} more`}
                                size="small"
                                variant="outlined"
                                color="secondary"
                                sx={{ fontSize: '0.7rem', height: 24 }}
                              />
                            )}
                          </Box>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>

                  <Divider />

                  {/* Actions */}
                  <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {sop.url && (
                        <Tooltip title="Open SOP Link">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => window.open(sop.url, '_blank')}
                            sx={{ 
                              bgcolor: 'primary.50',
                              '&:hover': { bgcolor: 'primary.100' }
                            }}
                          >
                            <LinkIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                    
                    {canEdit && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Edit SOP">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenDialog(sop)}
                            sx={{ 
                              bgcolor: 'action.hover',
                              '&:hover': { bgcolor: 'action.selected' }
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete SOP">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(sop)}
                            disabled={deleting}
                            sx={{ 
                              bgcolor: 'error.50',
                              '&:hover': { bgcolor: 'error.100' }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </CardActions>
                </Card>
              ))}
            </Box>
          )}
        </Box>
        <Dialog open={showDialog} onClose={() => setShowDialog(false)} fullWidth maxWidth="md">
          <DialogTitle sx={{ 
            bgcolor: 'primary.50', 
            color: 'primary.main',
            fontWeight: 600,
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}>
            {editingSop ? 'Edit SOP' : 'Create New SOP'}
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {/* Basic Information Section */}
              <Box>
                <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', mb: 2 }}>
                  Basic Information
                </Typography>
                <Stack spacing={2}>
                  <TextField 
                    label="SOP Title" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    fullWidth 
                    required
                    placeholder="Enter a descriptive title for this SOP"
                  />
                  <TextField 
                    label="Description" 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    fullWidth 
                    multiline
                    rows={3}
                    placeholder="Provide a detailed description of this SOP's purpose and scope"
                  />
                  <TextField 
                    label="Documentation URL" 
                    value={url} 
                    onChange={e => setUrl(e.target.value)} 
                    fullWidth 
                    placeholder="https://example.com/sop-document"
                    helperText="Optional: Link to external SOP documentation"
                  />
                </Stack>
              </Box>

              <Divider />

              {/* Tasks Section */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: 'text.primary' }}>
                    Task Checklist
                  </Typography>
                  <Button 
                    variant="outlined" 
                    startIcon={<AddIcon />}
                    onClick={addTodo}
                    size="small"
                  >
                    Add Task
                  </Button>
                </Box>
                
                {todos.length === 0 ? (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 4, 
                    bgcolor: 'grey.50', 
                    borderRadius: 1,
                    border: '2px dashed',
                    borderColor: 'grey.300'
                  }}>
                    <Typography color="text.secondary" variant="body2">
                      No tasks added yet. Click "Add Task" to create your first task.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={1}>
                    {todos.map((todo, idx) => (
                      <Card key={todo.id} variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="body2" sx={{ minWidth: 60, color: 'text.secondary' }}>
                              Task {idx + 1}
                            </Typography>
                            <TextField 
                              value={todo.text} 
                              onChange={e => updateTodo(idx, e.target.value)} 
                              size="small" 
                              sx={{ flex: 1 }}
                              placeholder="Enter task description"
                            />
                            <Tooltip title="Remove Task">
                              <IconButton 
                                color="error" 
                                onClick={() => removeTodo(idx)}
                                size="small"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
            <Button onClick={() => setShowDialog(false)} variant="outlined">
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleSaveSop} 
              disabled={!title.trim() || saving}
              startIcon={saving ? <CircularProgress size={16} /> : null}
            >
              {saving ? 'Saving...' : (editingSop ? 'Update SOP' : 'Create SOP')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ 
            color: 'error.main',
            fontWeight: 600,
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}>
            Delete SOP
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <DeleteIcon color="error" sx={{ mt: 0.5 }} />
              <Box>
                <Typography variant="body1" gutterBottom>
                  Are you sure you want to delete "<strong>{deleteTarget?.title}</strong>"?
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  This action cannot be undone. All tasks and associated data will be permanently removed.
                </Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
            <Button onClick={() => setDeleteTarget(null)} disabled={deleting} variant="outlined">
              Cancel
            </Button>
            <Button 
              color="error" 
              variant="contained" 
              onClick={() => handleDeleteSop(deleteTarget.id)} 
              disabled={deleting}
              startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
            >
              {deleting ? 'Deleting...' : 'Delete SOP'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Container>
  );
};

export default SOPManager;
