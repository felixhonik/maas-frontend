"""Cloud-init configuration generator based on machine tags and requirements"""

from typing import List, Dict, Any, Optional
import yaml
from datetime import datetime
import math


def generate_base_cloud_init(os_type: str = 'ubuntu', user_credentials: Optional[Dict] = None) -> Dict[str, Any]:
    """Generate base cloud-init configuration with common settings
    Now OS-aware for Rocky/RHEL vs Ubuntu differences
    """
    is_rocky = any(x in os_type.lower() for x in ['rocky', 'rhel', 'centos'])
    
    # OS-specific packages
    rocky_packages = [
        'curl', 'wget', 'git', 'htop', 'vim', 'net-tools', 'openssh-server', 'sudo', 'tar', 'gzip',
        # Additional system tools
        'lldpd', 'nvme-cli', 'strace', 'ltrace', 'crash', 'kexec-tools',  # Rocky equivalent of kdump-tools
        'ibverbs-utils', 'infiniband-diags', 'screen', 'tmux', 'ipmitool', 'rdma-core',
        'wireshark-cli',  # Rocky equivalent of tshark
        'fio', 'smartmontools', 'atop'
    ]
    
    ubuntu_packages = [
        'curl', 'wget', 'git', 'htop', 'vim', 'net-tools', 'openssh-server',
        # Additional system tools
        'lldpd', 'nvme-cli', 'strace', 'ltrace', 'crash', 'kdump-tools', 'ibverbs-utils',
        'ibutils', 'infiniband-diags', 'screen', 'tmux', 'ipmitool', 'rdma-core',
        'tshark', 'termshark', 'fio', 'smartmontools', 'iozone3', 'atop'
    ]
    
    config = {
        'packages': rocky_packages if is_rocky else ubuntu_packages,
        'ssh_pwauth': True,
        'disable_root': False,
    }

    # Only add users section if credentials are provided
    if user_credentials and user_credentials.get('configured') != False and user_credentials.get('username') and user_credentials.get('password'):
        username = user_credentials['username']
        password = user_credentials['password']
        
        user_config = {
            'name': username,
            'plain_text_passwd': password,
            'sudo': ['ALL=(ALL) NOPASSWD:ALL'] if is_rocky else 'ALL=(ALL) NOPASSWD:ALL',
            'shell': '/bin/bash',
            # Rocky/RHEL uses 'wheel' group, Ubuntu uses 'sudo'
            'groups': ['wheel', 'docker'] if is_rocky else ['sudo', 'docker'],
            'lock_passwd': False,
        }
        
        # Additional Rocky Linux specific settings
        if is_rocky:
            user_config.update({
                'ssh_authorized_keys': [],
                'system': False,
                'create_user_group': True
            })
        
        config['users'] = [user_config]

    # Add user-specific run commands only if user is configured
    user_specific_commands = []
    username = user_credentials.get('username') if user_credentials else None
    
    if user_credentials and user_credentials.get('configured') != False and username:
        password = user_credentials.get('password')
        
        if is_rocky:
            user_specific_commands.extend([
                f'# CRITICAL: Force {username} user creation immediately (Rocky Linux compatibility)',
                'echo "=== EMERGENCY USER CREATION ===" | tee -a /var/log/cloud-init-userdata.log',
                f'if ! id {username} >/dev/null 2>&1; then',
                f'  echo "Cloud-init user creation appears to have failed. Creating {username} user manually NOW..." | tee -a /var/log/cloud-init-userdata.log',
                f'  useradd -m -s /bin/bash {username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: useradd failed" | tee -a /var/log/cloud-init-userdata.log',
                f'  echo "{username}:{password}" | chpasswd 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: chpasswd failed" | tee -a /var/log/cloud-init-userdata.log',
                f'  usermod -aG wheel {username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: usermod wheel failed" | tee -a /var/log/cloud-init-userdata.log',
                f'  id {username} 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                '  echo "Emergency user creation completed" | tee -a /var/log/cloud-init-userdata.log',
                'else',
                f'  echo "GOOD: {username} user exists, skipping emergency creation" | tee -a /var/log/cloud-init-userdata.log',
                'fi',
                'systemctl enable sshd 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                'systemctl start sshd 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                f'# Ensure wheel group has sudo privileges for {username} user',
                'echo "%wheel ALL=(ALL) NOPASSWD: ALL" | tee /etc/sudoers.d/wheel',
                'chmod 0440 /etc/sudoers.d/wheel',
                f'# Enhanced {username} user creation for Rocky Linux with comprehensive debugging',
                'echo "=== User Creation Debug Information ===" | tee -a /var/log/cloud-init-userdata.log',
                'echo "OS Type: Rocky/RHEL/CentOS detected" | tee -a /var/log/cloud-init-userdata.log',
                'echo "Available groups:" | tee -a /var/log/cloud-init-userdata.log',
                'getent group wheel docker 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                f'echo "Checking if {username} user exists..." | tee -a /var/log/cloud-init-userdata.log',
                f'if id {username} >/dev/null 2>&1; then echo "GOOD: {username} user already exists from cloud-init" | tee -a /var/log/cloud-init-userdata.log; else echo "WARNING: {username} user not found, creating manually..." | tee -a /var/log/cloud-init-userdata.log; fi',
                f'if ! id {username} >/dev/null 2>&1; then',
                f'  echo "Step 1: Creating {username} user with useradd..." | tee -a /var/log/cloud-init-userdata.log',
                f'  useradd -m -s /bin/bash {username} 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                f'  echo "Step 2: Setting password for {username} user..." | tee -a /var/log/cloud-init-userdata.log',
                f'  echo "{username}:{password}" | chpasswd 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                f'  echo "Step 3: Adding {username} to wheel group..." | tee -a /var/log/cloud-init-userdata.log',
                f'  usermod -aG wheel {username} 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                f'  echo "Step 4: Adding {username} to docker group (if exists)..." | tee -a /var/log/cloud-init-userdata.log',
                f'  getent group docker >/dev/null && usermod -aG docker {username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "Docker group not found, skipping..." | tee -a /var/log/cloud-init-userdata.log',
                '  echo "Manual user creation completed" | tee -a /var/log/cloud-init-userdata.log',
                'fi',
                f'# Final verification of {username} user',
                'echo "=== Final User Verification ===" | tee -a /var/log/cloud-init-userdata.log',
                f'id {username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: {username} user still not found!" | tee -a /var/log/cloud-init-userdata.log',
                f'groups {username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: cannot check {username} user groups" | tee -a /var/log/cloud-init-userdata.log',
                f'getent passwd {username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: {username} user not in passwd database" | tee -a /var/log/cloud-init-userdata.log',
                'echo "Rocky Linux base configuration completed" | tee -a /var/log/cloud-init-userdata.log'
            ])
        else:
            user_specific_commands.extend([
                'systemctl enable ssh 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                'systemctl start ssh 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                f'# Verify {username} user was created with correct groups',
                f'id {username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "WARNING: {username} user not found" | tee -a /var/log/cloud-init-userdata.log',
                f'groups {username} 2>&1 | tee -a /var/log/cloud-init-userdata.log || echo "WARNING: cannot check {username} user groups" | tee -a /var/log/cloud-init-userdata.log',
                'echo "Ubuntu base configuration completed" | tee -a /var/log/cloud-init-userdata.log'
            ])
    else:
        # No user configuration - just basic system setup
        if is_rocky:
            user_specific_commands.extend([
                'systemctl enable sshd 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                'systemctl start sshd 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                'echo "Rocky Linux base configuration completed (no user configured)" | tee -a /var/log/cloud-init-userdata.log'
            ])
        else:
            user_specific_commands.extend([
                'systemctl enable ssh 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                'systemctl start ssh 2>&1 | tee -a /var/log/cloud-init-userdata.log',
                'echo "Ubuntu base configuration completed (no user configured)" | tee -a /var/log/cloud-init-userdata.log'
            ])

    # System configuration files
    config['write_files'] = [
        {
            'content': '''# installed from platform cloud-init
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
''',
            'path': '/etc/sysctl.d/99-weka.conf'
        }
    ]
    
    # OS-specific run commands with proper logging setup
    base_commands = [
        'mkdir -p /var/log',
        'touch /var/log/cloud-init-userdata.log /var/log/maas-deployment.log',
        'chmod 644 /var/log/cloud-init-userdata.log /var/log/maas-deployment.log',
        'echo "=== MAAS Cloud-Init Deployment Started at $(date) ===" | tee -a /var/log/cloud-init-userdata.log',
        'echo "MAAS deployment started at $(date)" | tee /var/log/maas-deployment.log',
        f'echo "Configuring {"Rocky Linux" if is_rocky else "Ubuntu"} system..." | tee -a /var/log/cloud-init-userdata.log',
        '# Enable and configure additional system services',
        'systemctl enable lldpd 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
        'systemctl start lldpd 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
        '# Configure kdump/kexec if available',
        'systemctl enable kdump 2>&1 | tee -a /var/log/cloud-init-userdata.log || true' if is_rocky else 'systemctl enable kdump-tools 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
        '# Enable SMART monitoring',
        'systemctl enable smartd 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
        'systemctl start smartd 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
        '# Apply sysctl configuration',
        'sysctl -p /etc/sysctl.d/99-weka.conf 2>&1 | tee -a /var/log/cloud-init-userdata.log',
        'echo "Weka sysctl configuration applied" | tee -a /var/log/cloud-init-userdata.log',
        'echo "Additional system tools configured" | tee -a /var/log/cloud-init-userdata.log'
    ]
    
    config['runcmd'] = base_commands + user_specific_commands
    
    return config


