import { IInputs } from "./generated/ManifestTypes";
import { TaskData } from "./types";

export class DataverseService {
  private context: ComponentFramework.Context<IInputs>;
  private pageSize: number = 50; // Reduced default page size for better performance
  private totalRecords: number = 0;
  private allLoadedTasks: TaskData[] = [];
  private entityName: string = "";
  private cache: Map<string, TaskData[]> = new Map(); // Cache by cursor
  private lastFetchTime: number = 0;
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes cache
  private lastLoadedDate: string | null = null; // For cursor-based pagination
  private hasMoreData: boolean = true;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  constructor(context: ComponentFramework.Context<IInputs>) {
    this.context = context;
  }

  /**
   * Fetch TaskData records from Dataverse with cursor-based pagination
   * Uses createdon field for pagination instead of $skip which isn't supported in Dataverse
   */
  public async fetchTaskData(isLoadMore: boolean = false, pageSize: number = 50): Promise<TaskData[]> {
    try {
      // Reset cursor if this is not a load more operation
      if (!isLoadMore) {
        this.lastLoadedDate = null;
        this.hasMoreData = true;
        this.cache.clear();
        this.retryCount = 0;
      }

      // Use smaller page size if we've had retry issues
      if (this.retryCount > 0) {
        pageSize = Math.max(10, Math.floor(pageSize / 2));
        console.log(`Reduced page size to ${pageSize} due to previous errors`);
      }

      // Check cache first
      const cacheKey = isLoadMore ? `more-${this.lastLoadedDate}` : 'initial';
      const now = Date.now();
      
      if (this.cache.has(cacheKey) && (now - this.lastFetchTime) < this.cacheExpiry) {
        console.log(`Returning cached data for ${cacheKey}`);
        return this.cache.get(cacheKey)!;
      }

      this.pageSize = pageSize;
      
      // If this is the first call, determine the entity name
      if (!this.entityName) {
        await this.determineEntityName();
      }
      
      // Build query with cursor-based pagination (no $skip - not supported in Dataverse)
      let query = `?$select=*&$orderby=pme_taskindex asc&$top=${pageSize}`;
      
     // Add cursor filter for load more operations
      if (isLoadMore && this.lastLoadedDate) {
        // Format the date properly for OData filter
        const isoDate = new Date(this.lastLoadedDate).toISOString();
        query += `&$filter=createdon lt ${isoDate}`;
      }
      // Add count only for the first request
      if (!isLoadMore) {
        query += `&$count=true`;
      }
      
      console.log(`Fetching ${isLoadMore ? 'more' : 'initial'} data with query: ${query}`);
      
      const response = await this.context.webAPI.retrieveMultipleRecords(this.entityName, query);

      console.log(`Fetched ${response.entities.length} records`);
      
      // Reset retry count on successful fetch
      this.retryCount = 0;
      
      // Store total count for pagination info (only available on first request)
      if ((response as any)['@odata.count'] !== undefined) {
        this.totalRecords = (response as any)['@odata.count'];
      }
      
      // Check if we have more data
      this.hasMoreData = response.entities.length === pageSize;
      
      // Update cursor for next request
      if (response.entities.length > 0) {
        const lastEntity = response.entities[response.entities.length - 1];
        this.lastLoadedDate = lastEntity.createdon;
      }
      
      // Transform Dataverse records to TaskData format
      const taskData: TaskData[] = response.entities.map((record: any, index: number) => {
        const globalIndex = this.allLoadedTasks.length + index;
        console.log(`Processing record ${globalIndex + 1}:`, record);
        
        return this.transformRecord(record, globalIndex);
      });

      // Cache the results
      this.cache.set(cacheKey, taskData);
      this.lastFetchTime = now;

      console.log(`Processed ${taskData.length} tasks`);
      return taskData;
    } catch (error) {
      console.error('Error fetching TaskData from Dataverse:', error);
      
      // Increment retry count and try with smaller batch size
      this.retryCount++;
      
      if (this.retryCount <= this.maxRetries && pageSize > 10) {
        console.log(`Retrying with smaller batch size (attempt ${this.retryCount}/${this.maxRetries})`);
        return this.fetchTaskData(isLoadMore, Math.floor(pageSize / 2));
      }
      
      throw error;
    }
  }

  /**
   * Load more data (for infinite scrolling)
   */
  public async loadMoreData(): Promise<TaskData[]> {
    if (!this.hasMoreData) {
      console.log('No more data to load');
      return [];
    }

    const newTasks = await this.fetchTaskData(true, this.pageSize);
    this.allLoadedTasks.push(...newTasks);
    return newTasks;
  }

