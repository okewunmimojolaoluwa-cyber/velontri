'use client';

import { useDevices, useRevokeDevice, useRevokeAllDevices } from '@/features/auth/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function DeviceList() {
  const { data, isLoading } = useDevices();
  const revokeDevice = useRevokeDevice();
  const revokeAllDevices = useRevokeAllDevices();

  if (isLoading) {
    return <div>Loading devices...</div>;
  }

  const devices = Array.isArray(data?.data?.devices) ? data.data.devices : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Devices</CardTitle>
        <CardDescription>Manage devices that have access to your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active devices found.</p>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{device.device_name}</p>
                    {device.is_current && <Badge variant="secondary">Current</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {device.browser} on {device.os} • Last used {new Date(device.last_used).toLocaleDateString()}
                  </p>
                </div>
                {!device.is_current && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => revokeDevice.mutate(device.id)}
                    disabled={revokeDevice.isPending}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {devices.length > 1 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => revokeAllDevices.mutate()}
            disabled={revokeAllDevices.isPending}
          >
            Revoke All Other Devices
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
