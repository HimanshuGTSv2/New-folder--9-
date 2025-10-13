import * as React from 'react';
import { TaskData } from './types';

interface IImprovedGanttProps {
  tasks: TaskData[];
  onTaskClick?: (task: TaskData) => void;
  onExpandCollapse?: (taskId: string, expanded: boolean) => void;
}

interface IImprovedGanttState {
  expandedTasks: Set<string>;
  zoomLevel: 'Day' | 'Week' | 'Month' | 'Quarter';
  timelineStart: Date;
  timelineEnd: Date;
  timelineWidth: number;
  hoveredTask: string | null;
  selectedTask: string | null;
  scrollingToTask: string | null; // Track which task we're scrolling to for animation
  // Cached hierarchy to prevent rebuilding on every render
  cachedHierarchy: TaskHierarchy[] | null;
  hierarchyCacheKey: string;
  // Cached flattened hierarchy
  cachedFlatHierarchy: TaskHierarchy[] | null;
  flatHierarchyCacheKey: string;
}

interface TaskHierarchy {
  task: TaskData;
  level: number;
  children: TaskHierarchy[];
  isVisible: boolean;
}

export class ImprovedGanttChart extends React.Component<IImprovedGanttProps, IImprovedGanttState> {
  private containerRef: React.RefObject<HTMLDivElement>;
  private leftGridRef: React.RefObject<HTMLDivElement>;
  private rightTimelineRef: React.RefObject<HTMLDivElement>;
  private hoverTimeoutId: number | null = null;
  // Instance-level cache that persists across renders without triggering setState
  private hierarchyCache: TaskHierarchy[] | null = null;
  private hierarchyCacheKey: string = '';
  private flatHierarchyCache: TaskHierarchy[] | null = null;
  private flatHierarchyCacheKey: string = '';

  constructor(props: IImprovedGanttProps) {
    super(props);
    
    this.containerRef = React.createRef();
    this.leftGridRef = React.createRef();
    this.rightTimelineRef = React.createRef();
    
    const { timelineStart, timelineEnd } = this.calculateTimelineBounds(props.tasks);
    const defaultZoomLevel = 'Week';
    
    this.state = {
      expandedTasks: new Set(), // Start with all dropdowns/groups closed by default
      zoomLevel: defaultZoomLevel, // Default to Week view
      timelineStart,
      timelineEnd,
      timelineWidth: this.calculateTimelineWidthByZoom(defaultZoomLevel, timelineStart, timelineEnd),
      hoveredTask: null,
      selectedTask: null,
      scrollingToTask: null, // Track scrolling animation
      cachedHierarchy: null,
      hierarchyCacheKey: '',
      cachedFlatHierarchy: null,
      flatHierarchyCacheKey: ''
    };
  }

  public componentDidMount(): void {
    // Force a recalculation of timeline width after initial render
    // This ensures the Month view is properly sized from the start
    const { timelineStart, timelineEnd, zoomLevel } = this.state;
    const correctWidth = this.calculateTimelineWidthByZoom(zoomLevel, timelineStart, timelineEnd);
    
    if (correctWidth !== this.state.timelineWidth) {
      this.setState({ timelineWidth: correctWidth });
    }
  }

  public componentDidUpdate(prevProps: IImprovedGanttProps): void {
    if (prevProps.tasks !== this.props.tasks && this.props.tasks.length > 0) {
      const { timelineStart, timelineEnd } = this.calculateTimelineBounds(this.props.tasks);
      
      // Clear instance-level caches
      this.hierarchyCache = null;
      this.hierarchyCacheKey = '';
      this.flatHierarchyCache = null;
      this.flatHierarchyCacheKey = '';
      
      this.setState({ 
        timelineStart, 
        timelineEnd,
        timelineWidth: this.calculateTimelineWidthByZoom(this.state.zoomLevel, timelineStart, timelineEnd),
        // Clear state cache when tasks change
        cachedHierarchy: null,
        hierarchyCacheKey: '',
        cachedFlatHierarchy: null,
        flatHierarchyCacheKey: ''
      });
    }
  }

