import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export const maasApi = {
  // Configuration
  getConfigStatus: async () => {
    const response = await api.get('/config/status');
    return response.data;
  },

  getConfigDefaults: async () => {
    const response = await api.get('/config/defaults');
    return response.data;
  },

  // Machines
  getMachines: async () => {
    const response = await api.get('/machines');
    return response.data;
  },

  deployMachine: async (machineId, deployOptions) => {
    const response = await api.post(`/machines/${machineId}/deploy`, deployOptions);
    return response.data;
  },

  getMachineStatus: async (machineId) => {
    const response = await api.get(`/machines/${machineId}/status`);
    return response.data;
  },

  // Tags
  getTags: async () => {
    const response = await api.get('/tags');
    return response.data;
  },

  // Pools
  getPools: async () => {
    const response = await api.get('/pools');
    return response.data;
  },

  // Boot sources and resources
  getBootSources: async () => {
    const response = await api.get('/boot-sources');
    return response.data;
  },

  getBootResources: async () => {
    const response = await api.get('/boot-resources');
    return response.data;
  },
};

export default api;