def generate_tag_based_enhancements(tags: List[str], os_type: str = 'ubuntu') -> Dict[str, List]:
    """Generate tag-specific enhancements based on machine tags"""
    enhancements = {
        'packages': [],
        'runcmd': [],
        'write_files': []
    }

    if not tags:
        return enhancements

    is_rocky = any(x in os_type.lower() for x in ['rocky', 'rhel', 'centos'])

    # High-CPU machines - performance optimizations
    if 'high-cpu' in tags:
        if is_rocky:
            enhancements['packages'].append('kernel-tools')
        else:
            enhancements['packages'].extend(['cpufrequtils', 'linux-tools-generic'])
        
        enhancements['runcmd'].extend([
            'echo "=== High-CPU Optimizations ===" | tee -a /var/log/cloud-init-userdata.log',
            'echo "performance" | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor 2>&1 | tee -a /var/log/cloud-init-userdata.log',
            'echo "High-CPU optimizations applied" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
        ])

    # High-memory machines - memory optimizations
    if 'high-memory' in tags:
        enhancements['runcmd'].extend([
            'echo "=== High-Memory Optimizations ===" | tee -a /var/log/cloud-init-userdata.log',
            'echo "vm.swappiness=1" >> /etc/sysctl.conf 2>&1 | tee -a /var/log/cloud-init-userdata.log',
            'echo "vm.vfs_cache_pressure=50" >> /etc/sysctl.conf 2>&1 | tee -a /var/log/cloud-init-userdata.log',
            'echo "High-memory optimizations applied" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
        ])

    # Network card specific configurations
    if 'bcm57508' in tags:
        enhancements['packages'].append('ethtool')
        enhancements['runcmd'].extend([
            'echo "=== Broadcom BCM57508 Configuration ===" | tee -a /var/log/cloud-init-userdata.log',
            'modprobe bnxt_en 2>&1 | tee -a /var/log/cloud-init-userdata.log',
            'echo "Broadcom BCM57508 network driver loaded" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
        ])

    # AMD64 architecture optimizations
    if 'amd64-arch' in tags:
        enhancements['packages'].append('amd64-microcode')
        enhancements['runcmd'].extend([
            'echo "=== AMD64 Architecture Optimizations ===" | tee -a /var/log/cloud-init-userdata.log',
            'echo "AMD64 microcode updates enabled" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
        ])

    # Virtual machine specific settings
    if 'virtual' in tags:
        enhancements['packages'].extend(['qemu-guest-agent', 'open-vm-tools'])
        enhancements['runcmd'].extend([
            'echo "=== Virtual Machine Configuration ===" | tee -a /var/log/cloud-init-userdata.log',
            'systemctl enable qemu-guest-agent 2>&1 | tee -a /var/log/cloud-init-userdata.log',
            'echo "Virtual machine tools configured" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
        ])

    # Serial console support
    if 'serial_console' in tags or 'needs_serial_console_deploy' in tags:
        enhancements['runcmd'].extend([
            'echo "=== Serial Console Configuration ===" | tee -a /var/log/cloud-init-userdata.log',
            'systemctl enable serial-getty@ttyS0.service 2>&1 | tee -a /var/log/cloud-init-userdata.log',
            'systemctl start serial-getty@ttyS0.service 2>&1 | tee -a /var/log/cloud-init-userdata.log',
            'echo "Serial console configured" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
        ])

    # NVME storage optimizations
    if 'nvme_core' in tags:
        enhancements['write_files'].append({
            'content': 'nvme_core.multipath=N\n',
            'path': '/etc/modprobe.d/nvme.conf'
        })
        enhancements['runcmd'].extend([
            'echo "=== NVME Configuration ===" | tee -a /var/log/cloud-init-userdata.log',
            'echo "NVME multipath disabled as configured" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
        ])

    # ConnectX NIC support (basic driver loading only)
    connectx_tags = [tag for tag in tags if 'connectx' in tag.lower() or 'mellanox' in tag.lower()]
    
    if connectx_tags:
        enhancements['runcmd'].extend([
            'echo "=== ConnectX NIC Driver Loading ===" | tee -a /var/log/cloud-init-userdata.log',
            'modprobe mlx5_core 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
            'modprobe mlx5_ib 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
            'echo "ConnectX NIC drivers loaded" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
        ])

    # DOCA installation support (triggered by DOCA tag)
    doca_tags = [tag for tag in tags if 'doca' in tag.lower()]
    
    if doca_tags:
        # Add OS-specific packages for building drivers
        if is_rocky:
            enhancements['packages'].extend(['gcc', 'kernel-devel', 'kernel-headers', 'wget', 'python3-pip', 'curl', 'rpm-build'])
        else:
            enhancements['packages'].extend(['build-essential', 'linux-headers-generic', 'wget', 'python3-pip', 'curl'])
        
        # Add DOCA installation script as a file
        doca_script = '''#!/bin/bash
set -e
echo "Starting DOCA installation" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
cd /tmp

# Detect OS
echo "=== OS Detection for DOCA ===" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log
if [ -f /etc/os-release ]; then
    source /etc/os-release
    OS_NAME=$ID
    OS_VERSION=$VERSION_ID
    OS_MAJOR_VERSION=${VERSION_ID%%.*}
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
baseurl=https://linux.mellanox.com/public/repo/doca/3.1.0/rhel${OS_MAJOR_VERSION}.0/x86_64/
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
'''
        
        enhancements['write_files'].append({
            'content': doca_script,
            'path': '/tmp/install_doca.sh'
        })
        
        # Add commands to run the script with logging
        enhancements['runcmd'].extend([
            'echo "=== DOCA Installation ===" | tee -a /var/log/cloud-init-userdata.log',
            'chmod +x /tmp/install_doca.sh 2>&1 | tee -a /var/log/cloud-init-userdata.log',
            '/tmp/install_doca.sh 2>&1 | tee -a /var/log/cloud-init-userdata.log'
        ])

    # Intel NIC support
    intel_nic_tags = [tag for tag in tags if 'intel' in tag.lower() and ('nic' in tag.lower() or 'ethernet' in tag.lower())]
    
    if intel_nic_tags:
        if is_rocky:
            enhancements['packages'].extend(['gcc', 'kernel-devel', 'kernel-headers'])
        else:
            enhancements['packages'].extend(['build-essential', 'linux-headers-generic'])
        
        enhancements['runcmd'].extend([
            'echo "=== Intel NIC Drivers Installation ===" | tee -a /var/log/cloud-init-userdata.log',
            'modprobe e1000e 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
            'modprobe igb 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
            'modprobe ixgbe 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
            'modprobe i40e 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
            'modprobe ice 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
            'echo "Intel NIC drivers loaded" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
        ])

    # Broadcom NIC support (enhanced)
    if 'bcm57508' in tags or any('broadcom' in tag.lower() for tag in tags):
        if is_rocky:
            enhancements['packages'].extend(['ethtool', 'gcc', 'kernel-devel', 'kernel-headers'])
        else:
            enhancements['packages'].extend(['ethtool', 'build-essential', 'linux-headers-generic'])
        
        enhancements['runcmd'].extend([
            'echo "=== Broadcom NIC Drivers Installation ===" | tee -a /var/log/cloud-init-userdata.log',
            'modprobe bnxt_en 2>&1 | tee -a /var/log/cloud-init-userdata.log',
            'modprobe tg3 2>&1 | tee -a /var/log/cloud-init-userdata.log || true',
            'echo "Broadcom NIC drivers loaded" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
        ])

    return enhancements


