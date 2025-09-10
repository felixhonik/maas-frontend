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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});