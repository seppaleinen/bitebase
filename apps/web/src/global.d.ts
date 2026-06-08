/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "ai" {
  export const tool: any;
  export function generateText(params: any): any;
  export function streamText(params: any): any;
  export function parsePartialJson(params: any): any;
}
