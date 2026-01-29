import { logger } from '../utils/logger';
import { eventProcessor } from './eventProcessor';
import { websocketManager } from './websocketManager';

interface AnnotationTool {
  id: string;
  name: string;
  type: 'drawing' | 'measurement' | 'text' | 'shape';
  icon: string;
  cursor: string;
  settings: ToolSettings;
}

interface ToolSettings {
  strokeWidth: number;
  strokeColor: string;
  fillColor?: string;
  fontSize?: number;
  fontFamily?: string;
  opacity: number;
  lineDash?: number[];
}

interface DrawingState {
  sessionId: string;
  userId: string;
  toolId: string;
  isDrawing: boolean;
  currentPath: DrawingPoint[];
  startPoint?: DrawingPoint;
  endPoint?: DrawingPoint;
  settings: ToolSettings;
}

interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
  timestamp: number;
}

interface AnnotationData {
  id: string;
  type: 'circle' | 'rectangle' | 'arrow' | 'text' | 'freehand' | 'line' | 'polygon';
  coordinates: number[];
  style: ToolSettings;
  text?: string;
  measurements?: {
    length?: number;
    area?: number;
    perimeter?: number;
    unit: string;
  };
  metadata: {
    createdBy: string;
    createdAt: Date;
    imageId: string;
    layerId?: string;
    version: number;
  };
}

class AnnotationToolManager {
  private availableTools: Map<string, AnnotationTool> = new Map();
  private activeDrawingStates: Map<string, DrawingState> = new Map();
  private annotationLayers: Map<string, AnnotationData[]> = new Map();

  constructor() {
    this.initializeDefaultTools();
  }

  private initializeDefaultTools(): void {
    const defaultTools: AnnotationTool[] = [
      {
        id: 'freehand',
        name: 'Freehand Drawing',
        type: 'drawing',
        icon: 'pencil',
        cursor: 'crosshair',
        settings: {
          strokeWidth: 2,
          strokeColor: '#ff0000',
          opacity: 1
        }
      },
      {
        id: 'circle',
        name: 'Circle',
        type: 'shape',
        icon: 'circle',
        cursor: 'crosshair',
        settings: {
          strokeWidth: 2,
          strokeColor: '#00ff00',
          fillColor: 'transparent',
          opacity: 1
        }
      },
      {
        id: 'rectangle',
        name: 'Rectangle',
        type: 'shape',
        icon: 'square',
        cursor: 'crosshair',
        settings: {
          strokeWidth: 2,
          strokeColor: '#0000ff',
          fillColor: 'transparent',
          opacity: 1
        }
      },
      {
        id: 'arrow',
        name: 'Arrow',
        type: 'shape',
        icon: 'arrow-right',
        cursor: 'crosshair',
        settings: {
          strokeWidth: 3,
          strokeColor: '#ff8800',
          opacity: 1
        }
      },
      {
        id: 'text',
        name: 'Text Annotation',
        type: 'text',
        icon: 'type',
        cursor: 'text',
        settings: {
          strokeWidth: 1,
          strokeColor: '#000000',
          fontSize: 16,
          fontFamily: 'Arial, sans-serif',
          opacity: 1
        }
      },
      {
        id: 'ruler',
        name: 'Measurement Tool',
        type: 'measurement',
        icon: 'ruler',
        cursor: 'crosshair',
        settings: {
          strokeWidth: 2,
          strokeColor: '#8800ff',
          opacity: 1
        }
      },
      {
        id: 'polygon',
        name: 'Polygon',
        type: 'shape',
        icon: 'polygon',
        cursor: 'crosshair',
        settings: {
          strokeWidth: 2,
          strokeColor: '#ff0088',
          fillColor: 'transparent',
          opacity: 1
        }
      }
    ];

    defaultTools.forEach(tool => {
      this.availableTools.set(tool.id, tool);
    });

    logger.info(`Initialized ${defaultTools.length} annotation tools`);
  }

  /**
   * Get all available annotation tools
   */
  public getAvailableTools(): AnnotationTool[] {
    return Array.from(this.availableTools.values());
  }

