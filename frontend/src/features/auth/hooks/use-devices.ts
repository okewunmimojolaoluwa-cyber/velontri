import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Device {
  id: string;
  device_name: string;
  device_type: string;
  browser: string;
  os: string;
  last_used: string;
  is_current: boolean;
  ip_address?: string;
}

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      // Mock data - would call actual API
      return {
        data: [
          {
            id: '1',
            device_name: 'Chrome on Windows',
            device_type: 'desktop',
            browser: 'Chrome',
            os: 'Windows',
            last_used: new Date().toISOString(),
            is_current: true,
            ip_address: '192.168.1.1',
          },
        ],
      };
    },
  });
}

export function useRevokeDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => {
      // This would call an endpoint to revoke a device
      return Promise.resolve({ data: { success: true } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useRevokeAllDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      // This would call an endpoint to revoke all devices
      return Promise.resolve({ data: { success: true } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}
