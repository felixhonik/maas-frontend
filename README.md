# MAAS Frontend

A Docker-based web frontend for MAAS (Metal as a Service) that enables full provisioning of machines based on their MAAS tags through a multi-step dialog interface. Built with React frontend and FastAPI backend.

## Features
<img width="1286" height="965" alt="image" src="https://github.com/user-attachments/assets/4ad90d25-5e8e-4a8f-a741-b4e591afbd8f" />

- **Multi-step provisioning wizard** with intuitive UI
- **Tag-based machine filtering** for targeted deployments
- **Pool-based machine filtering** to show only machines from specific resource pools
- **Live data from MAAS server** with real-time updates
- **Batch machine deployment** with customizable options
- **Configurable user credentials** for deployed machines
- **Machine status dashboard** with broken machines detection
- **Visual status charts** showing machine distribution and health
- **Comprehensive deployment tracking** - shows all MAAS deployments (app-initiated and manual)
- **Real-time deployment monitoring** with automatic status updates every 30 seconds
<img width="908" height="507" alt="image" src="https://github.com/user-attachments/assets/c5805543-b226-4ad2-9b6c-e6f17b7c5fbd" />

- **Pool-aware deployment history** with visual source indicators and expandable view
- **API-managed provisioning** with tag-based auto-selection
- **Advanced tag matching** (ALL/ANY modes) for flexible machine selection
- **Resource validation** with "Not enough resources" error handling
- **User-friendly OS selection** with unified display names:
  - Uploaded images: Show custom titles (e.g., "Rocky 10.0 Custom x86_64")
  - Synced images: Show official names (e.g., "Ubuntu 22.04 LTS")
  - Alphabetically sorted by display name for easy selection
- **Docker containerized** for easy deployment
- **Network accessible** from any host (not just localhost)
- **Responsive Material-UI design**
<img width="1284" height="967" alt="image" src="https://github.com/user-attachments/assets/ccbda1bf-d45c-4cc8-a156-b2b363e01215" />

## Recent Updates

### v2.0.0 - FastAPI Migration & Hostname Support (September 2025)

**🚀 Major Framework Migration:**
- **Backend Migration**: Complete migration from Express.js/Node.js to FastAPI/Python
- **Hostname Support**: Machine provisioning now accepts hostnames (e.g., `"wekapoc1"`) in addition to system IDs
- **Deploying Status**: Added "Deploying" status visualization to dashboard and pie charts
- **Enhanced Error Handling**: Improved error messages with available hostnames/IDs when resolution fails

**💡 New Features:**
- **Hostname-based Provisioning**: Use friendly hostnames instead of cryptic system IDs
- **Mixed Mode Support**: Accept both hostnames and system IDs in the same request
- **Real-time Deployment Tracking**: "Deploying" machines now show in dashboard with orange status
- **FastAPI Auto-Documentation**: Interactive API docs available at `/docs`

**⚠️ Breaking Changes:**
- **Runtime**: Now requires Python 3.11+ instead of Node.js
- **Docker Image**: Based on `python:3.11-alpine` instead of `node:18-alpine`
- **Cloud-init Generator**: Moved from JavaScript to Python (`services/cloud_init_generator.py`)

**🔧 Migration Guide:**
- Existing deployments: No changes needed - system IDs still work
- New deployments: Can now use hostnames for easier identification
- Docker: Rebuild container with `docker compose build`

## Quick Start

### 1. Configure MAAS Connection

Create a `maas.conf` file in the project root:

```bash
cp maas.conf.example maas.conf
```

Edit `maas.conf` with your MAAS server details:
```
MAAS_URL=http://your-maas-server:5240/MAAS
API_KEY=your-api-key-here
POOLS=default
```

**Optional**: Add `POOLS` setting to filter machines by resource pools. Comma-separated list of pool names. If not specified, only machines from the "default" pool will be shown.

### 2. Configure User Credentials (Optional)

Create a `users.conf` file to customize the default user credentials for deployed machines:

```bash
cp users.conf.example users.conf
```

Edit `users.conf` with your desired credentials:
```
USERNAME=your-username
PASSWORD=your-secure-password
```

