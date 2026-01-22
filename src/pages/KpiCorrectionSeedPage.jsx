import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  Chip,
  LinearProgress,
  Snackbar
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import {
  generateCorrectionReport,
  applyKpiCorrectionsSimple,
  getFormAuditReport,
  applyFormCorrections
} from '../utils/kpiCorrectionUtils';

/**
 * Seed page for managing KPI corrections
 * Allows admin users to:
 * 1. Find all KPI entries with scores > 5
 * 2. Preview corrections
 * 3. Apply corrections in batch
 */
const KpiCorrectionSeedPage = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [formAudit, setFormAudit] = useState(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [formConfirmDialogOpen, setFormConfirmDialogOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyingForms, setApplyingForms] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [correctionResult, setCorrectionResult] = useState(null);
  const [formCorrectionResult, setFormCorrectionResult] = useState(null);

  // Load report on component mount
  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const [newReport, formReport] = await Promise.all([
        generateCorrectionReport(),
        getFormAuditReport()
      ]);

      setReport(newReport);
      setFormAudit(formReport);

      if (newReport.totalSubmissionsWithInvalidScores === 0 && formReport.invalidFormCount === 0) {
        setSnackbar({
          open: true,
          message: '✅ All KPI scores and forms look good! No corrections needed.',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error loading report:', error);
      setSnackbar({
        open: true,
        message: `❌ Error loading report: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewClick = () => {
    setPreviewDialogOpen(true);
  };

  const handleApplyClick = () => {
    setConfirmDialogOpen(true);
  };

  const handleApplyFormsClick = () => {
    setFormConfirmDialogOpen(true);
  };

  const handleConfirmApply = async () => {
    setConfirmDialogOpen(false);
    setApplying(true);
    try {
      const submissionsToCorrect = report.invalidSubmissions;
      const result = await applyKpiCorrectionsSimple(submissionsToCorrect);
      setCorrectionResult(result);
      setSnackbar({
        open: true,
        message: `✅ Successfully corrected ${result.submissionsCorrected} submissions and ${result.fieldsCorrected} fields!`,
        severity: 'success'
      });
      // Reload the report
      await loadReport();
    } catch (error) {
      console.error('Error applying corrections:', error);
      setSnackbar({
        open: true,
        message: `❌ Error applying corrections: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setApplying(false);
    }
  };

  const handleConfirmApplyForms = async () => {
    setFormConfirmDialogOpen(false);
    setApplyingForms(true);
    try {
      const result = await applyFormCorrections(formAudit?.invalidForms || []);
      setFormCorrectionResult(result);
      setSnackbar({
        open: true,
        message: `✅ Updated ${result.formsUpdated} form(s), ${result.fieldsUpdated} field(s) normalized.`,
        severity: 'success'
      });
      await loadReport();
    } catch (error) {
      console.error('Error applying form corrections:', error);
      setSnackbar({
        open: true,
        message: `❌ Error applying form corrections: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setApplyingForms(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            🔧 KPI Score Correction Tool
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This tool identifies and corrects KPI submissions with scores exceeding the maximum of 5.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            <strong>Scoring Scale:</strong> 1-2: Critical | 2-3: Not Up to Expectations | 3-4: As Expected | 4-4.5: Shows Intention | 4.5-5: Exceeds Expectations
          </Typography>
        </Box>

        <Divider />

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4 }}>
            <CircularProgress />
            <Typography>Scanning KPI submissions...</Typography>
          </Box>
        )}

        {/* Report Summary */}
        {!loading && report && (
          <>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Submissions with Invalid Scores
                  </Typography>
                  <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {report.totalSubmissionsWithInvalidScores === 0 ? (
                      <>
                        <CheckCircleIcon sx={{ color: 'success.main' }} />
                        {report.totalSubmissionsWithInvalidScores}
                      </>
                    ) : (
                      <>
                        <ErrorIcon sx={{ color: 'error.main' }} />
                        {report.totalSubmissionsWithInvalidScores}
                      </>
                    )}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Invalid Fields
                  </Typography>
                  <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon sx={{ color: 'warning.main' }} />
                    {report.totalInvalidFieldsCount}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Highest Score Found
                  </Typography>
                  <Typography variant="h5">
                    {report.maxScoreFound > 5 ? (
                      <span style={{ color: '#d32f2f' }}>{report.maxScoreFound.toFixed(2)}</span>
                    ) : (
                      '5.0'
                    )}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Affected Mentors
                  </Typography>
                  <Typography variant="h5">{report.affectedMentors}</Typography>
                </CardContent>
              </Card>
            </Stack>

            {/* KPI Forms audit */}
            {formAudit && (
              <Card>
                <CardContent>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
                    <Box>
                      <Typography variant="h6" gutterBottom>KPI Forms Audit</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Checks for fields with more than 5 options and keys longer than 10 characters.
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Chip label={`Forms needing fixes: ${formAudit.invalidFormCount}`} color={formAudit.invalidFormCount ? 'warning' : 'success'} />
                      <Chip label={`Key fixes: ${formAudit.keyFixCount}`} color={formAudit.keyFixCount ? 'warning' : 'success'} />
                      <Chip label={`Option trims: ${formAudit.optionFixCount}`} color={formAudit.optionFixCount ? 'warning' : 'success'} />
                    </Stack>
                  </Stack>

                  {formAudit.invalidFormCount === 0 ? (
                    <Alert severity="success" sx={{ mt: 2 }}>All forms comply with the 5-option and 10-character key limits.</Alert>
                  ) : (
                    <>
                      <TableContainer sx={{ mt: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                              <TableCell>Form</TableCell>
                              <TableCell align="center">Fields with Long Keys</TableCell>
                              <TableCell align="center">Fields with &gt;5 Options</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {formAudit.invalidForms.map((form) => {
                              const longKeyCount = form.issues.filter(i => i.originalKey && i.originalKey.length > 10).length;
                              const optionCount = form.issues.filter(i => i.originalOptionsCount > 5).length;
                              return (
                                <TableRow key={form.formId}>
                                  <TableCell>{form.formName}</TableCell>
                                  <TableCell align="center">{longKeyCount}</TableCell>
                                  <TableCell align="center">{optionCount}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
                        <Button
                          variant="outlined"
                          onClick={() => setFormConfirmDialogOpen(true)}
                          disabled={applyingForms}
                        >
                          {applyingForms ? 'Applying...' : 'Apply Form Corrections'}
                        </Button>
                        <Button
                          variant="text"
                          onClick={loadReport}
                          disabled={loading || applyingForms}
                        >
                          Refresh Audit
                        </Button>
                      </Stack>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Field Distribution */}
            {report.totalSubmissionsWithInvalidScores > 0 && Object.keys(report.fieldDistribution).length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Fields with Invalid Scores
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                          <TableCell>Field Name</TableCell>
                          <TableCell align="center">Occurrences</TableCell>
                          <TableCell align="center">Max Score Found</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(report.fieldDistribution).map(([fieldName, data]) => (
                          <TableRow key={fieldName}>
                            <TableCell>{fieldName}</TableCell>
                            <TableCell align="center">
                              <Chip label={data.count} size="small" color="warning" />
                            </TableCell>
                            <TableCell align="center">
                              <Typography sx={{ color: 'error.main', fontWeight: 600 }}>
                                {data.maxScore.toFixed(2)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            {report.totalSubmissionsWithInvalidScores > 0 && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="outlined"
                  onClick={handlePreviewClick}
                  disabled={applying}
                >
                  👁️ Preview Corrections
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleApplyClick}
                  disabled={applying}
                  startIcon={applying ? <CircularProgress size={20} /> : undefined}
                >
                  {applying ? 'Applying...' : 'Apply Corrections'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={loadReport}
                  disabled={loading || applying}
                >
                  🔄 Refresh Report
                </Button>
              </Stack>
            )}

            {/* Correction Result */}
            {correctionResult && (
              <Alert severity="success">
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  ✅ Corrections Applied Successfully!
                </Typography>
                <Typography variant="body2">
                  • Submissions corrected: {correctionResult.submissionsCorrected}
                  <br />
                  • Fields fixed: {correctionResult.fieldsCorrected}
                  <br />
                  • Timestamp: {new Date(correctionResult.timestamp).toLocaleString('en-IN')}
                </Typography>
              </Alert>
            )}

            {formCorrectionResult && (
              <Alert severity="success">
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  ✅ Form Corrections Applied Successfully!
                </Typography>
                <Typography variant="body2">
                  • Forms updated: {formCorrectionResult.formsUpdated}
                  <br />
                  • Fields normalized: {formCorrectionResult.fieldsUpdated}
                  <br />
                  • Timestamp: {new Date(formCorrectionResult.timestamp).toLocaleString('en-IN')}
                </Typography>
              </Alert>
            )}
          </>
        )}

        {!loading && !report && (
          <Alert severity="error">Failed to load report. Please try again.</Alert>
        )}
      </Stack>

      {/* Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Preview Corrections</DialogTitle>
        <DialogContent dividers>
          {report && report.invalidSubmissions.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell>Mentor ID</TableCell>
                    <TableCell>KPI Type</TableCell>
                    <TableCell>Assessor</TableCell>
                    <TableCell>Fields to Fix</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.invalidSubmissions.map((submission, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontSize: '0.85rem' }}>{submission.mentorId}</TableCell>
                      <TableCell>{submission.kpiType}</TableCell>
                      <TableCell>{submission.assessorName}</TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          {submission.invalidFields.map((field, fidx) => (
                            <Typography key={fidx} variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {field.key}: {field.originalScore.toFixed(2)} → {field.correctedScore.toFixed(2)}
                            </Typography>
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.85rem' }}>{formatDate(submission.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography>No corrections to preview.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => !applying && setConfirmDialogOpen(false)}
      >
        <DialogTitle>⚠️ Confirm Corrections</DialogTitle>
        <DialogContent>
          <Typography>
            This will correct <strong>{report?.totalSubmissionsWithInvalidScores}</strong> submission(s) with{' '}
            <strong>{report?.totalInvalidFieldsCount}</strong> invalid field(s).
          </Typography>
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>
            All scores above 5 will be capped to 5. This action cannot be undone.
          </Typography>
          {applying && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography sx={{ mt: 1, fontSize: '0.85rem' }}>Applying corrections...</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)} disabled={applying}>
            Cancel
          </Button>
          <Button onClick={handleConfirmApply} variant="contained" color="error" disabled={applying}>
            {applying ? 'Processing...' : 'Confirm & Apply'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Form Corrections Confirmation */}
      <Dialog
        open={formConfirmDialogOpen}
        onClose={() => !applyingForms && setFormConfirmDialogOpen(false)}
      >
        <DialogTitle>⚠️ Confirm Form Corrections</DialogTitle>
        <DialogContent>
          <Typography>
            This will normalize <strong>{formAudit?.invalidFormCount || 0}</strong> form(s):
          </Typography>
          <Typography sx={{ mt: 1 }}>
            • Keys longer than 10 characters will be shortened and made unique
            <br />
            • Fields with more than 5 options will be trimmed to the first 5
          </Typography>
          {applyingForms && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography sx={{ mt: 1, fontSize: '0.85rem' }}>Applying form corrections...</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormConfirmDialogOpen(false)} disabled={applyingForms}>
            Cancel
          </Button>
          <Button onClick={handleConfirmApplyForms} variant="contained" color="warning" disabled={applyingForms}>
            {applyingForms ? 'Processing...' : 'Confirm & Apply'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default KpiCorrectionSeedPage;
