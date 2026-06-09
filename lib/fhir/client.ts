import { Client } from "fhir-kit-client";

export function createFhirClient(
    baseUrl: string,
    authType: string,
    bearerToken?: string,
    clientId?: string,
    clientSecret?: string
): Client {
    const config: any = {
        baseUrl: baseUrl
    };

    if (authType === "bearer" && bearerToken) {
        config.bearerToken = bearerToken;
    } else if (authType === "basic" && clientId && clientSecret) {
        // According to fhir-kit-client, for basic auth we can pass custom headers
        const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        config.customHeaders = {
            Authorization: `Basic ${encoded}`
        };
    }

    return new Client(config);
}
