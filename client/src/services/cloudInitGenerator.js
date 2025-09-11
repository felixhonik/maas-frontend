// Cloud-init configuration generator based on machine tags and requirements

/**
 * Generate base cloud-init configuration with common settings
 * Now OS-aware for Rocky/RHEL vs Ubuntu differences
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
      'sudo', // Ensure sudo is installed on Rocky
      'tar',
      'gzip',
      // Additional system tools
      'lldpd',
      'nvme-cli',
      'strace',
      'ltrace',
      'crash',
      'kexec-tools', // Rocky equivalent of kdump-tools
      'ibverbs-utils',
      'infiniband-diags',
      'screen',
      'tmux',
      'ipmitool',
      'rdma-core',
      'wireshark-cli', // Rocky equivalent of tshark
      'fio',
      'smartmontools',
      'atop'
    ] : [
      'curl',
      'wget',
      'git',
      'htop',
      'vim',
      'net-tools',
      'openssh-server',
      // Additional system tools
      'lldpd',
      'nvme-cli',
      'strace',
      'ltrace',
      'crash',
      'kdump-tools',
      'ibverbs-utils',
      'ibutils',
      'infiniband-diags',
      'screen',
      'tmux',
      'ipmitool',
      'rdma-core',
      'tshark',
      'termshark',
      'fio',
      'smartmontools',
      'iozone3',
      'atop'
    ],
    
    // Basic system configuration
    ssh_pwauth: true,
    disable_root: false,
  };

  // Only add users section if credentials are provided
  if (userCredentials && userCredentials.configured !== false && userCredentials.username && userCredentials.password) {
    const username = userCredentials.username;
    const password = userCredentials.password;
    
    config.users = [
      {
        name: username,
        plain_text_passwd: password,
        sudo: isRocky ? ['ALL=(ALL) NOPASSWD:ALL'] : 'ALL=(ALL) NOPASSWD:ALL',
        shell: '/bin/bash',
        // Rocky/RHEL uses 'wheel' group, Ubuntu uses 'sudo'
        groups: isRocky ? ['wheel', 'docker'] : ['sudo', 'docker'],
        lock_passwd: false,
        // Additional Rocky Linux specific settings
        ...(isRocky && {
          ssh_authorized_keys: [],
          system: false,
          create_user_group: true
        })
      }
    ];
  }

  // Add user-specific run commands only if user is configured
  const userSpecificCommands = [];
  const username = userCredentials?.username;
  
  if (userCredentials && userCredentials.configured !== false && username) {
    const password = userCredentials.password;
    
    if (isRocky) {
      userSpecificCommands.push(
        `# CRITICAL: Force ${username} user creation immediately (Rocky Linux compatibility)`,
        'echo "=== EMERGENCY USER CREATION ===" | tee -a /var/log/cloud-init-userdata.log',
        `if ! id ${username} >/dev/null 2>&1; then`,
        `  echo "Cloud-init user creation appears to have failed. Creating ${username} user manually NOW..." | tee -a /var/log/cloud-init-userdata.log`,
        `  useradd -m -s /bin/bash ${username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: useradd failed" | tee -a /var/log/cloud-init-userdata.log`,
        `  echo "${username}:${password}" | chpasswd 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: chpasswd failed" | tee -a /var/log/cloud-init-userdata.log`,
        `  usermod -aG wheel ${username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: usermod wheel failed" | tee -a /var/log/cloud-init-userdata.log`,
        `  id ${username} 2>&1 | tee -a /var/log/cloud-init-userdata.log`,
        '  echo "Emergency user creation completed" | tee -a /var/log/cloud-init-userdata.log',
        'else',
        `  echo "GOOD: ${username} user exists, skipping emergency creation" | tee -a /var/log/cloud-init-userdata.log`,
        'fi',
        'systemctl enable sshd 2>&1 | tee -a /var/log/cloud-init-userdata.log',
        'systemctl start sshd 2>&1 | tee -a /var/log/cloud-init-userdata.log',
        `# Ensure wheel group has sudo privileges for ${username} user`,
        'echo "%wheel ALL=(ALL) NOPASSWD: ALL" | tee /etc/sudoers.d/wheel',
        'chmod 0440 /etc/sudoers.d/wheel',
        `# Enhanced ${username} user creation for Rocky Linux with comprehensive debugging`,
        'echo "=== User Creation Debug Information ===" | tee -a /var/log/cloud-init-userdata.log',
        'echo "OS Type: Rocky/RHEL/CentOS detected" | tee -a /var/log/cloud-init-userdata.log',
        'echo "Available groups:" | tee -a /var/log/cloud-init-userdata.log',
        'getent group wheel docker 2>&1 | tee -a /var/log/cloud-init-userdata.log',
        `echo "Checking if ${username} user exists..." | tee -a /var/log/cloud-init-userdata.log`,
        `if id ${username} >/dev/null 2>&1; then echo "GOOD: ${username} user already exists from cloud-init" | tee -a /var/log/cloud-init-userdata.log; else echo "WARNING: ${username} user not found, creating manually..." | tee -a /var/log/cloud-init-userdata.log; fi`,
        `if ! id ${username} >/dev/null 2>&1; then`,
        `  echo "Step 1: Creating ${username} user with useradd..." | tee -a /var/log/cloud-init-userdata.log`,
        `  useradd -m -s /bin/bash ${username} 2>&1 | tee -a /var/log/cloud-init-userdata.log`,
        `  echo "Step 2: Setting password for ${username} user..." | tee -a /var/log/cloud-init-userdata.log`, 
        `  echo "${username}:${password}" | chpasswd 2>&1 | tee -a /var/log/cloud-init-userdata.log`,
        `  echo "Step 3: Adding ${username} to wheel group..." | tee -a /var/log/cloud-init-userdata.log`,
        `  usermod -aG wheel ${username} 2>&1 | tee -a /var/log/cloud-init-userdata.log`,
        `  echo "Step 4: Adding ${username} to docker group (if exists)..." | tee -a /var/log/cloud-init-userdata.log`,
        `  getent group docker >/dev/null && usermod -aG docker ${username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "Docker group not found, skipping..." | tee -a /var/log/cloud-init-userdata.log`,
        '  echo "Manual user creation completed" | tee -a /var/log/cloud-init-userdata.log',
        'fi',
        `# Final verification of ${username} user`,
        'echo "=== Final User Verification ===" | tee -a /var/log/cloud-init-userdata.log',
        `id ${username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: ${username} user still not found!" | tee -a /var/log/cloud-init-userdata.log`,
        `groups ${username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: cannot check ${username} user groups" | tee -a /var/log/cloud-init-userdata.log`,
        `getent passwd ${username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: ${username} user not in passwd database" | tee -a /var/log/cloud-init-userdata.log`,
        'echo "Rocky Linux base configuration completed" | tee -a /var/log/cloud-init-userdata.log'
      );
    } else {
      userSpecificCommands.push(
        'systemctl enable ssh 2>&1 | tee -a /var/log/cloud-init-userdata.log',
        'systemctl start ssh 2>&1 | tee -a /var/log/cloud-init-userdata.log',
        `# Verify ${username} user was created with correct groups`,
        `id ${username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "WARNING: ${username} user not found" | tee -a /var/log/cloud-init-userdata.log`,
        `groups ${username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "WARNING: cannot check ${username} user groups" | tee -a /var/log/cloud-init-userdata.log`,
        'echo "Ubuntu base configuration completed" | tee -a /var/log/cloud-init-userdata.log'
      );
    }
  } else {
    // No user configuration - just basic system setup
    if (isRocky) {
      userSpecificCommands.push(
        'systemctl enable sshd 2>&1 | tee -a /var/log/cloud-init-userdata.log',
        'systemctl start sshd 2>&1 | tee -a /var/log/cloud-init-userdata.log',
        'echo "Rocky Linux base configuration completed (no user configured)" | tee -a /var/log/cloud-init-userdata.log'
      );
    } else {
      userSpecificCommands.push(
        'systemctl enable ssh 2>&1 | tee -a /var/log/cloud-init-userdata.log',
        'systemctl start ssh 2>&1 | tee -a /var/log/cloud-init-userdata.log',
        'echo "Ubuntu base configuration completed (no user configured)" | tee -a /var/log/cloud-init-userdata.log'
      );
    }
  }

  return {
    ...config,
    
    // System configuration files
    write_files: [
      {
        content: `# installed from platform cloud-init
kernel.numa_balancing=0
kernel.softlockup_all_cpu_backtrace=1
kernel.panic = 300
net.ipv4.conf.all.arp_announce = 2
net.ipv4.conf.all.arp_filter = 1
net.ipv4.conf.all.arp_ignore = 1
net.ipv4.conf.default.arp_announce = 2
net.ipv4.conf.default.arp_filter = 1
net.ipv4.conf.default.arp_ignore = 1
net.ipv4.conf.all.ignore_routes_with_linkdown = 1
net.ipv4.conf.default.ignore_routes_with_linkdown = 1
`,
        path: '/etc/sysctl.d/99-weka.conf'
      }
    ],
    
    // OS-specific run commands with proper logging setup
    runcmd: [
      'mkdir -p /var/log',
      'touch /var/log/cloud-init-userdata.log /var/log/maas-deployment.log',
      'chmod 644 /var/log/cloud-init-userdata.log /var/log/maas-deployment.log',
      'echo "=== MAAS Cloud-Init Deployment Started at $(date) ===" | tee -a /var/log/cloud-init-userdata.log',
      'echo "MAAS deployment started at $(date)" | tee /var/log/maas-deployment.log',
      `echo "Configuring ${isRocky ? 'Rocky Linux' : 'Ubuntu'} system..." | tee -a /var/log/cloud-init-userdata.log`,
      '# Enable and configure additional system services',
      'systemctl enable lldpd 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
      'systemctl start lldpd 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
      '# Configure kdump/kexec if available',
      `${isRocky ? 'systemctl enable kdump 2>&1 | tee -a /var/log/cloud-init-userdata.log || true' : 'systemctl enable kdump-tools 2>&1 | tee -a /var/log/cloud-init-userdata.log || true'}`,
      '# Enable SMART monitoring',
      'systemctl enable smartd 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
      'systemctl start smartd 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
      '# Apply sysctl configuration',
      'sysctl -p /etc/sysctl.d/99-weka.conf 2>&1 | tee -a /var/log/cloud-init-userdata.log',
      'echo "Weka sysctl configuration applied" | tee -a /var/log/cloud-init-userdata.log',
      'echo "Additional system tools configured" | tee -a /var/log/cloud-init-userdata.log',
      ...userSpecificCommands
    ]
  };
};

/**
 * Generate tag-specific enhancements based on machine tags
 */
