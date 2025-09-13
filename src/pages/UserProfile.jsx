import React, { useEffect, useState } from 'react';
import { Container, Typography, Paper, Box, Button, List, ListItem, ListItemText, TextField, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore';

const UserProfile = () => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCenter, setEditCenter] = useState('');
  const [centers, setCenters] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchUser = async () => {
      setLoading(true);
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      let data = userSnap.exists() ? userSnap.data() : null;
      // Always keep only the first center
      if (data && Array.isArray(data.assignedCenters)) {
        data = { ...data, assignedCenters: data.assignedCenters.length > 0 ? [data.assignedCenters[0]] : [] };
      }
      setUserData(data);
      setLoading(false);
    };
    fetchUser();
  // notifications removed
  }, [currentUser]);

  // Centers subscription for selection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'centers'), (snap) => {
      setCenters(snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) })));
    });
    return () => unsub();
  }, []);

  // Open edit dialog
  const handleOpenEdit = () => {
    setEditName(userData?.name || '');
    // Always use only the first center for editing
    let center = '';
    if (Array.isArray(userData?.assignedCenters)) {
      center = userData.assignedCenters[0] || '';
    } else if (userData?.assignedCenters) {
      center = userData.assignedCenters;
    }
    setEditCenter(center);
    setEditDialogOpen(true);
  };

  // Save profile edits
  const handleSaveEdit = async () => {
    const userRef = doc(db, 'users', currentUser.uid);
    // Only save one center
    await updateDoc(userRef, { name: editName, assignedCenters: editCenter ? [editCenter] : [] });
    setUserData({ ...userData, name: editName, assignedCenters: editCenter ? [editCenter] : [] });
    setEditDialogOpen(false);
  };

  return (
    <Container maxWidth="sm">
      <Paper sx={{ p: 4, mt: 6 }}>
        <Typography variant="h4" gutterBottom>User Profile</Typography>
        {loading ? (
          <Typography>Loading profile...</Typography>
        ) : userData ? (
          <>
            <List>
              <ListItem>
                <ListItemText primary="Name" secondary={userData.name} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Email" secondary={userData.email} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Role" secondary={userData.role} />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Assigned Center"
                  secondary={
                    Array.isArray(userData.assignedCenters) && userData.assignedCenters.length > 0
                      ? (centers.find(c => (c.id || c.name) === userData.assignedCenters[0])?.name || userData.assignedCenters[0])
                      : '-'
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemText primary="Account Status" secondary={userData.isActive ? 'Active' : 'Inactive'} />
              </ListItem>
            </List>
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button variant="outlined" onClick={handleOpenEdit}>Edit Profile</Button>
            </Box>
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogContent>
                <TextField label="Name" value={editName} onChange={e => setEditName(e.target.value)} fullWidth sx={{ mb: 2 }} />
                <FormControl fullWidth size="small">
                  <InputLabel id="center-select-label">Assigned Center</InputLabel>
                  <Select
                    labelId="center-select-label"
                    value={editCenter}
                    onChange={e => setEditCenter(e.target.value)}
                    input={<OutlinedInput label="Assigned Center" />}
                  >
                    {centers.map(c => (
                      <MenuItem key={c.id || c.name} value={c.id || c.name}>{c.name || c.id}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={handleSaveEdit} disabled={!editName}>Save</Button>
              </DialogActions>
            </Dialog>
          </>
        ) : (
          <Typography>No profile data found.</Typography>
        )}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button href="/privacy-policy" target="_blank" sx={{ mr: 2 }}>Privacy Policy</Button>
          <Button href="/terms-of-use" target="_blank">Terms of Use</Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default UserProfile;
