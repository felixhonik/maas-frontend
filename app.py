from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
import os
import asyncio
import httpx
import json
import time
import random
import string
from datetime import datetime
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MAAS Frontend API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global configuration storage
maas_config = None
user_config = None

# In-memory storage for provisioning jobs (in production, use Redis or database)
provisioning_jobs = {}
job_id_counter = 1

# Pydantic models
class MachineProvisionRequest(BaseModel):
    machines: Optional[List[str]] = None
    distro_series: Optional[str] = "jammy"
    user_data: Optional[str] = None
    tags: Optional[List[str]] = None
    pool: Optional[str] = None
    count: Optional[int] = None
    auto_select: Optional[bool] = False
    tag_match_mode: Optional[str] = "all"

class MachineDeployRequest(BaseModel):
    distro_series: Optional[str] = None
    user_data: Optional[str] = None

class ConfigStatus(BaseModel):
    configured: bool
    url: Optional[str] = None
    pools: List[str]

class UserConfig(BaseModel):
    configured: bool
    username: Optional[str] = None
    hasPassword: bool = False

class MachineStatus(BaseModel):
    system_id: str
    hostname: Optional[str]
    status_name: str
    status_message: Optional[str]
    deployment_progress: Optional[int]
    last_updated: str

class ProvisioningJobResponse(BaseModel):
    job_id: str
    status: str
    message: str
    machines_to_deploy: int
    auto_selection: Optional[Dict[str, Any]] = None
    selected_machines: Optional[List[str]] = None

# Configuration loading functions
def load_maas_config():
    """Load MAAS configuration from maas.conf file"""
    global maas_config
    try:
        config_path = Path(__file__).parent / 'maas.conf'
        if config_path.exists():
            config_content = config_path.read_text()
            lines = config_content.split('\n')
            config = {}
            
            for line in lines:
                if '=' in line:
                    key, value = line.split('=', 1)
                    key, value = key.strip(), value.strip()
                    if key and value:
                        config[key] = value
            
            maas_config = config
            logger.info('MAAS configuration loaded')
        else:
            logger.info('maas.conf not found. Please create it with MAAS_URL and API_KEY')
    except Exception as error:
        logger.error(f'Error loading MAAS config: {error}')

def load_user_config():
    """Load user configuration from users.conf file"""
    global user_config
    try:
        config_path = Path(__file__).parent / 'users.conf'
        if config_path.exists():
            config_content = config_path.read_text()
            lines = config_content.split('\n')
            config = {}
            
            for line in lines:
                if '=' in line:
                    key, value = line.split('=', 1)
                    key, value = key.strip(), value.strip()
                    if key and value:
                        config[key] = value
            
            user_config = config
            logger.info('User configuration loaded')
        else:
            logger.info('users.conf not found. No user will be created in deployed machines')
            user_config = None
    except Exception as error:
        logger.error(f'Error loading user config: {error}')
        user_config = None

# MAAS API helper
async def maas_api(endpoint: str, method: str = 'GET', data: Optional[Dict] = None):
    """Make authenticated requests to MAAS API"""
    if not maas_config or not maas_config.get('MAAS_URL') or not maas_config.get('API_KEY'):
        raise HTTPException(status_code=500, detail='MAAS configuration not found')

    # Parse the API key parts (consumer_key:consumer_token:secret)
    api_key_parts = maas_config['API_KEY'].split(':')
    if len(api_key_parts) != 3:
        raise HTTPException(status_code=500, detail='Invalid API key format')
    
    consumer_key, consumer_token, secret = api_key_parts
    
    # Generate OAuth parameters
    timestamp = str(int(time.time()))
    nonce = ''.join(random.choices(string.ascii_letters + string.digits, k=30))
    
    # MAAS OAuth signature format for PLAINTEXT method
    from urllib.parse import quote
    signature = f"&{quote(secret, safe='')}"
    
    # Build OAuth authorization header
    oauth_params = [
        f'oauth_version="1.0"',
        f'oauth_signature_method="PLAINTEXT"',
        f'oauth_consumer_key="{consumer_key}"',
        f'oauth_token="{consumer_token}"',
        f'oauth_signature="{signature}"',
        f'oauth_nonce="{nonce}"',
        f'oauth_timestamp="{timestamp}"'
    ]
    
    headers = {
        'Authorization': f'OAuth {", ".join(oauth_params)}',
    }

    url = f"{maas_config['MAAS_URL']}/api/2.0/{endpoint}"
    
    async with httpx.AsyncClient() as client:
        try:
            if method == 'POST' and data:
                headers['Content-Type'] = 'application/x-www-form-urlencoded'
                # Convert data to URL encoded format
                if isinstance(data, dict):
                    # Convert dict to URL-encoded string
                    from urllib.parse import urlencode
                    form_data = urlencode(data)
                else:
                    form_data = data
                response = await client.post(url, headers=headers, data=form_data)
            elif method == 'GET':
                response = await client.get(url, headers=headers)
            else:
                response = await client.request(method, url, headers=headers)
            
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as error:
            logger.error(f'MAAS API Error: {error}')
            raise HTTPException(status_code=500, detail=f'MAAS API Error: {str(error)}')

