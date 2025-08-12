import { db } from '../firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

const mentors = [
    {
        id: 'NfmlbiYdFEy7IEuAUYvh',
        name: 'Manas',
        center: 'Whitehouse'
    },
    {
        id: 'wNmKTb7xQE80Rybx7WMu',
        name: 'Abiya',
        center: 'PHYSIS'
    }
];

const assessors = [
    {
        id: 'aCxQKxYjgWdqhCCoXn2xAsrLGeR2',
        name: 'Prerak Arya'
    },
    {
        id: 'v8b8ZZ5EDmY5R1w1VymIsLiQ7eh1',
        name: 'John Doe'
    }
];

const intellectFormFields = [
    'childCentricTeaching',
    'differentialMethods',
    'learnersEngagement',
    'lessonPlanImplementation',
    'materialReadiness',
    'percentageOfLearners',
    'reportQuality',
    'subjectKnowledge'
];

const culturalFormFields = [
    'accountabilityGoals',
    'accountabilityIndependent',
    'childCentricityDevelopment',
    'childCentricityEngagement',
    'childSafetyEnvironment',
    'childSafetyHazards',
    'documentation',
    'ethicsAndConduct',
    'professionalismGrooming',
    'professionalismLogin',
    'selfDevelopment',
    'teamWork'
];

// Function to generate random score (2-5 range, as mentors are already selected)
const getRandomScore = () => Math.floor(Math.random() * 4) + 2;

// Function to create form data
const createFormData = (fields) => {
    const form = {};
    fields.forEach(field => {
        form[field] = {
            score: getRandomScore(),
            note: "" // Keeping notes empty for simplicity
        };
    });
    return form;
};

// Function to generate date for a specific month in current academic year
const getDateForMonth = (monthIndex) => {
    const date = new Date(2025, 3 + monthIndex); // Starting from April 2025 (0-based month index)
    return Timestamp.fromDate(date);
};

// Function to create KPI submission
const createKpiSubmission = (mentorId, kpiType, monthIndex) => {
    const assessor = assessors[Math.floor(Math.random() * assessors.length)];
    const fields = kpiType === 'Intellect' ? intellectFormFields : culturalFormFields;

    return {
        mentorId,
        kpiType,
        assessorId: assessor.id,
        assessorName: assessor.name,
        createdAt: getDateForMonth(monthIndex),
        form: createFormData(fields)
    };
};

// Main seeding function
const seedKpiData = async () => {
    try {
        const kpiSubmissionsRef = collection(db, 'kpiSubmissions');
        const submissions = [];

        // Generate data for each mentor
        for (const mentor of mentors) {
            // Generate data for each month from April to current month (August)
            for (let month = 0; month <= 4; month++) { // 0 = April, 4 = August
                // Create both Intellect and Cultural KPI for each month
                submissions.push(createKpiSubmission(mentor.id, 'Intellect', month));
                submissions.push(createKpiSubmission(mentor.id, 'Cultural', month));
            }
        }

        // Add all submissions to Firestore
        for (const submission of submissions) {
            await addDoc(kpiSubmissionsRef, submission);
            console.log(`Added KPI submission for ${submission.kpiType} - ${submission.createdAt.toDate().toLocaleDateString()}`);
        }

        console.log('Seeding completed successfully!');
    } catch (error) {
        console.error('Error seeding data:', error);
    }
};

export const clearKpiData = async () => {
    // Note: This is a placeholder. In Firestore, we would need to fetch and delete documents manually
    console.log('To clear data, please use Firebase Console or implement deletion logic');
};

export default seedKpiData;
