import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';

const MachineCountSelection = ({ machines, selectedCount, onCountChange }) => {
  const readyMachines = machines.filter(m => m.status_name === 'Ready');
  
  if (readyMachines.length === 0) {
    return (
      <Alert severity="warning">
        No machines are available for deployment. All machines must be in "Ready" status.
      </Alert>
    );
  }

  const handleChange = (event) => {
    onCountChange(event.target.value);
  };

  // Generate options from 1 to the number of available machines
  const countOptions = Array.from({ length: readyMachines.length }, (_, i) => i + 1);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        How many machines do you want to provision?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select the number of machines to deploy. You have {readyMachines.length} machines ready for deployment.
      </Typography>

      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Number of Machines</InputLabel>
        <Select
          value={selectedCount}
          label="Number of Machines"
          onChange={handleChange}
        >
          {countOptions.map(count => (
            <MenuItem key={count} value={count}>
              {count} machine{count > 1 ? 's' : ''}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedCount > 0 && (
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Selection Summary:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You will provision {selectedCount} machine{selectedCount > 1 ? 's' : ''} from {readyMachines.length} available
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default MachineCountSelection;