  /**
   * Get a specific tool by ID
   */
  public getTool(toolId: string): AnnotationTool | undefined {
    return this.availableTools.get(toolId);
  }

  /**
   * Start drawing with a specific tool
   */
  public async startDrawing(
    sessionId: string,
    userId: string,
    toolId: string,
    startPoint: DrawingPoint,
    settings?: Partial<ToolSettings>
  ): Promise<void> {
    const tool = this.availableTools.get(toolId);
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    const drawingStateId = `${sessionId}-${userId}`;
    const finalSettings = { ...tool.settings, ...settings };

    const drawingState: DrawingState = {
      sessionId,
      userId,
      toolId,
      isDrawing: true,
      currentPath: [startPoint],
      startPoint,
      settings: finalSettings
    };

    this.activeDrawingStates.set(drawingStateId, drawingState);

    // Notify other participants that drawing has started
    websocketManager.broadcastToSession(sessionId, 'drawing-started', {
      userId,
      toolId,
      startPoint,
      settings: finalSettings,
      timestamp: new Date().toISOString()
    });

    logger.debug(`Drawing started: ${toolId} by ${userId} in session ${sessionId}`);
  }

  /**
   * Continue drawing (add points to current path)
   */
  public async continueDrawing(
    sessionId: string,
    userId: string,
    point: DrawingPoint
  ): Promise<void> {
    const drawingStateId = `${sessionId}-${userId}`;
    const drawingState = this.activeDrawingStates.get(drawingStateId);

    if (!drawingState || !drawingState.isDrawing) {
      throw new Error('No active drawing state found');
    }

    drawingState.currentPath.push(point);

    // Broadcast drawing progress for real-time collaboration
    websocketManager.broadcastToSession(sessionId, 'drawing-progress', {
      userId,
      point,
      pathLength: drawingState.currentPath.length,
      timestamp: new Date().toISOString()
    });

    logger.debug(`Drawing progress: ${drawingState.toolId} by ${userId}`);
  }

  /**
   * Finish drawing and create annotation
   */
  public async finishDrawing(
    sessionId: string,
    userId: string,
    endPoint?: DrawingPoint,
    text?: string
  ): Promise<AnnotationData> {
    const drawingStateId = `${sessionId}-${userId}`;
    const drawingState = this.activeDrawingStates.get(drawingStateId);

    if (!drawingState || !drawingState.isDrawing) {
      throw new Error('No active drawing state found');
    }

    if (endPoint) {
      drawingState.endPoint = endPoint;
      drawingState.currentPath.push(endPoint);
    }

    // Create annotation from drawing state
    const annotation = this.createAnnotationFromDrawing(drawingState, text);

    // Process annotation through event processor for operational transformation
    const annotationUpdate = await eventProcessor.processAnnotationUpdate(
      sessionId,
      userId,
      {
        annotationId: annotation.id,
        imageId: annotation.metadata.imageId,
        operation: 'create',
        data: annotation
      }
    );

    // Add to annotation layer
    const layerId = annotation.metadata.layerId || 'default';
    const sessionLayerKey = `${sessionId}-${layerId}`;
    
    if (!this.annotationLayers.has(sessionLayerKey)) {
      this.annotationLayers.set(sessionLayerKey, []);
    }
    
    this.annotationLayers.get(sessionLayerKey)!.push(annotation);

    // Clean up drawing state
    drawingState.isDrawing = false;
    this.activeDrawingStates.delete(drawingStateId);

    // Notify participants of completed annotation
    websocketManager.broadcastToSession(sessionId, 'annotation-created', {
      annotation: annotationUpdate.data,
      userId,
      timestamp: new Date().toISOString()
    });

    logger.info(`Annotation created: ${annotation.type} by ${userId} in session ${sessionId}`);
    return annotation;
  }

