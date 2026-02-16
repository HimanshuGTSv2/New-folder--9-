import * as React from 'react';
import { TaskData } from './types';
import { staticTaskData } from './data';
import { DataverseService } from './DataverseService';
import { ImprovedGanttChart } from './ImprovedGanttChart';
import { IInputs } from './generated/ManifestTypes';
import GanttTimelineShimmer from './shimmerdEffect';

export interface IGanttChartProps {
  height?: string;
  width?: string;
  context: ComponentFramework.Context<IInputs>;
}

interface IGanttChartState {
  currentZoom: string;
  isLoading: boolean;
  isRefreshing: boolean; // Separate state for refresh operations                                                                     
  taskData: TaskData[];
  error: string | null;
  totalRecords: number;
  cacheStats: any;
}

export class GanttChart extends React.Component<IGanttChartProps, IGanttChartState> {
  private dataverseService: DataverseService;

  constructor(props: IGanttChartProps) {
    super(props);
    this.state = {
      currentZoom: 'Days',
      isLoading: true, // Set to true since we're loading from Dataverse
      isRefreshing: false, // Initially not refreshing                                                                                                                                                                                                      
      taskData: [],
      error: null,
      totalRecords: 0,
      cacheStats: null
    };
    
    this.dataverseService = new DataverseService(props.context);
  }

  public componentDidMount(): void {
    this.loadDataAndInitializeGantt();
  }

  public componentDidUpdate(prevProps: IGanttChartProps): void {
    // Check if projectId parameter has changed
    const currentProjectId = this.props.context.parameters.projectId?.raw;
    const previousProjectId = prevProps.context.parameters.projectId?.raw;
    
    if (currentProjectId !== previousProjectId) {
      console.log(`ProjectId changed from "${previousProjectId}" to "${currentProjectId}". Reloading data...`);
      this.loadDataAndInitializeGantt();
    }
  }

  private fixHierarchyIssues = (tasks: TaskData[]): TaskData[] => {
    console.log('=== Processing Hierarchy from Data Relationships ===');
    console.log('Raw task data sample (first 3):', tasks.slice(0, 3).map(t => ({
      id: t.taskDataId,
      name: t.taskName,
      parentTask: t.parentTask,
      isSummaryTask: t.isSummaryTask,
      taskIndex: t.taskIndex
    })));
    
    // Check what parent relationships exist in the raw data
    const tasksWithParents = tasks.filter(t => t.parentTask);
    console.log(`Tasks with parentTask field: ${tasksWithParents.length}`);
    console.log('Sample parent relationships:', tasksWithParents.slice(0, 5).map(t => ({
      id: t.taskDataId,
      name: t.taskName,
      parent: t.parentTask,
      taskIndex: t.taskIndex
    })));
    
    // Find all referenced parent IDs
    const referencedParentIds = new Set(
      tasks
        .filter(t => t.parentTask)
        .map(t => t.parentTask!)
    );
    
    // Find existing task IDs
    const existingTaskIds = new Set(tasks.map(t => t.taskDataId));
    
    // Find missing parent tasks
    const missingParentIds = Array.from(referencedParentIds).filter(
      parentId => !existingTaskIds.has(parentId)
    );
    
    console.log('Referenced parent IDs:', Array.from(referencedParentIds));
    console.log('Existing task IDs:', Array.from(existingTaskIds).slice(0, 10), '...');
    console.log('Missing parent IDs:', missingParentIds);
    
    // Instead of removing orphaned parent references, treat tasks with missing parents as root tasks
    // This ensures all tasks are kept in the hierarchy
    const cleanedTasks = tasks.map(task => {
      if (task.parentTask && missingParentIds.includes(task.parentTask)) {
        console.log(`Converting task to root (missing parent): ${task.taskName} (parent ${task.parentTask} does not exist)`);
        return { ...task, parentTask: undefined };
      }
      return task;
    });
    
    // Mark tasks that have children as summary tasks
    const updatedTasks = cleanedTasks.map(task => {
      const hasChildren = cleanedTasks.some(t => t.parentTask === task.taskDataId);
      if (hasChildren && !task.isSummaryTask) {
        console.log(`Marking task as summary: ${task.taskName} (has ${cleanedTasks.filter(t => t.parentTask === task.taskDataId).length} children)`);
        return { ...task, isSummaryTask: true };
      }
      return task;
    });
    
    console.log(`Processed hierarchy: cleaned invalid parent references, total tasks: ${updatedTasks.length}`);
    
    // Debug: Show the hierarchy structure
    const finalParentTasks = updatedTasks.filter(t => t.isSummaryTask);
    const finalChildTasks = updatedTasks.filter(t => t.parentTask);
    const finalRootTasks = updatedTasks.filter(t => !t.parentTask);
    
    console.log(`Final hierarchy structure:
      - Root tasks (no parent): ${finalRootTasks.length}
      - Summary tasks (have children): ${finalParentTasks.length}  
      - Child tasks (have parent): ${finalChildTasks.length}`);
    
    return updatedTasks;
  };

