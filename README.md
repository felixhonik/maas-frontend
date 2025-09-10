# MAAS Frontend

A Docker-based web frontend for MAAS (Metal as a Service) that enables full provisioning of machines based on their MAAS tags through a multi-step dialog interface.

## Features

- **Multi-step provisioning wizard** with intuitive UI
- **Tag-based machine filtering** for targeted deployments
- **Pool-based machine filtering** to show only machines from specific resource pools
- **Live data from MAAS server** with real-time updates
- **Batch machine deployment** with customizable options
- **Configurable user credentials** for deployed machines
- **Machine status dashboard** with broken machines detection
- **Visual status charts** showing machine distribution and health
- **API-managed provisioning** with tag-based auto-selection
- **Advanced tag matching** (ALL/ANY modes) for flexible machine selection
- **Resource validation** with "Not enough resources" error handling
- **Docker containerized** for easy deployment
- **Network accessible** from any host (not just localhost)
- **Responsive Material-UI design**

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

```bash
# Install dependencies
npm run install:all

# Start development servers
npm run dev
```

This starts:
- Backend API server on port 3001
- Frontend dev server on port 3000 (with proxy to backend)

## Usage

### Dashboard Overview

The main dashboard provides:
- **Machine statistics**: Total, Ready, Deployed, and Broken machine counts
- **Status pie chart**: Visual distribution of machine states
- **Broken machines table**: Detailed view of machines requiring attention (shows first 3, expandable to full list)
- **Recent deployments**: History of provisioning activities with current status

### Provisioning Workflow

1. **Open the application** in your browser
2. **Click the + button** to start the provisioning wizard
3. **Select tags** to filter machines (optional)
4. **Choose machines** from the filtered list
5. **Configure deployment** options (OS, cloud-init)
6. **Deploy** and monitor progress

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
- `POST /api/provision` - **NEW**: Batch provisioning API for multiple machines
- `GET /api/provision` - **NEW**: List all provisioning jobs
- `GET /api/provision/:jobId` - **NEW**: Get provisioning job status

### Machine Status
- `GET /api/machines/:id/status` - Get machine deployment status

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
  "machines": ["machine-id-1", "machine-id-2"],
  "distro_series": "jammy",
  "user_data": "#!/bin/bash\necho 'Manual deployment'"
}
```

**Parameters:**
- `machines` (required for manual mode): Array of machine system IDs to deploy
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

**Deploy specific machines:**
```bash
curl -X POST http://your-server:3001/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "machines": ["4y3h8a", "6x4bef"],
    "distro_series": "jammy"
  }'
```

**Deploy with custom cloud-init:**
```bash
curl -X POST http://your-server:3001/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "machines": ["4y3h8a"],
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
│   React Frontend │────│   Node.js API    │────│   MAAS Server   │
│   (Port 3000)    │    │   (Port 3001)    │    │   (Port 5240)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Components

- **Frontend**: React with Material-UI for the user interface
- **Backend**: Node.js/Express API server with MAAS integration
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
├── server.js              # Express backend
├── maas.conf.example      # MAAS configuration template
├── users.conf.example     # User credentials template
├── Dockerfile             # Multi-stage build
└── docker-compose.yml     # Orchestration
```

### Scripts

- `npm run dev` - Start development servers
- `npm run build` - Build frontend for production
- `npm start` - Start production server
- `npm run install:all` - Install all dependencies

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