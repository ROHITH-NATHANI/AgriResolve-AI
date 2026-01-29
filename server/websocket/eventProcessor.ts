import { logger } from '../utils/logger';
import { operationalTransform } from './operationalTransform';

interface WorkspaceUpdate {
  type: 'annotation' | 'diagnostic' | 'image' | 'recommendation';
  data: any;
  userId: string;
  timestamp: Date;
  sequenceNumber: number;
  operationId?: string;
}

interface AnnotationUpdate {
  annotationId: string;
  imageId: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  userId: string;
  timestamp: Date;
  operationId?: string;
}

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

class EventProcessor {
  private sequenceCounters: Map<string, number> = new Map();

  public async processWorkspaceUpdate(
    sessionId: string,
    userId: string,
    updateData: any
  ): Promise<WorkspaceUpdate> {
    // Generate sequence number for ordering
    const currentSequence = this.sequenceCounters.get(sessionId) || 0;
    const sequenceNumber = currentSequence + 1;
    this.sequenceCounters.set(sessionId, sequenceNumber);

    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const update: WorkspaceUpdate = {
      type: updateData.type,
      data: this.sanitizeUpdateData(updateData.data),
      userId,
      timestamp: new Date(),
      sequenceNumber,
      operationId
    };

    // Apply operational transformation for concurrent edits
    if (updateData.type === 'annotation') {
      update.data = await this.applyOperationalTransform(sessionId, userId, update.data, operationId);
    }

    logger.debug(`Processed workspace update for session ${sessionId}: ${update.type}`);
    return update;
  }

