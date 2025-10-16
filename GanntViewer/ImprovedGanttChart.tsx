import * as React from 'react';
import { TaskData } from './types';
import GanttTimelineShimmer from './shimmerdEffect';

interface IImprovedGanttProps {
  tasks: TaskData[];
  onTaskClick?: (task: TaskData) => void;
  onExpandCollapse?: (taskId: string, expanded: boolean) => void;
  isLoading?: boolean; // Optional loading state for overlay shimmer
}

interface IImprovedGanttState {
  expandedTasks: Set<string>;
  zoomLevel: 'Day' | 'Week' | 'Month' | 'Quarter' | 'Year';
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
  private mainScrollRef: React.RefObject<HTMLDivElement>;
  private hoverTimeoutId: number | null = null;
  // Instance-level cache that persists across renders without triggering setState
  private hierarchyCache: TaskHierarchy[] | null = null;
  private hierarchyCacheKey: string = '';
  private flatHierarchyCache: TaskHierarchy[] | null = null;
  private flatHierarchyCacheKey: string = '';
  // Performance optimization: Memoize expensive calculations
  private memoizedTaskPositions = new Map<string, any>();
  private memoizedTaskStyles = new Map<string, React.CSSProperties>();
  private lastTasksVersion: string = '';
  // Throttle state updates for better performance
  private stateUpdateRAF: number | null = null;

