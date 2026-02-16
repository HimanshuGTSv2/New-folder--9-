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
  public async fetchTaskData(isLoadMore: boolean = false, pageSize: number = 50, projectId?: string): Promise<TaskData[]> {
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

      // Check cache first - include projectId in cache key
      const cacheKey = isLoadMore ? `more-${this.lastLoadedDate}-${projectId || 'all'}` : `initial-${projectId || 'all'}`;
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
      
      // Build filter conditions
      let filterConditions: string[] = [];
      
      // Add project filter if projectId is provided
      if (projectId && projectId.trim() !== '') {
        filterConditions.push(`pme_projectuid eq '${projectId.trim()}'`);
      }
      
      // Add cursor filter for load more operations
      if (isLoadMore && this.lastLoadedDate) {
        // Format the date properly for OData filter
        const isoDate = new Date(this.lastLoadedDate).toISOString();
        filterConditions.push(`createdon lt ${isoDate}`);
      }
      
      // Combine filter conditions
      if (filterConditions.length > 0) {
        query += `&$filter=${filterConditions.join(' and ')}`;
      }
      
      // Add count only for the first request
      if (!isLoadMore) {
        query += `&$count=true`;
      }
      
      console.log(`Fetching ${isLoadMore ? 'more' : 'initial'} data with query: ${query}`);
      console.log(`Project filter: ${projectId ? `pme_projectuid = '${projectId}'` : 'No project filter'}`);
      
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
        return this.fetchTaskData(isLoadMore, Math.floor(pageSize / 2), projectId);
      }
      
      throw error;
    }
  }

  /**
   * Load more data (for infinite scrolling)
   */
  public async loadMoreData(projectId?: string): Promise<TaskData[]> {
    if (!this.hasMoreData) {
      console.log('No more data to load');
      return [];
    }

    const newTasks = await this.fetchTaskData(true, this.pageSize, projectId);
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
  public async refreshData(pageSize: number = 100, projectId?: string): Promise<TaskData[]> {
    this.clearCache();
    this.allLoadedTasks = [];
    return await this.fetchTaskData(false, pageSize, projectId);
  }

  /**
   * Determine the correct entity name
   */
  private async determineEntityName(): Promise<void> {
    const possibleEntityNames = [
      "pme_taskdata",      // From the form you're creating (primary)
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
    
    // Map to your exact Dataverse column names from the screenshots:
    // - PercentComplete (Whole number field)
    // - Duration (Decimal field) 
    // - FinishDate (Date field)
    // - StartDate (Date field)
    
    // Get task ID - check for both schema name and logical name
    const taskId = record.pme_taskdataid || record.id || `task-${index}`;
    
    // Get TaskWBS - the new Index Column (fallback to taskNumber if not available)
    const taskWBS = record.pme_taskwbs || record.taskwbs || `${index + 1}`;
    
    // Get task name - check multiple possible field names
    const taskName = record.pme_taskname || record.pme_name || record.name || `Task ${index + 1}`;
    
    // Get parent task information - pme_parenttask is a lookup field
    const rawParentTask = record.pme_parenttaskuid || record.parenttaskuid || record.pme_parenttask;
    
    // Prevent circular references: a task cannot be its own parent
    const parentTask = rawParentTask === taskId ? undefined : rawParentTask;
    
    // Debug circular reference prevention
    if (rawParentTask === taskId) {
      console.log(`🔄 Prevented circular reference for task: ${taskName} (${taskId})`);
    }
    
    // Get successor information - pme_successor is also a lookup field
    const successor = this.getLookupValue(record, 'pme_successor') || record.successor;
    const successorUID = record.pme_successoruid || record.successorUID;
    const dependencyType = record.pme_dependencytype || record.dependencyType;
    
    // Parse dates from your exact column names
    const startDate = this.parseDate(record.pme_startdate || record.StartDate) || new Date();
    const finishDate = this.parseDate(record.pme_finishdate || record.FinishDate) || new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    
    // Parse duration from your exact column name
    const duration = this.parseDuration(record.pme_duration || record.Duration) || this.calculateDuration(startDate, finishDate);
    
    // Parse progress from your exact column name (PercentComplete as whole number 0-100)
    const progress = this.parsePercentComplete(record.pme_percentcomplete || record.PercentComplete);
    
    // Determine if this is a summary task
    const isSummaryTask = record.pme_issummarytask || this.hasPotentialChildren(record, index);
    
    // Determine if this is a milestone task
    const isMilestone = record.pme_ismilestone === true || record.pme_ismilestone === 1;
    
    // Get task index for sorting
    const taskIndex = record.pme_taskindex || record.taskindex || index;
    
    console.log(`Transform record ${index}: 
      taskId=${taskId}, 
      taskName=${taskName}
      startDate=${startDate.toISOString().split('T')[0]},
      finishDate=${finishDate.toISOString().split('T')[0]},
      duration=${duration} days,
      progress=${Math.round(progress * 100)}%,
      isSummaryTask=${isSummaryTask}, 
      isMilestone=${isMilestone}, 
      parentTask=${parentTask}, 
      taskIndex=${taskIndex}`);
    
    return {
      taskWBS: taskWBS,
      taskNumber: record.pme_tasknumber || `${index + 1}`,
      taskDataId: taskId,
      taskName: taskName,
      startDate: startDate,
      finishDate: finishDate,
      duration: duration,
      progress: progress,
      
      // Handle project fields - pme_projectid might also be a lookup
      projectId: record.pme_projectuid || record.projectuid || this.getLookupValue(record, 'pme_projectid') || 'Project-001',
      projectUID: record.pme_projectuid || `project-uid-${taskId}`,
      
      dependencyType: this.mapDependencyType(dependencyType),
      successor: successor,
      successorUID: successorUID,
      
      isSummaryTask: isSummaryTask,
      isMilestone: isMilestone,
      parentTask: parentTask,
      taskIndex: taskIndex
    };
  }

  /**
   * Generate realistic progress based on task name
   */
  private generateProgressBasedOnTaskName(taskName: string): number {
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
   * Parse duration value from Dataverse (expects decimal number in days)
   */
  private parseDuration(durationValue: any): number {
    if (durationValue === null || durationValue === undefined) {
      return 1; // Default 1 day duration
    }
    
    const numValue = parseFloat(durationValue);
    if (isNaN(numValue) || numValue <= 0) {
      return 1; // Default 1 day for invalid values
    }
    
    return Math.max(1, Math.round(numValue)); // Ensure at least 1 day, rounded to whole number
  }

  /**
   * Parse PercentComplete value from Dataverse (expects whole number 0-100)
   */
  private parsePercentComplete(percentValue: any): number {
    if (percentValue === null || percentValue === undefined) {
      return 0; // Default 0% progress
    }
    
    const numValue = parseFloat(percentValue);
    if (isNaN(numValue)) {
      return 0;
    }
    
    // PercentComplete is stored as whole number (0-100), convert to decimal (0-1)
    return Math.max(0, Math.min(100, numValue)) / 100;
  }

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
   * Helper method to get lookup field value (handles both _fieldname_value and fieldname)
   */
  private getLookupValue(record: any, fieldName: string): any {
    // Try navigation property first (_fieldname_value)
    const navigationProperty = `_${fieldName}_value`;
    if (record[navigationProperty] !== undefined && record[navigationProperty] !== null) {
      return record[navigationProperty];
    }
    
    // Fall back to direct field name
    if (record[fieldName] !== undefined && record[fieldName] !== null) {
      return record[fieldName];
    }
    
    return null;
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
      const query = `?$select=pme_tasknumber,pme_taskdataid,pme_taskname,pme_startdate,pme_finishdate,_pme_projectid_value,pme_projectuid,pme_dependencytype,_pme_successor_value,pme_successoruid`;
      
      const record = await this.context.webAPI.retrieveRecord(
        entityName,
        id,
        query
      );

      return {
        taskWBS: record.pme_taskwbs || '',
        taskNumber: record.pme_tasknumber || '',
        taskDataId: record.pme_taskdataid || record[entityName + 'id'],
        taskName: record.pme_taskname || '',
        startDate: record.pme_startdate ? new Date(record.pme_startdate) : new Date(),
        finishDate: record.pme_finishdate ? new Date(record.pme_finishdate) : new Date(),
        projectId: this.getLookupValue(record, 'pme_projectid') || '',
        projectUID: record.pme_projectuid || '',
        dependencyType: this.mapDependencyType(record.pme_dependencytype),
        successor: this.getLookupValue(record, 'pme_successor') || undefined,
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