  /**
   * Get pagination info
   */
  public getPaginationInfo() {
    return {
      pageSize: this.pageSize,
      totalRecords: this.totalRecords,
      loadedRecords: this.allLoadedTasks.length,
      hasMore: this.hasMoreData,
      lastLoadedDate: this.lastLoadedDate
    };
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
    this.lastFetchTime = 0;
    console.log('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    return {
      cachedPages: this.cache.size,
      lastFetchTime: this.lastFetchTime,
      cacheAge: Date.now() - this.lastFetchTime,
      isExpired: (Date.now() - this.lastFetchTime) > this.cacheExpiry
    };
  }

  /**
   * Force refresh data (clears cache and fetches fresh data)
   */
  public async refreshData(pageSize: number = 100): Promise<TaskData[]> {
    this.clearCache();
    this.allLoadedTasks = [];
    return await this.fetchTaskData(false, pageSize);
  }

  /**
   * Determine the correct entity name
   */
  private async determineEntityName(): Promise<void> {
    const possibleEntityNames = [
      "pme_taskdata",      // From the form you're creating (primary)
      "pme_TaskData",      // Mixed case variant
      "TaskData",          // Just the display name
      "taskdata",          // singular without prefix
      "pme_taskdatas",     // plural with prefix
      "taskdatas",         // plural without prefix
      "cr6d4_taskdata",    // different prefix pattern
      "new_taskdata"       // another common prefix
    ];
    
    console.log('Attempting to determine entity name from possible options:', possibleEntityNames);
    
    // Try each possible entity name
    for (const name of possibleEntityNames) {
      try {
        console.log(`Testing entity name: ${name}`);
        // Test with a simple query first
        const testQuery = `?$select=*&$top=1`;
        await this.context.webAPI.retrieveMultipleRecords(name, testQuery);
        this.entityName = name;
        console.log(`✅ Found entity: ${this.entityName}`);
        return;
      } catch (error) {
        console.log(`❌ Entity ${name} not found:`, error);
        continue;
      }
    }
    
    // If we get here, none of the entity names worked
    console.error('All entity name attempts failed. Available entities might be:');
    
    // Try to get a list of available entities for debugging
    try {
      const metadata = await this.context.webAPI.retrieveMultipleRecords('EntityDefinition', '?$select=LogicalName,DisplayName&$filter=IsCustomEntity eq true&$top=20');
      console.log('Available custom entities:', metadata.entities.map((e: any) => ({ LogicalName: e.LogicalName, DisplayName: e.DisplayName })));
    } catch (metaError) {
      console.log('Could not retrieve entity metadata:', metaError);
    }
    
    throw new Error(`Could not find TaskData entity. Please ensure the 'pme_taskdata' table exists in your Dataverse environment. If you just created it, wait a few minutes for it to be available.`);
  }

  /**
   * Transform a record to TaskData format
   */
// ...existing code...

  /**
   * Transform a record to TaskData format
   */
  private transformRecord(record: any, index: number): TaskData {
    // Log the raw record structure for debugging
    console.log(`Raw record ${index}:`, record);
    
    // Get task ID - your data shows 'id' field
    const taskId = record.id || record.pme_taskdataid || `task-${index}`;
    
    // Get task name - your data shows 'name' field  
    const taskName = record.name || record.pme_taskname || `Task ${index + 1}`;
    
    // Get parent task - your data shows 'parent' field
    const parentTask = record.parent || record.pme_parenttask;
    
    // Get successor information - check various possible field names
    const successor = record.successor || record.pme_successor || record.successorId || record.successor_id;
    const successorUID = record.successorUID || record.pme_successoruid || record.successor_uid;
    const dependencyType = record.dependencyType || record.pme_dependencytype || record.dependency_type;
    
    // Since your data doesn't have dates, let's generate reasonable defaults
    const baseDate = new Date('2024-01-01');
    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() + (index * 7)); // Spread tasks over time
    
    const finishDate = new Date(startDate);
    finishDate.setDate(finishDate.getDate() + 14); // Default 14 day duration
    
    // Determine if this is a summary task based on whether it has children
    const isSummaryTask = this.hasPotentialChildren(record, index);
    
    // Get task index for sorting
    const taskIndex = record.pme_taskindex || record.taskindex || index;
    
    console.log(`Transform record ${index}: 
      taskId=${taskId}, 
      taskName=${taskName}
      isSummaryTask=${isSummaryTask}, 
      parentTask=${parentTask}, 
      taskIndex=${taskIndex},
      successor=${successor},
      successorUID=${successorUID},
      dependencyType=${dependencyType}`);
    
