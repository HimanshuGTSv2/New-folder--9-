import * as React from 'react';

// Shimmer effect styles for Gantt timeline grid
const ganttShimmerStyles = `
  .gantt-shimmer-grid {
    width: 100%;
    background: #fff;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid #edebe9;
  }

  .gantt-shimmer-header {
    background: #f8f8f8;
    border-bottom: 1px solid #edebe9;
    padding: 12px 16px;
  }

  .gantt-shimmer-phase-legend {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 12px;
  }

  .gantt-shimmer-legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .gantt-shimmer-legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .gantt-shimmer-legend-text {
    width: 60px;
    height: 12px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .gantt-shimmer-view-tabs {
    display: flex;
    gap: 8px;
  }

  .gantt-shimmer-tab {
    width: 60px;
    height: 32px;
    background: linear-gradient(90deg, #e0f3ff 25%, #cce7ff 50%, #e0f3ff 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 2px;
  }

  .gantt-shimmer-tab:first-child {
    width: 45px;
  }

  .gantt-shimmer-table-header {
    display: flex;
    height: 44px;
    background: #f8f8f8;
    border-bottom: 2px solid #edebe9;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .gantt-shimmer-left-columns {
    display: flex;
    border-right: 2px solid #edebe9;
    background: #fff;
  }

  .gantt-shimmer-header-cell {
    padding: 12px 16px;
    border-right: 1px solid #edebe9;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  }

  .gantt-shimmer-header-cell.wbs-column {
    width: 60px;
    min-width: 60px;
  }

  .gantt-shimmer-header-cell.task-column {
    width: 200px;
    min-width: 200px;
    justify-content: flex-start;
  }

  .gantt-shimmer-header-cell.phase-column {
    width: 100px;
    min-width: 100px;
  }

  .gantt-shimmer-header-cell.date-column {
    width: 110px;
    min-width: 110px;
  }

  .gantt-shimmer-header-cell.duration-column {
    width: 90px;
    min-width: 90px;
  }

  .gantt-shimmer-header-cell.progress-column {
    width: 80px;
    min-width: 80px;
  }

  .gantt-shimmer-timeline-header {
    flex: 1;
    display: flex;
    background: #fff;
  }

  .gantt-shimmer-year-header {
    flex: 1;
    min-width: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid #edebe9;
  }

  .gantt-shimmer-header-content {
    height: 14px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .gantt-shimmer-header-content.wbs-title {
    width: 35px;
  }

  .gantt-shimmer-header-content.task-title {
    width: 80px;
  }

  .gantt-shimmer-header-content.phase-title {
    width: 50px;
  }

  .gantt-shimmer-header-content.date-title {
    width: 75px;
  }

  .gantt-shimmer-header-content.duration-title {
    width: 60px;
  }

  .gantt-shimmer-header-content.progress-title {
    width: 60px;
  }

  .gantt-shimmer-header-content.year-title {
    width: 45px;
  }

  .gantt-shimmer-row {
    display: flex;
    height: 42px;
    border-bottom: 1px solid #f3f2f1;
    background: #fff;
  }

  .gantt-shimmer-row:hover {
    background: #f8f8f8;
  }

  .gantt-shimmer-row.parent-task {
    background: #fafafa;
    font-weight: 600;
  }

  .gantt-shimmer-row.child-task {
    background: #fff;
  }

  .gantt-shimmer-row.milestone {
    background: #fffef7;
  }

  .gantt-shimmer-left-cells {
    display: flex;
    border-right: 2px solid #edebe9;
  }

  .gantt-shimmer-cell {
    padding: 8px 12px;
    border-right: 1px solid #f3f2f1;
    display: flex;
    align-items: center;
  }

  .gantt-shimmer-cell.wbs-cell {
    width: 60px;
    min-width: 60px;
    justify-content: center;
  }

  .gantt-shimmer-cell.task-cell {
    width: 200px;
    min-width: 200px;
  }

  .gantt-shimmer-cell.phase-cell {
    width: 100px;
    min-width: 100px;
    justify-content: center;
  }

  .gantt-shimmer-cell.date-cell {
    width: 110px;
    min-width: 110px;
    justify-content: center;
  }

  .gantt-shimmer-cell.duration-cell {
    width: 90px;
    min-width: 90px;
    justify-content: center;
  }

  .gantt-shimmer-cell.progress-cell {
    width: 80px;
    min-width: 80px;
    justify-content: center;
  }

  .gantt-shimmer-task-indent {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .gantt-shimmer-expand-icon {
    width: 16px;
    height: 16px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .gantt-shimmer-task-name {
    height: 14px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
    flex: 1;
  }

  .gantt-shimmer-task-name.parent {
    width: 140px;
  }

  .gantt-shimmer-task-name.child {
    width: 120px;
  }

  .gantt-shimmer-wbs {
    width: 30px;
    height: 12px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .gantt-shimmer-phase-badge {
    width: 70px;
    height: 24px;
    background: linear-gradient(90deg, #e0f3ff 25%, #cce7ff 50%, #e0f3ff 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 12px;
  }

  .gantt-shimmer-phase-badge.planning {
    background: linear-gradient(90deg, #e8f5e8 25%, #d4f4d4 50%, #e8f5e8 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .gantt-shimmer-phase-badge.selection {
    background: linear-gradient(90deg, #e3f2fd 25%, #bbdefb 50%, #e3f2fd 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .gantt-shimmer-phase-badge.execution {
    background: linear-gradient(90deg, #f3e5f5 25%, #e1bee7 50%, #f3e5f5 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .gantt-shimmer-date {
    width: 80px;
    height: 12px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .gantt-shimmer-duration {
    width: 40px;
    height: 12px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .gantt-shimmer-progress {
    width: 35px;
    height: 12px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .gantt-shimmer-timeline {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 0 16px;
    position: relative;
  }

  .gantt-shimmer-timeline-bar {
    height: 24px;
    background: linear-gradient(90deg, #64b5f6 25%, #42a5f5 50%, #64b5f6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
    position: absolute;
  }

  .gantt-shimmer-timeline-bar.planning {
    background: linear-gradient(90deg, #81c784 25%, #66bb6a 50%, #81c784 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .gantt-shimmer-timeline-bar.selection {
    background: linear-gradient(90deg, #64b5f6 25%, #42a5f5 50%, #64b5f6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .gantt-shimmer-timeline-bar.execution {
    background: linear-gradient(90deg, #ba68c8 25%, #ab47bc 50%, #ba68c8 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .gantt-shimmer-timeline-bar.closure {
    background: linear-gradient(90deg, #ffb74d 25%, #ffa726 50%, #ffb74d 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .gantt-shimmer-milestone-marker {
    width: 14px;
    height: 14px;
    background: linear-gradient(135deg, #4caf50 25%, #388e3c 50%, #4caf50 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    transform: rotate(45deg);
    position: absolute;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  .gantt-shimmer-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.9);
    z-index: 1000;
  }

  /* Responsive adjustments */
  @media (max-width: 1200px) {
    .gantt-shimmer-header-cell.task-column,
    .gantt-shimmer-cell.task-cell {
      width: 150px;
      min-width: 150px;
    }
  }

  /* Accessibility improvements */
  @media (prefers-reduced-motion: reduce) {
    .gantt-shimmer-legend-dot,
    .gantt-shimmer-legend-text,
    .gantt-shimmer-tab,
    .gantt-shimmer-header-content,
    .gantt-shimmer-expand-icon,
    .gantt-shimmer-task-name,
    .gantt-shimmer-wbs,
    .gantt-shimmer-phase-badge,
    .gantt-shimmer-date,
    .gantt-shimmer-duration,
    .gantt-shimmer-progress,
    .gantt-shimmer-timeline-bar,
    .gantt-shimmer-milestone-marker {
      animation: none;
      background: #f0f0f0;
    }
  }
`;