# Initialize configurations on startup
@app.on_event("startup")
async def startup_event():
    load_maas_config()
    load_user_config()

# API Routes
@app.get("/api/config/status", response_model=ConfigStatus)
async def get_config_status():
    """Get MAAS configuration status"""
    configured_pools = []
    if maas_config and maas_config.get('POOLS'):
        configured_pools = [p.strip() for p in maas_config['POOLS'].split(',')]
    else:
        configured_pools = ['default']
    
    return ConfigStatus(
        configured=bool(maas_config and maas_config.get('MAAS_URL') and maas_config.get('API_KEY')),
        url=maas_config.get('MAAS_URL') if maas_config else None,
        pools=configured_pools
    )

@app.get("/api/user/config", response_model=UserConfig)
async def get_user_config():
    """Get user configuration status"""
    return UserConfig(
        configured=bool(user_config),
        username=user_config.get('USERNAME') if user_config else None,
        hasPassword=bool(user_config and user_config.get('PASSWORD'))
    )

@app.get("/api/config/defaults")
async def get_config_defaults():
    """Get MAAS default configuration"""
    try:
        # Try different MAAS API endpoints to get configuration
        config = {}
        
        try:
            # First try the main MAAS config endpoint
            config = await maas_api('maas/')
        except Exception:
            try:
                # Fallback to version endpoint which sometimes contains defaults
                config = await maas_api('version/')
            except Exception:
                logger.info('Both MAAS config endpoints failed, using fallback defaults')
        
        logger.info(f'MAAS config response: {json.dumps(config, indent=2)}')
        
        return {
            "default_distro_series": config.get('default_distro_series', config.get('default_series', 'jammy')),
            "default_min_hwe_kernel": config.get('default_min_hwe_kernel', config.get('default_kernel', '')),
            "completed_intro": config.get('completed_intro', False),
            "debug_config": config  # Include for debugging
        }
    except Exception as error:
        logger.error(f'MAAS defaults API error: {error}')
        # Return fallback defaults even if API fails
        return {
            "default_distro_series": 'jammy',
            "default_min_hwe_kernel": '',
            "completed_intro": False,
            "error": str(error)
        }

@app.get("/api/machines")
async def get_machines():
    """Get filtered machines from MAAS"""
    try:
        machines = await maas_api('machines/')
        
        # Get configured pools from MAAS config, default to "default" if not specified
        configured_pools = []
        if maas_config and maas_config.get('POOLS'):
            configured_pools = [p.strip() for p in maas_config['POOLS'].split(',')]
        else:
            configured_pools = ['default']
        
        logger.info(f'Configured pools: {configured_pools}')
        
        # Filter machines by configured pools
        filtered_machines = []
        for machine in machines:
            # If machine has no pool info, assume it's in default pool
            machine_pool = machine.get('pool', {}).get('name', 'default')
            if machine_pool in configured_pools:
                filtered_machines.append(machine)
        
        logger.info(f'Filtered {len(filtered_machines)}/{len(machines)} machines by pools: {", ".join(configured_pools)}')
        
        return filtered_machines
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.get("/api/tags")
async def get_tags():
    """Get all tags from MAAS"""
    try:
        tags = await maas_api('tags/')
        return tags
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.get("/api/pools")
async def get_pools():
    """Get all resource pools from MAAS"""
    try:
        pools = await maas_api('resource-pools/')
        return pools
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.get("/api/boot-sources")
async def get_boot_sources():
    """Get boot sources from MAAS"""
    try:
        boot_sources = await maas_api('boot-sources/')
        return boot_sources
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.get("/api/boot-resources")
async def get_boot_resources():
    """Get boot resources from MAAS"""
    try:
        boot_resources = await maas_api('boot-resources/')
        return boot_resources
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.get("/api/user/credentials")
async def get_user_credentials():
    """Get user credentials for cloud-init generation"""
    if not user_config:
        return {"configured": False}
    
    return {
        "configured": True,
        "username": user_config.get('USERNAME'),
        "password": user_config.get('PASSWORD')
    }