const generateTagBasedEnhancements = (tags, osType = 'ubuntu') => {
  const enhancements = {
    packages: [],
    runcmd: [],
    write_files: []
  };

  if (!tags || tags.length === 0) {
    return enhancements;
  }

  const isRocky = osType.toLowerCase().includes('rocky') || 
                  osType.toLowerCase().includes('rhel') || 
                  osType.toLowerCase().includes('centos');

  // High-CPU machines - performance optimizations
  if (tags.includes('high-cpu')) {
    if (isRocky) {
      enhancements.packages.push('kernel-tools');
    } else {
      enhancements.packages.push('cpufrequtils', 'linux-tools-generic');
    }
    enhancements.runcmd.push(
      'echo "=== High-CPU Optimizations ===" | tee -a /var/log/cloud-init-userdata.log',
      'echo "performance" | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor 2>&1 | tee -a /var/log/cloud-init-userdata.log',
      'echo "High-CPU optimizations applied" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
    );
  }

  // High-memory machines - memory optimizations  
  if (tags.includes('high-memory')) {
    enhancements.runcmd.push(
      'echo "=== High-Memory Optimizations ===" | tee -a /var/log/cloud-init-userdata.log',
      'echo "vm.swappiness=1" >> /etc/sysctl.conf 2>&1 | tee -a /var/log/cloud-init-userdata.log',
      'echo "vm.vfs_cache_pressure=50" >> /etc/sysctl.conf 2>&1 | tee -a /var/log/cloud-init-userdata.log',
      'echo "High-memory optimizations applied" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
    );
  }

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
    enhancements.packages.push('qemu-guest-agent', 'open-vm-tools');
    enhancements.runcmd.push(
      'echo "=== Virtual Machine Configuration ===" | tee -a /var/log/cloud-init-userdata.log',
      'systemctl enable qemu-guest-agent 2>&1 | tee -a /var/log/cloud-init-userdata.log',
      'echo "Virtual machine tools configured" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
    );
  }

  // Serial console support
  if (tags.includes('serial_console') || tags.includes('needs_serial_console_deploy')) {
    enhancements.runcmd.push(
      'echo "=== Serial Console Configuration ===" | tee -a /var/log/cloud-init-userdata.log',
      'systemctl enable serial-getty@ttyS0.service 2>&1 | tee -a /var/log/cloud-init-userdata.log',
      'systemctl start serial-getty@ttyS0.service 2>&1 | tee -a /var/log/cloud-init-userdata.log',
      'echo "Serial console configured" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
    );
  }

  // NVME storage optimizations
  if (tags.includes('nvme_core')) {
    enhancements.write_files.push({
      content: 'nvme_core.multipath=N\n',
      path: '/etc/modprobe.d/nvme.conf'
    });
    enhancements.runcmd.push(
      'echo "=== NVME Configuration ===" | tee -a /var/log/cloud-init-userdata.log',
      'echo "NVME multipath disabled as configured" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
    );
  }

  // ConnectX NIC support (basic driver loading only)
  const connectxTags = tags.filter(tag => 
    tag.toLowerCase().includes('connectx') || 
    tag.toLowerCase().includes('mellanox')
  );
  
  if (connectxTags.length > 0) {
    enhancements.runcmd.push(
      'echo "=== ConnectX NIC Driver Loading ===" | tee -a /var/log/cloud-init-userdata.log',
      'modprobe mlx5_core 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
      'modprobe mlx5_ib 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
      'echo "ConnectX NIC drivers loaded" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
    );
  }

  // DOCA installation support (triggered by DOCA tag)
  const docaTags = tags.filter(tag => 
    tag.toLowerCase().includes('doca')
  );
  
  if (docaTags.length > 0) {
    // Add OS-specific packages for building drivers
    if (isRocky) {
      enhancements.packages.push('gcc', 'kernel-devel', 'kernel-headers', 'wget', 'python3-pip', 'curl', 'rpm-build');
    } else {
      enhancements.packages.push('build-essential', 'linux-headers-generic', 'wget', 'python3-pip', 'curl');
    }
    
    // Add DOCA installation script as a file
    enhancements.write_files.push({
      content: `#!/bin/bash
set -e
echo "Starting DOCA installation" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
cd /tmp

# Detect OS
echo "=== OS Detection for DOCA ===" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
if [ -f /etc/os-release ]; then
    source /etc/os-release
    OS_NAME=$ID
    OS_VERSION=$VERSION_ID
    OS_MAJOR_VERSION=\${VERSION_ID%%.*}
    echo "Detected OS: $OS_NAME $OS_VERSION (Major: $OS_MAJOR_VERSION)" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
else
    echo "Cannot detect OS, defaulting to Ubuntu 22.04" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
    OS_NAME="ubuntu"
    OS_VERSION="22.04"
    OS_MAJOR_VERSION="22"
fi

# Install DOCA based on OS
echo "Installing DOCA for $OS_NAME $OS_VERSION..." | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log

if [[ "$OS_NAME" == "ubuntu" ]]; then
    # Ubuntu DOCA installation
    echo "Setting up DOCA for Ubuntu..." | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
    
    # Determine repository based on version (use 22.04 repo for 24.04 compatibility)
    if [[ "$OS_VERSION" == "20.04" ]]; then
        DOCA_REPO_URL="https://linux.mellanox.com/public/repo/doca/3.1.0/ubuntu20.04/x86_64/"
    else
        # Use 22.04 repo for 22.04, 24.04, and unknown versions
        DOCA_REPO_URL="https://linux.mellanox.com/public/repo/doca/3.1.0/ubuntu22.04/x86_64/"
    fi
    
    echo "Using DOCA repository: $DOCA_REPO_URL" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
    
    # Install DOCA step by step
    echo "Step 1: Adding Mellanox GPG key..." | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
    curl -fsSL https://linux.mellanox.com/public/repo/doca/GPG-KEY-Mellanox.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/GPG-KEY-Mellanox.pub || exit 1
    
    echo "Step 2: Adding DOCA repository..." | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
    echo "deb [signed-by=/etc/apt/trusted.gpg.d/GPG-KEY-Mellanox.pub] $DOCA_REPO_URL ./" > /etc/apt/sources.list.d/doca.list || exit 1
    
    echo "Step 3: Updating package lists..." | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
    apt-get update 2>&1 | tee -a /var/log/cloud-init-userdata.log || exit 1
    
    echo "Step 4: Installing doca-all package..." | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
    apt-get -y install doca-all 2>&1 | tee -a /var/log/cloud-init-userdata.log || exit 1
    
elif [[ "$OS_NAME" == "rocky" || "$OS_NAME" == "rhel" || "$OS_NAME" == "centos" ]]; then
    # Rocky/RHEL DOCA installation
    echo "Setting up DOCA for $OS_NAME $OS_MAJOR_VERSION..." | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
    
    # Create DOCA repository configuration
    cat > /etc/yum.repos.d/doca.repo << EOF
[doca]
name=DOCA Online Repo
baseurl=https://linux.mellanox.com/public/repo/doca/3.1.0/rhel\${OS_MAJOR_VERSION}.0/x86_64/
enabled=1
gpgcheck=0
EOF
    
    echo "Step 1: Cleaning package cache..." | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
    dnf clean all 2>&1 | tee -a /var/log/cloud-init-userdata.log || exit 1
    
    echo "Step 2: Installing doca-ofed package..." | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
    dnf -y install doca-ofed 2>&1 | tee -a /var/log/cloud-init-userdata.log || exit 1
    
else
    echo "OS $OS_NAME not supported for DOCA installation" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
    exit 1
fi

echo "DOCA installation completed successfully" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
`,
      path: '/tmp/install_doca.sh'
    });
    
    // Add commands to run the script with logging
    enhancements.runcmd.push(
      'echo "=== DOCA Installation ===" | tee -a /var/log/cloud-init-userdata.log',
      'chmod +x /tmp/install_doca.sh 2>&1 | tee -a /var/log/cloud-init-userdata.log',
      '/tmp/install_doca.sh 2>&1 | tee -a /var/log/cloud-init-userdata.log'
    );
  }

  // Intel NIC support
  const intelNicTags = tags.filter(tag => 
    tag.toLowerCase().includes('intel') && 
    (tag.toLowerCase().includes('nic') || tag.toLowerCase().includes('ethernet'))
  );
  
  if (intelNicTags.length > 0) {
    if (isRocky) {
      enhancements.packages.push('gcc', 'kernel-devel', 'kernel-headers');
    } else {
      enhancements.packages.push('build-essential', 'linux-headers-generic');
    }
    enhancements.runcmd.push(
      'echo "=== Intel NIC Drivers Installation ===" | tee -a /var/log/cloud-init-userdata.log',
      'modprobe e1000e 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
      'modprobe igb 2>&1 | tee -a /var/log/cloud-init-userdata.log || true', 
      'modprobe ixgbe 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
      'modprobe i40e 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
      'modprobe ice 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
      'echo "Intel NIC drivers loaded" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
    );
  }

  // Broadcom NIC support (enhanced)
  if (tags.includes('bcm57508') || tags.some(tag => tag.toLowerCase().includes('broadcom'))) {
    if (isRocky) {
      enhancements.packages.push('ethtool', 'gcc', 'kernel-devel', 'kernel-headers');
    } else {
      enhancements.packages.push('ethtool', 'build-essential', 'linux-headers-generic');
    }
    enhancements.runcmd.push(
      'echo "=== Broadcom NIC Drivers Installation ===" | tee -a /var/log/cloud-init-userdata.log',
      'modprobe bnxt_en 2>&1 | tee -a /var/log/cloud-init-userdata.log',
      'modprobe tg3 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
      'echo "Broadcom NIC drivers loaded" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
    );
  }

  return enhancements;
};

