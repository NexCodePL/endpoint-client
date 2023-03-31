import { useRef } from "react";
import { Store, useStore } from "@nexcodepl/react-store";
import { EndpointArgs, EndpointDefinition, EndpointDefinitionGetResponse } from "@nexcodepl/endpoint-types";

import { AuthorizationHeadersProvider } from "./client.types.js";
import { endpoint } from "./endpoint.js";

type DatasourceCancel = () => void;

export interface DatasourceStateIdle {
    state: "idle";
}

export interface DatasourceStatePending {
    state: "pending";
}

export interface DatasourceStateRefreshing<TEndpoint extends EndpointDefinition<any, any, any, boolean>> {
    response: EndpointDefinitionGetResponse<TEndpoint>;
    state: "refreshing";
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
    | DatasourceStateRefreshing<TEndpoint>
    | DatasourceStateError;

export const datasourceStateIdle: DatasourceStateIdle = { state: "idle" };

export function useDatasource<TEndpointDefintion extends EndpointDefinition<any, any, any, boolean>>(
    endpointDefinition: TEndpointDefintion,
    authorizationHeadersProvider?: AuthorizationHeadersProvider
): {
    state: Store<DatasourceState<TEndpointDefintion>>;
    load: (args: EndpointArgs<TEndpointDefintion>, keepState?: boolean) => void;
    cancel: () => void;
    reset: () => void;
} {
    const state = useStore<DatasourceState<TEndpointDefintion>>({
        ...datasourceStateIdle,
    });
    const cancelToken = useRef<DatasourceCancel | undefined>(undefined);

    async function load(args: EndpointArgs<TEndpointDefintion>, keepState?: boolean) {
        cancel();

        state.set(p => {
            if (!!keepState && (p.state === "completed" || p.state === "refreshing")) {
                return { state: "refreshing", response: p.response };
            }

            return {
                state: "pending",
            };
        });

        const endpointResponse = await endpoint(
            endpointDefinition,
            args,
            authorizationHeadersProvider,
            cancelFunction => {
                cancelToken.current = cancelFunction;
            }
        );

        if (endpointResponse[0] !== undefined) {
            if (endpointResponse[0].errorCode === "AxiosCancelError") return;

            const errorState: DatasourceStateError = {
                state: "error",
                code: endpointResponse[0].errorCode,
                message: endpointResponse[0].errorMessage,
                data: endpointResponse[0].errorData,
            };
            state.set(errorState);
        } else {
            state.set({ state: "completed", response: endpointResponse[1] });
        }

        return endpointResponse;
    }

    function cancel() {
        if (cancelToken.current) {
            cancelToken.current();
            cancelToken.current = undefined;
        }
    }

    function reset() {
        cancel();
        state.set({ state: "idle" });
    }

    return {
        state,
        load,
        cancel,
        reset,
    };
}
