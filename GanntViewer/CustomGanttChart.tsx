import * as React from 'react';
import { TaskData } from './types';

interface ICustomGanttProps {
  tasks: TaskData[];
  onTaskClick?: (task: TaskData) => void;
  onExpandCollapse?: (taskId: string, expanded: boolean) => void;
}

interface ICustomGanttState {
  expandedTasks: Set<string>;
  columnWidths: {
    taskName: number;
    startDate: number;
    duration: number;
    progress: number;
  };
  timelineStart: Date;
  timelineEnd: Date;
  timelineWidth: number;
  hoveredTask: string | null;
  selectedTask: string | null;
  zoomLevel: 'Day' | 'Week' | 'Month' | 'Quarter';
}

interface TaskHierarchy {
  task: TaskData;
  level: number;
  children: TaskHierarchy[];
  isVisible: boolean;
}

export class CustomGanttChart extends React.Component<ICustomGanttProps, ICustomGanttState> {
  private containerRef: React.RefObject<HTMLDivElement>;
  private timelineRef: React.RefObject<HTMLDivElement>;

  constructor(props: ICustomGanttProps) {
    super(props);
    
    this.containerRef = React.createRef();
    this.timelineRef = React.createRef();
    
    // Calculate timeline bounds
    const { timelineStart, timelineEnd } = this.calculateTimelineBounds(props.tasks);
    
    this.state = {
      expandedTasks: new Set(props.tasks.filter(t => t.isSummaryTask).map(t => t.taskDataId)),
      columnWidths: {
        taskName: 280,
        startDate: 120,
        duration: 100,
        progress: 100
      },
      timelineStart,
      timelineEnd,
      timelineWidth: 800,
      hoveredTask: null,
      selectedTask: null,
      zoomLevel: 'Month'
    };
  }

  public componentDidUpdate(prevProps: ICustomGanttProps, prevState: ICustomGanttState): void {
    // Recalculate timeline bounds when tasks change
    if (prevProps.tasks !== this.props.tasks && this.props.tasks.length > 0) {
      const { timelineStart, timelineEnd } = this.calculateTimelineBounds(this.props.tasks);
      const newWidth = this.calculateTimelineWidthByZoom();
      this.setState({ timelineStart, timelineEnd, timelineWidth: newWidth });
    }
    
    // Recalculate timeline width when zoom level changes
    if (prevState.zoomLevel !== this.state.zoomLevel) {
      const newWidth = this.calculateTimelineWidthByZoom();
      this.setState({ timelineWidth: newWidth });
    }
  }

  private calculateTimelineBounds = (tasks: TaskData[]): { timelineStart: Date; timelineEnd: Date } => {
    if (tasks.length === 0) {
      const today = new Date();
      return {
        timelineStart: today,
        timelineEnd: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
      };
    }

    let earliest = new Date(Math.min(...tasks.map(t => t.startDate.getTime())));
    let latest = new Date(Math.max(...tasks.map(t => t.finishDate.getTime())));
    
    // Add padding
    const padding = 7 * 24 * 60 * 60 * 1000; // 7 days
    earliest = new Date(earliest.getTime() - padding);
    latest = new Date(latest.getTime() + padding);
    
    return { timelineStart: earliest, timelineEnd: latest };
  };

  private calculateTimelineWidthByZoom = (): number => {
    const { timelineStart, timelineEnd, zoomLevel } = this.state;
    if (!timelineStart || !timelineEnd) return 800;
    
    const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / (24 * 60 * 60 * 1000);
    
    switch (zoomLevel) {
      case 'Day':
        return Math.max(totalDays * 40, 800); // 40px per day, minimum 800px
      case 'Week':
        return Math.max((totalDays / 7) * 100, 600); // 100px per week, minimum 600px
      case 'Month':
        return Math.max((totalDays / 30) * 120, 400); // 120px per month, minimum 400px
      case 'Quarter':
        return Math.max((totalDays / 90) * 200, 300); // 200px per quarter, minimum 300px
      default:
        return 800;
    }
  };

