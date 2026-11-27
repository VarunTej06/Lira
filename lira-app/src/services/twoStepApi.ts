import { send } from './authApi';

export interface TwoStepStatus { available: boolean; enabled: boolean }
export interface TwoStepSetup { secret: string; uri: string }

export const twoStepStatus = () => send<TwoStepStatus>('GET', '/api/me/two-step');
export const beginTwoStep = () => send<TwoStepSetup>('POST', '/api/me/two-step/begin');
export const confirmTwoStep = (code: string) => send<{ recoveryCodes: string[] }>('POST', '/api/me/two-step/confirm', { code });
export const disableTwoStep = (code: string) => send<void>('POST', '/api/me/two-step/disable', { code });
