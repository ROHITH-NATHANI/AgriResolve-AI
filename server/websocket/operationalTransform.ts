import { logger } from '../utils/logger';

interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'retain' | 'annotate' | 'move';
  position: number;
  length?: number;
  content?: any;
  attributes?: Record<string, any>;
  timestamp: Date;
  userId: string;
  sessionId: string;
}

interface TransformResult {
  transformedOp: Operation;
  priority: number;
}

interface AnnotationOperation extends Operation {
  type: 'annotate';
  annotationId: string;
  imageId: string;
  coordinates: number[];
  style: {
    color: string;
    strokeWidth: number;
    fillColor?: string;
  };
  annotationType: 'circle' | 'rectangle' | 'arrow' | 'text' | 'freehand';
}

interface ConflictResolution {
  strategy: 'last-write-wins' | 'merge' | 'user-choice' | 'priority-based';
  winner?: Operation;
  merged?: Operation;
  requiresUserInput?: boolean;
}

class OperationalTransform {
  private operationHistory: Map<string, Operation[]> = new Map();
  private conflictResolutions: Map<string, ConflictResolution> = new Map();

  /**
   * Transform two concurrent operations to maintain consistency
   * Implements the core operational transformation algorithm
   */
  public transform(op1: Operation, op2: Operation): [Operation, Operation] {
    // If operations are on different entities, no transformation needed
    if (!this.operationsConflict(op1, op2)) {
      return [op1, op2];
    }

    // Handle different operation type combinations
    if (op1.type === 'annotate' && op2.type === 'annotate') {
      return this.transformAnnotations(op1 as AnnotationOperation, op2 as AnnotationOperation);
    }

    if (op1.type === 'insert' && op2.type === 'insert') {
      return this.transformInserts(op1, op2);
    }

    if (op1.type === 'delete' && op2.type === 'delete') {
      return this.transformDeletes(op1, op2);
    }

    if (op1.type === 'insert' && op2.type === 'delete') {
      return this.transformInsertDelete(op1, op2);
    }

    if (op1.type === 'delete' && op2.type === 'insert') {
      const [transformedOp2, transformedOp1] = this.transformInsertDelete(op2, op1);
      return [transformedOp1, transformedOp2];
    }

    if (op1.type === 'move' || op2.type === 'move') {
      return this.transformWithMove(op1, op2);
    }

    // Default: return operations as-is with conflict detection
    return this.handleConflict(op1, op2);
  }

  /**
   * Transform annotation operations to prevent overlaps and conflicts
   */
  private transformAnnotations(op1: AnnotationOperation, op2: AnnotationOperation): [Operation, Operation] {
    // If annotations are on different images, no conflict
    if (op1.imageId !== op2.imageId) {
      return [op1, op2];
    }

    // Check for spatial overlap
    const overlap = this.checkSpatialOverlap(op1.coordinates, op2.coordinates);
    
    if (overlap) {
      // Apply small offset to prevent exact overlap
      const offset = this.calculateOffset(op1, op2);
      
      const transformedOp2 = {
        ...op2,
        coordinates: op2.coordinates.map((coord, index) => {
          // Only apply offset to position coordinates (first two)
          if (index < 2) {
            return coord + offset[index];
          }
          return coord;
        })
      };

      logger.debug(`Transformed overlapping annotations: ${op1.id} and ${op2.id}`);
      return [op1, transformedOp2];
    }

    return [op1, op2];
  }

  /**
   * Transform two insert operations
   */
  private transformInserts(op1: Operation, op2: Operation): [Operation, Operation] {
    if (op1.position <= op2.position) {
      // op1 comes before op2, adjust op2's position
      const transformedOp2 = {
        ...op2,
        position: op2.position + (op1.length || 1)
      };
      return [op1, transformedOp2];
    } else {
      // op2 comes before op1, adjust op1's position
      const transformedOp1 = {
        ...op1,
        position: op1.position + (op2.length || 1)
      };
      return [transformedOp1, op2];
    }
  }

  /**
   * Transform two delete operations
   */
  private transformDeletes(op1: Operation, op2: Operation): [Operation, Operation] {
    const op1End = op1.position + (op1.length || 1);
    const op2End = op2.position + (op2.length || 1);

    // No overlap
    if (op1End <= op2.position) {
      // op1 comes before op2
      const transformedOp2 = {
        ...op2,
        position: op2.position - (op1.length || 1)
      };
      return [op1, transformedOp2];
    } else if (op2End <= op1.position) {
      // op2 comes before op1
      const transformedOp1 = {
        ...op1,
        position: op1.position - (op2.length || 1)
      };
      return [transformedOp1, op2];
    } else {
      // Overlapping deletes - merge them
      const mergedOp = this.mergeDeleteOperations(op1, op2);
      const noOp = { ...op2, type: 'retain' as const, length: 0 };
      return [mergedOp, noOp];
    }
  }

