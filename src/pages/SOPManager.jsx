import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Paper, Box, Button, TextField, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Checkbox, FormControlLabel, Chip } from '@mui/material';
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
    <Container maxWidth="md">
      <Paper sx={{ p: 4, mt: 6 }}>
        <Typography variant="h4" gutterBottom>SOP Management</Typography>
        <Typography variant="body1" paragraph>
          Global Standard Operating Procedures (SOPs) for events/tasks. Only Admin/Quality can create or edit.
        </Typography>
        {canEdit && (
          <Button variant="contained" color="primary" sx={{ mb: 2 }} onClick={() => handleOpenDialog()}>+ Add SOP</Button>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography>Loading SOPs...</Typography>
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <List>
            {sops.map(sop => (
              <ListItem key={sop.id} sx={{ mb: 2 }}>
                <ListItemText
                  primary={sop.title}
                  secondary={Array.isArray(sop.todos) ? sop.todos.map(td => td.text).join(', ') : ''}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {canEdit && (
                    <>
                      <Button variant="outlined" size="small" onClick={() => handleOpenDialog(sop)}>Edit</Button>
                      <Button variant="outlined" size="small" color="error" onClick={() => setDeleteTarget(sop)} disabled={deleting}>Delete</Button>
                    </>
                  )}
                </Box>
              </ListItem>
            ))}
          </List>
        )}
        <Dialog open={showDialog} onClose={() => setShowDialog(false)} fullWidth maxWidth="sm">
          <DialogTitle>{editingSop ? 'Edit SOP' : 'Add SOP'}</DialogTitle>
          <DialogContent>
            <TextField label="Title" value={title} onChange={e => setTitle(e.target.value)} fullWidth sx={{ mb: 2 }} />
            <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} fullWidth sx={{ mb: 2 }} />
            <Typography variant="subtitle1">To-Do List</Typography>
            {todos.map((todo, idx) => (
              <Box key={todo.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TextField value={todo.text} onChange={e => updateTodo(idx, e.target.value)} size="small" sx={{ flex: 1 }} />
                <Button color="error" onClick={() => removeTodo(idx)}>Delete</Button>
              </Box>
            ))}
            <Button variant="outlined" onClick={addTodo}>+ Add To-Do</Button>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveSop} disabled={!title || saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
          <DialogTitle>Delete SOP</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to delete "{deleteTarget?.title}"?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => handleDeleteSop(deleteTarget.id)} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Container>
  );
};

export default SOPManager;
