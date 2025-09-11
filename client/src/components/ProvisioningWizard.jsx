import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  Alert,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import MachineCountSelection from './MachineCountSelection';
import MachineSelection from './MachineSelection';
import OSSelection from './OSSelection';
import DeploymentOptions from './DeploymentOptions';
import ConfirmationPage from './ConfirmationPage';
import { maasApi } from '../services/api';
import { useBootResources } from '../hooks/useMaasData';
import { getMachineCloudInit } from '../services/cloudInitGenerator';

const steps = ['Select Count', 'Choose Machines', 'Select OS', 'Configure Deployment', 'Confirm Deployment'];

const ProvisioningWizard = ({ open, onClose, machines }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [machineCount, setMachineCount] = useState(1);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [selectedOS, setSelectedOS] = useState('');
  const [deploymentConfig, setDeploymentConfig] = useState({
    user_data: ''
  });
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [deploymentStatus, setDeploymentStatus] = useState({});
  const [error, setError] = useState(null);
  const statusPollingRef = useRef(null);
  
  const { bootResources, loading: bootResourcesLoading } = useBootResources();

  // Poll deployment status for all deployed machines
  const pollDeploymentStatus = async () => {
    if (!deployResult || deployResult.length === 0) return;

    const statusUpdates = {};
    for (const deployment of deployResult) {
      try {
        const status = await maasApi.getMachineStatus(deployment.result.system_id);
        statusUpdates[deployment.result.system_id] = status;
      } catch (error) {
        console.error(`Failed to get status for ${deployment.machine}:`, error);
      }
    }
    setDeploymentStatus(statusUpdates);

    // Check if all deployments are complete or failed
    const allComplete = Object.values(statusUpdates).every(status => 
      ['Deployed', 'Failed deployment', 'Broken'].includes(status.status_name)
    );

    if (allComplete && statusPollingRef.current) {
      clearInterval(statusPollingRef.current);
      statusPollingRef.current = null;
    }
  };

  // Start polling when deployment results are available
  useEffect(() => {
    if (deployResult && deployResult.length > 0 && activeStep === 5) {
      // Initial status check
      pollDeploymentStatus();
      
      // Start polling every 10 seconds
      statusPollingRef.current = setInterval(pollDeploymentStatus, 10000);
    }

    return () => {
      if (statusPollingRef.current) {
        clearInterval(statusPollingRef.current);
        statusPollingRef.current = null;
      }
    };
  }, [deployResult, activeStep]);

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleDeploy = async () => {
    if (selectedMachines.length === 0) {
      setError('Please select at least one machine');
      return;
    }

    setDeploying(true);
    setError(null);
    const results = [];

    try {
      for (const machine of selectedMachines) {
        // Determine OS type from selected OS
        const osType = selectedOS.toLowerCase().includes('rocky') || 
                      selectedOS.toLowerCase().includes('rhel') || 
                      selectedOS.toLowerCase().includes('centos') ? 'rocky' : 'ubuntu';
        
        // Generate individual cloud-init configuration for each machine
        const machineSpecificUserData = getMachineCloudInit(machine, deploymentConfig.user_data, osType);
        
        const deployData = {
          distro_series: selectedOS,
          user_data: machineSpecificUserData
        };
        
        console.log(`Deploying machine ${machine.hostname || machine.system_id} with individualized ${osType} config`);
        const result = await maasApi.deployMachine(machine.system_id, deployData);
        results.push({ 
          machine: machine.hostname || machine.fqdn || machine.system_id, 
          result,
          individualConfig: true,
          osType: osType
        });
      }
      setDeployResult(results);
      setActiveStep(5); // Show results
    } catch (err) {
      setError(err.message);
    } finally {
      setDeploying(false);
    }
  };

  const handleReset = () => {
    const results = deployResult;
    setActiveStep(0);
    setMachineCount(1);
    setSelectedMachines([]);
    setSelectedOS('');
    setDeploymentConfig({ user_data: '' });
    setDeployResult(null);
    setDeploymentStatus({});
    setError(null);
    
    // Clear any active polling
    if (statusPollingRef.current) {
      clearInterval(statusPollingRef.current);
      statusPollingRef.current = null;
    }
    
    // Pass deployment results to parent when closing
    onClose(results);
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <MachineCountSelection
            machines={machines}
            selectedCount={machineCount}
            onCountChange={setMachineCount}
          />
        );
      case 1:
        return (
          <MachineSelection
            machines={machines}
            selectedMachines={selectedMachines}
            onMachinesChange={setSelectedMachines}
            requiredCount={machineCount}
          />
        );
      case 2:
        return (
          <OSSelection
            selectedMachines={selectedMachines}
            bootResources={bootResources}
            loading={bootResourcesLoading}
            selectedOS={selectedOS}
            onOSChange={setSelectedOS}
          />
        );
      case 3:
        return (
          <DeploymentOptions
            config={deploymentConfig}
            onConfigChange={setDeploymentConfig}
            selectedOS={selectedOS}
            selectedMachines={selectedMachines}
          />
        );
      case 4:
        return (
          <ConfirmationPage
            machineCount={machineCount}
            selectedMachines={selectedMachines}
            selectedOS={selectedOS}
            deploymentConfig={deploymentConfig}
            bootResources={bootResources}
          />
        );
      case 5:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Deployment Status
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Status updates automatically every 10 seconds
            </Typography>
            
            {deployResult?.map((result, index) => {
              const systemId = result.result.system_id;
              const status = deploymentStatus[systemId];
              const isDeploying = status?.status_name === 'Deploying';
              const isComplete = ['Deployed', 'Failed deployment', 'Broken'].includes(status?.status_name);
              const severity = status?.status_name === 'Deployed' ? 'success' : 
                             status?.status_name === 'Failed deployment' || status?.status_name === 'Broken' ? 'error' : 
                             isDeploying ? 'info' : 'warning';

              return (
                <Box key={index} sx={{ mb: 2 }}>
                  <Alert severity={severity} sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">
                      Machine: {result.machine} ({status?.hostname || systemId})
                    </Typography>
                    <Typography variant="body2">
                      Status: {status?.status_name || 'Checking...'}
                    </Typography>
                    {status?.status_message && (
                      <Typography variant="body2" color="text.secondary">
                        {status.status_message}
                      </Typography>
                    )}
                    {status?.deployment_progress !== null && status?.deployment_progress !== undefined && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Progress: {Math.round(status.deployment_progress)}%
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={status.deployment_progress} 
                        />
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Last updated: {status?.last_updated ? new Date(status.last_updated).toLocaleTimeString() : 'Never'}
                    </Typography>
                  </Alert>
                </Box>
              );
            })}
          </Box>
        );
      default:
        return 'Unknown step';
    }
  };

  const isStepComplete = (step) => {
    switch (step) {
      case 0:
        return machineCount > 0;
      case 1:
        return selectedMachines.length === machineCount;
      case 2:
        return selectedOS !== '';
      case 3:
        return true; // Deployment options are optional
      case 4:
        return true; // Confirmation page is always complete (review only)
      default:
        return false;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{ sx: { minHeight: 500 } }}
    >
      <DialogTitle>
        Machine Provisioning Wizard
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ width: '100%', mb: 3 }}>
          <Stepper activeStep={activeStep}>
            {steps.map((label, index) => (
              <Step key={label} completed={index < activeStep || (index === activeStep && isStepComplete(index))}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ minHeight: 300 }}>
          {getStepContent(activeStep)}
        </Box>
      </DialogContent>

      <DialogActions>
        {activeStep === 5 ? (
          <Button onClick={handleReset} variant="contained">
            Close
          </Button>
        ) : (
          <>
            <Button onClick={() => onClose()}>
              Cancel
            </Button>
            <Button 
              disabled={activeStep === 0} 
              onClick={handleBack}
            >
              Back
            </Button>
            {activeStep === steps.length - 1 ? (
              <Button 
                variant="contained" 
                onClick={handleDeploy}
                disabled={!isStepComplete(activeStep) || deploying}
                startIcon={deploying && <CircularProgress size={16} />}
                color="error"
              >
                {deploying ? 'Deploying...' : 'Deploy Now'}
              </Button>
            ) : (
              <Button 
                variant="contained" 
                onClick={handleNext}
                disabled={!isStepComplete(activeStep)}
              >
                Next
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ProvisioningWizard;