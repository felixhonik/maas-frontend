import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Box, Typography, useTheme } from '@mui/material';

const MachineStatusChart = ({ machines }) => {
  const theme = useTheme();
  
  if (!machines || machines.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <Typography variant="body2" color="text.secondary">
          No machine data available
        </Typography>
      </Box>
    );
  }

  // Group machines by status
  const readyMachines = machines.filter(m => m.status_name === 'Ready');
  const deployedMachines = machines.filter(m => m.status_name === 'Deployed');
  const deployingMachines = machines.filter(m => m.status_name === 'Deploying');
  const brokenMachines = machines.filter(m => 
    m.status_name === 'Failed deployment' || 
    m.status_name === 'Failed testing' ||
    m.status_name === 'Failed commissioning' ||
    m.status_name === 'Failed' ||
    m.status_name === 'Broken' ||
    m.status_name === 'Error'
  );
  
  // Other statuses (Allocated, Commissioning, Testing, etc.)
  const otherMachines = machines.filter(m => 
    !readyMachines.includes(m) && 
    !deployedMachines.includes(m) && 
    !deployingMachines.includes(m) &&
    !brokenMachines.includes(m)
  );

  const data = [
    {
      name: 'Ready',
      value: readyMachines.length,
      color: theme.palette.success.main,
      count: readyMachines.length
    },
    {
      name: 'Deployed',
      value: deployedMachines.length,
      color: theme.palette.info.main,
      count: deployedMachines.length
    },
    {
      name: 'Deploying',
      value: deployingMachines.length,
      color: theme.palette.warning.main,
      count: deployingMachines.length
    },
    {
      name: 'Broken',
      value: brokenMachines.length,
      color: theme.palette.error.main,
      count: brokenMachines.length
    },
    {
      name: 'Other',
      value: otherMachines.length,
      color: theme.palette.grey[500],
      count: otherMachines.length
    }
  ].filter(item => item.value > 0); // Only show categories with machines

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            backgroundColor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 1,
            boxShadow: 1
          }}
        >
          <Typography variant="body2" fontWeight="medium">
            {data.name}: {data.count} machine{data.count !== 1 ? 's' : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {((data.count / machines.length) * 100).toFixed(1)}% of total
          </Typography>
        </Box>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }) => {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, mt: 2 }}>
        {payload.map((entry, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                backgroundColor: entry.color,
                borderRadius: '50%'
              }}
            />
            <Typography variant="body2">
              {entry.value}: {entry.payload.count}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={40}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default MachineStatusChart;