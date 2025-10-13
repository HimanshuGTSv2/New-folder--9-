import * as React from 'react';
import { TaskData } from './types';
import { projectPhases, staticTaskData } from './data';
import { DataverseService } from './DataverseService';
import { ImprovedGanttChart } from './ImprovedGanttChart';
import { IInputs } from './generated/ManifestTypes';

export interface IGanttChartProps {
  height?: string;
  width?: string;
  context: ComponentFramework.Context<IInputs>;
}

interface IGanttChartState {
  currentZoom: string;
  isLoading: boolean;                                                                        
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

  private fixHierarchyIssues = (tasks: TaskData[]): TaskData[] => {
    console.log('=== Fixing Hierarchy Issues ===');
    console.log('Raw task data sample (first 3):', tasks.slice(0, 3).map(t => ({
      id: t.taskDataId,
      name: t.taskName,
      parentTask: t.parentTask,
      isSummaryTask: t.isSummaryTask
    })));
    
    // First, let's check what parent relationships exist in the raw data
    const tasksWithParents = tasks.filter(t => t.parentTask);
    console.log(`Tasks with parentTask field: ${tasksWithParents.length}`);
    console.log('Sample parent relationships:', tasksWithParents.slice(0, 5).map(t => ({
      id: t.taskDataId,
      name: t.taskName,
      parent: t.parentTask
    })));
    
    // If no parent relationships exist in the data, let's create a logical hierarchy
    // based on task names and common patterns
    if (tasksWithParents.length === 0) {
      console.log('No parent relationships found in data. Creating logical hierarchy based on task names...');
      return this.createLogicalHierarchy(tasks);
    }
    
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
    
    // Create missing parent tasks
    const createdParents: TaskData[] = missingParentIds.map((parentId, index) => {
      console.log(`Creating missing parent task: ${parentId}`);
      
      // Try to infer parent name from children
      const children = tasks.filter(t => t.parentTask === parentId);
      let parentName = `Parent Group ${index + 1}`;
      
      if (children.length > 0) {
        // Use common prefix or pattern from children names
        const firstChildName = children[0].taskName;
        if (firstChildName.includes('Submission')) {
          parentName = firstChildName.split(' ')[0] + ' Regulatory Process';
        } else if (firstChildName.includes('Technical')) {
          parentName = 'Technical Sections';
        } else {
          parentName = `${firstChildName.split(' ')[0]} Group`;
        }
      }
      
      return {
        taskNumber: `P${index + 1}`,
        taskDataId: parentId,
        taskName: parentName,
        taskPhase: 'Planning' as const,
        startDate: new Date(),
        finishDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        projectId: children.length > 0 ? children[0].projectId : 'Default-Project',
        projectUID: children.length > 0 ? children[0].projectUID : 'default-project-uid',
        dependencyType: undefined,
        successor: undefined,
        successorUID: undefined,
        duration: 30,
        progress: 0.5,
        isSummaryTask: true,
        parentTask: undefined // These are root level parents
      };
    });
    
    // Mark tasks that have children as summary tasks
    const updatedTasks = tasks.map(task => {
      const hasChildren = tasks.some(t => t.parentTask === task.taskDataId);
      if (hasChildren && !task.isSummaryTask) {
        console.log(`Marking task as summary: ${task.taskName} (has ${tasks.filter(t => t.parentTask === task.taskDataId).length} children)`);
        return { ...task, isSummaryTask: true };
      }
      return task;
    });
    
    const result = [...createdParents, ...updatedTasks];
    console.log(`Fixed hierarchy: added ${createdParents.length} missing parents, total tasks: ${result.length}`);
    
    return result;
  };

