// Types for TaskData based on Dataverse table structure
export interface TaskData {
  taskWBS?: string; // New field: Task WBS (Work Breakdown Structure) - Index Column (optional for backward compatibility)
  taskNumber: string;
  taskDataId: string;
  taskName: string;
  taskPhase: 'Initiation' | 'Planning' | 'Selection' | 'Execution' | 'Closure';
  startDate: Date;
  finishDate: Date;
  projectId: string;
  projectUID: string;
  dependencyType?: 'StartToStart' | 'FinishToStart' | 'FinishToFinish' | 'StartToFinish';
  successor?: string;
  successorUID?: string;
  duration?: number;
  progress?: number;
  isSummaryTask?: boolean; // New field: indicates if this is a parent/group task
  parentTask?: string; // New field: ID of the parent task (for child tasks)
  taskIndex?: number; // New field for ordering
  isMilestone?: boolean; // New field: indicates if this is a milestone task (displays as diamond)
}