import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Chip,
  Stack,
  InputAdornment,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useMediaQuery,
  Card,
  CardContent,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import HistoryIcon from '@mui/icons-material/History';
import FilterListIcon from '@mui/icons-material/FilterList';
import EventForm from '../components/EventForm';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { exportEventsToPDF } from '../utils/pdfExport';
import logo from '../assets/logo.png';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { sendNotification } from '../utils/auditNotify';
import { useAuth } from '../context/AuthContext';

const Calendar = () => {
  // State for editing todos inline
  const [editingTodos, setEditingTodos] = useState({}); // { [eventId]: todos }
  const [todosChanged, setTodosChanged] = useState({}); // { [eventId]: boolean }
  const [expandedTodos, setExpandedTodos] = useState({}); // control collapsed/expanded task lists per event

  // Save updated todos for an event
  const handleSaveTodos = async (eventId) => {
    const todos = editingTodos[eventId];
    if (!todos) return;
    try {
      // Status logic: only update status when user saves
      const allCompleted = todos.length > 0 && todos.every(td => td.completed);
      const someCompleted = todos.length > 0 && todos.some(td => td.completed);
      let status = 'pending';
      if (allCompleted) {
        status = 'completed';
      } else if (someCompleted) {
        status = 'in_progress';
      }
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, { todos, status });
      setEvents(prev => prev.map(ev => (ev.id === eventId ? { ...ev, todos, status } : ev)));
      setTodosChanged(prev => ({ ...prev, [eventId]: false }));
      // Always log audit when todos are saved
      // Fetch latest event data after update to ensure audit log is correct
      const eventSnap = await getDocs(query(collection(db, 'events'), where('__name__', '==', eventId)));
      const eventObj = eventSnap.docs.length > 0 ? eventSnap.docs[0].data() : {};

    } catch (err) {
      alert('Error saving tasks. Please try again.');
      console.error(err);
    }
  };

  // Handle checkbox toggle for a todo
  const handleToggleTodo = (eventId, todoId) => {
    setEditingTodos(prev => {
      const currentTodos = prev[eventId] || events.find(ev => ev.id === eventId)?.todos || [];
      const updatedTodos = currentTodos.map(td => td.id === todoId ? { ...td, completed: !td.completed } : td);
      return { ...prev, [eventId]: updatedTodos };
    });
    setTodosChanged(prev => ({ ...prev, [eventId]: true }));
  };
  const toggleExpandTodos = (eventId) => {
    setExpandedTodos(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };
  const { currentUser } = useAuth();
  // Role helpers
  const normalizedRole = useMemo(() => (currentUser?.role ? String(currentUser.role).trim().toLowerCase() : ''), [currentUser]);
  const isEvaluator = useMemo(() => normalizedRole === 'evaluator', [normalizedRole]);
  const isAdminOrQuality = useMemo(() => (normalizedRole === 'admin' || normalizedRole === 'quality'), [normalizedRole]);

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [users, setUsers] = useState([]);
  const [sops, setSops] = useState([]);

  // Filters/search
  const [filterCenter, setFilterCenter] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterOwnerName, setFilterOwnerName] = useState('');
  const [filterSop, setFilterSop] = useState('');

  // Reschedule dialog
  // Filter collapse state
  const [filtersOpen, setFiltersOpen] = useState(false);
  // History toggle state
  const [showHistory, setShowHistory] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleEvent, setRescheduleEvent] = useState(null);
  const [newDateTime, setNewDateTime] = useState('');
  const [rescheduleComment, setRescheduleComment] = useState('');

  // Helpers
  const centerMap = useMemo(
    () => Object.fromEntries(centers.map(c => [c.id || c.name, c.name || c.id])),
    [centers]
  );
  const userMap = useMemo(
    () => Object.fromEntries(users.map(u => [u.id || u.uid, u.name || u.displayName || u.email || ''])),
    [users]
  );
  const mentorMap = useMemo(
    () => Object.fromEntries(mentors.map(m => [m.id, m.name])),
    [mentors]
  );
  // Owner name for search: always displayName/email for users, name for mentors
  const getOwnerName = (ev) => {
    if (ev.ownerType === 'mentor') {
      return mentorMap[ev.ownerId] || '';
    }
    // For user, prefer displayName, fallback to email
    const user = users.find(u => (u.id || u.uid) === ev.ownerId);
    return user?.displayName || user?.email || '';
  };
  const toJSDate = (val) => {
    if (!val) return null;
    if (typeof val?.toDate === 'function') return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  // Export PDF for upcoming week
  // ...existing code...

  // Open reschedule
  const handleOpenReschedule = (event) => {
    setRescheduleEvent(event);
    const d = toJSDate(event.startDateTime);
    if (d) {
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      setNewDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      setNewDateTime('');
    }
    setRescheduleComment('');
    setRescheduleDialogOpen(true);
  };

  // Save reschedule
  const handleReschedule = async () => {
    if (!rescheduleEvent) return;
    try {
      const eventRef = doc(db, 'events', rescheduleEvent.id);
      const updatedComments = [
        ...(rescheduleEvent.comments || []),
        {
          userId: currentUser.uid,
          userName: currentUser.displayName,
          comment: rescheduleComment,
          createdAt: new Date(),
          oldDateTime: rescheduleEvent.startDateTime,
          newDateTime,
        },
      ];
      await updateDoc(eventRef, {
        startDateTime: newDateTime,
        comments: updatedComments,
        lastModifiedBy: { userId: currentUser.uid, userName: currentUser.displayName },
        notificationSent: false,
        lastNotificationAt: new Date(),
      });
      setEvents(prev => prev.map(ev => (ev.id === rescheduleEvent.id ? { ...ev, startDateTime: newDateTime, comments: updatedComments } : ev)));
      await sendNotification({
        userId: rescheduleEvent.ownerId,
        type: 'event_reschedule',
        message: `Event/task '${rescheduleEvent.title}' has been rescheduled.`,
        eventId: rescheduleEvent.id,
      });

    } catch (err) {
      alert('Error rescheduling event/task. Please try again.');
      console.error(err);
    }
    setRescheduleDialogOpen(false);
    setRescheduleEvent(null);
    setNewDateTime('');
    setRescheduleComment('');
  };

  // Load data and auto-complete events
  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Events
        const eventsRef = collection(db, 'events');
        let q;
        if (import.meta.env.MODE !== 'production') {
          q = query(eventsRef);
        } else if (currentUser.email === 'mr.prerak.arya@gmail.com') {
          q = query(eventsRef);
        } else {
          q = query(eventsRef, where('ownerId', '==', currentUser.uid));
        }
        const eventsSnapshot = await getDocs(q);
        let eventsData = eventsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Auto-mark events as completed if all todos are done and not already completed
        const toComplete = eventsData.filter(ev =>
          ev.status !== 'completed' &&
          Array.isArray(ev.todos) &&
          ev.todos.length > 0 &&
          ev.todos.every(td => td.completed)
        );
        for (const ev of toComplete) {
          try {
            await updateDoc(doc(db, 'events', ev.id), { status: 'completed' });
            ev.status = 'completed';
          } catch (e) {
            // Ignore update errors for now
          }
        }

        // By default, hide completed events/tasks
        if (!showHistory) {
          eventsData = eventsData.filter(ev => ev.status !== 'completed');
        }
        setEvents(eventsData);

        // Centers, users, mentors, sops
        const [centersSnapshot, usersSnapshot, mentorsSnapshot, sopsSnapshot] = await Promise.all([
          getDocs(collection(db, 'centers')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'mentors')),
          getDocs(collection(db, 'sops')),
        ]);
        setCenters(centersSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setUsers(usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setMentors(mentorsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setSops(sopsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // Only reload events when showHistory changes
  }, [currentUser, showHistory]);

  // Save (create/update)
  const handleSaveEvent = async (eventData) => {
    if (eventData.status === 'completed' && eventData.todos && eventData.todos.some(td => !td.completed)) {
      alert('All to-do items must be completed before marking this event/task as completed.');
      return;
    }
    try {
      if (editingEvent) {
        const eventRef = doc(db, 'events', editingEvent.id);
        // Get previous event data for audit comparison
        const prevEventSnap = await getDocs(query(collection(db, 'events'), where('__name__', '==', editingEvent.id)));
        const prevEventData = prevEventSnap.docs.length > 0 ? prevEventSnap.docs[0].data() : {};
        await updateDoc(eventRef, eventData);
        setEvents(prev => prev.map(ev => (ev.id === editingEvent.id ? { ...editingEvent, ...eventData } : ev)));
        await sendNotification({
          userId: editingEvent.ownerId,
          type: 'event_update',
          message: `Event/task '${eventData.title}' has been updated.`,
          eventId: editingEvent.id,
        });
        // Compute changed fields for audit
        const changedFields = {};
        Object.keys(eventData).forEach(key => {
          if (JSON.stringify(prevEventData[key]) !== JSON.stringify(eventData[key])) {
            changedFields[key] = { before: prevEventData[key], after: eventData[key] };
          }
        });

      } else {
        const docRef = await addDoc(collection(db, 'events'), {
          ...eventData,
          lastModifiedBy: { userId: currentUser.uid, userName: currentUser.displayName },
          createdBy: { userId: currentUser.uid, userName: currentUser.displayName },
        });
        setEvents(prev => [...prev, { ...eventData, id: docRef.id }]);
        await sendNotification({
          userId: eventData.ownerId || currentUser.uid,
          type: 'event_create',
          message: `Event/task '${eventData.title}' has been created.`,
          eventId: docRef.id,
        });

      }
    } catch (err) {
      alert('Error saving event/task. Please try again.');
      console.error(err);
    }
    setShowForm(false);
    setEditingEvent(null);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await deleteDoc(doc(db, 'events', eventId));
      setEvents(prev => prev.filter(ev => ev.id !== eventId));
      await sendNotification({
        userId: currentUser.uid,
        type: 'event_delete',
        message: `Event/task has been deleted.`,
        eventId,
      });

    } catch (err) {
      alert('Error deleting event/task. Please try again.');
      console.error(err);
    }
  };

  // Status options for dropdown
  const statusOptions = useMemo(() => {
    return ['pending', 'in_progress'];
  }, []);

  // Filtered and grouped
  const filteredEvents = useMemo(() => {
    let filtered = events
          .filter(ev =>
            (!filterCenter || (ev.centers || []).some(c => (c === filterCenter))) &&
            (!filterStatus || ev.status === filterStatus) &&
            (!filterDateFrom || (ev.startDateTime && toJSDate(ev.startDateTime) && toJSDate(ev.startDateTime) >= new Date(filterDateFrom))) &&
            (!filterDateTo || (ev.startDateTime && toJSDate(ev.startDateTime) && toJSDate(ev.startDateTime) <= new Date(filterDateTo))) &&
            (!searchText || (ev.title || '').toLowerCase().includes(searchText.toLowerCase()) || (ev.description || '').toLowerCase().includes(searchText.toLowerCase())) &&
            (!filterOwnerName || getOwnerName(ev).toLowerCase().includes(filterOwnerName.toLowerCase()))
          );
        // If showing history, only show completed events/tasks
        if (showHistory) {
          filtered = filtered.filter(ev => ev.status === 'completed');
        } else {
          filtered = filtered.filter(ev => ev.status !== 'completed');
        }
        filtered = filtered.sort((a, b) => {
          const da = toJSDate(a.startDateTime)?.getTime() || 0;
          const db = toJSDate(b.startDateTime)?.getTime() || 0;
          return da - db;
        });
        return filtered.slice(0, 10);
  }, [events, filterCenter, filterStatus, filterDateFrom, filterDateTo, searchText, filterOwnerName, showHistory]);

  const groupedByDate = useMemo(() => {
    const groups = {};
    filteredEvents.forEach(ev => {
      const d = toJSDate(ev.startDateTime);
      const key = d ? d.toLocaleDateString() : 'No Date';
      groups[key] = groups[key] || [];
      groups[key].push(ev);
    });
    return groups;
  }, [filteredEvents]);

  const getCenterNames = (centerIds) => {
    if (!Array.isArray(centerIds)) return [];
    return centerIds.map(id => centerMap[id] || id);
  };

  return (
    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ mb: 3, background: 'linear-gradient(180deg, rgba(221,238,221,0.7), rgba(221,238,221,0.25))', p: 2, borderRadius: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
           
              <IconButton onClick={() => setFiltersOpen(v => !v)} color="primary">
              <FilterListIcon />
            </IconButton>
            <Button variant="contained" color="primary" onClick={() => setShowForm(true)}>
              Create New Event/Task
            </Button>
            <IconButton
              color={showHistory ? 'primary' : 'default'}
              onClick={() => setShowHistory(v => !v)}
              sx={{ ml: 1, border: showHistory ? '2px solid' : undefined, borderColor: showHistory ? 'primary.main' : undefined, bgcolor: showHistory ? 'background.paper' : undefined }}
            >
              <HistoryIcon />
            </IconButton>
          </Stack>
        </Box>

        {/* Create/Edit dialog */}
        <Dialog open={showForm} onClose={() => { setShowForm(false); setEditingEvent(null); }} fullWidth maxWidth="md">
          <DialogTitle>{editingEvent ? 'Edit Event/Task' : 'Create Event/Task'}</DialogTitle>
          <DialogContent dividers>
            <EventForm
              onSave={handleSaveEvent}
              eventData={editingEvent || {}}
              centers={centers}
              mentors={mentors}
              users={users}
              sops={sops}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setShowForm(false); setEditingEvent(null); }}>Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* Collapsible Filters - only shown when filtersOpen is true, triggered by icon in header controls */}
        {filtersOpen && (
          <Box sx={{ mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="filter-center-label">Center</InputLabel>
                  <Select
                    labelId="filter-center-label"
                    label="Center"
                    value={filterCenter}
                    onChange={e => setFilterCenter(e.target.value)}
                  >
                    <MenuItem value=""><em>All Centers</em></MenuItem>
                    {centers.map(c => (
                      <MenuItem key={c.id || c.name} value={c.id || c.name}>{c.name || c.id}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="filter-status-label">Status</InputLabel>
                  <Select
                    labelId="filter-status-label"
                    label="Status"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                  >
                    <MenuItem value=""><em>All Statuses</em></MenuItem>
                    {statusOptions.map(s => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Date From"
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  size="small"
                  sx={{ minWidth: 150 }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Date To"
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  size="small"
                  sx={{ minWidth: 150 }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Search title/description"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  size="small"
                  sx={{ minWidth: 240 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton>
                          <SearchIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Search owner name"
                  value={filterOwnerName}
                  onChange={e => setFilterOwnerName(e.target.value)}
                  size="small"
                  sx={{ minWidth: 200 }}
                />
              </Box>
            </Stack>
          </Box>
        )}

        {/* Responsive: Table for desktop, Cards for mobile */}
        {(() => {
          const theme = useTheme();
          const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
          if (loading) {
            return <Typography>Loading events/tasks...</Typography>;
          }
          if (filteredEvents.length === 0) {
            return <Typography>No events/tasks found.</Typography>;
          }
          if (!isMobile) {
            // Desktop Table view
            return (
              <TableContainer component={Paper} elevation={0} sx={{ boxShadow: 'none', background: 'transparent' }}>
                <Table sx={{ minWidth: 700 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date & Time</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Owner</TableCell>
                      {/* Description column removed from page view */}
                      <TableCell>Centers</TableCell>
                      <TableCell>Tasks</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredEvents.map(event => {
                      const d = toJSDate(event.startDateTime);
                      const ownerName = getOwnerName(event);
                      return (
                        <TableRow key={event.id}>
                            <TableCell>
                              <Stack direction="column" spacing={0.5}>
                                <Chip label={d ? d.toLocaleDateString() : 'No Date'} color="primary" variant="outlined" sx={{ fontWeight: 500 }} />
                                <Typography variant="body2" color="text.secondary">{d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</Typography>
                              </Stack>
                            </TableCell>
                          <TableCell>
                            <Chip label={event.status || 'pending'} size="small" color={event.status === 'completed' ? 'success' : event.status === 'cancelled' ? 'error' : 'warning'} />
                          </TableCell>
                          <TableCell>{event.title}</TableCell>
                          <TableCell>{ownerName}</TableCell>
                          {/* Description cell removed from page view */}
                          <TableCell>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                              {(event.centers || []).map(center => (
                                <Chip key={center} label={centerMap[center] || center} size="small" />
                              ))}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ maxWidth: 420 }}>
                              <Stack direction="column" spacing={0.5} sx={{ p: 0.5 }}>
                                {(editingTodos[event.id] || event.todos || []).map(todo => (
                                  <Box key={todo.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <input
                                      type="checkbox"
                                      checked={!!todo.completed}
                                      onChange={() => handleToggleTodo(event.id, todo.id)}
                                      style={{ accentColor: todo.completed ? '#388e3c' : undefined }}
                                    />
                                    <Typography variant="body2" sx={{ textDecoration: todo.completed ? 'line-through' : 'none', ml: 0.5, wordBreak: 'break-word' }}>{todo.text}</Typography>
                                  </Box>
                                ))}
                              </Stack>

                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                {todosChanged[event.id] && (
                                  <IconButton size="small" color="success" onClick={() => handleSaveTodos(event.id)} title="Save tasks">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#388e3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  </IconButton>
                                )}
                              </Stack>

                              {isAdminOrQuality && event.comments && event.comments.length > 0 && (
                                <Box sx={{ mt: 1 }}>
                                  <Typography variant="subtitle2">Reschedule Comments</Typography>
                                  <List dense>
                                    {event.comments.map((cmt, idx) => {
                                      const formatDate = (dt) => {
                                        if (!dt) return '';
                                        if (typeof dt?.toDate === 'function') return dt.toDate().toLocaleString();
                                        if (typeof dt === 'object' && dt.seconds) return new Date(dt.seconds * 1000).toLocaleString();
                                        const d = new Date(dt);
                                        return isNaN(d.getTime()) ? String(dt) : d.toLocaleString();
                                      };
                                      return (
                                        <ListItem key={idx} sx={{ py: 0 }}>
                                          <ListItemText
                                            primary={`On ${formatDate(cmt.oldDateTime)} → ${formatDate(cmt.newDateTime)}: ${cmt.comment}`}
                                            secondary={`By ${cmt.userName} at ${formatDate(cmt.createdAt)}`}
                                          />
                                        </ListItem>
                                      );
                                    })}
                                  </List>
                                </Box>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              {!isEvaluator && (
                                <IconButton size="large" color="primary" onClick={() => handleEditEvent(event)} sx={{ p: 1.2, border: '2px solid', borderColor: 'primary.main', bgcolor: 'background.paper' }}>
                                  <EditIcon fontSize="medium" />
                                </IconButton>
                              )}
                              <IconButton size="small" color="secondary" onClick={() => handleOpenReschedule(event)} sx={{ p: 1 }}>
                                <AutorenewIcon />
                              </IconButton>
                              {!isEvaluator && (
                                <IconButton size="small" color="error" onClick={() => handleDeleteEvent(event.id)}>
                                  <DeleteIcon />
                                </IconButton>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            );
          } else {
            // Mobile Card view
            return (
              <List sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, p: 0 }}>
                {filteredEvents.map(event => {
                  const d = toJSDate(event.startDateTime);
                  const ownerName = getOwnerName(event);
                  return (
                    <Card key={event.id} sx={{ mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(41,45,52,0.04)', background: 'white' }}>
                      <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                          <Chip label={d ? d.toLocaleDateString() : 'No Date'} color="primary" variant="outlined" sx={{ fontWeight: 500 }} />
                          <Divider sx={{ flex: 1 }} />
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ minWidth: 80 }}>{d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</Typography>
                          <Chip label={event.status || 'pending'} size="small" color={event.status === 'completed' ? 'success' : event.status === 'cancelled' ? 'error' : 'warning'} />
                        </Stack>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{event.title}</Typography>
                        {ownerName && (
                          <Typography variant="caption" color="text.secondary">Owner: {ownerName}</Typography>
                        )}
                        {/* Description removed from card view; view/edit it in the Edit dialog */}
                        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                          {(event.centers || []).map(center => (
                            <Chip key={center} label={centerMap[center] || center} size="small" />
                          ))}
                          {(editingTodos[event.id] || event.todos || []).slice(0, 4).map(todo => (
                            <Box key={todo.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <input
                                type="checkbox"
                                checked={!!todo.completed}
                                onChange={() => handleToggleTodo(event.id, todo.id)}
                                style={{ accentColor: todo.completed ? '#388e3c' : undefined }}
                              />
                              <Typography variant="body2" sx={{ textDecoration: todo.completed ? 'line-through' : 'none', ml: 0.5 }}>{todo.text}</Typography>
                            </Box>
                          ))}
                          {todosChanged[event.id] && (
                            <IconButton size="small" color="success" onClick={() => handleSaveTodos(event.id)} title="Save tasks">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#388e3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </IconButton>
                          )}
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                          {!isEvaluator && (
                            <IconButton size="large" color="primary" onClick={() => handleEditEvent(event)} sx={{ p: 1.2, border: '2px solid', borderColor: 'primary.main', bgcolor: 'background.paper' }}>
                              <EditIcon fontSize="medium" />
                            </IconButton>
                          )}
                          <IconButton size="small" color="secondary" onClick={() => handleOpenReschedule(event)} sx={{ p: 1 }}>
                            <AutorenewIcon />
                          </IconButton>
                          {!isEvaluator && (
                            <IconButton size="small" color="error" onClick={() => handleDeleteEvent(event.id)}>
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </Stack>
                        {isAdminOrQuality && event.comments && event.comments.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="subtitle2">Reschedule Comments</Typography>
                            <List dense>
                              {event.comments.map((cmt, idx) => {
                                // Format old/new date
                                const formatDate = (dt) => {
                                  if (!dt) return '';
                                  if (typeof dt?.toDate === 'function') return dt.toDate().toLocaleString();
                                  if (typeof dt === 'object' && dt.seconds) return new Date(dt.seconds * 1000).toLocaleString();
                                  const d = new Date(dt);
                                  return isNaN(d.getTime()) ? String(dt) : d.toLocaleString();
                                };
                                return (
                                  <ListItem key={idx} sx={{ py: 0 }}>
                                    <ListItemText
                                      primary={`On ${formatDate(cmt.oldDateTime)} → ${formatDate(cmt.newDateTime)}: ${cmt.comment}`}
                                      secondary={`By ${cmt.userName} at ${formatDate(cmt.createdAt)}`}
                                    />
                                  </ListItem>
                                );
                              })}
                            </List>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </List>
            );
          }
        })()}
      </Paper>

      {/* Reschedule dialog at root */}
      <Dialog open={rescheduleDialogOpen} onClose={() => setRescheduleDialogOpen(false)}>
        <DialogTitle>Reschedule Event/Task</DialogTitle>
        <DialogContent>
          <TextField
            type="datetime-local"
            label="New Date/Time"
            value={newDateTime}
            onChange={e => setNewDateTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Comment (reason for rescheduling)"
            value={rescheduleComment}
            onChange={e => setRescheduleComment(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRescheduleDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleReschedule} disabled={!newDateTime || !rescheduleComment}>Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Calendar;
