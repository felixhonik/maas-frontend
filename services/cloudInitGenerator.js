// Server-side cloud-init configuration generator
const fs = require('fs-extra');
const path = require('path');

/**
 * Generate base cloud-init configuration with common settings
 * OS-aware for Rocky/RHEL vs Ubuntu differences
 */
const generateBaseCloudInit = (osType = 'ubuntu', userCredentials = null) => {
  const isRocky = osType.toLowerCase().includes('rocky') || 
                  osType.toLowerCase().includes('rhel') || 
                  osType.toLowerCase().includes('centos');
  
  const config = {
    // OS-specific packages
    packages: isRocky ? [
      'curl',
      'wget',
      'git',
      'htop',
      'vim',
      'net-tools',
      'openssh-server',
      'sudo',
      'tar',
      'gzip'
    ] : [
      'curl',
      'wget',
      'git',
      'htop',
      'vim',
      'net-tools',
      'openssh-server',
      'sudo',
      'unzip'
    ],
    
    // Enable SSH password authentication
    ssh_pwauth: true,
    
    // Disable root login but allow sudo
    disable_root: true,
    
    // System timezone
    timezone: 'UTC',
    
    // Package update and upgrade
    package_update: true,
    package_upgrade: false, // Set to false to speed up deployment; enable if needed
    
    // Create default log files
    write_files: [
      {
        path: '/var/log/maas-deployment.log',
        content: `MAAS deployment started at ${new Date().toISOString()}\n`,
        owner: 'root:root',
        permissions: '0644'
      }
    ],
    
    // Run commands after package installation
    runcmd: [
      // Create deployment log
      'echo "=== MAAS Cloud-Init Deployment ===" | tee -a /var/log/maas-deployment.log',
      `echo "OS Type: ${osType}" | tee -a /var/log/maas-deployment.log`,
      `echo "Deployment Time: ${new Date().toISOString()}" | tee -a /var/log/maas-deployment.log`,
      'echo "=== System Information ===" | tee -a /var/log/maas-deployment.log',
      'uname -a | tee -a /var/log/maas-deployment.log',
      'df -h | tee -a /var/log/maas-deployment.log',
      'free -h | tee -a /var/log/maas-deployment.log',
      
      // OS-specific commands
      ...(isRocky ? [
        'systemctl enable sshd',
        'systemctl start sshd',
        'echo "SSH service enabled and started" | tee -a /var/log/maas-deployment.log'
      ] : [
        'systemctl enable ssh',
        'systemctl start ssh',
        'echo "SSH service enabled and started" | tee -a /var/log/maas-deployment.log'
      ]),
      
      'echo "=== Cloud-Init Configuration Complete ===" | tee -a /var/log/maas-deployment.log'
    ]
  };

  // Add user configuration if credentials are provided
  if (userCredentials && userCredentials.configured !== false && userCredentials.username && userCredentials.password) {
    config.users = [{
      name: userCredentials.username,
      plain_text_passwd: userCredentials.password,
      shell: '/bin/bash',
      sudo: 'ALL=(ALL) NOPASSWD:ALL',
      groups: isRocky ? 'wheel' : 'sudo',
      lock_passwd: false
    }];
    
    config.runcmd.unshift(
      `echo "User '${userCredentials.username}' configured with sudo access" | tee -a /var/log/maas-deployment.log`
    );
  } else {
    config.runcmd.unshift(
      'echo "No user credentials configured - using key-based or console access only" | tee -a /var/log/maas-deployment.log'
    );
  }
  
  return config;
};

/**
 * Generate machine-specific enhancements based on tags
 */
