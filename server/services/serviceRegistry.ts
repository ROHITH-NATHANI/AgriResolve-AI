import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

interface ServiceInstance {
  name: string;
  port: number;
  healthy: boolean;
  lastHealthCheck: Date;
  metadata?: Record<string, any>;
}

interface ServiceConfig {
  name: string;
  port: number;
  healthCheckInterval: number;
  healthCheckPath: string;
}

class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceInstance> = new Map();
  private serviceInstances: Map<string, ServiceInstance[]> = new Map();
  private roundRobinCounters: Map<string, number> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  // Service configurations
  private serviceConfigs: ServiceConfig[] = [
    {
      name: 'collaboration-service',
      port: 3002,
      healthCheckInterval: 30000, // 30 seconds
      healthCheckPath: '/health'
    },
    {
      name: 'expert-service',
      port: 3003,
      healthCheckInterval: 30000,
      healthCheckPath: '/health'
    },
    {
      name: 'community-service',
      port: 3004,
      healthCheckInterval: 30000,
      healthCheckPath: '/health'
    },
    {
      name: 'iot-service',
      port: 3005,
      healthCheckInterval: 30000,
      healthCheckPath: '/health'
    },
    {
      name: 'treatment-service',
      port: 3006,
      healthCheckInterval: 30000,
      healthCheckPath: '/health'
    },
    {
      name: 'sync-service',
      port: 3007,
      healthCheckInterval: 30000,
      healthCheckPath: '/health'
    }
  ];

  constructor() {
    super();
    this.initializeServices();
  }

  private initializeServices(): void {
    this.serviceConfigs.forEach(config => {
      const service: ServiceInstance = {
        name: config.name,
        port: config.port,
        healthy: false,
        lastHealthCheck: new Date()
      };

      this.services.set(config.name, service);

      // Initialize service instances array
      if (!this.serviceInstances.has(config.name)) {
        this.serviceInstances.set(config.name, []);
      }

      this.serviceInstances.get(config.name)!.push(service);
      this.roundRobinCounters.set(config.name, 0);
    });
  }

  public registerService(name: string, port: number, metadata?: Record<string, any>): void {
    const service: ServiceInstance = {
      name,
      port,
      healthy: true,
      lastHealthCheck: new Date(),
      metadata
    };

    this.services.set(name, service);

    // Add to instances if not exists
    if (!this.serviceInstances.has(name)) {
      this.serviceInstances.set(name, []);
      this.roundRobinCounters.set(name, 0);
    }

    this.serviceInstances.get(name)!.push(service);

    logger.info(`Service registered: ${name} on port ${port}`);
    this.emit('serviceRegistered', { name, port, metadata });
  }

  public unregisterService(name: string, port?: number): void {
    if (port) {
      // Remove specific instance
      const instances = this.serviceInstances.get(name) || [];
      const filteredInstances = instances.filter(instance => instance.port !== port);
      this.serviceInstances.set(name, filteredInstances);
    } else {
      // Remove all instances
      this.services.delete(name);
      this.serviceInstances.delete(name);
      this.roundRobinCounters.delete(name);

      // Clear health check interval
      const interval = this.healthCheckIntervals.get(name);
      if (interval) {
        clearInterval(interval);
        this.healthCheckIntervals.delete(name);
      }
    }

    logger.info(`Service unregistered: ${name}${port ? ` (port ${port})` : ''}`);
    this.emit('serviceUnregistered', { name, port });
  }

  public getService(name: string): ServiceInstance | undefined {
    return this.services.get(name);
  }

  public getAllServices(): Record<string, ServiceInstance> {
    return Object.fromEntries(this.services);
  }

  public getServiceInstances(name: string): ServiceInstance[] {
    return this.serviceInstances.get(name) || [];
  }

  public getNextInstance(serviceName: string): ServiceInstance {
    const instances = this.getServiceInstances(serviceName).filter(instance => instance.healthy);

    if (instances.length === 0) {
      throw new Error(`No healthy instances available for ${serviceName}`);
    }

    const counter = this.roundRobinCounters.get(serviceName) || 0;
    const instance = instances[counter % instances.length];

    this.roundRobinCounters.set(serviceName, counter + 1);

    return instance;
  }

  public getHealthStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};

    this.services.forEach((service, name) => {
      status[name] = service.healthy;
    });

    return status;
  }

  public startServices(): void {
    logger.info('Starting service registry health checks...');

    this.serviceConfigs.forEach(config => {
      this.startHealthCheck(config);
    });
  }

  public stopServices(): void {
    logger.info('Stopping service registry...');

    this.healthCheckIntervals.forEach((interval, serviceName) => {
      clearInterval(interval);
      logger.info(`Stopped health check for ${serviceName}`);
    });

    this.healthCheckIntervals.clear();
  }

  private startHealthCheck(config: ServiceConfig): void {
    const performHealthCheck = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`http://localhost:${config.port}${config.healthCheckPath}`, {
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const service = this.services.get(config.name);
        if (service) {
          const wasHealthy = service.healthy;
          service.healthy = response.ok;
          service.lastHealthCheck = new Date();

          if (!wasHealthy && service.healthy) {
            logger.info(`Service ${config.name} is now healthy`);
            this.emit('serviceHealthy', config.name);
          } else if (wasHealthy && !service.healthy) {
            logger.warn(`Service ${config.name} is now unhealthy`);
            this.emit('serviceUnhealthy', config.name);
          }
        }
      } catch (error) {
        const service = this.services.get(config.name);
        if (service) {
          const wasHealthy = service.healthy;
          service.healthy = false;
          service.lastHealthCheck = new Date();

          if (wasHealthy) {
            logger.warn(`Service ${config.name} health check failed:`, error);
            this.emit('serviceUnhealthy', config.name);
          }
        }
      }
    };

    // Perform initial health check
    performHealthCheck();

    // Set up periodic health checks
    const interval = setInterval(performHealthCheck, config.healthCheckInterval);
    this.healthCheckIntervals.set(config.name, interval);

    logger.info(`Health check started for ${config.name} (interval: ${config.healthCheckInterval}ms)`);
  }
}

export const serviceRegistry = new ServiceRegistry();