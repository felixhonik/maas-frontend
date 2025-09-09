# MAAS Frontend

A Docker-based web frontend for MAAS (Metal as a Service) that enables full provisioning of machines based on their MAAS tags through a multi-step dialog interface.

## Features

- **Multi-step provisioning wizard** with intuitive UI
- **Tag-based machine filtering** for targeted deployments
- **Live data from MAAS server** with real-time updates
- **Batch machine deployment** with customizable options
- **Docker containerized** for easy deployment
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
```

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

The application will be available at http://localhost:3001

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

1. **Open the application** in your browser
2. **Click the + button** to start the provisioning wizard
3. **Select tags** to filter machines (optional)
4. **Choose machines** from the filtered list
5. **Configure deployment** options (OS, cloud-init)
6. **Deploy** and monitor progress

## API Endpoints

- `GET /api/config/status` - Check MAAS configuration
- `GET /api/machines` - List all machines
- `GET /api/tags` - List all tags
- `GET /api/user/config` - Get current user configuration (without password)
- `GET /api/user/credentials` - Get user credentials for cloud-init generation
- `POST /api/machines/:id/deploy` - Deploy a machine

## Configuration

### MAAS API Key

To get your MAAS API key:
1. Log into your MAAS web interface
2. Go to your user profile (top right)
3. Find the "API keys" section
4. Copy your existing key or generate a new one

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
│   │   ├── hooks/         # Custom React hooks
│   │   └── services/      # API client
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