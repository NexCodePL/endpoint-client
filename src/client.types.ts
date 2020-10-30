export type AuthorizationHeaders = {
    [key: string]: string | number;
};

export type AuthorizationHeadersProvider = () => Promise<AuthorizationHeaders>;