def merge_configurations(base_config: Dict, enhancements: Dict, user_config: str = '') -> Dict:
    """Merge base configuration with tag-based enhancements and user customizations"""
    # Start with base configuration
    final_config = base_config.copy()

    # Merge packages
    if enhancements.get('packages'):
        final_config['packages'].extend(enhancements['packages'])

    # Merge run commands
    if enhancements.get('runcmd'):
        final_config['runcmd'].extend(enhancements['runcmd'])

    # Add write_files if any
    if enhancements.get('write_files'):
        if 'write_files' not in final_config:
            final_config['write_files'] = []
        final_config['write_files'].extend(enhancements['write_files'])

    # If user provided custom config, try to merge it intelligently
    if user_config.strip():
        try:
            # Try to parse user config as YAML-like structure
            user_lines = [line.strip() for line in user_config.split('\n') if line.strip()]
            user_commands = [line for line in user_lines 
                           if line.startswith('- ') and 'echo' not in line and 'systemctl' not in line]
            
            if user_commands:
                final_config['runcmd'].append('# User-provided commands:')
                for cmd in user_commands:
                    final_config['runcmd'].append(cmd.replace('- ', '', 1))
        except Exception:
            # If parsing fails, add user config as a comment
            final_config['runcmd'].append(f'# User provided config: {user_config[:100]}...')

    return final_config


