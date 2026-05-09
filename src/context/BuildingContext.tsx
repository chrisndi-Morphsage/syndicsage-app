import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';

export interface Building {
  id: string; name: string; unit_count: number; city?: string;
  ag_date?: string; reserve_fund_balance?: number; annual_budget?: number;
}

interface BuildingContextValue {
  buildings: Building[];
  active: Building | null;
  setActive: (b: Building) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const BuildingContext = createContext<BuildingContextValue>({
  buildings: [], active: null, setActive: () => {}, loading: true, refresh: async () => {},
});

export function BuildingProvider({ children }: { children: React.ReactNode }) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [active, setActiveState]  = useState<Building | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api('GET', '/api/syndic/buildings');
      const blds: Building[] = data.buildings || data || [];
      setBuildings(blds);
      if (blds.length) {
        const saved = await AsyncStorage.getItem('ss_active_building');
        const found = saved ? blds.find(b => b.id === saved) : null;
        setActiveState(found || blds[0]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function setActive(b: Building) {
    setActiveState(b);
    AsyncStorage.setItem('ss_active_building', b.id);
  }

  return (
    <BuildingContext.Provider value={{ buildings, active, setActive, loading, refresh: load }}>
      {children}
    </BuildingContext.Provider>
  );
}

export function useBuildingContext() {
  return useContext(BuildingContext);
}