@app.post("/api/machines/{machine_id}/deploy")
async def deploy_machine(machine_id: str, deploy_data: MachineDeployRequest):
    """Deploy a single machine"""
    try:
        data = {"op": "deploy"}
        if deploy_data.distro_series:
            data["distro_series"] = deploy_data.distro_series
        if deploy_data.user_data:
            data["user_data"] = deploy_data.user_data
        
        result = await maas_api(f'machines/{machine_id}/', 'POST', data)
        return result
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.get("/api/machines/{machine_id}/status", response_model=MachineStatus)
async def get_machine_status(machine_id: str):
    """Get machine status"""
    try:
        machine = await maas_api(f'machines/{machine_id}/')
        
        return MachineStatus(
            system_id=machine['system_id'],
            hostname=machine.get('hostname'),
            status_name=machine['status_name'],
            status_message=machine.get('status_message'),
            deployment_progress=machine.get('deployment_progress'),
            last_updated=datetime.now().isoformat()
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.get("/api/deployments/recent")
async def get_recent_deployments():
    """Get recent deployments from all machines (including manual MAAS deployments)"""
    try:
        machines = await maas_api('machines/')
        
        # Get configured pools from MAAS config, default to "default" if not specified
        configured_pools = []
        if maas_config and maas_config.get('POOLS'):
            configured_pools = [p.strip() for p in maas_config['POOLS'].split(',')]
        else:
            configured_pools = ['default']
        
        # Filter machines by configured pools
        filtered_machines = []
        for machine in machines:
            # If machine has no pool info, assume it's in default pool
            machine_pool = machine.get('pool', {}).get('name', 'default')
            if machine_pool in configured_pools:
                filtered_machines.append(machine)
        
        # Find machines that have been deployed recently or are currently deploying
        recent_deployments = []
        for machine in filtered_machines:
            # Include machines that are deployed, deploying, or failed deployment
            if machine['status_name'] in ['Deployed', 'Deploying', 'Failed deployment']:
                # Create a deployment record similar to app-initiated ones
                deployment = {
                    "id": f"maas-{machine['system_id']}",
                    "machine": machine.get('hostname') or machine.get('fqdn') or machine['system_id'],
                    "result": {
                        "system_id": machine['system_id'],
                        "hostname": machine.get('hostname'),
                        "status_name": machine['status_name']
                    },
                    "timestamp": machine.get('updated') or machine.get('created') or datetime.now().isoformat(),
                    "source": "maas",  # Indicate this came from MAAS directly
                    "status_name": machine['status_name'],
                    "status_message": machine.get('status_message'),
                    "pool": machine.get('pool', {}).get('name', 'default')
                }
                recent_deployments.append(deployment)
        
        # Sort by timestamp (most recent first) and limit to last 20 deployments
        recent_deployments.sort(key=lambda x: x['timestamp'], reverse=True)
        recent_deployments = recent_deployments[:20]
        
        logger.info(f'Found {len(recent_deployments)} recent deployments in pools: {", ".join(configured_pools)}')
        
        return recent_deployments
    except Exception as error:
        logger.error(f'Error fetching recent deployments: {error}')
        raise HTTPException(status_code=500, detail=str(error))

# Async function to handle machine deployments
async def deploy_machines(job_id: str, machine_ids: List[str], config: Dict):
    """Deploy multiple machines asynchronously"""
    from services.cloud_init_generator import get_machine_cloud_init
    
    job = provisioning_jobs.get(job_id)
    if not job:
        return

    try:
        job['status'] = 'running'
        job['updated_at'] = datetime.now().isoformat()
        
        # Get current machines data for processing
        all_machines = await maas_api('machines/')
        target_machines = []

        # Resolve machine IDs to machine objects
        for machine_input in machine_ids:
            system_id = machine_input if isinstance(machine_input, str) else machine_input.get('system_id')
            machine = next((m for m in all_machines if m['system_id'] == system_id), None)
            
            if machine:
                # Check if machine is in Ready state
                if machine['status_name'] != 'Ready':
                    job['results'].append({
                        "machine_id": system_id,
                        "hostname": machine.get('hostname', machine['system_id']),
                        "status": "skipped",
                        "reason": f"Machine not in Ready state (current: {machine['status_name']})"
                    })
                    continue
                target_machines.append(machine)
            else:
                job['results'].append({
                    "machine_id": system_id,
                    "hostname": system_id,
                    "status": "failed",
                    "reason": "Machine not found"
                })

        # Apply additional filters if specified
        if config.get('tags'):
            target_machines = [m for m in target_machines 
                             if any(tag in m.get('tag_names', []) for tag in config['tags'])]

        if config.get('pool'):
            target_machines = [m for m in target_machines 
                             if (m.get('pool', {}).get('name', 'default') == config['pool'])]

        # Limit count if specified
        if config.get('count') and config['count'] > 0:
            target_machines = target_machines[:config['count']]

        job['total_machines'] = len(target_machines)
        job['machines'] = [{"system_id": m['system_id'], 
                           "hostname": m.get('hostname', m.get('fqdn', m['system_id']))} 
                          for m in target_machines]

        # Deploy each machine
        for machine in target_machines:
            try:
                # Determine OS type
                distro_series = config.get('distro_series', 'jammy')
                os_type = 'rocky' if any(x in distro_series.lower() for x in ['rocky', 'rhel', 'centos']) else 'ubuntu'

                # Generate machine-specific cloud-init if user_data provided
                machine_user_data = config.get('user_data')
                if machine_user_data:
                    machine_user_data = await get_machine_cloud_init(machine, machine_user_data, os_type)

                deploy_data = {
                    "op": "deploy",
                    "distro_series": distro_series
                }
                if machine_user_data:
                    deploy_data["user_data"] = machine_user_data

                result = await maas_api(f'machines/{machine["system_id"]}/', 'POST', deploy_data)

                job['results'].append({
                    "machine_id": machine['system_id'],
                    "hostname": machine.get('hostname', machine.get('fqdn', machine['system_id'])),
                    "status": "deployed",
                    "distro_series": distro_series,
                    "os_type": os_type,
                    "deployed_at": datetime.now().isoformat(),
                    "maas_result": result
                })
                
                job['successful_deployments'] += 1

            except Exception as deploy_error:
                logger.error(f'Deployment failed for machine {machine["system_id"]}: {deploy_error}')
                job['results'].append({
                    "machine_id": machine['system_id'],
                    "hostname": machine.get('hostname', machine.get('fqdn', machine['system_id'])),
                    "status": "failed",
                    "error": str(deploy_error)
                })
                
                job['failed_deployments'] += 1

        # Mark job as completed
        job['status'] = 'completed' if job['failed_deployments'] == 0 else 'completed_with_errors'
        job['completed_at'] = datetime.now().isoformat()
        job['updated_at'] = datetime.now().isoformat()

        logger.info(f'Provisioning job {job_id} completed: {job["successful_deployments"]} successful, {job["failed_deployments"]} failed')

    except Exception as error:
        logger.error(f'Provisioning job {job_id} failed: {error}')
        job['status'] = 'failed'
        job['error'] = str(error)
        job['updated_at'] = datetime.now().isoformat()

async def resolve_machine_identifiers(identifiers: List[str]) -> List[str]:
    """
    Resolve machine identifiers (hostnames or system IDs) to system IDs.
    
    Args:
        identifiers: List of machine hostnames or system IDs
        
    Returns:
        List of system IDs
        
    Raises:
        HTTPException: If any identifier cannot be resolved
    """
    try:
        # Get all machines from MAAS
        all_machines = await maas_api('machines/')
        
        # Create lookup maps
        hostname_to_id = {}
        id_to_hostname = {}
        
        for machine in all_machines:
            system_id = machine['system_id']
            hostname = machine['hostname']
            hostname_to_id[hostname] = system_id
            id_to_hostname[system_id] = hostname
        
        resolved_ids = []
        unresolved = []
        
        for identifier in identifiers:
            if identifier in id_to_hostname:
                # It's already a system ID
                resolved_ids.append(identifier)
            elif identifier in hostname_to_id:
                # It's a hostname, convert to system ID
                resolved_ids.append(hostname_to_id[identifier])
            else:
                # Cannot resolve
                unresolved.append(identifier)
        
        if unresolved:
            available_hostnames = list(hostname_to_id.keys())
            available_ids = list(id_to_hostname.keys())
            
            raise HTTPException(
                status_code=400,
                detail={
                    "error": f"Cannot resolve machine identifiers: {unresolved}",
                    "available_hostnames": sorted(available_hostnames),
                    "available_system_ids": sorted(available_ids),
                    "hint": "Use either hostname (e.g., 'wekapoc1') or system ID (e.g., 'ht3nrd')"
                }
            )
        
        logger.info(f'Resolved {len(identifiers)} machine identifiers to system IDs: {resolved_ids}')
        return resolved_ids
        
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f'Machine identifier resolution error: {error}')
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to resolve machine identifiers",
                "details": str(error)
            }
        )

