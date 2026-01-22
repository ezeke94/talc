/**
 * KPI Correction Utilities
 * Identifies and corrects KPI entries with scores above 5
 * Based on scoring scale:
 * 1-2: Critical
 * 2-3: Not up to expectations
 * 3-4: As expected
 * 4-4.5: Shows intention
 * 4.5-5: Exceeds expectations
 */

import { db } from '../firebase/config';
import { collection, getDocs, updateDoc, doc, writeBatch, query, where } from 'firebase/firestore';

const MAX_FORM_KEY_LENGTH = 10;

const clampKeyLength = (key = '') => key.trim().slice(0, MAX_FORM_KEY_LENGTH);

const makeUniqueKey = (desiredKey, usedKeys, fallbackBase) => {
  let base = clampKeyLength(desiredKey || fallbackBase);
  if (!base) base = fallbackBase.slice(0, MAX_FORM_KEY_LENGTH);
  if (!usedKeys.has(base)) return base;

  let i = 2;
  while (true) {
    const suffix = String(i);
    const trimmed = base.slice(0, Math.max(1, MAX_FORM_KEY_LENGTH - suffix.length));
    const candidate = `${trimmed}${suffix}`;
    if (!usedKeys.has(candidate)) return candidate;
    i++;
  }
};

/**
 * Find all KPI submissions with scores above 5
 * @returns {Promise<Array>} Array of submissions with invalid scores
 */
export const findInvalidKpiScores = async () => {
  try {
    const submissionsRef = collection(db, 'kpiSubmissions');
    const snapshot = await getDocs(submissionsRef);
    
    const invalidSubmissions = [];
    
    snapshot.forEach(docSnap => {
      const submission = { id: docSnap.id, ...docSnap.data() };
      const form = submission.form || {};
      
      // Check each field's score
      let hasInvalidScore = false;
      const invalidFields = [];
      
      Object.entries(form).forEach(([fieldKey, fieldData]) => {
        if (fieldData && typeof fieldData.score === 'number') {
          if (fieldData.score > 5) {
            hasInvalidScore = true;
            invalidFields.push({
              key: fieldKey,
              originalScore: fieldData.score,
              correctedScore: Math.min(fieldData.score, 5)
            });
          }
        }
      });
      
      if (hasInvalidScore) {
        invalidSubmissions.push({
          submissionId: submission.id,
          mentorId: submission.mentorId,
          kpiType: submission.kpiType || submission.formName,
          assessorName: submission.assessorName || submission.evaluatorName || 'Unknown',
          createdAt: submission.createdAt,
          invalidFields,
          originalForm: form,
          correctedForm: correctScoresInForm(form)
        });
      }
    });
    
    return invalidSubmissions;
  } catch (error) {
    console.error('Error finding invalid KPI scores:', error);
    throw error;
  }
};

/**
 * Correct scores in a form by capping them at 5
 * @param {Object} form - The form object with field scores
 * @returns {Object} Corrected form with capped scores
 */
export const correctScoresInForm = (form) => {
  const corrected = {};
  
  Object.entries(form).forEach(([fieldKey, fieldData]) => {
    if (fieldData && typeof fieldData.score === 'number' && fieldData.score > 5) {
      corrected[fieldKey] = {
        ...fieldData,
        score: 5,
        originalScore: fieldData.score,
        correctionNote: `Auto-corrected from ${fieldData.score} to 5 on ${new Date().toISOString()}`
      };
    } else {
      corrected[fieldKey] = fieldData;
    }
  });
  
  return corrected;
};

/**
 * Apply corrections to invalid KPI submissions
 * @param {Array} submissionsToCorrect - Array of submission IDs to correct
 * @returns {Promise<Object>} Summary of corrections applied
 */