/**
 * Merge base configuration with tag-based enhancements and user customizations
 */
const mergeConfigurations = (baseConfig, enhancements, userConfig = '') => {
  // Start with base configuration
  const finalConfig = { ...baseConfig };

  // Merge packages
  if (enhancements.packages && enhancements.packages.length > 0) {
    finalConfig.packages = [...finalConfig.packages, ...enhancements.packages];
  }

  // Merge run commands
  if (enhancements.runcmd && enhancements.runcmd.length > 0) {
    finalConfig.runcmd = [...finalConfig.runcmd, ...enhancements.runcmd];
  }

  // Add write_files if any
  if (enhancements.write_files && enhancements.write_files.length > 0) {
    finalConfig.write_files = finalConfig.write_files || [];
    finalConfig.write_files = [...finalConfig.write_files, ...enhancements.write_files];
  }

  // If user provided custom config, try to merge it intelligently
  if (userConfig.trim()) {
    try {
      // Try to parse user config as YAML-like structure
      const userLines = userConfig.split('\n').filter(line => line.trim());
      const userCommands = userLines.filter(line => 
        line.trim().startsWith('- ') && 
        !line.includes('echo') && 
        !line.includes('systemctl')
      );
      
      if (userCommands.length > 0) {
        finalConfig.runcmd.push('# User-provided commands:');
        userCommands.forEach(cmd => {
          finalConfig.runcmd.push(cmd.replace(/^- /, ''));
        });
      }
    } catch (error) {
      // If parsing fails, add user config as a comment
      finalConfig.runcmd.push(`# User provided config: ${userConfig.substring(0, 100)}...`);
    }
  }

  return finalConfig;
};

