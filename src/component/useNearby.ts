import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getNearby } from '../services/nearbyService';
import type { Nearby } from '../services/nearbyService';

/** Nearby availability, refreshed whenever the screen gains focus. null until known. */
export const useNearby = (): (Nearby & { refresh: () => Promise<void> }) | null => {
  const [nearby, setNearby] = useState<Nearby | null>(null);

  const refresh = useCallback(async () => {
    try {
      setNearby(await getNearby());
    } catch {
      // Badges and owner lists are optional: keep what is shown.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return nearby ? { ...nearby, refresh } : null;
};
