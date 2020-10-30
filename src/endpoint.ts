import axios, { AxiosResponse } from "axios";
import {
    EndpointArgs,
    EndpointDefinitionGetParams,
    EndpointDefinitionGetData,
    EndpointDefinition,
    EndpointDefinitionGetResponse,
} from "@nexcodepl/endpoint-types";

import { AuthorizationHeadersProvider, EndpointError } from "./client.types";

interface EndpointErrorObject {
    response?: {
        status?: number;
        data?: {
            errorMessage?: string;
            errorCode?: string;
            errorData?: any;
        };
    };
}

interface EndpointArgsObject<TEndpointDefinition extends EndpointDefinition<any, any, any, boolean>> {
    params?: EndpointDefinitionGetParams<TEndpointDefinition>;
    data?: EndpointDefinitionGetData<TEndpointDefinition>;
}

type EndpointReturnType<TEndpointResponse> = [EndpointError, undefined] | [undefined, TEndpointResponse];

export async function endpoint<TEndpointDefintion extends EndpointDefinition<any, any, any, boolean>>(
    endpointDefinition: TEndpointDefintion,
    args: EndpointArgs<TEndpointDefintion>,
    authorizationHeadersProvider?: AuthorizationHeadersProvider,
    assignCancel?: (cancelFunction: () => void) => void
): Promise<EndpointReturnType<EndpointDefinitionGetResponse<TEndpointDefintion>>> {
    const argsObject: EndpointArgsObject<TEndpointDefintion> = args;

    if (endpointDefinition.secure && !authorizationHeadersProvider) {
        return [
            {
                code: 403,
                errorCode: "NoAuthorizationHeaderProvider",
                errorMessage: "Authorization Header Provider was not passed to endpoint/datasource",
            },
            undefined,
        ];
    }

    try {
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

        return [undefined, response.data];
    } catch (e) {
        if (axios.isCancel(e)) {
            return [
                {
                    code: 449,
                    errorCode: "AxiosCancelError",
                    errorMessage: "Request was canceled",
                },
                undefined,
            ];
        }

        const errorObject: EndpointErrorObject | undefined = e;
        const error: EndpointError = {
            code: errorObject?.response?.status ?? 500,
            errorCode: errorObject?.response?.data?.errorCode ?? "UnknownError",
            errorMessage: errorObject?.response?.data?.errorMessage ?? "Unknown Error",
            errorData: errorObject?.response?.data?.errorData ?? undefined,
        };
        return [error, undefined];
    }
}