If not configured, no user will be created on deployed machines (you'll need to use other access methods like SSH keys or console access).

### 3. Deploy with Docker Compose

```bash
# Build and start the application
docker-compose up -d

# Check logs
docker-compose logs -f
```

The application will be available at http://localhost:3001 or from any host that can access your Docker server at http://your-host-ip:3001

### 4. Development Setup

For local development:

**Frontend:**
```bash
cd client
npm install
npm run dev
```

**Backend:**
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn app:app --host 0.0.0.0 --port 3001 --reload
```

This starts:
- FastAPI backend server on port 3001
- Frontend dev server on port 3000 (with proxy to backend)

## Usage

### Dashboard Overview

The main dashboard provides:
- **Machine statistics**: Total, Ready, Deployed, and Broken machine counts
- **Status pie chart**: Visual distribution of machine states
- **Broken machines table**: Detailed view of machines requiring attention (shows first 3, expandable to full list)
- **Recent deployments**: Comprehensive history showing all MAAS deployments (both app-initiated and manual)
  - Shows 5 deployments initially with "Show More" to expand to 10
  - Includes deployments from all configured pools
  - Real-time status updates every 30 seconds
  - Visual indicators for deployment source (MAAS badge) and pool information

### Provisioning Workflow

1. **Open the application** in your browser
2. **Click the + button** to start the provisioning wizard
3. **Select tags** to filter machines (optional)
4. **Choose machines** from the filtered list
5. **Select operating system** from available boot resources
   - **Synced OS images**: Display official names (e.g., "Ubuntu 22.04 LTS", "Ubuntu 20.04 LTS")
   - **Uploaded custom images**: Display custom titles (e.g., "Rocky 10.0 Custom x86_64")
   - **Alphabetically sorted** by display name for easy browsing
   - **Architecture and type indicators** shown for each option
6. **Configure deployment options** (cloud-init, tags)
7. **Review and deploy** - machines will be deployed with generated cloud-init

## Tag-Based Machine Configuration

The MAAS Frontend automatically applies specialized configurations based on machine tags. Add these tags to machines in MAAS to enable specific features:

### **System Performance Tags:**
- **`high-cpu`**: Enables CPU performance optimizations (performance governor)
- **`high-memory`**: Applies memory optimizations (swappiness, cache pressure tuning)
- **`amd64-arch`**: Installs AMD64 microcode updates

### **Network Hardware Tags:**
- **`connectx`** or **`mellanox`**: Loads ConnectX NIC drivers (mlx5_core, mlx5_ib)
- **`bcm57508`**: Configures Broadcom BCM57508 network driver
- **`intel-nic`** or **`intel-ethernet`**: Optimizes Intel NIC drivers (e1000e, igb, ixgbe, i40e, ice)

### **Storage & System Tags:**
- **`nvme_core`**: Configures NVME multipath settings
- **`serial_console`**: Enables serial console access
- **`virtual`**: Installs virtual machine guest tools (qemu-guest-agent, open-vm-tools)

### **Software Installation Tags:**
- **`doca`** *(case insensitive)*: Installs NVIDIA DOCA (Data Center Infrastructure on a Chip Architecture)
  - **Ubuntu**: Installs `doca-all` package from Mellanox repositories
  - **Rocky/RHEL**: Installs `doca-ofed` package from Mellanox repositories
  - **Supported OS**: Ubuntu 20.04/22.04/24.04, Rocky/RHEL 8/9/10
  - **Automatic repository setup** with GPG key verification
  - **Full installation logging** to `/var/log/cloud-init-userdata.log`

### **Usage Examples:**
```bash
# In MAAS, add these tags to machines:
high-cpu,doca          # High-performance machine with DOCA
connectx,doca          # ConnectX NIC with DOCA installation  
virtual,high-memory    # VM with memory optimizations
bcm57508,serial_console # Broadcom NIC with serial access
```

### **Default System Tools:**
All deployed machines automatically receive a comprehensive set of system tools:
- **Network**: `lldpd`, `net-tools`, `ibverbs-utils`, `ibutils`, `infiniband-diags`, `rdma-core`
- **Storage**: `nvme-cli`, `smartmontools`, `fio`, `iozone3` 
- **Debugging**: `strace`, `ltrace`, `crash`, `tshark`, `termshark`, `htop`, `atop`
- **System**: `kdump-tools`/`kexec-tools`, `ipmitool`, `screen`, `tmux`
- **Optimized kernel settings**: Weka-optimized sysctl configuration in `/etc/sysctl.d/99-weka.conf`

All configurations are applied automatically during deployment with comprehensive logging for troubleshooting.

## API Endpoints

### Configuration & Discovery
- `GET /api/config/status` - Check MAAS configuration (includes configured pools)
- `GET /api/machines` - List machines (filtered by configured pools)
- `GET /api/tags` - List all tags
- `GET /api/pools` - List available resource pools
- `GET /api/user/config` - Get current user configuration (without password)
- `GET /api/user/credentials` - Get user credentials for cloud-init generation

### Machine Deployment
- `POST /api/machines/:id/deploy` - Deploy a single machine
- `GET /api/machines/:id/status` - Get deployment status for a specific machine
- `GET /api/deployments/recent` - **NEW**: Get recent deployments from all machines in configured pools
  - Returns deployments with status: Deployed, Deploying, Failed deployment
  - Filtered by configured pools (respects POOLS setting)
  - Limited to 20 most recent deployments
- `POST /api/provision` - **NEW**: Batch provisioning API for multiple machines
- `GET /api/provision` - **NEW**: List all provisioning jobs
- `GET /api/provision/:jobId` - **NEW**: Get provisioning job status

## API-Managed Provisioning

The application now supports programmatic machine provisioning through REST APIs. This enables automation and integration with external systems.

### Batch Provisioning API

**Endpoint:** `POST /api/provision`

Deploy multiple machines with a single API call. Returns immediately with a job ID for tracking progress.

**Request Body (Auto-Selection Mode):**
```json
{
  "auto_select": true,
  "tags": ["gpu", "high-memory"],
  "tag_match_mode": "all",
  "count": 2,
  "distro_series": "jammy",
  "user_data": "#!/bin/bash\necho 'Auto-selected deployment'",
  "pool": "production"
}
```

**Request Body (Manual Selection Mode):**
```json
{
  "machines": ["wekapoc1", "wekapoc2", "wekapoc3"],
  "distro_series": "jammy",
  "user_data": "#!/bin/bash\necho 'Manual deployment'"
}
```

**Parameters:**
- `machines` (required for manual mode): Array of machine hostnames or system IDs to deploy
- `auto_select` (optional): Enable automatic machine selection by tags
- `tags` (required for auto-select): Array of MAAS tags for machine selection
- `count` (required for auto-select): Number of machines to provision
- `tag_match_mode` (optional): "all" (default) or "any" - how to match multiple tags
- `distro_series` (optional): OS to deploy (default: "jammy")
- `user_data` (optional): Custom cloud-init configuration or shell commands
- `pool` (optional): Filter machines by resource pool

**Response (Auto-Selection Success):** `HTTP 202 Accepted`
```json
{
  "job_id": "job-1757497732724-1",
  "status": "pending",
  "message": "Provisioning job started. Use GET /api/provision/:job_id to track progress.",
  "machines_to_deploy": 2,
  "auto_selection": {
    "auto_selected": true,
    "requested_count": 2,
    "available_count": 5,
    "selected_machines": 2,
    "selection_criteria": {
      "tags": ["gpu", "high-memory"],
      "tag_match_mode": "all",
      "status": "Ready"
    }
  },
  "selected_machines": ["abc123", "def456"]
}
```

**Response (Insufficient Resources):** `HTTP 409 Conflict`
```json
{
  "error": "Not enough resources to provision",
  "details": {
    "requested_count": 5,
    "available_count": 2,
    "required_tags": ["gpu", "high-memory"],
    "pool": "production",
    "message": "Requested 5 machines with tags [gpu, high-memory], but only 2 ready machines available"
  },
  "available_machines": [
    {
      "system_id": "abc123",
      "hostname": "gpu-server-01",
      "tags": ["gpu", "high-memory", "nvme"],
      "pool": "production"
    }
  ]
}
```

### Job Status Tracking

**Endpoint:** `GET /api/provision/:jobId`

Track the progress of a provisioning job.

**Response:**
```json
{
  "id": "job-1757497732724-1",
  "status": "completed",
  "created_at": "2025-09-10T09:48:52.724Z",
  "updated_at": "2025-09-10T09:48:55.350Z",
  "completed_at": "2025-09-10T09:48:55.350Z",
  "total_machines": 2,
  "successful_deployments": 2,
  "failed_deployments": 0,
  "machines": [
    {
      "system_id": "abc123",
      "hostname": "server-01"
    }
  ],
  "results": [
    {
      "machine_id": "abc123",
      "hostname": "server-01",
      "status": "deployed",
      "distro_series": "jammy",
      "os_type": "ubuntu",
      "deployed_at": "2025-09-10T09:48:54.100Z"
    }
  ],
  "config": {
    "distro_series": "jammy",
    "user_data": "#!/bin/bash\necho 'Setup complete'"
  }
}
```

**Job Statuses:**
- `pending`: Job created, waiting to start
- `running`: Currently deploying machines
- `completed`: All machines deployed successfully
- `completed_with_errors`: Some machines failed to deploy
- `failed`: Job failed completely

### List All Jobs

**Endpoint:** `GET /api/provision`

List all provisioning jobs with optional filtering.

**Query Parameters:**
- `status`: Filter by job status (pending, running, completed, etc.)
- `limit`: Maximum number of jobs to return (default: 50)

**Response:**
```json
{
  "jobs": [
    {
      "id": "job-1757497732724-1",
      "status": "completed",
      "created_at": "2025-09-10T09:48:52.724Z",
      "total_machines": 2,
      "successful_deployments": 2,
      "failed_deployments": 0
    }
  ],
  "total": 1
}
```

### Tag Matching Modes

When using multiple tags for auto-selection, you can control how tags are matched:

- **`tag_match_mode: "all"`** (default): Machine must have ALL specified tags
  - Example: `["gpu", "nvme"]` → Machine needs both "gpu" AND "nvme" tags
  - More restrictive, fewer machines will match
  
- **`tag_match_mode: "any"`**: Machine needs AT LEAST ONE of the specified tags
  - Example: `["gpu", "nvme"]` → Machine needs either "gpu" OR "nvme" tag (or both)
  - Less restrictive, more machines will match

### API Examples

**Deploy specific machines (by hostname):**
```bash
curl -X POST http://your-server:3001/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "machines": ["wekapoc1", "wekapoc2", "wekapoc3"],
    "distro_series": "jammy"
  }'
