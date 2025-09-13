import React, { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  CircularProgress,
  Box,
  Chip,
  OutlinedInput,
  useTheme,
  useMediaQuery,
  Card,
  CardContent,
  CardActions,
  Stack,
  Grid,
} from '@mui/material';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
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
  const [activeLoading, setActiveLoading] = useState({}); // Track loading per user
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  // Only admin/quality can manage users in production; allow all authenticated in non-production
  const canManage = (import.meta.env.MODE !== 'production') || (currentUser && ['Admin', 'Quality'].includes(currentUser.role));

  useEffect(() => {
    setLoading(true);
    setError('');
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      // Ensure isActive is false for new users if not set
      setUsers(snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          isActive: typeof data.isActive === 'boolean' ? data.isActive : false
        };
      }));
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

  const handleActiveChange = (userId, isActive) => {
    setActiveLoading(prev => ({ ...prev, [userId]: true }));
    updateDoc(doc(db, 'users', userId), { isActive })
      .catch(() => {})
      .finally(() => {
        setActiveLoading(prev => ({ ...prev, [userId]: false }));
      });
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
        ) : isSmall ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filteredSortedUsers.map(user => (
              <Card key={user.id} variant="outlined" sx={{ boxShadow: 3, borderRadius: 3, bgcolor: 'grey.50', p: 2 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>{user.name || user.displayName || user.email || '-'}</Typography>
                    <Typography variant="body2" color="text.secondary">{user.email || '-'}</Typography>

                    <FormControl fullWidth size="medium">
                      <InputLabel>Role</InputLabel>
                      {canManage ? (
                        <Select
                          value={ROLES.includes(user.role) ? user.role : ''}
                          label="Role"
                          onChange={e => handleRoleChange(user.id, e.target.value)}
                        >
                          {ROLES.map(role => (
                            <MenuItem key={role} value={role}>{role}</MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <Box sx={{ py: 1 }}>{ROLES.includes(user.role) ? user.role : '-'}</Box>
                      )}
                    </FormControl>

                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                      <Typography variant="body2">Status:</Typography>
                      {canManage ? (
                        <ToggleButtonGroup
                          value={!!user.isActive ? 'active' : 'inactive'}
                          exclusive
                          onChange={(e, val) => {
                            if (val !== null) handleActiveChange(user.id, val === 'active');
                          }}
                          size="medium"
                          disabled={!!activeLoading[user.id]}
                        >
                          <ToggleButton value="active" color="success" sx={{ px: 3 }}>Active</ToggleButton>
                          <ToggleButton value="inactive" color="error" sx={{ px: 3 }}>Inactive</ToggleButton>
                        </ToggleButtonGroup>
                      ) : (!!user.isActive ? <Chip label="Active" color="success" /> : <Chip label="Inactive" color="error" />)}
                    </Box>

                    <FormControl fullWidth size="medium" sx={{ mt: 1 }}>
                      <InputLabel>Center</InputLabel>
                      {canManage ? (
                        <Select
                          value={Array.isArray(user.assignedCenters) ? user.assignedCenters[0] || '' : (user.assignedCenters || '')}
                          onChange={async (e) => {
                            const newVal = e.target.value;
                            await updateDoc(doc(db, 'users', user.id), { assignedCenters: newVal ? [newVal] : [] });
                          }}
                          input={<OutlinedInput label="Center" />}
                        >
                          {centerOptions.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <Box sx={{ py: 1 }}>{Array.isArray(user.assignedCenters) && user.assignedCenters.length > 0
                          ? (centerOptions.find(c => c.value === user.assignedCenters[0])?.label || user.assignedCenters[0])
                          : '-'}</Box>
                      )}
                    </FormControl>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : (
          <Table size="small" sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Centers</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSortedUsers.map(user => (
                <TableRow key={user.id} hover>
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
                      <ToggleButtonGroup
                        value={!!user.isActive ? 'active' : 'inactive'}
                        exclusive
                        onChange={(e, val) => {
                          if (val !== null) handleActiveChange(user.id, val === 'active');
                        }}
                        size="small"
                        disabled={!!activeLoading[user.id]}
                      >
                        <ToggleButton value="active" color="success" sx={{ px: 2, fontSize: '0.95rem' }}>Active</ToggleButton>
                        <ToggleButton value="inactive" color="error" sx={{ px: 2, fontSize: '0.95rem' }}>Inactive</ToggleButton>
                      </ToggleButtonGroup>
                    ) : (!!user.isActive ? <Chip label="Active" color="success" size="small" /> : <Chip label="Inactive" color="error" size="small" />)}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>Center</InputLabel>
                        <Select
                          value={Array.isArray(user.assignedCenters) ? user.assignedCenters[0] || '' : (user.assignedCenters || '')}
                          onChange={async (e) => {
                            const newVal = e.target.value;
                            await updateDoc(doc(db, 'users', user.id), { assignedCenters: newVal ? [newVal] : [] });
                          }}
                          input={<OutlinedInput label="Center" />}
                        >
                          {centerOptions.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (Array.isArray(user.assignedCenters) && user.assignedCenters.length > 0
                          ? (centerOptions.find(c => c.value === user.assignedCenters[0])?.label || user.assignedCenters[0])
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
