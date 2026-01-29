import { Router } from 'express';
import { serviceRegistry } from '../services/serviceRegistry';
import { logger } from '../utils/logger';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = Router();

// Service routing configuration
const serviceRoutes = {
  '/collaboration': 'collaboration-service',
  '/expert': 'expert-service', 
  '/community': 'community-service',
  '/iot': 'iot-service',
  '/treatment': 'treatment-service',
  '/sync': 'sync-service'
};

// Dynamic service proxy setup
Object.entries(serviceRoutes).forEach(([path, serviceName]) => {
  router.use(path, (req, res, next) => {
    const service = serviceRegistry.getService(serviceName);
    
    if (!service || !service.healthy) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: `${serviceName} is currently unavailable`,
        timestamp: new Date().toISOString()
      });
    }

    // Create proxy middleware for the service
    const proxy = createProxyMiddleware({
      target: `http://localhost:${service.port}`,
      changeOrigin: true,
      pathRewrite: {
        [`^${path}`]: ''
      },
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${serviceName}:`, err);
        res.status(502).json({
          error: 'Bad Gateway',
          message: `Error connecting to ${serviceName}`,
          timestamp: new Date().toISOString()
        });
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add service metadata headers
        proxyReq.setHeader('X-Gateway-Service', serviceName);
        proxyReq.setHeader('X-Gateway-Timestamp', new Date().toISOString());
        
        // Forward user context if available
        if (req.user) {
          proxyReq.setHeader('X-User-ID', req.user.id);
          proxyReq.setHeader('X-User-Role', req.user.role);
        }
      }
    });

    proxy(req, res, next);
  });
});

// Service discovery endpoint
router.get('/services', (req, res) => {
  const services = serviceRegistry.getAllServices();
  res.json({
    services: Object.entries(services).map(([name, service]) => ({
      name,
      status: service.healthy ? 'healthy' : 'unhealthy',
      port: service.port,
      lastHealthCheck: service.lastHealthCheck
    })),
    timestamp: new Date().toISOString()
  });
});

// Load balancing for high-availability services
router.use('/load-balance/:serviceName', (req, res, next) => {
  const { serviceName } = req.params;
  const instances = serviceRegistry.getServiceInstances(serviceName);
  
  if (instances.length === 0) {
    return res.status(503).json({
      error: 'No Available Instances',
      message: `No healthy instances of ${serviceName} available`,
      timestamp: new Date().toISOString()
    });
  }

  // Simple round-robin load balancing
  const instance = serviceRegistry.getNextInstance(serviceName);
  
  const proxy = createProxyMiddleware({
    target: `http://localhost:${instance.port}`,
    changeOrigin: true,
    pathRewrite: {
      [`^/load-balance/${serviceName}`]: ''
    }
  });

  proxy(req, res, next);
});

export { router as apiGateway };