def generate_machine_cloud_init(machine: Dict, user_config: str = '', os_type: str = 'ubuntu', user_credentials: Optional[Dict] = None) -> Dict:
    """Generate cloud-init configuration for a single machine"""
    machine_tags = machine.get('tag_names', [])
    
    # Generate base configuration with OS awareness
    base_config = generate_base_cloud_init(os_type, user_credentials)
    
    # Generate tag-based enhancements for this specific machine
    enhancements = generate_tag_based_enhancements(machine_tags, os_type)
    
    # Merge configurations
    final_config = merge_configurations(base_config, enhancements, user_config)
    
    # Add machine-specific information to runcmd with logging
    machine_specific_cmds = [
        'echo "=== Machine-Specific Configuration ===" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log',
        f'echo "Machine-specific deployment for {machine.get("hostname") or machine.get("fqdn") or machine["system_id"]}" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log',
        f'echo "System ID: {machine["system_id"]}" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log',
        f'echo "Architecture: {machine.get("architecture", "unknown")}" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log',
        f'echo "CPU Cores: {machine.get("cpu_count", "unknown")}" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log',
        f'echo "Memory: {math.ceil(machine.get("memory", 0) / 1024)} GB" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log',
        f'echo "Machine Tags: {", ".join(machine_tags) if machine_tags else "none"}" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log'
    ]
    
    final_config['runcmd'] = machine_specific_cmds + final_config['runcmd']
    
    # Set hostname in cloud-init
    final_config['hostname'] = machine.get('hostname') or machine.get('fqdn') or f"maas-{machine['system_id'][-8:]}"
    
    # Convert to proper YAML string with correct formatting
    yaml_header = f'''#cloud-config
# Auto-generated configuration for MAAS deployment
# Machine: {machine.get("hostname") or machine.get("fqdn") or machine["system_id"]}
# System ID: {machine["system_id"]}
# Architecture: {machine.get("architecture", "unknown")}
# CPU: {machine.get("cpu_count", "unknown")} cores, Memory: {math.ceil(machine.get("memory", 0) / 1024)} GB
# Machine tags: {", ".join(machine_tags) if machine_tags else "none"}
# Generated at: {datetime.now().isoformat()}

'''
    
    # Add completion commands
    final_config['runcmd'].extend([
        'echo "=== MAAS Cloud-Init Deployment Completed at $(date) ===" | tee -a /var/log/cloud-init-userdata.log /var/log/maas-deployment.log',
        'echo "All user-data logs saved to /var/log/cloud-init-userdata.log" | tee -a /var/log/maas-deployment.log',
        'echo "Final user verification:" | tee -a /var/log/cloud-init-userdata.log'
    ])
    
    if final_config.get('users'):
        username = final_config['users'][0]['name']
        final_config['runcmd'].append(f'id {username} | tee -a /var/log/cloud-init-userdata.log || echo "ERROR: {username} user not created!" | tee -a /var/log/cloud-init-userdata.log')
    else:
        final_config['runcmd'].append('echo "No user configured for this deployment" | tee -a /var/log/cloud-init-userdata.log')
    
    final_config['final_message'] = f"MAAS deployment completed successfully for {final_config['hostname']} with Weka configurations"
    
    yaml_content = yaml.dump(final_config, default_flow_style=False, sort_keys=False)
    full_yaml = yaml_header + yaml_content
    
    return {
        'config': full_yaml,
        'machine': machine,
        'tags': machine_tags,
        'hasEnhancements': bool(enhancements.get('packages') or enhancements.get('runcmd') or enhancements.get('write_files'))
    }


