import React, { useEffect, useState } from 'react';
import { Box, Button, TextField, FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore';

const ProfileSettingsDialog = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState(null);
  const [name, setName] = useState('');
  const [assignedCenter, setAssignedCenter] = useState('');
  const [centers, setCenters] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const ref = doc(db, 'users', currentUser.uid);
    getDoc(ref).then(snap => {
      const data = snap.exists() ? snap.data() : null;
      setUserData(data);
      setName(data?.name || data?.displayName || '');
      if (Array.isArray(data?.assignedCenters)) {
        setAssignedCenter(data.assignedCenters[0] || '');
      } else {
        setAssignedCenter(data?.assignedCenters || '');
      }
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
      assignedCenters: assignedCenter ? [assignedCenter] : [],
    });
    onClose?.();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
      <FormControl fullWidth size="small">
        <InputLabel id="center-select-label">Assigned Center</InputLabel>
        <Select
          labelId="center-select-label"
          value={assignedCenter}
          onChange={e => setAssignedCenter(e.target.value)}
          input={<OutlinedInput label="Assigned Center" />}
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