@app.post("/api/provision", response_model=ProvisioningJobResponse)
async def provision_machines(request: MachineProvisionRequest, background_tasks: BackgroundTasks):
    """Provision multiple machines"""
    global job_id_counter
    
    try:
        # Validate input - either machines array OR tags+count for auto-selection
        if request.auto_select or (request.tags and len(request.tags) > 0 and not request.machines):
            # Auto-selection mode: require tags and count
            if not request.tags or len(request.tags) == 0:
                raise HTTPException(
                    status_code=400, 
                    detail={
                        "error": "tags array is required for automatic machine selection",
                        "example": {
                            "auto_select": True,
                            "tags": ["testing-fe"],
                            "count": 2,
                            "distro_series": "jammy"
                        }
                    }
                )
            
            if not request.count or request.count < 1:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "count is required and must be greater than 0 for automatic machine selection",
                        "example": {
                            "auto_select": True,
                            "tags": ["testing-fe"],
                            "count": 2,
                            "distro_series": "jammy"
                        }
                    }
                )
        else:
            # Manual selection mode: require machines array
            if not request.machines or len(request.machines) == 0:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "machines array is required when not using automatic selection",
                        "example": {
                            "machines": ["wekapoc1", "wekapoc2", "wekapoc3"],
                            "distro_series": "jammy",
                            "note": "Use hostnames or system IDs"
                        }
                    }
                )

        # Handle automatic machine selection by tags
        selected_machines = request.machines
        resource_validation = None
        
        # Resolve hostnames to system IDs for manual selection
        if not (request.auto_select or (request.tags and len(request.tags) > 0 and not request.machines)):
            # Manual selection mode - resolve hostnames/IDs to system IDs
            selected_machines = await resolve_machine_identifiers(request.machines)
        
        if request.auto_select or (request.tags and len(request.tags) > 0 and not request.machines):
            try:
                # Get all available machines
                all_machines = await maas_api('machines/')
                
                # Filter machines by configured pools
                configured_pools = []
                if maas_config and maas_config.get('POOLS'):
                    configured_pools = [p.strip() for p in maas_config['POOLS'].split(',')]
                else:
                    configured_pools = ['default']
                
                pool_filtered_machines = []
                for machine in all_machines:
                    machine_pool = machine.get('pool', {}).get('name', 'default')
                    if machine_pool in configured_pools:
                        pool_filtered_machines.append(machine)
                
                # Filter by additional pool if specified in request
                available_machines = pool_filtered_machines
                if request.pool:
                    available_machines = [m for m in pool_filtered_machines 
                                        if (m.get('pool', {}).get('name', 'default') == request.pool)]
                
                # Filter by tags based on match mode
                match_mode = request.tag_match_mode or 'all'  # default to 'all'
                tagged_machines = []
                for machine in available_machines:
                    machine_tags = machine.get('tag_names', [])
                    
                    if match_mode == 'any':
                        # Machine must have AT LEAST ONE of the specified tags
                        if any(tag in machine_tags for tag in request.tags):
                            tagged_machines.append(machine)
                    else:
                        # Machine must have ALL specified tags (default behavior)
                        if all(tag in machine_tags for tag in request.tags):
                            tagged_machines.append(machine)
                
                # Filter by Ready status
                ready_machines = [m for m in tagged_machines if m['status_name'] == 'Ready']
                
                logger.info(f'Auto-selection: Found {len(ready_machines)} ready machines with tags [{", ".join(request.tags)}] ({match_mode} match), need {request.count}')
                
                # Check if we have enough resources
                if len(ready_machines) < request.count:
                    available_count = len(ready_machines)
                    requested_tags = ', '.join(request.tags)
                    pool_info = f' in pool \'{request.pool}\'' if request.pool else ''
                    
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "error": "Not enough resources to provision",
                            "details": {
                                "requested_count": request.count,
                                "available_count": available_count,
                                "required_tags": request.tags,
                                "pool": request.pool or "any configured pool",
                                "message": f"Requested {request.count} machines with tags [{requested_tags}]{pool_info}, but only {available_count} ready machines available"
                            },
                            "available_machines": [
                                {
                                    "system_id": m['system_id'],
                                    "hostname": m.get('hostname', m['system_id']),
                                    "tags": m.get('tag_names', []),
                                    "pool": m.get('pool', {}).get('name', 'default')
                                } for m in ready_machines
                            ]
                        }
                    )
                
                # Select the requested number of machines
                selected_machines = [m['system_id'] for m in ready_machines[:request.count]]
                
                resource_validation = {
                    "auto_selected": True,
                    "requested_count": request.count,
                    "available_count": len(ready_machines),
                    "selected_machines": len(selected_machines),
                    "selection_criteria": {
                        "tags": request.tags,
                        "tag_match_mode": match_mode,
                        "pool": request.pool,
                        "status": "Ready"
                    }
                }
                
                logger.info(f'Auto-selected {len(selected_machines)} machines: {selected_machines}')
                
            except HTTPException:
                raise
            except Exception as error:
                logger.error(f'Auto-selection error: {error}')
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": "Failed to auto-select machines",
                        "details": str(error)
                    }
                )

        # Create provisioning job
        job_id = f"job-{int(time.time())}-{job_id_counter}"
        job_id_counter += 1
        
        job = {
            "id": job_id,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "machines": [],
            "total_machines": 0,
            "successful_deployments": 0,
            "failed_deployments": 0,
            "results": [],
            "resource_validation": resource_validation,
            "config": {
                "distro_series": request.distro_series or 'jammy',
                "user_data": request.user_data,
                "tags": request.tags,
                "pool": request.pool,
                "count": request.count,
                "auto_select": request.auto_select,
                "tag_match_mode": request.tag_match_mode
            }
        }

        provisioning_jobs[job_id] = job

        # Start deployment process asynchronously
        background_tasks.add_task(deploy_machines, job_id, selected_machines, job["config"])

        # Return job ID immediately
        response_data = {
            "job_id": job_id,
            "status": "pending",
            "message": "Provisioning job started. Use GET /api/provision/{job_id} to track progress.",
            "machines_to_deploy": len(selected_machines)
        }
        
        # Add auto-selection info if applicable
        if resource_validation:
            response_data["auto_selection"] = resource_validation
            response_data["selected_machines"] = selected_machines
        
        return ProvisioningJobResponse(**response_data)

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f'Provisioning API error: {error}')
        raise HTTPException(status_code=500, detail=str(error))

