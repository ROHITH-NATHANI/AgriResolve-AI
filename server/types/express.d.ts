import 'express-session';

declare module 'express-session' {
    interface SessionData {
        timezone?: string;
        userTimezone?: {
            timezone: string;
            offset: number;
            detectionMethod: 'browser' | 'geolocation' | 'manual' | 'default';
        };
    }
}

declare module 'express-serve-static-core' {
    interface Request {
        session: import('express-session').Session & Partial<import('express-session').SessionData>;
        file?: any;
        files?: any;
    }
}