/**
 * Generate cloud-init configuration for a single machine
 */
const generateMachineCloudInit = (machine, userConfig = '', osType = 'ubuntu', userCredentials = null) => {
  const machineTags = machine.tag_names || [];
  
  // Generate base configuration with OS awareness
  const baseConfig = generateBaseCloudInit(osType, userCredentials);
  
  // Generate tag-based enhancements for this specific machine
  const enhancements = generateTagBasedEnhancements(machineTags, osType);
  
  // Merge configurations
  const finalConfig = mergeConfigurations(baseConfig, enhancements, userConfig);
  
  // Add machine-specific information to runcmd with logging
  const machineSpecificCmds = [
    `echo "=== Machine-Specific Configuration ===" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log`,
    `echo "Machine-specific deployment for ${machine.hostname || machine.fqdn || machine.system_id}" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log`,
    `echo "System ID: ${machine.system_id}" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log`,
    `echo "Architecture: ${machine.architecture}" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log`,
    `echo "CPU Cores: ${machine.cpu_count}" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log`,
    `echo "Memory: ${Math.round(machine.memory / 1024)} GB" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log`,
    `echo "Machine Tags: ${machineTags.join(', ') || 'none'}" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log`
  ];
  
  finalConfig.runcmd = [...machineSpecificCmds, ...finalConfig.runcmd];
  
  // Set hostname in cloud-init
  finalConfig.hostname = machine.hostname || machine.fqdn || `maas-${machine.system_id.slice(-8)}`;
  
  // Convert to proper YAML string with correct formatting
  const yamlString = `#cloud-config
# Auto-generated configuration for MAAS deployment
# Machine: ${machine.hostname || machine.fqdn || machine.system_id}
# System ID: ${machine.system_id}
# Architecture: ${machine.architecture}
# CPU: ${machine.cpu_count} cores, Memory: ${Math.round(machine.memory / 1024)} GB
# Machine tags: ${machineTags.join(', ') || 'none'}
# Generated at: ${new Date().toISOString()}

hostname: ${finalConfig.hostname}

${finalConfig.users ? `users:
${finalConfig.users.map(user => `  - name: ${user.name}
    plain_text_passwd: '${user.plain_text_passwd}'
    sudo: '${user.sudo}'
    shell: ${user.shell}
    groups: [${user.groups.join(', ')}]
    lock_passwd: ${user.lock_passwd}`).join('\n')}

` : ''}ssh_pwauth: ${finalConfig.ssh_pwauth}
disable_root: ${finalConfig.disable_root}

packages:
${finalConfig.packages.map(pkg => `  - ${pkg}`).join('\n')}

${finalConfig.write_files && finalConfig.write_files.length > 0 ? `write_files:
${finalConfig.write_files.map(file => `  - content: |
${file.content.split('\n').map(line => `      ${line}`).join('\n')}
    path: ${file.path}
    permissions: '0755'`).join('\n')}\n` : ''}
runcmd:
${finalConfig.runcmd.map(cmd => `  - "${cmd.replace(/"/g, '\\"')}"`).join('\n')}
  - "echo '=== MAAS Cloud-Init Deployment Completed at \$(date) ===' | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log"
  - "echo 'All user-data logs saved to /var/log/cloud-init-userdata.log' | tee -a /var/log/maas-deployment.log"
  - "echo 'Final user verification:' | tee -a /var/log/cloud-init-userdata.log"
