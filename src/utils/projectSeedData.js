import { db } from '../firebase/config';
import { collection, addDoc, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore';

// Sample project data for seeding
export const generateProjectMockData = async () => {
  try {
    // First, fetch existing users and centers
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const centersSnapshot = await getDocs(collection(db, 'centers'));
    let centers = centersSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.id }));
    
    // If no centers exist, use default ones
    if (centers.length === 0) {
      centers = [
        { id: 'physis', name: 'PHYSIS' },
        { id: 'whitehouse', name: 'Whitehouse' },
        { id: 'hephzi', name: 'Hephzi' },
        { id: 'harlur', name: 'Harlur' }
      ];
    }

    const activeUsers = users.filter(user => user.isActive);
    
    // Helper functions
    const getRandomUsers = (count = 1) => {
      const shuffled = [...activeUsers].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, Math.min(count, activeUsers.length));
    };

    const getRandomCenter = () => centers[Math.floor(Math.random() * centers.length)];
    
    const addDays = (date, days) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

    const today = new Date();
    
    // Sample projects with realistic data
  const projects = [
      {
        name: "Q1 Curriculum Implementation",
        description: "Implement new mathematics curriculum across all centers for Q1",
        status: "In Progress",
        priority: "High",
        startDate: Timestamp.fromDate(addDays(today, -30)),
        endDate: Timestamp.fromDate(addDays(today, 60)),
        progress: 65,
        center: getRandomCenter(),
        owner: getRandomUsers(1)[0] || null,
        assignedUsers: getRandomUsers(3),
        reminderDays: 7,
        dependencies: [],
        tags: ["curriculum", "mathematics", "Q1"],
        tasks: [
          {
            id: "task-1",
            name: "Curriculum Review and Analysis",
            description: "Review existing curriculum and identify improvement areas",
            status: "Completed",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, -20)),
            completedDate: Timestamp.fromDate(addDays(today, -18)),
            priority: "High"
          },
          {
            id: "task-2", 
            name: "Training Material Preparation",
            description: "Prepare training materials for mentors",
            status: "In Progress",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 10)),
            priority: "Medium"
          },
          {
            id: "task-3",
            name: "Mentor Training Sessions",
            description: "Conduct training sessions for all mentors",
            status: "Planning",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 30)),
            priority: "High"
          },
          {
            id: "task-4",
            name: "Implementation Monitoring",
            description: "Monitor implementation progress and collect feedback",
            status: "Planning",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 50)),
            priority: "Medium"
          }
        ],
        seedTag: 'seed-demo'
      },
      {
        name: "Digital Assessment Platform",
        description: "Develop and deploy digital assessment platform for student evaluations",
        status: "Planning",
        priority: "Medium",
        startDate: Timestamp.fromDate(addDays(today, 7)),
        endDate: Timestamp.fromDate(addDays(today, 120)),
        progress: 15,
        center: getRandomCenter(),
        owner: getRandomUsers(1)[0] || null,
        assignedUsers: getRandomUsers(4),
        reminderDays: 14,
        dependencies: [],
        tags: ["technology", "assessment", "digital"],
        tasks: [
          {
            id: "task-1",
            name: "Requirements Gathering",
            description: "Collect requirements from all stakeholders",
            status: "In Progress",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 14)),
            priority: "High"
          },
          {
            id: "task-2",
            name: "Platform Design",
            description: "Design the assessment platform interface and workflow",
            status: "Planning",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 35)),
            priority: "High"
          },
          {
            id: "task-3",
            name: "Development Phase 1",
            description: "Develop core assessment features",
            status: "Planning",
            assignedTo: getRandomUsers(2)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 70)),
            priority: "High"
          }
        ],
        seedTag: 'seed-demo'
      },
      {
        name: "Mentor Performance Enhancement",
        description: "Comprehensive program to enhance mentor performance through targeted training",
        status: "Completed",
        priority: "High",
        startDate: Timestamp.fromDate(addDays(today, -90)),
        endDate: Timestamp.fromDate(addDays(today, -10)),
        progress: 100,
        center: getRandomCenter(),
        owner: getRandomUsers(1)[0] || null,
        assignedUsers: getRandomUsers(2),
        reminderDays: 7,
        dependencies: [],
        tags: ["training", "mentors", "performance"],
        tasks: [
          {
            id: "task-1",
            name: "Performance Assessment",
            description: "Assess current mentor performance levels",
            status: "Completed",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, -80)),
            completedDate: Timestamp.fromDate(addDays(today, -78)),
            priority: "High"
          },
          {
            id: "task-2",
            name: "Training Program Design",
            description: "Design targeted training programs",
            status: "Completed",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, -60)),
            completedDate: Timestamp.fromDate(addDays(today, -58)),
            priority: "Medium"
          },
          {
            id: "task-3",
            name: "Training Implementation",
            description: "Implement training programs across all centers",
            status: "Completed",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, -30)),
            completedDate: Timestamp.fromDate(addDays(today, -25)),
            priority: "High"
          },
          {
            id: "task-4",
            name: "Performance Review",
            description: "Review post-training performance improvements",
            status: "Completed",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, -15)),
            completedDate: Timestamp.fromDate(addDays(today, -12)),
            priority: "Medium"
          }
        ],
        seedTag: 'seed-demo'
      },
      {
        name: "Infrastructure Upgrade - Phase 2",
        description: "Upgrade IT infrastructure and learning resources across centers",
        status: "Planning",
        priority: "Medium",
        startDate: Timestamp.fromDate(addDays(today, 14)),
        endDate: Timestamp.fromDate(addDays(today, 150)),
        progress: 5,
        center: getRandomCenter(),
        owner: getRandomUsers(1)[0] || null,
        assignedUsers: getRandomUsers(3),
        reminderDays: 10,
        dependencies: ["Digital Assessment Platform"],
        tags: ["infrastructure", "technology", "upgrade"],
        tasks: [
          {
            id: "task-1",
            name: "Infrastructure Assessment",
            description: "Assess current infrastructure and identify upgrade needs",
            status: "Planning",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 28)),
            priority: "High"
          },
          {
            id: "task-2",
            name: "Procurement Planning",
            description: "Plan procurement of new equipment and resources",
            status: "Planning",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 50)),
            priority: "Medium"
          }
        ],
        seedTag: 'seed-demo'
      },
      {
        name: "Quality Assurance Framework",
        description: "Implement comprehensive quality assurance framework for all educational processes",
        status: "In Progress",
        priority: "High",
        startDate: Timestamp.fromDate(addDays(today, -15)),
        endDate: Timestamp.fromDate(addDays(today, 75)),
        progress: 40,
        center: getRandomCenter(),
        owner: getRandomUsers(1)[0] || null,
        assignedUsers: getRandomUsers(5),
        reminderDays: 5,
        dependencies: [],
        tags: ["quality", "framework", "processes"],
        tasks: [
          {
            id: "task-1",
            name: "Framework Design",
            description: "Design quality assurance framework and standards",
            status: "Completed",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, -5)),
            completedDate: Timestamp.fromDate(addDays(today, -3)),
            priority: "High"
          },
          {
            id: "task-2",
            name: "Process Documentation",
            description: "Document all quality assurance processes",
            status: "In Progress",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 15)),
            priority: "High"
          },
          {
            id: "task-3",
            name: "Training and Implementation",
            description: "Train staff on new quality processes and implement",
            status: "Planning",
            assignedTo: getRandomUsers(2)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 45)),
            priority: "Medium"
          }
        ]
      , seedTag: 'seed-demo'
      }
      ,{
        name: "Community Scholarship Outreach",
        description: "Launch a scholarship and outreach program to support high-potential students across centers.",
        status: "Planning",
        priority: "Medium",
        startDate: Timestamp.fromDate(addDays(today, 10)),
        endDate: Timestamp.fromDate(addDays(today, 120)),
        progress: 0,
        center: getRandomCenter(),
        owner: getRandomUsers(1)[0] || null,
        assignedUsers: getRandomUsers(3),
        reminderDays: 10,
        dependencies: [],
        tags: ["outreach", "scholarship", "community"],
        tasks: [
          {
            id: "task-1",
            name: "Define Scholarship Criteria",
            description: "Define eligibility and selection criteria for scholarships.",
            status: "Planning",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 20)),
            priority: "High"
          },
          {
            id: "task-2",
            name: "Outreach Campaign",
            description: "Plan outreach campaign to schools and community centers.",
            status: "Planning",
            assignedTo: getRandomUsers(1)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 45)),
            priority: "Medium"
          },
          {
            id: "task-3",
            name: "Application & Selection",
            description: "Collect applications and run selection process.",
            status: "Planning",
            assignedTo: getRandomUsers(2)[0] || null,
            dueDate: Timestamp.fromDate(addDays(today, 70)),
            priority: "High"
          }
        ],
        seedTag: 'seed-demo'
      }
    ];

    return projects;
  } catch (error) {
    console.error('Error generating project mock data:', error);
    return [];
  }
};