    // Debug: Show available fields in raw record
    if (index < 3) {
      console.log(`Available fields in record ${index}:`, Object.keys(record));
    }
    
    return {
      taskNumber: `${index + 1}`,
      taskDataId: taskId,
      taskName: taskName,
      
      // Assign phases based on task names for better visualization
      taskPhase: this.determinePhaseFromName(taskName),
      
      startDate: startDate,
      finishDate: finishDate,
      
      projectId: 'Penumbra-Project',
      projectUID: 'penumbra-project-uid',
      
      dependencyType: dependencyType as 'StartToStart' | 'FinishToStart' | 'FinishToFinish' | 'StartToFinish' | undefined,
      successor: successor,
      successorUID: successorUID,
      
      isSummaryTask: isSummaryTask,
      parentTask: parentTask,
      
      duration: 14, // Default duration
      progress: this.generateProgressBasedOnPhase(taskName),
      
      taskIndex: taskIndex
    };
  }

  /**
   * Determine task phase based on task name content
   */
  private determinePhaseFromName(taskName: string): 'Initiation' | 'Planning' | 'Selection' | 'Execution' | 'Closure' {
    const lowerName = taskName.toLowerCase();
    
    if (lowerName.includes('initiat') || lowerName.includes('start') || lowerName.includes('begin')) {
      return 'Initiation';
    }
    if (lowerName.includes('plan') || lowerName.includes('design') || lowerName.includes('prepare')) {
      return 'Planning';
    }
    if (lowerName.includes('submission') || lowerName.includes('submit') || lowerName.includes('review') || lowerName.includes('select')) {
      return 'Selection';
    }
    if (lowerName.includes('execut') || lowerName.includes('implement') || lowerName.includes('complete') || lowerName.includes('conduct')) {
      return 'Execution';
    }
    if (lowerName.includes('approval') || lowerName.includes('closure') || lowerName.includes('final') || lowerName.includes('decision')) {
      return 'Closure';
    }
    
    // Default based on common patterns
    if (lowerName.includes('csf') || lowerName.includes('milestone') || lowerName.includes('gate')) {
      return 'Planning';
    }
    
    return 'Selection'; // Default
  }

  /**
   * Generate realistic progress based on phase and task name
   */
  private generateProgressBasedOnPhase(taskName: string): number {
    const lowerName = taskName.toLowerCase();
    
    // Completed tasks
    if (lowerName.includes('complete') || lowerName.includes('approval') || lowerName.includes('decision')) {
      return 1.0; // 100%
    }
    
    // In progress tasks
    if (lowerName.includes('submit') || lowerName.includes('review') || lowerName.includes('conduct')) {
      return Math.random() * 0.6 + 0.3; // 30-90%
    }
    
    // Planning/future tasks
    if (lowerName.includes('initiate') || lowerName.includes('plan') || lowerName.includes('prepare')) {
      return Math.random() * 0.4; // 0-40%
    }
    
    // Default random progress
    return Math.random() * 0.8 + 0.1; // 10-90%
  }

  /**
   * Check if a task might have children based on naming patterns
   */
  private hasPotentialChildren(record: any, index: number): boolean {
    const taskName = record.name || record.pme_taskname || '';
    
    // Common parent task indicators
    const parentIndicators = [
      'timeline', 'project', 'csf', 'submission', 'section', 'phase', 
      'stage', 'group', 'module', 'package', 'bundle', 'category',
      'milestone', 'gate', 'studies', 'tech section'
    ];
    
    return parentIndicators.some(indicator => 
      taskName.toLowerCase().includes(indicator.toLowerCase())
    );
  }

