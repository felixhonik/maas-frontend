import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  Paper,
  Alert
} from '@mui/material';

const getStatusColor = (status) => {
  switch (status) {
    case 'Ready': return 'success';
    case 'Allocated': return 'warning';
    case 'Deployed': return 'info';
    case 'Failed': return 'error';
    default: return 'default';
  }
};

const MachineSelection = ({ machines, selectedMachines, onMachinesChange, requiredCount = 0 }) => {
  const availableMachines = machines.filter(m => m.status_name === 'Ready');
  
  const handleMachineToggle = (machine) => {
    const isSelected = selectedMachines.some(m => m.system_id === machine.system_id);
    if (isSelected) {
      onMachinesChange(selectedMachines.filter(m => m.system_id !== machine.system_id));
    } else if (selectedMachines.length < requiredCount) {
      onMachinesChange([...selectedMachines, machine]);
    }
  };

  const handleSelectAll = () => {
    const maxSelectable = Math.min(availableMachines.length, requiredCount);
    
    if (selectedMachines.length === maxSelectable) {
      onMachinesChange([]);
    } else {
      onMachinesChange(availableMachines.slice(0, maxSelectable));
    }
  };

  if (availableMachines.length === 0) {
    return (
      <Alert severity="warning">
        No machines are available for deployment from the configured pools. All machines must be in "Ready" status and belong to the configured resource pools.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select machines to deploy
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select {requiredCount} machine{requiredCount > 1 ? 's' : ''} from the available options. Only machines in "Ready" status can be deployed.
      </Typography>
      
      {requiredCount > 0 && (
        <Alert 
          severity={selectedMachines.length === requiredCount ? "success" : "info"} 
          sx={{ mb: 2 }}
        >
          Selected: {selectedMachines.length} / {requiredCount} machines
          {selectedMachines.length === requiredCount && " ✓ Ready to proceed"}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <Checkbox
                  checked={selectedMachines.length === Math.min(availableMachines.length, requiredCount) && requiredCount > 0}
                  indeterminate={selectedMachines.length > 0 && selectedMachines.length < Math.min(availableMachines.length, requiredCount)}
                  onChange={handleSelectAll}
                  disabled={requiredCount === 0}
                />
              </TableCell>
              <TableCell>Hostname</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Pool</TableCell>
              <TableCell>Architecture</TableCell>
              <TableCell>CPU/Memory</TableCell>
              <TableCell>Tags</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {availableMachines.map(machine => {
              const isSelected = selectedMachines.some(m => m.system_id === machine.system_id);
              
              return (
                <TableRow 
                  key={machine.system_id}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      disabled={!isSelected && selectedMachines.length >= requiredCount}
                      onChange={() => handleMachineToggle(machine)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {machine.hostname || machine.fqdn || 'Unknown'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {machine.system_id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={machine.status_name} 
                      color={getStatusColor(machine.status_name)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={machine.pool?.name || 'default'} 
                      variant="outlined"
                      size="small"
                      color="primary"
                    />
                  </TableCell>
                  <TableCell>
                    {machine.architecture}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {machine.cpu_count} CPU
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {Math.round(machine.memory / 1024)} GB RAM
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {machine.tag_names?.map(tag => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default MachineSelection;