${finalConfig.users ? `  - "id ${finalConfig.users[0].name} | tee -a /var/log/cloud-init-userdata.log || echo 'ERROR: ${finalConfig.users[0].name} user not created!' | tee -a /var/log/cloud-init-userdata.log"` : '  - "echo \'No user configured for this deployment\' | tee -a /var/log/cloud-init-userdata.log"'}

final_message: "MAAS deployment completed successfully for ${finalConfig.hostname} with Weka configurations"
`;

  return {
    config: yamlString,
    machine: machine,
    tags: machineTags,
    hasEnhancements: enhancements.packages.length > 0 || 
                      enhancements.runcmd.length > 0 || 
                      enhancements.write_files.length > 0
  };
};

/**
 * Generate complete cloud-init configuration for machines (backward compatibility)
 * Now generates individual configs for each machine
 */
export const generateCloudInit = (selectedMachines, userConfig = '', osType = 'ubuntu', userCredentials = null) => {
  if (selectedMachines.length === 1) {
    // Single machine - return individual config
    const machineConfig = generateMachineCloudInit(selectedMachines[0], userConfig, osType, userCredentials);
    
    // Create sanitized version for display (without password)
    const sanitizedYamlString = machineConfig.config.replace(
      /plain_text_passwd: '[^']*'/g, 
      "plain_text_passwd: '[HIDDEN]'"
    );
    
    return {
      config: machineConfig.config,
      displayConfig: sanitizedYamlString,
      tags: machineConfig.tags,
      hasEnhancements: machineConfig.hasEnhancements,
      machineConfigs: [machineConfig] // For consistency
    };
  } else {
    // Multiple machines - generate individual configs for each
    const machineConfigs = selectedMachines.map(machine => 
      generateMachineCloudInit(machine, userConfig, osType, userCredentials)
    );
    
    // Get all unique tags from all machines
    const allTags = [...new Set(
      selectedMachines.flatMap(machine => machine.tag_names || [])
    )];
    
    // Create a summary display config showing all machines
    const summaryConfig = `#cloud-config