  public async processAnnotationUpdate(
    sessionId: string,
    userId: string,
    annotationData: any
  ): Promise<AnnotationUpdate> {
    const operationId = `ann-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const update: AnnotationUpdate = {
      annotationId: annotationData.annotationId || this.generateId(),
      imageId: annotationData.imageId,
      operation: annotationData.operation || 'create',
      data: this.sanitizeAnnotationData(annotationData.data),
      userId,
      timestamp: new Date(),
      operationId
    };

    // Validate annotation data
    if (!this.validateAnnotationData(update.data)) {
      throw new Error('Invalid annotation data');
    }

    // Apply operational transformation for concurrent annotation edits
    const transformedData = await this.applyAnnotationTransform(sessionId, userId, update, operationId);
    update.data = transformedData;

    logger.debug(`Processed annotation update for session ${sessionId}: ${update.operation}`);
    return update;
  }

  private sanitizeUpdateData(data: any): any {
    // Remove any potentially harmful data
    const sanitized = { ...data };
    
    // Remove script tags and dangerous HTML
    if (typeof sanitized.content === 'string') {
      sanitized.content = sanitized.content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }

    // Validate coordinates if present
    if (sanitized.coordinates && Array.isArray(sanitized.coordinates)) {
      sanitized.coordinates = sanitized.coordinates.map((coord: any) => {
        const num = parseFloat(coord);
        return isNaN(num) ? 0 : Math.max(0, Math.min(10000, num)); // Clamp to reasonable range
      });
    }

    return sanitized;
  }

  private sanitizeAnnotationData(data: any): any {
    const sanitized = { ...data };

    // Validate annotation type
    const validTypes = ['circle', 'rectangle', 'arrow', 'text', 'freehand'];
    if (!validTypes.includes(sanitized.type)) {
      sanitized.type = 'freehand';
    }

    // Sanitize coordinates
    if (sanitized.coordinates && Array.isArray(sanitized.coordinates)) {
      sanitized.coordinates = sanitized.coordinates.map((coord: any) => {
        const num = parseFloat(coord);
        return isNaN(num) ? 0 : Math.max(0, Math.min(10000, num));
      });
    }

    // Sanitize style properties
    if (sanitized.style) {
      sanitized.style = {
        color: this.sanitizeColor(sanitized.style.color) || '#000000',
        strokeWidth: Math.max(1, Math.min(20, parseInt(sanitized.style.strokeWidth) || 2)),
        fillColor: sanitized.style.fillColor ? this.sanitizeColor(sanitized.style.fillColor) : undefined
      };
    }

    // Sanitize text content
    if (sanitized.text) {
      sanitized.text = sanitized.text
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .substring(0, 500); // Limit length
    }

    return sanitized;
  }

  private sanitizeColor(color: string): string | null {
    // Basic color validation - accept hex colors and common color names
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const commonColors = ['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'black', 'white', 'gray'];
    
    if (hexColorRegex.test(color) || commonColors.includes(color.toLowerCase())) {
      return color;
    }
    
    return null;
  }

  private validateAnnotationData(data: any): boolean {
    // Basic validation
    if (!data.type || !data.coordinates) {
      return false;
    }

    // Validate coordinates array
    if (!Array.isArray(data.coordinates) || data.coordinates.length === 0) {
      return false;
    }

    // Type-specific validation
    switch (data.type) {
      case 'circle':
        return data.coordinates.length >= 3; // x, y, radius
      case 'rectangle':
        return data.coordinates.length >= 4; // x, y, width, height
      case 'arrow':
        return data.coordinates.length >= 4; // x1, y1, x2, y2
      case 'text':
        return data.coordinates.length >= 2 && data.text; // x, y, text
      case 'freehand':
        return data.coordinates.length >= 4; // At least 2 points (x1, y1, x2, y2)
      default:
        return false;
    }
  }

  private async applyOperationalTransform(sessionId: string, userId: string, annotationData: any, operationId: string): Promise<any> {
    // Create operation for operational transformation
    const operation: Operation = {
      id: operationId,
      type: 'annotate',
      position: 0, // For annotations, position is spatial
      content: annotationData,
      timestamp: new Date(),
      userId,
      sessionId,
      attributes: {
        imageId: annotationData.imageId,
        coordinates: annotationData.coordinates,
        annotationType: annotationData.type
      }
    };

    // Apply operational transformation
    const transformedOps = operationalTransform.applyOperations(sessionId, [operation]);
    
    if (transformedOps.length > 0) {
      const transformedOp = transformedOps[0];
      
      // If operation was transformed, update the annotation data
      if (transformedOp.content && transformedOp.content !== annotationData) {
        logger.debug(`Annotation transformed due to concurrent edits: ${operationId}`);
        return transformedOp.content;
      }
    }

    return annotationData;
  }

  private async applyAnnotationTransform(sessionId: string, userId: string, update: AnnotationUpdate, operationId: string): Promise<any> {
    // Create operation for annotation-specific transformation
    const operation: Operation = {
      id: operationId,
      type: 'annotate',
      position: 0,
      content: update.data,
      timestamp: update.timestamp,
      userId,
      sessionId,
      attributes: {
        annotationId: update.annotationId,
        imageId: update.imageId,
        operation: update.operation,
        coordinates: update.data.coordinates,
        annotationType: update.data.type
      }
    };

    // Apply operational transformation
    const transformedOps = operationalTransform.applyOperations(sessionId, [operation]);
    
    if (transformedOps.length > 0) {
      const transformedOp = transformedOps[0];
      
      // Return transformed content if it was modified
      if (transformedOp.content && transformedOp.content !== update.data) {
        logger.debug(`Annotation operation transformed: ${update.operation} for ${update.annotationId}`);
        return transformedOp.content;
      }
    }

    return update.data;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getSequenceNumber(sessionId: string): number {
    return this.sequenceCounters.get(sessionId) || 0;
  }

  public resetSequenceCounter(sessionId: string): void {
    this.sequenceCounters.delete(sessionId);
  }

  /**
   * Get pending conflicts for a session that require user resolution
   */
  public getPendingConflicts(sessionId: string): any[] {
    return operationalTransform.getPendingConflicts(sessionId);
  }

  /**
   * Resolve a conflict with user input
   */
  public resolveConflict(conflictId: string, resolution: any): void {
    operationalTransform.resolveConflict(conflictId, resolution);
    logger.info(`Conflict resolved by user: ${conflictId}`);
  }

  /**
   * Handle real-time conflict notifications
   */
  public async handleConflictResolution(sessionId: string, conflictId: string, resolution: any): Promise<void> {
    try {
      this.resolveConflict(conflictId, resolution);
      
      // Notify all session participants about the resolution
      // This would be handled by the websocket manager
      logger.debug(`Conflict resolution processed for session ${sessionId}: ${conflictId}`);
    } catch (error) {
      logger.error('Error handling conflict resolution:', error);
      throw error;
    }
  }

  /**
   * Batch process multiple operations for better performance
   */
  public async processBatchOperations(sessionId: string, userId: string, operations: any[]): Promise<WorkspaceUpdate[]> {
    const updates: WorkspaceUpdate[] = [];
    
    try {
      // Process all operations together for better transformation
      const transformedOps: Operation[] = [];
      
      for (const opData of operations) {
        const operationId = `batch-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const operation: Operation = {
          id: operationId,
          type: opData.type || 'annotate',
          position: opData.position || 0,
          content: opData.data,
          timestamp: new Date(),
          userId,
          sessionId,
          attributes: opData.attributes || {}
        };
        
        transformedOps.push(operation);
      }
      
      // Apply batch transformation
      const finalOps = operationalTransform.applyOperations(sessionId, transformedOps);
      
      // Convert back to workspace updates
      for (let i = 0; i < finalOps.length; i++) {
        const op = finalOps[i];
        const originalData = operations[i];
        
        const currentSequence = this.sequenceCounters.get(sessionId) || 0;
        const sequenceNumber = currentSequence + i + 1;
        
        const update: WorkspaceUpdate = {
          type: originalData.type || 'annotation',
          data: op.content || originalData.data,
          userId,
          timestamp: op.timestamp,
          sequenceNumber,
          operationId: op.id
        };
        
        updates.push(update);
      }
      
      // Update sequence counter
      this.sequenceCounters.set(sessionId, (this.sequenceCounters.get(sessionId) || 0) + operations.length);
      
      logger.debug(`Processed batch of ${operations.length} operations for session ${sessionId}`);
      return updates;
    } catch (error) {
      logger.error('Error processing batch operations:', error);
      throw error;
    }
  }
}

export const eventProcessor = new EventProcessor();