  private createLogicalHierarchy = (tasks: TaskData[]): TaskData[] => {
    console.log('Creating logical hierarchy from task names...');
    
    // Group tasks by common patterns in their names
    const groups: { [key: string]: TaskData[] } = {};
    const standaloneItems: TaskData[] = [];
    
    // Define grouping patterns and their parent names
    const groupPatterns: { [key: string]: { pattern: RegExp, parentName: string, phase: TaskData['taskPhase'] } } = {
      'csfs': { pattern: /\d{4}\s+CSFs?/i, parentName: 'Critical Success Factors', phase: 'Planning' },
      'submission': { pattern: /(US|EU)\s+Submission/i, parentName: 'Regulatory Submissions', phase: 'Selection' },
      'studies': { pattern: /(Studies|Study)/i, parentName: 'Clinical Studies', phase: 'Execution' },
      'technical': { pattern: /Tech(nical)?\s+Section/i, parentName: 'Technical Sections', phase: 'Selection' },
      'phase': { pattern: /(Development|Registration|Submission)\s+Phase/i, parentName: 'Project Phases', phase: 'Planning' },
      'timeline': { pattern: /Timeline/i, parentName: 'Project Timelines', phase: 'Planning' },
      'gates': { pattern: /(Gate|Milestone)/i, parentName: 'Gates and Milestones', phase: 'Planning' }
    };
    
    // Group tasks based on patterns
    tasks.forEach(task => {
      let grouped = false;
      
      for (const [groupKey, { pattern, parentName }] of Object.entries(groupPatterns)) {
        if (pattern.test(task.taskName)) {
          if (!groups[groupKey]) {
            groups[groupKey] = [];
          }
          groups[groupKey].push({
            ...task,
            isSummaryTask: false, // These become child tasks
            parentTask: `parent-${groupKey}` // Assign parent ID
          });
          grouped = true;
          break;
        }
      }
      
      if (!grouped) {
        standaloneItems.push({
          ...task,
          isSummaryTask: false,
          parentTask: undefined
        });
      }
    });
    
    // Create parent tasks for each group
    const parentTasks: TaskData[] = [];
    Object.entries(groups).forEach(([groupKey, groupTasks]) => {
      if (groupTasks.length > 0) {
        const { parentName, phase } = groupPatterns[groupKey];
        
        // Calculate parent dates based on children
        const childStartDates = groupTasks.map(t => t.startDate);
        const childEndDates = groupTasks.map(t => t.finishDate);
        const parentStart = new Date(Math.min(...childStartDates.map(d => d.getTime())));
        const parentEnd = new Date(Math.max(...childEndDates.map(d => d.getTime())));
        
        parentTasks.push({
          taskNumber: `GRP-${groupKey.toUpperCase()}`,
          taskDataId: `parent-${groupKey}`,
          taskName: parentName,
          taskPhase: phase,
          startDate: parentStart,
          finishDate: parentEnd,
          projectId: groupTasks[0].projectId,
          projectUID: groupTasks[0].projectUID,
          dependencyType: undefined,
          successor: undefined,
          successorUID: undefined,
          duration: Math.round((parentEnd.getTime() - parentStart.getTime()) / (1000 * 60 * 60 * 24)),
          progress: groupTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / groupTasks.length,
          isSummaryTask: true,
          parentTask: undefined,
          taskIndex: Math.min(...groupTasks.map(t => t.taskIndex || 0))
        });
      }
    });
    
    const result = [...parentTasks, ...Object.values(groups).flat(), ...standaloneItems];
    
    console.log(`Created logical hierarchy:
      - Parent groups: ${parentTasks.length}
      - Child tasks: ${Object.values(groups).flat().length}
      - Standalone tasks: ${standaloneItems.length}
      - Total: ${result.length}`);
    
    console.log('Created parent groups:', parentTasks.map(p => p.taskName));
    
    return result;
  };

  private sortTasksForHierarchy = (tasks: TaskData[]): TaskData[] => {
    const parentTasks = tasks.filter(t => t.isSummaryTask);
    const childTasks = tasks.filter(t => t.parentTask);
    const standaloneTasks = tasks.filter(t => !t.isSummaryTask && !t.parentTask);
    
    const result: TaskData[] = [];
    
    // Add each parent followed by its children
    parentTasks.forEach(parent => {
      result.push(parent);
      const children = childTasks.filter(child => child.parentTask === parent.taskDataId);
      result.push(...children);
    });
    
    // Add standalone tasks at the end
    result.push(...standaloneTasks);
    
    return result;
  };