  private createDynamicHierarchy = (tasks: TaskData[]): TaskData[] => {
    console.log('Creating dynamic hierarchy based on parentTask relationships and taskIndex...');
    
    // Simply return the tasks as-is, since the hierarchy should be based on actual data relationships
    // No artificial grouping or parent creation needed
    const processedTasks = tasks.map(task => ({
      ...task,
      // Ensure isSummaryTask is properly set based on whether this task has children
      isSummaryTask: tasks.some(t => t.parentTask === task.taskDataId)
    }));
    
    console.log(`Dynamic hierarchy created:
      - Total tasks: ${processedTasks.length}
      - Summary tasks: ${processedTasks.filter(t => t.isSummaryTask).length}
      - Child tasks: ${processedTasks.filter(t => t.parentTask).length}
      - Root tasks: ${processedTasks.filter(t => !t.parentTask).length}`);
    
    return processedTasks;
  };

  private sortTasksRespectingHierarchy = (tasks: TaskData[]): TaskData[] => {
    console.log('=== Sorting Tasks Respecting Hierarchy and TaskIndex ===');
    
    // Build a map for quick parent-child lookups
    const taskMap = new Map<string, TaskData>();
    const childrenMap = new Map<string, TaskData[]>();
    
    tasks.forEach(task => {
      taskMap.set(task.taskDataId, task);
    });
    
    // Group children under their parents
    tasks.forEach(task => {
      if (task.parentTask) {
        if (!childrenMap.has(task.parentTask)) {
          childrenMap.set(task.parentTask, []);
        }
        childrenMap.get(task.parentTask)!.push(task);
      }
    });
    
    // Sort children by taskIndex for each parent
    childrenMap.forEach((children, parentId) => {
      children.sort((a, b) => {
        if (a.taskIndex !== undefined && b.taskIndex !== undefined) {
          return a.taskIndex - b.taskIndex;
        }
        return a.taskDataId.localeCompare(b.taskDataId);
      });
    });
    
    // Get root tasks (no parent) and sort them by taskIndex
    const rootTasks = tasks
      .filter(task => !task.parentTask)
      .sort((a, b) => {
        if (a.taskIndex !== undefined && b.taskIndex !== undefined) {
          return a.taskIndex - b.taskIndex;
        }
        return a.taskDataId.localeCompare(b.taskDataId);
      });
    
    // Recursively build the sorted list
    const sortedTasks: TaskData[] = [];
    
    const addTaskAndChildren = (task: TaskData) => {
      sortedTasks.push(task);
      const children = childrenMap.get(task.taskDataId) || [];
      children.forEach(child => addTaskAndChildren(child));
    };
    
    rootTasks.forEach(rootTask => addTaskAndChildren(rootTask));
    
    console.log(`Sorted ${sortedTasks.length} tasks respecting hierarchy and taskIndex`);
    console.log('First 5 sorted tasks:', sortedTasks.slice(0, 5).map(t => ({
      taskIndex: t.taskIndex,
      taskName: t.taskName,
      parentTask: t.parentTask,
      isSummaryTask: t.isSummaryTask
    })));
    
    return sortedTasks;
  };