@app.get("/api/provision/{job_id}")
async def get_provisioning_job(job_id: str):
    """Get provisioning job status"""
    job = provisioning_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Provisioning job not found")
    return job

@app.get("/api/provision")
async def list_provisioning_jobs(status: Optional[str] = Query(None), limit: int = Query(50)):
    """List all provisioning jobs"""
    jobs = list(provisioning_jobs.values())
    
    # Filter by status if provided
    if status:
        jobs = [job for job in jobs if job['status'] == status]
    
    # Sort by created_at desc and limit
    jobs.sort(key=lambda x: x['created_at'], reverse=True)
    jobs = jobs[:limit]
    
    return {
        "jobs": jobs,
        "total": len(provisioning_jobs)
    }

# Serve static files (React frontend) - check if directories exist first
import os
if os.path.exists("client/dist/assets"):
    app.mount("/assets", StaticFiles(directory="client/dist/assets"), name="assets")
if os.path.exists("client/dist/static"):
    app.mount("/static", StaticFiles(directory="client/dist/static"), name="static")

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve React frontend for all non-API routes"""
    # If it's an API route, let FastAPI handle it
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    # For all other routes, serve the React app
    index_path = Path(__file__).parent / "client" / "dist" / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    else:
        raise HTTPException(status_code=404, detail="Frontend not built")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 3001)))