def generate_cloud_init(selected_machines: List[Dict], user_config: str = '', os_type: str = 'ubuntu', user_credentials: Optional[Dict] = None) -> Dict:
    """Generate complete cloud-init configuration for machines (backward compatibility)
    Now generates individual configs for each machine
    """
    if len(selected_machines) == 1:
        # Single machine - return individual config
        machine_config = generate_machine_cloud_init(selected_machines[0], user_config, os_type, user_credentials)
        
        # Create sanitized version for display (without password)
        sanitized_yaml_string = machine_config['config']
        if user_credentials and user_credentials.get('password'):
            sanitized_yaml_string = sanitized_yaml_string.replace(
                f"plain_text_passwd: {user_credentials['password']}", 
                "plain_text_passwd: '[HIDDEN]'"
            )
        
        return {
            'config': machine_config['config'],
            'displayConfig': sanitized_yaml_string,
            'tags': machine_config['tags'],
            'hasEnhancements': machine_config['hasEnhancements'],
            'machineConfigs': [machine_config]  # For consistency
        }
    else:
        # Multiple machines - generate individual configs for each
        machine_configs = [generate_machine_cloud_init(machine, user_config, os_type, user_credentials) 
                          for machine in selected_machines]
        
        # Get all unique tags from all machines
        all_tags = list(set(tag for machine in selected_machines for tag in machine.get('tag_names', [])))
        
        # Create a summary display config showing all machines
        summary_config = f'''#cloud-config
# Auto-generated configuration for MAAS deployment
# Multiple machines: {len(selected_machines)} machines
# Machines: {", ".join(m.get("hostname") or m.get("fqdn") or m["system_id"] for m in selected_machines)}
# All tags: {", ".join(all_tags) if all_tags else "none"}
# Generated at: {datetime.now().isoformat()}

# Note: Each machine will receive individualized configuration
# based on its specific tags and hardware configuration

'''
        
        if user_credentials and user_credentials.get('configured') != False:
            summary_config += f'''users:
  - name: {user_credentials.get("username", "user")}
    plain_text_passwd: '[HIDDEN]'
    sudo: 'ALL=(ALL) NOPASSWD:ALL'
    shell: /bin/bash
    groups: [sudo, docker]
    lock_passwd: false
'''
        else:
            summary_config += '# No user configuration - machines will use default system access\n'

        summary_config += f'''
# Individual machine configurations will be applied during deployment
# Each machine gets customized packages, drivers, and scripts based on its tags

final_message: "MAAS deployment completed for {len(selected_machines)} machines with individualized configurations"
'''

        return {
            'config': summary_config,  # Summary for display
            'displayConfig': summary_config,
            'tags': all_tags,
            'hasEnhancements': any(config['hasEnhancements'] for config in machine_configs),
            'machineConfigs': machine_configs  # Individual configs for deployment
        }