  /**
   * Transform insert and delete operations
   */
  private transformInsertDelete(insertOp: Operation, deleteOp: Operation): [Operation, Operation] {
    if (insertOp.position <= deleteOp.position) {
      // Insert comes before delete
      const transformedDeleteOp = {
        ...deleteOp,
        position: deleteOp.position + (insertOp.length || 1)
      };
      return [insertOp, transformedDeleteOp];
    } else if (insertOp.position >= deleteOp.position + (deleteOp.length || 1)) {
      // Insert comes after delete
      const transformedInsertOp = {
        ...insertOp,
        position: insertOp.position - (deleteOp.length || 1)
      };
      return [transformedInsertOp, deleteOp];
    } else {
      // Insert is within delete range - prioritize based on timestamp
      if (insertOp.timestamp < deleteOp.timestamp) {
        // Insert happened first, adjust delete
        const transformedDeleteOp = {
          ...deleteOp,
          length: (deleteOp.length || 1) + (insertOp.length || 1)
        };
        return [insertOp, transformedDeleteOp];
      } else {
        // Delete happened first, cancel insert
        const noOpInsert = { ...insertOp, type: 'retain' as const, length: 0 };
        return [noOpInsert, deleteOp];
      }
    }
  }

  /**
   * Transform operations involving move operations
   */
  private transformWithMove(op1: Operation, op2: Operation): [Operation, Operation] {
    // Move operations are complex and require special handling
    // For now, use timestamp-based priority
    if (op1.timestamp < op2.timestamp) {
      return [op1, op2];
    } else {
      return [op2, op1];
    }
  }

  /**
   * Handle conflicts when operations cannot be automatically transformed
   */
  private handleConflict(op1: Operation, op2: Operation): [Operation, Operation] {
    const conflictId = `${op1.sessionId}-${op1.id}-${op2.id}`;
    
    // Check if we have a resolution strategy for this type of conflict
    const resolution = this.getConflictResolution(op1, op2);
    
    switch (resolution.strategy) {
      case 'last-write-wins':
        return op1.timestamp > op2.timestamp ? [op1, this.createNoOp(op2)] : [this.createNoOp(op1), op2];
      
      case 'priority-based':
        const priority1 = this.getOperationPriority(op1);
        const priority2 = this.getOperationPriority(op2);
        return priority1 > priority2 ? [op1, this.createNoOp(op2)] : [this.createNoOp(op1), op2];
      
      case 'merge':
        if (resolution.merged) {
          return [resolution.merged, this.createNoOp(op2)];
        }
        // Fall through to last-write-wins if merge failed
        return op1.timestamp > op2.timestamp ? [op1, this.createNoOp(op2)] : [this.createNoOp(op1), op2];
      
      case 'user-choice':
        // Store conflict for user resolution
        this.conflictResolutions.set(conflictId, resolution);
        logger.warn(`Conflict requires user resolution: ${conflictId}`);
        return [op1, op2]; // Return both for now
      
      default:
        return [op1, op2];
    }
  }

  /**
   * Check if two operations conflict with each other
   */
  private operationsConflict(op1: Operation, op2: Operation): boolean {
    // Same session and overlapping positions/entities
    if (op1.sessionId !== op2.sessionId) {
      return false;
    }

    // Annotation operations conflict if they're on the same image
    if (op1.type === 'annotate' && op2.type === 'annotate') {
      const ann1 = op1 as AnnotationOperation;
      const ann2 = op2 as AnnotationOperation;
      return ann1.imageId === ann2.imageId;
    }

    // Text operations conflict if they have overlapping positions
    const op1End = op1.position + (op1.length || 1);
    const op2End = op2.position + (op2.length || 1);
    
    return !(op1End <= op2.position || op2End <= op1.position);
  }

  /**
   * Check if two annotation coordinates overlap spatially
   */
  private checkSpatialOverlap(coords1: number[], coords2: number[]): boolean {
    if (coords1.length < 2 || coords2.length < 2) {
      return false;
    }

    // Simple distance-based overlap check
    const distance = Math.sqrt(
      Math.pow(coords1[0] - coords2[0], 2) + 
      Math.pow(coords1[1] - coords2[1], 2)
    );

    // Consider overlapping if within 10 pixels
    return distance < 10;
  }

  /**
   * Calculate offset to prevent annotation overlap
   */
  private calculateOffset(op1: AnnotationOperation, op2: AnnotationOperation): number[] {
    const baseOffset = 15; // pixels
    const angle = Math.random() * 2 * Math.PI; // Random direction
    
    return [
      Math.cos(angle) * baseOffset,
      Math.sin(angle) * baseOffset
    ];
  }