  private changeZoomLevel = (newZoom: 'Day' | 'Week' | 'Month' | 'Quarter'): void => {
    const newWidth = this.calculateTimelineWidthByZoom();
    this.setState({ 
      zoomLevel: newZoom, 
      timelineWidth: newWidth 
    });
  };

  private renderZoomControls = (): JSX.Element => {
    const { zoomLevel } = this.state;
    const zoomOptions: Array<'Day' | 'Week' | 'Month' | 'Quarter'> = ['Day', 'Week', 'Month', 'Quarter'];
    
    return (
      <div style={{ 
        padding: '8px 12px', 
        backgroundColor: '#f8f9fa', 
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontWeight: 'bold', marginRight: '8px' }}>View:</span>
        {zoomOptions.map(zoom => (
          <button
            key={zoom}
            onClick={() => this.changeZoomLevel(zoom)}
            style={{
              padding: '4px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: zoomLevel === zoom ? '#007bff' : 'white',
              color: zoomLevel === zoom ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: zoomLevel === zoom ? 'bold' : 'normal'
            }}
          >
            {zoom}
          </button>
        ))}
      </div>
    );
  };

  private buildHierarchy = (): TaskHierarchy[] => {
    const { tasks } = this.props;
    const { expandedTasks } = this.state;
    
    const taskMap = new Map<string, TaskData>();
    const rootTasks: TaskHierarchy[] = [];
    
    // Create task map
    tasks.forEach(task => taskMap.set(task.taskDataId, task));
    
    // Build hierarchy tree
    const buildTaskHierarchy = (task: TaskData, level: number): TaskHierarchy => {
      const children: TaskHierarchy[] = [];
      
      // Find direct children
      const directChildren = tasks.filter(t => t.parentTask === task.taskDataId);
      
      // Build children hierarchies
      directChildren.forEach(child => {
        const childHierarchy = buildTaskHierarchy(child, level + 1);
        children.push(childHierarchy);
      });
      
      return {
        task,
        level,
        children,
        isVisible: level === 0 || (task.parentTask ? expandedTasks.has(task.parentTask) : true)
      };
    };
    
    // Start with root tasks (no parent)
    const roots = tasks.filter(task => !task.parentTask);
    roots.forEach(rootTask => {
      rootTasks.push(buildTaskHierarchy(rootTask, 0));
    });
    
    return rootTasks;
  };

  private flattenHierarchy = (hierarchy: TaskHierarchy[]): TaskData[] => {
    const result: TaskData[] = [];
    
    const traverse = (items: TaskHierarchy[]) => {
      items.forEach(item => {
        if (item.isVisible) {
          // Add level information for indentation
          (item.task as any).level = item.level;
          result.push(item.task);
          
          // Add children if parent is expanded
          if (item.task.isSummaryTask && this.state.expandedTasks.has(item.task.taskDataId)) {
            traverse(item.children);
          }
        }
      });
    };
    
    traverse(hierarchy);
    return result;
  };



  private toggleExpand = (taskId: string) => {
    const { expandedTasks } = this.state;
    const newExpanded = new Set(expandedTasks);
    
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    
    this.setState({ expandedTasks: newExpanded });
    
    if (this.props.onExpandCollapse) {
      this.props.onExpandCollapse(taskId, newExpanded.has(taskId));
    }
  };



  private formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  private calculateTaskPosition = (task: TaskData): { left: number; width: number } => {
    const { timelineStart, timelineEnd, timelineWidth } = this.state;
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    
    const taskStart = task.startDate.getTime() - timelineStart.getTime();
    const taskDuration = task.finishDate.getTime() - task.startDate.getTime();
    
    const left = (taskStart / totalDuration) * timelineWidth;
    const width = Math.max((taskDuration / totalDuration) * timelineWidth, 20); // Minimum 20px width
    
    // Debug logging for the first few tasks
    if (task.taskNumber === "1" || task.taskNumber === "1.1" || task.taskNumber === "1.1.1") {
      console.log(`Timeline calculation for ${task.taskName}:`, {
        taskStart: task.startDate,
        taskFinish: task.finishDate,
        timelineStart,
        timelineEnd,
        timelineWidth,
        totalDuration,
        taskStartOffset: taskStart,
        taskDuration,
        calculatedLeft: left,
        calculatedWidth: width
      });
    }
    
    return { left, width };
  };