  /**
   * Cancel current drawing
   */
  public async cancelDrawing(sessionId: string, userId: string): Promise<void> {
    const drawingStateId = `${sessionId}-${userId}`;
    const drawingState = this.activeDrawingStates.get(drawingStateId);

    if (drawingState) {
      drawingState.isDrawing = false;
      this.activeDrawingStates.delete(drawingStateId);

      // Notify participants of cancelled drawing
      websocketManager.broadcastToSession(sessionId, 'drawing-cancelled', {
        userId,
        toolId: drawingState.toolId,
        timestamp: new Date().toISOString()
      });

      logger.debug(`Drawing cancelled: ${drawingState.toolId} by ${userId}`);
    }
  }

  /**
   * Update annotation
   */
  public async updateAnnotation(
    sessionId: string,
    userId: string,
    annotationId: string,
    updates: Partial<AnnotationData>
  ): Promise<AnnotationData> {
    // Find annotation in layers
    let annotation: AnnotationData | undefined;
    let layerKey: string | undefined;

    for (const [key, annotations] of this.annotationLayers.entries()) {
      if (key.startsWith(sessionId)) {
        const found = annotations.find(ann => ann.id === annotationId);
        if (found) {
          annotation = found;
          layerKey = key;
          break;
        }
      }
    }

    if (!annotation || !layerKey) {
      throw new Error(`Annotation not found: ${annotationId}`);
    }

    // Update annotation
    const updatedAnnotation = {
      ...annotation,
      ...updates,
      metadata: {
        ...annotation.metadata,
        version: annotation.metadata.version + 1
      }
    };

    // Process update through event processor
    const annotationUpdate = await eventProcessor.processAnnotationUpdate(
      sessionId,
      userId,
      {
        annotationId,
        imageId: annotation.metadata.imageId,
        operation: 'update',
        data: updatedAnnotation
      }
    );

    // Update in layer
    const annotations = this.annotationLayers.get(layerKey)!;
    const index = annotations.findIndex(ann => ann.id === annotationId);
    annotations[index] = updatedAnnotation;

    // Notify participants
    websocketManager.broadcastToSession(sessionId, 'annotation-updated', {
      annotation: annotationUpdate.data,
      userId,
      timestamp: new Date().toISOString()
    });

    logger.info(`Annotation updated: ${annotationId} by ${userId}`);
    return updatedAnnotation;
  }

  /**
   * Delete annotation
   */
  public async deleteAnnotation(
    sessionId: string,
    userId: string,
    annotationId: string
  ): Promise<void> {
    // Find and remove annotation from layers
    let removed = false;

    for (const [key, annotations] of this.annotationLayers.entries()) {
      if (key.startsWith(sessionId)) {
        const index = annotations.findIndex(ann => ann.id === annotationId);
        if (index !== -1) {
          const annotation = annotations[index];
          annotations.splice(index, 1);
          removed = true;

          // Process deletion through event processor
          await eventProcessor.processAnnotationUpdate(
            sessionId,
            userId,
            {
              annotationId,
              imageId: annotation.metadata.imageId,
              operation: 'delete',
              data: annotation
            }
          );

          break;
        }
      }
    }

    if (!removed) {
      throw new Error(`Annotation not found: ${annotationId}`);
    }

    // Notify participants
    websocketManager.broadcastToSession(sessionId, 'annotation-deleted', {
      annotationId,
      userId,
      timestamp: new Date().toISOString()
    });

    logger.info(`Annotation deleted: ${annotationId} by ${userId}`);
  }

  /**
   * Get all annotations for a session
   */
  public getSessionAnnotations(sessionId: string, layerId?: string): AnnotationData[] {
    const allAnnotations: AnnotationData[] = [];

    for (const [key, annotations] of this.annotationLayers.entries()) {
      if (key.startsWith(sessionId)) {
        if (!layerId || key.endsWith(`-${layerId}`)) {
          allAnnotations.push(...annotations);
        }
      }
    }

    return allAnnotations.sort((a, b) => 
      a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime()
    );
  }

