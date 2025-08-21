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
  const [editCenters, setEditCenters] = useState('');
  const [centers, setCenters] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchUser = async () => {
      setLoading(true);
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      setUserData(userSnap.exists() ? userSnap.data() : null);
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
  setEditCenters(userData?.assignedCenters || []);
    setEditDialogOpen(true);
  };

  // Save profile edits
  const handleSaveEdit = async () => {
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, { name: editName, assignedCenters: editCenters });
    setUserData({ ...userData, name: editName, assignedCenters: editCenters });
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
                <ListItemText primary="Assigned Centers" secondary={(userData.assignedCenters || []).join(', ')} />
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
                  <InputLabel>Assigned Centers</InputLabel>
                  <Select
                    multiple
                    value={editCenters}
                    onChange={(e) => setEditCenters(e.target.value)}
                    input={<OutlinedInput label="Assigned Centers" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((val) => (
                          <Chip key={val} label={(centers.find(c => (c.id || c.name) === val)?.name) || val} size="small" />
                        ))}
                      </Box>
                    )}
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