  private loadDataAndInitializeGantt = async (): Promise<void> => {
    try {
      this.setState({ isLoading: true, error: null });
      // Fetch all data at once (use large page size to get all records)
      const taskData = await this.dataverseService.fetchTaskData(false, 10000);
      
      // Fix hierarchy issues and create missing parent tasks
      const fixedTaskData = this.fixHierarchyIssues(taskData);
      
      // Sort tasks by taskIndex field
      const sortedTaskData = fixedTaskData.sort((a, b) => {
        // Primary sort: by taskIndex if available
        if (a.taskIndex !== undefined && b.taskIndex !== undefined) {
          return a.taskIndex - b.taskIndex;
        }
        
        // Secondary sort: by taskNumber if it contains numeric values
        const aNum = parseInt(a.taskNumber?.replace(/\D/g, '') || '0');
        const bNum = parseInt(b.taskNumber?.replace(/\D/g, '') || '0');
        
        if (aNum !== bNum) {
          return aNum - bNum;
        }
        
        // Fallback sort: by taskDataId
        return a.taskDataId.localeCompare(b.taskDataId);
      });
      
      // Count parent vs child tasks for debugging
      const parentTasks = sortedTaskData.filter(t => t.isSummaryTask);
      const childTasks = sortedTaskData.filter(t => t.parentTask);
      const standaloneTasks = sortedTaskData.filter(t => !t.isSummaryTask && !t.parentTask);
      
      // Debug: Log the raw data structure
      console.log('=== RAW DATAVERSE DATA ===');
      console.log('First few raw records:', taskData.slice(0, 3));
      
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
          phase: sampleTask.taskPhase,
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
      this.setState({ isLoading: true, error: null });
      
      console.log('Refreshing data from Dataverse...');
      // Refresh all data at once (use large page size to get all records)
      const taskData = await this.dataverseService.refreshData(10000);
      
      // Fix hierarchy issues and create missing parent tasks
      const fixedTaskData = this.fixHierarchyIssues(taskData);
      
      // Sort tasks by taskIndex field
      const sortedTaskData = fixedTaskData.sort((a, b) => {
        // Primary sort: by taskIndex if available
        if (a.taskIndex !== undefined && b.taskIndex !== undefined) {
          return a.taskIndex - b.taskIndex;
        }
        
        // Secondary sort: by taskNumber if it contains numeric values
        const aNum = parseInt(a.taskNumber?.replace(/\D/g, '') || '0');
        const bNum = parseInt(b.taskNumber?.replace(/\D/g, '') || '0');
        
        if (aNum !== bNum) {
          return aNum - bNum;
        }
        
        // Fallback sort: by taskDataId
        return a.taskDataId.localeCompare(b.taskDataId);
      });
      
      // Get cache stats
      const cacheStats = this.dataverseService.getCacheStats();
      
      this.setState({
        taskData: sortedTaskData,
        isLoading: false,
        totalRecords: sortedTaskData.length,
        cacheStats: cacheStats
      });
      
      console.log(`Refreshed data: ${sortedTaskData.length} tasks loaded`);
    } catch (error) {
      console.error('Error refreshing data:', error);
      this.setState({
        error: `Failed to refresh data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isLoading: false
      });
    }
  };



  public componentWillUnmount(): void {
    // No cleanup needed for custom chart
  }

  public render(): React.ReactNode {
    const { height = '500px', width = '100%' } = this.props;
    const { isLoading, error, taskData, totalRecords, cacheStats } = this.state;

    if (isLoading) {
      return (
        <div style={{ 
          width, 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#f5f5f5'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', marginBottom: '10px' }}>Loading All TaskData...</div>
            <div style={{ fontSize: '14px', color: '#666' }}>Fetching all records from Dataverse table sorted by index</div>
          </div>
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
        {/* Header Controls */}
        <div style={{ 
          padding: '10px', 
          borderBottom: '1px solid #ccc',
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minWidth: '1200px'
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Project Management Gantt Chart - Power Apps</span>
          
          <span style={{ marginLeft: '20px', fontSize: '12px', color: '#666' }}>
            Total Tasks: {totalRecords}
            {(() => {
              const summaryTasks = taskData.filter(t => t.isSummaryTask).length;
              const childTasks = taskData.filter(t => t.parentTask).length;
              return ` | Summary: ${summaryTasks} | Children: ${childTasks}`;
            })()}
            {cacheStats && (
              <span style={{ marginLeft: '10px', fontStyle: 'italic' }}>
                | Cache: {cacheStats.cachedPages} pages
              </span>
            )}
          </span>
          
          {/* Refresh Button */}
          <button
            onClick={this.refreshData}
            disabled={isLoading}
            style={{
              marginLeft: '10px',
              padding: '5px 10px',
              border: '1px solid #28a745',
              backgroundColor: isLoading ? '#f0f0f0' : '#28a745',
              color: isLoading ? '#999' : '#fff',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              borderRadius: '3px',
              fontSize: '12px'
            }}
            title="Refresh all data from Dataverse"
          >
            🔄 Refresh All Data
          </button>
        </div>

        {/* Phase legend */}
        <div style={{ 
          padding: '10px', 
          borderBottom: '1px solid #ccc',
          backgroundColor: '#f9f9f9',
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          flexWrap: 'wrap',
          minWidth: '1200px'
        }}>
          <span style={{ fontWeight: 'bold' }}>Phases:</span>
          {projectPhases.map(phase => (
            <div key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: phase.color,
                borderRadius: '2px'
              }}></div>
              <span style={{ fontSize: '12px' }}>{phase.name}</span>
            </div>
          ))}
        </div>

        {/* Custom Gantt Chart */}
        <div style={{ 
          height: `calc(${height} - 120px)`, // Subtract space for controls and legend
          minHeight: '400px'
        }}>
          <ImprovedGanttChart 
            tasks={taskData}
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