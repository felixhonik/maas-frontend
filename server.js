const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

let maasConfig = null;
let userConfig = null;

// Load MAAS configuration
const loadMaasConfig = () => {
  try {
    const configPath = path.join(__dirname, 'maas.conf');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const lines = configContent.split('\n');
      const config = {};
      
      lines.forEach(line => {
        const [key, value] = line.split('=').map(s => s.trim());
        if (key && value) {
          config[key] = value;
        }
      });
      
      maasConfig = config;
      console.log('MAAS configuration loaded');
    } else {
      console.log('maas.conf not found. Please create it with MAAS_URL and API_KEY');
    }
  } catch (error) {
    console.error('Error loading MAAS config:', error);
  }
};

// Load user configuration
const loadUserConfig = () => {
  try {
    const configPath = path.join(__dirname, 'users.conf');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const lines = configContent.split('\n');
      const config = {};
      
      lines.forEach(line => {
        const [key, value] = line.split('=').map(s => s.trim());
        if (key && value) {
          config[key] = value;
        }
      });
      
      userConfig = config;
      console.log('User configuration loaded');
    } else {
      console.log('users.conf not found. No user will be created in deployed machines');
      userConfig = null;
    }
  } catch (error) {
    console.error('Error loading user config:', error);
    userConfig = null;
  }
};

// Initialize config on startup
loadMaasConfig();
loadUserConfig();

// MAAS API helper
const maasApi = async (endpoint, method = 'GET', data = null) => {
  if (!maasConfig || !maasConfig.MAAS_URL || !maasConfig.API_KEY) {
    throw new Error('MAAS configuration not found');
  }

  // Parse the API key parts (consumer_key:consumer_token:secret)
  const [consumerKey, consumerToken, secret] = maasConfig.API_KEY.split(':');
  
  // Generate OAuth parameters
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  // MAAS OAuth signature format for PLAINTEXT method
  const signature = `&${encodeURIComponent(secret)}`;
  
  // Build OAuth authorization header
  const oauthParams = [
    `oauth_version="1.0"`,
    `oauth_signature_method="PLAINTEXT"`,
    `oauth_consumer_key="${consumerKey}"`,
    `oauth_token="${consumerToken}"`,
    `oauth_signature="${signature}"`,
    `oauth_nonce="${nonce}"`,
    `oauth_timestamp="${timestamp}"`
  ];
  
  const config = {
    method,
    url: `${maasConfig.MAAS_URL}/api/2.0/${endpoint}`,
    headers: {
      'Authorization': `OAuth ${oauthParams.join(', ')}`,
    }
  };

  // For POST requests with form data
  if (data && method === 'POST') {
    config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    // Convert data to URL encoded format
    if (typeof data === 'object') {
      const params = new URLSearchParams();
      Object.keys(data).forEach(key => {
        params.append(key, data[key]);
      });
      config.data = params.toString();
    } else {
      config.data = data;
    }
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('MAAS API Error:', error.response?.data || error.message);
    throw error;
  }
};

// API Routes
app.get('/api/config/status', (req, res) => {
  const configuredPools = maasConfig?.POOLS ? 
    maasConfig.POOLS.split(',').map(p => p.trim()) : 
    ['default'];
    
  res.json({
    configured: !!maasConfig?.MAAS_URL && !!maasConfig?.API_KEY,
    url: maasConfig?.MAAS_URL || null,
    pools: configuredPools
  });
});

app.get('/api/user/config', (req, res) => {
  res.json({
    configured: !!userConfig,
    username: userConfig?.USERNAME || null,
    // Never expose the actual password for security
    hasPassword: !!(userConfig?.PASSWORD)
  });
});

app.get('/api/config/defaults', async (req, res) => {
  try {
    // Try different MAAS API endpoints to get configuration
    let config = {};
    
    try {
      // First try the main MAAS config endpoint
      config = await maasApi('maas/');
    } catch (error1) {
      try {
        // Fallback to version endpoint which sometimes contains defaults
        config = await maasApi('version/');
      } catch (error2) {
        console.log('Both MAAS config endpoints failed, using fallback defaults');
      }
    }

    console.log('MAAS config response:', JSON.stringify(config, null, 2));
    
    res.json({
      default_distro_series: config.default_distro_series || config.default_series || 'jammy',
      default_min_hwe_kernel: config.default_min_hwe_kernel || config.default_kernel || '',
      completed_intro: config.completed_intro || false,
      debug_config: config // Include for debugging
    });
  } catch (error) {
    console.error('MAAS defaults API error:', error.message);
    // Return fallback defaults even if API fails
    res.json({
      default_distro_series: 'jammy',
      default_min_hwe_kernel: '',
      completed_intro: false,
      error: error.message
    });
  }
});

