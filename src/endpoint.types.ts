export type EndpointMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface EndpointDefinition<TParams, TData, TResponse, TSecure extends boolean> {
    url: string;
    method: EndpointMethod;
    secure: TSecure;
    params?: TParams;
    data?: TData;
    response?: TResponse;
}

export type EndpointArgs<TEndpointDefinition> = TEndpointDefinition extends EndpointDefinition<
    undefined,
    undefined,
    any,
    boolean
>
    ? { params?: undefined; data?: undefined }
    : TEndpointDefinition extends EndpointDefinition<infer TParamsOnly, undefined, any, boolean>
    ? { params: TParamsOnly }
    : TEndpointDefinition extends EndpointDefinition<undefined, infer TDataOnly, any, boolean>
    ? { data: TDataOnly }
    : TEndpointDefinition extends EndpointDefinition<infer TParams, infer TData, any, boolean>
    ? { params: TParams; data: TData }
    : never;

export type EndpointDefinitionGetParams<TEndpointDefinition> = TEndpointDefinition extends EndpointDefinition<
    infer TParams,
    any,
    any,
    boolean
>
    ? TParams
    : never;

export type EndpointDefinitionGetData<TEndpointDefinition> = TEndpointDefinition extends EndpointDefinition<
    any,
    infer TData,
    any,
    boolean
>
    ? TData
    : never;

export type EndpointDefinitionGetResponse<TEndpointDefinition> = TEndpointDefinition extends EndpointDefinition<
    any,
    any,
    infer TResponse,
    boolean
>
    ? TResponse
    : never;
