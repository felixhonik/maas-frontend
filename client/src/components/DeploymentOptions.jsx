import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, AutoFixHigh as AutoIcon } from '@mui/icons-material';
import { generateCloudInit, getEnhancementDescription } from '../services/cloudInitGenerator';

const DeploymentOptions = ({ config, onConfigChange, selectedOS, selectedMachines = [] }) => {
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [useGenerated, setUseGenerated] = useState(true);
  const [userCredentials, setUserCredentials] = useState(null);
  
  // Fetch user credentials on component mount
  useEffect(() => {
    fetch('/api/user/config')
      .then(response => response.json())
      .then(data => {
        // Don't store password in state, just username
        setUserCredentials({
          configured: data.configured,
          username: data.username,
          hasPassword: data.hasPassword
        });
      })
      .catch(error => {
        console.error('Failed to fetch user config:', error);
        // Set to unconfigured state
        setUserCredentials({
          configured: false,
          username: null,
          hasPassword: false
        });
      });
  }, []);
  
  // Generate automatic cloud-init when machines are selected
  useEffect(() => {
    if (selectedMachines && selectedMachines.length > 0 && userCredentials) {
      // Fetch actual credentials for cloud-init generation
      fetch('/api/user/credentials')
        .then(response => response.json())
        .then(credentials => {
          // Determine OS type from selected OS
          const osType = selectedOS.toLowerCase().includes('rocky') || 
                        selectedOS.toLowerCase().includes('rhel') || 
                        selectedOS.toLowerCase().includes('centos') ? 'rocky' : 'ubuntu';
          
          const result = generateCloudInit(selectedMachines, config.user_data, osType, credentials);
          setGeneratedConfig(result);
          
          // Update config with generated cloud-init if using generated mode
          if (useGenerated) {
            onConfigChange({
              ...config,
              user_data: result.config
            });
          }
        })
        .catch(error => {
          console.error('Failed to fetch credentials for cloud-init:', error);
          // Fallback to no credentials
          const osType = selectedOS.toLowerCase().includes('rocky') || 
                        selectedOS.toLowerCase().includes('rhel') || 
                        selectedOS.toLowerCase().includes('centos') ? 'rocky' : 'ubuntu';
          
          const result = generateCloudInit(selectedMachines, config.user_data, osType, { configured: false });
          setGeneratedConfig(result);
          
          if (useGenerated) {
            onConfigChange({
              ...config,
              user_data: result.config
            });
          }
        });
    }
  }, [selectedMachines, useGenerated, selectedOS, userCredentials]);

  const handleChange = (field, value) => {
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  const handleToggleGenerated = () => {
    const newUseGenerated = !useGenerated;
    setUseGenerated(newUseGenerated);
    
    if (newUseGenerated && generatedConfig) {
      // Switch to generated config
      onConfigChange({
        ...config,
        user_data: generatedConfig.config
      });
    } else {
      // Switch to manual config
      onConfigChange({
        ...config,
        user_data: ''
      });
    }
  };

  const handleRegenerateConfig = () => {
    if (selectedMachines && selectedMachines.length > 0) {
      // Fetch actual credentials for cloud-init generation
      fetch('/api/user/credentials')
        .then(response => response.json())
        .then(credentials => {
          // Determine OS type from selected OS
          const osType = selectedOS.toLowerCase().includes('rocky') || 
                        selectedOS.toLowerCase().includes('rhel') || 
                        selectedOS.toLowerCase().includes('centos') ? 'rocky' : 'ubuntu';
          
          const result = generateCloudInit(selectedMachines, '', osType, credentials);
          setGeneratedConfig(result);
          onConfigChange({
            ...config,
            user_data: result.config
          });
        })
        .catch(error => {
          console.error('Failed to fetch credentials for regenerate:', error);
          // Fallback to no credentials
          const osType = selectedOS.toLowerCase().includes('rocky') || 
                        selectedOS.toLowerCase().includes('rhel') || 
                        selectedOS.toLowerCase().includes('centos') ? 'rocky' : 'ubuntu';
          
          const result = generateCloudInit(selectedMachines, '', osType, { configured: false });
          setGeneratedConfig(result);
          onConfigChange({
            ...config,
            user_data: result.config
          });
        });
    }
  };

  const distroOptions = [
    { value: 'jammy', label: 'Ubuntu 22.04 LTS (Jammy)' },
    { value: 'focal', label: 'Ubuntu 20.04 LTS (Focal)' },
    { value: 'bionic', label: 'Ubuntu 18.04 LTS (Bionic)' },
    { value: 'xenial', label: 'Ubuntu 16.04 LTS (Xenial)' }
  ];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configure deployment settings
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        These settings will be applied to all selected machines.
      </Alert>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Operating System: <strong>{selectedOS}</strong>
        </Alert>

        {/* Automatic Configuration Section */}
        {generatedConfig && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <AutoIcon color="primary" />
              <Typography variant="h6">Automatic Configuration</Typography>
              <Button
                variant={useGenerated ? "contained" : "outlined"}
                size="small"
                onClick={handleToggleGenerated}
              >
                {useGenerated ? "Using Auto Config" : "Use Auto Config"}
              </Button>
              {useGenerated && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleRegenerateConfig}
                >
                  Regenerate
                </Button>
              )}
            </Box>

            <Accordion expanded={useGenerated}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">
                  Auto-Generated Cloud-Init Configuration
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Base Configuration:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip label="Weka User" color="primary" size="small" />
                    <Chip label="Passwordless Sudo" color="primary" size="small" />
                    <Chip label="SSH Enabled" color="primary" size="small" />
                    <Chip label="Basic Packages" color="primary" size="small" />
                  </Box>

                  {generatedConfig.tags && generatedConfig.tags.length > 0 && (
                    <>
                      <Typography variant="subtitle2" gutterBottom>
                        Tag-Based Enhancements:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                        {generatedConfig.tags.map(tag => (
                          <Chip key={tag} label={tag} variant="outlined" size="small" />
                        ))}
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        {getEnhancementDescription(generatedConfig.tags).map((desc, index) => (
                          <Typography key={index} variant="body2" color="text.secondary">
                            • {desc}
                          </Typography>
                        ))}
                      </Box>
                    </>
                  )}

                  <Divider sx={{ my: 2 }} />
                  
                  <Box 
                    sx={{ 
                      backgroundColor: 'grey.100', 
                      p: 2, 
                      borderRadius: 1, 
                      maxHeight: 300, 
                      overflow: 'auto' 
                    }}
                  >
                    <Typography variant="body2" component="pre" sx={{ fontSize: '0.8rem' }}>
                      {generatedConfig.displayConfig || generatedConfig.config}
                    </Typography>
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}

        {/* Manual Configuration Section */}
        {!useGenerated && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Manual Cloud-Init Configuration
            </Typography>
            <TextField
              label="User Data (Cloud-Init)"
              multiline
              rows={12}
              value={config.user_data}
              onChange={(e) => handleChange('user_data', e.target.value)}
              placeholder={`#cloud-config
users:
  - name: weka
    sudo: 'ALL=(ALL) NOPASSWD:ALL'
    shell: /bin/bash
    groups: [sudo, docker]

ssh_pwauth: true
packages:
  - curl
  - wget
  - git

runcmd:
  - echo "Machine deployed via MAAS Frontend" > /tmp/deployment.log`}
              helperText="Manual cloud-init configuration - will override automatic settings"
              fullWidth
            />
          </Box>
        )}
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Deployment Summary:
        </Typography>
        <Typography variant="body2" color="text.secondary">
          OS: {selectedOS}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Machines: {selectedMachines.length} machine{selectedMachines.length > 1 ? 's' : ''}
        </Typography>
        {selectedMachines.length > 1 && (
          <Typography variant="body2" color="text.secondary">
            Configuration: Individual cloud-init per machine based on specific tags and hardware
          </Typography>
        )}
        {config.user_data && (
          <Typography variant="body2" color="text.secondary">
            Custom user data: {config.user_data.split('\n').length} lines (applied to all machines)
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default DeploymentOptions;