import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  AppBar,
  Toolbar,
  Fab
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import ProvisioningWizard from './components/ProvisioningWizard';
import MachineStatusChart from './components/MachineStatusChart';
import BrokenMachinesTable from './components/BrokenMachinesTable';
import { useMaasConfig, useMachines } from './hooks/useMaasData';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

function App() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deploymentHistory, setDeploymentHistory] = useState([]);
  
  const { config, loading: configLoading, error: configError } = useMaasConfig();
  const { machines, loading: machinesLoading, error: machinesError, refetch: refetchMachines } = useMachines();

  // Auto-refresh machines data every 30 seconds if there are active deployments
  useEffect(() => {
    if (deploymentHistory.length === 0) return;

    const interval = setInterval(() => {
      refetchMachines();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [deploymentHistory.length, refetchMachines]);

  const handleRefresh = () => {
    refetchMachines();
  };

  const handleWizardClose = (deploymentResults = null) => {
    setWizardOpen(false);
    
    // If deployment results are provided, add them to history
    if (deploymentResults && deploymentResults.length > 0) {
      const newDeployments = deploymentResults.map(result => ({
        ...result,
        timestamp: new Date().toISOString(),
        id: `${result.result.system_id}-${Date.now()}`
      }));
      setDeploymentHistory(prev => [...newDeployments, ...prev]);
      
      // Refresh machines data to update counts
      setTimeout(() => refetchMachines(), 2000);
    }
  };

  const isLoading = configLoading || machinesLoading;
  const hasError = configError || machinesError;
  
  const readyMachines = machines?.filter(m => m.status_name === 'Ready') || [];
  const deployedMachines = machines?.filter(m => m.status_name === 'Deployed') || [];
  
  // Broken machines include failed states and error conditions
  const brokenMachines = machines?.filter(m => 
    m.status_name === 'Failed deployment' || 
    m.status_name === 'Failed testing' ||
    m.status_name === 'Failed commissioning' ||
    m.status_name === 'Failed' ||
    m.status_name === 'Broken' ||
    m.status_name === 'Error'
  ) || [];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            MAAS Frontend
          </Typography>
          <Button 
            color="inherit" 
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {configError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Configuration Error: {configError}
            <br />
            Please ensure maas.conf file exists with MAAS_URL and API_KEY
          </Alert>
        )}

        {!config?.configured && !configLoading && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            MAAS is not configured. Please create a maas.conf file with your MAAS server URL and API key.
          </Alert>
        )}

        {config?.configured && config?.pools && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Showing machines from pools: <strong>{config.pools.join(', ')}</strong>
            {config.pools.length === 1 && config.pools[0] === 'default' && 
              ' (Add POOLS setting to maas.conf to filter by specific pools)'}
          </Alert>
        )}

        {hasError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {machinesError}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' }, gap: 3, mb: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Machines
              </Typography>
              {isLoading ? (
                <CircularProgress size={24} />
              ) : (
                <Typography variant="h4" color="primary">
                  {machines?.length || 0}
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Ready for Deployment
              </Typography>
              {isLoading ? (
                <CircularProgress size={24} />
              ) : (
                <Typography variant="h4" color="success.main">
                  {readyMachines.length}
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Currently Deployed
              </Typography>
              {isLoading ? (
                <CircularProgress size={24} />
              ) : (
                <Typography variant="h4" color="info.main">
                  {deployedMachines.length}
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Broken Machines
              </Typography>
              {isLoading ? (
                <CircularProgress size={24} />
              ) : (
                <Typography variant="h4" color="error.main">
                  {brokenMachines.length}
                </Typography>
              )}
              {!isLoading && brokenMachines.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Requires attention
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Machine Status Overview */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3, mb: 4 }}>
          {/* Broken Machines Table */}
          <Box>
            <BrokenMachinesTable machines={machines} />
          </Box>
          
          {/* Status Pie Chart */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Machine Status Distribution
              </Typography>
              <MachineStatusChart machines={machines} />
            </CardContent>
          </Card>
        </Box>

        {deploymentHistory.length > 0 && (
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Deployments
              </Typography>
              {deploymentHistory.slice(0, 5).map(deployment => {
                const machine = machines?.find(m => m.system_id === deployment.result.system_id);
                const currentStatus = machine?.status_name || 'Unknown';
                const statusColor = currentStatus === 'Deployed' ? 'success.main' : 
                                  currentStatus === 'Failed deployment' ? 'error.main' : 
                                  currentStatus === 'Deploying' ? 'info.main' : 'text.secondary';
                
                return (
                  <Box key={deployment.id} sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    py: 1,
                    borderBottom: deployment !== deploymentHistory.slice(0, 5)[deploymentHistory.slice(0, 5).length - 1] ? '1px solid' : 'none',
                    borderColor: 'divider'
                  }}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {deployment.machine}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Started: {new Date(deployment.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box textAlign="right">
                      <Typography variant="body2" color={statusColor} fontWeight="medium">
                        {currentStatus}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {deployment.result.system_id}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        )}

        <Fab
          color="primary"
          aria-label="provision machines"
          onClick={() => setWizardOpen(true)}
          disabled={!config?.configured || isLoading || readyMachines.length === 0}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
          }}
        >
          <AddIcon />
        </Fab>

        <ProvisioningWizard
          open={wizardOpen}
          onClose={handleWizardClose}
          machines={machines || []}
        />
      </Container>
    </ThemeProvider>
  );
}

export default App;