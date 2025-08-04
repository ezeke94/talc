export const centers = ["PHYSIS", "Whitehouse", "Hephzi", "Harlur"];

export const mentors = [
  { name: "Saanvi Patel", center: "PHYSIS" },
  { name: "Aarav Sharma", center: "Whitehouse" },
  { name: "Diya Singh", center: "Hephzi" },
  { name: "Vivaan Gupta", center: "Harlur" },
  { name: "Ishaan Kumar", center: "PHYSIS" },
  { name: "Myra Reddy", center: "Whitehouse" },
];

// --- NEW: Sample notes for seeding ---
const sampleNotes = [
    "Consistently meets expectations in this area.",
    "Shows promising development, needs more practice.",
    "A clear area for improvement. Let's set a goal here.",
    "Exceeds expectations, a model for others.",
    "Struggled this week but is aware of the issue.",
    "Good progress since the last evaluation.",
    "Requires immediate attention and a clear action plan.",
    "" // Intentionally blank note
];

// Helper to get random items
const getRandomScore = () => Math.floor(Math.random() * 5) + 1;
const getRandomNote = () => sampleNotes[Math.floor(Math.random() * sampleNotes.length)];
const getDate = (daysAgo) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
};


// --- UPDATED: kpiSubmissions function with new data structure ---
export const kpiSubmissions = (mentorIds) => {
    let submissions = [];
    const intellectFields = ['subjectKnowledge', 'materialReadiness', 'childCentricTeaching', 'differentialMethods', 'lessonPlanImplementation', 'reportQuality', 'learnersEngagement', 'percentageOfLearners'];
    const culturalFields = ['teamWork', 'professionalismLogin', 'professionalismGrooming', 'childSafetyHazards', 'childSafetyEnvironment', 'childCentricityEngagement', 'childCentricityDevelopment', 'selfDevelopment', 'ethicsAndConduct', 'documentation', 'accountabilityIndependent', 'accountabilityGoals'];

    mentorIds.forEach((id, index) => {
        // Generate 2 Intellect KPI submissions for each mentor
        for (let i = 0; i < 2; i++) {
            const form = {};
            intellectFields.forEach(field => {
                form[field] = {
                    score: getRandomScore(),
                    note: getRandomNote()
                }
            });

            submissions.push({
                mentorId: id,
                kpiType: "Intellect",
                createdAt: getDate(i * 10 + index),
                assessorId: "seed_user",
                assessorName: "Seed Assessor",
                form: form
            });
        }
         // Generate 1 Cultural KPI submission for each mentor
        for (let i = 0; i < 1; i++) {
            const form = {};
            culturalFields.forEach(field => {
                form[field] = {
                    score: getRandomScore(),
                    note: getRandomNote()
                }
            });
            submissions.push({
                mentorId: id,
                kpiType: "Cultural",
                createdAt: getDate(i * 15 + index + 5),
                assessorId: "seed_user",
                assessorName: "Seed Assessor",
                form: form
            });
        }
    });
    return submissions;
};