  private renderGridHeader = (): JSX.Element => {
    const { columnWidths } = this.state;
    
    return (
      <div className="gantt-grid-header" style={{ 
        display: 'flex', 
        backgroundColor: '#f8f9fa', 
        borderBottom: '2px solid #dee2e6',
        fontWeight: 'bold',
        padding: '8px 0'
      }}>
        <div style={{ width: columnWidths.taskName, padding: '0 8px', borderRight: '1px solid #dee2e6' }}>
          Task Name
        </div>
        <div style={{ width: columnWidths.startDate, padding: '0 8px', borderRight: '1px solid #dee2e6' }}>
          Start Date
        </div>
        <div style={{ width: columnWidths.duration, padding: '0 8px', borderRight: '1px solid #dee2e6' }}>
          Duration
        </div>
        <div style={{ width: columnWidths.progress, padding: '0 8px' }}>
          Progress
        </div>
      </div>
    );
  };

  private renderTaskRow = (task: TaskData, index: number): JSX.Element => {
    const { columnWidths, expandedTasks } = this.state;
    const level = (task as any).level || 0;
    const isExpanded = expandedTasks.has(task.taskDataId);
    const hasChildren = this.props.tasks.some(t => t.parentTask === task.taskDataId);
    
    const rowStyle: React.CSSProperties = {
      display: 'flex',
      borderBottom: '1px solid #dee2e6',
      backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
      cursor: 'pointer',
      minHeight: '32px',
      alignItems: 'center'
    };

    const taskNameStyle: React.CSSProperties = {
      width: columnWidths.taskName,
      padding: '4px 8px',
      borderRight: '1px solid #dee2e6',
      paddingLeft: 8 + (level * 20), // Indentation
      display: 'flex',
      alignItems: 'center'
    };

    return (
      <div key={task.taskDataId} style={rowStyle} onClick={() => this.props.onTaskClick?.(task)}>
        <div style={taskNameStyle}>
          {hasChildren && (
            <span 
              style={{ 
                marginRight: '8px', 
                cursor: 'pointer',
                userSelect: 'none',
                fontWeight: 'bold'
              }}
              onClick={(e) => {
                e.stopPropagation();
                this.toggleExpand(task.taskDataId);
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <span style={{ 
            fontWeight: task.isSummaryTask ? 'bold' : 'normal',
            color: task.isSummaryTask ? '#34495e' : '#495057'
          }}>
            {task.taskName}
          </span>
        </div>
        <div style={{ width: columnWidths.startDate, padding: '4px 8px', borderRight: '1px solid #dee2e6' }}>
          {this.formatDate(task.startDate)}
        </div>
        <div style={{ width: columnWidths.duration, padding: '4px 8px', borderRight: '1px solid #dee2e6' }}>
          {task.duration} days
        </div>
        <div style={{ width: columnWidths.progress, padding: '4px 8px' }}>
          {Math.round((task.progress ?? 0) * 100)}%
        </div>
      </div>
    );
  };

  private renderTimelineHeader = (): JSX.Element => {
    const { timelineStart, timelineEnd, timelineWidth, zoomLevel } = this.state;
    
    return (
      <div style={{ 
        height: '40px', 
        position: 'relative', 
        backgroundColor: '#f8f9fa',
        borderBottom: '2px solid #dee2e6',
        display: 'flex',
        alignItems: 'center'
      }}>
        {this.renderTimelineScale()}
      </div>
    );
  };

  private renderTimelineScale = (): JSX.Element[] => {
    const { timelineStart, timelineEnd, timelineWidth, zoomLevel } = this.state;
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    const elements: JSX.Element[] = [];

    switch (zoomLevel) {
      case 'Day':
        return this.renderDayScale();
      case 'Week':
        return this.renderWeekScale();
      case 'Month':
        return this.renderMonthScale();
      case 'Quarter':
        return this.renderQuarterScale();
      default:
        return this.renderMonthScale();
    }
  };

  private renderDayScale = (): JSX.Element[] => {
    const { timelineStart, timelineEnd, timelineWidth } = this.state;
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    const elements: JSX.Element[] = [];
    
    const current = new Date(timelineStart);
    let dayIndex = 0;
    
    while (current <= timelineEnd) {
      const dayStart = new Date(current);
      const dayEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      
      const dayStartOffset = dayStart.getTime() - timelineStart.getTime();
      const dayEndOffset = Math.min(dayEnd.getTime() - timelineStart.getTime(), totalDuration);
      
      if (dayEndOffset > dayStartOffset) {
        elements.push(
          <div key={dayIndex} style={{
            position: 'absolute',
            left: (dayStartOffset / totalDuration) * timelineWidth,
            width: ((dayEndOffset - dayStartOffset) / totalDuration) * timelineWidth,
            textAlign: 'center',
            fontSize: '10px',
            fontWeight: 'bold',
            borderRight: '1px solid #dee2e6',
            padding: '4px 2px'
          }}>
            {dayStart.getDate()}
            <br />
            <span style={{ fontSize: '8px' }}>
              {dayStart.toLocaleDateString('en-US', { weekday: 'short' })}
            </span>
          </div>
        );
      }
      
      current.setDate(current.getDate() + 1);
      dayIndex++;
    }
    
    return elements;
  };

  private renderWeekScale = (): JSX.Element[] => {
    const { timelineStart, timelineEnd, timelineWidth } = this.state;
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    const elements: JSX.Element[] = [];
    
    const current = new Date(timelineStart);
    // Start from the beginning of the week
    current.setDate(current.getDate() - current.getDay());
    let weekIndex = 0;
    
    while (current <= timelineEnd) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const weekStartOffset = Math.max(0, weekStart.getTime() - timelineStart.getTime());
      const weekEndOffset = Math.min(weekEnd.getTime() - timelineStart.getTime(), totalDuration);
      
      if (weekEndOffset > weekStartOffset) {
        elements.push(
          <div key={weekIndex} style={{
            position: 'absolute',
            left: (weekStartOffset / totalDuration) * timelineWidth,
            width: ((weekEndOffset - weekStartOffset) / totalDuration) * timelineWidth,
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 'bold',
            borderRight: '1px solid #dee2e6',
            padding: '4px 2px'
          }}>
            Week {Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}
            <br />
            <span style={{ fontSize: '9px' }}>
              {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        );
      }
      
      current.setDate(current.getDate() + 7);
      weekIndex++;
    }
    
    return elements;
  };

  private renderMonthScale = (): JSX.Element[] => {
    const { timelineStart, timelineEnd, timelineWidth } = this.state;
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    const elements: JSX.Element[] = [];
    
    const current = new Date(timelineStart);
    current.setDate(1); // Start of month
    let monthIndex = 0;
    
    while (current <= timelineEnd) {
      const monthStart = new Date(current);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      
      const monthStartOffset = Math.max(0, monthStart.getTime() - timelineStart.getTime());
      const monthEndOffset = Math.min(timelineEnd.getTime() - timelineStart.getTime(), 
                                     monthEnd.getTime() - timelineStart.getTime());
      
      if (monthEndOffset > monthStartOffset) {
        elements.push(
          <div key={monthIndex} style={{
            position: 'absolute',
            left: (monthStartOffset / totalDuration) * timelineWidth,
            width: ((monthEndOffset - monthStartOffset) / totalDuration) * timelineWidth,
            fontSize: '12px',
            fontWeight: 'bold',
            borderRight: '1px solid #dee2e6',
            padding: '4px 2px'
          }}>
            {monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>
        );
      }
      
      current.setMonth(current.getMonth() + 1);
      monthIndex++;
    }
    
    return elements;
  };

  private renderQuarterScale = (): JSX.Element[] => {
    const { timelineStart, timelineEnd, timelineWidth } = this.state;
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    const elements: JSX.Element[] = [];
    
    const current = new Date(timelineStart);
    // Start from the beginning of the quarter
    const quarter = Math.floor(current.getMonth() / 3);
    current.setMonth(quarter * 3);
    current.setDate(1);
    let quarterIndex = 0;
    
    while (current <= timelineEnd) {
      const quarterStart = new Date(current);
      const quarterEnd = new Date(current.getFullYear(), current.getMonth() + 3, 0);
      
      const quarterStartOffset = Math.max(0, quarterStart.getTime() - timelineStart.getTime());
      const quarterEndOffset = Math.min(quarterEnd.getTime() - timelineStart.getTime(), totalDuration);
      
      if (quarterEndOffset > quarterStartOffset) {
        const quarterNum = Math.floor(quarterStart.getMonth() / 3) + 1;
        elements.push(
          <div key={quarterIndex} style={{
            position: 'absolute',
            left: (quarterStartOffset / totalDuration) * timelineWidth,
            width: ((quarterEndOffset - quarterStartOffset) / totalDuration) * timelineWidth,
            textAlign: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            borderRight: '1px solid #dee2e6',
            padding: '4px 2px'
          }}>
            Q{quarterNum} {quarterStart.getFullYear()}
          </div>
        );
      }
      
      current.setMonth(current.getMonth() + 3);
      quarterIndex++;
    }
    
    return elements;
  };

  private renderTimelineBar = (task: TaskData, index: number): JSX.Element => {
    const { left, width } = this.calculateTaskPosition(task);
    const color = '#27ae60'; // Default green color
    
    // Debug: Log timeline bar rendering
    if (index < 3) {
      console.log(`Rendering timeline bar ${index} for ${task.taskName}:`, {
        left, 
        width, 
        startDate: task.startDate,
        finishDate: task.finishDate,
        color
      });
    }
    
    const barStyle: React.CSSProperties = {
      position: 'absolute',
      left,
      width,
      height: '20px',
      backgroundColor: task.isSummaryTask ? '#0078db' : color,
      borderRadius: '4px',
      top: '6px',
      opacity: task.isSummaryTask ? 0.8 : 0.9,
      border: task.isSummaryTask ? '1px solid #0078db' : 'none'
    };

    const progressStyle: React.CSSProperties = {
      position: 'absolute',
      left: 0,
      top: 0,
      height: '100%',
      width: `${(task.progress ?? 0) * 100}%`,
      backgroundColor: task.isSummaryTask ? '#0078db' : 'rgba(255,255,255,0.3)',
      borderRadius: '4px'
    };

    return (
      <div key={`timeline-${task.taskDataId}`} style={{
        position: 'relative',
        height: '32px',
        borderBottom: '1px solid #dee2e6',
        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
      }}>
        <div style={barStyle}>
          <div style={progressStyle}></div>
          {width > 60 && (
            <span style={{
              position: 'absolute',
              left: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'white',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              {Math.round((task.progress ?? 0) * 100)}%
            </span>
          )}
        </div>
      </div>
    );
  };

  public render(): JSX.Element {
    const hierarchy = this.buildHierarchy();
    const visibleTasks = this.flattenHierarchy(hierarchy);
    const { timelineWidth } = this.state;
    const gridWidth = Object.values(this.state.columnWidths).reduce((sum, width) => sum + width, 0);

    return (
      <div ref={this.containerRef} style={{ 
        height: '100%',
        border: '1px solid #dee2e6',
        backgroundColor: 'white'
      }}>
        {/* Zoom Controls */}
        {this.renderZoomControls()}
        
        {/* Main Content */}
        <div style={{ 
          display: 'flex', 
          height: 'calc(100% - 45px)' // Subtract zoom controls height
        }}>
          {/* Left Grid */}
        <div style={{ width: gridWidth, flexShrink: 0, borderRight: '2px solid #dee2e6' }}>
          {this.renderGridHeader()}
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {visibleTasks.map((task, index) => this.renderTaskRow(task, index))}
          </div>
        </div>
        
        {/* Right Timeline */}
        <div ref={this.timelineRef} style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ width: timelineWidth, minWidth: '100%' }}>
            {this.renderTimelineHeader()}
            <div style={{ position: 'relative' }}>
              {visibleTasks.map((task, index) => this.renderTimelineBar(task, index))}
            </div>
          </div>
        </div>
        </div> {/* Close main content container */}
      </div>
    );
  }
}