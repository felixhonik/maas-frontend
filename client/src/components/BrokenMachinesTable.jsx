import React, { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Link,
  Card,
  CardContent,
  Collapse
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';

const BrokenMachinesTable = ({ machines }) => {
  const [showAll, setShowAll] = useState(false);
  
  // Filter broken machines
  const brokenMachines = machines?.filter(m => 
    m.status_name === 'Failed deployment' || 
    m.status_name === 'Failed testing' ||
    m.status_name === 'Failed commissioning' ||
    m.status_name === 'Failed' ||
    m.status_name === 'Broken' ||
    m.status_name === 'Error'
  ) || [];

  if (brokenMachines.length === 0) {
    return null;
  }

  const displayedMachines = showAll ? brokenMachines : brokenMachines.slice(0, 3);
  const hasMore = brokenMachines.length > 3;

  const getStatusColor = (status) => {
    switch (status) {
      case 'Failed deployment': return 'error';
      case 'Failed testing': return 'warning';
      case 'Failed commissioning': return 'warning';
      case 'Failed': return 'error';
      case 'Broken': return 'error';
      case 'Error': return 'error';
      case 'Deploying': return 'warning';
      default: return 'default';
    }
  };

  const getFailureReason = (machine) => {
    // Use error_description if available, otherwise use status_message
    if (machine.error_description && machine.error_description !== '') {
      // Truncate long descriptions
      const description = machine.error_description;
      return description.length > 80 ? description.substring(0, 80) + '...' : description;
    }
    
    if (machine.status_message && machine.status_message !== '') {
      const message = machine.status_message;
      return message.length > 80 ? message.substring(0, 80) + '...' : message;
    }
    
    // Fallback based on status
    switch (machine.status_name) {
      case 'Failed deployment':
        return 'Deployment process failed';
      case 'Failed testing':
        return 'Hardware testing failed';
      case 'Failed commissioning':
        return 'Commissioning process failed';
      case 'Failed':
        return 'General failure state';
      case 'Broken':
        return 'Machine marked as broken';
      case 'Error':
        return 'Unknown error occurred';
      default:
        return 'Unknown issue';
    }
  };

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom color="error.main">
          Broken Machines ({brokenMachines.length})
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Machines requiring attention
        </Typography>
        
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Hostname</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedMachines.map(machine => (
                <TableRow key={machine.system_id}>
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
                    <Typography variant="body2" color="text.secondary">
                      {getFailureReason(machine)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {hasMore && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Link
              component="button"
              variant="body2"
              onClick={() => setShowAll(!showAll)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              {showAll ? (
                <>
                  Show less
                  <ExpandLessIcon fontSize="small" />
                </>
              ) : (
                <>
                  Show {brokenMachines.length - 3} more broken machines
                  <ExpandMoreIcon fontSize="small" />
                </>
              )}
            </Link>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default BrokenMachinesTable;