  /**
   * Merge overlapping delete operations
   */
  private mergeDeleteOperations(op1: Operation, op2: Operation): Operation {
    const startPos = Math.min(op1.position, op2.position);
    const endPos = Math.max(
      op1.position + (op1.length || 1),
      op2.position + (op2.length || 1)
    );

    return {
      ...op1,
      id: `merged-${op1.id}-${op2.id}`,
      position: startPos,
      length: endPos - startPos,
      timestamp: new Date() // New timestamp for merged operation
    };
  }

  /**
   * Get conflict resolution strategy for two operations
   */
  private getConflictResolution(op1: Operation, op2: Operation): ConflictResolution {
    // Default strategies based on operation types
    if (op1.type === 'annotate' && op2.type === 'annotate') {
      return { strategy: 'merge' };
    }

    if (op1.type === 'delete' && op2.type === 'delete') {
      return { strategy: 'merge' };
    }

    // For most other conflicts, use priority-based resolution
    return { strategy: 'priority-based' };
  }

  /**
   * Get priority score for an operation (higher = more important)
   */
  private getOperationPriority(op: Operation): number {
    let priority = 0;

    // User role priority (experts > farmers > observers)
    // This would need to be passed in or looked up
    priority += 10; // Base priority

    // Operation type priority
    switch (op.type) {
      case 'annotate':
        priority += 5; // Annotations are important
        break;
      case 'insert':
        priority += 3;
        break;
      case 'delete':
        priority += 2;
        break;
      case 'move':
        priority += 1;
        break;
    }

    // Timestamp priority (more recent = higher priority)
    const ageInMinutes = (Date.now() - op.timestamp.getTime()) / (1000 * 60);
    priority += Math.max(0, 10 - ageInMinutes); // Decay over 10 minutes

    return priority;
  }

  /**
   * Create a no-op operation (does nothing)
   */
  private createNoOp(originalOp: Operation): Operation {
    return {
      ...originalOp,
      type: 'retain',
      length: 0,
      id: `noop-${originalOp.id}`
    };
  }

  /**
   * Apply a sequence of operations to maintain consistency
   */
  public applyOperations(sessionId: string, operations: Operation[]): Operation[] {
    const sessionHistory = this.operationHistory.get(sessionId) || [];
    const transformedOps: Operation[] = [];

    for (const newOp of operations) {
      let transformedOp = newOp;

      // Transform against all concurrent operations
      for (const historyOp of sessionHistory) {
        if (historyOp.timestamp > newOp.timestamp) {
          const [, transformed] = this.transform(historyOp, transformedOp);
          transformedOp = transformed;
        }
      }

      transformedOps.push(transformedOp);
      sessionHistory.push(transformedOp);
    }

    // Update history (keep last 1000 operations)
    if (sessionHistory.length > 1000) {
      sessionHistory.splice(0, sessionHistory.length - 1000);
    }
    this.operationHistory.set(sessionId, sessionHistory);

    return transformedOps;
  }

  /**
   * Get pending conflicts that require user resolution
   */
  public getPendingConflicts(sessionId: string): ConflictResolution[] {
    const conflicts: ConflictResolution[] = [];
    
    for (const [conflictId, resolution] of this.conflictResolutions.entries()) {
      if (conflictId.startsWith(sessionId) && resolution.requiresUserInput) {
        conflicts.push(resolution);
      }
    }

    return conflicts;
  }

  /**
   * Resolve a conflict with user input
   */
  public resolveConflict(conflictId: string, resolution: ConflictResolution): void {
    this.conflictResolutions.set(conflictId, resolution);
    logger.info(`Conflict resolved: ${conflictId} using ${resolution.strategy}`);
  }

  /**
   * Clean up old operation history and conflicts
   */
  public cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge);

    // Clean up operation history
    for (const [sessionId, operations] of this.operationHistory.entries()) {
      const filteredOps = operations.filter(op => op.timestamp > cutoff);
      if (filteredOps.length === 0) {
        this.operationHistory.delete(sessionId);
      } else {
        this.operationHistory.set(sessionId, filteredOps);
      }
    }

    // Clean up old conflicts
    for (const [conflictId, resolution] of this.conflictResolutions.entries()) {
      // Remove resolved conflicts older than 1 hour
      if (!resolution.requiresUserInput) {
        this.conflictResolutions.delete(conflictId);
      }
    }

    logger.debug('Operational transform cleanup completed');
  }
}

export const operationalTransform = new OperationalTransform();

// Start cleanup timer
setInterval(() => {
  operationalTransform.cleanup();
}, 60 * 60 * 1000); // Run cleanup every hour