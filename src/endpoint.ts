import axios, { AxiosResponse } from "axios";
import {
    EndpointArgs,
    EndpointDefinitionGetParams,
    EndpointDefinitionGetData,
    EndpointDefinition,
    EndpointDefinitionGetResponse,
} from "@nexcodepl/endpoint-types";

import { AuthorizationHeadersProvider } from "./client.types";

interface EndpointArgsObject<TEndpointDefinition extends EndpointDefinition<any, any, any, boolean>> {
    params?: EndpointDefinitionGetParams<TEndpointDefinition>;
    data?: EndpointDefinitionGetData<TEndpointDefinition>;
}

export async function endpoint<TEndpointDefintion extends EndpointDefinition<any, any, any, boolean>>(
    endpointDefinition: TEndpointDefintion,
    args: EndpointArgs<TEndpointDefintion>,
    authorizationHeadersProvider?: AuthorizationHeadersProvider,
    assignCancel?: (cancelFunction: () => void) => void
): Promise<EndpointDefinitionGetResponse<TEndpointDefintion>> {
    const argsObject: EndpointArgsObject<TEndpointDefintion> = args;

    if (endpointDefinition.secure && !authorizationHeadersProvider) {
        throw new Error("NoAuthorizationHeadersProvider");
    }

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
            if (assignCancel) assignCancel(() => cancelFunction());
        }),
    });

    return response.data;
}
