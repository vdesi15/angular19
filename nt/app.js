// app.js
const express = require('express');
const os = require('os');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Read Kubernetes metadata from downward API
function getKubernetesInfo() {
  try {
    return {
      podName: process.env.POD_NAME || 'unknown',
      podNamespace: process.env.POD_NAMESPACE || 'unknown',
      nodeName: process.env.NODE_NAME || 'unknown',
      deployment: process.env.DEPLOYMENT_NAME || 'unknown',
      version: process.env.APP_VERSION || 'v1',
      cluster: process.env.CLUSTER_NAME || 'unknown',
      dataCenter: process.env.DATA_CENTER || 'unknown'
    };
  } catch (error) {
    return { error: 'Could not read Kubernetes metadata' };
  }
}

// Get network and system info
function getSystemInfo() {
  const networkInterfaces = os.networkInterfaces();
  const primaryInterface = networkInterfaces.eth0 || networkInterfaces.en0 || Object.values(networkInterfaces)[0];
  
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptime: os.uptime(),
    loadAvg: os.loadavg(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpuCount: os.cpus().length,
    networkInterface: primaryInterface ? primaryInterface[0]?.address : 'unknown'
  };
}

// Middleware to capture request info
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  req.requestId = Math.random().toString(36).substr(2, 9);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main test endpoint with full tracing
app.get('/trace', (req, res) => {
  const kubernetesInfo = getKubernetesInfo();
  const systemInfo = getSystemInfo();
  
  const response = {
    message: 'Packet trace successful!',
    requestInfo: {
      requestId: req.requestId,
      timestamp: req.requestTime,
      method: req.method,
      url: req.url,
      headers: req.headers,
      remoteAddress: req.connection.remoteAddress || req.socket.remoteAddress,
      userAgent: req.get('User-Agent')
    },
    kubernetes: kubernetesInfo,
    system: systemInfo,
    routing: {
      path: req.path,
      query: req.query,
      params: req.params
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      processId: process.pid,
      nodeVersion: process.version
    }
  };
  
  // Log the request for debugging
  console.log(`[${req.requestTime}] ${req.method} ${req.url} - Pod: ${kubernetesInfo.podName} - RequestID: ${req.requestId}`);
  
  res.json(response);
});

// Endpoint to simulate different versions
app.get('/version', (req, res) => {
  const kubernetesInfo = getKubernetesInfo();
  
  res.json({
    version: kubernetesInfo.version,
    deployment: kubernetesInfo.deployment,
    pod: kubernetesInfo.podName,
    cluster: kubernetesInfo.cluster,
    dataCenter: kubernetesInfo.dataCenter,
    timestamp: new Date().toISOString()
  });
});

// Endpoint for load testing
app.get('/load/:duration?', (req, res) => {
  const duration = parseInt(req.params.duration) || 100;
  const start = Date.now();
  
  // Simulate some CPU work
  while (Date.now() - start < duration) {
    Math.random();
  }
  
  const kubernetesInfo = getKubernetesInfo();
  
  res.json({
    message: `Processed load for ${duration}ms`,
    pod: kubernetesInfo.podName,
    deployment: kubernetesInfo.deployment,
    processingTime: Date.now() - start,
    timestamp: new Date().toISOString()
  });
});

// Error endpoint for testing failure scenarios
app.get('/error/:code?', (req, res) => {
  const errorCode = parseInt(req.params.code) || 500;
  const kubernetesInfo = getKubernetesInfo();
  
  console.error(`[${new Date().toISOString()}] Simulated error ${errorCode} from pod: ${kubernetesInfo.podName}`);
  
  res.status(errorCode).json({
    error: `Simulated error ${errorCode}`,
    pod: kubernetesInfo.podName,
    deployment: kubernetesInfo.deployment,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const kubernetesInfo = getKubernetesInfo();
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Pod: ${kubernetesInfo.podName}`);
  console.log(`🏗️  Deployment: ${kubernetesInfo.deployment}`);
  console.log(`🌍 Cluster: ${kubernetesInfo.cluster}`);
  console.log(`🏢 Data Center: ${kubernetesInfo.dataCenter}`);
  console.log(`📋 Version: ${kubernetesInfo.version}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});