import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  ListItemSecondaryAction,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { db } from '../firebase/config';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,

  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { kpiFieldLabels } from '../constants/kpiFields';
import { useTheme } from '@mui/material/styles';

const MAX_KEY_LENGTH = 10;
const DEFAULT_ORDER_FALLBACK = 9999;

// Utility to create a safe key from a label, capped at MAX_KEY_LENGTH and unique
const toKey = (label, existingKeys = new Set()) => {
  const baseRaw = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');

  let base = (baseRaw || `field${existingKeys.size + 1}`).slice(0, MAX_KEY_LENGTH);
  if (!existingKeys.has(base)) return base;

  let i = 2;
  while (true) {
    const suffix = String(i);
    const trimmed = base.slice(0, Math.max(1, MAX_KEY_LENGTH - suffix.length));
    const candidate = `${trimmed}${suffix}`;
    if (!existingKeys.has(candidate)) return candidate;
    i++;
  }
};

const emptyField = () => ({ label: '', key: '', options: [] });

const FormEditorDialog = ({ open, onClose, onSave, initial }) => {
  const isEdit = !!(initial && initial.id);
  const [name, setName] = useState(initial?.name || '');
  const [fields, setFields] = useState(initial?.fields?.length ? initial.fields : [emptyField()]);
  const [order, setOrder] = useState(typeof initial?.order === 'number' ? initial.order : null);
  const [hideName, setHideName] = useState(!!initial?.hideName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name || '');
      setFields(initial?.fields?.length ? initial.fields : [emptyField()]);
      setOrder(typeof initial?.order === 'number' ? initial.order : null);
      setHideName(!!initial?.hideName);
      setSaving(false);
    }
  }, [open, initial]);

  const updateField = (idx, patch) => {
    setFields(prev => prev.map((f, i) => {
      if (i !== idx) return f;

      const nextPatch = { ...patch };

      // Enforce 10-char key length immediately for better UX
      if (nextPatch.key !== undefined && typeof nextPatch.key === 'string') {
        nextPatch.key = nextPatch.key.slice(0, MAX_KEY_LENGTH);
      }
      
      // If updating options, enforce the 5-option limit
      if (nextPatch.options !== undefined) {
        const optionsStr = typeof nextPatch.options === 'string' 
          ? nextPatch.options 
          : Array.isArray(nextPatch.options) 
            ? nextPatch.options.join(', ')
            : '';
        
        const optionsList = optionsStr
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        
        if (optionsList.length > 5) {
          // Truncate to first 5 options and show warning
          nextPatch.options = optionsList.slice(0, 5).join(', ');
          // Alert user about the limit
          setTimeout(() => {
            alert(`Field can have a maximum of 5 options. Truncated to first 5 options.`);
          }, 0);
        }
      }
      
      return { ...f, ...nextPatch };
    }));
  };

  const addField = () => setFields(prev => [...prev, emptyField()]);
  const removeField = (idx) => setFields(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    // Normalize keys and options
    const keys = new Set();
    const normalized = fields
      .map(f => ({
        label: (f.label || '').trim(),
        key: (f.key || '').trim().slice(0, MAX_KEY_LENGTH),
        options: Array.isArray(f.options)
          ? f.options.filter(Boolean).map(s => String(s)).slice(0, 5)
          : typeof f.options === 'string'
            ? f.options.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
            : []
      }))
      .filter(f => f.label);
    normalized.forEach(f => {
      if (!f.key) f.key = toKey(f.label, keys);
      if (keys.has(f.key)) f.key = toKey(f.key, keys);
      keys.add(f.key);
    });

    if (!name.trim() || normalized.length === 0) return;
    
    // Validate that no field has more than 5 options
    const allValid = normalized.every(f => f.options.length <= 5);
    if (!allValid) {
      alert('All fields must have 5 options or fewer. Please remove excess options.');
      return;
    }
    
    setSaving(true);
    try {
      await onSave({ ...initial, name: name.trim(), fields: normalized, order, hideName });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {isEdit ? 'Edit KPI Form' : 'Create KPI Form'}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Form Name"
            fullWidth
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <FormControlLabel
            control={<Checkbox checked={hideName} onChange={e => setHideName(e.target.checked)} />}
            label="Hide form name on KPI Dashboard"
          />
          {isEdit && (
            <TextField
              label="Order (lower shows earlier)"
              type="number"
              fullWidth
              value={order ?? ''}
              onChange={e => setOrder(e.target.value === '' ? null : Number(e.target.value))}
              inputProps={{ min: 0 }}
              helperText="Optional. You can also reorder using the arrows in the list."
            />
          )}
          <Divider />
          <Typography variant="subtitle1">Fields</Typography>
          <Stack spacing={2}>
            {fields.map((f, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label={`Field ${idx + 1} Label`}
                      fullWidth
                      value={f.label}
                      onChange={e => updateField(idx, { label: e.target.value })}
                    />
                    <TextField
                      label="Key (optional)"
                      helperText="Auto-generated from label if left blank (max 10 characters)"
                      value={f.key}
                      onChange={e => updateField(idx, { key: e.target.value })}
                    />
                  </Stack>
                  <TextField
                    label="Options (comma-separated, optional)"
                    placeholder="1 - Very Poor, 2 - Poor, ..."
                    value={Array.isArray(f.options) ? f.options.join(', ') : (f.options || '')}
                    onChange={e => updateField(idx, { options: e.target.value })}
                    fullWidth
                    helperText="Maximum 5 options. Separate options with commas."
                  />
                  <Box textAlign="right">
                    <Button color="error" onClick={() => removeField(idx)} disabled={fields.length <= 1}>
                      Remove Field
                    </Button>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
          <Box>
            <Button startIcon={<AddIcon />} onClick={addField}>Add Field</Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Form')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Assignment UI intentionally removed; mentors assign forms on Mentors page

const FormManagement = () => {
  // Responsive checks not required here
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [forms, setForms] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const unsubForms = onSnapshot(collection(db, 'kpiForms'), (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('FormManagement: Loaded forms:', arr); // Keep this log to verify forms are loading
      setForms(arr);
      setLoading(false);
    });
    const unsubMentors = onSnapshot(collection(db, 'mentors'), (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMentors(arr);
    });
    return () => { unsubForms(); unsubMentors(); };
  }, []);

  const openCreate = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (form) => { setEditing(form); setEditorOpen(true); };

  const saveForm = async (payload) => {
    const maxOrder = forms.reduce((m, f) => Math.max(m, typeof f.order === 'number' ? f.order : -1), -1);

    if (payload.id) {
      const id = payload.id; const { id: _id, ...rest } = payload;
      await updateDoc(doc(db, 'kpiForms', id), { ...rest, updatedAt: serverTimestamp() });
    } else {
      const nextOrder = typeof payload.order === 'number' ? payload.order : maxOrder + 1;
      await addDoc(collection(db, 'kpiForms'), { ...payload, order: nextOrder, createdAt: serverTimestamp() });
    }
  };

  const deleteForm = async (form) => {
    if (!window.confirm(`Delete form "${form.name}"? This won't delete existing submissions.`)) return;
    await deleteDoc(doc(db, 'kpiForms', form.id));
    // Optional: remove from mentor assignments
    const affected = mentors.filter(m => Array.isArray(m.assignedFormIds) && m.assignedFormIds.includes(form.id));
    for (const m of affected) {
      const next = (m.assignedFormIds || []).filter(fid => fid !== form.id);
      await updateDoc(doc(db, 'mentors', m.id), { assignedFormIds: next });
    }

    // Reindex remaining orders to keep sequence compact
    const remaining = forms.filter(f => f.id !== form.id)
      .sort((a, b) => (a.order ?? DEFAULT_ORDER_FALLBACK) - (b.order ?? DEFAULT_ORDER_FALLBACK));
    const batch = writeBatch(db);
    remaining.forEach((f, idx) => {
      if (typeof f.id === 'string') {
        batch.update(doc(db, 'kpiForms', f.id), { order: idx });
      }
    });
    await batch.commit();
  };

  const sortedForms = useMemo(() => (
    [...forms].sort((a, b) => {
      const ao = a.order ?? DEFAULT_ORDER_FALLBACK;
      const bo = b.order ?? DEFAULT_ORDER_FALLBACK;
      if (ao !== bo) return ao - bo;
      return (a.name || '').localeCompare(b.name || '');
    })
  ), [forms]);

  const moveForm = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedForms.length) return;

    const reordered = [...sortedForms];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const batch = writeBatch(db);
    reordered.forEach((f, idx) => {
      if (f.id) batch.update(doc(db, 'kpiForms', f.id), { order: idx });
    });
    await batch.commit();
  };

  // Build legacy forms (Intellect/Cultural) from constants when not present in Firestore
  const buildFields = (keys, type) =>
    keys.map(k => ({
      label: kpiFieldLabels[k] || k,
      key: k,
      options: (type === 'Intellect' ? intellectOptionsMap[k] : culturalOptionsMap[k]) || defaultOptions
    }));

  const formsByName = new Map(forms.map(f => [f.name, f]));
  const displayForms = sortedForms;

  // Debug logging
  console.log('FormManagement: forms from Firestore:', forms);
  console.log('FormManagement: formsByName:', formsByName);
  console.log('FormManagement: displayForms:', displayForms);

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>Form Management</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Create and edit KPI forms and assign them to mentors. Existing Intellect and Cultural forms can be represented here as well.
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New Form</Button>
          </Stack>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography>Loading forms...</Typography>
          </Box>
        ) : displayForms.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">No forms yet. Create your first KPI form.</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Debug: {forms.length} forms loaded from Firebase
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Showing {displayForms.length} forms ({forms.length} from database)
            </Typography>
            {isMobile ? (
              <Stack spacing={1}>
                {displayForms.map((f, idx) => (
                  <Paper key={f.id || f.name} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>{f.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{(f.fields || []).length} fields</Typography>
                        {f.hideName && <Typography variant="caption" color="warning.main">Hidden on dashboard</Typography>}
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small" disabled={idx === 0} onClick={() => moveForm(idx, -1)} aria-label="Move up"><ArrowUpwardIcon fontSize="small" /></IconButton>
                        <IconButton size="small" disabled={idx === displayForms.length - 1} onClick={() => moveForm(idx, 1)} aria-label="Move down"><ArrowDownwardIcon fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => openEdit(f)} aria-label="Edit form"><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => deleteForm(f)} aria-label="Delete form"><DeleteIcon fontSize="small" /></IconButton>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <List>
              {displayForms.map((f, idx) => (
                <ListItem key={f.id || f.name} divider>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="h6">{f.name}</Typography>
                        <Typography variant="caption" color="text.secondary">Order: {typeof f.order === 'number' ? f.order : '—'}</Typography>
                        {f.hideName && <Chip size="small" color="warning" label="Hidden on dashboard" />}
                      </Stack>
                    }
                    secondary={`${(f.fields || []).length} fields`}
                  />
                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Tooltip title="Move up">
                        <span>
                          <IconButton size="small" disabled={idx === 0} onClick={() => moveForm(idx, -1)} aria-label="Move up"><ArrowUpwardIcon fontSize="small" /></IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move down">
                        <span>
                          <IconButton size="small" disabled={idx === displayForms.length - 1} onClick={() => moveForm(idx, 1)} aria-label="Move down"><ArrowDownwardIcon fontSize="small" /></IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={'Edit'}>
                        <IconButton onClick={() => openEdit(f)} aria-label="Edit form"><EditIcon /></IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton color="error" onClick={() => deleteForm(f)} aria-label="Delete form"><DeleteIcon /></IconButton>
                      </Tooltip>
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              </List>
            )}
          </>
        )}
      </Paper>

      <FormEditorDialog open={editorOpen} onClose={() => setEditorOpen(false)} onSave={saveForm} initial={editing} />
    </Container>
  );
};

export default FormManagement;
