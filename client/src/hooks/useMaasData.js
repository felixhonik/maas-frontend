import { useState, useEffect, useCallback } from 'react';
import { maasApi } from '../services/api';

export const useMaasConfig = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await maasApi.getConfigStatus();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, loading, error, refetch: fetchConfig };
};

export const useMachines = () => {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMachines = useCallback(async () => {
    try {
      setLoading(true);
      const data = await maasApi.getMachines();
      setMachines(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setMachines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  return { machines, loading, error, refetch: fetchMachines };
};

export const useTags = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      const data = await maasApi.getTags();
      setTags(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return { tags, loading, error, refetch: fetchTags };
};

export const usePools = () => {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPools = useCallback(async () => {
    try {
      setLoading(true);
      const data = await maasApi.getPools();
      setPools(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setPools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  return { pools, loading, error, refetch: fetchPools };
};

export const useBootResources = () => {
  const [bootResources, setBootResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBootResources = useCallback(async () => {
    try {
      setLoading(true);
      const data = await maasApi.getBootResources();
      setBootResources(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setBootResources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootResources();
  }, [fetchBootResources]);

  return { bootResources, loading, error, refetch: fetchBootResources };
};

export const useMaasDefaults = () => {
  const [defaults, setDefaults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDefaults = useCallback(async () => {
    try {
      setLoading(true);
      const data = await maasApi.getConfigDefaults();
      setDefaults(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setDefaults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  return { defaults, loading, error, refetch: fetchDefaults };
};