export const applyKpiCorrections = async (submissionsToCorrect) => {
  try {
    const batch = writeBatch(db);
    let correctionCount = 0;
    let fieldsCorrected = 0;
    
    for (const submissionId of submissionsToCorrect) {
      const docRef = doc(db, 'kpiSubmissions', submissionId);
      const docSnap = await getDocs(
        query(collection(db, 'kpiSubmissions'), where('__name__', '==', submissionId))
      );
      
      // Actually just update the doc directly
      const submission = await require('firebase/firestore').getDoc(docRef);
      if (submission.exists()) {
        const form = submission.data().form || {};
        const correctedForm = correctScoresInForm(form);
        
        // Count how many fields were corrected
        Object.entries(correctedForm).forEach(([key, value]) => {
          if (value.originalScore !== undefined && value.score !== value.originalScore) {
            fieldsCorrected++;
          }
        });
        
        batch.update(docRef, {
          form: correctedForm,
          correctedAt: new Date(),
          correctionApplied: true
        });
        
        correctionCount++;
      }
    }
    
    await batch.commit();
    
    return {
      success: true,
      submissionsCorrected: correctionCount,
      fieldsCorrected,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error applying KPI corrections:', error);
    throw error;
  }
};

/**
 * Apply corrections using direct doc updates (simpler approach)
 * @param {Array} invalidSubmissions - Array of invalid submissions from findInvalidKpiScores
 * @returns {Promise<Object>} Summary of corrections applied
 */
export const applyKpiCorrectionsSimple = async (invalidSubmissions) => {
  try {
    let correctionCount = 0;
    let fieldsCorrected = 0;
    const correctionDetails = [];
    
    for (const submission of invalidSubmissions) {
      const docRef = doc(db, 'kpiSubmissions', submission.submissionId);
      const correctedForm = submission.correctedForm;
      
      // Count fields corrected
      submission.invalidFields.forEach(field => {
        fieldsCorrected++;
      });
      
      await updateDoc(docRef, {
        form: correctedForm,
        correctedAt: new Date(),
        correctionApplied: true,
        correctionSummary: `Corrected ${submission.invalidFields.length} field(s) with scores > 5`
      });
      
      correctionCount++;
      correctionDetails.push({
        submissionId: submission.submissionId,
        mentor: submission.mentorId,
        fieldsFixed: submission.invalidFields.length
      });
    }
    
    return {
      success: true,
      submissionsCorrected: correctionCount,
      fieldsCorrected,
      correctionDetails,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error applying KPI corrections:', error);
    throw error;
  }
};

/**
 * Audit KPI forms for fields with too many options or overlong keys
 * @returns {Promise<Object>} Report with invalid forms and per-field corrections
 */
export const getFormAuditReport = async () => {
  const formsSnap = await getDocs(collection(db, 'kpiForms'));

  const invalidForms = [];
  let keyFixCount = 0;
  let optionFixCount = 0;

  formsSnap.forEach(docSnap => {
    const data = docSnap.data() || {};
    const fields = Array.isArray(data.fields) ? data.fields : [];
    const usedKeys = new Set();
    const correctedFields = [];
    const issues = [];
    let hasIssue = false;

    fields.forEach((field, idx) => {
      const safeOptions = Array.isArray(field.options)
        ? field.options.filter(Boolean)
        : typeof field.options === 'string'
          ? field.options.split(',').map(s => s.trim()).filter(Boolean)
          : [];

      const trimmedOptions = safeOptions.slice(0, 5);
      const optionsChanged = trimmedOptions.length !== safeOptions.length;

      const desiredKey = clampKeyLength(field.key || field.label || `field${idx + 1}`);
      const uniqueKey = makeUniqueKey(desiredKey, usedKeys, `field${idx + 1}`);
      usedKeys.add(uniqueKey);
      const keyChanged = (field.key || '').trim() !== uniqueKey;

      if (optionsChanged || keyChanged) {
        hasIssue = true;
        if (keyChanged) keyFixCount++;
        if (optionsChanged) optionFixCount++;
        issues.push({
          label: field.label || `Field ${idx + 1}`,
          originalKey: (field.key || '').trim(),
          correctedKey: uniqueKey,
          originalOptionsCount: safeOptions.length,
          correctedOptionsCount: trimmedOptions.length
        });
      }

      correctedFields.push({ ...field, key: uniqueKey, options: trimmedOptions });
    });

    if (hasIssue) {
      invalidForms.push({
        formId: docSnap.id,
        formName: data.name || docSnap.id,
        issues,
        correctedFields,
        originalFields: fields
      });
    }
  });

  return {
    totalForms: formsSnap.size,
    invalidFormCount: invalidForms.length,
    keyFixCount,
    optionFixCount,
    invalidForms
  };
};

/**
 * Apply corrections to KPI forms (options >5, keys >10 chars)
 * @param {Array} invalidForms - result from getFormAuditReport().invalidForms
 */
export const applyFormCorrections = async (invalidForms) => {
  if (!Array.isArray(invalidForms) || invalidForms.length === 0) {
    return { success: true, formsUpdated: 0, fieldsUpdated: 0 };
  }

  const batch = writeBatch(db);
  let fieldsUpdated = 0;

  invalidForms.forEach(form => {
    const docRef = doc(db, 'kpiForms', form.formId);
    const safeFields = form.correctedFields || [];
    safeFields.forEach((f, idx) => {
      const original = form.originalFields[idx] || {};
      if ((original.key || '').trim() !== (f.key || '').trim()) fieldsUpdated++;
      const originalOptions = Array.isArray(original.options)
        ? original.options.filter(Boolean)
        : typeof original.options === 'string'
          ? original.options.split(',').map(s => s.trim()).filter(Boolean)
          : [];
      if (originalOptions.length !== (Array.isArray(f.options) ? f.options.length : 0)) fieldsUpdated++;
    });

    batch.update(docRef, {
      fields: safeFields,
      formCorrectedAt: new Date(),
      formCorrectionNote: 'Normalized field keys to 10 chars and options to max 5.'
    });
  });

  await batch.commit();

  return {
    success: true,
    formsUpdated: invalidForms.length,
    fieldsUpdated,
    timestamp: new Date()
  };
};

/**
 * Generate a summary report of corrections needed
 * @returns {Promise<Object>} Report with statistics
 */
export const generateCorrectionReport = async () => {
  try {
    const invalidSubmissions = await findInvalidKpiScores();
    
    let totalInvalidFields = 0;
    let maxScoreFound = 0;
    const mentorCorrectionMap = {};
    const fieldDistribution = {};
    
    invalidSubmissions.forEach(submission => {
      submission.invalidFields.forEach(field => {
        totalInvalidFields++;
        maxScoreFound = Math.max(maxScoreFound, field.originalScore);
        
        if (!fieldDistribution[field.key]) {
          fieldDistribution[field.key] = { count: 0, maxScore: 0 };
        }
        fieldDistribution[field.key].count++;
        fieldDistribution[field.key].maxScore = Math.max(fieldDistribution[field.key].maxScore, field.originalScore);
      });
      
      if (!mentorCorrectionMap[submission.mentorId]) {
        mentorCorrectionMap[submission.mentorId] = [];
      }
      mentorCorrectionMap[submission.mentorId].push({
        kpiType: submission.kpiType,
        fieldsToFix: submission.invalidFields.length
      });
    });
    
    return {
      totalSubmissionsWithInvalidScores: invalidSubmissions.length,
      totalInvalidFieldsCount: totalInvalidFields,
      maxScoreFound,
      affectedMentors: Object.keys(mentorCorrectionMap).length,
      fieldDistribution,
      mentorCorrectionMap,
      invalidSubmissions
    };
  } catch (error) {
    console.error('Error generating correction report:', error);
    throw error;
  }
};
