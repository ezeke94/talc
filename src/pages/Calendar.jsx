import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Tooltip,
  CircularProgress,
  List,
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
  Fab,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import LinkIcon from '@mui/icons-material/Link';
import EventForm from '../components/EventForm';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { exportEventsToPDF } from '../utils/pdfExport';
import logo from '../assets/logo.png';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
// notifications removed
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
  setAllEvents(prev => prev.map(ev => (ev.id === eventId ? { ...ev, todos, status } : ev)));
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
  // Role helpers with fallback to cached profile to avoid flicker when context updates lag
  const normalizedRole = useMemo(() => {
    if (currentUser?.role) return String(currentUser.role).trim().toLowerCase();
    try {
      const cached = JSON.parse(localStorage.getItem('talc_user_profile') || 'null');
      return (cached?.role ? String(cached.role).trim().toLowerCase() : '');
    } catch { return ''; }
  }, [currentUser]);
  const isEvaluator = useMemo(() => normalizedRole === 'evaluator', [normalizedRole]);
  const isCoordinator = useMemo(() => normalizedRole === 'coordinator', [normalizedRole]);
  const isAdminOrQuality = useMemo(() => (normalizedRole === 'admin' || normalizedRole === 'quality'), [normalizedRole]);
  const canEditEvents = useMemo(() => (normalizedRole === 'admin' || normalizedRole === 'quality' || normalizedRole === 'evaluator'), [normalizedRole]);

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [events, setEvents] = useState([]);
  // Master copy of events loaded once from Firestore; 'events' will mirror this
  const [allEvents, setAllEvents] = useState([]);
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
  const [exportingPdf, setExportingPdf] = useState(false);
  // History toggle state
  const [showHistory, setShowHistory] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleEvent, setRescheduleEvent] = useState(null);
  const [newDateTime, setNewDateTime] = useState('');
  const [rescheduleComment, setRescheduleComment] = useState('');
  // Confirmation dialog for delete/duplicate actions
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'delete' | 'duplicate'
  const [confirmEvent, setConfirmEvent] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

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
  
  // Get SOP URL for an event
  const getSopUrl = (ev) => {
    if (!ev.sopId) return null;
    const sop = sops.find(s => s.id === ev.sopId);
    return sop?.url || null;
  };
  
  const toJSDate = (val) => {
    if (!val) return null;
    if (typeof val?.toDate === 'function') return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  // Theme breakpoint helper for responsive UI (used to show FAB on mobile)
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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

  // Centralized data loader so we can call it on page load and when the user clicks Refresh
  // This now only fetches relatively static collections. Events are handled via realtime listener below.
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
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
  }, [currentUser]);

  // Realtime listener for events limited to a date window (now -30 days .. now +15 days)
  useEffect(() => {
    if (!currentUser) return;
    const eventsRef = collection(db, 'events');
    const start = new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + 15);
    end.setHours(23, 59, 59, 999);

    // Use a simple onSnapshot on the whole collection and filter client-side by the date window.
    // This avoids client-side query creation/index issues and ensures events are visible.
    const q = query(eventsRef);

    const unsub = onSnapshot(q, async (snapshot) => {
      try {
        let eventsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filter to our desired date window on the client side; keep undated events
        eventsData = eventsData.filter(ev => {
          if (!ev.startDateTime) return true;
          const d = toJSDate(ev.startDateTime);
          if (!d) return true;
          return d >= start && d <= end;
        });

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
          } catch (err) {
            // ignore
          }
        }

        setAllEvents(eventsData);
        setEvents(eventsData);
      } catch (err) {
        console.error('Error processing events snapshot', err);
      }
    }, (err) => {
      console.error('Events onSnapshot error', err);
    });

    return () => unsub();
  }, [currentUser]);

  // Export next week's events (Monday - Sunday)
  const handleExportNextWeekPdf = async () => {
    try {
      setExportingPdf(true);
      const today = new Date();
      const day = today.getDay(); // 0 (Sun) - 6 (Sat)
      const daysUntilNextMonday = ((8 - day) % 7) || 7;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + daysUntilNextMonday);
      nextMonday.setHours(0, 0, 0, 0);

      const weekStart = new Date(nextMonday);
      const weekEnd = new Date(nextMonday);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const eventsForWeek = events.filter(ev => {
        if (!ev.startDateTime) return false;
        let d = ev.startDateTime;
        if (typeof d?.toDate === 'function') d = d.toDate();
        else d = new Date(d);
        if (isNaN(d.getTime())) return false;
        return d >= weekStart && d <= weekEnd;
      });

      // Build helper maps
      const centerMapForExport = Object.fromEntries(centers.map(c => [c.id || c.name, c.name || c.id]));
      const userMapForExport = Object.fromEntries(users.map(u => [u.id || u.uid, u]));
      const mentorMapForExport = Object.fromEntries(mentors.map(m => [m.id, m]));

      const taskMap = {};
      eventsForWeek.forEach(ev => {
        const list = ev.todos || ev.tasks || [];
        if (Array.isArray(list)) {
          list.forEach(t => {
            if (!t) return;
            if (typeof t === 'object' && t.id && (t.text || t.label)) taskMap[t.id] = t.text || t.label;
          });
        }
      });

      // Format rows into an HTML table and open print preview in a new window
      const mondayStr = weekStart.toLocaleDateString();
      const sundayStr = weekEnd.toLocaleDateString();
      const heading = `TALC Management - Events/Tasks for week ${mondayStr} — ${sundayStr}`;

      const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const formatDateCell = (val) => {
        const d = toJSDate(val);
        if (!d) return '';
        const dayMonth = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const hasTime = !(d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0);
        if (hasTime) {
          const hr = d.getHours();
          const minute = String(d.getMinutes()).padStart(2, '0');
          const ampm = hr >= 12 ? 'PM' : 'AM';
          const hour12 = hr % 12 === 0 ? 12 : hr % 12;
          return `${dayMonth} ${hour12}:${minute}\u00A0${ampm}`;
        }
        return dayMonth;
      };

      const formatTasks = (ev) => {
        const list = ev.todos || ev.tasks || [];
        if (!Array.isArray(list) || list.length === 0) return '';
        return list.map(t => {
          if (!t && t !== 0) return '';
          if (typeof t === 'string') return taskMap[t] || t;
          if (typeof t === 'object') return t.text || t.label || (t.id ? taskMap[t.id] || String(t.id) : '');
          return String(t);
        }).filter(Boolean).join(', ');
      };

      const rowsHtml = eventsForWeek.map(ev => {
        const dateCell = escapeHtml(formatDateCell(ev.startDateTime));
        const status = escapeHtml(ev.status || 'pending');
        const title = escapeHtml(ev.title || '');
        const owner = escapeHtml(getOwnerName(ev) || '');
        const centersCell = escapeHtml((ev.centers || []).map(c => centerMapForExport[c] || c).join(', '));
        const tasks = escapeHtml(formatTasks(ev));
        return `<tr>
          <td>${dateCell}</td>
          <td>${status}</td>
          <td><strong>${title}</strong></td>
          <td>${owner}</td>
          <td>${centersCell}</td>
          <td>${tasks}</td>
        </tr>`;
      }).join('\n');

      const html = `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(heading)}</title>
        <style>
          body { font-family: Helvetica, Arial, sans-serif; color: #222; margin: 20px; }
          .header { display:flex; align-items:center; gap:16px; margin-bottom:12px }
          .logo { width: 120px; height: auto; }
          h1 { font-size:16px; margin:0; }
          table { width:100%; border-collapse: collapse; font-size:12px; }
          th, td { border: 1px solid #e0e0e0; padding: 8px; vertical-align: top; }
          th { background:#f0f8f0; text-align:left; }
          td { word-break: break-word; }
          @media print {
            @page { size: portrait; margin: 12mm; }
            body { margin: 0; }
            .header { page-break-after: avoid }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${logo}" class="logo" alt="logo" />
          <div><h1>${escapeHtml(heading)}</h1></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Title</th>
              <th>Owner</th>
              <th>Centers</th>
              <th>Tasks</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); /* keep window open so user can save/print */ }, 300);
          };
        </script>
      </body>
      </html>`;

      const newWin = window.open('', '_blank');
      if (!newWin) {
        alert('Pop-up blocked. Please allow pop-ups for this site to export the PDF.');
        return;
      }
      newWin.document.write(html);
      newWin.document.close();
    } catch (err) {
      console.error('Export failed', err);
      alert('Failed to prepare print preview for next week.');
    } finally {
      setExportingPdf(false);
    }
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
      setAllEvents(prev => prev.map(ev => (ev.id === rescheduleEvent.id ? { ...ev, startDateTime: newDateTime, comments: updatedComments } : ev)));
  // notification removed: event_reschedule

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
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Reset guard when user logs out
    if (!currentUser) {
      fetchedRef.current = false;
      return;
    }
  // Prevent double fetching in StrictMode / remount scenarios
  if (fetchedRef.current) return;
  fetchedRef.current = true;

  // Load initial data
  loadData();
  }, [currentUser]);

  // Keep `events` in sync with `allEvents` when the master list changes (local updates)
  useEffect(() => {
    setEvents(allEvents);
  }, [allEvents]);

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
  setAllEvents(prev => prev.map(ev => (ev.id === editingEvent.id ? { ...editingEvent, ...eventData } : ev)));
  // notification removed: event_update
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
        // Do NOT append the created event to local state optimistically.
        // The realtime onSnapshot listener will include the new document and
        // update `allEvents`/`events`. This avoids a transient duplicate
        // showing on create across devices.
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
  setAllEvents(prev => prev.filter(ev => ev.id !== eventId));
  // notification removed: event_delete

    } catch (err) {
      alert('Error deleting event/task. Please try again.');
      console.error(err);
    }
  };

  // Helper to compute duplicate title with incremental numeric suffix (robust startsWith + suffix parse)
  const getDuplicateTitle = (title) => {
    const base = (title || 'Untitled').trim();
    let max = 0;
    for (const ev of allEvents) {
      const t = ev?.title;
      if (!t) continue;
      if (t === base) {
        // original title counts as 0
        if (0 > max) max = 0;
        continue;
      }
      if (t.startsWith(base + ' ')) {
        const suffix = t.slice(base.length).trim();
        // suffix should be a number like '1' or '2'
        const maybeNum = parseInt(suffix, 10);
        if (!isNaN(maybeNum) && String(maybeNum) === suffix) {
          if (maybeNum > max) max = maybeNum;
        }
      }
    }
    const next = max + 1;
    return `${base} ${next}`;
  };

  const handleDuplicateEvent = async (event) => {
    // Default behavior: create duplicate and append to list.
    // If caller wants to open editor for the new copy, they should call with options { openEdit: true }.
    try {
      const newTitle = getDuplicateTitle(event.title);
      const copy = { ...event };
      delete copy.id;
      copy.title = newTitle;
      copy.createdBy = { userId: currentUser.uid, userName: currentUser.displayName };
      copy.lastModifiedBy = { userId: currentUser.uid, userName: currentUser.displayName };
      copy.notificationSent = false;
      copy.lastNotificationAt = new Date();

      const docRef = await addDoc(collection(db, 'events'), copy);
      const newEvent = { id: docRef.id, ...copy };
  // Append to local state
  setEvents(prev => [...prev, newEvent]);
  setAllEvents(prev => [...prev, newEvent]);
  // notification removed: event_create (duplicate)
      return newEvent;
    } catch (err) {
      console.error('Failed to duplicate event', err);
      alert('Failed to duplicate event. Please try again.');
      throw err;
    }
  };

  const openConfirm = (action, event) => {
    setConfirmAction(action);
    setConfirmEvent(event);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (confirmLoading) return; // prevent closing while processing
    setConfirmOpen(false);
    setConfirmAction(null);
    setConfirmEvent(null);
  };

  const performConfirm = async (opt) => {
    if (!confirmAction || !confirmEvent) return;
    setConfirmLoading(true);
    try {
      if (confirmAction === 'delete') {
        await handleDeleteEvent(confirmEvent.id);
      } else if (confirmAction === 'duplicate') {
        // Always duplicate, and if 'edit', only edit the new event
        const newEvent = await handleDuplicateEvent(confirmEvent);
        if (opt === 'edit' && newEvent) {
          setEditingEvent(newEvent);
          setShowForm(true);
        }
        // Do not open or edit the original event
      }
    } catch (err) {
      // error handled in called functions
    } finally {
      setConfirmLoading(false);
      closeConfirm();
    }
  };

  // Status options for dropdown
  const statusOptions = useMemo(() => {
    return ['pending', 'in_progress'];
  }, []);

  // Filtered and grouped (derive from master allEvents so toggles/filters don't re-fetch)
  const filteredEvents = useMemo(() => {
    let filtered = allEvents
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
        // By default, when not showing history and no explicit "Date To" filter is set,
        // ensure we include events up to the next 15 days so the page doesn't only show
        // the current week. Keep this as a minimum window; if the user applies a
        // filterDateTo, their preference takes precedence.
        if (!showHistory && !filterDateTo) {
          const cutoff = new Date();
          cutoff.setHours(23, 59, 59, 999);
          cutoff.setDate(cutoff.getDate() + 15);
          filtered = filtered.filter(ev => {
            if (!ev.startDateTime) return true; // keep undated items
            const d = toJSDate(ev.startDateTime);
            if (!d) return true;
            return d <= cutoff;
          });
        }

        return filtered;
  }, [allEvents, filterCenter, filterStatus, filterDateFrom, filterDateTo, searchText, filterOwnerName, showHistory]);

  const groupedByDate = useMemo(() => {
    // Build ordered groups to preserve the sorted order from filteredEvents
    const groups = {};
    const order = [];
    filteredEvents.forEach(ev => {
      const d = toJSDate(ev.startDateTime);
      const key = d ? d.toLocaleDateString() : 'No Date';
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(ev);
    });
    return { groups, order };
  }, [filteredEvents]);

  const getCenterNames = (centerIds) => {
    if (!Array.isArray(centerIds)) return [];
    return centerIds.map(id => centerMap[id] || id);
  };

  // Who can view reschedule comments: admins/quality, evaluators, the event owner, or any user who authored a comment
  const canViewComments = (ev) => {
    if (!ev || !currentUser) return false;
    // Admins, quality team, and evaluators can view comments
    if (isAdminOrQuality || isEvaluator) return true;
    // Owner match (user owners use uid, some data may store id)
    if (ev.ownerId && currentUser.uid && (ev.ownerId === currentUser.uid || ev.ownerId === currentUser.id)) return true;
    // Comment author
    if (Array.isArray(ev.comments) && ev.comments.some(c => c && c.userId && c.userId === currentUser.uid)) return true;
    return false;
  };

  return (
    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ mb: 3, background: 'linear-gradient(180deg, rgba(221,238,221,0.7), rgba(221,238,221,0.25))', p: 2, borderRadius: 2 }}>
          <Stack spacing={1} sx={{ mb: 1 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, textAlign: { xs: 'center', sm: 'left' } }}>Events and Tasks</Typography>
            </Box>
            <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="center" sx={{ flexWrap: 'wrap', justifyContent: { xs: 'center', sm: 'flex-end' }, width: '100%' }}>
              <Tooltip title="Filters">
                <IconButton 
                  onClick={() => setFiltersOpen(v => !v)} 
                  color="primary" 
                  aria-label="filters"
                  size={isMobile ? "small" : "medium"}
                  sx={{ p: { xs: 1, sm: 1.5 } }}
                >
                  <FilterListIcon sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' } }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export next week's events (Mon–Sun)">
                <span>
                  <IconButton
                    onClick={async () => { await handleExportNextWeekPdf(); }}
                    color="primary"
                    aria-label="export-pdf"
                    disabled={exportingPdf}
                    size={isMobile ? "small" : "medium"}
                    sx={{ p: { xs: 1, sm: 1.5 } }}
                  >
                    <PictureAsPdfIcon sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' } }} />
                  </IconButton>
                </span>
              </Tooltip>
              {!isMobile && canEditEvents && (
                <Button variant="contained" color="primary" onClick={() => setShowForm(true)}>
                  Create New Event/Task
                </Button>
              )}
              <Tooltip title={showHistory ? 'History view on (completed items)' : 'Show history (completed items)'}>
                <span>
                  <Chip
                    label="History"
                    color={showHistory ? 'primary' : 'default'}
                    variant={showHistory ? 'filled' : 'outlined'}
                    clickable
                    onClick={() => setShowHistory(v => !v)}
                    onDelete={showHistory ? () => setShowHistory(false) : undefined}
                    deleteIcon={showHistory ? <CloseIcon sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }} /> : undefined}
                    sx={{
                      ml: { xs: 0, sm: 1 },
                      height: { xs: 28, sm: 32 },
                      '& .MuiChip-label': { px: 1.25, fontWeight: 600 }
                    }}
                    aria-label="toggle-history"
                    size={isMobile ? 'small' : 'medium'}
                  />
                </span>
              </Tooltip>
            </Stack>
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

        {/* Responsive: Table for desktop, Cards for mobile/tablet */}
        {(() => {
          const theme = useTheme();
          const isMobile = useMediaQuery('(max-width:1300px)');
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
            <TableCell sx={{ width: 120, whiteSpace: 'nowrap' }}>Date</TableCell>
            <TableCell sx={{ width: 120 }}>Status</TableCell>
            <TableCell sx={{ width: 240 }}>Title</TableCell>
            <TableCell sx={{ width: 140 }}>Owner</TableCell>
                      {/* Description column removed from page view */}
            <TableCell sx={{ width: 120 }}>Centers</TableCell>
            <TableCell>Tasks</TableCell>
            <TableCell sx={{ width: 120 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groupedByDate.order.map(dateKey => {
                      const group = groupedByDate.groups[dateKey] || [];
                      return (
                        <React.Fragment key={dateKey}>
                          <TableRow sx={{ background: 'background.paper' }}>
                            <TableCell colSpan={7} sx={{ fontWeight: 700 }}>{dateKey}</TableCell>
                          </TableRow>
                          {group.map(event => {
                            const d = toJSDate(event.startDateTime);
                            const ownerName = getOwnerName(event);
                            return (
                              <TableRow key={event.id}>
                                <TableCell>
                                  <Typography variant="body2">{d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={event.status === 'in_progress' ? 'In progress' : (event.status || 'pending')}
                                    size="small"
                                    color={event.status === 'completed' ? 'success' : event.status === 'cancelled' ? 'error' : event.status === 'in_progress' ? 'info' : 'warning'}
                                  />
                                </TableCell>
                                <TableCell><Typography sx={{ fontWeight: 700 }}>{event.title}</Typography></TableCell>
                                <TableCell sx={{ width: 140 }}>{ownerName}</TableCell>
                                <TableCell sx={{ width: 120, maxWidth: 160 }}>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {(event.centers || []).map(center => (
                                      <Chip key={center} label={centerMap[center] || center} size="small" />
                                    ))}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ maxWidth: '100%' }}>
                                    {event.sopId && (
                                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', mb: 0.5, display: 'block' }}>
                                        Tasks from SOP
                                      </Typography>
                                    )}
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

                                    {canViewComments(event) && event.comments && event.comments.length > 0 && (
                                      <Box sx={{ mt: 1 }}>
                                        <Typography variant="subtitle2">Reschedule Comments</Typography>
                                        <Stack spacing={1} sx={{ mt: 0.5 }}>
                                          {event.comments.map((cmt, idx) => {
                                            const parseDate = (dt) => {
                                              if (!dt) return null;
                                              if (typeof dt?.toDate === 'function') return dt.toDate();
                                              if (typeof dt === 'object' && dt.seconds) return new Date(dt.seconds * 1000);
                                              const d = new Date(dt);
                                              return isNaN(d.getTime()) ? null : d;
                                            };
                                            const target = parseDate(cmt.newDateTime) || parseDate(cmt.oldDateTime) || null;
                                            const dayMonth = target ? `${String(target.getDate()).padStart(2, '0')}-${String(target.getMonth() + 1).padStart(2, '0')}` : '';
                                            const time = target ? target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                            return (
                                              <Box key={idx}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{cmt.comment || '(no note)'}</Typography>
                                                <Typography variant="body2">{dayMonth} {time}</Typography>
                                                <Typography variant="caption">By {cmt.userName}</Typography>
                                              </Box>
                                            );
                                          })}
                                        </Stack>
                                      </Box>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell sx={{ width: 120 }}>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.25, sm: 0.5 }, alignItems: 'center' }}>
                                    {getSopUrl(event) && (
                                      <Tooltip title="Open SOP Link">
                                        <IconButton 
                                          size="small" 
                                          color="primary" 
                                          onClick={() => window.open(getSopUrl(event), '_blank')} 
                                          sx={{ p: { xs: 0.15, sm: 0.25 } }}
                                        >
                                          <LinkIcon sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }} />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {canEditEvents && (
                                      <IconButton 
                                        size="small" 
                                        color="primary" 
                                        onClick={() => handleEditEvent(event)} 
                                        sx={{ 
                                          p: { xs: 0.15, sm: 0.25 }, 
                                          border: '1px solid', 
                                          borderColor: 'primary.main', 
                                          bgcolor: 'background.paper', 
                                          borderRadius: 1 
                                        }}
                                      >
                                        <EditIcon sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }} />
                                      </IconButton>
                                    )}
                                    {canEditEvents && (
                                    <IconButton 
                                      size="small" 
                                      color="primary" 
                                      onClick={() => openConfirm('duplicate', event)} 
                                      title="Duplicate" 
                                      sx={{ p: { xs: 0.15, sm: 0.25 } }}
                                    >
                                      <ContentCopyIcon sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }} />
                                    </IconButton>
                                    )}
                                    {canEditEvents && (
                                    <IconButton 
                                      size="small" 
                                      color="secondary" 
                                      onClick={() => handleOpenReschedule(event)} 
                                      sx={{ p: { xs: 0.15, sm: 0.25 } }}
                                    >
                                      <AutorenewIcon sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }} />
                                    </IconButton>
                                    )}
                                    {isAdminOrQuality && (
                                      <IconButton 
                                        size="small" 
                                        color="error" 
                                        onClick={() => openConfirm('delete', event)} 
                                        sx={{ p: { xs: 0.15, sm: 0.25 } }}
                                      >
                                        <DeleteIcon sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }} />
                                      </IconButton>
                                    )}
                                  </Box>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            );
          } else {
            // Mobile Card view grouped by date
            return (
              <List sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, p: 0 }}>
                {groupedByDate.order.map(dateKey => (
                  <Box key={dateKey}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{dateKey}</Typography>
                    {(groupedByDate.groups[dateKey] || []).map(event => {
                      const d = toJSDate(event.startDateTime);
                      const ownerName = getOwnerName(event);
                      return (
                        <Card key={event.id} sx={{ mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(41,45,52,0.04)', background: 'white' }}>
                          <CardContent sx={{ p: 2 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%', justifyContent: 'space-between' }}>
                              <Typography variant="subtitle2" color="text.secondary" sx={{ minWidth: 72 }}>{d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</Typography>
                              <Chip
                                label={event.status === 'in_progress' ? 'In progress' : (event.status || 'pending')}
                                size="small"
                                color={event.status === 'completed' ? 'success' : event.status === 'cancelled' ? 'error' : event.status === 'in_progress' ? 'info' : 'warning'}
                              />
                            </Stack>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{event.title}</Typography>
                            {ownerName && (
                              <Typography variant="caption" color="text.secondary">Owner: {ownerName}</Typography>
                            )}
                            {/* Description removed from card view; view/edit it in the Edit dialog */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {(event.centers || []).map(center => (
                                  <Chip key={center} label={centerMap[center] || center} size="small" />
                                ))}
                              </Box>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {event.sopId && (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', mb: 0.5, display: 'block', width: '100%' }}>
                                    Tasks from SOP
                                  </Typography>
                                )}
                                {(editingTodos[event.id] || event.todos || []).map(todo => (
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
                              </Box>
                            </Box>
                            <Stack direction="row" spacing={{ xs: 0.25, sm: 0.5 }} sx={{ mt: 1.5, alignItems: 'center' }}>
                              {getSopUrl(event) && (
                                <Tooltip title="Open SOP Link">
                                  <IconButton 
                                    size="small" 
                                    color="primary" 
                                    onClick={() => window.open(getSopUrl(event), '_blank')} 
                                    sx={{ p: { xs: 0.15, sm: 0.25 } }}
                                  >
                                    <LinkIcon sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {isAdminOrQuality && (
                                <IconButton 
                                  size="small" 
                                  color="primary" 
                                  onClick={() => handleEditEvent(event)} 
                                  sx={{ 
                                    p: { xs: 0.15, sm: 0.25 }, 
                                    border: '1px solid', 
                                    borderColor: 'primary.main', 
                                    bgcolor: 'background.paper', 
                                    borderRadius: 1 
                                  }}
                                >
                                  <EditIcon sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }} />
                                </IconButton>
                              )}
                              <IconButton 
                                size="small" 
                                color="primary" 
                                onClick={() => openConfirm('duplicate', event)} 
                                title="Duplicate" 
                                sx={{ p: { xs: 0.15, sm: 0.25 } }}
                              >
                                <ContentCopyIcon sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }} />
                              </IconButton>
                              <IconButton 
                                size="small" 
                                color="secondary" 
                                onClick={() => handleOpenReschedule(event)} 
                                sx={{ p: { xs: 0.15, sm: 0.25 } }}
                              >
                                <AutorenewIcon sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }} />
                              </IconButton>
                              {isAdminOrQuality && (
                                <IconButton 
                                  size="small" 
                                  color="error" 
                                  onClick={() => openConfirm('delete', event)} 
                                  sx={{ p: { xs: 0.15, sm: 0.25 } }}
                                >
                                  <DeleteIcon sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }} />
                                </IconButton>
                              )}
                            </Stack>
                            {canViewComments(event) && event.comments && event.comments.length > 0 && (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="subtitle2">Reschedule Comments</Typography>
                                <Stack spacing={1} sx={{ mt: 0.5 }}>
                                  {event.comments.map((cmt, idx) => {
                                    const parseDate = (dt) => {
                                      if (!dt) return null;
                                      if (typeof dt?.toDate === 'function') return dt.toDate();
                                      if (typeof dt === 'object' && dt.seconds) return new Date(dt.seconds * 1000);
                                      const d = new Date(dt);
                                      return isNaN(d.getTime()) ? null : d;
                                    };
                                    const target = parseDate(cmt.newDateTime) || parseDate(cmt.oldDateTime) || null;
                                    const dayMonth = target ? `${String(target.getDate()).padStart(2, '0')}-${String(target.getMonth() + 1).padStart(2, '0')}` : '';
                                    const time = target ? target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                    return (
                                      <Box key={idx}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{cmt.comment || '(no note)'}</Typography>
                                        <Typography variant="body2">{dayMonth} {time}</Typography>
                                        <Typography variant="caption">By {cmt.userName}</Typography>
                                      </Box>
                                    );
                                  })}
                                </Stack>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                ))}
              </List>
            );
          }
        })()}
      </Paper>

      {/* Mobile floating action button for creating a new event/task (matches Mentors page behavior) */}
      {isMobile && canEditEvents && (
        <Fab
          color="primary"
          aria-label="add"
          onClick={() => { setShowForm(true); setEditingEvent(null); }}
          sx={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1000 }}
        >
          +
        </Fab>
      )}

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

      {/* Confirm dialog for duplicate/delete */}
      <Dialog open={confirmOpen} onClose={closeConfirm} fullWidth maxWidth="xs">
        <DialogTitle>
          {confirmAction === 'delete' ? 'Confirm Delete' : 'Duplicate Event'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1, fontWeight: 600 }}>{confirmEvent?.title}</Typography>
          {confirmAction === 'delete' ? (
            <Typography>Are you sure you want to permanently delete this event/task? This action cannot be undone.</Typography>
          ) : (
            <Typography>Choose whether to duplicate this event and keep the copy as-is, or open the copy in the editor to make changes.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirm} disabled={confirmLoading}>Cancel</Button>
          {confirmAction === 'duplicate' ? (
            <>
              <Button onClick={() => performConfirm('create')} disabled={confirmLoading}>Create Copy</Button>
              <Button variant="contained" onClick={() => performConfirm('edit')} disabled={confirmLoading}>Create & Edit</Button>
            </>
          ) : (
            <Button color="error" variant="contained" onClick={() => performConfirm()} disabled={confirmLoading}>Delete</Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Calendar;
