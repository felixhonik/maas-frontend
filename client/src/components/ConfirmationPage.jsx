import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Computer as ComputerIcon,
  Memory as OSIcon,
  Settings as ConfigIcon,
  Numbers as CountIcon
} from '@mui/icons-material';

// Function to convert Synced OS names to official display names
const getOfficialOSName = (osName) => {
  if (!osName) return osName;
  
  const name = osName.toLowerCase();
  
  // Ubuntu versions mapping
  if (name.includes('ubuntu/jammy') || name.includes('jammy')) {
    return 'Ubuntu 22.04 LTS';
  }
  if (name.includes('ubuntu/focal') || name.includes('focal')) {
    return 'Ubuntu 20.04 LTS';
  }
  if (name.includes('ubuntu/bionic') || name.includes('bionic')) {
    return 'Ubuntu 18.04 LTS';
  }
  if (name.includes('ubuntu/noble') || name.includes('noble')) {
    return 'Ubuntu 24.04 LTS';
  }
  if (name.includes('ubuntu/mantic') || name.includes('mantic')) {
    return 'Ubuntu 23.10';
  }
  if (name.includes('ubuntu/lunar') || name.includes('lunar')) {
    return 'Ubuntu 23.04';
  }
  if (name.includes('ubuntu/kinetic') || name.includes('kinetic')) {
    return 'Ubuntu 22.10';
  }
  
  // If no match found, try to clean up the name
  if (name.includes('ubuntu/')) {
    const series = name.split('ubuntu/')[1];
    return `Ubuntu (${series})`;
  }
  
  // For non-Ubuntu OS, return cleaned up name
  return osName.charAt(0).toUpperCase() + osName.slice(1);
};

// Unified function to get OS display name based on type
const getOSDisplayName = (selectedOSName, bootResources) => {
  if (!selectedOSName || !bootResources) return selectedOSName;
  
  const osResource = bootResources.find(resource => resource.name === selectedOSName);
  if (!osResource) return selectedOSName;
  
  // Unified approach based on type
  if (osResource.type === 'Uploaded') {
    // For uploaded images, use the title field
    return osResource.title || osResource.name;
  } else {
    // For synced images, use official names
    return getOfficialOSName(osResource.name);
  }
};

const ConfirmationPage = ({ 
  machineCount, 
  selectedMachines, 
  selectedOS, 
  deploymentConfig,
  bootResources 
}) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Confirm Deployment
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please review your selections before proceeding with the deployment.
      </Typography>

      <Alert severity="warning" sx={{ mb: 3 }}>
        <strong>Warning:</strong> This will deploy the operating system to the selected machines. 
        All existing data on these machines will be lost. This action cannot be undone.
      </Alert>

      <Grid container spacing={3}>
        {/* Machine Count Summary */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CountIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Machine Count</Typography>
              </Box>
              <Typography variant="h4" color="primary.main">
                {machineCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                machine{machineCount > 1 ? 's' : ''} selected for deployment
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Operating System Summary */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <OSIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Operating System</Typography>
              </Box>
              <Typography variant="h6" color="primary.main">
                {getOSDisplayName(selectedOS, bootResources)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                will be deployed to all machines
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Selected Machines */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ComputerIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Selected Machines</Typography>
              </Box>
              <List dense>
                {selectedMachines.map((machine, index) => (
                  <ListItem key={machine.system_id} divider={index < selectedMachines.length - 1}>
                    <ListItemIcon>
                      <ComputerIcon color="action" />
                    </ListItemIcon>
                    <ListItemText
                      primary={machine.hostname || machine.fqdn || 'Unknown'}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            System ID: {machine.system_id}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Architecture: {machine.architecture}
                          </Typography>
                          <Typography variant="caption" display="block">
                            CPU: {machine.cpu_count} cores • RAM: {Math.round(machine.memory / 1024)} GB
                          </Typography>
                          {machine.tag_names && machine.tag_names.length > 0 && (
                            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {machine.tag_names.map(tag => (
                                <Chip 
                                  key={tag} 
                                  label={tag} 
                                  size="small" 
                                  variant="outlined" 
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Deployment Configuration */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ConfigIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Deployment Configuration</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Operating System:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {getOSDisplayName(selectedOS, bootResources)}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />
              
              {selectedMachines.length > 1 ? (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Individual Machine Configurations:
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Each machine will receive a customized cloud-init configuration based on its specific tags and hardware.
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip label="Machine-specific hostnames" size="small" color="primary" />
                    <Chip label="Tag-based driver installation" size="small" color="primary" />
                    <Chip label="Hardware-specific optimizations" size="small" color="primary" />
                  </Box>
                  
                  {deploymentConfig.user_data && (
                    <Typography variant="body2" color="text.secondary">
                      Custom user data ({deploymentConfig.user_data.split('\n').length} lines) will be merged with each machine's individual configuration.
                    </Typography>
                  )}
                </Box>
              ) : (
                <>
                  {deploymentConfig.user_data && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Cloud-Init User Data:
                      </Typography>
                      <Box 
                        sx={{ 
                          backgroundColor: 'grey.100', 
                          p: 2, 
                          borderRadius: 1, 
                          maxHeight: 200, 
                          overflow: 'auto' 
                        }}
                      >
                        <Typography variant="body2" component="pre" sx={{ fontSize: '0.8rem' }}>
                          {deploymentConfig.user_data.replace(/plain_text_passwd: '[^']*'/g, "plain_text_passwd: '[HIDDEN]'")}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {!deploymentConfig.user_data && (
                    <Typography variant="body2" color="text.secondary">
                      Machine-specific cloud-init configuration will be generated based on tags and hardware.
                    </Typography>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Deployment Summary */}
        <Grid item xs={12}>
          <Card sx={{ backgroundColor: 'primary.50' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary.main">
                Deployment Summary
              </Typography>
              <Typography variant="body1">
                <strong>{getOSDisplayName(selectedOS, bootResources)}</strong> will be deployed to <strong>{machineCount} machine{machineCount > 1 ? 's' : ''}</strong>:
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {selectedMachines.map(m => m.hostname || m.fqdn || 'Unknown').join(', ')}
              </Typography>
              
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary">
                  Click "Deploy" to start the provisioning process. This may take several minutes to complete.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ConfirmationPage;