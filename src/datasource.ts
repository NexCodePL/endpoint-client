import { useRef, useState } from "react";
import { EndpointArgs, EndpointDefinition, EndpointDefinitionGetResponse } from "@nexcodepl/endpoint-types";

import { AuthorizationHeadersProvider } from "./client.types";
import { endpoint } from "./endpoint";

type DatasourceCancel = () => void;

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
        cancel();

        setState({ state: "pending" });

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
            setState(errorState);
        } else {
            setState({ state: "completed", response: endpointResponse[1] });
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