# Auto-generated configuration for MAAS deployment
# Multiple machines: ${selectedMachines.length} machines
# Machines: ${selectedMachines.map(m => m.hostname || m.fqdn || m.system_id).join(', ')}
# All tags: ${allTags.join(', ') || 'none'}
# Generated at: ${new Date().toISOString()}

# Note: Each machine will receive individualized configuration
# based on its specific tags and hardware configuration

${userCredentials?.configured !== false ? `users:
  - name: ${userCredentials?.username || 'user'}
    plain_text_passwd: '[HIDDEN]'
    sudo: 'ALL=(ALL) NOPASSWD:ALL'
    shell: /bin/bash
    groups: [sudo, docker]
    lock_passwd: false` : '# No user configuration - machines will use default system access'}

# Individual machine configurations will be applied during deployment
# Each machine gets customized packages, drivers, and scripts based on its tags

final_message: "MAAS deployment completed for ${selectedMachines.length} machines with individualized configurations"
`;

    return {
      config: summaryConfig, // Summary for display
      displayConfig: summaryConfig,
      tags: allTags,
      hasEnhancements: machineConfigs.some(config => config.hasEnhancements),
      machineConfigs: machineConfigs // Individual configs for deployment
    };
  }
};

/**
 * Get individual machine configuration for deployment
 */
export const getMachineCloudInit = (machine, userConfig = '', osType = 'ubuntu', userCredentials = null) => {
  const machineConfig = generateMachineCloudInit(machine, userConfig, osType, userCredentials);
  return machineConfig.config;
};

/**
 * Get description of what enhancements will be applied based on tags
 */
export const getEnhancementDescription = (tags) => {
  const descriptions = [];
  
  if (!tags || tags.length === 0) {
    return ['Standard configuration only'];
  }

  if (tags.includes('high-cpu')) {
    descriptions.push('CPU performance optimizations (performance governor)');
  }
  
  if (tags.includes('high-memory')) {
    descriptions.push('Memory optimizations (swappiness, cache pressure)');
  }
  
  if (tags.includes('bcm57508')) {
    descriptions.push('Broadcom BCM57508 network driver configuration');
  }
  
  if (tags.includes('amd64-arch')) {
    descriptions.push('AMD64 microcode updates');
  }
  
  if (tags.includes('virtual')) {
    descriptions.push('Virtual machine guest tools');
  }
  
  if (tags.includes('serial_console') || tags.includes('needs_serial_console_deploy')) {
    descriptions.push('Serial console access configuration');
  }
  
  if (tags.includes('nvme_core')) {
    descriptions.push('NVME multipath configuration');
  }
  
  const connectxTags = tags.filter(tag => 
    tag.toLowerCase().includes('connectx') || 
    tag.toLowerCase().includes('mellanox')
  );
  if (connectxTags.length > 0) {
    descriptions.push('ConnectX NIC driver loading (mlx5_core, mlx5_ib)');
  }
  
  const docaTags = tags.filter(tag => 
    tag.toLowerCase().includes('doca')
  );
  if (docaTags.length > 0) {
    descriptions.push('DOCA installation (doca-all for Ubuntu, doca-ofed for Rocky/RHEL)');
  }
  
  const intelNicTags = tags.filter(tag => 
    tag.toLowerCase().includes('intel') && 
    (tag.toLowerCase().includes('nic') || tag.toLowerCase().includes('ethernet'))
  );
  if (intelNicTags.length > 0) {
    descriptions.push('Intel NIC driver optimization');
  }
  
  if (tags.some(tag => tag.toLowerCase().includes('broadcom'))) {
    descriptions.push('Enhanced Broadcom NIC driver support');
  }

  return descriptions.length > 0 ? descriptions : ['Standard configuration only'];
};