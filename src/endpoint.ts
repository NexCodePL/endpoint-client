import axios, { AxiosResponse } from "axios";
import {
    EndpointArgs,
    EndpointDefinitionGetParams,
    EndpointDefinitionGetData,
    EndpointDefinition,
    EndpointDefinitionGetResponse,
} from "@nexcodepl/endpoint-types";

import { AuthorizationHeadersProvider, EndpointError } from "./client.types.js";

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

        const headers = { ...authorizationHeaders };

        headers["Content-Type"] = endpointDefinition.method === "GET" ? "text/plain" : "application/json";

        const response: AxiosResponse<EndpointDefinitionGetResponse<TEndpointDefintion>> = await axios({
            url: inlineParamsIntoUrl(endpointDefinition.url, argsObject.params),
            method: endpointDefinition.method,
            data: argsObject.data || {},
            params: argsObject.params || {},
            headers: headers,
            cancelToken: new axios.CancelToken(cancelFunction => {
                if (assignCancel) assignCancel(() => cancelFunction());
            }),
        });

        return [undefined, response.data];
    } catch (e: unknown) {
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

        const error = parseEndpointError(e);

        return [error, undefined];
    }
}

function inlineParamsIntoUrl(url: string, params: unknown): string {
    if (!params) return url;
    if (typeof params !== "object") return url;

    for (const [key, value] of Object.entries(params)) {
        const regex = new RegExp(`(:${key})`, "g");
        url = url.replace(regex, safeToString(value));
    }

    return url;
}

function safeToString(value: string | number | boolean): string {
    if (typeof value === "string") return value;
    if (typeof value === "number") return value.toString();
    if (typeof value === "boolean") return value ? "true" : "false";
    return "";
}

function isEndpointErrorObject(e: unknown): e is EndpointErrorObject {
    if (typeof e !== "object") return false;

    if (!(e as EndpointErrorObject)?.response) return false;

    return true;
}

function parseEndpointError(e: unknown): EndpointError {
    const error: EndpointError = {
        code: 500,
        errorCode: "UnknownError",
        errorMessage: "Unknown Error",
        errorData: undefined,
    };

    if (isEndpointErrorObject(e)) {
        const code = e?.response?.status;
        const errorCode = e?.response?.data?.errorCode;
        const errorMessage = e?.response?.data?.errorMessage;
        const errorData = e?.response?.data?.errorData;

        if (code) error.code = code;
        if (errorCode) error.errorCode = errorCode;
        if (errorMessage) error.errorMessage = errorMessage;
        if (errorData) error.errorData = errorData;
    }

    return error;
}