  public componentWillUnmount(): void {
    // Clear all timeouts to prevent memory leaks
    if (this.hoverTimeoutId) {
      clearTimeout(this.hoverTimeoutId);
    }
    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
    }
  }

  private generateHierarchyCacheKey = (): string => {
    const expandedTasksArray = Array.from(this.state.expandedTasks).sort();
    const tasksHash = this.props.tasks.length + '_' + this.props.tasks.map(t => t.taskDataId).join('|');
    return `${tasksHash}_${expandedTasksArray.join('|')}`;
  };

  private generateFlatHierarchyCacheKey = (hierarchies: TaskHierarchy[]): string => {
    const expandedTasksArray = Array.from(this.state.expandedTasks).sort();
    const hierarchyHash = hierarchies.map(h => h.task.taskDataId).join('|');
    return `${hierarchyHash}_${expandedTasksArray.join('|')}`;
  };

  private throttleTimeout: number | null = null;
  private readonly ENABLE_HOVER_EFFECTS = false; // Disable hover effects for better performance

  private handleMouseEnter = (taskId: string) => {
    // Skip hover effects if disabled for performance
    if (!this.ENABLE_HOVER_EFFECTS) return;
    
    // Clear any pending timeout
    if (this.hoverTimeoutId) {
      clearTimeout(this.hoverTimeoutId);
    }
    
    // Throttle mouse enter events to prevent excessive re-renders
    if (this.throttleTimeout) {
      return; // Skip this event if we're already processing one
    }
    
    // Only update state if hoveredTask is actually different
    if (this.state.hoveredTask !== taskId) {
      this.throttleTimeout = window.setTimeout(() => {
        this.setState({ hoveredTask: taskId });
        this.throttleTimeout = null;
      }, 16); // ~60fps throttling
    }
  };

  private handleMouseLeave = () => {
    // Skip hover effects if disabled for performance
    if (!this.ENABLE_HOVER_EFFECTS) return;
    
    // Clear any pending timeout
    if (this.hoverTimeoutId) {
      clearTimeout(this.hoverTimeoutId);
    }
    
    // Clear throttle timeout
    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
      this.throttleTimeout = null;
    }
    
    this.hoverTimeoutId = window.setTimeout(() => {
      if (this.state.hoveredTask !== null) {
        this.setState({ hoveredTask: null });
      }
    }, 100); // Increased delay to reduce rapid changes
  };

  private deduplicateTasks = (tasks: TaskData[]): TaskData[] => {
    const uniqueTasks = new Map<string, TaskData>();
    const DEBUG_ENABLED = false; // Set to true for debugging
    
    tasks.forEach(task => {
      if (!uniqueTasks.has(task.taskDataId)) {
        uniqueTasks.set(task.taskDataId, task);
      } else if (DEBUG_ENABLED) {
        console.warn(`Duplicate task ID found: ${task.taskDataId} (${task.taskName})`);
      }
    });
    
    const result = Array.from(uniqueTasks.values());
    if (DEBUG_ENABLED) {
      console.log(`Deduplicated tasks: ${tasks.length} -> ${result.length}`);
    }
    return result;
  };

  private calculateTimelineBounds = (tasks: TaskData[]): { timelineStart: Date; timelineEnd: Date } => {
    if (tasks.length === 0) {
      const today = new Date();
      return {
        timelineStart: today,
        timelineEnd: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      };
    }

    let earliest = new Date(Math.min(...tasks.map(t => t.startDate.getTime())));
    let latest = new Date(Math.max(...tasks.map(t => t.finishDate.getTime())));
    
    const padding = 7 * 24 * 60 * 60 * 1000; // 7 days
    earliest = new Date(earliest.getTime() - padding);
    latest = new Date(latest.getTime() + padding);
    
    return { timelineStart: earliest, timelineEnd: latest };
  };

  private calculateTimelineWidthByZoom = (zoomLevel: string, start: Date, end: Date): number => {
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    
    switch (zoomLevel) {
      case 'Day': return totalDays * 30; // 30px per day
      case 'Week': return Math.ceil(totalDays / 7) * 100; // 100px per week
      case 'Month': return Math.ceil(totalDays / 30) * 120; // 120px per month
      case 'Quarter': return Math.ceil(totalDays / 90) * 150; // 150px per quarter
      default: return 1200;
    }
  };

  private changeZoomLevel = (newZoom: 'Day' | 'Week' | 'Month' | 'Quarter') => {
    const { timelineStart, timelineEnd } = this.state;
    const newWidth = this.calculateTimelineWidthByZoom(newZoom, timelineStart, timelineEnd);
    
    this.setState({ 
      zoomLevel: newZoom,
      timelineWidth: newWidth
    });
  };

  private syncScrollLeft = (scrollTop: number) => {
    if (this.rightTimelineRef.current && this.rightTimelineRef.current.scrollTop !== scrollTop) {
      this.rightTimelineRef.current.scrollTop = scrollTop;
    }
  };

  private syncScrollRight = (scrollTop: number) => {
    if (this.leftGridRef.current && this.leftGridRef.current.scrollTop !== scrollTop) {
      this.leftGridRef.current.scrollTop = scrollTop;
    }
  };

  private syncTimelineHeaderScroll = (scrollLeft: number): void => {
    const headerContainer = document.getElementById('timeline-header-container');
    if (headerContainer && Math.abs(headerContainer.scrollLeft - scrollLeft) > 1) {
      // Use smooth scrolling for header sync when called from scrollToTask
      headerContainer.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      });
    }
  };

  private scrollToTask = (task: TaskData, taskIndex: number): void => {
    const rowHeight = 36;
    const taskPosition = this.calculateTaskPosition(task);
    
    // Get container dimensions
    const leftContainer = this.leftGridRef.current;
    const rightContainer = this.rightTimelineRef.current;
    
    if (!leftContainer || !rightContainer) return;
    
    // Set scrolling animation state for visual feedback
    this.setState({ scrollingToTask: task.taskDataId });
    
    const containerHeight = rightContainer.clientHeight;
    const containerWidth = rightContainer.clientWidth;
    
    // Calculate vertical scroll position (center the task row in the viewport)
    const taskRowTop = taskIndex * rowHeight;
    const targetVerticalScroll = Math.max(0, taskRowTop - (containerHeight / 2) + (rowHeight / 2));
    
    // Calculate horizontal scroll position (center the task bar in the viewport)
    const taskStartX = taskPosition.left;
    const taskEndX = taskPosition.left + taskPosition.width;
    const taskCenterX = taskStartX + (taskPosition.width / 2);
    
    // Center the task horizontally in the viewport
    let targetHorizontalScroll = Math.max(0, taskCenterX - (containerWidth / 2));
    
    // Ensure we don't scroll past the beginning
    targetHorizontalScroll = Math.max(0, targetHorizontalScroll);
    
    // If the task is very wide, prioritize showing the start of the task
    if (taskPosition.width > containerWidth * 0.8) {
      targetHorizontalScroll = Math.max(0, taskStartX - containerWidth * 0.1); // Show task start with 10% padding
    }
    
    // Add enhanced visual effects to the timeline bar and task row
    const timelineBar = rightContainer.querySelector(`[data-task-timeline-id="${task.taskDataId}"]`) as HTMLElement;
    const taskRow = leftContainer.querySelector(`[data-task-id="${task.taskDataId}"]`) as HTMLElement;
    
    if (timelineBar) {
      timelineBar.classList.add('gantt-timeline-highlight');
      timelineBar.style.animation = 'pulse 1s ease-in-out, glow 1.5s ease-in-out';
    }
    
    if (taskRow) {
      taskRow.classList.add('gantt-row-highlight');
    }
    
    // Smooth scroll with enhanced easing
    const scrollOptions: ScrollToOptions = {
      behavior: 'smooth'
    };
    
    // Scroll both containers with smooth animation
    leftContainer.scrollTo({
      top: targetVerticalScroll,
      ...scrollOptions
    });
    
    rightContainer.scrollTo({
      top: targetVerticalScroll,
      left: targetHorizontalScroll,
      ...scrollOptions
    });
    
    // Smoothly sync the header scroll with a slight delay for better visual effect
    setTimeout(() => {
      this.syncTimelineHeaderScroll(targetHorizontalScroll);
    }, 50);
    
    // Clear scrolling animation state and remove highlight effects after animation completes
    setTimeout(() => {
      this.setState({ scrollingToTask: null });
      if (timelineBar) {
        timelineBar.classList.remove('gantt-timeline-highlight');
        timelineBar.style.animation = '';
      }
      if (taskRow) {
        taskRow.classList.remove('gantt-row-highlight');
      }
    }, 1500); // Extended to allow for all animations to complete
    
    console.log(`Scrolling to task: ${task.taskName} at row ${taskIndex}
      - Vertical: ${targetVerticalScroll} (centered in ${containerHeight}px container)
      - Horizontal: ${targetHorizontalScroll} (task center: ${taskCenterX}, container width: ${containerWidth})`);
  };

  private buildHierarchy = (): TaskHierarchy[] => {
    const currentCacheKey = this.generateHierarchyCacheKey();
    
    // Return cached hierarchy if cache key hasn't changed (instance-level cache)
    if (this.hierarchyCache && this.hierarchyCacheKey === currentCacheKey) {
      return this.hierarchyCache;
    }
    
    // First, deduplicate tasks to remove duplicates
    const uniqueTasks = this.deduplicateTasks(this.props.tasks);
    
    const DEBUG_ENABLED = false; // Set to true for debugging
    
    if (DEBUG_ENABLED) {
      console.log('=== Building Hierarchy (Cache Miss) ===');
      console.log('Original tasks:', this.props.tasks.length, 'Unique tasks:', uniqueTasks.length);
      
      // Debug: Show parent-child relationships
      const rootTasks = uniqueTasks.filter(t => !t.parentTask);
      console.log('Root tasks (no parent):', rootTasks.map(t => ({ id: t.taskDataId, name: t.taskName })));
      
      const childTasks = uniqueTasks.filter(t => t.parentTask);
      console.log('Child tasks:', childTasks.map(t => ({ 
        id: t.taskDataId, 
        name: t.taskName, 
        parentId: t.parentTask 
      })));
    }
    
    const rootTasks = uniqueTasks.filter(t => !t.parentTask);
    
    const taskMap = new Map<string, TaskData>();
    uniqueTasks.forEach(task => taskMap.set(task.taskDataId, task));
    
    const buildTaskHierarchy = (task: TaskData, level: number): TaskHierarchy => {
      const children: TaskHierarchy[] = [];
      const directChildren = uniqueTasks.filter(t => t.parentTask === task.taskDataId);
      
      if (DEBUG_ENABLED) {
        console.log(`Building hierarchy for ${task.taskName} (${task.taskDataId}), found ${directChildren.length} children`);
      }
      
      directChildren.forEach(child => {
        children.push(buildTaskHierarchy(child, level + 1));
      });
      
      return {
        task,
        level,
        children,
        isVisible: true
      };
    };
    
    const result = rootTasks.map(task => buildTaskHierarchy(task, 0));
    
    // Update instance-level cache (no setState, no re-render)
    this.hierarchyCache = result;
    this.hierarchyCacheKey = currentCacheKey;
    
    if (DEBUG_ENABLED) {
      console.log('=== Hierarchy Built and Cached ===');
    }
    return result;
  };

  private flattenHierarchy = (hierarchies: TaskHierarchy[]): TaskHierarchy[] => {
    const currentCacheKey = this.generateFlatHierarchyCacheKey(hierarchies);
    
    // Return cached flattened hierarchy if cache key hasn't changed
    if (this.flatHierarchyCache && this.flatHierarchyCacheKey === currentCacheKey) {
      return this.flatHierarchyCache;
    }
    
    const result: TaskHierarchy[] = [];
    const DEBUG_ENABLED = false; // Set to true for debugging
    
    if (DEBUG_ENABLED) {
      console.log('=== Flattening Hierarchy ===');
      console.log('Input hierarchies count:', hierarchies.length);
      console.log('Expanded tasks:', Array.from(this.state.expandedTasks));
    }
    
    const traverse = (hierarchy: TaskHierarchy, depth: number = 0) => {
      if (DEBUG_ENABLED) {
        console.log(`${'  '.repeat(depth)}Adding: ${hierarchy.task.taskName} (${hierarchy.task.taskDataId}) level=${hierarchy.level}`);
      }
      
      // Always add the current task
      result.push(hierarchy);
      
      // Only add children if the current task is expanded
      if (this.state.expandedTasks.has(hierarchy.task.taskDataId) && hierarchy.children.length > 0) {
        if (DEBUG_ENABLED) {
          console.log(`${'  '.repeat(depth)}Expanding ${hierarchy.task.taskName}, has ${hierarchy.children.length} children`);
        }
        hierarchy.children.forEach(child => traverse(child, depth + 1));
      }
    };
    
    hierarchies.forEach(hierarchy => traverse(hierarchy));
    
    // Update instance-level cache
    this.flatHierarchyCache = result;
    this.flatHierarchyCacheKey = currentCacheKey;
    
    if (DEBUG_ENABLED) {
      console.log('=== Final flattened result ===');
      console.log('Total visible tasks:', result.length);
      result.forEach((item, index) => {
        console.log(`${index}: ${item.task.taskName} (${item.task.taskDataId}) level=${item.level}`);
      });
    }
    
    return result;
  };

  private toggleExpand = (taskId: string) => {
    const { expandedTasks } = this.state;
    const { tasks } = this.props;
    const newExpanded = new Set(expandedTasks);
    
    const DEBUG_ENABLED = false; // Set to true for debugging
    
    if (DEBUG_ENABLED) {
      console.log(`Toggle expand for ${taskId}, currently expanded:`, expandedTasks.has(taskId));
    }
    
    if (newExpanded.has(taskId)) {
      // Collapsing: remove this task and ALL its descendants from expanded set
      newExpanded.delete(taskId);
      
      // Recursively collapse all descendants
      const collapseDescendants = (parentId: string) => {
        const children = tasks.filter(t => t.parentTask === parentId);
        children.forEach(child => {
          if (DEBUG_ENABLED) {
            console.log(`Collapsing descendant: ${child.taskDataId}`);
          }
          newExpanded.delete(child.taskDataId);
          collapseDescendants(child.taskDataId); // Recursive collapse
        });
      };
      
      collapseDescendants(taskId);
    } else {
      // Expanding: just add this task to expanded set
      newExpanded.add(taskId);
    }
    
    if (DEBUG_ENABLED) {
      console.log('New expanded tasks:', Array.from(newExpanded));
    }
    
    // Clear instance-level caches
    this.hierarchyCache = null;
    this.hierarchyCacheKey = '';
    this.flatHierarchyCache = null;
    this.flatHierarchyCacheKey = '';
    
    this.setState({ 
      expandedTasks: newExpanded,
      // Clear state cache when expand state changes
      cachedHierarchy: null,
      hierarchyCacheKey: '',
      cachedFlatHierarchy: null,
      flatHierarchyCacheKey: ''
    });
    
    if (this.props.onExpandCollapse) {
      this.props.onExpandCollapse(taskId, newExpanded.has(taskId));
    }
  };

  private getPhaseColor = (phase: string): string => {
    switch (phase.toLowerCase()) {
      case 'initiation': return '#3498db';
      case 'planning': return '#e74c3c';
      case 'selection': return '#f39c12';
      case 'execution': return '#27ae60';
      case 'closure': return '#9b59b6';
      default: return '#95a5a6';
    }
  };

  private calculateTaskPosition = (task: TaskData): { left: number; width: number } => {
    const { timelineStart, timelineEnd, timelineWidth } = this.state;
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    
    const taskStart = task.startDate.getTime() - timelineStart.getTime();
    const taskDuration = task.finishDate.getTime() - task.startDate.getTime();
    
    const left = (taskStart / totalDuration) * timelineWidth;
    const width = Math.max((taskDuration / totalDuration) * timelineWidth, 20);
    
    return { left, width };
  };

  private formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  private getDisplayTaskName = (taskName: string, availableWidth: number): string => {
    // Calculate approximate character width (rough estimate)
    const charWidth = 7; // pixels per character for the font size used
    const maxChars = Math.floor((availableWidth - 12) / charWidth); // subtract padding
    
    if (taskName.length <= maxChars) {
      return taskName;
    }
    
    // Truncate and add ellipsis
    return taskName.substring(0, Math.max(0, maxChars - 3)) + '...';
  };

  private renderZoomControls = (): JSX.Element => {
    const { zoomLevel } = this.state;
    const zoomOptions: ('Day' | 'Week' | 'Month' | 'Quarter')[] = ['Day', 'Week', 'Month', 'Quarter'];
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        fontSize: '14px'
      }}>
        <span style={{ fontWeight: 'bold', marginRight: '8px' }}>View:</span>
        {zoomOptions.map(zoom => (
          <button
            key={zoom}
            onClick={() => this.changeZoomLevel(zoom)}
            style={{
              padding: '6px 16px',
              border: '1px solid #007bff',
              borderRadius: '4px',
              backgroundColor: zoomLevel === zoom ? '#007bff' : 'white',
              color: zoomLevel === zoom ? 'white' : '#007bff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            {zoom}
          </button>
        ))}
      </div>
    );
  };

  private renderTimelineHeader = (): JSX.Element => {
    const { timelineStart, timelineEnd, timelineWidth, zoomLevel } = this.state;
    
    const headerHeight = 40;
    const cellStyle: React.CSSProperties = {
      textAlign: 'center',
      fontSize: '12px',
      fontWeight: 'bold',
      color: '#495057',
      borderRight: '1px solid #dee2e6',
      borderBottom: '1px solid #dee2e6',
      backgroundColor: '#f8f9fa'
    };

    if (zoomLevel === 'Day') {
      const days: JSX.Element[] = [];
      const current = new Date(timelineStart);
      const cellWidth = 30;
      
      while (current <= timelineEnd) {
        const dayNum = current.getDate();
        const month = current.toLocaleDateString('en-US', { month: 'short' });
        
        days.push(
          <div key={current.toISOString()} style={{
            ...cellStyle,
            width: cellWidth,
            height: `${headerHeight - 1}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div>{month}</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{dayNum}</div>
          </div>
        );
        
        current.setDate(current.getDate() + 1);
      }
      
      return (
        <div style={{ 
          display: 'flex', 
          height: headerHeight,
          backgroundColor: '#f8f9fa',
          borderBottom: '2px solid #007bff'
        }}>
          {days}
        </div>
      );
    }
    
    if (zoomLevel === 'Week') {
      const weeks: JSX.Element[] = [];
      const current = new Date(timelineStart);
      const cellWidth = 100;
      
      // Start from beginning of week
      current.setDate(current.getDate() - current.getDay());
      
      while (current <= timelineEnd) {
        const weekStart = new Date(current);
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        weeks.push(
          <div key={current.toISOString()} style={{
            ...cellStyle,
            width: cellWidth,
            height: headerHeight,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '11px' }}>
              {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
              {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div style={{ fontSize: '10px', color: '#6c757d' }}>
              Week {Math.ceil((current.getTime() - new Date(current.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}
            </div>
          </div>
        );
        
        current.setDate(current.getDate() + 7);
      }
      
      return (
        <div style={{ 
          display: 'flex', 
          height: headerHeight,
          backgroundColor: '#f8f9fa',
          borderBottom: '2px solid #007bff'
        }}>
          {weeks}
        </div>
      );
    }
    
    if (zoomLevel === 'Month') {
      const months: JSX.Element[] = [];
      const current = new Date(timelineStart.getFullYear(), timelineStart.getMonth(), 1);
      const cellWidth = 120;
      
      while (current <= timelineEnd) {
        const monthName = current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        months.push(
          <div key={current.toISOString()} style={{
            ...cellStyle,
            width: cellWidth,
            height: headerHeight,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {monthName}
          </div>
        );
        
        current.setMonth(current.getMonth() + 1);
      }
      
      return (
        <div style={{ 
          display: 'flex', 
          height: headerHeight,
          backgroundColor: '#f8f9fa',
          borderBottom: '2px solid #007bff'
        }}>
          {months}
        </div>
      );
    }
    
    // Quarter view
    const quarters: JSX.Element[] = [];
    const current = new Date(timelineStart.getFullYear(), Math.floor(timelineStart.getMonth() / 3) * 3, 1);
    const cellWidth = 150;
    
    while (current <= timelineEnd) {
      const quarter = Math.floor(current.getMonth() / 3) + 1;
      const year = current.getFullYear();
      
      quarters.push(
        <div key={current.toISOString()} style={{
          ...cellStyle,
          width: cellWidth,
          height: headerHeight,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          Q{quarter} {year}
        </div>
      );
      
      current.setMonth(current.getMonth() + 3);
    }
    
    return (
      <div style={{ 
        display: 'flex', 
        height: headerHeight,
        backgroundColor: '#f8f9fa',
        borderBottom: '2px solid #007bff'
      }}>
        {quarters}
      </div>
    );
  };

  private renderDependencyLines = (tasks: TaskHierarchy[]): JSX.Element => {
    const DEBUG_DEPENDENCIES = false; // Set to true for debugging dependency lines
    
    // Create a map for quick lookup of task index in the flattened visible list
    const taskIndexMap = new Map<string, number>();
    tasks.forEach((taskHierarchy, index) => {
      taskIndexMap.set(taskHierarchy.task.taskDataId, index);
      // Also map by task number for flexibility
      taskIndexMap.set(taskHierarchy.task.taskNumber, index);
    });
    
    if (DEBUG_DEPENDENCIES) {
      console.log('=== Dependency Analysis ===');
      console.log('Visible tasks with successors:');
      tasks.forEach((th, idx) => {
        if (th.task.successor) {
          console.log(`${idx}: ${th.task.taskName} (${th.task.taskDataId}) -> successor: ${th.task.successor}`);
          const successorExists = taskIndexMap.has(th.task.successor);
          console.log(`  Successor found in visible tasks: ${successorExists}`);
        }
      });
    }

    const paths: JSX.Element[] = [];
    
    tasks.forEach((taskHierarchy, index) => {
      const task = taskHierarchy.task;
      
      if (task.successor) {
        // Find successor task in the flattened visible tasks
        const successorIndex = taskIndexMap.get(task.successor);
        const successorTaskHierarchy = successorIndex !== undefined ? tasks[successorIndex] : null;
        
        if (successorTaskHierarchy && successorIndex !== undefined) {
          const successorTask = successorTaskHierarchy.task;
          const taskPos = this.calculateTaskPosition(task);
          const successorPos = this.calculateTaskPosition(successorTask);
          
          const startX = taskPos.left + taskPos.width;
          const startY = (index * 36) + 18; // Row height * index + half row (36/2 = 18)
          const endX = successorPos.left;
          const endY = (successorIndex * 36) + 18; // Use correct successor row position
          
          // Skip drawing if positions are invalid
          if (startX < 0 || endX < 0) {
            return;
          }
          
          if (DEBUG_DEPENDENCIES) {
            console.log(`Drawing dependency: ${task.taskName} -> ${successorTask.taskName}`);
            console.log(`  Positions: (${startX}, ${startY}) -> (${endX}, ${endY})`);
          }
          
          // Create clean MS Project-style dependency line
          const arrowSize = 4;
          const lineColor = '#2c5aa0';
          const gap = 8; // Gap from task bar to line start
          
          // Calculate clean L-shaped path like MS Project
          let pathD: string;
          
          if (Math.abs(endY - startY) < 5) {
            // Same row or very close - straight horizontal line
            pathD = `M ${startX + gap} ${startY} L ${endX - gap - arrowSize} ${endY}`;
          } else {
            // Different rows - create clean L-shaped path
            const cornerX = startX + 20;
            pathD = `M ${startX + gap} ${startY} L ${cornerX} ${startY} L ${cornerX} ${endY} L ${endX - gap - arrowSize} ${endY}`;
          }
          
          paths.push(
            <g key={`dep-${task.taskDataId}-${successorTask.taskDataId}`}>
              {/* Clean dependency line */}
              <path
                d={pathD}
                stroke={lineColor}
                strokeWidth="1.5"
                fill="none"
                opacity="0.9"
              />
              {/* Simple arrow head */}
              <path
                d={`M ${endX - gap} ${endY} L ${endX - gap - arrowSize} ${endY - arrowSize/2} L ${endX - gap - arrowSize} ${endY + arrowSize/2} Z`}
                fill={lineColor}
                opacity="0.9"
              />
            </g>
          );
        }
      }
    });
    
    return (
      <svg 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 5
        }}
      >
        {paths}
      </svg>
    );
  };

  private renderTaskRow = (taskHierarchy: TaskHierarchy, index: number): JSX.Element => {
    const { task, level } = taskHierarchy;
    const { hoveredTask, selectedTask } = this.state;
    const { tasks } = this.props;
    
    const hasChildren = tasks.some(t => t.parentTask === task.taskDataId);
    const isExpanded = this.state.expandedTasks.has(task.taskDataId);
    const isHovered = hoveredTask === task.taskDataId;
    const isSelected = selectedTask === task.taskDataId;
    const isScrollingTo = this.state.scrollingToTask === task.taskDataId;
    
    const rowStyle: React.CSSProperties = {
      display: 'flex',
      height: '36px', // Increased height for better readability
      borderBottom: '1px solid #e9ecef',
      borderLeft: isSelected ? '4px solid #2196f3' : '4px solid transparent', // Left border for selected task
      backgroundColor: isScrollingTo 
        ? '#c8e6c9' // Light green during scroll animation
        : isHovered 
          ? '#f1f3f4' 
          : (isSelected ? '#bbdefb' : (index % 2 === 0 ? '#ffffff' : '#fafbfc')), // Stronger selected color
      cursor: 'pointer',
      transition: isScrollingTo ? 'all 0.3s ease-in-out' : 'all 0.2s ease',
      transform: isScrollingTo ? 'scale(1.01)' : 'scale(1)' // Subtle scale during scroll
    };
    
    // Create optimized event handlers to prevent excessive re-renders
    const handleMouseEnter = this.ENABLE_HOVER_EFFECTS 
      ? () => this.handleMouseEnter(task.taskDataId)
      : undefined;
    const handleMouseLeave = this.ENABLE_HOVER_EFFECTS 
      ? this.handleMouseLeave 
      : undefined;
    const handleClick = () => {
      this.setState({ selectedTask: task.taskDataId });
      this.scrollToTask(task, index);
      if (this.props.onTaskClick) {
        this.props.onTaskClick(task);
      }
    };

    return (
      <div 
        style={rowStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div style={{ 
          width: 350, // Increased width to accommodate longer task names
          padding: '8px 12px', // Increased padding for better spacing
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          alignItems: 'center'
        }}>
          <div style={{ marginLeft: level * 20, display: 'flex', alignItems: 'center', width: '100%' }}>
            {hasChildren && (
              <span 
                style={{ 
                  marginRight: '8px', 
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '12px',
                  color: '#007bff',
                  fontWeight: 'bold',
                  width: '16px',
                  textAlign: 'center'
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
              color: task.isSummaryTask ? '#0078db' : '#495057',
              fontSize: '14px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 255, // Updated for new column width
              display: 'inline-block'
            }}
            title={task.taskName} // Show full name on hover
            >
              {task.taskName}
            </span>
          </div>
        </div>
        
        <div style={{ 
          width: 100, 
          padding: '6px 8px', 
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{ 
            backgroundColor: this.getPhaseColor(task.taskPhase),
            color: 'white',
            padding: '3px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: '500',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '84px'
          }}
          title={task.taskPhase} // Show full phase name on hover
          >
            {task.taskPhase}
          </span>
        </div>
        
        <div style={{ 
          width: 100, 
          padding: '6px 8px', 
          borderRight: '1px solid #dee2e6',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center'
        }}>
          {this.formatDate(task.startDate)}
        </div>
        
        <div style={{ 
          width: 80, 
          padding: '6px 8px', 
          borderRight: '1px solid #dee2e6',
          fontSize: '13px',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {task.duration}d
        </div>
        
        <div style={{ 
          width: 80, 
          padding: '6px 8px',
          fontSize: '13px',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {Math.round((task.progress ?? 0) * 100)}%
        </div>
      </div>
    );
  };

  private renderTimelineBar = (taskHierarchy: TaskHierarchy, index: number): JSX.Element => {
    const { task } = taskHierarchy;
    const { left, width } = this.calculateTaskPosition(task);
    const color = this.getPhaseColor(task.taskPhase);
    const isSelected = this.state.selectedTask === task.taskDataId;
    const isScrollingTo = this.state.scrollingToTask === task.taskDataId;
    
    const barStyle: React.CSSProperties = {
      position: 'absolute',
      left,
      width,
      height: task.isSummaryTask ? '20px' : '16px',
      backgroundColor: task.isSummaryTask ? '#0078db' : color,
      borderRadius: task.isSummaryTask ? '10px' : '8px',
      top: task.isSummaryTask ? '6px' : '8px',
      opacity: 0.9,
      border: task.isSummaryTask ? '2px solid #34495e' : '1px solid rgba(255,255,255,0.4)',
      boxShadow: isScrollingTo
        ? '0 6px 20px rgba(76, 175, 80, 0.5)' // Green glow during scroll animation
        : isSelected 
          ? '0 4px 12px rgba(33, 150, 243, 0.4)' // Enhanced shadow for selected task
          : task.isSummaryTask 
            ? '0 2px 6px rgba(0,0,0,0.3)' 
            : '0 1px 4px rgba(0,0,0,0.2)',
      zIndex: isScrollingTo ? 6 : (isSelected ? 5 : 3), // Bring scrolling task to front
      cursor: 'pointer',
      transition: isScrollingTo ? 'all 0.3s ease-in-out' : 'all 0.2s ease',
      transform: isScrollingTo ? 'scale(1.05)' : (isSelected ? 'scale(1.02)' : 'scale(1)') // Enhanced scale during scroll
    };

    const progressStyle: React.CSSProperties = {
      position: 'absolute',
      left: 0,
      top: 0,
      height: '100%',
      width: `${(task.progress ?? 0) * 100}%`,
      backgroundColor: task.isSummaryTask ? '#0078db' : 'rgba(255,255,255,0.4)',
      borderRadius: task.isSummaryTask ? '8px' : '4px'
    };

    return (
      <div style={{
        position: 'relative',
        height: '36px', // Updated to match row height
        borderBottom: '1px solid #e9ecef',
        borderLeft: isScrollingTo 
          ? '4px solid #4caf50' // Green border during scroll animation
          : isSelected 
            ? '4px solid #2196f3' 
            : '4px solid transparent', // Match grid row border
        backgroundColor: isScrollingTo 
          ? '#c8e6c9' // Light green during scroll animation
          : isSelected 
            ? '#bbdefb' 
            : (index % 2 === 0 ? '#ffffff' : '#fafbfc'),
        transition: isScrollingTo ? 'all 0.3s ease-in-out' : 'all 0.2s ease'
      }}>
        <div 
          style={barStyle}
          onClick={(e) => {
            e.stopPropagation(); // Prevent event bubbling
            this.setState({ selectedTask: task.taskDataId });
            this.scrollToTask(task, index);
            if (this.props.onTaskClick) {
              this.props.onTaskClick(task);
            }
          }}
        >
          <div style={progressStyle}></div>
          {/* Task name on timeline bar - show on most bars */}
          {width > 80 && (
            <span style={{
              position: 'absolute',
              left: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'white',
              fontSize: width > 150 ? '11px' : '10px',
              fontWeight: 'bold',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              maxWidth: width > 120 ? width - 50 : width - 20,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              zIndex: 3
            }}
            title={task.taskName} // Show full name on hover
            >
              {this.getDisplayTaskName(task.taskName, width)}
            </span>
          )}
          {/* Progress percentage on the right side */}
          {width > 120 && (
            <span style={{
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'white',
              fontSize: '9px',
              fontWeight: 'bold',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              zIndex: 3
            }}>
              {Math.round((task.progress ?? 0) * 100)}%
            </span>
          )}
          {/* Show only progress for small bars */}
          {width <= 120 && width > 40 && (
            <span style={{
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'white',
              fontSize: '9px',
              fontWeight: 'bold',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              zIndex: 3
            }}>
              {Math.round((task.progress ?? 0) * 100)}%
            </span>
          )}
        </div>
      </div>
    );
  };

  private renderGridHeader = (): JSX.Element => {
    const headerStyle: React.CSSProperties = {
      height: '40px',
      fontSize: '13px',
      fontWeight: 'bold',
      color: '#495057'
    };
    
    return (
      <div style={{ 
        display: 'flex',
        ...headerStyle
      }}>
        <div style={{ 
          width: 350, // Updated to match task column width
          padding: '12px 16px', 
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          alignItems: 'center'
        }}>
          Task Name
        </div>
        <div style={{ 
          width: 100, 
          padding: '12px 8px', 
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          alignItems: 'center'
        }}>
          Phase
        </div>
        <div style={{ 
          width: 100, 
          padding: '12px 8px', 
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          alignItems: 'center'
        }}>
          Start Date
        </div>
        <div style={{ 
          width: 80, 
          padding: '12px 8px', 
          borderRight: '1px solid #dee2e6',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          Duration
        </div>
        <div style={{ 
          width: 80, 
          padding: '12px 8px',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          Progress
        </div>
      </div>
    );
  };

  public render(): JSX.Element {
    const hierarchy = this.buildHierarchy();
    const visibleTasks = this.flattenHierarchy(hierarchy);
    const { timelineWidth } = this.state;
    const gridWidth = 731; // Updated width for left grid (350 + 100 + 100 + 80 + 80)

    // Add CSS keyframes for scroll animations
    const scrollAnimationStyles = `
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes glow {
          0% { box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2); }
          50% { box-shadow: 0 4px 16px rgba(33, 150, 243, 0.6); }
          100% { box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2); }
        }
        
        .gantt-row-highlight {
          background: linear-gradient(90deg, #e3f2fd 0%, #bbdefb 50%, #e3f2fd 100%) !important;
          transition: all 0.3s ease-in-out !important;
        }
        
        .gantt-timeline-highlight {
          transform: scale(1.02) !important;
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4) !important;
          z-index: 15 !important;
          border-radius: 4px !important;
          transition: all 0.3s ease-in-out !important;
        }
      </style>
    `;

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%',
        border: '1px solid #dee2e6',
        backgroundColor: 'white',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div dangerouslySetInnerHTML={{ __html: scrollAnimationStyles }} />
        {this.renderZoomControls()}
        
        {/* Sticky Headers Row */}
        <div style={{ 
          display: 'flex',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: '#ffffff',
          borderBottom: '2px solid #dee2e6'
        }}>
          {/* Left Grid Header */}
          <div style={{ 
            width: gridWidth, 
            flexShrink: 0,
            borderRight: '2px solid #dee2e6'
          }}>
            {this.renderGridHeader()}
          </div>
          
          {/* Right Timeline Header Container */}
          <div style={{ 
            flex: 1,
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div 
              id="timeline-header-container"
              style={{ 
                width: timelineWidth, // Use exact timeline width for proper alignment
                marginLeft: 20, // Will be controlled by sync,
                overflowX: 'hidden', // Will be controlled by sync
                overflowY: 'hidden',
                scrollBehavior: 'smooth' // Native smooth scrolling support
              }}
            >
              {this.renderTimelineHeader()}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Grid Content */}
          <div style={{ 
            width: gridWidth, 
            flexShrink: 0, 
            borderRight: '2px solid #dee2e6',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div 
              ref={this.leftGridRef}
              style={{ 
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollBehavior: 'smooth' // Native smooth scrolling support
              }}
              onScroll={(e) => {
                const target = e.target as HTMLDivElement;
                // Only sync vertical scrolling
                if (target.scrollTop !== (this.rightTimelineRef.current?.scrollTop || 0)) {
                  this.syncScrollLeft(target.scrollTop);
                }
              }}
            >
              {visibleTasks.map((taskHierarchy, index) => 
                <div key={`task-row-${taskHierarchy.task.taskDataId}-${index}`}>
                  {this.renderTaskRow(taskHierarchy, index)}
                </div>
              )}
            </div>
          </div>
          
          {/* Right Timeline Content */}
          <div style={{ 
            flex: 1, 
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div 
              ref={this.rightTimelineRef}
              style={{ 
                flex: 1,
                overflowY: 'auto',
                overflowX: 'auto', // Allow horizontal scrolling
                scrollBehavior: 'smooth' // Native smooth scrolling support
              }}
              onScroll={(e) => {
                const target = e.target as HTMLDivElement;
                // Only sync vertical scrolling, preserve horizontal scrolling
                if (target.scrollTop !== (this.leftGridRef.current?.scrollTop || 0)) {
                  this.syncScrollRight(target.scrollTop);
                }
                // Sync horizontal scrolling with the sticky header
                this.syncTimelineHeaderScroll(target.scrollLeft);
              }}
            >
              <div style={{ 
                width: timelineWidth, // Use exact timeline width for consistency
                position: 'relative'
              }}>
                <div style={{ 
                  position: 'relative',
                  minHeight: `${visibleTasks.length * 36}px` // Updated to match new row height
                }}>
                  {/* Render task bars first (lower z-index) */}
                  {visibleTasks.map((taskHierarchy, index) => 
                    <div key={`timeline-bar-${taskHierarchy.task.taskDataId}-${index}`}>
                      {this.renderTimelineBar(taskHierarchy, index)}
                    </div>
                  )}
                  {/* Render dependency lines on top (higher z-index) */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
                    {this.renderDependencyLines(visibleTasks)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}