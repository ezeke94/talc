import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Checkbox, FormControlLabel, MenuItem, Select, InputLabel, FormControl, Paper, Stack, useMediaQuery } from '@mui/material';

// Placeholder props: onSave, eventData, centers, mentors, users, sops
const EventForm = ({ onSave, eventData = {}, centers = [], mentors = [], users = [], sops = [] }) => {
  const [title, setTitle] = useState(eventData.title || '');
  const [description, setDescription] = useState(eventData.description || '');
  const [centerIds, setCenterIds] = useState(eventData.centers || []);
  const [ownerId, setOwnerId] = useState(eventData.ownerId || '');
  const [ownerType, setOwnerType] = useState(eventData.ownerType || 'user');
  const [startDateTime, setStartDateTime] = useState(eventData.startDateTime || '');
  const [endDateTime, setEndDateTime] = useState(eventData.endDateTime || '');
  const [isRecurring, setIsRecurring] = useState(eventData.isRecurring || false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState(eventData.recurrenceFrequency || 'weekly');
  const [recurrenceDays, setRecurrenceDays] = useState(eventData.recurrenceDays || []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(eventData.recurrenceEndDate || '');
  const [sopId, setSopId] = useState(eventData.sopId || '');

  // To-do list placeholder
  const [todos, setTodos] = useState(eventData.todos || []);

  // Add/remove todo
  const addTodo = () => setTodos([...todos, { id: Date.now(), text: '', completed: false }]);
  const updateTodo = (idx, field, value) => {
    const newTodos = [...todos];
    newTodos[idx][field] = value;
    setTodos(newTodos);
  };
  const removeTodo = idx => setTodos(todos.filter((_, i) => i !== idx));

  // SOP application
  const applySop = sopId => {
    const sop = sops.find(s => s.id === sopId);
    if (sop) {
      setTodos(sop.todos.map(todo => ({ id: Date.now() + Math.random(), text: todo.text, completed: false })));
      setSopId(sopId);
    }
  };

  // Save handler
  const handleSave = () => {
    // Use endDateTime as recurrenceEndDate if recurring
    let recurrenceEnd = recurrenceEndDate;
    if (isRecurring && !recurrenceEndDate && endDateTime) {
      recurrenceEnd = endDateTime.split('T')[0]; // Use only date part
      setRecurrenceEndDate(recurrenceEnd);
    }
    if (isRecurring && !recurrenceEnd) {
      alert('Please select an end date for recurring events.');
      return;
    }
    // Build recurrence rule (RFC 5545-like)
    let recurrenceRule = '';
    if (isRecurring) {
      recurrenceRule = `FREQ=${recurrenceFrequency.toUpperCase()}`;
      if (recurrenceDays.length > 0) recurrenceRule += `;BYDAY=${recurrenceDays.join(',')}`;
      if (recurrenceEnd) recurrenceRule += `;UNTIL=${recurrenceEnd.replace(/-/g, '')}`;
    }
    // Status logic: only update status when user saves
    const allCompleted = todos.length > 0 && todos.every(td => td.completed);
    const someCompleted = todos.length > 0 && todos.some(td => td.completed);
    let status = eventData.status || 'pending';
    if (allCompleted) {
      status = 'completed';
    } else if (someCompleted) {
      status = 'in_progress';
    } else {
      status = 'pending';
    }
    // Recurring event creation logic
    if (isRecurring && recurrenceRule && recurrenceEnd) {
      // For demo: create events for each week between startDateTime and recurrenceEnd
      const start = new Date(startDateTime);
      const end = new Date(recurrenceEnd + 'T23:59');
      let eventsToCreate = [];
      let current = new Date(start);
      while (current <= end) {
        eventsToCreate.push({
          title,
          description,
          centers: centerIds,
          ownerId,
          ownerType,
          startDateTime: current.toISOString().slice(0,16),
          endDateTime,
          isRecurring,
          recurrenceRule,
          recurrenceFrequency,
          recurrenceDays,
          recurrenceEndDate: recurrenceEnd,
          sopId,
          todos,
          status,
        });
        // Advance by frequency
        if (recurrenceFrequency === 'weekly') {
          current.setDate(current.getDate() + 7);
        } else if (recurrenceFrequency === 'daily') {
          current.setDate(current.getDate() + 1);
        } else if (recurrenceFrequency === 'monthly') {
          current.setMonth(current.getMonth() + 1);
        } else {
          break;
        }
      }
      // Call onSave for each event
      eventsToCreate.forEach(ev => onSave(ev));
      return;
    }
    // Non-recurring event
    onSave({
      title,
      description,
      centers: centerIds,
      ownerId,
      ownerType,
      startDateTime,
      endDateTime,
      isRecurring,
      recurrenceRule,
      recurrenceFrequency,
      recurrenceDays,
      recurrenceEndDate: recurrenceEnd,
      sopId,
      todos,
      status,
    });
  };

  // UI: Different for mobile and laptop
  const isMobile = useMediaQuery('(max-width:600px)');

  return (
    <Paper sx={{ p: isMobile ? 1 : 3, mb: 3 }}>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 1 : 2 }}>
        <TextField label="Title" value={title} onChange={e => setTitle(e.target.value)} required fullWidth size={isMobile ? 'small' : 'medium'} />
        <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} multiline rows={2} fullWidth size={isMobile ? 'small' : 'medium'} />
        <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
          <InputLabel>Centers</InputLabel>
          <Select multiple value={centerIds} onChange={e => setCenterIds(e.target.value)} label="Centers">
            {centers.map(center => (
              <MenuItem key={center.id || center} value={center.id || center}>{center.name || center}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
          <InputLabel>Owner Type</InputLabel>
          <Select value={ownerType} onChange={e => setOwnerType(e.target.value)} label="Owner Type">
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="mentor">Mentor</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
          <InputLabel>Owner</InputLabel>
          <Select value={ownerId} onChange={e => setOwnerId(e.target.value)} label="Owner">
            {(ownerType === 'user' ? users : mentors).map(owner => (
              <MenuItem key={owner.id} value={owner.id}>{owner.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField type="datetime-local" label="Start Date/Time" value={startDateTime} onChange={e => setStartDateTime(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size={isMobile ? 'small' : 'medium'} />
        <TextField type="datetime-local" label="End Date/Time" value={endDateTime} onChange={e => setEndDateTime(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size={isMobile ? 'small' : 'medium'} />
        <FormControlLabel control={<Checkbox checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />} label="Recurring Event" />
        {isRecurring && (
          <Box sx={{ mb: 2 }}>
            <Stack direction={isMobile ? 'column' : { xs: 'column', sm: 'row' }} spacing={isMobile ? 1 : 2}>
              <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                <InputLabel>Frequency</InputLabel>
                <Select value={recurrenceFrequency} label="Frequency" onChange={e => setRecurrenceFrequency(e.target.value)}>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                <InputLabel>Days (for weekly)</InputLabel>
                <Select
                  multiple
                  value={recurrenceDays}
                  label="Days (for weekly)"
                  onChange={e => setRecurrenceDays(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                >
                  <MenuItem value="MO">Monday</MenuItem>
                  <MenuItem value="TU">Tuesday</MenuItem>
                  <MenuItem value="WE">Wednesday</MenuItem>
                  <MenuItem value="TH">Thursday</MenuItem>
                  <MenuItem value="FR">Friday</MenuItem>
                  <MenuItem value="SA">Saturday</MenuItem>
                  <MenuItem value="SU">Sunday</MenuItem>
                </Select>
              </FormControl>
              {/* End date is not shown again, it's taken from endDateTime */}
            </Stack>
          </Box>
        )}
        <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
          <InputLabel>Apply SOP</InputLabel>
          <Select value={sopId} onChange={e => applySop(e.target.value)} label="Apply SOP">
            <MenuItem value="">None</MenuItem>
            {sops.map(sop => (
              <MenuItem key={sop.id} value={sop.id}>{sop.title}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ mt: 2 }}>To-Do List</Typography>
        {todos.map((todo, idx) => (
          <Box key={todo.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Checkbox checked={todo.completed} onChange={e => updateTodo(idx, 'completed', e.target.checked)} size={isMobile ? 'small' : 'medium'} />
            <TextField value={todo.text} onChange={e => updateTodo(idx, 'text', e.target.value)} size={isMobile ? 'small' : 'medium'} sx={{ flex: 1 }} />
            <Button color="error" onClick={() => removeTodo(idx)} size={isMobile ? 'small' : 'medium'}>Delete</Button>
          </Box>
        ))}
        <Button variant="outlined" onClick={addTodo} size={isMobile ? 'small' : 'medium'}>+ Add To-Do</Button>
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" color="primary" onClick={handleSave} size={isMobile ? 'small' : 'medium'}>Save Event/Task</Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default EventForm;
