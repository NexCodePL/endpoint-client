import axios, { AxiosResponse } from "axios";
import { useRef, useState } from "react";
import {
    EndpointArgs,
    EndpointDefinitionGetParams,
    EndpointDefinitionGetData,
    EndpointDefinition,
    EndpointDefinitionGetResponse,
} from "./endpoint.types";

interface EndpointArgsObject<TEndpointDefinition extends EndpointDefinition<any, any, any, boolean>> {
    params?: EndpointDefinitionGetParams<TEndpointDefinition>;
    data?: EndpointDefinitionGetData<TEndpointDefinition>;
}

interface EndpointErrorObject {
    response?: {
        data?: {
            errorMessage?: string;
            errorCode?: string;
            errorData?: any;
        };
    };
}

type DatasourceCancel = () => void;

export type AuthorizationHeaders = {
    [key: string]: string | number;
};

export type AuthorizationHeadersProvider = () => Promise<AuthorizationHeaders>;

export interface DatasourceStateIdle {
    state: "idle";
}

export interface DatasourceStatePending {
    state: "pending";
}

export interface DatasourceStateCompleted<TEndpoint extends EndpointDefinition<any, any, any, boolean>> {
    response: EndpointDefinitionGetResponse<TEndpoint>;
    state: "completed";
}

export interface DatasourceStateError {
    state: "error";
    message: string;
    code: string;
    data: any;
}
export type DatasourceState<TEndpoint extends EndpointDefinition<any, any, any, boolean>> =
    | DatasourceStateIdle
    | DatasourceStatePending
    | DatasourceStateCompleted<TEndpoint>
    | DatasourceStateError;

export const datasourceStateIdle: DatasourceStateIdle = { state: "idle" };

export function useDatasource<TEndpointDefintion extends EndpointDefinition<any, any, any, boolean>>(
    endpointDefinition: TEndpointDefintion,
    authorizationHeadersProvider?: AuthorizationHeadersProvider
): {
    state: DatasourceState<TEndpointDefintion>;
    load: (args: EndpointArgs<TEndpointDefintion>) => void;
    cancel: () => void;
    reset: () => void;
} {
    const [state, setState] = useState<DatasourceState<TEndpointDefintion>>({ ...datasourceStateIdle });
    const cancelToken = useRef<DatasourceCancel | undefined>(undefined);

    async function load(args: EndpointArgs<TEndpointDefintion>) {
        try {
            const argsObject: EndpointArgsObject<TEndpointDefintion> = args;

            cancel();

            setState({ state: "pending" });

            const authorizationHeaders = authorizationHeadersProvider ? await authorizationHeadersProvider() : {};

            const response: AxiosResponse<EndpointDefinitionGetResponse<TEndpointDefintion>> = await axios({
                url: endpointDefinition.url,
                method: endpointDefinition.method,
                data: argsObject.data || {},
                params: argsObject.params || {},
                headers: {
                    "Content-Type": "application/json",
                    ...authorizationHeaders,
                },
                cancelToken: new axios.CancelToken(cancelFunction => {
                    cancelToken.current = () => cancelFunction();
                }),
            });

            setState({ state: "completed", response: response.data });
        } catch (e) {
            if (axios.isCancel(e)) {
                return;
            }

            const error: EndpointErrorObject | undefined = e;
            const errorState: DatasourceStateError = {
                state: "error",
                code: error?.response?.data?.errorCode ?? "UnknownError",
                message: error?.response?.data?.errorMessage ?? "Unknown Error",
                data: error?.response?.data?.errorData ?? undefined,
            };
            setState(errorState);
        }
    }

    function cancel() {
        if (cancelToken.current) {
            cancelToken.current();
            cancelToken.current = undefined;
        }
    }

    function reset() {
        cancel();
        setState({ state: "idle" });
    }

    return {
        state,
        load,
        cancel,
        reset,
    };
}
