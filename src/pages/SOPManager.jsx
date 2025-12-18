import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Paper, Box, Button, TextField, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Checkbox, FormControlLabel, Chip, IconButton, Tooltip, Card, CardContent, CardActions, Stack, Divider, Badge } from '@mui/material';
import { Link as LinkIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Description as DescriptionIcon } from '@mui/icons-material';
import { db } from '../firebase/config';
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
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

  // Allow only Admin/Quality (not Evaluators or Coordinators) to edit/delete
  const canEdit = useMemo(() => {
    const role = (userRole || '').trim().toLowerCase();
    if (import.meta.env.MODE !== 'production') return role !== 'evaluator' && role !== 'coordinator';
    return role === 'admin' || role === 'quality';
  }, [userRole]);

  // Allow view access for Admin, Quality, and Coordinators
  const canView = useMemo(() => {
    const role = (userRole || '').trim().toLowerCase();
    return ['admin', 'quality', 'coordinator'].includes(role);
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
        const _docRef = await addDoc(collection(db, 'sops'), newSop);
        
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

  // If user doesn't have view access, show access denied
  if (!canView) {
    return (
      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        <Paper elevation={3} sx={{ borderRadius: { xs: 2, sm: 3 }, p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You don't have permission to view SOPs. Only Admin, Quality, and Coordinator roles can access this page.
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
      <Paper elevation={3} sx={{ borderRadius: { xs: 2, sm: 3 } }}>
        {/* Header Section */}
        <Box sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
          color: 'white', 
          p: { xs: 2, sm: 3, md: 4 }, 
          borderRadius: { xs: '8px 8px 0 0', sm: '12px 12px 0 0' }
        }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
            <Box>
              <Typography variant="h4" gutterBottom sx={{ 
                fontWeight: 700, 
                mb: 1,
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
              }}>
                SOP Management
              </Typography>
              <Typography variant="body1" sx={{ 
                opacity: 0.9, 
                maxWidth: '600px',
                fontSize: { xs: '0.875rem', sm: '1rem' },
                lineHeight: 1.5
              }}>
                Manage Standard Operating Procedures for events and tasks. Create, edit, and organize SOPs with associated documentation links.
              </Typography>
            </Box>
            {canEdit && (
              <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
                fullWidth={{ xs: true, sm: false }}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  fontWeight: 600,
                  minHeight: { xs: 44, sm: 36 },
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
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
              <Stack alignItems="center" spacing={2}>
                <CircularProgress size={40} />
                <Typography variant="h6" color="text.secondary" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  Loading SOPs...
                </Typography>
              </Stack>
            </Box>
          ) : error ? (
            <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
              <Typography variant="h6" color="error" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {error}
              </Typography>
              <Typography color="text.secondary">Please try refreshing the page</Typography>
            </Box>
          ) : sops.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
              <DescriptionIcon sx={{ fontSize: { xs: 48, sm: 64 }, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom color="text.secondary" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                No SOPs found
              </Typography>
              <Typography color="text.secondary" paragraph sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                {canEdit ? 'Create your first SOP to get started' : 'No SOPs have been created yet'}
              </Typography>
              {canEdit && (
                <Button 
                  variant="contained" 
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                  sx={{ mt: 2, minHeight: { xs: 44, sm: 36 } }}
                >
                  Create First SOP
                </Button>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gap: { xs: 2, sm: 3 }, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
              {sops.map(sop => (
                <Card key={sop.id} elevation={2} sx={{ 
                  borderRadius: 2, 
                  transition: 'all 0.3s ease',
                  '&:hover': { 
                    transform: { xs: 'none', sm: 'translateY(-4px)' }, 
                    boxShadow: { xs: 2, sm: 4 }
                  },
                  height: 'fit-content'
                }}>
                  <CardContent sx={{ pb: 1, p: { xs: 2, sm: 2.5 } }}>
                    <Stack spacing={2}>
                      {/* SOP Title */}
                      <Box>
                        <Typography variant="h6" sx={{ 
                          fontWeight: 600, 
                          lineHeight: 1.3, 
                          wordBreak: 'break-word',
                          fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }
                        }}>
                          {sop.title}
                        </Typography>
                      </Box>

                      {/* Description */}
                      {sop.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: { xs: 3, sm: 2 },
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.5,
                          fontSize: { xs: '0.8125rem', sm: '0.875rem' }
                        }}>
                          {sop.description}
                        </Typography>
                      )}

                      {/* Tasks Preview */}
                      {Array.isArray(sop.todos) && sop.todos.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ 
                            fontWeight: 600, 
                            mb: 1, 
                            display: 'block',
                            fontSize: { xs: '0.7rem', sm: '0.75rem' }
                          }}>
                            TASKS ({sop.todos.length})
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {sop.todos.slice(0, { xs: 2, sm: 3 }[Object.keys({ xs: 2, sm: 3 })[0]] || 3).map((todo, idx) => (
                              <Chip 
                                key={idx}
                                label={todo.text.length > 20 ? `${todo.text.substring(0, 20)}...` : todo.text}
                                size="small"
                                variant="outlined"
                                sx={{ 
                                  fontSize: { xs: '0.65rem', sm: '0.7rem' }, 
                                  height: { xs: 22, sm: 24 },
                                  '& .MuiChip-label': {
                                    px: { xs: 1, sm: 1.5 }
                                  }
                                }}
                              />
                            ))}
                            {sop.todos.length > 3 && (
                              <Chip 
                                label={`+${sop.todos.length - 3} more`}
                                size="small"
                                variant="outlined"
                                color="secondary"
                                sx={{ 
                                  fontSize: { xs: '0.65rem', sm: '0.7rem' }, 
                                  height: { xs: 22, sm: 24 }
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>

                  <Divider />

                  {/* Actions */}
                  <CardActions sx={{ 
                    justifyContent: 'space-between', 
                    px: { xs: 1.5, sm: 2 }, 
                    py: { xs: 1, sm: 1.5 },
                    flexWrap: 'wrap',
                    gap: 1
                  }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {sop.url && (
                        <Tooltip title="Open SOP Link">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => window.open(sop.url, '_blank')}
                            sx={{ 
                              bgcolor: 'primary.50',
                              minWidth: { xs: 36, sm: 32 },
                              minHeight: { xs: 36, sm: 32 },
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
                              minWidth: { xs: 36, sm: 32 },
                              minHeight: { xs: 36, sm: 32 },
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
                              minWidth: { xs: 36, sm: 32 },
                              minHeight: { xs: 36, sm: 32 },
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
        <Dialog 
          open={showDialog} 
          onClose={() => setShowDialog(false)} 
          fullWidth 
          maxWidth="md"
          fullScreen={{ xs: true, sm: false }}
          sx={{
            '& .MuiDialog-paper': {
              m: { xs: 0, sm: 2 },
              maxHeight: { xs: '100%', sm: 'calc(100% - 64px)' }
            }
          }}
        >
          <DialogTitle sx={{ 
            bgcolor: 'primary.50', 
            color: 'primary.main',
            fontWeight: 600,
            borderBottom: '1px solid',
            borderColor: 'divider',
            fontSize: { xs: '1.125rem', sm: '1.25rem' },
            p: { xs: 2, sm: 3 }
          }}>
            {editingSop ? 'Edit SOP' : 'Create New SOP'}
          </DialogTitle>
          <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {/* Basic Information Section */}
              <Box>
                <Typography variant="h6" gutterBottom sx={{ 
                  color: 'text.primary', 
                  mb: 2,
                  fontSize: { xs: '1rem', sm: '1.25rem' }
                }}>
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
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: { xs: '1rem', sm: '1rem' }
                      }
                    }}
                  />
                  <TextField 
                    label="Description" 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    fullWidth 
                    multiline
                    rows={{ xs: 4, sm: 3 }}
                    placeholder="Provide a detailed description of this SOP's purpose and scope"
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: { xs: '1rem', sm: '1rem' }
                      }
                    }}
                  />
                  <TextField 
                    label="Documentation URL" 
                    value={url} 
                    onChange={e => setUrl(e.target.value)} 
                    fullWidth 
                    placeholder="https://example.com/sop-document"
                    helperText="Optional: Link to external SOP documentation"
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: { xs: '1rem', sm: '1rem' }
                      },
                      '& .MuiFormHelperText-root': {
                        fontSize: { xs: '0.75rem', sm: '0.75rem' }
                      }
                    }}
                  />
                </Stack>
              </Box>

              <Divider />

              {/* Tasks Section */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="h6" sx={{ 
                    color: 'text.primary',
                    fontSize: { xs: '1rem', sm: '1.25rem' }
                  }}>
                    Task Checklist
                  </Typography>
                  <Button 
                    variant="outlined" 
                    startIcon={<AddIcon />}
                    onClick={addTodo}
                    size="small"
                    sx={{ minHeight: { xs: 40, sm: 32 } }}
                  >
                    Add Task
                  </Button>
                </Box>
                
                {todos.length === 0 ? (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: { xs: 3, sm: 4 }, 
                    px: 2,
                    bgcolor: 'grey.50', 
                    borderRadius: 1,
                    border: '2px dashed',
                    borderColor: 'grey.300'
                  }}>
                    <Typography color="text.secondary" variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                      No tasks added yet. Click "Add Task" to create your first task.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={1}>
                    {todos.map((todo, idx) => (
                      <Card key={todo.id} variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flexDirection: { xs: 'column', sm: 'row' } }}>
                            <Typography variant="body2" sx={{ 
                              minWidth: { xs: 'auto', sm: 60 }, 
                              color: 'text.secondary',
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              alignSelf: { xs: 'flex-start', sm: 'center' }
                            }}>
                              Task {idx + 1}
                            </Typography>
                            <TextField 
                              value={todo.text} 
                              onChange={e => updateTodo(idx, e.target.value)} 
                              size="small" 
                              sx={{ 
                                flex: 1,
                                width: { xs: '100%', sm: 'auto' },
                                '& .MuiInputBase-input': {
                                  fontSize: { xs: '1rem', sm: '0.875rem' }
                                }
                              }}
                              placeholder="Enter task description"
                            />
                            <Tooltip title="Remove Task">
                              <IconButton 
                                color="error" 
                                onClick={() => removeTodo(idx)}
                                size="small"
                                sx={{ 
                                  minWidth: { xs: 36, sm: 32 },
                                  minHeight: { xs: 36, sm: 32 },
                                  alignSelf: { xs: 'flex-end', sm: 'center' }
                                }}
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
          <DialogActions sx={{ 
            p: { xs: 2, sm: 3 }, 
            bgcolor: 'grey.50', 
            borderTop: '1px solid', 
            borderColor: 'divider',
            gap: 1,
            flexDirection: { xs: 'column-reverse', sm: 'row' }
          }}>
            <Button 
              onClick={() => setShowDialog(false)} 
              variant="outlined"
              fullWidth={{ xs: true, sm: false }}
              sx={{ minHeight: { xs: 44, sm: 36 } }}
            >
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleSaveSop} 
              disabled={!title.trim() || saving}
              startIcon={saving ? <CircularProgress size={16} /> : null}
              fullWidth={{ xs: true, sm: false }}
              sx={{ minHeight: { xs: 44, sm: 36 } }}
            >
              {saving ? 'Saving...' : (editingSop ? 'Update SOP' : 'Create SOP')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog 
          open={Boolean(deleteTarget)} 
          onClose={() => setDeleteTarget(null)} 
          maxWidth="sm" 
          fullWidth
          sx={{
            '& .MuiDialog-paper': {
              m: { xs: 2, sm: 2 }
            }
          }}
        >
          <DialogTitle sx={{ 
            color: 'error.main',
            fontWeight: 600,
            borderBottom: '1px solid',
            borderColor: 'divider',
            fontSize: { xs: '1.125rem', sm: '1.25rem' },
            p: { xs: 2, sm: 3 }
          }}>
            Delete SOP
          </DialogTitle>
          <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <DeleteIcon color="error" sx={{ mt: 0.5, fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
              <Box>
                <Typography variant="body1" gutterBottom sx={{ fontSize: { xs: '0.9375rem', sm: '1rem' } }}>
                  Are you sure you want to delete "<strong>{deleteTarget?.title}</strong>"?
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}>
                  This action cannot be undone. All tasks and associated data will be permanently removed.
                </Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ 
            p: { xs: 2, sm: 3 }, 
            bgcolor: 'grey.50', 
            borderTop: '1px solid', 
            borderColor: 'divider',
            gap: 1,
            flexDirection: { xs: 'column-reverse', sm: 'row' }
          }}>
            <Button 
              onClick={() => setDeleteTarget(null)} 
              disabled={deleting} 
              variant="outlined"
              fullWidth={{ xs: true, sm: false }}
              sx={{ minHeight: { xs: 44, sm: 36 } }}
            >
              Cancel
            </Button>
            <Button 
              color="error" 
              variant="contained" 
              onClick={() => handleDeleteSop(deleteTarget.id)} 
              disabled={deleting}
              startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
              fullWidth={{ xs: true, sm: false }}
              sx={{ minHeight: { xs: 44, sm: 36 } }}
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
