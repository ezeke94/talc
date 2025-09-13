import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/config';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Box, Button, Typography, Paper, Snackbar, Alert, CircularProgress } from '@mui/material';
import RatingScaleWithNotes from './RatingScaleWithNotes';
import { defaultOptions } from '../constants/kpiFields';

const DynamicKPIForm = () => {
  // Scroll to top on mount
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    } catch {}
  }, []);

  const { mentorId, formId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [formMeta, setFormMeta] = useState(null); // { name, fields: [{label, key, options?}] }
  const [formData, setFormData] = useState({}); // { key: { score: '3', note: '' } }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'kpiForms', formId));
        if (!snap.exists()) {
          setNotification({ open: true, message: 'Form not found.', severity: 'error' });
          setLoading(false);
          return;
        }
        const meta = { id: snap.id, ...snap.data() };
        setFormMeta(meta);

        const init = {};
        (meta.fields || []).forEach(f => {
          const key = f.key || f.label || 'field';
          init[key] = { score: '3', note: '' };
        });
        setFormData(init);
      } catch (e) {
        console.error('Failed to load form', e);
        setNotification({ open: true, message: 'Failed to load form.', severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [formId]);

  const handleChange = (fieldKey) => (value) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mentorId || !formMeta) return;
    setSaving(true);
    try {
      const payload = { ...formData };
      for (const k in payload) {
        if (payload[k] && typeof payload[k].score === 'string') {
          payload[k].score = parseInt(payload[k].score, 10);
        }
      }
      await addDoc(collection(db, 'kpiSubmissions'), {
        mentorId,
        formId: formMeta.id,
        formName: formMeta.name,
        kpiType: formMeta.name, // compatibility with legacy filters
        form: payload,
        createdAt: serverTimestamp(),
        assessorId: auth.currentUser?.uid,
        assessorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown',
      });
      setNotification({ open: true, message: 'Submission successful!', severity: 'success' });
      setTimeout(() => navigate(`/mentor/${mentorId}`), 1200);
    } catch (err) {
      console.error('Submit failed', err);
      setNotification({ open: true, message: 'Submission failed. Please try again.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const closeNote = () => setNotification(prev => ({ ...prev, open: false }));

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6">Loading form…</Typography>
        <Box sx={{ mt: 2 }}><CircularProgress /></Box>
      </Paper>
    );
  }

  if (!formMeta) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="error">Form not found.</Typography>
      </Paper>
    );
  }

  return (
    <>
      <Paper component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.paper', borderRadius: 3, boxShadow: '0 2px 8px 0 rgba(80, 63, 205, 0.04)' }}>
        <Typography variant="h4" gutterBottom>{formMeta.name} KPI Form</Typography>
        {(formMeta.fields || []).map((field, idx) => (
          <RatingScaleWithNotes
            key={field.key || field.label || idx}
            label={`${idx + 1}. ${field.label || field.key}`}
            value={formData[field.key || field.label]}
            onChange={handleChange(field.key || field.label)}
            options={Array.isArray(field.options) && field.options.length > 0 ? field.options : defaultOptions}
          />
        ))}
        <Box mt={3}>
          <Button type="submit" variant="contained" color="secondary" disabled={saving} fullWidth sx={{ borderRadius: 2, fontWeight: 600, fontSize: '1rem', py: 1.2 }}>
            {saving ? <CircularProgress size={24} color="inherit" /> : 'Submit Form'}
          </Button>
        </Box>
      </Paper>

      <Snackbar open={notification.open} autoHideDuration={6000} onClose={closeNote} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={closeNote} severity={notification.severity} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default DynamicKPIForm;