```

**Deploy specific machines (by system ID):**
```bash
curl -X POST http://your-server:3001/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "machines": ["4y3h8a", "6x4bef"],
    "distro_series": "jammy"
  }'
```

**Deploy with custom cloud-init (using hostname):**
```bash
curl -X POST http://your-server:3001/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "machines": ["wekapoc1"],
    "distro_series": "focal",
    "user_data": "#!/bin/bash\napt update\napt install -y docker.io\nsystemctl enable docker"
  }'
```

**Auto-select machines by multiple tags (ALL mode - default):**
```bash
# Machines must have BOTH "gpu" AND "high-memory" tags
curl -X POST http://your-server:3001/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "auto_select": true,
    "tags": ["gpu", "high-memory"],
    "count": 2,
    "distro_series": "jammy"
  }'
```

**Auto-select machines by multiple tags (ANY mode):**
```bash
# Machines need EITHER "gpu" OR "high-memory" tag
curl -X POST http://your-server:3001/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "auto_select": true,
    "tags": ["gpu", "high-memory"],
    "tag_match_mode": "any",
    "count": 3,
    "distro_series": "jammy"
  }'
```

**Auto-select with pool filtering:**
```bash
# Find machines with "testing-fe" tag in "production" pool
curl -X POST http://your-server:3001/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "auto_select": true,
    "tags": ["testing-fe"],
    "pool": "production",
    "count": 2,
    "distro_series": "jammy"
  }'
