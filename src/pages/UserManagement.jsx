import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Select, MenuItem, FormControl, InputLabel, Switch, TextField, CircularProgress, Box, Chip, OutlinedInput } from '@mui/material';
import { db } from '../firebase/config';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const ROLES = ['Evaluator', 'Admin', 'Quality', 'Management'];

const UserManagement = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [centers, setCenters] = useState([]);

  // Only admin/quality can manage users in production; allow all authenticated in non-production
  const canManage = (import.meta.env.MODE !== 'production') || (currentUser && ['Admin', 'Quality'].includes(currentUser.role));

  useEffect(() => {
    setLoading(true);
    setError('');
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (e) => {
      console.error('Failed to subscribe to users', e);
      setError('Failed to load users');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe to centers for assignment UI
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'centers'), (snap) => {
      setCenters(snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) })));
    }, (e) => console.error('Failed to load centers', e));
    return () => unsub();
  }, []);

  const centerOptions = useMemo(() => centers.map(c => ({ value: c.id || c.name, label: c.name || c.id })), [centers]);

  const filteredSortedUsers = useMemo(() => {
    const term = (q || '').toLowerCase();
    // Filter and deduplicate users by email
    const seenEmails = new Set();
    const arr = users.filter(u => {
      const n = (u.name || u.displayName || '').toLowerCase();
      const e = (u.email || '').toLowerCase();
      if (seenEmails.has(e)) return false;
      seenEmails.add(e);
      return !term || n.includes(term) || e.includes(term);
    });
    return arr.sort((a, b) => {
      const an = (a.name || a.displayName || a.email || '').toLowerCase();
      const bn = (b.name || b.displayName || b.email || '').toLowerCase();
      return an.localeCompare(bn);
    });
  }, [users, q]);

  const handleRoleChange = async (userId, newRole) => {
  await updateDoc(doc(db, 'users', userId), { role: newRole });
  };

  const handleActiveChange = async (userId, isActive) => {
  await updateDoc(doc(db, 'users', userId), { isActive });
  };

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 4, mt: 6 }}>
        <Typography variant="h4" gutterBottom>User Management</Typography>
        <Typography variant="body1" paragraph>
          Admins and Quality team can assign roles, activate/deactivate users, and manage center assignments.
        </Typography>
        <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
          <TextField size="small" label="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: 320 }} />
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography>Loading users...</Typography>
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>Centers</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
        {filteredSortedUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell>{user.name || user.displayName || user.email || '-'}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <FormControl size="small">
                        <InputLabel>Role</InputLabel>
                        <Select
                          value={ROLES.includes(user.role) ? user.role : ''}
                          label="Role"
                          onChange={e => handleRoleChange(user.id, e.target.value)}
                        >
                          {ROLES.map(role => (
                            <MenuItem key={role} value={role}>{role}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (ROLES.includes(user.role) ? user.role : '-')}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <Switch
                        checked={!!user.isActive}
                        onChange={e => handleActiveChange(user.id, e.target.checked)}
                        color="primary"
                      />
                    ) : (!!user.isActive ? 'Active' : 'Inactive')}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel>Centers</InputLabel>
                        <Select
                          multiple
                          value={Array.isArray(user.assignedCenters) ? user.assignedCenters : []}
                          onChange={async (e) => {
                            const newVal = e.target.value;
                            await updateDoc(doc(db, 'users', user.id), { assignedCenters: newVal });
                          }}
                          input={<OutlinedInput label="Centers" />}
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selected.length > 0
                                ? selected.map((val) => (
                                    <Chip key={val} label={(centerOptions.find(c => c.value === val)?.label || val)} size="small" />
                                  ))
                                : <Chip label="-" size="small" />}
                            </Box>
                          )}
                        >
                          {centerOptions.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (Array.isArray(user.assignedCenters) && user.assignedCenters.length > 0
                          ? user.assignedCenters.map(val => (centerOptions.find(c => c.value === val)?.label || val)).join(', ')
                          : '-')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Container>
  );
};

export default UserManagement;
