import { TaskData } from './types';
export const projectPhases = [
  { id: 'Initiation', name: 'Initiation', color: '#FFB6C1' },  // Light Pink
  { id: 'Planning', name: 'Planning', color: '#98FB98' },      // Pale Green
  { id: 'Selection', name: 'Selection', color: '#87CEEB' },    // Sky Blue
  { id: 'Execution', name: 'Execution', color: '#DDA0DD' },    // Plum
  { id: 'Closure', name: 'Closure', color: '#F0E68C' }         // Khaki
];

// Static data with 3-level hierarchical structure: Project > Phase > Tasks
export const staticTaskData: TaskData[] = [
  // LEVEL 1: Main Project Groups
  {
    taskWBS: "1",
    taskNumber: "1",
    taskDataId: "project-phase-1",
    taskName: "General Conditions & Setup",
    taskPhase: "Planning",
    startDate: new Date('2025-01-15'),
    finishDate: new Date('2025-03-01'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: true, // Level 1 - Main project group
    parentTask: undefined, // No parent
    duration: 45,
    progress: 0.6
  },
  
  // LEVEL 2: Sub-phases under General Conditions
  {
    taskNumber: "1.1",
    taskDataId: "subphase-1-1",
    taskName: "Project Initiation Phase",
    taskPhase: "Initiation",
    startDate: new Date('2025-01-15'),
    finishDate: new Date('2025-01-29'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "subphase-1-2",
    successorUID: undefined,
    isSummaryTask: true, // Level 2 - Sub-phase group
    parentTask: "project-phase-1", // Child of General Conditions
    duration: 14,
    progress: 0.8
  },

  // LEVEL 3: Individual tasks under Project Initiation
  {
    taskNumber: "1.1.1",
    taskDataId: "task-1-1-1",
    taskName: "Receive notice to proceed",
    taskPhase: "Initiation",
    startDate: new Date('2025-01-15'),
    finishDate: new Date('2025-01-17'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "task-1-1-2",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-1-1", // Child of Project Initiation Phase
    duration: 3,
    progress: 1.0
  },
  
  {
    taskNumber: "1.1.2",
    taskDataId: "task-1-1-2",
    taskName: "Set up project team",
    taskPhase: "Initiation",
    startDate: new Date('2025-01-18'),
    finishDate: new Date('2025-01-22'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: "task-1-1-3",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-1-1", // Child of Project Initiation Phase
    duration: 5,
    progress: 0.9
  },

  {
    taskNumber: "1.1.3",
    taskDataId: "task-1-1-3",
    taskName: "Establish communication protocols",
    taskPhase: "Initiation",
    startDate: new Date('2025-01-23'),
    finishDate: new Date('2025-01-29'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-1-1", // Child of Project Initiation Phase
    duration: 7,
    progress: 0.6
  },

  // LEVEL 2: Documentation & Planning Phase
  {
    taskNumber: "1.2",
    taskDataId: "subphase-1-2",
    taskName: "Documentation & Planning Phase",
    taskPhase: "Planning",
    startDate: new Date('2025-01-30'),
    finishDate: new Date('2025-02-15'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: "subphase-1-3",
    successorUID: undefined,
    isSummaryTask: true, // Level 2 - Sub-phase group
    parentTask: "project-phase-1", // Child of General Conditions
    duration: 16,
    progress: 0.7
  },

  // LEVEL 3: Individual tasks under Documentation & Planning
  {
    taskNumber: "1.2.1",
    taskDataId: "task-1-2-1",
    taskName: "Submit bonds and insurance",
    taskPhase: "Planning",
    startDate: new Date('2025-01-30'),
    finishDate: new Date('2025-02-05'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "task-1-2-2",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-1-2", // Child of Documentation & Planning Phase
    duration: 7,
    progress: 0.8
  },

  {
    taskNumber: "1.2.2",
    taskDataId: "task-1-2-2",
    taskName: "Prepare and submit schedule",
    taskPhase: "Planning",
    startDate: new Date('2025-02-06'),
    finishDate: new Date('2025-02-12'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: "task-1-2-3",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-1-2", // Child of Documentation & Planning Phase
    duration: 7,
    progress: 0.4
  },

  {
    taskNumber: "1.2.3",
    taskDataId: "task-1-2-3",
    taskName: "Obtain necessary permits",
    taskPhase: "Planning",
    startDate: new Date('2025-02-13'),
    finishDate: new Date('2025-02-15'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-1-2", // Child of Documentation & Planning Phase
    duration: 3,
    progress: 0.2
  },

  // LEVEL 2: Final Setup Phase
  {
    taskNumber: "1.3",
    taskDataId: "subphase-1-3",
    taskName: "Final Setup & Mobilization",
    taskPhase: "Planning",
    startDate: new Date('2025-02-16'),
    finishDate: new Date('2025-03-01'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: true, // Level 2 - Sub-phase group
    parentTask: "project-phase-1", // Child of General Conditions
    duration: 14,
    progress: 0.3
  },

  // LEVEL 3: Individual tasks under Final Setup
  {
    taskNumber: "1.3.1",
    taskDataId: "task-1-3-1",
    taskName: "Site mobilization",
    taskPhase: "Planning",
    startDate: new Date('2025-02-16'),
    finishDate: new Date('2025-02-22'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "task-1-3-2",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-1-3", // Child of Final Setup Phase
    duration: 7,
    progress: 0.5
  },

  {
    taskNumber: "1.3.2",
    taskDataId: "task-1-3-2",
    taskName: "Equipment setup and testing",
    taskPhase: "Planning",
    startDate: new Date('2025-02-23'),
    finishDate: new Date('2025-03-01'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-1-3", // Child of Final Setup Phase
    duration: 7,
    progress: 0.1
  },

  // =============================================================================
  // LEVEL 1: Second Main Project Group - Procurement & Selection
  // =============================================================================
  {
    taskNumber: "2",
    taskDataId: "project-phase-2",
    taskName: "Procurement & Material Selection",
    taskPhase: "Selection",
    startDate: new Date('2025-02-01'),
    finishDate: new Date('2025-04-30'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: true, // Level 1 - Main project group
    parentTask: undefined, // No parent
    duration: 88,
    progress: 0.4
  },

  // LEVEL 2: Material Selection Phase
  {
    taskNumber: "2.1",
    taskDataId: "subphase-2-1",
    taskName: "Material Selection & Approval",
    taskPhase: "Selection",
    startDate: new Date('2025-02-01'),
    finishDate: new Date('2025-03-15'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "subphase-2-2",
    successorUID: undefined,
    isSummaryTask: true, // Level 2 - Sub-phase group
    parentTask: "project-phase-2", // Child of Procurement & Material Selection
    duration: 42,
    progress: 0.6
  },

  // LEVEL 3: Individual tasks under Material Selection
  {
    taskNumber: "2.1.1",
    taskDataId: "task-2-1-1",
    taskName: "Steel material specification",
    taskPhase: "Selection",
    startDate: new Date('2025-02-01'),
    finishDate: new Date('2025-02-14'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "task-2-1-2",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-2-1", // Child of Material Selection Phase
    duration: 14,
    progress: 0.8
  },

  {
    taskNumber: "2.1.2",
    taskDataId: "task-2-1-2",
    taskName: "Concrete grade selection",
    taskPhase: "Selection",
    startDate: new Date('2025-02-15'),
    finishDate: new Date('2025-02-28'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: "task-2-1-3",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-2-1", // Child of Material Selection Phase
    duration: 14,
    progress: 0.6
  },

  {
    taskNumber: "2.1.3",
    taskDataId: "task-2-1-3",
    taskName: "Equipment specifications finalization",
    taskPhase: "Selection",
    startDate: new Date('2025-03-01'),
    finishDate: new Date('2025-03-15'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-2-1", // Child of Material Selection Phase
    duration: 15,
    progress: 0.4
  },

  // LEVEL 2: Procurement Execution Phase
  {
    taskNumber: "2.2",
    taskDataId: "subphase-2-2",
    taskName: "Procurement Execution",
    taskPhase: "Selection",
    startDate: new Date('2025-03-16'),
    finishDate: new Date('2025-04-30'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: true, // Level 2 - Sub-phase group
    parentTask: "project-phase-2", // Child of Procurement & Material Selection
    duration: 45,
    progress: 0.2
  },

  // LEVEL 3: Individual tasks under Procurement Execution
  {
    taskNumber: "2.2.1",
    taskDataId: "task-2-2-1",
    taskName: "Steel procurement and delivery",
    taskPhase: "Selection",
    startDate: new Date('2025-03-16'),
    finishDate: new Date('2025-04-05'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "task-2-2-2",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-2-2", // Child of Procurement Execution Phase
    duration: 21,
    progress: 0.3
  },

  {
    taskNumber: "2.2.2",
    taskDataId: "task-2-2-2",
    taskName: "Concrete supplier contract",
    taskPhase: "Selection",
    startDate: new Date('2025-04-06'),
    finishDate: new Date('2025-04-20'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: "task-2-2-3",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-2-2", // Child of Procurement Execution Phase
    duration: 15,
    progress: 0.1
  },

  {
    taskNumber: "2.2.3",
    taskDataId: "task-2-2-3",
    taskName: "Equipment procurement and inspection",
    taskPhase: "Selection",
    startDate: new Date('2025-04-21'),
    finishDate: new Date('2025-04-30'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-2-2", // Child of Procurement Execution Phase
    duration: 10,
    progress: 0.0
  },

  // =============================================================================
  // LEVEL 1: Third Main Project Group - Construction Execution
  // =============================================================================
  {
    taskNumber: "3",
    taskDataId: "project-phase-3",
    taskName: "Construction Execution",
    taskPhase: "Execution",
    startDate: new Date('2025-03-01'),
    finishDate: new Date('2025-07-31'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: true, // Level 1 - Main project group
    parentTask: undefined, // No parent
    duration: 152,
    progress: 0.25
  },

  // LEVEL 2: Foundation Work Phase
  {
    taskNumber: "3.1",
    taskDataId: "subphase-3-1",
    taskName: "Foundation & Site Preparation",
    taskPhase: "Execution",
    startDate: new Date('2025-03-01'),
    finishDate: new Date('2025-05-15'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "subphase-3-2",
    successorUID: undefined,
    isSummaryTask: true, // Level 2 - Sub-phase group
    parentTask: "project-phase-3", // Child of Construction Execution
    duration: 75,
    progress: 0.4
  },

  // LEVEL 3: Individual tasks under Foundation Work
  {
    taskNumber: "3.1.1",
    taskDataId: "task-3-1-1",
    taskName: "Site grading and excavation",
    taskPhase: "Execution",
    startDate: new Date('2025-03-01'),
    finishDate: new Date('2025-03-21'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "task-3-1-2",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-3-1", // Child of Foundation & Site Preparation
    duration: 21,
    progress: 0.7
  },

  {
    taskNumber: "3.1.2",
    taskDataId: "task-3-1-2",
    taskName: "Foundation formwork and reinforcement",
    taskPhase: "Execution",
    startDate: new Date('2025-03-22'),
    finishDate: new Date('2025-04-15'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: "task-3-1-3",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-3-1", // Child of Foundation & Site Preparation
    duration: 25,
    progress: 0.3
  },

  {
    taskNumber: "3.1.3",
    taskDataId: "task-3-1-3",
    taskName: "Foundation concrete pouring and curing",
    taskPhase: "Execution",
    startDate: new Date('2025-04-16'),
    finishDate: new Date('2025-05-15'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-3-1", // Child of Foundation & Site Preparation
    duration: 30,
    progress: 0.1
  },

  // LEVEL 2: Structural Work Phase
  {
    taskNumber: "3.2",
    taskDataId: "subphase-3-2",
    taskName: "Structural Construction",
    taskPhase: "Execution",
    startDate: new Date('2025-05-16'),
    finishDate: new Date('2025-07-31'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: true, // Level 2 - Sub-phase group
    parentTask: "project-phase-3", // Child of Construction Execution
    duration: 76,
    progress: 0.1
  },

  // LEVEL 3: Individual tasks under Structural Work
  {
    taskNumber: "3.2.1",
    taskDataId: "task-3-2-1",
    taskName: "Steel frame assembly",
    taskPhase: "Execution",
    startDate: new Date('2025-05-16'),
    finishDate: new Date('2025-06-15'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "task-3-2-2",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-3-2", // Child of Structural Construction
    duration: 31,
    progress: 0.2
  },

  {
    taskNumber: "3.2.2",
    taskDataId: "task-3-2-2",
    taskName: "Roofing and exterior walls",
    taskPhase: "Execution",
    startDate: new Date('2025-06-16'),
    finishDate: new Date('2025-07-15'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: "task-3-2-3",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-3-2", // Child of Structural Construction
    duration: 30,
    progress: 0.05
  },

  {
    taskNumber: "3.2.3",
    taskDataId: "task-3-2-3",
    taskName: "Interior finishing work",
    taskPhase: "Execution",
    startDate: new Date('2025-07-16'),
    finishDate: new Date('2025-07-31'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-3-2", // Child of Structural Construction
    duration: 16,
    progress: 0.0
  },

  // =============================================================================
  // LEVEL 1: Fourth Main Project Group - Project Closure
  // =============================================================================
  {
    taskNumber: "4",
    taskDataId: "project-phase-4",
    taskName: "Project Closure & Handover",
    taskPhase: "Closure",
    startDate: new Date('2025-08-01'),
    finishDate: new Date('2025-08-31'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: true, // Level 1 - Main project group
    parentTask: undefined, // No parent
    duration: 31,
    progress: 0.0
  },

  // LEVEL 2: Testing & Inspection Phase
  {
    taskNumber: "4.1",
    taskDataId: "subphase-4-1",
    taskName: "Testing & Quality Inspection",
    taskPhase: "Closure",
    startDate: new Date('2025-08-01'),
    finishDate: new Date('2025-08-15'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "subphase-4-2",
    successorUID: undefined,
    isSummaryTask: true, // Level 2 - Sub-phase group
    parentTask: "project-phase-4", // Child of Project Closure
    duration: 15,
    progress: 0.0
  },

  // LEVEL 3: Individual tasks under Testing & Inspection
  {
    taskNumber: "4.1.1",
    taskDataId: "task-4-1-1",
    taskName: "Structural integrity testing",
    taskPhase: "Closure",
    startDate: new Date('2025-08-01'),
    finishDate: new Date('2025-08-07'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "task-4-1-2",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-4-1", // Child of Testing & Quality Inspection
    duration: 7,
    progress: 0.0
  },

  {
    taskNumber: "4.1.2",
    taskDataId: "task-4-1-2",
    taskName: "Safety systems verification",
    taskPhase: "Closure",
    startDate: new Date('2025-08-08'),
    finishDate: new Date('2025-08-15'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-4-1", // Child of Testing & Quality Inspection
    duration: 8,
    progress: 0.0
  },

  // LEVEL 2: Documentation & Handover Phase
  {
    taskNumber: "4.2",
    taskDataId: "subphase-4-2",
    taskName: "Documentation & Handover",
    taskPhase: "Closure",
    startDate: new Date('2025-08-16'),
    finishDate: new Date('2025-08-31'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: true, // Level 2 - Sub-phase group
    parentTask: "project-phase-4", // Child of Project Closure
    duration: 16,
    progress: 0.0
  },

  // LEVEL 3: Individual tasks under Documentation & Handover
  {
    taskNumber: "4.2.1",
    taskDataId: "task-4-2-1",
    taskName: "Final documentation compilation",
    taskPhase: "Closure",
    startDate: new Date('2025-08-16'),
    finishDate: new Date('2025-08-23'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: undefined,
    successor: "task-4-2-2",
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-4-2", // Child of Documentation & Handover
    duration: 8,
    progress: 0.0
  },

  {
    taskNumber: "4.2.2",
    taskDataId: "task-4-2-2",
    taskName: "Client handover and training",
    taskPhase: "Closure",
    startDate: new Date('2025-08-24'),
    finishDate: new Date('2025-08-31'),
    projectId: "PME-1301",
    projectUID: "project-uid-1",
    dependencyType: "FinishToStart",
    successor: undefined,
    successorUID: undefined,
    isSummaryTask: false, // Level 3 - Actual task
    parentTask: "subphase-4-2", // Child of Documentation & Handover
    duration: 8,
    progress: 0.0
  }
];

