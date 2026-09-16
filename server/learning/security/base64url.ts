export const encodeBase64Url = (value: string | Uint8Array): string =>
  Buffer.from(value).toString("base64url");

export const decodeBase64Url = (value: string): Buffer =>
  Buffer.from(value, "base64url");

export const decodeBase64UrlJson = <T>(value: string): T =>
  JSON.parse(decodeBase64Url(value).toString("utf8")) as T;
