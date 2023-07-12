import { EndpointDefinition, EndpointDefinitionGetResponse } from "@nexcodepl/endpoint-types";

export interface EndpointError {
    code: number;
    errorCode: string;
    errorMessage: string;
    errorData?: any;
}

interface DatasourceStateBase<TState extends string> {
    state: TState;
}

export interface DatasourceStateLoadingData {
    isUpload: boolean;
    uploadProgress: number | undefined;
    isDownload: boolean;
    downloadProgress: number | undefined;
}

export type DatasourceStateIdle = DatasourceStateBase<"idle">

export interface DatasourceStatePending extends DatasourceStateBase<"pending"> {
    loadingData: DatasourceStateLoadingData;
}

export interface DatasourceStateRefreshing<TEndpoint extends EndpointDefinition<any, any, any, boolean>>
    extends DatasourceStateBase<"refreshing"> {
    loadingData: DatasourceStateLoadingData;
    response: EndpointDefinitionGetResponse<TEndpoint>;
}

export interface DatasourceStateCompleted<TEndpoint extends EndpointDefinition<any, any, any, boolean>>
    extends DatasourceStateBase<"completed"> {
    response: EndpointDefinitionGetResponse<TEndpoint>;
}

export interface DatasourceStateError extends DatasourceStateBase<"error"> {
    error: EndpointError;
}

export type DatasourceState<TEndpoint extends EndpointDefinition<any, any, any, boolean>> =
    | DatasourceStateIdle
    | DatasourceStatePending
    | DatasourceStateRefreshing<TEndpoint>
    | DatasourceStateCompleted<TEndpoint>
    | DatasourceStateError;
