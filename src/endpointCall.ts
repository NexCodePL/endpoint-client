import axios, { AxiosResponse } from "axios";
import {
    EndpointDefinition,
    EndpointDefinitionGetData,
    EndpointDefinitionGetParams,
    EndpointDefinitionGetResponse,
    EndpointDefinitionHeaders,
    EndpointDefinitionParamsAllowed,
    EndpointErrorResponse,
    EndpointGetArgs,
} from "@nexcodepl/endpoint-types";
import { EndpointError } from "./types.js";

export interface EndpointCallConfig {
    headers?: EndpointDefinitionHeaders;
    assignCancel?: (cancelFunction: () => void) => void;
    onUploadProgress?: (progress: number) => void;
    onDownloadProgress?: (progress: number) => void;
    noFormDataStringify?: boolean | undefined;
}

type DataType = "plain" | "json" | "form-data";

interface EndpointArgsObject<TEndpointDefinition extends EndpointDefinition<any, any, any, boolean>> {
    params?: EndpointDefinitionGetParams<TEndpointDefinition>;
    data?: EndpointDefinitionGetData<TEndpointDefinition>;
}
interface EndpointData {
    dataType: DataType;
    data: object | string | FormData | undefined;
}

export type EndpointReturnType<TEndpointResponse> = [EndpointError, undefined] | [undefined, TEndpointResponse];

export async function endpointCall<TEndpoint extends EndpointDefinition<any, any, any, any>>(
    endpointDefinition: TEndpoint,
    args: EndpointGetArgs<TEndpoint>,
    config?: EndpointCallConfig
): Promise<EndpointReturnType<EndpointDefinitionGetResponse<TEndpoint>>> {
    const argsObject: EndpointArgsObject<TEndpoint> = args;

    if (!config) config = {};

    const { data, dataType } = prepareData(argsObject.data, config.noFormDataStringify);

    const headers = {
        "Content-Type": getContentType(dataType),
        ...(config.headers ?? {}),
    };

    try {
        const response: AxiosResponse<EndpointDefinitionGetResponse<TEndpoint>> = await axios({
            url: inlineParamsIntoUrl(endpointDefinition.url, argsObject.params),
            method: endpointDefinition.method,
            data: data,
            params: getParamsWithoutInlined(argsObject.params, endpointDefinition.paramsInline),
            headers,
            cancelToken: new axios.CancelToken(cancelFunction => {
                if (!config?.assignCancel) return;
                config.assignCancel(cancelFunction);
            }),
            onUploadProgress: progressEvent => {
                if (!config?.onUploadProgress) return;

                if (!progressEvent.upload) {
                    return;
                }
                if (progressEvent.total === undefined || progressEvent.total === 0) return;

                config.onUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
            },
            onDownloadProgress: progressEvent => {
                if (!config?.onDownloadProgress) return;

                if (!progressEvent.download) {
                    return;
                }
                if (progressEvent.total === undefined || progressEvent.total === 0) return;

                config.onDownloadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
            },
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

function getContentType(dataType: DataType): string {
    switch (dataType) {
        case "form-data":
            return "multipart/form-data";

        case "json":
            return "application/json";

        case "plain":
            return "text/plain";
    }
}

function getParamsWithoutInlined<TParams extends EndpointDefinitionParamsAllowed<TParams>>(
    params: TParams,
    inlineParams: (string | number | symbol)[] | undefined
): Record<string, string> {
    if (params === undefined) return {};
    if (!inlineParams) inlineParams = [];

    const paramsObject: Record<string, string> = {};

    for (const [key, value] of Object.entries(params)) {
        if (typeof key !== "string") continue;
        if (inlineParams.includes(key)) continue;

        switch (typeof value) {
            case "number":
            case "boolean":
            case "string":
            case "object":
                paramsObject[key] = JSON.stringify(value);
                break;
        }
    }

    return paramsObject;
}

function prepareData(data: unknown, noFormDataStringify: boolean | undefined): EndpointData {
    if (data === undefined || data === null) {
        return { data: undefined, dataType: "plain" };
    }

    switch (typeof data) {
        case "string":
        case "bigint":
        case "number":
        case "boolean":
            return { data: JSON.stringify(data), dataType: "json" };

        case "object":
            return prepareDataObject(data, noFormDataStringify);

        default:
            return { data: undefined, dataType: "plain" };
    }
}

function prepareDataObject(data: object, noFormDataStringify: boolean | undefined): EndpointData {
    if (objectContainsFiles(data)) {
        const formData = new FormData();

        for (const [key, value] of Object.entries(data)) {
            if (value instanceof File) {
                formData.append(key, value);
            } else {
                try {
                    if (value === undefined) continue;

                    if (noFormDataStringify) {
                        formData.append(key, safeToString(value));
                    } else {
                        formData.append(key, JSON.stringify(value));
                    }
                } catch (e) {
                    throw new Error(`Cannot stringify data prop ${key}`);
                }
            }
        }

        return {
            data: formData,
            dataType: "form-data",
        };
    } else {
        try {
            return {
                data: data,
                dataType: "json",
            };
        } catch (e) {
            throw new Error("Cannot stringify data");
        }
    }
}

function objectContainsFiles(data: object) {
    for (const value of Object.values(data)) {
        if (value instanceof File) return true;
    }
    return false;
}

function inlineParamsIntoUrl<TParams extends EndpointDefinitionParamsAllowed<TParams>>(url: string, params: TParams) {
    if (params === undefined) return url;

    for (const [key, value] of Object.entries(params)) {
        const regex = new RegExp(`(:${key})`, "g");
        url = url.replace(regex, safeToString(value));
    }
}

function safeToString(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number") return value.toString();
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch (e) {
            return "";
        }
    }
    return "";
}

function isEndpointErrorResponse(e: unknown): e is EndpointErrorResponse {
    if (typeof e !== "object") return false;

    if (!(e as EndpointErrorResponse)?.response) return false;

    return true;
}

function parseEndpointError(e: unknown): EndpointError {
    const error: EndpointError = {
        code: 500,
        errorCode: "UnknownError",
        errorMessage: "Unknown Error",
        errorData: undefined,
    };

    if (isEndpointErrorResponse(e)) {
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