```

**Complex multi-tag selection:**
```bash
# Machines must have ALL three tags: "gpu", "nvme", "high-memory"
curl -X POST http://your-server:3001/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "auto_select": true,
    "tags": ["gpu", "nvme", "high-memory"],
    "tag_match_mode": "all",
    "count": 1,
    "distro_series": "focal",
    "user_data": "#!/bin/bash\napt update\napt install -y nvidia-driver-470"
  }'
```

**Track job progress:**
```bash
# Get job status
curl http://your-server:3001/api/provision/job-1757497732724-1

# List all jobs
curl http://your-server:3001/api/provision

# List only running jobs
curl "http://your-server:3001/api/provision?status=running"
```

## Advanced Features Summary

### 🎯 Tag-Based Auto-Selection
- **Automatic machine discovery** by MAAS tags
- **Flexible matching modes**: ALL (restrictive) or ANY (permissive)
- **Resource validation** before deployment starts
- **Pool-aware filtering** respects configured MAAS pools

### 🚨 Intelligent Error Handling
- **"Not enough resources"** error with detailed information
- **Available alternatives** shown when selection fails  
- **Validation before deployment** prevents failed jobs

### 📊 Comprehensive Job Tracking
- **Real-time status updates** with detailed progress
- **Machine-specific results** for each deployment
- **Auto-selection metadata** showing selection criteria
- **Historical job tracking** with filtering capabilities

### 🔧 Production-Ready Features
- **Asynchronous processing** - API returns immediately with job ID
- **Server-side cloud-init generation** with machine-specific configurations
- **User credential integration** from external configuration files
- **OS-aware deployments** (Ubuntu vs Rocky/RHEL)
- **Network accessibility** from any host (not localhost-only)

### 💡 Use Case Examples
- **Development environments**: `tags: ["testing-fe"], count: 2`
- **GPU workloads**: `tags: ["gpu", "high-memory"], tag_match_mode: "all"`
- **Flexible resource allocation**: `tags: ["gpu", "nvme"], tag_match_mode: "any"`
- **Environment-specific**: `pool: "production", tags: ["certified"]`

## Configuration

### MAAS API Key

To get your MAAS API key:
1. Log into your MAAS web interface
2. Go to your user profile (top right)
3. Find the "API keys" section
4. Copy your existing key or generate a new one

### Resource Pool Filtering

The system can filter machines by MAAS resource pools:

- **Configuration**: Add `POOLS=pool1,pool2,default` to `maas.conf`
- **Default behavior**: Shows only machines from "default" pool if POOLS not specified
- **Multiple pools**: Comma-separated list (e.g., `POOLS=weka,default,production`)
- **Pool display**: Each machine shows its pool in the interface
- **Real-time filtering**: Server filters machines before sending to frontend

Example pool configurations:
```bash
# Show only default pool machines
POOLS=default