const generateMachineEnhancements = (machine) => {
  const tags = machine.tag_names || [];
  const enhancements = {
    packages: [],
    runcmd: [],
    write_files: []
  };

  // Log machine-specific information
  enhancements.runcmd.push(
    `echo "=== Machine-Specific Configuration ===" | tee -a /var/log/maas-deployment.log`,
    `echo "Machine: ${machine.hostname || machine.system_id}" | tee -a /var/log/maas-deployment.log`,
    `echo "System ID: ${machine.system_id}" | tee -a /var/log/maas-deployment.log`,
    `echo "FQDN: ${machine.fqdn || 'N/A'}" | tee -a /var/log/maas-deployment.log`,
    `echo "Pool: ${machine.pool?.name || 'default'}" | tee -a /var/log/maas-deployment.log`,
    `echo "Tags: ${tags.join(', ') || 'none'}" | tee -a /var/log/maas-deployment.log`
  );

  // Network card specific configurations
  if (tags.includes('bcm57508')) {
    enhancements.packages.push('ethtool');
    enhancements.runcmd.push(
      'echo "=== Broadcom BCM57508 Configuration ===" | tee -a /var/log/cloud-init-userdata.log',
      'modprobe bnxt_en 2>&1 | tee -a /var/log/cloud-init-userdata.log',
      'echo "Broadcom BCM57508 network driver loaded" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
    );
  }

  // AMD64 architecture optimizations
  if (tags.includes('amd64-arch')) {
    enhancements.packages.push('amd64-microcode');
    enhancements.runcmd.push(
      'echo "=== AMD64 Architecture Optimizations ===" | tee -a /var/log/cloud-init-userdata.log',
      'echo "AMD64 microcode updates enabled" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
    );
  }

  // Virtual machine specific settings
  if (tags.includes('virtual')) {
    enhancements.packages.push('qemu-guest-agent');
    enhancements.runcmd.push(
      'echo "=== Virtual Machine Configuration ===" | tee -a /var/log/cloud-init-userdata.log',
      'systemctl enable qemu-guest-agent',
      'systemctl start qemu-guest-agent',
      'echo "QEMU guest agent enabled for VM optimizations" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
    );
  }

  return enhancements;
};

/**
 * Main function to generate complete cloud-init configuration for a machine
 */
const getMachineCloudInit = async (machine, customUserData = '', osType = 'ubuntu') => {
  try {
    // Load user credentials
    let userCredentials = null;
    try {
      const userConfigPath = path.join(__dirname, '..', 'users.conf');
      if (fs.existsSync(userConfigPath)) {
        const configContent = fs.readFileSync(userConfigPath, 'utf8');
        const lines = configContent.split('\n');
        const config = {};
        
        lines.forEach(line => {
          const [key, value] = line.split('=').map(s => s.trim());
          if (key && value) {
            config[key] = value;
          }
        });
        
        if (config.USERNAME && config.PASSWORD) {
          userCredentials = {
            configured: true,
            username: config.USERNAME,
            password: config.PASSWORD
          };
        }
      }
    } catch (error) {
      console.log('Could not load user credentials, proceeding without user creation');
    }

    // Generate base configuration
    const baseConfig = generateBaseCloudInit(osType, userCredentials);
    
    // Generate machine-specific enhancements
    const enhancements = generateMachineEnhancements(machine);
    
    // Merge configurations
    const finalConfig = {
      ...baseConfig,
      packages: [...baseConfig.packages, ...enhancements.packages],
      runcmd: [...baseConfig.runcmd, ...enhancements.runcmd],
      write_files: [...baseConfig.write_files, ...enhancements.write_files]
    };
    
    // Add custom user data if provided
    if (customUserData && customUserData.trim()) {
      finalConfig.runcmd.push(
        'echo "=== Custom User Data Execution ===" | tee -a /var/log/maas-deployment.log'
      );
      
      // Parse and add custom user data
      try {
        const customConfig = customUserData.startsWith('#cloud-config') 
          ? customUserData 
          : `#cloud-config\n${customUserData}`;
        
        // If it's already cloud-config YAML, try to parse and merge
        if (customUserData.includes('runcmd:') || customUserData.includes('packages:')) {
          finalConfig.runcmd.push(
            'echo "Custom cloud-config provided - see cloud-init logs for details" | tee -a /var/log/maas-deployment.log'
          );
        } else {
          // Treat as shell commands
          const customCommands = customUserData.split('\n').filter(line => line.trim());
          finalConfig.runcmd.push(...customCommands);
        }
      } catch (error) {
        console.warn('Error processing custom user data:', error);
      }
    }
    
    // Convert to YAML string
    const yaml = require('js-yaml');
    const cloudInitYaml = `#cloud-config\n${yaml.dump(finalConfig, { 
      indent: 2,
      lineWidth: -1,
      noRefs: true
    })}`;
    
    return cloudInitYaml;
    
  } catch (error) {
    console.error('Error generating cloud-init configuration:', error);
    throw error;
  }
};

module.exports = {
  generateBaseCloudInit,
  generateMachineEnhancements,
  getMachineCloudInit
};