/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "ai" {
  export const tool: any;
  export function generateText(params: any): any;
  export function streamText(params: any): any;
  export function parsePartialJson(params: any): any;
  export function generateObject(params: any): any;
  export class NoObjectGeneratedError extends Error {
    static isInstance(err: unknown): err is NoObjectGeneratedError;
    text?: string;
    finishReason?: unknown;
  }
}