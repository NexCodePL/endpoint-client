export type AuthorizationHeaders = {
    [key: string]: string | number;
};

export type AuthorizationHeadersProvider = () => Promise<AuthorizationHeaders>;

export interface EndpointError {
    code: number;
    errorCode: string;
    errorMessage: string;
    errorData?: any;
}
