import { useQuery } from '@tanstack/react-query';
import { fetchDailyTransferability, getAvailableCurrencies } from '../api/stats';

export { getAvailableCurrencies };

export function useDailyTransferability() {
  return useQuery({
    queryKey: ['daily-transferability'],
    queryFn: fetchDailyTransferability,
  });
}
