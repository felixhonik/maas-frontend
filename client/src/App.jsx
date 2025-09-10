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
import { useMaasConfig, useMachines, useRecentDeployments } from './hooks/useMaasData';

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
  const [showAllDeployments, setShowAllDeployments] = useState(false);
  
  const { config, loading: configLoading, error: configError } = useMaasConfig();
  const { machines, loading: machinesLoading, error: machinesError, refetch: refetchMachines } = useMachines();
  const { deployments: maasDeployments, loading: deploymentsLoading, error: deploymentsError, refetch: refetchDeployments } = useRecentDeployments();

  // Merge app-initiated deployments with MAAS deployments
  const allDeployments = React.useMemo(() => {
    // Create a map to avoid duplicates (app-initiated deployments take precedence)
    const deploymentMap = new Map();
    
    // Add MAAS deployments first
    maasDeployments.forEach(deployment => {
      deploymentMap.set(deployment.result.system_id, {
        ...deployment,
        source: deployment.source || 'maas'
      });
    });
    
    // Add app-initiated deployments (these will override MAAS ones for same machine)
    deploymentHistory.forEach(deployment => {
      deploymentMap.set(deployment.result.system_id, {
        ...deployment,
        source: 'app'
      });
    });
    
    // Convert back to array and sort by timestamp
    return Array.from(deploymentMap.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [deploymentHistory, maasDeployments]);

  // Auto-refresh machines and deployments data every 30 seconds if there are active deployments
  useEffect(() => {
    if (allDeployments.length === 0) return;

    const interval = setInterval(() => {
      refetchMachines();
      refetchDeployments();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [allDeployments.length, refetchMachines, refetchDeployments]);

  const handleRefresh = () => {
    refetchMachines();
    refetchDeployments();
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

  const isLoading = configLoading || machinesLoading || deploymentsLoading;
  const hasError = configError || machinesError || deploymentsError;
  
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
            {machinesError || deploymentsError}
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

        {allDeployments.length > 0 && (
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Deployments
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  (Includes all MAAS deployments in configured pools)
                </Typography>
              </Typography>
              {allDeployments.slice(0, showAllDeployments ? 10 : 5).map((deployment, index, displayedDeployments) => {
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
                    borderBottom: index !== displayedDeployments.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider'
                  }}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {deployment.machine}
                        {deployment.source === 'maas' && (
                          <Typography component="span" variant="caption" sx={{ 
                            ml: 1, 
                            px: 1, 
                            py: 0.25, 
                            backgroundColor: 'info.light', 
                            color: 'info.contrastText',
                            borderRadius: 1,
                            fontSize: '0.65rem'
                          }}>
                            MAAS
                          </Typography>
                        )}
                        {deployment.pool && deployment.pool !== 'default' && (
                          <Typography component="span" variant="caption" sx={{ 
                            ml: 1, 
                            px: 1, 
                            py: 0.25, 
                            backgroundColor: 'grey.200', 
                            color: 'grey.800',
                            borderRadius: 1,
                            fontSize: '0.65rem'
                          }}>
                            {deployment.pool}
                          </Typography>
                        )}
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
              
              {/* Show more/less button */}
              {allDeployments.length > 5 && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Button 
                    variant="text" 
                    size="small"
                    onClick={() => setShowAllDeployments(!showAllDeployments)}
                  >
                    {showAllDeployments ? 'Show Less' : `Show More (${Math.min(allDeployments.length - 5, 5)} more)`}
                  </Button>
                </Box>
              )}
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