'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEnable2fa, useVerify2fa, useDisable2fa } from '@/features/auth/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function TwoFactorSetup() {
  const [step, setStep] = useState<'setup' | 'verify' | 'enabled'>('setup');
  const [code, setCode] = useState('');
  const enable2fa = useEnable2fa();
  const verify2fa = useVerify2fa();
  const disable2fa = useDisable2fa();

  const handleEnable = () => {
    enable2fa.mutate(undefined, {
      onSuccess: () => setStep('verify'),
    });
  };

  const handleVerify = () => {
    verify2fa.mutate(code, {
      onSuccess: () => setStep('enabled'),
    });
  };

  const handleDisable = () => {
    disable2fa.mutate('', {
      onSuccess: () => setStep('setup'),
    });
  };

  if (step === 'enabled') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication Enabled</CardTitle>
          <CardDescription>Your account is now protected with 2FA.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDisable} disabled={disable2fa.isPending}>
            Disable 2FA
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'verify') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verify Two-Factor Authentication</CardTitle>
          <CardDescription>Enter the code from your authenticator app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="text"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
          />
          <div className="flex gap-2">
            <Button onClick={handleVerify} disabled={verify2fa.isPending || code.length !== 6}>
              Verify
            </Button>
            <Button variant="outline" onClick={() => setStep('setup')}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enable Two-Factor Authentication</CardTitle>
        <CardDescription>Add an extra layer of security to your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleEnable} disabled={enable2fa.isPending}>
          Enable 2FA
        </Button>
      </CardContent>
    </Card>
  );
}