  /**
   * Create annotation from drawing state
   */
  private createAnnotationFromDrawing(drawingState: DrawingState, text?: string): AnnotationData {
    const { toolId, currentPath, startPoint, endPoint, settings, userId, sessionId } = drawingState;
    const tool = this.availableTools.get(toolId)!;

    let coordinates: number[] = [];
    let annotationType: AnnotationData['type'] = 'freehand';
    let measurements: AnnotationData['measurements'] | undefined;

    switch (toolId) {
      case 'freehand':
        annotationType = 'freehand';
        coordinates = currentPath.flatMap(point => [point.x, point.y]);
        break;

      case 'circle':
        annotationType = 'circle';
        if (startPoint && endPoint) {
          const radius = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) + 
            Math.pow(endPoint.y - startPoint.y, 2)
          );
          coordinates = [startPoint.x, startPoint.y, radius];
          measurements = {
            area: Math.PI * radius * radius,
            perimeter: 2 * Math.PI * radius,
            unit: 'pixels'
          };
        }
        break;

      case 'rectangle':
        annotationType = 'rectangle';
        if (startPoint && endPoint) {
          const width = Math.abs(endPoint.x - startPoint.x);
          const height = Math.abs(endPoint.y - startPoint.y);
          coordinates = [
            Math.min(startPoint.x, endPoint.x),
            Math.min(startPoint.y, endPoint.y),
            width,
            height
          ];
          measurements = {
            area: width * height,
            perimeter: 2 * (width + height),
            unit: 'pixels'
          };
        }
        break;

      case 'arrow':
        annotationType = 'arrow';
        if (startPoint && endPoint) {
          coordinates = [startPoint.x, startPoint.y, endPoint.x, endPoint.y];
          measurements = {
            length: Math.sqrt(
              Math.pow(endPoint.x - startPoint.x, 2) + 
              Math.pow(endPoint.y - startPoint.y, 2)
            ),
            unit: 'pixels'
          };
        }
        break;

      case 'text':
        annotationType = 'text';
        if (startPoint) {
          coordinates = [startPoint.x, startPoint.y];
        }
        break;

      case 'ruler':
        annotationType = 'line';
        if (startPoint && endPoint) {
          coordinates = [startPoint.x, startPoint.y, endPoint.x, endPoint.y];
          measurements = {
            length: Math.sqrt(
              Math.pow(endPoint.x - startPoint.x, 2) + 
              Math.pow(endPoint.y - startPoint.y, 2)
            ),
            unit: 'pixels'
          };
        }
        break;

      case 'polygon':
        annotationType = 'polygon';
        coordinates = currentPath.flatMap(point => [point.x, point.y]);
        // Calculate polygon area using shoelace formula
        if (currentPath.length >= 3) {
          let area = 0;
          for (let i = 0; i < currentPath.length; i++) {
            const j = (i + 1) % currentPath.length;
            area += currentPath[i].x * currentPath[j].y;
            area -= currentPath[j].x * currentPath[i].y;
          }
          area = Math.abs(area) / 2;
          measurements = { area, unit: 'pixels' };
        }
        break;
    }

    return {
      id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: annotationType,
      coordinates,
      style: settings,
      text,
      measurements,
      metadata: {
        createdBy: userId,
        createdAt: new Date(),
        imageId: 'current-image', // This should be passed in
        version: 1
      }
    };
  }

  /**
   * Clean up old drawing states and annotations
   */
  public cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge);

    // Clean up old drawing states
    for (const [stateId, state] of this.activeDrawingStates.entries()) {
      if (!state.isDrawing) {
        this.activeDrawingStates.delete(stateId);
      }
    }

    // Clean up old annotation layers (keep recent ones)
    for (const [layerKey, annotations] of this.annotationLayers.entries()) {
      const recentAnnotations = annotations.filter(ann => ann.metadata.createdAt > cutoff);
      if (recentAnnotations.length === 0) {
        this.annotationLayers.delete(layerKey);
      } else {
        this.annotationLayers.set(layerKey, recentAnnotations);
      }
    }

    logger.debug('Annotation tools cleanup completed');
  }
}

export const annotationToolManager = new AnnotationToolManager();

// Start cleanup timer
setInterval(() => {
  annotationToolManager.cleanup();
}, 60 * 60 * 1000); // Run cleanup every hour