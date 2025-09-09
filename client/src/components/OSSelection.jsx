import React, { useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import { useMaasDefaults } from '../hooks/useMaasData';

const OSSelection = ({ selectedMachines, bootResources, loading, selectedOS, onOSChange }) => {
  const { defaults, loading: defaultsLoading } = useMaasDefaults();
  const hasTriedAutoSelect = useRef(false);
  // Get unique architectures from selected machines
  const machineArchitectures = useMemo(() => {
    const architectures = selectedMachines.map(machine => machine.architecture);
    return [...new Set(architectures)];
  }, [selectedMachines]);

  // Filter boot resources based on selected machine architectures
  const availableOS = useMemo(() => {
    if (!bootResources || bootResources.length === 0) return [];
    
    const osOptions = [];
    
    bootResources.forEach(resource => {
      // Check if this boot resource supports any of our machine architectures
      const hasCompatibleArch = machineArchitectures.some(machineArch => {
        const machineArchBase = machineArch.split('/')[0]; // e.g. "amd64" from "amd64/generic"
        const resourceArchBase = resource.architecture.split('/')[0]; // e.g. "amd64" from "amd64/ga-20.04"
        return machineArchBase === resourceArchBase;
      });
      
      // Only include OS resources (skip bootloaders like grub-efi)
      const isOS = resource.name && (
        resource.name.includes('ubuntu/') || 
        resource.name.includes('rocky') ||
        resource.name.includes('centos') ||
        resource.name.startsWith('u-') // Ubuntu images like u-2204-0-k-1309-0
      );
      
      if (hasCompatibleArch && isOS) {
        osOptions.push({
          id: resource.id,
          name: resource.name,
          title: resource.name, // Use name as title since title doesn't exist
          architecture: resource.architecture,
          type: resource.type || 'Synced'
        });
      }
    });

    // Remove duplicates by name and sort
    const uniqueOS = osOptions.filter((os, index, self) => 
      index === self.findIndex(o => o.name === os.name)
    );

    return uniqueOS.sort((a, b) => a.name.localeCompare(b.name));
  }, [bootResources, machineArchitectures]);

  // Auto-select MAAS default OS when available and conditions are met
  useEffect(() => {
    console.log('OSSelection effect triggered:', {
      hasDefaults: !!defaults,
      defaultDistroSeries: defaults?.default_distro_series,
      selectedOS,
      availableOSCount: availableOS.length,
      availableOSNames: availableOS.map(os => os.name),
      hasTriedAutoSelect: hasTriedAutoSelect.current
    });

    // Only try auto-select once when we have everything we need
    if (defaults && availableOS.length > 0 && !hasTriedAutoSelect.current) {
      hasTriedAutoSelect.current = true;
      
      const defaultDistroSeries = defaults.default_distro_series;
      console.log('Looking for default OS:', defaultDistroSeries);
      
      // Try to find the default OS in available options with more flexible matching
      const defaultOS = availableOS.find(os => {
        const osName = os.name.toLowerCase();
        const series = defaultDistroSeries.toLowerCase();
        
        return (
          osName.includes(series) ||
          osName.includes(`ubuntu/${series}`) ||
          osName.includes(`u-${series.replace(/\./g, '')}`) ||
          osName.includes(`${series}-`) ||
          osName.includes(`-${series}-`) ||
          (series === 'jammy' && (osName.includes('22.04') || osName.includes('2204'))) ||
          (series === 'focal' && (osName.includes('20.04') || osName.includes('2004'))) ||
          (series === 'bionic' && (osName.includes('18.04') || osName.includes('1804')))
        );
      });
      
      console.log('Found default OS:', defaultOS);
      
      if (defaultOS) {
        console.log('Setting default OS:', defaultOS.name);
        onOSChange(defaultOS.name);
      } else {
        // If default not found, select the first Ubuntu option as fallback
        const ubuntuOS = availableOS.find(os => {
          const osName = os.name.toLowerCase();
          return osName.includes('ubuntu') || osName.startsWith('u-');
        });
        console.log('Using Ubuntu fallback:', ubuntuOS);
        if (ubuntuOS) {
          onOSChange(ubuntuOS.name);
        }
      }
    }
  }, [defaults, availableOS, onOSChange]);

  // Reset auto-select flag when machines change (new step)
  useEffect(() => {
    hasTriedAutoSelect.current = false;
  }, [selectedMachines]);

  if (selectedMachines.length === 0) {
    return (
      <Alert severity="info">
        Please select machines first to see compatible operating systems.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select operating system
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose an OS compatible with your selected machines' architecture{machineArchitectures.length > 1 ? 's' : ''}:
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Selected machines architectures:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {machineArchitectures.map(arch => (
            <Chip key={arch} label={arch} variant="outlined" size="small" />
          ))}
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={24} />
          <Typography>Loading available operating systems...</Typography>
        </Box>
      ) : availableOS.length === 0 ? (
        <Alert severity="warning">
          No compatible operating systems found for the selected machine architectures.
        </Alert>
      ) : (
        <>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Operating System</InputLabel>
            <Select
              value={selectedOS}
              label="Operating System"
              onChange={(e) => onOSChange(e.target.value)}
            >
              {availableOS.map(os => {
                const isDefault = defaults && (
                  os.name.includes(defaults.default_distro_series) ||
                  os.name.includes(`ubuntu/${defaults.default_distro_series}`) ||
                  os.name.includes(`u-${defaults.default_distro_series.replace(/\./g, '')}`)
                );
                
                return (
                  <MenuItem key={`${os.name}-${os.id}`} value={os.name}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {os.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {os.architecture} • {os.type}
                        </Typography>
                      </Box>
                      {isDefault && (
                        <Chip label="Default" size="small" color="primary" variant="outlined" />
                      )}
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          {selectedOS && (
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Selection Summary:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedOS} will be deployed to {selectedMachines.length} machine{selectedMachines.length > 1 ? 's' : ''}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default OSSelection;