app.get('/api/machines', async (req, res) => {
  try {
    const machines = await maasApi('machines/');
    
    // Get configured pools from MAAS config, default to "default" if not specified
    const configuredPools = maasConfig?.POOLS ? 
      maasConfig.POOLS.split(',').map(p => p.trim()) : 
      ['default'];
    
    console.log('Configured pools:', configuredPools);
    
    // Filter machines by configured pools
    const filteredMachines = machines.filter(machine => {
      // If machine has no pool info, assume it's in default pool
      const machinePool = machine.pool?.name || 'default';
      return configuredPools.includes(machinePool);
    });
    
    console.log(`Filtered ${filteredMachines.length}/${machines.length} machines by pools: ${configuredPools.join(', ')}`);
    
    res.json(filteredMachines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tags', async (req, res) => {
  try {
    const tags = await maasApi('tags/');
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pools', async (req, res) => {
  try {
    const pools = await maasApi('resource-pools/');
    res.json(pools);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/boot-sources', async (req, res) => {
  try {
    const bootSources = await maasApi('boot-sources/');
    res.json(bootSources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/boot-resources', async (req, res) => {
  try {
    const bootResources = await maasApi('boot-resources/');
    res.json(bootResources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user credentials for cloud-init generation
app.get('/api/user/credentials', (req, res) => {
  if (!userConfig) {
    res.json({ configured: false });
    return;
  }
  
  res.json({
    configured: true,
    username: userConfig.USERNAME,
    password: userConfig.PASSWORD
  });
});

app.post('/api/machines/:id/deploy', async (req, res) => {
  try {
    const { id } = req.params;
    const { distro_series, user_data } = req.body;
    
    const deployData = { op: 'deploy' };
    if (distro_series) deployData.distro_series = distro_series;
    if (user_data) deployData.user_data = user_data;
    
    const result = await maasApi(`machines/${id}/`, 'POST', deployData);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/machines/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const machine = await maasApi(`machines/${id}/`);
    
    res.json({
      system_id: machine.system_id,
      hostname: machine.hostname,
      status_name: machine.status_name,
      status_message: machine.status_message,
      deployment_progress: machine.deployment_progress || null,
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// In-memory storage for provisioning jobs (in production, use Redis or database)
const provisioningJobs = new Map();
let jobIdCounter = 1;

// API endpoint for batch machine provisioning
app.post('/api/provision', async (req, res) => {
  try {
    const {
      machines,        // Array of machine system_ids or objects with system_id
      distro_series,   // OS to deploy (e.g., 'jammy', 'focal')
      user_data,       // Optional cloud-init user data
      tags,           // Array: automatically select machines by these tags
      pool,           // Optional: filter machines by pool
      count,          // Required when using tags: number of machines to provision
      auto_select,    // Boolean: enable automatic machine selection by tags
      tag_match_mode  // String: "all" (default) or "any" - how to match multiple tags
    } = req.body;

    // Validate input - either machines array OR tags+count for auto-selection
    if (auto_select || (tags && tags.length > 0 && !machines)) {
      // Auto-selection mode: require tags and count
      if (!tags || tags.length === 0) {
        return res.status(400).json({ 
          error: 'tags array is required for automatic machine selection',
          example: {
            auto_select: true,
            tags: ["testing-fe"],
            count: 2,
            distro_series: "jammy"
          }
        });
      }
      
      if (!count || count < 1) {
        return res.status(400).json({ 
          error: 'count is required and must be greater than 0 for automatic machine selection',
          example: {
            auto_select: true,
            tags: ["testing-fe"],
            count: 2,
            distro_series: "jammy"
          }
        });
      }
    } else {
      // Manual selection mode: require machines array
      if (!machines || machines.length === 0) {
        return res.status(400).json({ 
          error: 'machines array is required when not using automatic selection',
          example: {
            machines: ["machine-id-1", "machine-id-2"],
            distro_series: "jammy"
          }
        });
      }
    }

    // Handle automatic machine selection by tags
    let selectedMachines = machines;
    let resourceValidation = null;
    
    if (auto_select || (tags && tags.length > 0 && !machines)) {
      try {
        // Get all available machines
        const allMachines = await maasApi('machines/');
        
        // Filter machines by configured pools
        const configuredPools = maasConfig?.POOLS ? 
          maasConfig.POOLS.split(',').map(p => p.trim()) : 
          ['default'];
        
        const poolFilteredMachines = allMachines.filter(machine => {
          const machinePool = machine.pool?.name || 'default';
          return configuredPools.includes(machinePool);
        });
        
        // Filter by additional pool if specified in request
        let availableMachines = pool ? 
          poolFilteredMachines.filter(machine => (machine.pool?.name || 'default') === pool) :
          poolFilteredMachines;
        
        // Filter by tags based on match mode
        const matchMode = tag_match_mode || 'all'; // default to 'all'
        const taggedMachines = availableMachines.filter(machine => {
          const machineTags = machine.tag_names || [];
          
          if (matchMode === 'any') {
            // Machine must have AT LEAST ONE of the specified tags
            return tags.some(tag => machineTags.includes(tag));
          } else {
            // Machine must have ALL specified tags (default behavior)
            return tags.every(tag => machineTags.includes(tag));
          }
        });
        
        // Filter by Ready status
        const readyMachines = taggedMachines.filter(machine => 
          machine.status_name === 'Ready'
        );
        
        console.log(`Auto-selection: Found ${readyMachines.length} ready machines with tags [${tags.join(', ')}] (${matchMode} match), need ${count}`);
        
        // Check if we have enough resources
        if (readyMachines.length < count) {
          const availableCount = readyMachines.length;
          const requestedTags = tags.join(', ');
          const poolInfo = pool ? ` in pool '${pool}'` : '';
          
          return res.status(409).json({ 
            error: 'Not enough resources to provision',
            details: {
              requested_count: count,
              available_count: availableCount,
              required_tags: tags,
              pool: pool || 'any configured pool',
              message: `Requested ${count} machines with tags [${requestedTags}]${poolInfo}, but only ${availableCount} ready machines available`
            },
            available_machines: readyMachines.map(m => ({
              system_id: m.system_id,
              hostname: m.hostname || m.system_id,
              tags: m.tag_names || [],
              pool: m.pool?.name || 'default'
            }))
          });
        }
        
        // Select the requested number of machines
        selectedMachines = readyMachines.slice(0, count).map(m => m.system_id);
        
        resourceValidation = {
          auto_selected: true,
          requested_count: count,
          available_count: readyMachines.length,
          selected_machines: selectedMachines.length,
          selection_criteria: {
            tags,
            tag_match_mode: matchMode,
            pool,
            status: 'Ready'
          }
        };
        
        console.log(`Auto-selected ${selectedMachines.length} machines:`, selectedMachines);
        
      } catch (error) {
        console.error('Auto-selection error:', error);
        return res.status(500).json({ 
          error: 'Failed to auto-select machines',
          details: error.message
        });
      }
    }

    // Create provisioning job
    const jobId = `job-${Date.now()}-${jobIdCounter++}`;
    const job = {
      id: jobId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      machines: [],
      total_machines: 0,
      successful_deployments: 0,
      failed_deployments: 0,
      results: [],
      resource_validation: resourceValidation,
      config: {
        distro_series: distro_series || 'jammy',
        user_data,
        tags,
        pool,
        count,
        auto_select,
        tag_match_mode
      }
    };

    provisioningJobs.set(jobId, job);

    // Start deployment process asynchronously
    setImmediate(() => deployMachines(jobId, selectedMachines, job.config));

    // Return job ID immediately
    const response = {
      job_id: jobId,
      status: 'pending',
      message: 'Provisioning job started. Use GET /api/provision/:job_id to track progress.',
      machines_to_deploy: selectedMachines.length
    };
    
    // Add auto-selection info if applicable
    if (resourceValidation) {
      response.auto_selection = resourceValidation;
      response.selected_machines = selectedMachines;
    }
    
    res.status(202).json(response);

  } catch (error) {
    console.error('Provisioning API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get provisioning job status
app.get('/api/provision/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = provisioningJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Provisioning job not found' });
  }

  res.json(job);
});

// List all provisioning jobs
app.get('/api/provision', (req, res) => {
  const { status, limit = 50 } = req.query;
  let jobs = Array.from(provisioningJobs.values());

  // Filter by status if provided
  if (status) {
    jobs = jobs.filter(job => job.status === status);
  }

  // Sort by created_at desc and limit
  jobs = jobs
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, parseInt(limit));

  res.json({
    jobs,
    total: provisioningJobs.size
  });
});

// Async function to handle machine deployments
const deployMachines = async (jobId, machineIds, config) => {
  const { getMachineCloudInit } = require('./services/cloudInitGenerator.js');
  const job = provisioningJobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'running';
    job.updated_at = new Date().toISOString();
    
    // Get current machines data for processing
    const allMachines = await maasApi('machines/');
    let targetMachines = [];

    // Resolve machine IDs to machine objects
    for (const machineInput of machineIds) {
      const systemId = typeof machineInput === 'string' ? machineInput : machineInput.system_id;
      const machine = allMachines.find(m => m.system_id === systemId);
      
      if (machine) {
        // Check if machine is in Ready state
        if (machine.status_name !== 'Ready') {
          job.results.push({
            machine_id: systemId,
            hostname: machine.hostname || machine.system_id,
            status: 'skipped',
            reason: `Machine not in Ready state (current: ${machine.status_name})`
          });
          continue;
        }
        targetMachines.push(machine);
      } else {
        job.results.push({
          machine_id: systemId,
          hostname: systemId,
          status: 'failed',
          reason: 'Machine not found'
        });
      }
    }

    // Apply additional filters if specified
    if (config.tags && config.tags.length > 0) {
      targetMachines = targetMachines.filter(machine => 
        config.tags.some(tag => machine.tag_names?.includes(tag))
      );
    }

    if (config.pool) {
      targetMachines = targetMachines.filter(machine => 
        (machine.pool?.name || 'default') === config.pool
      );
    }

    // Limit count if specified
    if (config.count && config.count > 0) {
      targetMachines = targetMachines.slice(0, config.count);
    }

    job.total_machines = targetMachines.length;
    job.machines = targetMachines.map(m => ({
      system_id: m.system_id,
      hostname: m.hostname || m.fqdn || m.system_id
    }));

    // Deploy each machine
    for (const machine of targetMachines) {
      try {
        // Determine OS type
        const osType = config.distro_series?.toLowerCase().includes('rocky') || 
                      config.distro_series?.toLowerCase().includes('rhel') || 
                      config.distro_series?.toLowerCase().includes('centos') ? 'rocky' : 'ubuntu';

        // Generate machine-specific cloud-init if user_data provided
        let machineUserData = config.user_data;
        if (config.user_data) {
          machineUserData = await getMachineCloudInit(machine, config.user_data, osType);
        }

        const deployData = {
          distro_series: config.distro_series,
          user_data: machineUserData
        };

        const result = await maasApi(`machines/${machine.system_id}/`, 'POST', { 
          op: 'deploy',
          ...deployData 
        });

        job.results.push({
          machine_id: machine.system_id,
          hostname: machine.hostname || machine.fqdn || machine.system_id,
          status: 'deployed',
          distro_series: config.distro_series,
          os_type: osType,
          deployed_at: new Date().toISOString(),
          maas_result: result
        });
        
        job.successful_deployments++;

      } catch (deployError) {
        console.error(`Deployment failed for machine ${machine.system_id}:`, deployError);
        job.results.push({
          machine_id: machine.system_id,
          hostname: machine.hostname || machine.fqdn || machine.system_id,
          status: 'failed',
          error: deployError.message
        });
        
        job.failed_deployments++;
      }
    }

    // Mark job as completed
    job.status = job.failed_deployments === 0 ? 'completed' : 'completed_with_errors';
    job.completed_at = new Date().toISOString();
    job.updated_at = new Date().toISOString();

    console.log(`Provisioning job ${jobId} completed: ${job.successful_deployments} successful, ${job.failed_deployments} failed`);

  } catch (error) {
    console.error(`Provisioning job ${jobId} failed:`, error);
    job.status = 'failed';
    job.error = error.message;
    job.updated_at = new Date().toISOString();
  }
};

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});