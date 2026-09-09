export interface FinvayoUser {
  email: string;
  workspaceName: string;
  displayName: string;
  trialDays: number;
}

export interface FinvayoBootstrap {
  page?: string;
  user?: FinvayoUser;
  preview?: boolean;
  resetToken?: string;
}

declare global {
  interface Window {
    __FINVAYO__?: FinvayoBootstrap;
  }
}

export {};