// ...existing code...


  /**
   * Parse progress value (handle percentage or decimal)
   */
  private parseProgress(progressValue: any): number {
    if (progressValue === null || progressValue === undefined) {
      return 0;
    }
    
    const numValue = parseFloat(progressValue);
    if (isNaN(numValue)) {
      return 0;
    }
    
    // If value is greater than 1, assume it's a percentage
    if (numValue > 1) {
      return Math.min(numValue / 100, 1);
    }
    
    return Math.min(numValue, 1);
  }

  /**
   * Helper method to get field value from multiple possible field names
   */
  private getFieldValue(record: any, fieldNames: string[]): any {
    for (const fieldName of fieldNames) {
      if (Object.prototype.hasOwnProperty.call(record, fieldName) && record[fieldName] !== null && record[fieldName] !== undefined) {
        return record[fieldName];
      }
    }
    return null;
  }

  /**
   * Helper method to parse date strings
   */
  private parseDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Map Dataverse choice value to TaskPhase
   */
  private mapTaskPhase(choiceValue: any): 'Initiation' | 'Planning' | 'Selection' | 'Execution' | 'Closure' {
    if (!choiceValue) return 'Planning'; // Default if no value
    
    // Handle both numeric choice values and string values
    if (typeof choiceValue === 'string') {
      const lowerValue = choiceValue.toLowerCase();
      if (lowerValue.includes('initiat')) return 'Initiation';
      if (lowerValue.includes('plan')) return 'Planning';
      if (lowerValue.includes('select')) return 'Selection';
      if (lowerValue.includes('execut') || lowerValue.includes('implement')) return 'Execution';
      if (lowerValue.includes('closur') || lowerValue.includes('complet')) return 'Closure';
      
      // Check for common task type patterns
      if (lowerValue.includes('submission') || lowerValue.includes('submit')) return 'Selection';
      if (lowerValue.includes('approval') || lowerValue.includes('review')) return 'Execution';
      if (lowerValue.includes('admin')) return 'Closure';
      
      return 'Planning'; // Default for unrecognized strings
    }
    
    // Handle numeric choice values
    const numValue = parseInt(choiceValue);
    switch (numValue) {
      case 893360000: return 'Initiation';     // Blue
      case 893360001: return 'Planning';       // Red  
      case 893360002: return 'Selection';      // Orange
      case 893360003: return 'Execution';      // Green
      case 893360004: return 'Closure';        // Purple
      
      // Handle simple numeric mappings (1-5)
      case 1: return 'Initiation';
      case 2: return 'Planning';
      case 3: return 'Selection';
      case 4: return 'Execution';
      case 5: return 'Closure';
      
      default: 
        console.log(`Unknown task phase value: ${choiceValue} (type: ${typeof choiceValue})`);
        return 'Planning'; // Default fallback
    }
  }

  /**
   * Map Dataverse choice value to DependencyType
   */
  private mapDependencyType(choiceValue: number): 'StartToStart' | 'FinishToStart' | 'FinishToFinish' | 'StartToFinish' | undefined {
    if (!choiceValue) return undefined;
    
    // Map based on your actual choice values in Dataverse
    switch (choiceValue) {
      case 1: return 'FinishToStart';
      case 2: return 'StartToStart';
      case 3: return 'FinishToFinish';
      case 4: return 'StartToFinish';
      default: return 'FinishToStart';
    }
  }

  /**
   * Calculate duration between two dates
   */
  private calculateDuration(startDate: Date, endDate: Date): number {
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return Math.max(1, daysDiff);
  }

  /**
   * Generate random progress for demonstration (replace with actual field mapping)
   */
  private getRandomProgress(): number {
    return Math.floor(Math.random() * 100);
  }

  /**
   * Fetch a specific TaskData record by ID
   */
  public async fetchTaskDataById(id: string): Promise<TaskData | null> {
    try {
      const entityName = "pme_taskdatas";
      const query = `?$select=pme_tasknumber,pme_taskdataid,pme_taskname,pme_taskphase,pme_startdate,pme_finishdate,pme_projectid,pme_projectuid,pme_dependencytype,pme_successor,pme_successoruid`;
      
      const record = await this.context.webAPI.retrieveRecord(
        entityName,
        id,
        query
      );

      return {
        taskNumber: record.pme_tasknumber || '',
        taskDataId: record.pme_taskdataid || record[entityName + 'id'],
        taskName: record.pme_taskname || '',
        taskPhase: this.mapTaskPhase(record.pme_taskphase),
        startDate: record.pme_startdate ? new Date(record.pme_startdate) : new Date(),
        finishDate: record.pme_finishdate ? new Date(record.pme_finishdate) : new Date(),
        projectId: record.pme_projectid || '',
        projectUID: record.pme_projectuid || '',
        dependencyType: this.mapDependencyType(record.pme_dependencytype),
        successor: record.pme_successor || undefined,
        successorUID: record.pme_successoruid || undefined,
        duration: this.calculateDuration(
          record.pme_startdate ? new Date(record.pme_startdate) : new Date(),
          record.pme_finishdate ? new Date(record.pme_finishdate) : new Date()
        ),
        progress: this.getRandomProgress()
      };
    } catch (error) {
      console.error('Error fetching TaskData by ID:', error);
      return null;
    }
  }
}