# Show machines from multiple pools
POOLS=weka,default,production

# Show all production and staging environments
POOLS=prod-west,prod-east,staging
```

### User Credentials

The system supports configurable user credentials for deployed machines:

- **Configuration file**: `users.conf` (key-value format)
- **Required fields**: `USERNAME` and `PASSWORD`
- **Security**: File is git-ignored and mounted read-only in Docker
- **Default behavior**: No user created if file not found
- **Usage**: All cloud-init configurations will use these credentials

Example `users.conf`:
```
USERNAME=admin
PASSWORD=MySecurePassword123!
```

After changing credentials, restart the Docker container:
```bash
docker compose restart
```

### Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (production/development)

## Deployment

### Production with Docker

```bash
# Build production image
docker build -t maas-frontend .

# Run container
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/maas.conf:/app/maas.conf:ro \
  -v $(pwd)/users.conf:/app/users.conf:ro \
  --name maas-frontend \
  maas-frontend
```

### Using Docker Compose

The included `docker-compose.yml` provides:
- Health checks
- Volume mounting for configuration
- Automatic restart on failure
- Network isolation
- External network access (binds to 0.0.0.0:3001)

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend │────│   FastAPI Backend│────│   MAAS Server   │
│   (Port 3000)    │    │   (Port 3001)    │    │   (Port 5240)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Components

- **Frontend**: React with Material-UI for the user interface
- **Backend**: FastAPI (Python) server with MAAS integration and async support
- **Configuration**: File-based configuration for MAAS connection
- **Docker**: Multi-stage build for optimized production deployment

## Development

### Project Structure

```
maas-front/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   │   ├── ProvisioningWizard.jsx
│   │   │   ├── MachineStatusChart.jsx
│   │   │   ├── BrokenMachinesTable.jsx
│   │   │   └── MachineSelection.jsx
│   │   ├── hooks/         # Custom React hooks
│   │   └── services/      # API client and cloud-init
├── app.py                 # FastAPI backend
├── services/              # Python backend services
│   └── cloud_init_generator.py  # Cloud-init configuration
├── requirements.txt       # Python dependencies
├── maas.conf.example      # MAAS configuration template
├── users.conf.example     # User credentials template
├── Dockerfile             # Multi-stage build
└── docker-compose.yml     # Orchestration
```

### Development Scripts

**Frontend:**
- `npm run dev` - Start frontend development server
- `npm run build` - Build frontend for production

**Backend:**
- `uvicorn app:app --host 0.0.0.0 --port 3001 --reload` - Start FastAPI development server
- `pip install -r requirements.txt` - Install Python dependencies

**Docker:**
- `docker compose build` - Build the application
- `docker compose up -d` - Start the application

## Troubleshooting

### MAAS Connection Issues

- Verify MAAS URL is accessible from the container
- Check API key permissions in MAAS
- Ensure MAAS API version compatibility (2.0)

### Container Issues

```bash
# Check container logs
docker-compose logs maas-frontend

# Check container health
docker-compose ps

# Restart services
docker-compose restart
```

## License

This project is open source and available under the MIT License.
