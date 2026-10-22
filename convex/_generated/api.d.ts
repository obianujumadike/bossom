/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountLookup from "../accountLookup.js";
import type * as analyses from "../analyses.js";
import type * as auth from "../auth.js";
import type * as cases from "../cases.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as images from "../images.js";
import type * as lib_birads from "../lib/birads.js";
import type * as lib_cloudinary from "../lib/cloudinary.js";
import type * as lib_emailTransport from "../lib/emailTransport.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_imageUrl from "../lib/imageUrl.js";
import type * as lib_otpEmail from "../lib/otpEmail.js";
import type * as lib_passwordProvider from "../lib/passwordProvider.js";
import type * as lib_rules from "../lib/rules.js";
import type * as lib_session from "../lib/session.js";
import type * as lib_shape from "../lib/shape.js";
import type * as migration from "../migration.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountLookup: typeof accountLookup;
  analyses: typeof analyses;
  auth: typeof auth;
  cases: typeof cases;
  email: typeof email;
  http: typeof http;
  images: typeof images;
  "lib/birads": typeof lib_birads;
  "lib/cloudinary": typeof lib_cloudinary;
  "lib/emailTransport": typeof lib_emailTransport;
  "lib/env": typeof lib_env;
  "lib/imageUrl": typeof lib_imageUrl;
  "lib/otpEmail": typeof lib_otpEmail;
  "lib/passwordProvider": typeof lib_passwordProvider;
  "lib/rules": typeof lib_rules;
  "lib/session": typeof lib_session;
  "lib/shape": typeof lib_shape;
  migration: typeof migration;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
