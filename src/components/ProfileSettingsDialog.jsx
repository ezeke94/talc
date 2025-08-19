import React, { useEffect, useState } from 'react';
import { Box, Button, TextField, FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore';

const ProfileSettingsDialog = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState(null);
  const [name, setName] = useState('');
  const [assignedCenters, setAssignedCenters] = useState([]);
  const [centers, setCenters] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const ref = doc(db, 'users', currentUser.uid);
    getDoc(ref).then(snap => {
      const data = snap.exists() ? snap.data() : null;
      setUserData(data);
      setName(data?.name || data?.displayName || '');
      setAssignedCenters(data?.assignedCenters || []);
    });
    const unsub = onSnapshot(collection(db, 'centers'), (snap) => {
      setCenters(snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) })));
    });
    return () => unsub();
  }, [currentUser]);

  const save = async () => {
    if (!currentUser) return;
    await updateDoc(doc(db, 'users', currentUser.uid), {
      name,
      assignedCenters,
    });
    onClose?.();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
      <FormControl fullWidth size="small">
        <InputLabel>Assigned Centers</InputLabel>
        <Select
          multiple
          value={assignedCenters}
          onChange={(e) => setAssignedCenters(e.target.value)}
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
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!name}>Save</Button>
      </Box>
    </Box>
  );
};

export default ProfileSettingsDialog;
