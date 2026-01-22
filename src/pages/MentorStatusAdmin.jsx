import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableHead, TableRow, Select, MenuItem, Chip, Stack, Alert, TextField } from '@mui/material';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const MentorStatusAdmin = () => {
    const { currentUser } = useAuth();
    const [mentors, setMentors] = useState([]);
    const [search, setSearch] = useState('');
    const [savingId, setSavingId] = useState('');

    const normalizedRole = useMemo(() => (currentUser?.role || '').toString().trim().toLowerCase(), [currentUser]);
    const canManage = ['admin', 'quality', 'management'].includes(normalizedRole);

    useEffect(() => {
        if (!canManage) return undefined;
        const unsub = onSnapshot(collection(db, 'mentors'), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const sorted = data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setMentors(sorted);
        });
        return () => unsub();
    }, [canManage]);

    const updateStatus = async (mentorId, status) => {
        setSavingId(mentorId);
        try {
            await updateDoc(doc(db, 'mentors', mentorId), { status });
        } catch (err) {
            console.error('Failed to update mentor status', err);
        } finally {
            setSavingId('');
        }
    };

    if (!canManage) {
        return (
            <Alert severity="warning" sx={{ mt: 3 }}>
                You do not have access to manage mentor status.
            </Alert>
        );
    }

    const filteredMentors = mentors.filter(m => 
        (m.name || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Box sx={{ maxWidth: 960, mx: 'auto', p: { xs: 2, md: 3 } }}>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                Mentor Status
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Set mentors as active or inactive. Inactive mentors are hidden from all lists across the app.
            </Typography>
            <Box sx={{ mb: 3 }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{
                        '& .MuiOutlineInputBase-root': {
                            borderRadius: 2
                        }
                    }}
                />
            </Box>
            <Card>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    {filteredMentors.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                            {search ? 'No mentors found matching your search' : 'No mentors found'}
                        </Typography>
                    ) : (
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Centers</TableCell>
                                    <TableCell>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredMentors.map((mentor) => {
                                const centerList = Array.isArray(mentor.assignedCenters)
                                    ? mentor.assignedCenters
                                    : (mentor.center ? [mentor.center] : []);
                                const status = mentor.status || 'active';
                                return (
                                    <TableRow key={mentor.id} hover>
                                        <TableCell sx={{ fontWeight: 600 }}>{mentor.name || 'Unnamed Mentor'}</TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                {centerList.length === 0 && <Chip label="Unassigned" size="small" variant="outlined" />}
                                                {centerList.map((c) => (
                                                    <Chip key={c} label={c} size="small" variant="outlined" />
                                                ))}
                                            </Stack>
                                        </TableCell>
                                        <TableCell width={220}>
                                            <Select
                                                fullWidth
                                                size="small"
                                                value={status}
                                                onChange={(e) => updateStatus(mentor.id, e.target.value)}
                                                disabled={savingId === mentor.id}
                                            >
                                                <MenuItem value="active">Active</MenuItem>
                                                <MenuItem value="inactive">Inactive</MenuItem>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default MentorStatusAdmin;