// Function to seed projects to Firebase
export const seedProjectsToFirebase = async () => {
  try {
    const projects = await generateProjectMockData();
    const projectsCollection = collection(db, 'projects');
    
    const addedProjects = [];
    
    for (const project of projects) {
      const docRef = await addDoc(projectsCollection, {
        ...project,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: {
          userId: "system",
          name: "System",
          email: "system@talc.com"
        }
      });
      
      addedProjects.push({ id: docRef.id, ...project });
      console.log(`Added project: ${project.name} with ID: ${docRef.id}`);
    }
    
    return {
      success: true,
      message: `Successfully added ${addedProjects.length} projects to Firebase`,
      projects: addedProjects
    };
    
  } catch (error) {
    console.error('Error seeding projects to Firebase:', error);
    return {
      success: false,
      message: `Error seeding projects: ${error.message}`,
      projects: []
    };
  }
};

// Helper function to get project status color
export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'planning':
      return '#ffa726'; // Orange
    case 'in progress':
      return '#42a5f5'; // Blue
    case 'completed':
      return '#66bb6a'; // Green
    case 'on hold':
      return '#ef5350'; // Red
    default:
      return '#bdbdbd'; // Grey
  }
};

// Helper function to get priority color
export const getPriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'high':
      return '#f44336'; // Red
    case 'medium':
      return '#ff9800'; // Orange
    case 'low':
      return '#4caf50'; // Green
    default:
      return '#9e9e9e'; // Grey
  }
};

// Helper function to calculate project progress based on tasks
export const calculateProjectProgress = (tasks) => {
  if (!tasks || tasks.length === 0) return 0;
  
  const completedTasks = tasks.filter(task => task.status === 'Completed').length;
  return Math.round((completedTasks / tasks.length) * 100);
};