async def get_machine_cloud_init(machine: Dict, user_config: str = '', os_type: str = 'ubuntu', user_credentials: Optional[Dict] = None) -> str:
    """Get individual machine configuration for deployment"""
    machine_config = generate_machine_cloud_init(machine, user_config, os_type, user_credentials)
    return machine_config['config']


def get_enhancement_description(tags: List[str]) -> List[str]:
    """Get description of what enhancements will be applied based on tags"""
    descriptions = []
    
    if not tags:
        return ['Standard configuration only']

    if 'high-cpu' in tags:
        descriptions.append('CPU performance optimizations (performance governor)')
    
    if 'high-memory' in tags:
        descriptions.append('Memory optimizations (swappiness, cache pressure)')
    
    if 'bcm57508' in tags:
        descriptions.append('Broadcom BCM57508 network driver configuration')
    
    if 'amd64-arch' in tags:
        descriptions.append('AMD64 microcode updates')
    
    if 'virtual' in tags:
        descriptions.append('Virtual machine guest tools')
    
    if 'serial_console' in tags or 'needs_serial_console_deploy' in tags:
        descriptions.append('Serial console access configuration')
    
    if 'nvme_core' in tags:
        descriptions.append('NVME multipath configuration')
    
    connectx_tags = [tag for tag in tags if 'connectx' in tag.lower() or 'mellanox' in tag.lower()]
    if connectx_tags:
        descriptions.append('ConnectX NIC driver loading (mlx5_core, mlx5_ib)')
    
    doca_tags = [tag for tag in tags if 'doca' in tag.lower()]
    if doca_tags:
        descriptions.append('DOCA installation (doca-all for Ubuntu, doca-ofed for Rocky/RHEL)')
    
    intel_nic_tags = [tag for tag in tags if 'intel' in tag.lower() and ('nic' in tag.lower() or 'ethernet' in tag.lower())]
    if intel_nic_tags:
        descriptions.append('Intel NIC driver optimization')
    
    if any('broadcom' in tag.lower() for tag in tags):
        descriptions.append('Enhanced Broadcom NIC driver support')

    return descriptions if descriptions else ['Standard configuration only']