  private loadDataAndInitializeGantt = async (): Promise<void> => {
    try {
      this.setState({ isLoading: true, error: null });
      
      // Get the projectId from the component input parameter
      const projectId = this.props.context.parameters.projectId?.raw || undefined;
      console.log('Loading data with projectId filter:', projectId);
      
      // Fetch all data at once (use large page size to get all records)
      const taskData = await this.dataverseService.fetchTaskData(false, 10000, projectId);
      
      // Fix hierarchy issues and create missing parent tasks
      const fixedTaskData = this.fixHierarchyIssues(taskData);
      
      // Sort tasks respecting hierarchy and taskIndex
      const sortedTaskData = this.sortTasksRespectingHierarchy(fixedTaskData);
      
      // Count parent vs child tasks for debugging
      const parentTasks = sortedTaskData.filter(t => t.isSummaryTask);
      const childTasks = sortedTaskData.filter(t => t.parentTask);
      const standaloneTasks = sortedTaskData.filter(t => !t.isSummaryTask && !t.parentTask);
      
      // Debug: Log the raw data structure
      console.log('=== RAW DATAVERSE DATA ===');
      console.log('First few raw records:', taskData.slice(0, 3));
      console.log('Sample task with parentTask:', taskData.find(t => t.parentTask));
      console.log('Sample task without parentTask:', taskData.find(t => !t.parentTask));
      
      console.log(`Dataverse Data Summary:
        - Total Tasks: ${sortedTaskData.length}
        - Parent/Summary Tasks: ${parentTasks.length}
        - Child Tasks: ${childTasks.length}
        - Standalone Tasks: ${standaloneTasks.length}`);
      
      console.log('Parent Tasks:', parentTasks.map(t => ({ id: t.taskDataId, name: t.taskName })));
      console.log('Child Tasks:', childTasks.map(t => ({ id: t.taskDataId, name: t.taskName, parent: t.parentTask })));
      
      // Debug: Show sorting and hierarchy information
      console.log('=== SORTING INFORMATION ===');
      console.log('First 5 tasks after sorting:', sortedTaskData.slice(0, 5).map(t => ({
        taskNumber: t.taskNumber,
        taskIndex: t.taskIndex,
        taskName: t.taskName,
        taskDataId: t.taskDataId,
        isSummaryTask: t.isSummaryTask,
        parentTask: t.parentTask
      })));
      
      const tasksWithIndex = sortedTaskData.filter(t => t.taskIndex !== undefined).length;
      console.log(`Tasks with taskIndex: ${tasksWithIndex} out of ${sortedTaskData.length}`);
      
      // Debug hierarchy structure
      console.log('=== HIERARCHY VERIFICATION ===');
      const actualParentTasks = sortedTaskData.filter(t => t.isSummaryTask);
      const actualChildTasks = sortedTaskData.filter(t => t.parentTask);
      const actualStandaloneTasks = sortedTaskData.filter(t => !t.isSummaryTask && !t.parentTask);
      
      console.log(`After processing:
        - Parent/Summary Tasks: ${actualParentTasks.length}
        - Child Tasks: ${actualChildTasks.length}
        - Standalone Tasks: ${actualStandaloneTasks.length}`);
      
      if (actualChildTasks.length > 0) {
        console.log('First 5 child tasks:', actualChildTasks.slice(0, 5).map(t => ({
          name: t.taskName,
          parent: t.parentTask
        })));
      }
      
      // Debug: Check for missing fields and successor relationships
      if (sortedTaskData.length > 0) {
        const sampleTask = sortedTaskData[0];
        console.log('Sample transformed task:', {
          id: sampleTask.taskDataId,
          name: sampleTask.taskName,
          startDate: sampleTask.startDate,
          finishDate: sampleTask.finishDate,
          isSummaryTask: sampleTask.isSummaryTask,
          parentTask: sampleTask.parentTask,
          duration: sampleTask.duration,
          progress: sampleTask.progress,
          successor: sampleTask.successor,
          successorUID: sampleTask.successorUID,
          dependencyType: sampleTask.dependencyType
        });
      }
      
      // Debug: Check for tasks with successor relationships
      const tasksWithSuccessors = sortedTaskData.filter(t => t.successor);
      console.log(`=== SUCCESSOR RELATIONSHIPS ===`);
      console.log(`Tasks with successors: ${tasksWithSuccessors.length} out of ${sortedTaskData.length}`);
      if (tasksWithSuccessors.length > 0) {
        console.log('Sample successor relationships:', tasksWithSuccessors.slice(0, 5).map(t => ({
          name: t.taskName,
          id: t.taskDataId,
          successor: t.successor,
          successorUID: t.successorUID,
          dependencyType: t.dependencyType
        })));
      }
      
      // Get cache stats
      const cacheStats = this.dataverseService.getCacheStats();
      
      this.setState({
        taskData: sortedTaskData,
        isLoading: false,
        totalRecords: sortedTaskData.length,
        cacheStats: cacheStats
      });
      
    } catch (error) {
      console.error('Error loading data from Dataverse:', error);
      this.setState({
        error: `Failed to load data from Dataverse: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isLoading: false
      });
    }
  };

  private refreshData = async (): Promise<void> => {
    try {
      this.setState({ isRefreshing: true, error: null });
      
      console.log('Refreshing data from Dataverse...');
      
      // Get the projectId from the component input parameter
      const projectId = this.props.context.parameters.projectId?.raw || undefined;
      console.log('Refreshing data with projectId filter:', projectId);
      
      // Refresh all data at once (use large page size to get all records)
      const taskData = await this.dataverseService.refreshData(10000, projectId);
      
      // Fix hierarchy issues and create missing parent tasks
      const fixedTaskData = this.fixHierarchyIssues(taskData);
      
      // Sort tasks respecting hierarchy and taskIndex
      const sortedTaskData = this.sortTasksRespectingHierarchy(fixedTaskData);
      
      // Get cache stats
      const cacheStats = this.dataverseService.getCacheStats();
      
      this.setState({
        taskData: sortedTaskData,
        isRefreshing: false,
        totalRecords: sortedTaskData.length,
        cacheStats: cacheStats
      });
      
      console.log(`Refreshed data: ${sortedTaskData.length} tasks loaded`);
    } catch (error) {
      console.error('Error refreshing data:', error);
      this.setState({
        error: `Failed to refresh data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isRefreshing: false
      });
    }
  };



