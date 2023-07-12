import { Store, getStoreReadonly } from "@nexcodepl/store";
import { EndpointDefinition, EndpointDefinitionHeaders, EndpointGetArgs } from "@nexcodepl/endpoint-types";
import { endpointCall } from "./endpointCall.js";
import { DatasourceState } from "./types.js";

export interface DatasourceConfig {
    headers?: () => EndpointDefinitionHeaders;
    log?: boolean;
}

export class Datasource<TEndpoint extends EndpointDefinition<any, any, any, boolean>> {
    private _endpoint: TEndpoint;
    private _config: DatasourceConfig;
    private _cancelFunction: undefined | (() => void);
    private _state: Store<DatasourceState<TEndpoint>>;

    constructor(endpoint: TEndpoint, config: DatasourceConfig) {
        this._endpoint = endpoint;
        this._config = config ?? {};
        this._cancelFunction = undefined;
        this._state = new Store<DatasourceState<TEndpoint>>({ state: "idle" });
    }

    async load(args: EndpointGetArgs<TEndpoint>, keepState?: boolean, overrideUrl?: string) {
        try {
            this.cancel();

            this._state.set(p => {
                if (p.state === "completed" && keepState) {
                    return {
                        state: "refreshing",
                        response: p.response,
                        loadingData: {
                            isDownload: false,
                            downloadProgress: undefined,
                            isUpload: false,
                            uploadProgress: undefined,
                        },
                    };
                }

                return {
                    state: "pending",
                    loadingData: {
                        isDownload: false,
                        downloadProgress: undefined,
                        isUpload: false,
                        uploadProgress: undefined,
                    },
                };
            });

            const endpointResponse = await endpointCall(
                { ...this._endpoint, ...(overrideUrl ? { url: overrideUrl } : {}) },
                args,
                {
                    headers: this._config.headers?.() ?? {},
                    assignCancel: cancelFunction => {
                        this._cancelFunction = cancelFunction;
                    },
                    onUploadProgress: progress => {
                        this._state.set(p => {
                            if (p.state !== "pending") return p;
                            if (p.loadingData.isDownload) return p;
                            p.loadingData.isUpload = true;
                            p.loadingData.uploadProgress = progress;
                            return p;
                        });
                    },
                    onDownloadProgress: progress => {
                        this._state.set(p => {
                            if (p.state !== "pending") return p;
                            p.loadingData.isDownload = true;
                            p.loadingData.downloadProgress = progress;
                            return p;
                        });
                    },
                    noFormDataStringify: this._endpoint.noFormDataStringify,
                    log: this._config.log,
                }
            );

            const [error, response] = endpointResponse;

            if (error) {
                if (error.errorCode === "AxiosCancelError") return;

                this._state.set({ state: "error", error });
            } else {
                this._state.set({ state: "completed", response: response });
            }

            return endpointResponse;
        } catch (e) {
            console.log(e);
        }
    }

    get state() {
        return getStoreReadonly(this._state);
    }

    reset() {
        this.cancel();
        this._state.set({ state: "idle" });
    }

    cancel(config?: { keepResponse?: boolean; updateState?: boolean }) {
        if (this._cancelFunction) {
            this._cancelFunction();
            this._cancelFunction = undefined;
        }

        if (!config) config = {};

        const { updateState, keepResponse } = config;

        if (!updateState) return;

        const stateCurrent = this._state.current();
        if (stateCurrent.state !== "pending" && stateCurrent.state !== "refreshing") return;

        this._state.set(p => {
            if (p.state === "refreshing" && keepResponse) {
                return {
                    state: "completed",
                    response: p.response,
                };
            }

            return {
                state: "error",
                error: {
                    code: 449,
                    errorCode: "RequestCanceled",
                    errorMessage: "Request was cancelled",
                },
            };
        });
    }
}