  constructor(props: IImprovedGanttProps) {
    super(props);
    
    this.containerRef = React.createRef();
    this.mainScrollRef = React.createRef();
    
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
      
      // Clear all caches when tasks change for performance
      this.hierarchyCache = null;
      this.hierarchyCacheKey = '';
      this.flatHierarchyCache = null;
      this.flatHierarchyCacheKey = '';
      this.memoizedTaskPositions.clear();
      this.memoizedTaskStyles.clear();
      
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
    if (this.stateUpdateRAF) {
      cancelAnimationFrame(this.stateUpdateRAF);
    }
    
    // Clear all caches to prevent memory leaks
    this.memoizedTaskPositions.clear();
    this.memoizedTaskStyles.clear();
    this.hierarchyCache = null;
    this.flatHierarchyCache = null;
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
      case 'Year': return Math.ceil(totalDays / 365) * 200; // 200px per year
      default: return 1200;
    }
  };

  private changeZoomLevel = (newZoom: 'Day' | 'Week' | 'Month' | 'Quarter' | 'Year') => {
    // Avoid unnecessary state updates
    if (this.state.zoomLevel === newZoom) return;
    
    const { timelineStart, timelineEnd } = this.state;
    const newWidth = this.calculateTimelineWidthByZoom(newZoom, timelineStart, timelineEnd);
    
    // Clear position cache when zoom changes as positions will be different
    this.memoizedTaskPositions.clear();
    
    // Use RAF to batch state updates for better performance
    if (this.stateUpdateRAF) {
      cancelAnimationFrame(this.stateUpdateRAF);
    }
    
    this.stateUpdateRAF = requestAnimationFrame(() => {
      this.setState({ 
        zoomLevel: newZoom,
        timelineWidth: newWidth
      });
      this.stateUpdateRAF = null;
    });
  };

  private scrollToTask = (task: TaskData, taskIndex: number): void => {
    const taskPosition = this.calculateTaskPosition(task);
    
    // Get the main scroll container
    const mainContainer = this.mainScrollRef.current;
    if (!mainContainer) return;
    
    // Set scrolling animation state for visual feedback
    this.setState({ scrollingToTask: task.taskDataId });
    
    const containerWidth = mainContainer.clientWidth;
    
    // Only calculate horizontal scroll position - keep current vertical position
    const gridWidth = 847; // Width of sticky columns
    const taskStartX = taskPosition.left + 20; // Add padding offset (where task actually starts in timeline)
    const taskCenterX = taskStartX + (taskPosition.width / 2);
    
    // Calculate the available timeline viewport width (subtract sticky grid width)
    const timelineViewportWidth = containerWidth - gridWidth;
    
    // Calculate where we want the task center to appear in the visible timeline area
    // We want it in the middle of the visible timeline viewport
    const desiredTaskPositionInViewport = timelineViewportWidth / 2;
    
    // Calculate the scroll position needed to achieve this
    // We need to scroll so that taskCenterX appears at (gridWidth + desiredTaskPositionInViewport)
    let targetHorizontalScroll = taskCenterX - desiredTaskPositionInViewport;
    
    // Ensure we don't scroll beyond the minimum (just past the grid)
    targetHorizontalScroll = Math.max(0, targetHorizontalScroll);
    
    // If the task is very wide, prioritize showing the start of the task in the middle
    if (taskPosition.width > timelineViewportWidth * 0.8) {
      targetHorizontalScroll = Math.max(0, taskStartX - desiredTaskPositionInViewport);
    }
    
    // Smooth scroll horizontally only - preserve current vertical position
    mainContainer.scrollTo({
      left: targetHorizontalScroll,
      behavior: 'smooth'
    });
    
    // Add visual feedback effects
    setTimeout(() => {
      const timelineBar = mainContainer.querySelector(`[data-task-timeline-id="${task.taskDataId}"]`) as HTMLElement;
      const taskRow = mainContainer.querySelector(`[data-task-id="${task.taskDataId}"]`) as HTMLElement;
      
      if (timelineBar) {
        timelineBar.classList.add('gantt-timeline-highlight');
        timelineBar.style.animation = 'pulse 1s ease-in-out, glow 1.5s ease-in-out';
      }
      
      if (taskRow) {
        taskRow.classList.add('gantt-row-highlight');
      }
      
      // Clear effects after animation
      setTimeout(() => {
        this.setState({ scrollingToTask: null });
        if (timelineBar) {
          timelineBar.classList.remove('gantt-timeline-highlight');
          timelineBar.style.animation = '';
        }
        if (taskRow) {
          taskRow.classList.remove('gantt-row-highlight');
        }
      }, 1500);
    }, 100);
    
    console.log(`Scrolling to task: ${task.taskName}
      - Horizontal: ${targetHorizontalScroll} (task center: ${taskCenterX}, will appear at middle of ${timelineViewportWidth}px timeline)
      - Vertical: keeping current position`);
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
    // Create cache key for memoization
    const cacheKey = `${task.taskDataId}-${task.startDate.getTime()}-${task.finishDate.getTime()}-${this.state.timelineWidth}-${this.state.timelineStart.getTime()}-${this.state.timelineEnd.getTime()}`;
    
    // Check cache first
    if (this.memoizedTaskPositions.has(cacheKey)) {
      return this.memoizedTaskPositions.get(cacheKey);
    }
    
    const { timelineStart, timelineEnd, timelineWidth } = this.state;
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    
    const taskStart = task.startDate.getTime() - timelineStart.getTime();
    const taskDuration = task.finishDate.getTime() - task.startDate.getTime();
    
    const left = (taskStart / totalDuration) * timelineWidth;
    const width = Math.max((taskDuration / totalDuration) * timelineWidth, 20);
    
    const result = { left, width };
    
    // Cache the result
    this.memoizedTaskPositions.set(cacheKey, result);
    
    // Clean cache if it gets too large (prevent memory leaks)
    if (this.memoizedTaskPositions.size > 1000) {
      const firstKey = this.memoizedTaskPositions.keys().next().value;
      if (firstKey) {
        this.memoizedTaskPositions.delete(firstKey);
      }
    }
    
    return result;
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
    const zoomOptions: ('Day' | 'Week' | 'Month' | 'Quarter' | 'Year')[] = ['Day', 'Week', 'Month', 'Quarter', 'Year'];
    
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
    
    if (zoomLevel === 'Year') {
      const years: JSX.Element[] = [];
      const current = new Date(timelineStart.getFullYear(), 0, 1); // Start from January 1st
      const cellWidth = 200;
      
      while (current <= timelineEnd) {
        const year = current.getFullYear();
        
        years.push(
          <div key={current.toISOString()} style={{
            ...cellStyle,
            width: cellWidth,
            height: headerHeight,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            {year}
          </div>
        );
        
        current.setFullYear(current.getFullYear() + 1);
      }
      
      return (
        <div style={{ 
          display: 'flex', 
          height: headerHeight,
          backgroundColor: '#f8f9fa',
          borderBottom: '2px solid #007bff'
        }}>
          {years}
        </div>
      );
    }
    
    if (zoomLevel === 'Quarter') {
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
    }
    
    // Default fallback (should not reach here)
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
    // Dependency lines completely disabled
    return (
      <div style={{ display: 'none' }}></div>
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
    
    // Memoize row style calculation for better performance
    const styleKey = `${task.taskDataId}-${index}-${isHovered}-${isSelected}-${isScrollingTo}`;
    let rowStyle: React.CSSProperties;
    
    if (this.memoizedTaskStyles.has(styleKey)) {
      rowStyle = this.memoizedTaskStyles.get(styleKey)!;
    } else {
      rowStyle = {
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
      
      // Cache the style (but only cache stable styles, not dynamic ones)
      if (!isScrollingTo && !isHovered) {
        this.memoizedTaskStyles.set(styleKey, rowStyle);
        
        // Clean cache if it gets too large
        if (this.memoizedTaskStyles.size > 500) {
          const firstKey = this.memoizedTaskStyles.keys().next().value;
          if (firstKey) {
            this.memoizedTaskStyles.delete(firstKey);
          }
        }
      }
    }
    
    // Create optimized event handlers to prevent excessive re-renders
    const handleMouseEnter = this.ENABLE_HOVER_EFFECTS 
      ? () => this.handleMouseEnter(task.taskDataId)
      : undefined;
    const handleMouseLeave = this.ENABLE_HOVER_EFFECTS 
      ? this.handleMouseLeave 
      : undefined;
    const handleClick = () => {
      this.setState({ selectedTask: task.taskDataId });
      // Scroll to task with updated logic for sticky columns
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
        data-task-id={task.taskDataId}
      >
        {/* WBS Column */}
        <div style={{ 
          width: 74, 
          padding: '8px', 
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#495057'
        }}>
          {task.taskWBS || task.taskNumber}
        </div>
        
        {/* Task Name Column */}
        <div style={{ 
          width: 311, // Reduced from 350 to make room for WBS column
          padding: '8px 12px', 
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden' // Ensure content doesn't overflow the column
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            width: '100%',
            paddingLeft: level * 20 // Apply indentation as padding instead of margin
          }}>
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
                  textAlign: 'center',
                  flexShrink: 0 // Prevent shrinking
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
              fontWeight: hasChildren ? 'bold' : 'normal',
              color: hasChildren ? '#34495e' : '#495057',
              fontSize: '14px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1, // Take remaining space
              minWidth: 0 // Allow shrinking
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
          width: 100, 
          padding: '6px 8px', 
          borderRight: '1px solid #dee2e6',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center'
        }}>
          {this.formatDate(task.finishDate)}
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
    
    // Handle milestone tasks (diamond shape)
    if (task.isMilestone === true) {
      return this.renderMilestoneDiamond(task, left, color, isSelected, isScrollingTo, index);
    }
    
    const barStyle: React.CSSProperties = {
      position: 'absolute',
      left,
      width,
      height: task.isSummaryTask ? '20px' : '16px',
      backgroundColor: task.isSummaryTask ? '#0078db' : color,
      borderRadius: task.isSummaryTask ? '10px' : '8px',
      top: task.isSummaryTask ? '6px' : '8px',
      opacity: 0.9,
      border: task.isSummaryTask ? '1px solid #84b7e9' : '1px solid rgba(255,255,255,0.4)',
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
          data-task-timeline-id={task.taskDataId}
          onClick={(e) => {
            e.stopPropagation(); // Prevent event bubbling
            this.setState({ selectedTask: task.taskDataId });
            // Scroll to task with updated logic for sticky columns
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

  private renderMilestoneDiamond = (
    task: TaskData, 
    left: number, 
    color: string, 
    isSelected: boolean, 
    isScrollingTo: boolean, 
    index: number
  ): JSX.Element => {
    const diamondSize = 14; // Reduced size from 20 to 14
    const diamondStyle: React.CSSProperties = {
      position: 'absolute',
      left: left - diamondSize / 2, // Center the diamond on the date
      top: '11px', // Adjusted for smaller size
      width: diamondSize,
      height: diamondSize,
      backgroundColor: '#4CAF50', // Green color instead of phase color
      transform: 'rotate(45deg)', // Create diamond shape
      border: '2px solid #ffffff',
      boxShadow: isScrollingTo
        ? '0 4px 16px rgba(76, 175, 80, 0.5)' // Green glow during scroll animation
        : isSelected 
          ? '0 3px 10px rgba(76, 175, 80, 0.4)' // Green shadow for selected task
          : '0 2px 6px rgba(0,0,0,0.3)',
      zIndex: isScrollingTo ? 6 : (isSelected ? 5 : 4), // Bring milestone to front
      cursor: 'pointer',
      transition: isScrollingTo ? 'all 0.3s ease-in-out' : 'all 0.2s ease',
      opacity: 0.9
    };

    // Container for the diamond with proper positioning
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
          style={diamondStyle}
          data-task-timeline-id={task.taskDataId}
          onClick={(e) => {
            e.stopPropagation(); // Prevent event bubbling
            this.setState({ selectedTask: task.taskDataId });
            // Scroll to task with updated logic for sticky columns
            this.scrollToTask(task, index);
            if (this.props.onTaskClick) {
              this.props.onTaskClick(task);
            }
          }}
          title={`Milestone: ${task.taskName} - ${this.formatDate(task.startDate)}`}
        >
        </div>
        
        {/* Milestone label */}
        <div style={{
          position: 'absolute',
          left: left + diamondSize / 2 + 15, // Increased space from 5 to 15
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#333',
          fontSize: '11px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          zIndex: 5,
          maxWidth: '150px',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {task.taskName}
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
          width: 80, 
          padding: '12px 8px', 
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          WBS
        </div>
        <div style={{ 
          width: 300, // Reduced from 350 to make room for WBS column
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
          width: 100, 
          padding: '12px 8px', 
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          alignItems: 'center'
        }}>
          Finish Date
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

  private getVisibleTaskIndices = (visibleTasks: TaskHierarchy[], scrollTop: number, containerHeight: number) => {
    const rowHeight = 36;
    const startIndex = Math.floor(Math.max(0, scrollTop / rowHeight));
    const endIndex = Math.min(
      visibleTasks.length - 1,
      Math.ceil((scrollTop + containerHeight) / rowHeight)
    );
    
    return { startIndex, endIndex };
  };

  public render(): JSX.Element {
    const hierarchy = this.buildHierarchy();
    const visibleTasks = this.flattenHierarchy(hierarchy);
    const { timelineWidth } = this.state;
    const gridWidth = 847; // Updated width for left grid (80 + 300 + 100 + 100 + 100 + 80 + 80 + 7 for borders)

    // Debug logging
    console.log(`ImprovedGanttChart render: ${this.props.tasks.length} input tasks, ${hierarchy.length} hierarchy nodes, ${visibleTasks.length} visible tasks`);
    if (visibleTasks.length === 0) {
      console.log('❌ No visible tasks! Check hierarchy building...');
    }

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
        
        {/* Main Container with unified scrolling */}
        <div 
          ref={this.mainScrollRef}
          style={{ 
            flex: 1, 
            overflowY: 'auto',
            overflowX: 'auto',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
            overscrollBehavior: 'none',
            position: 'relative'
          }}
        >
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            minWidth: `${gridWidth + timelineWidth + 20}px` // Total width including timeline
          }}>
            
            {/* Headers Row - Sticky */}
            <div style={{ 
              display: 'flex',
              position: 'sticky',
              top: 0,
              zIndex: 100,
              backgroundColor: '#ffffff',
              borderBottom: '2px solid #dee2e6'
            }}>
              {/* Left Grid Header - Sticky */}
              <div style={{ 
                width: gridWidth, 
                flexShrink: 0,
                borderRight: '2px solid #dee2e6',
                position: 'sticky',
                left: 0,
                zIndex: 101,
                backgroundColor: '#ffffff'
              }}>
                {this.renderGridHeader()}
              </div>
              
              {/* Right Timeline Header */}
              <div style={{ 
                width: timelineWidth + 20,
                backgroundColor: '#ffffff'
              }}>
                {this.renderTimelineHeader()}
              </div>
            </div>

            {/* Content Area */}
            <div style={{ 
              display: 'flex',
              minHeight: `${visibleTasks.length * 36}px`
            }}>
              {/* Left Grid Content - Sticky */}
              <div style={{ 
                width: gridWidth, 
                flexShrink: 0, 
                borderRight: '2px solid #dee2e6',
                position: 'sticky',
                left: 0,
                zIndex: 50,
                backgroundColor: '#ffffff'
              }}>
                {visibleTasks.map((taskHierarchy, index) => 
                  <div key={`task-row-${taskHierarchy.task.taskDataId}-${index}`}>
                    {this.renderTaskRow(taskHierarchy, index)}
                  </div>
                )}
              </div>
              
              {/* Right Timeline Content */}
              <div style={{ 
                width: timelineWidth + 20,
                position: 'relative',
              }}>
                <div style={{ 
                  position: 'relative',
                  minHeight: `${visibleTasks.length * 36}px`
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
        
        {/* Shimmer overlay when loading */}
        {this.props.isLoading && (
          <GanttTimelineShimmer 
            isOverlay={true}
            rowCount={visibleTasks.length || 10}
            yearCount={4}
          />
        )}
      </div>
    );
  }
}