  public componentWillUnmount(): void {
    // No cleanup needed for custom chart
  }

  public render(): React.ReactNode {
    const { height = '500px', width = '100%' } = this.props;
    const { isLoading, isRefreshing, error, taskData, totalRecords, cacheStats } = this.state;
    
    // Get current projectId for display
    const currentProjectId = this.props.context.parameters.projectId?.raw;

    if (isLoading) {
      return (
        <div style={{ width, height, minWidth: '1200px', overflow: 'auto' }}>
          <GanttTimelineShimmer 
            rowCount={12} 
            yearCount={4} 
            isOverlay={false}
          />
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ 
          width, 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#ffebee'
        }}>
          <div style={{ textAlign: 'center', color: '#c62828' }}>
            <div style={{ fontSize: '18px', marginBottom: '10px' }}>Error Loading Data</div>
            <div style={{ fontSize: '14px' }}>{error}</div>
            <button 
              onClick={this.loadDataAndInitializeGantt}
              style={{ 
                marginTop: '10px', 
                padding: '8px 16px', 
                border: '1px solid #c62828',
                backgroundColor: '#fff',
                color: '#c62828',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ width: '100%', height, minWidth: '1200px', overflow: 'auto' }}>
        <div style={{ 
          padding: '10px', 
          borderBottom: '1px solid #ccc',
          backgroundColor: '#f9f9f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '15px',
          flexWrap: 'wrap',
          minWidth: '1200px'
        }}>
          
          {/* Refresh Button */}
          <button
            onClick={this.refreshData}
            disabled={isRefreshing}
            style={{
              padding: '6px 12px',
              border: '1px solid #007bff',
              backgroundColor: isRefreshing ? '#f0f0f0' : '#007bff',
              color: isRefreshing ? '#999' : '#fff',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Refresh data from Dataverse"
          >
            {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        {/* Custom Gantt Chart */}
        <div style={{ 
          height: `calc(${height} - 120px)`, // Subtract space for controls and legend
          minHeight: '400px'
        }}>
          <ImprovedGanttChart 
            tasks={taskData}
            isLoading={isRefreshing} // Show shimmer overlay during refresh
            onTaskClick={(task: TaskData) => {
              console.log('Task clicked:', task.taskName);
            }}
            onExpandCollapse={(taskId: string, expanded: boolean) => {
              console.log(`Task ${taskId} ${expanded ? 'expanded' : 'collapsed'}`);
            }}
          />
        </div>
      </div>
    );
  }
}