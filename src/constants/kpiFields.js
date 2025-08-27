// Centralized KPI field labels, field lists, and options used across forms and mentor detail
export const kpiFieldLabels = {
    // Intellect
    subjectKnowledge: 'Subject knowledge',
    materialReadiness: 'Material readiness',
    childCentricTeaching: 'Child-Centric Teaching',
    differentialMethods: 'Differential Methods / Experiential Learning',
    lessonPlanImplementation: 'Lesson Plan Implementation',
    reportQuality: 'Report Quality',
    learnersEngagement: 'Learners Engagement',
    percentageOfLearners: 'Percentage of learners engaged',
    // Cultural
    teamWork: 'Team work - Handles disagreements respectfully',
    professionalismLogin: 'Professionalism - Logs in before 8:10 AM consistently',
    professionalismGrooming: 'Professionalism - Maintains appropriate and tidy grooming',
    childSafetyHazards: 'Child Safety - Prevents hazards and addresses safety concerns',
    childSafetyEnvironment: 'Child Safety - Maintains emotionally safe environment',
    childCentricityEngagement: 'Child Centricity - Maintains meaningful engagement',
    childCentricityDevelopment: 'Child Centricity - Plans for emotional, social, and intellectual development',
    selfDevelopment: 'Self Development - Follows trends, stays updated, and adjusts',
    ethicsAndConduct: 'Ethics & Conduct - Is accountable, reliable and has integrity',
    documentation: 'Documentation - Timeliness in updating all child documentation',
    accountabilityIndependent: 'Accountability - Completes tasks independently',
    accountabilityGoals: 'Accountability - Sees tasks through to completion'
};

export const intellectFields = [
    'subjectKnowledge', 'materialReadiness', 'childCentricTeaching', 'differentialMethods',
    'lessonPlanImplementation', 'reportQuality', 'learnersEngagement', 'percentageOfLearners'
];

export const culturalFields = [
    'teamWork', 'professionalismLogin', 'professionalismGrooming', 'childSafetyHazards',
    'childSafetyEnvironment', 'childCentricityEngagement', 'childCentricityDevelopment',
    'selfDevelopment', 'ethicsAndConduct', 'documentation', 'accountabilityIndependent', 'accountabilityGoals'
];

export const defaultOptions = [
    '1 - Very Poor',
    '2 - Poor',
    '3 - Average',
    '4 - Good',
    '5 - Excellent'
];

export const intellectOptionsMap = {
    subjectKnowledge: [
        '1 - Lacks fundamentals',
        '2 - Limited understanding',
        '3 - Adequate knowledge',
        '4 - Strong subject knowledge',
        '5 - Expert and confident'
    ],
    materialReadiness: [
        '1 - Never prepared',
        '2 - Rarely prepared',
        '3 - Occasionally prepared',
        '4 - Mostly prepared',
        '5 - Always prepared and organized'
    ],
    childCentricTeaching: [
        '1 - Not child-centric',
        '2 - Shows limited child-centric practice',
        '3 - Developing child-centric approach',
        '4 - Usually child-centric',
        '5 - Consistently child-centric and responsive'
    ],
    differentialMethods: [
        '1 - No differentiated/experiential methods',
        '2 - Rarely uses varied methods',
        '3 - Uses varied methods intermittently',
        '4 - Frequently uses differentiated/experiential methods',
        '5 - Routinely applies innovative, experiential methods'
    ],
    lessonPlanImplementation: [
        '1 - Does not follow lesson plan',
        '2 - Poor implementation',
        '3 - Partially implements',
        '4 - Follows and adapts lesson plan',
        '5 - Fully implements and enhances lesson plan'
    ],
    reportQuality: [
        '1 - Poor, incomplete reports',
        '2 - Reports lack clarity/action',
        '3 - Adequate reports',
        '4 - Clear and actionable reports',
        '5 - Exemplary, timely and actionable reports'
    ],
    learnersEngagement: [
        '1 - No engagement',
        '2 - Low engagement',
        '3 - Moderate engagement',
        '4 - High engagement',
        '5 - Consistently high, active engagement'
    ],
    percentageOfLearners: [
        '1 - < 40%',
        '2 - 40% - 59%',
        '3 - 60% - 74%',
        '4 - 75% - 89%',
        '5 - >= 90%'
    ]
};

export const culturalOptionsMap = {
    teamWork: [
        '1 - Frequently causes/avoids team efforts',
        '2 - Struggles with team dynamics',
        '3 - Cooperates when required',
        '4 - Collaborates effectively',
        '5 - Leads and resolves conflicts constructively'
    ],
    professionalismLogin: [
        '1 - Frequently late',
        '2 - Often late',
        '3 - Mostly on time',
        '4 - Consistently on time',
        '5 - Always early and reliable'
    ],
    professionalismGrooming: [
        '1 - Poor grooming',
        '2 - Inconsistent grooming',
        '3 - Adequate grooming',
        '4 - Well-groomed',
        '5 - Exemplary professional appearance'
    ],
    childSafetyHazards: [
        '1 - Ignores hazards',
        '2 - Occasionally overlooks hazards',
        '3 - Addresses hazards when alerted',
        '4 - Proactively identifies hazards',
        '5 - Ensures safe environment consistently'
    ],
    childSafetyEnvironment: [
        '1 - Unsafe environment',
        '2 - Needs improvement',
        '3 - Generally safe',
        '4 - Maintains safe environment',
        '5 - Creates exemplary emotionally safe environment'
    ],
    childCentricityEngagement: [
        '1 - Not child-centric',
        '2 - Limited child-focus',
        '3 - Developing child-focus',
        '4 - Mostly child-centric',
        '5 - Fully child-centric and responsive'
    ],
    childCentricityDevelopment: [
        '1 - No developmental planning',
        '2 - Limited planning',
        '3 - Basic planning for development',
        '4 - Thoughtful planning for development',
        '5 - Comprehensive developmental planning'
    ],
    selfDevelopment: [
        '1 - No self-development',
        '2 - Rarely engages in development',
        '3 - Engages in development periodically',
        '4 - Actively pursues development',
        '5 - Continuously improves and mentors others'
    ],
    ethicsAndConduct: [
        '1 - Unreliable / breaches conduct',
        '2 - Inconsistent ethics/conduct',
        '3 - Generally ethical',
        '4 - Demonstrates high integrity',
        '5 - Exemplary ethical behaviour'
    ],
    documentation: [
        '1 - Reports missing / incomplete',
        '2 - Often incomplete',
        '3 - Adequate documentation',
        '4 - Detailed and timely',
        '5 - Exemplary, comprehensive documentation'
    ],
    accountabilityIndependent: [
        '1 - Requires constant supervision',
        '2 - Needs frequent guidance',
        '3 - Completes tasks with occasional oversight',
        '4 - Works independently',
        '5 - Proactively accountable and reliable'
    ],
    accountabilityGoals: [
        '1 - Does not meet goals',
        '2 - Rarely meets goals',
        '3 - Meets goals regularly',
        '4 - Exceeds goals',
        '5 - Consistently exceeds and sets higher goals'
    ]
};
