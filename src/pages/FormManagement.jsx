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
  useTheme
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { db } from '../firebase/config';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import {
  intellectFields,
  culturalFields,
  kpiFieldLabels,
  intellectOptionsMap,
  culturalOptionsMap,
  defaultOptions
} from '../constants/kpiFields';

// Utility to create a safe key from a label
const toKey = (label, existingKeys = new Set()) => {
  const base = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
  if (!existingKeys.has(base)) return base || `field${existingKeys.size + 1}`;
  let i = 2;
  while (existingKeys.has(`${base}${i}`)) i++;
  return `${base}${i}`;
};

const emptyField = () => ({ label: '', key: '', options: [] });

const FormEditorDialog = ({ open, onClose, onSave, initial }) => {
  const isEdit = !!(initial && initial.id);
  const [name, setName] = useState(initial?.name || '');
  const [fields, setFields] = useState(initial?.fields?.length ? initial.fields : [emptyField()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name || '');
      setFields(initial?.fields?.length ? initial.fields : [emptyField()]);
      setSaving(false);
    }
  }, [open, initial]);

  const updateField = (idx, patch) => {
    setFields(prev => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const addField = () => setFields(prev => [...prev, emptyField()]);
  const removeField = (idx) => setFields(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    // Normalize keys and options
    const keys = new Set();
    const normalized = fields
      .map(f => ({
        label: (f.label || '').trim(),
        key: (f.key || '').trim(),
        options: Array.isArray(f.options)
          ? f.options.filter(Boolean).map(s => String(s))
          : typeof f.options === 'string'
            ? f.options.split(',').map(s => s.trim()).filter(Boolean)
            : []
      }))
      .filter(f => f.label);
    normalized.forEach(f => {
      if (!f.key) f.key = toKey(f.label, keys);
      if (keys.has(f.key)) f.key = toKey(f.key, keys);
      keys.add(f.key);
    });

    if (!name.trim() || normalized.length === 0) return;
    setSaving(true);
    try {
      await onSave({ ...initial, name: name.trim(), fields: normalized });
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
                      helperText="Auto-generated from label if left blank"
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [forms, setForms] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);

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
    if (payload.id) {
      const id = payload.id; const { id: _id, ...rest } = payload;
      await updateDoc(doc(db, 'kpiForms', id), { ...rest, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'kpiForms'), { ...payload, createdAt: serverTimestamp() });
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
  };

  // Build legacy forms (Intellect/Cultural) from constants when not present in Firestore
  const buildFields = (keys, type) =>
    keys.map(k => ({
      label: kpiFieldLabels[k] || k,
      key: k,
      options: (type === 'Intellect' ? intellectOptionsMap[k] : culturalOptionsMap[k]) || defaultOptions
    }));

  const formsByName = new Map(forms.map(f => [f.name, f]));
  const legacyIntellect = formsByName.has('Intellect') ? null : { name: 'Intellect', fields: buildFields(intellectFields, 'Intellect') };
  const legacyCultural = formsByName.has('Cultural') ? null : { name: 'Cultural', fields: buildFields(culturalFields, 'Cultural') };
  const displayForms = [
    ...(legacyIntellect ? [{ ...legacyIntellect, __legacy: true, id: undefined }] : []),
    ...(legacyCultural ? [{ ...legacyCultural, __legacy: true, id: undefined }] : []),
    ...forms
  ];

  // Debug logging
  console.log('FormManagement: forms from Firestore:', forms);
  console.log('FormManagement: formsByName:', formsByName);
  console.log('FormManagement: displayForms:', displayForms);
  console.log('FormManagement: legacyIntellect:', legacyIntellect);
  console.log('FormManagement: legacyCultural:', legacyCultural);

  const importDefaultForms = async () => {
    setImporting(true);
    try {
      const ops = [];
      if (legacyIntellect) ops.push(addDoc(collection(db, 'kpiForms'), { name: legacyIntellect.name, fields: legacyIntellect.fields, createdAt: serverTimestamp() }));
      if (legacyCultural) ops.push(addDoc(collection(db, 'kpiForms'), { name: legacyCultural.name, fields: legacyCultural.fields, createdAt: serverTimestamp() }));
      await Promise.all(ops);
    } finally {
      setImporting(false);
    }
  };

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
            {(legacyIntellect || legacyCultural) && (
              <Button variant="text" onClick={importDefaultForms} disabled={importing}>
                {importing ? 'Importing…' : 'Import Defaults (Intellect & Cultural)'}
              </Button>
            )}
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
            <List>
            {displayForms.map(f => (
              <ListItem key={f.id || f.name} divider>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="h6">{f.name}</Typography>
                      {f.__legacy && <Chip size="small" label="Built-in" />}
                    </Stack>
                  }
                  secondary={`${(f.fields || []).length} fields`}
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Tooltip title={f.__legacy ? 'Import & Edit' : 'Edit'}>
                    <IconButton onClick={() => openEdit(f)}><EditIcon /></IconButton>
                  </Tooltip>
                  {!f.__legacy && (
                    <Tooltip title="Delete">
                      <IconButton color="error" onClick={() => deleteForm(f)}><DeleteIcon /></IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </ListItem>
            ))}
            </List>
          </>
        )}
      </Paper>

      <FormEditorDialog open={editorOpen} onClose={() => setEditorOpen(false)} onSave={saveForm} initial={editing} />
    </Container>
  );
};

export default FormManagement;