interface GanttTimelineShimmerProps {
  isOverlay?: boolean;
  rowCount?: number;
  yearCount?: number;
}

const GanttTimelineShimmer: React.FC<GanttTimelineShimmerProps> = ({ 
  isOverlay = false, 
  rowCount = 16,
  yearCount = 6
}) => {
  // Add styles to document head if not already present
  React.useEffect(() => {
    const styleId = 'gantt-shimmer-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = ganttShimmerStyles;
      document.head.appendChild(style);
    }
  }, []);

  // Generate shimmer years (2020-2025 by default)
  const currentYear = new Date().getFullYear();
  const shimmerYears = Array.from({ length: yearCount }, (_, i) => currentYear - 5 + i);

  // Phase types with colors
  const phaseTypes = ['initiation', 'planning', 'selection', 'execution', 'closure'];

  // Generate shimmer rows with hierarchy
  const shimmerRows = Array.from({ length: rowCount }, (_, index) => {
    const isParent = index % 7 === 0; // Every 7th row is a parent
    const isMilestone = index % 5 === 4; // Every 5th row is a milestone
    const indent = isParent ? 0 : 1;
    const phase = phaseTypes[Math.floor(Math.random() * phaseTypes.length)];
    
    // Calculate timeline bar position and width (random for variety)
    const startYear = Math.floor(Math.random() * 3); // Start within first 3 years
    const duration = Math.random() * 3 + 0.5; // Duration between 0.5 and 3.5 years
    const barLeft = `${(startYear / yearCount) * 100}%`;
    const barWidth = `${(duration / yearCount) * 100}%`;
    
    return {
      key: `shimmer-task-${index}`,
      isParent,
      isMilestone,
      indent,
      phase,
      wbsWidth: isParent ? 20 : 30,
      taskNameWidth: isParent ? 140 : 120,
      barLeft,
      barWidth,
    };
  });

  const shimmerContent = (
    <div className="gantt-shimmer-grid">
      {/* Header with Phase Legend and View Tabs */}
      <div className="gantt-shimmer-header">
        <div className="gantt-shimmer-phase-legend">
          <span style={{ fontSize: '12px', fontWeight: '600', marginRight: '8px', color: '#605e5c' }}>
            Phases:
          </span>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="gantt-shimmer-legend-item">
              <div className="gantt-shimmer-legend-dot" />
              <div className="gantt-shimmer-legend-text" />
            </div>
          ))}
        </div>
        <div>
          <span style={{ fontSize: '12px', fontWeight: '600', marginRight: '8px', color: '#605e5c' }}>
            View:
          </span>
          <div className="gantt-shimmer-view-tabs">
            {['Day', 'Week', 'Month', 'Quarter', 'Year'].map((view, i) => (
              <div key={i} className="gantt-shimmer-tab" />
            ))}
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="gantt-shimmer-table-header">
        <div className="gantt-shimmer-left-columns">
          <div className="gantt-shimmer-header-cell wbs-column">
            <div className="gantt-shimmer-header-content wbs-title" />
          </div>
          <div className="gantt-shimmer-header-cell task-column">
            <div className="gantt-shimmer-header-content task-title" />
          </div>
          <div className="gantt-shimmer-header-cell phase-column">
            <div className="gantt-shimmer-header-content phase-title" />
          </div>
          <div className="gantt-shimmer-header-cell date-column">
            <div className="gantt-shimmer-header-content date-title" />
          </div>
          <div className="gantt-shimmer-header-cell date-column">
            <div className="gantt-shimmer-header-content date-title" />
          </div>
          <div className="gantt-shimmer-header-cell duration-column">
            <div className="gantt-shimmer-header-content duration-title" />
          </div>
          <div className="gantt-shimmer-header-cell progress-column">
            <div className="gantt-shimmer-header-content progress-title" />
          </div>
        </div>
        <div className="gantt-shimmer-timeline-header">
          {shimmerYears.map((year, index) => (
            <div key={year} className="gantt-shimmer-year-header">
              <div className="gantt-shimmer-header-content year-title" />
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      {shimmerRows.map((row) => (
        <div 
          key={row.key} 
          className={`gantt-shimmer-row ${row.isParent ? 'parent-task' : row.isMilestone ? 'milestone' : 'child-task'}`}
        >
          <div className="gantt-shimmer-left-cells">
            {/* WBS Column */}
            <div className="gantt-shimmer-cell wbs-cell">
              <div className="gantt-shimmer-wbs" style={{ width: row.wbsWidth }} />
            </div>

            {/* Task Name Column */}
            <div className="gantt-shimmer-cell task-cell">
              <div className="gantt-shimmer-task-indent" style={{ paddingLeft: `${row.indent * 20}px` }}>
                {row.isParent && <div className="gantt-shimmer-expand-icon" />}
                <div 
                  className={`gantt-shimmer-task-name ${row.isParent ? 'parent' : 'child'}`}
                  style={{ width: row.taskNameWidth }}
                />
              </div>
            </div>

            {/* Phase Column */}
            <div className="gantt-shimmer-cell phase-cell">
              <div className={`gantt-shimmer-phase-badge ${row.phase}`} />
            </div>

            {/* Start Date Column */}
            <div className="gantt-shimmer-cell date-cell">
              <div className="gantt-shimmer-date" />
            </div>

            {/* Finish Date Column */}
            <div className="gantt-shimmer-cell date-cell">
              <div className="gantt-shimmer-date" />
            </div>

            {/* Duration Column */}
            <div className="gantt-shimmer-cell duration-cell">
              <div className="gantt-shimmer-duration" />
            </div>

            {/* Progress Column */}
            <div className="gantt-shimmer-cell progress-cell">
              <div className="gantt-shimmer-progress" />
            </div>
          </div>

          {/* Timeline */}
          <div className="gantt-shimmer-timeline">
            {row.isMilestone ? (
              <div 
                className="gantt-shimmer-milestone-marker"
                style={{ left: row.barLeft }}
              />
            ) : (
              <div 
                className={`gantt-shimmer-timeline-bar ${row.phase}`}
                style={{
                  left: row.barLeft,
                  width: row.barWidth,
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (isOverlay) {
    return (
      <div className="gantt-shimmer-overlay">
        {shimmerContent}
      </div>
    );
  }

  return shimmerContent;
};

export default GanttTimelineShimmer;