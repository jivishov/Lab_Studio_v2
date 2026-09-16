import { BundleResourceError } from "./bundleErrors";

export type PublicBundleFolder = "labs" | "techniques";

const publicBundlePath = (folder: PublicBundleFolder, file: string): string => {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${folder}/${file}`;
};

/**
 * Fetch one public bundle file. Every failure here is a *resource* failure — the bytes could not be
 * obtained or are not JSON at all — so a fixture fallback is legitimate. Anything wrong with the
 * JSON's meaning is classified by the caller as a `BundleContentError` instead.
 */
export const fetchPublicJson = async <T,>(
  folder: PublicBundleFolder,
  file: string,
): Promise<T> => {
  const path = publicBundlePath(folder, file);
  let response: Response;
  try {
    response = await fetch(path);
  } catch (error) {
    throw new BundleResourceError(`Unable to reach ${path}.`, { cause: error });
  }
  if (!response.ok) {
    throw new BundleResourceError(`Unable to load ${path}: ${response.status}`);
  }
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new BundleResourceError(`${path} did not return parseable JSON.`, { cause: error });
  }
};
